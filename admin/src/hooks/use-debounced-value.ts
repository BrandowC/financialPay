import { useEffect, useState } from 'react';

/**
 * Sin esto, cada tecla en el buscador dispararía una petición HTTP: escribir
 * "María" serían 5 peticiones, 4 de ellas descartadas antes de llegar. Con 2.000
 * usuarios/día y varios administradores buscando a la vez, eso es carga
 * innecesaria sobre la API y sobre Postgres para nada.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
