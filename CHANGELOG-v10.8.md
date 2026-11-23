# EZY HR · v10.8.0 — Database edition (10,000 to 10 lakh+ employees), one-login start, SEO

Same app, same screens, same build. Opened from the EZY HR server it runs on PostgreSQL; opened anywhere else it is the
browser edition exactly as before. Full guide: **DATABASE.md** · test cases and results: **TEST-CASES.md**.

## Database edition
- **PostgreSQL 16 schema** for 10 lakh+ employees per company and many companies per server (`server/db/migrations`):
  - **Partitioning:** monthly partitions for punches, daily attendance, requests, payslips, notifications and audit; a 16-way hash partition for every other module.
  - **Indexes:** trigram search, code prefix, approver inbox, and birthday and anniversary.
  - **Statistics:** a materialised headcount view feeds the dashboards.
  - **Isolation:** row-level security for BI logins.
- **API server** (`server/`, Fastify):
  - **Sign-in:** scrypt passwords, OTP for admins, OTP + PIN for the Super Admin, lock-out, and revocable sessions.
  - **Data handling:** role-checked sync of the app's changes, record-level merges under row locks, and automatic new codes when two admins add people at once.
  - **Background jobs:** a job queue for payroll, attendance roll-ups and statistics.
  - **Bulk data:** streaming CSV export and COPY-based import.
  - **AI and monitoring:** signed-in-only AI proxy, plus health and metrics endpoints.
- **The app loads a working set, not the whole company:**
  - **Employee:** 0.1 s to load on 10 lakh.
  - **Super Admin:** 0.4 s.
  - **Saving:** every change is saved to the server as a small patch.
  - **Updates from others:** approvals and notifications from other people arrive within 30 s.
- **New menu, Enterprise data (server only):**
  - **Whole-company views:** company-wide headcount, an Employee directory over everyone (search, filters, CSV export), and Approvals at scale (approve or reject up to 5,000 at once).
  - **Bulk work:** Payroll for all (computed inside the database: **9,91,689 payslips in 96 s**, with a bank advice file), and Bulk import.
  - **Monitoring:** Database & performance (Super Admin).
- **Workspace ID** on the sign-in page; **Connect to a server** for the mobile apps or another host.
- Plan & billing counts the whole company's headcount; large lists say how many people are loaded and link to the directory.

## One Super Admin login creates everything
- `server/db/create-company.mjs` makes a new company with **one** sign-in, its Super Admin, plus EZY HR's standard set-up.
- **Creating people:** the Super Admin creates admins (Users & access → Create admin) and employees (Employee database → Add employee, or Bulk import) in the existing screens.
- **First sign-in:** each new person signs in with a temporary password and sets their own.
- **Demo shortcuts:** shown only in the demo workspaces.

## SEO
- **Public pages:** real, crawlable pages at `/`, `/pricing/`, `/contact/`, `/service-desk/` and `/login/`. Each has its own title, description, canonical URL, Open Graph and Twitter tags, and readable content.
- **Structured data:** JSON-LD for the Organization, WebSite, SoftwareApplication (with the three INR plans), breadcrumbs and FAQ.
- **Crawler files:** `robots.txt` and `sitemap.xml`. The site address is filled in per request by the server, or with `SITE_URL` at build time.
- **Signed-in screens:** every screen has its own title (e.g. "Leave & holidays · Calendar & tasks · EZY HR") and description, and is marked `noindex`.
- **Faster loading:**
  - The signed-in app loads only after sign-in, and the Excel and Word generators load only when used.
  - Fonts no longer block the first paint, and hashed build files are cached for a year.
  - `SINGLE_FILE=1` keeps the old one-file build.
- **Lighthouse on /pricing/:** SEO **100**, accessibility 96, best practices 93, performance 86 (LCP 1.4 s).

## Fixes found by the 10-lakh tests
- **Duplicate code:** the IT admin's employee record clashed with Divya Menon on EMP013. Ravi Teja is now EMP016 (existing browsers are fixed on load).
- **Missing joining date:** Salary loan access crashed for an employee without a joining date.
- **Missing expense lines:** the inbox crashed on expense requests without expense lines.
- **Offline cache:** the service worker could cache a public page as the app's home page.
- **Server-side fixes:**
  - A cancelled CSV download left its database query running.
  - The changes check behind the app's 30-second refresh failed on a timestamp type.
  - Five slow queries were found and fixed:

    | Query | Before | After |
    |---|---|---|
    | Department list | 981 ms | index |
    | Directory first page | 1.1 s | 0.3 ms |
    | Common-name search | 1.8 s | 0.12 s |
    | Code search | 279 ms | 3 ms |
    | Super Admin data load | 1.35 s | 0.31 s |

## Tests
- **Automated API tests:** 39 pass (`node --test server/test/`), covering sign-in, privacy, sync rules, concurrency, isolation and 10-lakh scale.
- **Screen crawls:** every screen for 7 roles opened with 0 errors — 272 in the browser edition, 272 on the demo company and 272 on the **10-lakh company**.
- **Load test** (50 concurrent users, 0 errors):
  - **Punches:** 4,560 per second.
  - **Profile lookups:** 3,450 per second.
  - **Dashboard statistics:** 12,662 per second.
