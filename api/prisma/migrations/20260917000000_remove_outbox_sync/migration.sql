-- -----------------------------------------------------------------------------
-- Quita la sincronización con Google Sheets y el patrón outbox que la servía.
-- -----------------------------------------------------------------------------
-- El cliente decidió no usar Google Sheets (nunca llegó a configurarse:
-- GOOGLE_SHEETS_ENABLED se quedó en `false`) y en su lugar quedó
-- `registration_ledger` (ver migración 20260916000000) como el registro
-- permanente de quién se ha registrado — descargable desde el panel en
-- cualquier momento, sin depender de un servicio externo.
--
-- El patrón outbox (`outbox_events` + `claim_outbox_events` +
-- `release_stale_outbox_events`) solo existía para alimentar ese envío a
-- Sheets; sin un consumidor, no tiene ninguna otra razón para seguir aquí.
DROP FUNCTION IF EXISTS claim_outbox_events(TEXT, INT);
DROP FUNCTION IF EXISTS release_stale_outbox_events(INTERVAL);
DROP TABLE IF EXISTS outbox_events;
DROP TYPE IF EXISTS outbox_status;
