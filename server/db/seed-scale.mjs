// Builds a large test company for load testing: the demo company (so every demo sign-in works) plus generated
// employees in a 10-wide reporting tree under the demo leadership, with a month of attendance, today's punches,
// six months of requests, notifications and audit history. Everything is generated inside PostgreSQL.
//   node db/seed-scale.mjs --tenant scale --employees 1000000 [--no-attendance]
// run with PG_STATEMENT_TIMEOUT_MS=0 (npm run seed:scale sets it): bulk statements take minutes
import { pool, q } from "../api/db.mjs";
import { migrate } from "./migrate.mjs";
import { importDataset } from "./seed-demo.mjs";

const arg = (k, def) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : def; };
const T = arg("tenant", "scale");
const N = Number(arg("employees", 1000000));
const CHUNK = 100000;
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

const FIRST = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Ananya", "Diya", "Aadhya", "Saanvi", "Pari", "Anika", "Navya", "Myra", "Sara", "Ira",
  "Rohan", "Karthik", "Rahul", "Priya", "Sneha", "Kavya", "Lakshmi", "Meera", "Nikhil", "Pooja", "Rajesh", "Suresh", "Divya", "Swathi", "Harsha", "Manoj", "Deepak", "Neha", "Ritu", "Varun",
  "Farhan", "Zoya", "Imran", "Ayesha", "John", "Mary", "Joseph", "Grace", "Gurpreet", "Simran", "Tenzin", "Lalit", "Bhavna", "Chetan", "Esha", "Gopal", "Hema", "Jaya", "Kunal", "Lavanya"];
const LAST = ["Sharma", "Verma", "Reddy", "Rao", "Iyer", "Nair", "Menon", "Pillai", "Gupta", "Agarwal", "Patel", "Shah", "Mehta", "Joshi", "Kulkarni", "Deshpande", "Naidu", "Choudhary", "Singh", "Kaur",
  "Das", "Bose", "Banerjee", "Mukherjee", "Ghosh", "Sen", "Khan", "Ahmed", "Fernandes", "D'Souza", "Thomas", "George", "Mathew", "Varghese", "Yadav", "Mishra", "Pandey", "Tiwari", "Saxena", "Kapoor",
  "Malhotra", "Bhat", "Hegde", "Shetty", "Gowda", "Krishnan", "Subramanian", "Venkatesh", "Rajan", "Murthy", "Chatterjee", "Dutta", "Sinha", "Jain", "Bansal", "Goel", "Arora", "Chopra", "Sethi", "Bajaj"];
const DEPTS = [["Engineering", "Software Engineer"], ["Operations", "Operations Executive"], ["Sales", "Sales Executive"], ["Customer Support", "Support Associate"], ["Finance", "Accountant"],
  ["People", "HR Executive"], ["Data Migration", "Data Engineer"], ["Design", "Product Designer"], ["Marketing", "Marketing Executive"], ["Supply Chain", "Supply Chain Analyst"], ["Quality", "QA Engineer"], ["IT", "IT Support Engineer"]];
const arr = (a) => `ARRAY[${a.map((x) => `'${x.replace(/'/g, "''")}'`).join(",")}]`;

async function main() {
  await migrate({ quiet: true });
  const resume = process.argv.includes("--resume-after-employees");
  const gen = N - 46;
  if (!resume) {
  log(`tenant ${T}: loading the demo company`);
  await q("DELETE FROM tenants WHERE tenant_id = $1", [T]);
  for (const tb of ["punches", "attendance_daily", "requests", "payslips", "payslip_batches", "notifications", "audit_log", "entity_records", "jobs"]) await q(`DELETE FROM ${tb} WHERE tenant_id = $1`, [T]);
  const { buildDemoSeed: buildSeed } = await import("../../src/data/seed.js"); // the full sample company (test fixture)
  await importDataset(T, buildSeed(), { name: `Scale test company (${N.toLocaleString("en-IN")} employees)`, log });
  const locs = (await q("SELECT location_id, company_id, coalesce(c.country, l.doc->>'country', 'IN') AS country FROM locations l JOIN companies c USING (tenant_id, company_id) WHERE tenant_id = $1 ORDER BY location_id", [T])).rows;
  const inLocs = locs.filter((l) => /^IN/.test(l.location_id));
  // 85 % of people in India, the rest spread over the other countries
  const L = [...Array(17).fill(inLocs).flat(), ...locs.filter((l) => !/^IN/.test(l.location_id))].slice(0, 400);
  const pw = (await q("SELECT password_hash FROM employees WHERE tenant_id = $1 AND employee_code = 'EMP001'", [T])).rows[0].password_hash;

  log(`generating ${gen.toLocaleString("en-IN")} employees in chunks of ${CHUNK.toLocaleString("en-IN")}`);
  for (let from = 1; from <= gen; from += CHUNK) {
    const to = Math.min(gen, from + CHUNK - 1);
    await q(`
      WITH g AS (
        SELECT i, 'E' || lpad(i::text, 7, '0') AS code,
               CASE WHEN i <= 10 THEN 'EMP005' ELSE 'E' || lpad(((i - 11) / 10 + 1)::text, 7, '0') END AS mgr,
               (${arr(FIRST)})[1 + (i * 7) % ${FIRST.length}] AS fn, (${arr(LAST)})[1 + (i * 13 + i / ${FIRST.length}) % ${LAST.length}] AS ln,
               (${arr(DEPTS.map((d) => d[0]))})[1 + (i * 31) % ${DEPTS.length}] AS dept, (${arr(DEPTS.map((d) => d[1]))})[1 + (i * 31) % ${DEPTS.length}] AS role,
               (${arr(L.map((l) => l.location_id))})[1 + (i * 17) % ${L.length}] AS loc, (${arr(L.map((l) => l.company_id))})[1 + (i * 17) % ${L.length}] AS co,
               (${arr(L.map((l) => (l.country || "IN").slice(0, 2)))})[1 + (i * 17) % ${L.length}] AS cc,
               date '2008-01-01' + ((i * 2654435761) % 6850)::int AS doj,
               date '1966-01-01' + ((i::bigint * 40503) % 13500)::int AS dob,
               (18000 + ((i * 2246822519) % 1000) ^ 2 / 8 + (CASE WHEN i <= 1110 THEN 250000 WHEN i <= 11110 THEN 120000 ELSE 0 END))::numeric(14,2) AS gross
        FROM generate_series($2::int, $3::int) i)
      INSERT INTO employees (tenant_id, employee_code, full_name, email, login_id, designation, department, reporting_manager, company_id, location_id, country_code,
                             employment_type, worker_type, grade_code, status, date_of_joining, date_of_birth, monthly_gross, password_hash, doc)
      SELECT $1, code, fn || ' ' || ln, lower(fn || '.' || replace(ln, '''', '') || '.' || i || '@scale.demo'), lower(fn || '.' || replace(ln, '''', '') || '.' || i || '@scale.demo'),
             CASE WHEN i <= 10 THEN 'Vice President – ' || dept WHEN i <= 110 THEN 'Director – ' || dept WHEN i <= 1110 THEN 'Senior Manager' WHEN i <= 11110 THEN 'Manager' WHEN i <= 111110 THEN 'Team Lead' ELSE role END,
             dept, mgr, co, loc, cc, CASE WHEN i % 23 = 0 THEN 'contract' ELSE 'full_time' END, CASE WHEN i % 23 = 0 THEN 'contract' ELSE 'permanent' END,
             CASE WHEN i <= 1110 THEN 'M3' WHEN i <= 111110 THEN 'M1' ELSE 'P' || (1 + i % 3) END,
             CASE WHEN i % 97 = 0 THEN 'exited' ELSE 'active' END, doj, dob, gross, $4,
             jsonb_build_object('employee_code', code, 'full_name', fn || ' ' || ln, 'email', lower(fn || '.' || replace(ln, '''', '') || '.' || i || '@scale.demo'),
               'login_id', lower(fn || '.' || replace(ln, '''', '') || '.' || i || '@scale.demo'), 'department', dept, 'reporting_manager', mgr, 'company_id', co, 'location_id', loc,
               'country_code', cc, 'date_of_joining', doj, 'date_of_birth', dob, 'monthly_gross', gross, 'status', CASE WHEN i % 97 = 0 THEN 'exited' ELSE 'active' END,
               'employment_type', CASE WHEN i % 23 = 0 THEN 'contract' ELSE 'full_time' END, 'pay_cycle', 'monthly', 'tax_regime', 'new',
               'bank_name', (ARRAY['HDFC Bank','ICICI Bank','State Bank of India','Axis Bank','Kotak Mahindra Bank'])[1 + i % 5],
               'bank_account', lpad(((i::bigint * 7919) % 100000000000)::text, 14, '5'), 'bank_ifsc', 'HDFC000' || lpad((i % 9999)::text, 4, '0'),
               'pan', 'AB' || chr(65 + i % 26) || 'P' || chr(65 + (i / 26) % 26) || lpad((i % 10000)::text, 4, '0') || chr(65 + (i / 7) % 26),
               'uan', '10' || lpad(i::text, 10, '0'), 'shift', 'general', 'leave_policy', 'standard', 'gender', CASE WHEN i % 2 = 0 THEN 'F' ELSE 'M' END)
      FROM g`, [T, from, to, pw]);
    log(`  employees ${to.toLocaleString("en-IN")}`);
  }
  } else log(`resuming tenant ${T} after the employee step`);

  if (!process.argv.includes("--no-attendance")) {
    const m = (await q("SELECT to_char(date_trunc('month', now()) - interval '1 month', 'YYYY-MM-DD') AS d")).rows[0].d;
    log(`attendance for the month starting ${m} (Mon–Sat, every active employee)`);
    await q("SELECT ensure_month_partitions('attendance_daily', $1::date, ($1::date + interval '1 month')::date)", [m]);
    await q("ALTER TABLE attendance_daily SET (autovacuum_enabled = false)").catch(() => {});
    for (let from = 1; from <= gen; from += 250000) {
      const to = Math.min(gen, from + 249999);
      await q(`
        INSERT INTO attendance_daily (tenant_id, day, employee_code, status, first_in, last_out, worked_minutes, late)
        SELECT $1, d::date, 'E' || lpad(i::text, 7, '0'), st,
               CASE WHEN st IN ('present','half_day') THEN d + time '09:00' + ((i + extract(day from d)::int * 37) % 75) * interval '1 minute' - interval '330 minutes' END,
               CASE WHEN st = 'present' THEN d + time '18:00' + ((i * 3 + extract(day from d)::int) % 90) * interval '1 minute' - interval '330 minutes'
                    WHEN st = 'half_day' THEN d + time '13:00' - interval '330 minutes' END,
               CASE st WHEN 'present' THEN 540 + (i % 60) WHEN 'half_day' THEN 240 ELSE 0 END,
               st = 'present' AND (i + extract(day from d)::int * 37) % 75 > 45
        FROM generate_series($2::int, $3::int) i
        CROSS JOIN generate_series($4::date, ($4::date + interval '1 month' - interval '1 day'), interval '1 day') d
        CROSS JOIN LATERAL (SELECT CASE (i * 31 + extract(day from d)::int * 17) % 100 WHEN 0 THEN 'absent' WHEN 1 THEN 'absent' WHEN 2 THEN 'absent'
                                       WHEN 3 THEN 'leave' WHEN 4 THEN 'leave' WHEN 5 THEN 'half_day' ELSE 'present' END AS st) s
        WHERE extract(isodow from d) < 7 AND i % 97 <> 0`, [T, from, to, m]);
      log(`  attendance up to employee ${to.toLocaleString("en-IN")}`);
    }
    await q("ALTER TABLE attendance_daily RESET (autovacuum_enabled)").catch(() => {});
  }

  log("today's punches (62 % of active employees have punched in)");
  await q(`INSERT INTO punches (tenant_id, id, ts, employee_code, type, source, inside, doc)
    SELECT $1, 'PN-G' || i, date_trunc('day', now()) + interval '210 minutes' + (i % 90) * interval '1 minute', 'E' || lpad(i::text, 7, '0'), 'in',
           (ARRAY['biometric','geo_mobile','web','kiosk'])[1 + i % 4], i % 13 <> 0,
           jsonb_build_object('id', 'PN-G' || i, 'employee_code', 'E' || lpad(i::text, 7, '0'), 'ts', date_trunc('day', now()) + interval '210 minutes' + (i % 90) * interval '1 minute',
                              'type', 'in', 'source', (ARRAY['biometric','geo_mobile','web','kiosk'])[1 + i % 4], 'inside', i % 13 <> 0)
    FROM generate_series(1, $2::int) i WHERE i % 97 <> 0 AND i % 8 < 5`, [T, gen]);

  log("six months of requests (leave, expense, regularise, advance)");
  await q(`INSERT INTO requests (tenant_id, request_id, created_at, type, employee_code, company_id, status, stage, pending_with, amount, from_date, to_date, doc)
    SELECT $1, rid, ca, ty, ec, NULL, st, stg,
           CASE WHEN st = 'Pending' AND stg = 'manager' THEN mgr WHEN st = 'Pending' THEN 'role:admin' END,
           CASE WHEN ty IN ('expense','advance') THEN 500 + (n * 37) % 25000 END,
           CASE WHEN ty = 'leave' THEN (ca + interval '5 days')::date END, CASE WHEN ty = 'leave' THEN (ca + interval '5 days' + ((n % 3) || ' days')::interval)::date END,
           jsonb_build_object('request_id', rid, 'type', ty, 'employee_code', ec, 'status', st, 'stage', stg, 'created_at', ca,
             'leave_type', CASE WHEN ty = 'leave' THEN (ARRAY['CL','SL','EL'])[1 + n % 3] END, 'days', CASE WHEN ty = 'leave' THEN 1 + n % 3 END,
             'from_date', CASE WHEN ty = 'leave' THEN (ca + interval '5 days')::date END, 'to_date', CASE WHEN ty = 'leave' THEN (ca + interval '5 days' + ((n % 3) || ' days')::interval)::date END,
             'reason', (ARRAY['Family function','Not feeling well','Personal work','Travel to home town','Client visit','Team offsite'])[1 + n % 6],
             'title', CASE WHEN ty = 'expense' THEN (ARRAY['Client meeting lunch','Cab to client site','Hotel stay','Conference fee'])[1 + n % 4] END,
             'amount', CASE WHEN ty IN ('expense','advance') THEN 500 + (n * 37) % 25000 END, 'steps', '[]'::jsonb, 'history', '[]'::jsonb,
             'currency', 'INR', 'project', CASE WHEN ty = 'expense' THEN 'Client delivery' END,
             'items', CASE WHEN ty = 'expense' THEN jsonb_build_array(jsonb_build_object('date', (ca)::date, 'category', 'LOCAL', 'description',
                        (ARRAY['Client meeting lunch','Cab to client site','Hotel stay','Conference fee'])[1 + n % 4], 'amount', 500 + (n * 37) % 25000)) END)
    FROM (SELECT n, 'RQ-' || lpad(n::text, 8, '0') AS rid,
                 now() - ((n * 2654435761) % (180 * 1440)) * interval '1 minute' AS ca,
                 (ARRAY['leave','leave','leave','leave','leave','leave','expense','expense','expense','regularize'])[1 + n % 10] AS ty,
                 'E' || lpad((1 + (n * 7) % $2)::text, 7, '0') AS ec,
                 'E' || lpad(greatest(1, ((1 + (n * 7) % $2) - 11) / 10 + 1)::text, 7, '0') AS mgr,
                 CASE WHEN n % 50 = 0 THEN 'Pending' WHEN n % 50 = 1 THEN 'Rejected' ELSE 'Approved' END AS st,
                 CASE WHEN n % 50 = 0 THEN CASE WHEN n % 3 = 0 THEN 'admin' ELSE 'manager' END END AS stg
          FROM generate_series(1, $3::int) n) x`, [T, gen, Math.round(N * 0.3)]);

  log("notifications and audit history");
  await q(`INSERT INTO notifications (tenant_id, id, at, recipient, read, doc)
    SELECT $1, 'N-G' || n, now() - (n % 43200) * interval '1 minute', 'E' || lpad((1 + (n * 11) % $2)::text, 7, '0'), n % 3 <> 0,
           jsonb_build_object('id', 'N-G' || n, 'to', 'E' || lpad((1 + (n * 11) % $2)::text, 7, '0'), 'text', 'Your request RQ-' || lpad(n::text, 8, '0') || ' was approved.',
                              'at', now() - (n % 43200) * interval '1 minute', 'read', n % 3 <> 0, 'link', '/inbox')
    FROM generate_series(1, $3::int) n`, [T, gen, Math.round(N * 0.5)]);
  await q(`INSERT INTO audit_log (tenant_id, log_id, ts, user_code, role, action, ip, details, doc)
    SELECT $1, 'AUD-G' || n, now() - (n % 259200) * interval '1 minute', 'E' || lpad((1 + (n * 13) % $2)::text, 7, '0'), 'emp',
           (ARRAY['LOGIN_SUCCESS','LOGIN_SUCCESS','LOGIN_SUCCESS','LEAVE_APPLIED','EXPENSE_SUBMITTED','PROFILE_UPDATE','LOGOUT'])[1 + n % 7],
           '10.' || (n % 250) || '.' || (n % 199) || '.' || (n % 97), 'Generated history', '{}'::jsonb
    FROM generate_series(1, $3::int) n`, [T, gen, N]);

  log("analysing tables and refreshing statistics");
  for (const tb of ["employees", "attendance_daily", "punches", "requests", "notifications", "audit_log"]) await q(`ANALYZE ${tb}`);
  await q("REFRESH MATERIALIZED VIEW mv_headcount");
  const c = (await q("SELECT (SELECT count(*) FROM employees WHERE tenant_id = $1) AS emp, (SELECT count(*) FROM attendance_daily WHERE tenant_id = $1) AS att, (SELECT count(*) FROM requests WHERE tenant_id = $1) AS req, pg_size_pretty(pg_database_size(current_database())) AS size", [T])).rows[0];
  log(`done: ${Number(c.emp).toLocaleString("en-IN")} employees, ${Number(c.att).toLocaleString("en-IN")} attendance days, ${Number(c.req).toLocaleString("en-IN")} requests · database ${c.size}`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
