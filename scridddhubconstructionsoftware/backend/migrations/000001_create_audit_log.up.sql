CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    row_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
    actor TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_table_row ON audit_log (table_name, row_id);

-- ADR-0002: "cannot be disabled" must hold at the infrastructure level, not just in application
-- code. The app connects as scridddhub_app, which gets INSERT only — no UPDATE/DELETE grant ever.
CREATE ROLE scridddhub_app LOGIN PASSWORD 'scridddhub_app_dev';
GRANT CONNECT ON DATABASE scridddhub TO scridddhub_app;
GRANT USAGE ON SCHEMA public TO scridddhub_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO scridddhub_app;
REVOKE UPDATE, DELETE ON audit_log FROM scridddhub_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scridddhub_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO scridddhub_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO scridddhub_app;
