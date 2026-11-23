# EZY HR · Database edition (v10.8) — 10,000 to 10,00,000+ employees

The same EZY HR app (same screens, same build) now runs two ways:

| | Browser edition (unchanged) | **Database edition (new)** |
|---|---|---|
| Where data lives | the browser (`localStorage`) | **PostgreSQL 16** on your server |
| Size | demo / small teams | **10,000 to 10,00,000+ employees per company** |
| Sign-in | checked in the browser | checked by the server (scrypt passwords, OTP, PIN, lock-out, revocable sessions) |
| Companies | one | **many companies (workspaces) on one server**, isolated by `tenant_id` |
| How the app knows | — | it asks `<server>/api/v1/config` when it starts; if a server answers, it uses it |

Nothing is chosen at build time. Open the app from the EZY HR server and it is the database edition; open the
same files from any static host and it is the browser edition. The mobile apps connect with **Sign in → Connect to a
server**.

---

## 1. Start with one login: the Super Admin

A new company starts with exactly **one** sign-in — its Super Admin. Everyone else is created inside the app.

```bash
node server/db/create-company.mjs --tenant acme --name "Acme Industries Pvt Ltd" --country IN \
     --owner "Priya Shah" --email priya@acme.in --password "Strong@Pass1" --pin 482913
```

The company gets EZY HR's standard set-up (leave types, holidays, pay components, expense categories, letter
templates, policies) and no demo people. Then the Super Admin signs in (workspace ID `acme`) and uses the **existing
screens**:

| To create | Screen | What happens |
|---|---|---|
| HR / Finance / IT admins | Users, access & policies → **Create admin** | temporary password → the admin signs in, confirms an OTP, sets a new password |
| Employees, contract staff, interns | People & organisation → **Employee database → Add employee** (or Enterprise data → **Bulk import** CSV for thousands) | account waits for approval → approve → the employee signs in and sets a new password |

Codes are given out by the server: if two admins add people at the same moment, the second gets the next free
`EMPnnn` automatically (the app shows "Saved with a new code"). With `ALLOW_SIGNUP=1` the public pricing page can
create a company and its Super Admin by itself.

**v10.9:** the demo companies work the same way. Only the Super Admin can sign in at first; every other person
keeps their record but has *No login yet* until the Super Admin chooses **Create login** for them in Users & access
(temporary password `Welcome@123`, changed at first sign-in). The sign-in page shows only the Super Admin shortcut.

---

## 2. How it stays fast at 10 lakh

**The app never downloads the whole company.** After sign-in it loads a *working set*:

| Who | Loaded into the app | Everything else |
|---|---|---|
| Employee / manager | themselves, their reporting line, direct reports, 200 colleagues, upcoming birthdays & anniversaries, their own and their team's requests, punches, documents | read from the server on demand |
| Admin / Super Admin | ~2,000 people (the reporting line, everyone with something waiting for them, the first people of the directory, celebrations), requests waiting on them, 7 days of punches | **Enterprise data** screens page through the full company |

Every change the app makes is sent to the server as a small **record-level patch** (only what changed), checked per
role and written to the right table. Shared documents (settings, policies) are merged **under a row lock**, so two
admins saving different parts never overwrite each other.

**Company-wide screens** (Enterprise data — visible only on the server):

| Screen | How |
|---|---|
| Whole company at a glance (dashboards) | materialised view `mv_headcount`, refreshed every 5 min + 60 s cache |
| Employee directory | keyset paging (no `OFFSET`), trigram name search, code-prefix index, streaming CSV export (`COPY … TO STDOUT`) |
| Approvals at scale | partial index on `pending_with`; approve / reject up to 5,000 at once |
| Payroll for all | computed **inside PostgreSQL**, 1 lakh payslips per statement, in a background job; bank advice file streamed |
| Bulk import | CSV → `COPY` into a temp table → one `INSERT … ON CONFLICT` |
| Database health (Super Admin) | table sizes, cache hit %, connections, partitions, API p50/p95/p99 per endpoint |

---

## 3. Schema

`server/db/migrations/` (applied in order, each once, under an advisory lock).

| Table | Rows at 10 lakh | Design |
|---|---|---|
| `employees` | 10 lakh | typed columns for everything searched or filtered + `doc jsonb` (the app's full record); indexes: login (unique), manager, status+name, department+status+name, company+location, **trigram search**, code prefix, birthday & anniversary expressions, name and joining-date sort |
| `accounts` | admins + Super Admins | secrets (`password_hash`, `security_pin_hash`, `mfa_secret`) never leave the server |
| `punches` | ~4.4 crore / month | **monthly RANGE partitions** + BRIN on time |
| `attendance_daily` | ~2.6 crore / month | monthly partitions; rolled up nightly from punches + approved leave |
| `requests` | lakhs / month | monthly partitions; `pending_with` (manager code or `role:admin`) drives every inbox |
| `payslip_batches`, `payslips` | 10 lakh / month | payslips partitioned by pay month |
| `notifications`, `audit_log` | crores | monthly partitions; audit is **append-only** |
| `entity_records` | everything else (goals, BGV, documents, tickets, chat, contracts, …) | one row per record, **HASH-partitioned ×16** |
| `tenant_docs` | settings-style documents | patched under a row lock |
| `jobs` | background work | claimed with `FOR UPDATE SKIP LOCKED` — run any number of workers |
| `auth_sessions`, `auth_challenges` | sign-in | revocable sessions; one-time codes stored hashed |
| `code_counters` | per company | next free `EMPnnn` |

Partitions are created 24 months back and 3 months ahead, and nightly by the worker. To archive, `DETACH PARTITION`
old months and move them to cheap storage.

**Multi-company isolation.** Every table carries `tenant_id` and every key starts with it. The API filters by
`tenant_id` in code; **row-level security** policies (`tenant_isolation`) also limit any other database login
(BI tools, analysts) to one company after `SET app.tenant = '<id>'`. A read-only `ezy_reporting` role is created.

---

## 4. Security

* Passwords and the Super Admin PIN: **scrypt** with a salt per user; records imported from the browser edition are
  upgraded on first sign-in. Lock-out after the company's `max_failed_attempts`.
* Admins need a one-time code; the Super Admin needs a one-time code **and** the security PIN. `DEMO_OTP=1` (tests
  only) returns the code in the response — never set it in production.
* Session tokens are signed (HS256), expire (`TOKEN_HOURS`, default 12) and are tied to a server session row, so
  sign-out and password change revoke them (within 30 s across instances).
* Role checks on every write: employees can change only their own record (pay, status, manager, bank and
  similar fields are protected), their own and their team's requests; only admins change company settings; only the
  Super Admin creates admins; nobody deletes audit entries.
* Employees never receive colleagues' salary, bank, PAN/UAN or personal contact details.
* Rate limits on sign-in (per IP) and AI (per user). The Claude key stays on the server (`/api/ai`, signed-in only).
* Cancelled downloads cancel their database query (no leaked connections).

---

## 5. Measured performance (10 lakh employees)

Test machine: **2 vCPU, 7 GB RAM**, PostgreSQL 16 and the API on the same box, load generator also on the same box
(so real servers do better). Data: 10,02,000 employees · 2.67 crore attendance days · 3 lakh requests · 5 lakh
notifications · 10 lakh audit rows · ~10 GB.

| Operation | Result |
|---|---|
| Payroll for the whole company (9,91,689 payslips, LOP, PF, ESI, PT, TDS) | **96 s** in the background |
| Sign-in data load — employee / manager | **0.09 – 0.13 s** (1.9 MB JSON, ~170 KB compressed) |
| Sign-in data load — HR admin / Super Admin | **0.36 – 0.48 s** |
| Load 10 lakh test employees + a month of attendance | 4 min 12 s |

Load test, 50 concurrent users, 12 s per scenario (`npm run bench` in `server/`), **0 errors**:

| Scenario | Requests / s | p50 | p90 | p99 |
|---|---:|---:|---:|---:|
| Dashboard headcount (10 lakh) | 12,662 | 3 ms | 4 ms | 15 ms |
| Employee directory — first page | 2,593 | 18 ms | 26 ms | 37 ms |
| Directory — department filter | 1,567 | 30 ms | 41 ms | 51 ms |
| Employee profile lookup | 3,450 | 13 ms | 20 ms | 27 ms |
| Punch in (write) | 4,560 | 10 ms | 15 ms | 21 ms |
| Approvals inbox (2,000+ pending) | 144 | 326 ms | 434 ms | 636 ms |
| Directory — name search (common names) | 63 | 685 ms | 1.1 s | 1.2 s |
| Employee app start (full data load) | 18 | 1.05 s | 1.2 s | 1.3 s |

### Sizing for production

The busiest moment is the morning: people opening the app and punching in.

| Employees | API servers | Database | Notes |
|---|---|---|---|
| up to 50,000 | 1 × 4 vCPU | 4 vCPU · 16 GB · SSD | one box is enough |
| 50,000 – 2 lakh | 2 × 4 vCPU behind a load balancer | 8 vCPU · 32 GB | PgBouncer |
| 2 – 10 lakh | 4 – 8 × 4 vCPU | 16 vCPU · 64 GB · NVMe | PgBouncer, 2+ workers, a read replica for reports / BI |
| 10 lakh + / many companies | autoscale API | 32 vCPU · 128 GB, or one database per region / large customer | detach and archive old partitions |

Rule of thumb from the test machine: one 2-vCPU API server handles **~18 full app starts per second (~65,000 an
hour)** and **~4,500 punches per second**; add API servers for more (they share nothing but the database).

---

## 6. Run it

### Docker (recommended)

```bash
cp server/.env.example .env      # set POSTGRES_PASSWORD, JWT_SECRET, SITE_URL …
docker compose up -d             # PostgreSQL 16 + PgBouncer + API + worker
docker compose exec api node db/create-company.mjs --tenant acme --name "Acme Pvt Ltd" --country IN \
     --owner "Priya Shah" --email priya@acme.in --password "Strong@Pass1" --pin 482913
```

Open `http://<server>:8080` (put HTTPS in front with your load balancer / nginx / Caddy).

### Without Docker

```bash
npm install && npm run build                       # web app → dist/ (+ SEO pages, sitemap)
cd server && npm install
export DATABASE_URL=postgres://user:pass@host:5432/ezyhr JWT_SECRET=$(openssl rand -hex 32)
npm run migrate
node db/create-company.mjs --tenant acme …        # your company + Super Admin
npm start                                          # API + web app on :8080 (runs a worker inline)
npm run worker                                     # optional extra workers (set WORKER_INLINE=0 on API servers)
```

Demo and test data: `npm run seed:demo` (the demo company), `npm run seed:scale -- --employees 1000000`
(10-lakh test company, ~4 min, ~8 GB).

### Mobile apps

Build as before (`npm run android` / `npm run ios`). In the app: **Sign in → Connect to a server** → enter your
server address once. Or build with `VITE_API_URL=https://hr.yourcompany.com`.

### Settings (environment)

| Variable | Default | |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL (through PgBouncer for API servers) |
| `JWT_SECRET` | — | **required in production**, 32+ random characters |
| `SITE_URL` | request host | public address for canonical URLs / sitemap |
| `PG_POOL_MAX` | 20 | connections per API process |
| `TOKEN_HOURS` | 12 | session length |
| `WORKER_INLINE` | on | run a worker inside the API process |
| `AUTO_MIGRATE` | on | migrate at API start (off behind PgBouncer — the worker does it) |
| `ALLOW_SIGNUP` | 0 | let the pricing page create companies |
| `ANTHROPIC_API_KEY` | — | Claude for AI features |
| `WS_EMPLOYEES_ADMIN` / `WS_EMPLOYEES_EMP` | 1500 / 400 | working-set size |

### Operations

* **Backups:** `pg_basebackup` + WAL archiving (point-in-time recovery), or your cloud's managed backups. Test a
  restore monthly.
* **Monitoring:** `/ready` (database reachable), `/api/v1/admin/metrics` (p50/p95/p99 per endpoint),
  Super Admin → Enterprise data → Database health.
* **Retention:** detach `punches_YYYY_MM` / `audit_log_YYYY_MM` partitions older than your policy and archive them.

---

## 7. Known limits

* Screens outside **Enterprise data** work on the working set. On a 10-lakh company, lists such as the classic
  employee database show the loaded people with a note; use **Enterprise data → Employee directory** for everyone.
  Counts that matter (billing, dashboards) use the whole company.
* Cached shared settings may be up to 30 s old on *other* API servers after a change (the server that took the change
  clears its cache at once).
* Changes made by others appear in your inbox and notifications within a minute; other screens refresh at the next
  sign-in or page reload.
