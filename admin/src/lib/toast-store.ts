import { create } from 'zustand';

export interface Toast {
  id: string;
  variant: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

/**
 * Notificaciones globales.
 *
 * Es un store aparte del de autenticación a propósito: mezclar "estado de
 * sesión" con "mensajes efímeros de UI" en el mismo objeto obligaría a
 * persistir o a limpiar cosas que no tienen nada que ver entre sí.
 */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));

    // Se autodestruye: nadie tiene que acordarse de cerrar una notificación.
    setTimeout(() => get().dismiss(id), toast.variant === 'error' ? 6000 : 3500);
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function toast(input: Omit<Toast, 'id'>): void {
  useToastStore.getState().push(input);
}
