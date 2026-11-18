-- -----------------------------------------------------------------------------
-- Metas — ahorro por metas
-- -----------------------------------------------------------------------------
-- La app deja de mostrar un "saldo administrativo" y pasa a ser un registro
-- personal de ahorros: cada persona crea metas ("Viaje", "Moto"), anota cuánto
-- quiere juntar y va registrando aportes. Todo lo escribe la propia persona.
--
-- Las tablas anteriores (balances, balance_audit, registration_ledger) NO se
-- tocan aquí a propósito: la app nueva simplemente ya no las usa. Se limpian
-- por separado y a mano (ver scripts/purge-legacy.ts), una vez verificada la
-- copia de seguridad.

-- País de residencia (ISO 3166-1 alfa-2): permite registrarse desde cualquier
-- país en vez de solo Estados Unidos. Nullable: las cuentas viejas no lo tienen.
ALTER TABLE profiles ADD COLUMN country_code CHAR(2);
ALTER TABLE profiles
  ADD CONSTRAINT profiles_country_code_chk CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

-- -----------------------------------------------------------------------------
-- goals — una meta de ahorro
-- -----------------------------------------------------------------------------
CREATE TABLE goals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name         TEXT        NOT NULL,
  emoji        TEXT,

  -- Centavos, como todo el dinero de este sistema: nunca decimales.
  target_cents BIGINT      NOT NULL,
  currency     CHAR(3)     NOT NULL DEFAULT 'USD',

  deadline     DATE,
  archived_at  TIMESTAMPTZ,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT goals_name_chk     CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT goals_target_chk   CHECK (target_cents > 0 AND target_cents <= 100000000000000),
  CONSTRAINT goals_currency_chk CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX goals_user_idx ON goals (user_id, created_at DESC);

CREATE TRIGGER goals_touch_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- -----------------------------------------------------------------------------
-- contributions — cada aporte (o retiro) de una meta
-- -----------------------------------------------------------------------------
-- `amount_cents` positivo = aporte, negativo = retiro. Un solo campo con signo
-- hace que el total ahorrado sea simplemente SUM(amount_cents) y evita tener
-- dos columnas que puedan contradecirse.
CREATE TABLE contributions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      UUID        NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  -- Se repite el dueño para poder filtrar por usuario sin un JOIN y para que
  -- el borrado en cascada de la cuenta no dependa de pasar por `goals`.
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  amount_cents BIGINT      NOT NULL,
  note         TEXT,
  made_on      DATE        NOT NULL DEFAULT CURRENT_DATE,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT contributions_amount_chk CHECK (amount_cents <> 0 AND abs(amount_cents) <= 100000000000000),
  CONSTRAINT contributions_note_chk   CHECK (note IS NULL OR char_length(note) <= 200)
);

CREATE INDEX contributions_goal_idx ON contributions (goal_id, made_on DESC, created_at DESC);
CREATE INDEX contributions_user_idx ON contributions (user_id);

-- -----------------------------------------------------------------------------
-- Vista de lectura para el panel administrativo
-- -----------------------------------------------------------------------------
-- Reemplaza la anterior, que dependía de `balances`. Se hace DROP + CREATE (y
-- no CREATE OR REPLACE) porque Postgres no deja quitar columnas de una vista.
-- Sin saldo: el panel muestra cuántas metas tiene cada persona, no sus montos
-- individuales.
DROP VIEW IF EXISTS customer_overview;

CREATE VIEW customer_overview AS
SELECT
  u.id                AS user_id,
  u.email,
  u.status,
  u.created_at        AS registered_at,
  u.last_login_at,
  p.full_name,
  p.birth_date,
  p.country_code,
  p.phone_country_code,
  p.phone_number,
  COALESCE(g.goals_count, 0)      AS goals_count,
  COALESCE(g.completed_count, 0)  AS completed_goals_count
FROM users u
JOIN profiles p ON p.user_id = u.id
LEFT JOIN (
  SELECT
    gl.user_id,
    COUNT(*) AS goals_count,
    COUNT(*) FILTER (WHERE COALESCE(s.saved, 0) >= gl.target_cents) AS completed_count
  FROM goals gl
  LEFT JOIN (
    SELECT goal_id, SUM(amount_cents) AS saved FROM contributions GROUP BY goal_id
  ) s ON s.goal_id = gl.id
  GROUP BY gl.user_id
) g ON g.user_id = u.id
WHERE u.deleted_at IS NULL;
