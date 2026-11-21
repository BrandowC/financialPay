import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

/**
 * Descarga del Excel de clientes registrados en los últimos 8 días (el
 * filtro lo aplica el servidor, ver ExcelExportService.EXPORT_WINDOW_DAYS —
 * a propósito no trae el histórico completo cada vez que se descarga).
 *
 * El archivo llega como stream desde el servidor (ver ExcelExportService, que
 * escribe con WorkbookWriter para no cargarlo entero en memoria). Aquí del
 * lado del navegador sí se junta en un Blob — un archivo de unos pocos MB no
 * es problema para el navegador, la parte cara era el servidor generándolo
 * para miles de clientes a la vez.
 */
export function useExportExcel() {
  return useMutation({
    mutationFn: async () => {
      const blob = await api.rawBlob('/admin/export/customers.xlsx');

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `am-cuenta-clientes-ultimos-8-dias-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  });
}

/**
 * Descarga del historial COMPLETO de registros — incluye cuentas ya
 * eliminadas (ver RegistrationLedger, es un registro permanente que no se
 * borra ni actualiza jamás). Sin filtro de fecha a propósito: es justo lo
 * contrario del export de arriba.
 */
export function useExportRegistrationLedger() {
  return useMutation({
    mutationFn: async () => {
      const blob = await api.rawBlob('/admin/export/registrations.xlsx');

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `am-cuenta-historial-registros-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  });
}
