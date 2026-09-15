-- -----------------------------------------------------------------------------
-- Permite que el borrado de cuenta (obligatorio para Google Play) arrastre el
-- historial de saldo, sin dejar de bloquear cualquier otro intento de tocarlo.
-- -----------------------------------------------------------------------------
-- `balance_audit` es inmutable a propósito (trigger `balance_audit_immutable`,
-- ver migración 20260102000000): ni la app ni un administrador pueden
-- reescribir la historia de un cliente que sigue existiendo. Pero
-- `PrismaCustomerRepository.hardDelete()` borra al cliente con
-- `ON DELETE CASCADE`, y ese CASCADE intenta borrar también sus filas de
-- `balance_audit` — el mismo trigger que protege la inmutabilidad bloqueaba
-- ESE borrado también, así que "Eliminar mi cuenta" fallaba con un 500 en
-- cuanto el cliente tenía algún cambio de saldo en su historial.
--
-- La solución no es quitar la protección: es dejar UNA sola puerta explícita
-- para el caso legítimo (borrado total de una cuenta que deja de existir),
-- controlada por el propio código de la aplicación con `SET LOCAL` — el mismo
-- mecanismo que ya usa `audit_balance_change()` para saber quién hizo un
-- cambio. Sin esa variable de sesión puesta, la tabla sigue tan inmutable
-- como antes: ni UPDATE ni DELETE pasan.
CREATE OR REPLACE FUNCTION forbid_balance_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.allow_account_erasure', true) = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'La tabla % es inmutable (solo INSERT permitido)', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$fn$;

DROP TRIGGER IF EXISTS balance_audit_immutable ON balance_audit;
CREATE TRIGGER balance_audit_immutable
  BEFORE UPDATE OR DELETE ON balance_audit
  FOR EACH ROW EXECUTE FUNCTION forbid_balance_audit_mutation();

-- `security_events` NO se toca: sigue usando `forbid_mutation()` sin
-- excepciones. Es forense y no tiene FK hacia `users` (a propósito, ver
-- migración 20260102000000), así que el borrado de una cuenta nunca lo
-- alcanza — y aunque lo alcanzara, el rastro de seguridad debe sobrevivir a
-- la cuenta que lo generó.
