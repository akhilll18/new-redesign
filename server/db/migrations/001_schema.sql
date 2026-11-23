-- EZY HR · PostgreSQL schema (v10.8) — sized for 10,000 to 10,00,000+ employees per tenant.
--
-- Design rules
--  • Multi-tenant: every row carries tenant_id; every primary key starts with tenant_id.
--  • Hot, high-volume data (employees, punches, daily attendance, requests, payslips, notifications, audit)
--    lives in typed tables with the indexes the screens need. The full app record is kept in `doc jsonb`, so the
--    web app gets back exactly what it saved.
--  • Time-series tables are RANGE-partitioned by month: inserts stay fast, old months can be detached / archived,
--    and queries for "this month" only touch one partition.
--  • Everything else (≈80 smaller modules) goes into entity_records (one row per record, HASH-partitioned) or
--    tenant_docs (one JSON document per settings-style object).

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ── Tenants & organisation ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id     text PRIMARY KEY,
  name          text NOT NULL,
  plan          text NOT NULL DEFAULT 'growth',
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  tenant_id   text NOT NULL REFERENCES tenants ON DELETE CASCADE,
  company_id  text NOT NULL,
  name        text NOT NULL,
  country     text,
  currency    text,
  status      text NOT NULL DEFAULT 'active',
  doc         jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, company_id)
);

CREATE TABLE IF NOT EXISTS locations (
  tenant_id    text NOT NULL REFERENCES tenants ON DELETE CASCADE,
  location_id  text NOT NULL,
  company_id   text,
  name         text,
  doc          jsonb NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, location_id)
);

CREATE TABLE IF NOT EXISTS org_units (
  tenant_id    text NOT NULL REFERENCES tenants ON DELETE CASCADE,
  org_unit_id  text NOT NULL,
  name         text,
  parent_unit  text,
  doc          jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (tenant_id, org_unit_id)
);

-- ── Employees (the 10-lakh table) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  tenant_id          text NOT NULL REFERENCES tenants ON DELETE CASCADE,
  employee_code      text NOT NULL,
  full_name          text NOT NULL,
  email              text,
  login_id           text,
  designation        text,
  department         text,
  reporting_manager  text,
  company_id         text,
  location_id        text,
  country_code       text,
  employment_type    text,
  worker_type        text,
  grade_code         text,
  status             text NOT NULL DEFAULT 'active',
  date_of_joining    date,
  date_of_birth      date,
  exit_date          date,
  monthly_gross      numeric(14,2) NOT NULL DEFAULT 0,
  -- secrets never leave the server; the app's copy of the record never carries them
  password_hash      text,
  security_pin_hash  text,
  failed_attempts    int NOT NULL DEFAULT 0,
  must_reset         boolean NOT NULL DEFAULT false,
  last_login         timestamptz,
  doc                jsonb NOT NULL DEFAULT '{}',
  search_text        text GENERATED ALWAYS AS (lower(full_name || ' ' || employee_code || ' ' || coalesce(email,'') || ' ' || coalesce(designation,''))) STORED,
  version            int NOT NULL DEFAULT 1,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, employee_code)
);
CREATE UNIQUE INDEX IF NOT EXISTS employees_login_uq      ON employees (tenant_id, lower(login_id)) WHERE login_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS employees_manager_ix           ON employees (tenant_id, reporting_manager) WHERE reporting_manager IS NOT NULL;
CREATE INDEX IF NOT EXISTS employees_list_ix              ON employees (tenant_id, status, full_name, employee_code);
CREATE INDEX IF NOT EXISTS employees_dept_ix              ON employees (tenant_id, department, status);
CREATE INDEX IF NOT EXISTS employees_company_ix           ON employees (tenant_id, company_id, location_id, status);
CREATE INDEX IF NOT EXISTS employees_search_trgm          ON employees USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS employees_birthday_ix          ON employees (tenant_id, (extract(month from date_of_birth) * 100 + extract(day from date_of_birth))) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS employees_anniv_ix             ON employees (tenant_id, (extract(month from date_of_joining) * 100 + extract(day from date_of_joining))) WHERE status = 'active';

-- Admin and Super Admin sign-ins (a few hundred rows at most)
CREATE TABLE IF NOT EXISTS accounts (
  tenant_id     text NOT NULL REFERENCES tenants ON DELETE CASCADE,
  code          text NOT NULL,              -- ADM01, SA001 …
  role          text NOT NULL CHECK (role IN ('admin','superadmin')),
  login_id      text NOT NULL,
  employee_code text,
  password_hash text,
  security_pin_hash text,
  mfa_secret    text,
  status        text NOT NULL DEFAULT 'active',
  failed_attempts int NOT NULL DEFAULT 0,
  doc           jsonb NOT NULL DEFAULT '{}',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, code)
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_login_uq ON accounts (tenant_id, role, lower(login_id));

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id   uuid PRIMARY KEY,
  tenant_id    text NOT NULL,
  role         text NOT NULL,
  code         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen    timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked      boolean NOT NULL DEFAULT false,
  ip           text,
  user_agent   text
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_ix ON auth_sessions (tenant_id, code) WHERE NOT revoked;

CREATE TABLE IF NOT EXISTS auth_challenges (
  challenge_id uuid PRIMARY KEY,
  tenant_id    text NOT NULL,
  role         text NOT NULL,
  code         text NOT NULL,
  step         text NOT NULL,            -- mfa | reset
  otp_hash     text,
  attempts     int NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL
);

-- ── Attendance ─────────────────────────────────────────────────────────
-- Raw punches: ~2 per employee per working day → ~4.4 crore rows / month at 10 lakh employees.
CREATE TABLE IF NOT EXISTS punches (
  tenant_id      text NOT NULL,
  id             text NOT NULL,
  employee_code  text NOT NULL,
  ts             timestamptz NOT NULL,
  type           text NOT NULL,           -- in | out
  source         text,
  inside         boolean,
  flag           text,
  doc            jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (tenant_id, ts, id)
) PARTITION BY RANGE (ts);
CREATE INDEX IF NOT EXISTS punches_emp_ix  ON punches (tenant_id, employee_code, ts DESC);
CREATE INDEX IF NOT EXISTS punches_ts_brin ON punches USING brin (ts) WITH (pages_per_range = 64);

-- One row per employee per day, rolled up from punches + approved leave by the worker.
CREATE TABLE IF NOT EXISTS attendance_daily (
  tenant_id      text NOT NULL,
  day            date NOT NULL,
  employee_code  text NOT NULL,
  status         text NOT NULL,           -- present | absent | half_day | leave | holiday | weekly_off
  first_in       timestamptz,
  last_out       timestamptz,
  worked_minutes int NOT NULL DEFAULT 0,
  late           boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, day, employee_code)
) PARTITION BY RANGE (day);
CREATE INDEX IF NOT EXISTS attendance_emp_ix ON attendance_daily (tenant_id, employee_code, day);

-- ── Requests & approvals (leave, expense, advance, loan, regularise, asset, …) ───────────
CREATE TABLE IF NOT EXISTS requests (
  tenant_id      text NOT NULL,
  request_id     text NOT NULL,
  created_at     timestamptz NOT NULL,
  type           text NOT NULL,
  employee_code  text NOT NULL,
  company_id     text,
  status         text NOT NULL,
  stage          text,
  pending_with   text,                    -- manager's employee code, or 'role:admin' — the approver inbox index
  amount         numeric(14,2),
  from_date      date,
  to_date        date,
  doc            jsonb NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, created_at, request_id)
) PARTITION BY RANGE (created_at);
CREATE INDEX IF NOT EXISTS requests_id_ix      ON requests (tenant_id, request_id);
CREATE INDEX IF NOT EXISTS requests_emp_ix     ON requests (tenant_id, employee_code, created_at DESC);
CREATE INDEX IF NOT EXISTS requests_inbox_ix   ON requests (tenant_id, pending_with, created_at DESC) WHERE pending_with IS NOT NULL;
CREATE INDEX IF NOT EXISTS requests_type_ix    ON requests (tenant_id, type, status, created_at DESC);

-- ── Payroll ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payslip_batches (
  tenant_id   text NOT NULL,
  batch_id    text NOT NULL,
  period      text NOT NULL,              -- YYYY-MM
  status      text NOT NULL,
  employees   int NOT NULL DEFAULT 0,
  gross_total numeric(18,2) NOT NULL DEFAULT 0,
  net_total   numeric(18,2) NOT NULL DEFAULT 0,
  doc         jsonb NOT NULL DEFAULT '{}', -- header only (components, approvals) — never the slips
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, batch_id)
);
CREATE INDEX IF NOT EXISTS payslip_batches_period_ix ON payslip_batches (tenant_id, period);

CREATE TABLE IF NOT EXISTS payslips (
  tenant_id      text NOT NULL,
  period_month   date NOT NULL,           -- first day of the pay month (partition key)
  batch_id       text NOT NULL,
  employee_code  text NOT NULL,
  slip_id        text NOT NULL,
  gross          numeric(14,2) NOT NULL DEFAULT 0,
  deductions     numeric(14,2) NOT NULL DEFAULT 0,
  net            numeric(14,2) NOT NULL DEFAULT 0,
  lop_days       numeric(5,2)  NOT NULL DEFAULT 0,
  doc            jsonb NOT NULL,          -- the app's slip: values per component, days, emp snapshot
  PRIMARY KEY (tenant_id, period_month, batch_id, employee_code)
) PARTITION BY RANGE (period_month);
CREATE INDEX IF NOT EXISTS payslips_emp_ix ON payslips (tenant_id, employee_code, period_month DESC);

-- ── Notifications & audit ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  tenant_id  text NOT NULL,
  id         text NOT NULL,
  at         timestamptz NOT NULL,
  recipient  text NOT NULL,
  read       boolean NOT NULL DEFAULT false,
  doc        jsonb NOT NULL,
  PRIMARY KEY (tenant_id, at, id)
) PARTITION BY RANGE (at);
CREATE INDEX IF NOT EXISTS notifications_to_ix ON notifications (tenant_id, recipient, at DESC);
CREATE INDEX IF NOT EXISTS notifications_id_ix ON notifications (tenant_id, id);

-- Append-only. Nothing in the API deletes from it.
CREATE TABLE IF NOT EXISTS audit_log (
  tenant_id  text NOT NULL,
  log_id     text NOT NULL,
  ts         timestamptz NOT NULL,
  user_code  text,
  role       text,
  action     text,
  ip         text,
  details    text,
  doc        jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (tenant_id, ts, log_id)
) PARTITION BY RANGE (ts);
CREATE INDEX IF NOT EXISTS audit_user_ix   ON audit_log (tenant_id, user_code, ts DESC);
CREATE INDEX IF NOT EXISTS audit_action_ix ON audit_log (tenant_id, action, ts DESC);
CREATE INDEX IF NOT EXISTS audit_ts_brin   ON audit_log USING brin (ts);

-- ── Every other module ─────────────────────────────────────────────────
-- One row per record for list-style modules (goals, BGV, documents, tickets, chat, contracts, …).
CREATE TABLE IF NOT EXISTS entity_records (
  tenant_id      text NOT NULL,
  collection     text NOT NULL,
  record_key     text NOT NULL,           -- the record's id, or a content hash when it has none
  employee_code  text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  doc            jsonb NOT NULL,
  PRIMARY KEY (tenant_id, collection, record_key)
) PARTITION BY HASH (tenant_id, collection);
CREATE INDEX IF NOT EXISTS entity_emp_ix ON entity_records (tenant_id, collection, employee_code);
CREATE INDEX IF NOT EXISTS entity_upd_ix ON entity_records (tenant_id, collection, updated_at DESC);

-- One JSON document per settings-style object (settings, suite, policies, …).
CREATE TABLE IF NOT EXISTS tenant_docs (
  tenant_id   text NOT NULL REFERENCES tenants ON DELETE CASCADE,
  name        text NOT NULL,
  doc         jsonb NOT NULL,
  version     int NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, name)
);

-- ── Background jobs (payroll runs, roll-ups, bulk imports) ──────────────
CREATE TABLE IF NOT EXISTS jobs (
  job_id      bigserial PRIMARY KEY,
  tenant_id   text NOT NULL,
  kind        text NOT NULL,
  params      jsonb NOT NULL DEFAULT '{}',
  status      text NOT NULL DEFAULT 'queued',   -- queued | running | done | failed
  progress    numeric(5,2) NOT NULL DEFAULT 0,
  result      jsonb,
  error       text,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS jobs_queue_ix ON jobs (status, job_id) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS jobs_tenant_ix ON jobs (tenant_id, job_id DESC);

-- ── Headcount statistics (dashboards read this, not the 10-lakh table) ──
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_headcount AS
  SELECT tenant_id, coalesce(company_id,'') AS company_id, coalesce(location_id,'') AS location_id,
         coalesce(department,'') AS department, status, coalesce(employment_type,'') AS employment_type,
         count(*)::int AS n,
         count(*) FILTER (WHERE date_of_joining >= date_trunc('month', current_date))::int AS joined_this_month,
         count(*) FILTER (WHERE exit_date >= date_trunc('month', current_date))::int AS left_this_month,
         sum(monthly_gross)::numeric(18,2) AS gross_total
  FROM employees
  GROUP BY 1,2,3,4,5,6;
CREATE UNIQUE INDEX IF NOT EXISTS mv_headcount_uq ON mv_headcount (tenant_id, company_id, location_id, department, status, employment_type);

-- ── Partition maintenance ─────────────────────────────────────────────
-- Creates monthly partitions for [from, to). Called by migrate and nightly by the worker.
CREATE OR REPLACE FUNCTION ensure_month_partitions(tbl text, from_month date, to_month date) RETURNS int
LANGUAGE plpgsql AS $$
DECLARE m date := date_trunc('month', from_month); made int := 0; pname text;
BEGIN
  WHILE m < to_month LOOP
    pname := format('%s_%s', tbl, to_char(m, 'YYYY_MM'));
    IF to_regclass(pname) IS NULL THEN
      EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)', pname, tbl, m, (m + interval '1 month')::date);
      made := made + 1;
    END IF;
    m := (m + interval '1 month')::date;
  END LOOP;
  RETURN made;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['punches','attendance_daily','requests','payslips','notifications','audit_log'] LOOP
    IF to_regclass(t || '_default') IS NULL THEN
      EXECUTE format('CREATE TABLE %I PARTITION OF %I DEFAULT', t || '_default', t);
    END IF;
  END LOOP;
  FOR i IN 0..15 LOOP
    IF to_regclass('entity_records_p' || i) IS NULL THEN
      EXECUTE format('CREATE TABLE %I PARTITION OF entity_records FOR VALUES WITH (MODULUS 16, REMAINDER %s)', 'entity_records_p' || i, i);
    END IF;
  END LOOP;
END $$;

-- ── Row-level security for reporting / BI connections ──────────────────
-- The API connects as the table owner and always filters by tenant_id in code. Any other login (BI tools,
-- read replicas, analysts) is limited to one tenant by these policies: SET app.tenant = '<tenant>' first.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','locations','org_units','employees','accounts','punches','attendance_daily','requests',
                           'payslip_batches','payslips','notifications','audit_log','entity_records','tenant_docs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'tenant_isolation') THEN
      EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant'', true))', t);
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
