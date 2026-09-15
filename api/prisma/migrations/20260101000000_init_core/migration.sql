-- =============================================================================
-- AM Cuenta · Migración 001 — Núcleo del dominio
-- =============================================================================
-- Principios aplicados:
--   · El dinero SIEMPRE se guarda en centavos (BIGINT). Nunca FLOAT ni REAL:
--     0.1 + 0.2 != 0.3 en punto flotante, y eso en una app financiera es
--     inaceptable.
--   · created_at / updated_at los gestiona un trigger, no la aplicación: si
--     alguien escribe por psql, la auditoría sigue siendo real.
--   · Bloqueo optimista (columna `version`) en `balances` para que dos
--     administradores editando a la vez no se pisen en silencio.
--   · Borrado en cascada desde `users` para cumplir el derecho al olvido que
--     exige Google Play.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- email case-insensitive

-- -----------------------------------------------------------------------------
-- Utilidades compartidas
-- -----------------------------------------------------------------------------

-- Normaliza un nombre: sin tildes, sin mayúsculas, espacios colapsados.
-- IMMUTABLE de verdad (translate no depende de diccionarios como unaccent),
-- por eso se puede usar en una columna generada y en un índice.
CREATE OR REPLACE FUNCTION normalize_name(input TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $fn$
  SELECT translate(
    lower(btrim(regexp_replace(coalesce(input, ''), '\s+', ' ', 'g'))),
    'áéíóúüñàèìòùâêîôûÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛ',
    'aeiouunaeiouaeiouAEIOUUNAEIOUAEIOU'
  );
$fn$;

-- Trigger genérico de updated_at. Una sola función para todas las tablas (DRY).
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- users — credenciales y estado de la cuenta
-- -----------------------------------------------------------------------------
CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

CREATE TABLE users (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  CITEXT      NOT NULL,
  password_hash          TEXT        NOT NULL,
  status                 user_status NOT NULL DEFAULT 'ACTIVE',
  email_verified_at      TIMESTAMPTZ,

  -- Defensa contra fuerza bruta a nivel de dato, no solo de middleware:
  -- aunque el atacante rote IPs, la cuenta se bloquea igual.
  failed_login_attempts  SMALLINT    NOT NULL DEFAULT 0,
  locked_until           TIMESTAMPTZ,
  last_login_at          TIMESTAMPTZ,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ,

  CONSTRAINT users_email_format_chk
    CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  CONSTRAINT users_failed_attempts_chk
    CHECK (failed_login_attempts >= 0)
);

-- Índice único parcial: un email puede reutilizarse si la cuenta anterior fue
-- borrada (derecho al olvido), pero nunca hay dos cuentas vivas iguales.
CREATE UNIQUE INDEX users_email_active_uidx
  ON users (email)
  WHERE deleted_at IS NULL;

CREATE INDEX users_status_idx ON users (status) WHERE deleted_at IS NULL;

CREATE TRIGGER users_touch_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- -----------------------------------------------------------------------------
-- profiles — datos personales, 1:1 con users
-- -----------------------------------------------------------------------------
CREATE TABLE profiles (
  user_id             UUID        PRIMARY KEY
                                  REFERENCES users(id) ON DELETE CASCADE,
  full_name           TEXT        NOT NULL,

  -- Columna generada: imposible que se desincronice de full_name.
  normalized_name     TEXT        GENERATED ALWAYS AS (normalize_name(full_name)) STORED,

  birth_date          DATE        NOT NULL,
  phone_country_code  TEXT        NOT NULL DEFAULT '+1',
  phone_number        TEXT        NOT NULL,

  -- Identificador visible al cliente. Formato AMC-XXXXXXXX: deliberadamente
  -- NO parece número de tarjeta, para no disparar requisitos PCI-DSS en Google Play.
  account_number      TEXT        NOT NULL UNIQUE,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT profiles_full_name_chk
    CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
  CONSTRAINT profiles_phone_chk
    CHECK (phone_number ~ '^[0-9]{7,15}$'),
  CONSTRAINT profiles_account_number_chk
    CHECK (account_number ~ '^AMC-[0-9]{8}$'),
  -- La BD es la última línea de defensa: el dominio también valida esto.
  CONSTRAINT profiles_birth_date_chk
    CHECK (birth_date > DATE '1900-01-01' AND birth_date <= CURRENT_DATE)
);

CREATE INDEX profiles_normalized_name_idx ON profiles (normalized_name);
CREATE INDEX profiles_created_at_idx      ON profiles (created_at DESC);
CREATE INDEX profiles_account_number_idx  ON profiles (account_number text_pattern_ops);

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- -----------------------------------------------------------------------------
-- balances — EL valor que el administrador edita y el cliente ve
-- -----------------------------------------------------------------------------
CREATE TABLE balances (
  user_id       UUID        PRIMARY KEY
                            REFERENCES users(id) ON DELETE CASCADE,

  -- Centavos. 9.223.372.036.854.775.807 centavos es margen de sobra,
  -- y con CHECK impedimos negativos por decisión de producto.
  amount_cents  BIGINT      NOT NULL DEFAULT 0,
  currency      CHAR(3)     NOT NULL DEFAULT 'USD',

  -- Bloqueo optimista. El UPDATE del admin lleva WHERE version = $n;
  -- si otro admin ya guardó, afecta 0 filas y devolvemos 409 Conflict.
  version       INTEGER     NOT NULL DEFAULT 0,

  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID,

  CONSTRAINT balances_amount_chk   CHECK (amount_cents >= 0),
  CONSTRAINT balances_currency_chk CHECK (currency ~ '^[A-Z]{3}$')
);

-- -----------------------------------------------------------------------------
-- admin_users — operadores del panel. Tabla separada de `users` a propósito:
-- un cliente jamás debe poder escalar a admin cambiando una columna.
-- -----------------------------------------------------------------------------
CREATE TYPE admin_role AS ENUM ('SUPER_ADMIN', 'OPERATOR', 'VIEWER');

CREATE TABLE admin_users (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 CITEXT      NOT NULL UNIQUE,
  password_hash         TEXT        NOT NULL,
  full_name             TEXT        NOT NULL,
  role                  admin_role  NOT NULL DEFAULT 'OPERATOR',
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,

  failed_login_attempts SMALLINT    NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT admin_users_email_format_chk
    CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

CREATE INDEX admin_users_active_idx ON admin_users (is_active) WHERE is_active;

CREATE TRIGGER admin_users_touch_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- FK de balances.updated_by → admin_users, declarada aquí porque admin_users
-- se crea después.
ALTER TABLE balances
  ADD CONSTRAINT balances_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- refresh_tokens — sesiones de larga duración, revocables una a una
-- -----------------------------------------------------------------------------
CREATE TYPE principal_type AS ENUM ('CUSTOMER', 'ADMIN');

CREATE TABLE refresh_tokens (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id   UUID           NOT NULL,
  principal_kind principal_type NOT NULL,

  -- Nunca el token en claro: solo SHA-256. Si se filtra la BD, los tokens
  -- robados no sirven.
  token_hash     TEXT           NOT NULL UNIQUE,

  -- Detección de reuso: si llega un token ya rotado, se revoca toda la familia.
  family_id      UUID           NOT NULL,
  replaced_by    UUID           REFERENCES refresh_tokens(id) ON DELETE SET NULL,

  user_agent     TEXT,
  ip_address     INET,

  expires_at     TIMESTAMPTZ    NOT NULL,
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_principal_idx ON refresh_tokens (principal_id, principal_kind);
CREATE INDEX refresh_tokens_family_idx    ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_expiry_idx    ON refresh_tokens (expires_at) WHERE revoked_at IS NULL;
