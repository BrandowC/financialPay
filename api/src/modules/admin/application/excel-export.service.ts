import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
import { CustomerQueryService } from './customer-query.service';

/**
 * Generación del archivo .xlsx descargable desde el panel.
 *
 * ── Por qué se escribe en streaming ────────────────────────────────────────
 * Con 2.000 registros diarios, en un año hay 700.000 filas. Construir ese libro
 * entero en memoria antes de enviarlo consumiría cientos de megabytes y, con
 * dos administradores exportando a la vez, tumbaría el contenedor.
 *
 * `WorkbookWriter` de ExcelJS escribe directamente sobre el stream de respuesta:
 * la memoria usada es constante, no crece con el número de filas, y el
 * administrador empieza a recibir el archivo de inmediato en vez de esperar a
 * que se termine de generar.
 *
 * ── Inyección de fórmulas ──────────────────────────────────────────────────
 * Excel interpreta como fórmula toda celda que empiece por = + - o @. Si un
 * usuario se registrara con el nombre `=HYPERLINK("http://malo.com","Click")`,
 * al abrir el archivo el cliente vería un enlace activo. Es un ataque real y
 * conocido (CSV/Formula Injection). `sanitize()` neutraliza esos prefijos.
 */
@Injectable()
export class ExcelExportService {
  private readonly logger = new Logger(ExcelExportService.name);

  /** El cliente pidió que el Excel no traiga todo el histórico cada vez que
   *  se descarga, solo lo registrado en esta ventana reciente. */
  private static readonly EXPORT_WINDOW_DAYS = 8;

  private static readonly COLUMNS: Array<{ header: string; key: string; width: number }> = [
    { header: 'Número de cuenta', key: 'accountNumber', width: 18 },
    { header: 'Nombre completo', key: 'fullName', width: 32 },
    { header: 'Correo', key: 'email', width: 32 },
    { header: 'Teléfono', key: 'phone', width: 18 },
    { header: 'Fecha de nacimiento', key: 'birthDate', width: 20 },
    { header: 'Fecha de registro', key: 'registeredAt', width: 20 },
    { header: 'Último acceso', key: 'lastLoginAt', width: 20 },
    { header: 'Saldo', key: 'balance', width: 16 },
    { header: 'Moneda', key: 'currency', width: 10 },
    { header: 'Saldo actualizado', key: 'balanceUpdatedAt', width: 20 },
    { header: 'Estado', key: 'status', width: 12 },
  ];

  constructor(private readonly customers: CustomerQueryService) {}

  /**
   * Escribe el libro directamente sobre la respuesta HTTP.
   * El controlador ya debe haber fijado las cabeceras.
   */
  async streamToResponse(response: Response): Promise<void> {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: response,
      useStyles: true,
      useSharedStrings: false, // menos memoria; el archivo pesa un poco más
    });

    workbook.creator = 'AM Cuenta';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Clientes', {
      views: [{ state: 'frozen', ySplit: 1 }], // encabezado siempre visible
    });

    sheet.columns = ExcelExportService.COLUMNS;

    // Encabezado con estilo de la marca.
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF15233F' }, // azul oscuro del logo
    };
    header.alignment = { vertical: 'middle', horizontal: 'left' };
    header.height = 24;
    header.commit();

    let rowCount = 0;

    for await (const batch of this.customers.streamAll(500, ExcelExportService.EXPORT_WINDOW_DAYS)) {
      for (const customer of batch) {
        const row = sheet.addRow({
          accountNumber: ExcelExportService.sanitize(customer.accountNumber),
          fullName: ExcelExportService.sanitize(customer.fullName),
          email: ExcelExportService.sanitize(customer.email),
          phone: ExcelExportService.sanitize(customer.phone),
          birthDate: customer.birthDate,
          registeredAt: ExcelExportService.formatDate(customer.registeredAt),
          lastLoginAt: customer.lastLoginAt
            ? ExcelExportService.formatDate(customer.lastLoginAt)
            : '—',
          // Se escribe como NÚMERO, no como texto: así el cliente puede sumar
          // la columna en Excel. La precisión se conserva porque los montos de
          // esta app caben de sobra en un double (hasta 2^53 centavos).
          balance: Number(customer.balance.decimal),
          currency: customer.balance.currency,
          balanceUpdatedAt: customer.balanceUpdatedAt
            ? ExcelExportService.formatDate(customer.balanceUpdatedAt)
            : '—',
          status: customer.status === 'ACTIVE' ? 'Activa' : customer.status,
        });

        row.getCell('balance').numFmt = '#,##0.00';
        // commit() libera la fila de memoria: es lo que hace que el uso de RAM
        // no crezca con el tamaño del archivo.
        row.commit();
        rowCount++;
      }
    }

    // Fila de totales al final.
    const totalRow = sheet.addRow({
      accountNumber: '',
      fullName: `TOTAL — ${rowCount} cliente(s) registrado(s) en los últimos ${ExcelExportService.EXPORT_WINDOW_DAYS} días`,
      balance: { formula: `SUM(H2:H${rowCount + 1})` },
    });
    totalRow.font = { bold: true };
    totalRow.getCell('balance').numFmt = '#,##0.00';
    totalRow.commit();

    sheet.commit();
    await workbook.commit();

    this.logger.log(`Exportación completada: ${rowCount} clientes`);
  }

  /** Nombre de archivo con marca de tiempo: am-cuenta-clientes-ultimos-8-dias-2026-03-04.xlsx */
  static fileName(): string {
    return `am-cuenta-clientes-ultimos-${ExcelExportService.EXPORT_WINDOW_DAYS}-dias-${new Date().toISOString().slice(0, 10)}.xlsx`;
  }

  private static readonly LEDGER_COLUMNS: Array<{ header: string; key: string; width: number }> = [
    { header: 'Número de cuenta', key: 'accountNumber', width: 18 },
    { header: 'Nombre completo', key: 'fullName', width: 32 },
    { header: 'Correo', key: 'email', width: 32 },
    { header: 'Teléfono', key: 'phone', width: 18 },
    { header: 'Fecha de nacimiento', key: 'birthDate', width: 20 },
    { header: 'Fecha de registro', key: 'registeredAt', width: 20 },
  ];

  /**
   * Historial COMPLETO de registros, desde `registration_ledger` — incluye
   * cuentas que ya se eliminaron (por eso no trae saldo ni estado: esos datos
   * dejan de existir cuando la cuenta se borra, ver migración 20260916000000;
   * lo único que sobrevive es lo que esta tabla guardó al momento del alta).
   */
  async streamRegistrationLedgerToResponse(response: Response): Promise<void> {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: response,
      useStyles: true,
      useSharedStrings: false,
    });

    workbook.creator = 'AM Cuenta';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Registros', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = ExcelExportService.LEDGER_COLUMNS;

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15233F' } };
    header.alignment = { vertical: 'middle', horizontal: 'left' };
    header.height = 24;
    header.commit();

    let rowCount = 0;

    for await (const batch of this.customers.streamRegistrationLedger(500)) {
      for (const entry of batch) {
        const row = sheet.addRow({
          accountNumber: ExcelExportService.sanitize(entry.accountNumber),
          fullName: ExcelExportService.sanitize(entry.fullName),
          email: ExcelExportService.sanitize(entry.email),
          phone: ExcelExportService.sanitize(entry.phone),
          birthDate: entry.birthDate,
          registeredAt: ExcelExportService.formatDate(entry.registeredAt),
        });
        row.commit();
        rowCount++;
      }
    }

    const totalRow = sheet.addRow({
      accountNumber: '',
      fullName: `TOTAL — ${rowCount} registro(s) desde siempre (incluye cuentas eliminadas)`,
    });
    totalRow.font = { bold: true };
    totalRow.commit();

    sheet.commit();
    await workbook.commit();

    this.logger.log(`Exportación de historial completado: ${rowCount} registros`);
  }

  /** am-cuenta-historial-registros-2026-03-04.xlsx */
  static ledgerFileName(): string {
    return `am-cuenta-historial-registros-${new Date().toISOString().slice(0, 10)}.xlsx`;
  }

  /**
   * Neutraliza la inyección de fórmulas anteponiendo un apóstrofo, que Excel
   * interpreta como "esto es texto literal" y no muestra en la celda.
   */
  private static sanitize(value: string): string {
    if (typeof value !== 'string' || value.length === 0) return value;
    return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  }

  private static formatDate(iso: string): string {
    return iso.replace('T', ' ').slice(0, 16);
  }
}
