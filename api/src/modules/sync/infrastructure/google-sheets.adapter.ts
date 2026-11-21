import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import { InfrastructureError } from '../../../shared/domain/errors/domain.error';
import {
  BalanceSheetUpdate,
  CustomerSheetRow,
  SpreadsheetSync,
} from '../application/ports/spreadsheet.port';

/**
 * Adaptador de Google Sheets.
 *
 * ── Cómo se autentica ───────────────────────────────────────────────────────
 * Con una CUENTA DE SERVICIO, no con la cuenta personal del cliente. Es decir:
 * Google Cloud genera una identidad de robot con su propia clave privada, y el
 * cliente comparte la hoja con el correo de ese robot como si fuera una persona
 * más. Ventajas:
 *   · No hay que pedirle la contraseña de Google a nadie.
 *   · Si el cliente se va de la empresa, la integración sigue viva.
 *   · Se puede revocar el acceso quitando el permiso de la hoja, sin tocar
 *     código ni desplegar.
 *
 * ── Columnas ────────────────────────────────────────────────────────────────
 * El orden está fijado en COLUMNS y NO debe cambiarse una vez en producción:
 * las actualizaciones de saldo escriben por letra de columna. Si hay que añadir
 * un campo, va al final.
 */
@Injectable()
export class GoogleSheetsAdapter implements SpreadsheetSync, OnModuleInit {
  private readonly logger = new Logger(GoogleSheetsAdapter.name);

  private client: sheets_v4.Sheets | null = null;
  private spreadsheetId = '';
  private tabName = 'Registros';
  private enabled = false;

  /** Orden de columnas. A=1, B=2, … Ver el comentario de la clase. */
  private static readonly COLUMNS = [
    'Número de cuenta',
    'Nombre completo',
    'Correo',
    'Teléfono',
    'Fecha de nacimiento',
    'Fecha de registro',
    'Saldo',
    'Moneda',
    'Último cambio de saldo',
    'Modificado por',
    'Estado',
  ] as const;

  /**
   * Índices (base 0) de las columnas que se actualizan al cambiar un saldo.
   * La columna de cuenta es la 0 (A) — se usa implícitamente al leer
   * `${tabName}!A:A` en `refreshRowIndexIfStale()`, por eso no tiene constante
   * propia aquí.
   */
  private static readonly COL_BALANCE = 6;
  private static readonly COL_UPDATED_AT = 8;
  private static readonly COL_UPDATED_BY = 9;
  private static readonly COL_STATUS = 10;

  /**
   * Caché de número de cuenta → número de fila.
   *
   * La API de Sheets no permite buscar; hay que leer la columna entera y
   * localizar el valor. Con 2.000 registros diarios la hoja llega a decenas de
   * miles de filas en meses, y releerla en cada cambio de saldo sería lento y
   * consumiría cuota. Se cachea y solo se reconstruye cuando hay un fallo.
   */
  private rowIndexCache = new Map<string, number>();
  private cacheBuiltAt = 0;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.enabled = this.config.get<boolean>('GOOGLE_SHEETS_ENABLED') ?? false;

    if (!this.enabled) {
      this.logger.warn(
        'Google Sheets desactivado. Los eventos se acumulan en outbox_events ' +
          'y se enviarán en cuanto se configure (no se pierde nada).',
      );
      return;
    }

    this.spreadsheetId = this.config.getOrThrow<string>('GOOGLE_SHEETS_SPREADSHEET_ID');
    this.tabName = this.config.getOrThrow<string>('GOOGLE_SHEETS_TAB_NAME');

    const auth = new google.auth.JWT({
      email: this.config.getOrThrow<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
      // En un .env los saltos de línea viajan como "\n" literales; hay que
      // devolverlos a su forma real o la clave PEM no se puede interpretar.
      key: this.config
        .getOrThrow<string>('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
        .replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.client = google.sheets({ version: 'v4', auth });

    try {
      await this.ensureHeaders();
      this.logger.log(`Google Sheets conectado · hoja "${this.tabName}"`);
    } catch (error) {
      // No se aborta el arranque: la API debe poder funcionar aunque la hoja
      // esté mal configurada. Los eventos esperan en el outbox.
      this.logger.error(
        'No se pudo conectar con Google Sheets. La API arranca igual y los ' +
          'eventos quedan en cola.',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async ensureHeaders(): Promise<void> {
    this.assertEnabled();

    const existing = await this.client!.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.tabName}!A1:K1`,
    });

    if (existing.data.values?.[0]?.length) return;

    await this.client!.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [[...GoogleSheetsAdapter.COLUMNS]] },
    });

    this.logger.log('Encabezados creados en la hoja');
  }

  async appendCustomers(rows: CustomerSheetRow[]): Promise<void> {
    this.assertEnabled();
    if (rows.length === 0) return;

    const values = rows.map((r) => [
      r.accountNumber,
      r.fullName,
      r.email,
      r.phone,
      r.birthDate,
      r.registeredAt,
      r.balance,
      r.currency,
      r.lastBalanceUpdate,
      r.updatedBy,
      r.status,
    ]);

    await this.withRetry('appendCustomers', async () => {
      await this.client!.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.tabName}!A:K`,
        // RAW y no USER_ENTERED: con USER_ENTERED, Sheets interpreta el
        // contenido como si lo hubiera tecleado una persona. Un nombre que
        // empiece por "=" se convertiría en fórmula — es el vector clásico de
        // inyección de fórmulas en CSV/Sheets. Con RAW se guarda como texto.
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values },
      });
    });

    // Las filas nuevas invalidan los índices cacheados.
    this.rowIndexCache.clear();
    this.logger.log(`${rows.length} cliente(s) añadidos a la hoja`);
  }

  async updateBalances(updates: BalanceSheetUpdate[]): Promise<void> {
    this.assertEnabled();
    if (updates.length === 0) return;

    await this.refreshRowIndexIfStale();

    const data: sheets_v4.Schema$ValueRange[] = [];
    const missing: string[] = [];

    for (const update of updates) {
      const rowNumber = this.rowIndexCache.get(update.accountNumber);

      if (!rowNumber) {
        missing.push(update.accountNumber);
        continue;
      }

      // G = saldo, I = fecha de cambio, J = modificado por.
      data.push(
        {
          range: `${this.tabName}!${GoogleSheetsAdapter.columnLetter(GoogleSheetsAdapter.COL_BALANCE)}${rowNumber}`,
          values: [[update.balance]],
        },
        {
          range: `${this.tabName}!${GoogleSheetsAdapter.columnLetter(GoogleSheetsAdapter.COL_UPDATED_AT)}${rowNumber}`,
          values: [[update.updatedAt]],
        },
        {
          range: `${this.tabName}!${GoogleSheetsAdapter.columnLetter(GoogleSheetsAdapter.COL_UPDATED_BY)}${rowNumber}`,
          values: [[update.updatedBy]],
        },
      );
    }

    if (missing.length > 0) {
      // La cuenta no está en la hoja. Pasa si alguien borró filas a mano o si
      // el alta aún no se procesó. Se lanza para que el outbox reintente: para
      // entonces el alta ya habrá llegado.
      throw new InfrastructureError(
        `Cuentas no encontradas en la hoja: ${missing.join(', ')}`,
        'SHEET_ROW_NOT_FOUND',
        undefined,
        { missing },
      );
    }

    await this.withRetry('updateBalances', async () => {
      await this.client!.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { valueInputOption: 'RAW', data },
      });
    });
  }

  async markDeleted(accountNumber: string, deletedAt: string): Promise<void> {
    this.assertEnabled();
    await this.refreshRowIndexIfStale();

    const rowNumber = this.rowIndexCache.get(accountNumber);
    // Si no está, no hay nada que marcar. No es un error.
    if (!rowNumber) return;

    await this.withRetry('markDeleted', async () => {
      await this.client!.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${this.tabName}!${GoogleSheetsAdapter.columnLetter(GoogleSheetsAdapter.COL_STATUS)}${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[`ELIMINADA ${deletedAt.slice(0, 10)}`]] },
      });
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!this.enabled || !this.client) return false;

    try {
      await this.client.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'spreadsheetId',
      });
      return true;
    } catch {
      return false;
    }
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  private assertEnabled(): void {
    if (!this.enabled || !this.client) {
      throw new InfrastructureError(
        'Google Sheets no está configurado',
        'SHEETS_NOT_CONFIGURED',
      );
    }
  }

  /** Relee la columna A y reconstruye el mapa cuenta → fila. */
  private async refreshRowIndexIfStale(): Promise<void> {
    const stale = Date.now() - this.cacheBuiltAt > GoogleSheetsAdapter.CACHE_TTL_MS;
    if (!stale && this.rowIndexCache.size > 0) return;

    const response = await this.withRetry('readAccountColumn', () =>
      this.client!.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.tabName}!A:A`,
      }),
    );

    this.rowIndexCache.clear();

    const column = response.data.values ?? [];
    // Se empieza en 1 para saltar el encabezado. El número de fila de Sheets es
    // base 1, así que el índice i del array corresponde a la fila i+1.
    for (let i = 1; i < column.length; i++) {
      const account = column[i]?.[0];
      if (typeof account === 'string' && account.length > 0) {
        this.rowIndexCache.set(account, i + 1);
      }
    }

    this.cacheBuiltAt = Date.now();
    this.logger.debug(`Índice de filas reconstruido: ${this.rowIndexCache.size} cuentas`);
  }

  /**
   * Reintento con espera exponencial para errores transitorios.
   *
   * Solo reintenta lo que tiene sentido reintentar: 429 (cuota) y 5xx. Un 403
   * (la hoja no está compartida con el robot) o un 404 (id equivocado) no se
   * arreglan solos, y reintentarlos solo gasta cuota y retrasa el diagnóstico.
   */
  private async withRetry<T>(operation: string, work: () => Promise<T>): Promise<T> {
    const MAX = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX; attempt++) {
      try {
        return await work();
      } catch (error) {
        lastError = error;
        const status = (error as { code?: number; status?: number })?.code ??
          (error as { status?: number })?.status;

        const retriable = status === 429 || (typeof status === 'number' && status >= 500);

        if (!retriable || attempt === MAX) break;

        // 1s, 2s, 4s… más un jitter aleatorio para que varios workers que
        // fallan a la vez no vuelvan todos en el mismo instante.
        const backoff = 2 ** (attempt - 1) * 1000 + Math.random() * 500;
        this.logger.warn(
          `${operation} falló (status ${status}). Reintento ${attempt}/${MAX} en ${Math.round(backoff)}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    throw new InfrastructureError(
      `Google Sheets: falló ${operation}`,
      'SHEETS_OPERATION_FAILED',
      lastError,
    );
  }

  /** 0 → 'A', 6 → 'G', 26 → 'AA'. */
  private static columnLetter(index: number): string {
    let letter = '';
    let n = index;
    while (n >= 0) {
      letter = String.fromCharCode((n % 26) + 65) + letter;
      n = Math.floor(n / 26) - 1;
    }
    return letter;
  }
}
