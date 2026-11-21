export const SPREADSHEET_SYNC = Symbol('SPREADSHEET_SYNC');

/** Una fila de la hoja, en el orden exacto de las columnas. */
export interface CustomerSheetRow {
  accountNumber: string;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  registeredAt: string;
  balance: string;
  currency: string;
  lastBalanceUpdate: string;
  updatedBy: string;
  status: string;
}

export interface BalanceSheetUpdate {
  accountNumber: string;
  balance: string;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Puerto de sincronización con la hoja de cálculo.
 *
 * ── Por qué es un puerto y no una llamada directa a googleapis ─────────────
 * El cliente pidió Google Sheets, pero este contrato no menciona Google por
 * ningún lado. Si mañana quiere Microsoft Excel Online, Airtable o un CSV en
 * S3, se escribe otro adaptador y no se toca ni una línea del worker ni de los
 * casos de uso. Es el Principio Abierto/Cerrado en su forma más útil.
 *
 * Además permite testear el worker con un adaptador en memoria que simula
 * fallos de red, sin llamar a Google en cada ejecución de la suite.
 */
export interface SpreadsheetSync {
  /** Crea la fila de encabezados si la hoja está vacía. Idempotente. */
  ensureHeaders(): Promise<void>;

  /**
   * Agrega varias filas de una sola vez.
   *
   * Es `append` en plural a propósito: la API de Sheets limita a 60 peticiones
   * por minuto y por usuario. Enviando las altas de una en una, un pico de
   * registros agotaría la cuota y el resto quedaría en reintento. En un solo
   * lote caben cientos de filas con una única petición.
   */
  appendCustomers(rows: CustomerSheetRow[]): Promise<void>;

  /** Actualiza las celdas de saldo de un cliente ya existente en la hoja. */
  updateBalances(updates: BalanceSheetUpdate[]): Promise<void>;

  /** Marca la fila como dada de baja (no se borra: se conserva el histórico). */
  markDeleted(accountNumber: string, deletedAt: string): Promise<void>;

  /** ¿Está configurado y accesible? Lo usa /health. */
  isAvailable(): Promise<boolean>;
}
