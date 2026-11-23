// Connection pool and small query helpers. One pool per process; size it to (CPU cores × 2–4) per API instance and
// put PgBouncer (transaction mode) in front when you run many instances.
import pg from "pg";

pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric → number
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));   // bigint → number (counts)
pg.types.setTypeParser(1082, (v) => v);                               // date stays "YYYY-MM-DD"

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres@localhost:5432/ezyhr",
  max: Number(process.env.PG_POOL_MAX || 20),
  idleTimeoutMillis: 30000,
  statement_timeout: process.env.PG_STATEMENT_TIMEOUT_MS !== undefined ? Number(process.env.PG_STATEMENT_TIMEOUT_MS) : 15000, // 0 = no limit
  application_name: "ezy-hr-api",
});

export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
export const many = async (text, params) => (await pool.query(text, params)).rows;

export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
