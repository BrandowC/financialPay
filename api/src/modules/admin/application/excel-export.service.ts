import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
import { CustomerQueryService } from './customer-query.service';

/**
 * Generación del archivo .xlsx descargable desde el panel.
 *
 * ── Por qué se escribe en streaming ────────────────────────────────────────
 * Construir el libro entero en memoria antes de enviarlo consumiría cientos de
 * megabytes con muchas filas. `WorkbookWriter` de ExcelJS escribe directamente
 * sobre el stream de respuesta: la memoria usada es constante, no crece con el
 * número de filas, y quien descarga empieza a recibir el archivo de inmediato.
 *
 * ── Inyección de fórmulas ──────────────────────────────────────────────────
 * Excel interpreta como fórmula toda celda que empiece por = + - o @. Si
 * alguien se registrara con el nombre `=HYPERLINK("http://malo.com","Click")`,
 * al abrir el archivo se vería un enlace activo. Es un ataque real y conocido
 * (CSV/Formula Injection). `sanitize()` neutraliza esos prefijos.
 */
@Injectable()
export class ExcelExportService {
  private readonly logger = new Logger(ExcelExportService.name);

  private static readonly COLUMNS: Array<{ header: string; key: string; width: number }> = [
    { header: 'Nombre completo', key: 'fullName', width: 32 },
    { header: 'Correo', key: 'email', width: 32 },
    { header: 'País', key: 'country', width: 10 },
    { header: 'Teléfono', key: 'phone', width: 20 },
    { header: 'Fecha de nacimiento', key: 'birthDate', width: 20 },
    { header: 'Fecha de registro', key: 'registeredAt', width: 20 },
    { header: 'Último acceso', key: 'lastLoginAt', width: 20 },
    { header: 'Metas', key: 'goalsCount', width: 10 },
    { header: 'Metas cumplidas', key: 'completedGoalsCount', width: 16 },
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

    workbook.creator = 'Metas';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Personas', {
      views: [{ state: 'frozen', ySplit: 1 }], // encabezado siempre visible
    });

    sheet.columns = ExcelExportService.COLUMNS;

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F5C4D' }, // verde profundo de la marca
    };
    header.alignment = { vertical: 'middle', horizontal: 'left' };
    header.height = 24;
    header.commit();

    let rowCount = 0;

    for await (const batch of this.customers.streamAll(500)) {
      for (const customer of batch) {
        const row = sheet.addRow({
          fullName: ExcelExportService.sanitize(customer.fullName),
          email: ExcelExportService.sanitize(customer.email),
          country: customer.countryCode ?? '—',
          phone: ExcelExportService.sanitize(customer.phone),
          birthDate: customer.birthDate,
          registeredAt: ExcelExportService.formatDate(customer.registeredAt),
          lastLoginAt: customer.lastLoginAt
            ? ExcelExportService.formatDate(customer.lastLoginAt)
            : '—',
          goalsCount: customer.goalsCount,
          completedGoalsCount: customer.completedGoalsCount,
          status: customer.status === 'ACTIVE' ? 'Activa' : customer.status,
        });

        // commit() libera la fila de memoria: es lo que hace que el uso de RAM
        // no crezca con el tamaño del archivo.
        row.commit();
        rowCount++;
      }
    }

    const totalRow = sheet.addRow({ fullName: `TOTAL — ${rowCount} persona(s) registrada(s)` });
    totalRow.font = { bold: true };
    totalRow.commit();

    sheet.commit();
    await workbook.commit();

    this.logger.log(`Exportación completada: ${rowCount} personas`);
  }

  /** Nombre de archivo con fecha: metas-personas-2026-11-17.xlsx */
  static fileName(): string {
    return `metas-personas-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
