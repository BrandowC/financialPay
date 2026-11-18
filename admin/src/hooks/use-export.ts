import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

/**
 * Descarga del Excel con todas las personas registradas.
 *
 * El archivo llega como stream desde el servidor (ver ExcelExportService, que
 * escribe con WorkbookWriter para no cargarlo entero en memoria). Aquí, del
 * lado del navegador, sí se junta en un Blob: un archivo de unos pocos MB no
 * es problema para el navegador.
 */
export function useExportExcel() {
  return useMutation({
    mutationFn: async () => {
      const blob = await api.rawBlob('/admin/export/customers.xlsx');

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `metas-personas-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  });
}
