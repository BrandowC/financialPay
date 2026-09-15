-- =============================================================================
-- AM Cuenta · Migración 002 — Auditoría, Outbox y generación de cuentas
-- =============================================================================
-- Aquí vive la parte que hace el sistema confiable de verdad:
--
--   1. AUDITORÍA POR TRIGGER. El historial de cambios de saldo NO lo escribe la
--      aplicación, lo escribe la base de datos. Un desarrollador no puede
--      "olvidarse" de auditar, y un UPDATE manual por psql también queda
--      registrado. El contexto (quién, desde qué IP, por qué) viaja por
--      variables de sesión que la app fija dentro de la misma transacción.
--
--   2. PATRÓN OUTBOX. El sync a Google Sheets NO se hace dentro del request del
--      usuario. Se inserta un evento en `outbox_events` en la MISMA transacción
--      que el registro; si Google está caído, el registro del usuario igual se
--      guardó, y un worker reintenta con backoff exponencial. Esto es lo que
--      evita el clásico "se registró pero no salió en el Excel".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Generación de número de cuenta con reintento ante colisión
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $fn$
DECLARE
  candidate TEXT;
  tries     INT := 0;
BEGIN
  LOOP
    -- 8 dígitos = 100 millones de combinaciones. Con 2.000 registros/día la
    -- probabilidad de colisión es despreciable, pero igual la manejamos.
    candidate := 'AMC-' || lpad(floor(random() * 100000000)::BIGINT::TEXT, 8, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM profiles WHERE account_number = candidate
    );

    tries := tries + 1;
    IF tries >= 10 THEN
      RAISE EXCEPTION 'No se pudo generar un número de cuenta único tras % intentos', tries
        USING ERRCODE = 'unique_violation';
    END IF;
  END LOOP;

  RETURN candidate;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- balance_audit — historial inmutable de cambios de saldo
-- -----------------------------------------------------------------------------
CREATE TABLE balance_audit (
  id              BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  previous_cents  BIGINT      NOT NULL,
  new_cents       BIGINT      NOT NULL,
  -- Generada: nadie puede escribir un delta que no cuadre con los extremos.
  delta_cents     BIGINT      GENERATED ALWAYS AS (new_cents - previous_cents) STORED,
  currency        CHAR(3)     NOT NULL,

  -- Quién lo cambió. Guardamos también el email como snapshot: si el admin se
  -- borra en el futuro, el historial sigue diciendo quién fue.
  changed_by      UUID        REFERENCES admin_users(id) ON DELETE SET NULL,
  changed_by_email TEXT,

  reason          TEXT,
  ip_address      INET,
  user_agent      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX balance_audit_user_idx    ON balance_audit (user_id, created_at DESC);
CREATE INDEX balance_audit_admin_idx   ON balance_audit (changed_by, created_at DESC);
CREATE INDEX balance_audit_created_idx ON balance_audit (created_at DESC);

-- La auditoría es de solo-inserción. Ni la app ni un admin pueden reescribir
-- la historia: cualquier UPDATE o DELETE aborta.
CREATE OR REPLACE FUNCTION forbid_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  RAISE EXCEPTION 'La tabla % es inmutable (solo INSERT permitido)', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$fn$;

CREATE TRIGGER balance_audit_immutable
  BEFORE UPDATE OR DELETE ON balance_audit
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- -----------------------------------------------------------------------------
-- Trigger de auditoría automática sobre balances
-- -----------------------------------------------------------------------------
-- La app hace, dentro de su transacción:
--   SET LOCAL app.actor_id    = '<uuid del admin>';
--   SET LOCAL app.actor_email = 'admin@...';
--   SET LOCAL app.reason      = 'Ajuste mensual';
--   SET LOCAL app.ip          = '190.x.x.x';
-- current_setting(..., true) devuelve NULL si no está fijada, así que un
-- cambio sin contexto se registra igual (como anónimo) en vez de romper.
CREATE OR REPLACE FUNCTION audit_balance_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_actor_id    UUID;
  v_actor_email TEXT;
  v_ip          INET;
BEGIN
  -- Sin cambio real de monto no hay nada que auditar (evita ruido cuando solo
  -- se toca updated_at).
  IF NEW.amount_cents IS NOT DISTINCT FROM OLD.amount_cents THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_actor_id := nullif(current_setting('app.actor_id', true), '')::UUID;
  EXCEPTION WHEN others THEN
    v_actor_id := NULL;
  END;

  BEGIN
    v_ip := nullif(current_setting('app.ip', true), '')::INET;
  EXCEPTION WHEN others THEN
    v_ip := NULL;
  END;

  v_actor_email := nullif(current_setting('app.actor_email', true), '');

  INSERT INTO balance_audit (
    user_id, previous_cents, new_cents, currency,
    changed_by, changed_by_email, reason, ip_address, user_agent
  ) VALUES (
    NEW.user_id,
    OLD.amount_cents,
    NEW.amount_cents,
    NEW.currency,
    v_actor_id,
    v_actor_email,
    nullif(current_setting('app.reason', true), ''),
    v_ip,
    nullif(current_setting('app.user_agent', true), '')
  );

  RETURN NEW;
END;
$fn$;

CREATE TRIGGER balances_audit_trigger
  AFTER UPDATE ON balances
  FOR EACH ROW EXECUTE FUNCTION audit_balance_change();

-- -----------------------------------------------------------------------------
-- outbox_events — cola transaccional para el sync a Google Sheets
-- -----------------------------------------------------------------------------
CREATE TYPE outbox_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD');

CREATE TABLE outbox_events (
  id              BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  aggregate_type  TEXT          NOT NULL,   -- 'customer' | 'balance'
  aggregate_id    UUID          NOT NULL,
  event_type      TEXT          NOT NULL,   -- 'customer.registered' | 'balance.updated'
  payload         JSONB         NOT NULL,

  status          outbox_status NOT NULL DEFAULT 'PENDING',
  attempts        SMALLINT      NOT NULL DEFAULT 0,
  max_attempts    SMALLINT      NOT NULL DEFAULT 12,
  last_error      TEXT,

  -- Backoff exponencial: el worker no reintenta antes de esta hora.
  next_attempt_at TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Para diagnosticar workers colgados (locked_at viejo = worker muerto).
  locked_by       TEXT,
  locked_at       TIMESTAMPTZ,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ,

  CONSTRAINT outbox_attempts_chk CHECK (attempts >= 0 AND attempts <= max_attempts + 1)
);

-- Índice parcial: el worker solo mira lo pendiente. Con millones de eventos
-- completados este índice sigue siendo diminuto.
CREATE INDEX outbox_dispatch_idx
  ON outbox_events (next_attempt_at, id)
  WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX outbox_stuck_idx
  ON outbox_events (locked_at)
  WHERE status = 'PROCESSING';

CREATE INDEX outbox_aggregate_idx ON outbox_events (aggregate_type, aggregate_id);

-- -----------------------------------------------------------------------------
-- Reclamo de trabajo concurrente (FOR UPDATE SKIP LOCKED)
-- -----------------------------------------------------------------------------
-- Permite correr N workers en paralelo sin que dos tomen el mismo evento y sin
-- que se bloqueen entre sí. Es el patrón estándar de colas sobre Postgres.
CREATE OR REPLACE FUNCTION claim_outbox_events(
  p_worker_id TEXT,
  p_limit     INT DEFAULT 50
)
RETURNS SETOF outbox_events
LANGUAGE plpgsql
AS $fn$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM outbox_events
    WHERE status IN ('PENDING', 'FAILED')
      AND next_attempt_at <= now()
    ORDER BY next_attempt_at, id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE outbox_events o
  SET status    = 'PROCESSING',
      locked_by = p_worker_id,
      locked_at = now(),
      attempts  = o.attempts + 1
  FROM claimed c
  WHERE o.id = c.id
  RETURNING o.*;
END;
$fn$;

-- Rescata eventos de workers que murieron a mitad del procesamiento.
CREATE OR REPLACE FUNCTION release_stale_outbox_events(p_stale_after INTERVAL DEFAULT '5 minutes')
RETURNS INT
LANGUAGE plpgsql
AS $fn$
DECLARE
  released INT;
BEGIN
  UPDATE outbox_events
  SET status     = 'FAILED',
      locked_by  = NULL,
      locked_at  = NULL,
      last_error = 'Worker sin respuesta; evento liberado automáticamente'
  WHERE status = 'PROCESSING'
    AND locked_at < now() - p_stale_after;

  GET DIAGNOSTICS released = ROW_COUNT;
  RETURN released;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- security_events — rastro forense de autenticación y acciones sensibles
-- -----------------------------------------------------------------------------
CREATE TABLE security_events (
  id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type   TEXT        NOT NULL,  -- login.success, login.failed, account.locked...
  principal_id UUID,
  email        CITEXT,
  ip_address   INET,
  user_agent   TEXT,
  metadata     JSONB       NOT NULL DEFAULT '{}'::JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX security_events_type_idx  ON security_events (event_type, created_at DESC);
CREATE INDEX security_events_ip_idx    ON security_events (ip_address, created_at DESC);
CREATE INDEX security_events_email_idx ON security_events (email, created_at DESC);

CREATE TRIGGER security_events_immutable
  BEFORE UPDATE OR DELETE ON security_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- -----------------------------------------------------------------------------
-- Vista de lectura para el panel administrativo
-- -----------------------------------------------------------------------------
-- Encapsula el JOIN en un solo lugar: si mañana cambia el modelo, el panel no
-- se entera. También evita exponer password_hash por descuido.
CREATE OR REPLACE VIEW customer_overview AS
SELECT
  u.id                AS user_id,
  u.email,
  u.status,
  u.created_at        AS registered_at,
  u.last_login_at,
  p.full_name,
  p.account_number,
  p.birth_date,
  p.phone_country_code,
  p.phone_number,
  COALESCE(b.amount_cents, 0) AS amount_cents,
  COALESCE(b.currency, 'USD') AS currency,
  COALESCE(b.version, 0)      AS balance_version,
  b.updated_at        AS balance_updated_at
FROM users u
JOIN profiles p ON p.user_id = u.id
LEFT JOIN balances b ON b.user_id = u.id
WHERE u.deleted_at IS NULL;
