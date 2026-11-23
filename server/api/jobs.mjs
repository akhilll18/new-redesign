// Background jobs. Claimed with FOR UPDATE SKIP LOCKED, so any number of worker processes can run side by side.
import { one, pool, q } from "./db.mjs";
import { ensurePartitions } from "../db/migrate.mjs";

const CHUNK = Number(process.env.PAYROLL_CHUNK || 100000);
// Background work is not bound by the API's per-statement time limit (meant for interactive requests).
async function qLong(text, params) {
  const c = await pool.connect();
  try {
    await c.query("SET statement_timeout = 0");
    return await c.query(text, params);
  } finally {
    await c.query("RESET statement_timeout").catch(() => {});
    c.release();
  }
}
const progress = (id, p) => q("UPDATE jobs SET progress = $2 WHERE job_id = $1", [id, Math.min(99.9, Math.round(p * 10) / 10)]);

// Payroll for a month, set-based in PostgreSQL: 1 lakh payslips per statement.
// Pay = monthly gross × payable days / days in month; LOP from attendance_daily (absent = 1, half day = 0.5).
// Split: Basic 50 %, HRA 20 %, Special allowance = rest. PF 12 % of Basic capped at ₹1,800; ESI 0.75 % up to ₹21,000 gross;
// PT ₹200 above ₹20,000 / ₹150 above ₹15,000; TDS = new-regime annual tax / 12.
async function payrollRun(job) {
  const { period, company_id } = job.params;
  const t = job.tenant_id;
  const month = `${period}-01`;
  const batch = `PSB-${period.replace("-", "")}-S${job.job_id}`;
  await q("SELECT ensure_month_partitions('payslips', $1::date, ($1::date + interval '1 month')::date)", [month]);
  await q("SELECT ensure_month_partitions('attendance_daily', $1::date, ($1::date + interval '1 month')::date)", [month]);
  const comps = await one("SELECT coalesce(jsonb_agg(doc ORDER BY ord), '[]') AS c FROM entity_records WHERE tenant_id = $1 AND collection = 'payslipComponents'", [t]);
  await q(`INSERT INTO payslip_batches (tenant_id, batch_id, period, status, doc) VALUES ($1, $2, $3, 'Draft', $4)`,
    [t, batch, period, JSON.stringify({ id: batch, period, source: "payroll", status: "Draft", note: "Server payroll run", created_by: job.created_by, created_at: new Date().toISOString(), components: comps.c, history: [{ at: new Date().toISOString(), by: job.created_by, action: "Computed on the server" }] })]);
  const bounds = (await q(`SELECT employee_code FROM (SELECT employee_code, row_number() OVER (ORDER BY employee_code) AS rn FROM employees WHERE tenant_id = $1 AND status = 'active' ${company_id ? "AND company_id = $2" : ""}) x WHERE rn % $${company_id ? 3 : 2} = 1 ORDER BY 1`,
    company_id ? [t, company_id, CHUNK] : [t, CHUNK])).rows.map((r) => r.employee_code);
  let made = 0;
  for (let i = 0; i < bounds.length; i++) {
    const lo = bounds[i], hi = bounds[i + 1] || null;
    const r = await qLong(`
      WITH days AS (SELECT extract(day from ($2::date + interval '1 month' - interval '1 day'))::int AS d),
      lop AS (SELECT employee_code, sum(CASE status WHEN 'absent' THEN 1 WHEN 'half_day' THEN 0.5 ELSE 0 END) AS lop
              FROM attendance_daily WHERE tenant_id = $1 AND day >= $2::date AND day < ($2::date + interval '1 month')
                AND employee_code >= $4 AND ($5::text IS NULL OR employee_code < $5) GROUP BY 1),
      base AS (
        SELECT e.employee_code, e.full_name, e.email, e.department, e.designation, e.date_of_joining, e.monthly_gross, e.country_code, e.doc,
               days.d AS days, least(coalesce(l.lop, 0), days.d) AS lop,
               round(e.monthly_gross * (days.d - least(coalesce(l.lop, 0), days.d)) / days.d, 2) AS g
        FROM employees e CROSS JOIN days LEFT JOIN lop l ON l.employee_code = e.employee_code
        WHERE e.tenant_id = $1 AND e.status = 'active' AND e.employee_code >= $4 AND ($5::text IS NULL OR e.employee_code < $5) ${company_id ? "AND e.company_id = $6" : ""}),
      calc AS (
        SELECT *, round(g * 0.5, 2) AS basic, round(g * 0.2, 2) AS hra,
               CASE WHEN coalesce(country_code, 'IN') = 'IN' THEN least(round(g * 0.5 * 0.12), 1800) ELSE 0 END AS pf,
               CASE WHEN coalesce(country_code, 'IN') = 'IN' AND monthly_gross <= 21000 THEN ceil(g * 0.0075) ELSE 0 END AS esi,
               CASE WHEN coalesce(country_code, 'IN') <> 'IN' THEN 0 WHEN g > 20000 THEN 200 WHEN g > 15000 THEN 150 ELSE 0 END AS pt,
               CASE WHEN coalesce(country_code, 'IN') = 'IN' THEN round(tds_new_regime(monthly_gross * 12) / 12) ELSE 0 END AS tds
        FROM base)
      INSERT INTO payslips (tenant_id, period_month, batch_id, employee_code, slip_id, gross, deductions, net, lop_days, doc)
      SELECT $1, $2::date, $3, employee_code, $3 || '-' || employee_code, g, pf + esi + pt + tds, g - pf - esi - pt - tds, lop,
        jsonb_build_object('id', $3 || '-' || employee_code, 'employee_code', employee_code, 'total_working_days', days, 'actual_payable_days', days - lop,
          'lop_days', lop, 'days_payable', days - lop,
          'values', jsonb_build_object('BASIC', basic, 'HRA', hra, 'SPECIAL', g - basic - hra, 'OTHER_ALW', 0, 'PF_EE', pf, 'ESI_EE', esi, 'PT', pt, 'TDS', tds,
                                       'GROSS', g, 'NET_PAY', g - pf - esi - pt - tds),
          'emp', jsonb_build_object('full_name', full_name, 'email', email, 'employee_code', employee_code, 'date_of_joining', date_of_joining,
                                    'department', department, 'designation', designation, 'payment_mode', 'Bank Transfer',
                                    'bank_name', doc->>'bank_name', 'bank_account', doc->>'bank_account', 'pan', doc->>'pan', 'uan', doc->>'uan'))
      FROM calc
      ON CONFLICT (tenant_id, period_month, batch_id, employee_code) DO NOTHING`, company_id ? [t, month, batch, lo, hi, company_id] : [t, month, batch, lo, hi]);
    made += r.rowCount;
    await progress(job.job_id, ((i + 1) / bounds.length) * 100);
  }
  const tot = await one("SELECT count(*)::int AS n, coalesce(sum(gross), 0) AS gross, coalesce(sum(net), 0) AS net, coalesce(sum(deductions), 0) AS ded FROM payslips WHERE tenant_id = $1 AND period_month = $2 AND batch_id = $3", [t, month, batch]);
  await q("UPDATE payslip_batches SET employees = $3, gross_total = $4, net_total = $5 WHERE tenant_id = $1 AND batch_id = $2", [t, batch, tot.n, tot.gross, tot.net]);
  return { batch_id: batch, period, payslips: tot.n, gross: tot.gross, deductions: tot.ded, net: tot.net };
}

// Rolls punches + approved leave up into attendance_daily for one day.
async function attendanceRollup(job) {
  const t = job.tenant_id;
  const day = job.params.day || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await q("SELECT ensure_month_partitions('attendance_daily', date_trunc('month', $1::date)::date, (date_trunc('month', $1::date) + interval '1 month')::date)", [day]);
  const r = await qLong(`
    INSERT INTO attendance_daily (tenant_id, day, employee_code, status, first_in, last_out, worked_minutes, late)
    SELECT $1, $2::date, e.employee_code,
      CASE WHEN extract(isodow from $2::date) = 7 THEN 'weekly_off'
           WHEN lv.employee_code IS NOT NULL THEN 'leave'
           WHEN p.first_in IS NULL THEN 'absent'
           WHEN extract(epoch from (p.last_out - p.first_in)) / 60 < 240 THEN 'half_day'
           ELSE 'present' END,
      p.first_in, p.last_out, coalesce(extract(epoch from (p.last_out - p.first_in)) / 60, 0)::int,
      coalesce((p.first_in AT TIME ZONE 'Asia/Kolkata')::time > time '09:45', false)
    FROM employees e
    LEFT JOIN (SELECT employee_code, min(ts) FILTER (WHERE type = 'in') AS first_in, max(ts) FILTER (WHERE type = 'out') AS last_out
               FROM punches WHERE tenant_id = $1 AND ts >= ($2::date::timestamp AT TIME ZONE 'Asia/Kolkata') AND ts < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')
               GROUP BY 1) p ON p.employee_code = e.employee_code
    LEFT JOIN (SELECT DISTINCT employee_code FROM requests WHERE tenant_id = $1 AND type = 'leave' AND status = 'Approved'
               AND from_date <= $2::date AND to_date >= $2::date) lv ON lv.employee_code = e.employee_code
    WHERE e.tenant_id = $1 AND e.status = 'active' AND (e.date_of_joining IS NULL OR e.date_of_joining <= $2::date)
    ON CONFLICT (tenant_id, day, employee_code) DO UPDATE SET status = EXCLUDED.status, first_in = EXCLUDED.first_in, last_out = EXCLUDED.last_out,
      worked_minutes = EXCLUDED.worked_minutes, late = EXCLUDED.late`, [t, day]);
  return { day, rows: r.rowCount };
}

const RUNNERS = {
  payroll_run: payrollRun,
  attendance_rollup: attendanceRollup,
  refresh_stats: async () => { await qLong("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_headcount"); return { ok: true }; },
  partitions: async () => { await ensurePartitions(); return { ok: true }; },
};

export async function runOne() {
  const job = await one(`UPDATE jobs SET status = 'running', started_at = now() WHERE job_id = (
      SELECT job_id FROM jobs WHERE status = 'queued' ORDER BY job_id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);
  if (!job) return false;
  try {
    const fn = RUNNERS[job.kind];
    if (!fn) throw new Error(`Unknown job kind ${job.kind}`);
    const t0 = Date.now();
    const result = await fn(job);
    await q("UPDATE jobs SET status = 'done', progress = 100, result = $2, finished_at = now() WHERE job_id = $1", [job.job_id, JSON.stringify({ ...result, seconds: Math.round((Date.now() - t0) / 100) / 10 })]);
    if (job.kind === "payroll_run" || job.kind === "attendance_rollup") await q("INSERT INTO jobs (tenant_id, kind) VALUES ($1, 'refresh_stats')", [job.tenant_id]);
  } catch (e) {
    await q("UPDATE jobs SET status = 'failed', error = $2, finished_at = now() WHERE job_id = $1", [job.job_id, String(e.message).slice(0, 1000)]);
  }
  return true;
}

// Schedules: statistics every 5 minutes, yesterday's attendance and next months' partitions nightly.
let lastStats = 0, lastNight = "";
async function schedule() {
  const now = Date.now();
  const tenants = (await q("SELECT tenant_id FROM tenants WHERE status = 'active'")).rows.map((r) => r.tenant_id);
  if (now - lastStats > 5 * 60000) { lastStats = now; await q("INSERT INTO jobs (tenant_id, kind) SELECT 'system', 'refresh_stats' WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE kind = 'refresh_stats' AND status IN ('queued','running'))"); }
  const today = new Date().toISOString().slice(0, 10);
  if (lastNight !== today && new Date().getUTCHours() >= 19) { // 00:30 IST
    lastNight = today;
    await q("INSERT INTO jobs (tenant_id, kind) VALUES ('system', 'partitions')");
    for (const t of tenants) await q("INSERT INTO jobs (tenant_id, kind, params) VALUES ($1, 'attendance_rollup', $2)", [t, JSON.stringify({ day: today })]);
  }
}

export function startWorker({ intervalMs = 1000, log = console.log } = {}) {
  let stopped = false;
  (async () => {
    log("worker started");
    while (!stopped) {
      try { await schedule(); while (await runOne()) { /* drain */ } } catch (e) { log("worker:", e.message); }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  })();
  return () => { stopped = true; };
}
export { pool };
