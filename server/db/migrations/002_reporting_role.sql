-- Read-only login for BI / analytics, limited to one tenant by row-level security.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ezy_reporting') THEN
    CREATE ROLE ezy_reporting NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO ezy_reporting;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ezy_reporting;
REVOKE SELECT ON accounts, auth_sessions, auth_challenges FROM ezy_reporting;
GRANT SELECT (tenant_id, code, role, login_id, employee_code, status, doc, updated_at) ON accounts TO ezy_reporting;
