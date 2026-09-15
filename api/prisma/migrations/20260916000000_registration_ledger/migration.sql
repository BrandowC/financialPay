-- -----------------------------------------------------------------------------
-- registration_ledger — quién se registró alguna vez, para siempre
-- -----------------------------------------------------------------------------
-- El cliente pidió un registro permanente de cada persona que se registra,
-- que sobreviva aunque esa persona luego elimine su cuenta (que borra al
-- usuario de verdad, en cascada — ver migración 20260915000000). La única
-- forma de que algo sobreviva a ese borrado es que NO cuelgue de `users` con
-- una relación: por eso `user_id` aquí es un UUID suelto, sin
-- `REFERENCES users(id)`, igual que `principal_id` en `security_events`.
--
-- Se llena una sola vez, en el mismo INSERT transaccional del registro (ver
-- PrismaCustomerRepository.create()), y de ahí en más nadie la toca: misma
-- protección de solo-inserción que ya tienen `balance_audit` y
-- `security_events`, reutilizando la función `forbid_mutation()` de la
-- migración 20260102000000.
CREATE TABLE registration_ledger (
  id             BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        UUID        NOT NULL,
  account_number TEXT        NOT NULL,
  full_name      TEXT        NOT NULL,
  email          CITEXT      NOT NULL,
  phone          TEXT        NOT NULL,
  birth_date     DATE        NOT NULL,
  registered_at  TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX registration_ledger_registered_idx ON registration_ledger (registered_at DESC);

-- Un cliente se registra una sola vez: si algún día se reintenta el INSERT
-- (reintento de red, por ejemplo) esto lo rechaza en vez de duplicar la fila.
CREATE UNIQUE INDEX registration_ledger_user_idx ON registration_ledger (user_id);

CREATE TRIGGER registration_ledger_immutable
  BEFORE UPDATE OR DELETE ON registration_ledger
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
