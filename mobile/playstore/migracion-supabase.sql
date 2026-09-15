-- =====================================================================
-- MIGRACIÓN PARA AM CUENTA — Para subir a Google Play
-- =====================================================================
--
-- Cambios incluidos:
-- 1. Cambia el formato del "credit_number" para que NO parezca tarjeta de
--    crédito (Google podría confundirlo y pedir cumplimiento PCI-DSS).
--    Antes:  "0684 2376 8809 8814" (16 dígitos = formato Visa/MC)
--    Ahora:  "AMC-12345678" (formato genérico de identificador interno)
--
-- 2. Agrega función `delete_user_account()` que permite a un usuario
--    eliminar su propia cuenta. ESTO ES OBLIGATORIO para Google Play
--    desde 2024 — apps con login deben permitir eliminación de cuenta.
--
-- =====================================================================
-- INSTRUCCIONES:
--   1. Entra a Supabase → tu proyecto → SQL Editor → New query
--   2. Copia y pega TODO este archivo
--   3. Click en RUN
--   4. Verifica que dice "Success. No rows returned."
-- =====================================================================


-- ---------------------------------------------------------------------
-- Cambio 1: Nuevo formato de credit_number (no parece tarjeta de crédito)
-- ---------------------------------------------------------------------

create or replace function public.generate_credit_number()
returns text
language plpgsql
as $$
declare
  random_num int;
begin
  -- Genera un número aleatorio de 8 dígitos prefijado con "AMC-"
  -- Ejemplo: AMC-12345678
  random_num := floor(random() * 100000000)::int;
  return 'AMC-' || lpad(random_num::text, 8, '0');
end;
$$;

-- Actualizar los credit_number existentes (los que aún parecen tarjeta)
-- Solo actualiza los que tienen el formato viejo (con espacios)
update public.profiles
set credit_number = public.generate_credit_number()
where credit_number ~ '^[0-9]{4} [0-9]{4} [0-9]{4} [0-9]{4}$';


-- ---------------------------------------------------------------------
-- Cambio 2: Función para eliminar cuenta del propio usuario
-- ---------------------------------------------------------------------

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  -- Obtener el ID del usuario autenticado
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'No hay usuario autenticado';
  end if;

  -- Borrar el usuario de auth.users
  -- Esto cascade-elimina automáticamente el perfil en public.profiles
  -- gracias al "on delete cascade" definido en la tabla
  delete from auth.users where id = current_user_id;
end;
$$;

-- Permitir que cualquier usuario autenticado pueda llamar esta función
grant execute on function public.delete_user_account() to authenticated;


-- ---------------------------------------------------------------------
-- Verificación: contar usuarios actuales (debe imprimir un número)
-- ---------------------------------------------------------------------
-- select count(*) as total_usuarios from public.profiles;
