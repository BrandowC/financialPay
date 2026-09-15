'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from './api-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Se crea dentro de useState (no como constante del módulo) para que cada
  // sesión de navegador tenga su propio cliente y el caché de un usuario no se
  // filtre a otro en un entorno con SSR compartido.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: (failureCount, error) => {
              // Los errores 4xx son del cliente: reintentar no los arregla
              // (un 403 seguirá siendo 403). Solo vale la pena reintentar
              // fallos de red o 5xx transitorios, y solo dos veces.
              if (error instanceof ApiError && error.status < 500 && error.status !== 0) {
                return false;
              }
              return failureCount < 2;
            },
          },
          mutations: {
            retry: false, // una mutación NUNCA se reintenta sola: podría duplicar una escritura.
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
