// Background worker: payroll runs, attendance roll-ups, statistics, partitions. Run as many as you like:
//   node api/worker.mjs
// It also applies database migrations at start-up (under a lock), so API servers behind PgBouncer can skip them.
import { startWorker } from "./jobs.mjs";
import { migrate } from "../db/migrate.mjs";
await migrate({ quiet: true });
startWorker();
