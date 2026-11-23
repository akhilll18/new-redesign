// Applies db/migrations/*.sql in order (each once) and makes sure monthly partitions exist
// from 24 months back to 3 months ahead.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../api/db.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");
// Several API / worker processes may start together: a database lock makes sure only one migrates at a time.
export async function migrate({ quiet = false } = {}) {
  const c = await pool.connect();
  try {
    await c.query("SELECT pg_advisory_lock(7471008)");
    await run(c, quiet);
  } finally {
    await c.query("SELECT pg_advisory_unlock(7471008)").catch(() => {});
    c.release();
  }
  await ensurePartitions();
}
async function run(pool, quiet) {
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const done = new Set((await pool.query("SELECT version FROM schema_migrations")).rows.map((r) => r.version));
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    try {
      await pool.query(readFileSync(join(dir, f), "utf8"));
      await pool.query("INSERT INTO schema_migrations (version) VALUES ($1)", [f]);
      if (!quiet) console.log("applied", f);
    } catch (e) {
      if (f.includes("reporting_role") && /permission denied|must be/.test(e.message)) { console.warn("skipped", f, "(needs a superuser)"); continue; }
      throw new Error(`${f}: ${e.message}`);
    }
  }
}
export async function ensurePartitions(back = 24, ahead = 3) {
  for (const t of ["punches", "attendance_daily", "requests", "payslips", "notifications", "audit_log"]) {
    await pool.query(`SELECT ensure_month_partitions($1, (date_trunc('month', now()) - make_interval(months => $2))::date, (date_trunc('month', now()) + make_interval(months => $3))::date)`, [t, back, ahead]);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().then(() => { console.log("database is up to date"); return pool.end(); }).catch((e) => { console.error(e.message); process.exit(1); });
}
