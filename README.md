> **v10.13 — Dropdown lists & forms.** Super Admin → *Dropdown lists* shows all 350 dropdowns. Values can be added with **+**, and admins can add to their own lists.
> Employees get *Requests & forms*: work from home, travel, overtime, letter and grievance. The sign-up page has a *Why EZY HR* comparison panel. See **[CHANGELOG-v10.13.md](CHANGELOG-v10.13.md)**.

> **v10.15 — Dropdowns.** Every employee-form dropdown is matched to Dropdown lists (13 grow with +, 5 master-data dropdowns get + Add new in place). The Super Admin can **Create a dropdown** that appears on the employee form, profile, Field reference and export. See **[CHANGELOG-v10.15.md](CHANGELOG-v10.15.md)**.

> **v10.14 — Legal entity everywhere.** Every report has a Legal entity filter and column, every CSV export names its entity, and the requisition and asset forms have a Legal entity dropdown. See **[CHANGELOG-v10.14.md](CHANGELOG-v10.14.md)**.

> **v10.12 — Approval chains.** Every request type offers all six standard chains, and **+ Add approval chain** builds your own (Reporting manager / Module / IT / HR / Finance admin, in any order). See **[CHANGELOG-v10.12.md](CHANGELOG-v10.12.md)**.

> **v10.11 — Approval workflows.** New *Asset purchase request* (Reporting manager → IT admin → HR admin → Finance admin) and *IT support* approval (Reporting manager → IT admin).
> Creating an admin sets up their approval steps automatically, and existing chains are unchanged. See **[CHANGELOG-v10.11.md](CHANGELOG-v10.11.md)**.

> **v10.10 — Clean start + AI actions.** The app now starts with only the Super Admin (Praveen Kumar M, `praveen.kumar@peoplehub.demo` / `Points@2026` / PIN `4321`).
> Type what you want in **Ask AI**, for example *"Create employee Ravi Kumar ravi@acme.in as Sales Executive"*. The AI shows a preview card, and **Confirm** saves it.
> See **[CHANGELOG-v10.10.md](CHANGELOG-v10.10.md)**. The demo accounts below exist only in the server test fixture (`npm run seed:demo`).

> **v10.8 — Database edition.** The same app now also runs on PostgreSQL for 10,000 to 10 lakh+ employees per company,
> starting from one Super Admin login. See **[DATABASE.md](DATABASE.md)** (set-up, scaling, security) and
> **[TEST-CASES.md](TEST-CASES.md)** (10-lakh test cases and results).

# Ezyo HRMS v10.6 — see CHANGELOG-v10.6.md · v10.3 — everything made ezy · AI-enabled HRMS (web, iOS, Android) · v10.2 — companies & locations, expense hub · v10.0 — all-in-one HR & payroll · v8.8 · v8.7 · v8

### v10.3 — Ezyo: local entities & tax, worker-type self-service, Finance/HR lenses, granular AI automation, mobile apps

Nothing was removed: every v10.2 screen and option is still there. Changes are modifications and additions.

**1. Frozen defaults by legal entity and location.** An employee's *country*, *currency* and *tax engine* now follow the
work location they are registered at (the company follows the location, as before). In the employee form the Country field
shows "locked to location" with the currency; moving someone to another location moves their country and currency with
them. The header language control is a dropdown that defaults to **English** and lists the local languages of the person's
location (AI translates every word on screen when a live Claude connection is set; the choice is remembered).
Super Admin can switch the lock off under *Payroll entities → Frozen defaults*. Browsers holding older data are aligned once.

**Language without any connection.** The header language dropdown shows **English (default)** first, then the local
languages of the selected company / location (Dubai office → Arabic, Hindi, Urdu; an employee sees their own work
location's). 18 languages are built in (`src/country/i18nOffline.js`: Hindi, Telugu, Tamil, Kannada, Marathi, Bengali,
Arabic, Urdu, French, German, Spanish, Portuguese, Malay, Indonesian, Filipino, Swahili, Afrikaans, Chinese) and translate
the sidebar, headings, buttons, statuses and common labels with no internet or AI connection; the choice is remembered.
With a live AI connection, everything else on screen is translated as well. Each location's local language is set under
*Payroll entities → Frozen defaults*.

**2. Payroll by registration — every possibility.** *Payroll entities & tax registration* (`/payroll-entities`, Finance, HR
with payslips/accounts, Super Admin):
- Per company choose **Central** (one payroll under the company registration; all locations roll up), **Location-wise**
  (every location registered on its own — TAN, PT, ESIC sub-code, S&E licence, PAYE ref… — runs its own payroll, bank file,
  challans and returns) or **Hybrid** (registered locations run their own; unregistered ones roll up into head office).
- *Registration modes* simulates all three for each company (payroll runs per month, registration gaps) and marks the one
  the AI suggests. A location in another country than its company always runs a local payroll in local currency
  (branch / PE), or is flagged "needs local registration or EOR".
- *Payroll groups* lists every group the setup produces with registration numbers, authorities and gaps; registration
  numbers are edited per country (India TAN/PF/ESIC/PT/LWF/S&E, UK PAYE/AO ref, US EIN/state/SUI, IE, DE, FR, CA, MX, BR,
  AE, SA, SG, ZA, generic elsewhere).
- *This month by group* splits the payroll run by group in local currency (gross, income tax / TDS, social, net) with a bank
  file per group.

**3. Local taxes, TDS and payslips.** *Generate payslips → From payroll* now covers every country: India from the India
engine (PF, ESI, PT, TDS, LWF), everyone else from their own engine in local currency with the engine's own line names
(PAYE, NIC, CPF, Lohnsteuer, PPh 21…). The payslip header shows the employee's own legal entity, location and its
registration numbers; India-only identifiers are left off foreign payslips. Employees see their payslip totals in their
currency. New components: `GROSS_PAY`, `SOCIAL_EE`, `LOCAL_TAX`, `OTHER_DED`.

**4–5. Contract & freelance self-service.** For worker types in `settings.restricted_worker_types` (default contract and
freelance): *My pay & payslips*, leave balances / stats and *My spend card* are removed; *Leave* becomes **Request leave**
(request form + my requests only). *Benefits & wellness* is removed too, except for long-term workers whose engagement
(earliest of joining date and contract start) is longer than `settings.long_term_days` (365). Demo: Arjun (contract,
< 1 year), Rohan (freelance), **Pooja Iyer (contract > 1 year — keeps benefits)**.

**6. Logo and tagline.** Ezyo logo with "everything made ezy — AI-enabled HRMS" on sign-in, the sidebar, page footer,
browser title, PWA and native app icons and splash screens (`src/data/ezyoLogo.js`, `public/brand/`, `assets/`).

**7. Finance admin.** Finance (payroll / expense modules without HR accounts) sees only finance, payment and
attendance-for-pay screens: people/collaboration extras (meetings, PeopleXP, org chart, learning library, workforce
intelligence…) are hidden; *Time & attendance* is granted for pay inputs; the dashboard shows payroll groups instead of the
live-location map and the AI brief leaves out hiring, calls and productivity.

**8. HR sees all activities.** HR admins get an *Oversight · all activities* group: **All activities** (`/activity`, one
timeline of the audit trail, requests, punches and AI actions across every module — including Finance's — with
filters, export and an AI digest) and **All requests** (every request in every module, read-only). Super Admin has both.

**9. Look & feel.** Palette moved to the logo colours — dark `#15414F`, light blue `#1E9BD7`, teal `#0B8C8C` / `#006285`,
mint `#0FFCBE` (build-time re-skin in `brand/ezyoBrandPlugin.mjs`, tokens in `src/country/brand.js`).

**10. Granular AI automation** (`/automation`). 14 rules in six groups, each with **Auto / Review / Off** and its own
thresholds: approve short leave within policy, approve small receipted expenses, clock-out reminders, repeated-lateness
check-ins, payroll pre-check from the 20th, payslip-release reminders, payroll registration gaps, country/currency
alignment, statutory filings due, contract end, benefits eligibility after a year, probation reviews, overdue BGV and
onboarding documents. The engine runs on sign-in and every 5 minutes; Review items wait in a one-tap queue; everything
the AI does is logged, written to the audit trail and shown in All activities. Super Admin can pause it organisation-wide.

**3. Web, iOS and Android.** One code base: installable PWA (manifest, service worker, offline shell, app shortcuts) and
Capacitor projects in `android/` and `ios/` (app id `com.ezyo.hrms`, location/camera permissions for GPS and selfie
punches). Phones get an app-style bottom bar. See `MOBILE.md`.

Files: `src/lib/statutory.js`, `src/lib/automation.js`, `src/lib/mobile.js`, `src/store/statutoryActions.js`,
`src/store/automationActions.js`, `src/pages/suite/PayrollEntities.jsx`, `src/pages/suite/AutomationCentre.jsx`,
`src/pages/suite/ActivityCentre.jsx`, `src/components/ai/AutomationRunner.jsx`, `src/data/ezyoLogo.js`,
`capacitor.config.json`, `android/`, `ios/`, `public/manifest.webmanifest`, `public/sw.js`, `public/brand/`, `assets/`;
changed: `roleNav.js`, `PortalShell.jsx`, `PeopleHubApp.jsx`, `AppStore.jsx` (migration v10.3), `seed.js`, `entities.js`,
`payslipFields.js`, `payslipDesign.js`, `PayslipViews.jsx`, `payslipActions.js`, `entityActions.js`, `LeavePage.jsx`,
`EmployeeGlassHome.jsx`, `OpsGlassHome.jsx`, `PeopleXP.jsx`, `ApprovalsPage.jsx`, `AllRequests.jsx`, `EmployeeMaster.jsx`,
`FieldInput.jsx`, `AiPageLocalizer.jsx`, `LoginPage.jsx`, `Coverage.jsx`, `brand.js`, `ezyoBrandPlugin.mjs`, `index.html`.


### v10.2 — Company & location segregation, and the expense hub

**Companies & locations.** Every employee now belongs to a **company** (legal entity) and a **location** (office, branch,
warehouse…). Six companies and 24 locations are seeded (ONAS India with Hyderabad HQ, Nizampet branch and Shamshabad
warehouse; ONAS UK & Europe; Americas; Middle East; Africa; Asia Pacific). Admins and the Super Admin get a
**Company · Location** picker in the header, next to the country picker. Choosing a company or a single location narrows
the *whole application*: the store hands every page a scoped copy of the data (employees, every record that carries an
`employee_code`, maps keyed by employee code, geofences, and records stamped with a company / location), so people, approvals,
attendance, live location, payroll, payslips, contracts, expenses, analytics and reports all follow it without page changes.
Records that point at people or sites under other fields follow it too: assets (holder, else site), biometric devices (site),
IT tickets (requester), job openings (location, else hiring manager) with their candidates, interviews, notes and offers,
succession plans (incumbent), feedback (giver or receiver), clients, events and meetings (owner / organiser), and
compliance items and exits (country). A record with no such link — an unassigned item with no site, a hand-typed offer —
stays visible in every scope.
Actions still work on the full data. **Companies & locations** (`/companies`) lists entities and locations with headcount
and payroll, lets the Super Admin add or edit them, lets HR move staff between locations (the company follows the location),
and has **Admin access**: limit an admin to some companies or locations, after which they see only those and the header picker
offers only those. The employee form has *Company* and *Location* fields; new requests are stamped with both.

**Background verification – tracking content.** The BGV module itself is unchanged; its demo cases now carry what HR
captures while tracking them. Every check has its stage and a dated tracking log; *Document verification* has its
checklist (Aadhaar, PAN, passport, degree, mark sheets, relieving letter, payslips, last offer letter) with per-document
status; *PF / UAN (EPFO)* has UAN, establishment, member ID, contribution dates and the EPFO-vs-declared result; *Address*
has method, field agent, visit date, outcome, respondent, staying-since and geo-tag; *Previous-employer official email*
has the employer, HR contact, official-domain email, sent / response dates and the response. Three candidate cases show
the overall statuses the employee cases did not: **Started** (Kavya Menon), **On hold** (Arjun Nair) and **Under HR
review** (Sameer Ali, with a PF "not applicable" and a reference "unable to verify"). Browsers holding older data get the
same content on next load; checks HR has already worked on are left as they are (`src/data/seedBgvTracking.js`).

**Expense hub** (`/expense-hub`, Finance with the expense / advance / payroll module, and Super Admin) brings in employee
expenses, company-paid travel-desk bookings, corporate-card spends and advances from other apps — SAP Concur, Zoho Expense,
Expensify, Happay, Fyle, Rydoo, Navan, MakeMyTrip myBiz, Uber for Business, American Express Corporate, Ramp, Oracle NetSuite,
Microsoft Dynamics 365 and Tally Prime — or from a CSV file / the API.
- Records are matched to an employee by code, then work email, then name, converted to ₹ at the stored FX rate (the original
  currency is kept) and booked to that employee's company and location. They become normal PeopleHub expense / advance
  requests, so they show in *All approvals*, the employee's *Expenses & travel* page and payroll.
- Per app: *keep the decision made in the other app* (approved → Approved, reimbursed → Paid) or *send everything to Finance*.
  Re-syncs are de-duplicated by app + external ID and pick up status changes (the approval chain is updated too).
- **Duplicates across apps** (same person, date and amount already in PeopleHub) are flagged and held for Finance.
- **Third-party expenses**: spends for people not on the employee master (agency staff paid through their vendor,
  consultants' firms, facility partners) are booked against a company and location. Agency, contract and freelance workers
  who *are* on the master are shown as "Third-party / contingent" in the register.
- **Exceptions**: records that match no employee wait here to be mapped to an employee, booked as third-party, or dismissed.
- Tabs: *By company & location* (split by company, location, source app, or employees vs third party, with export),
  *Register* (filters, CSV export with cost centres), *Connected apps* (connect, sync, landing mode, hourly sync, category
  mapping), *Import file* (template, preview, validation), *Third-party*, *Exceptions*, *Sync log*.

CSV columns: `external_id, kind, employee_code, employee_email, employee_name, date, category, description, amount, currency,
title, purpose, project, status, paid_by, vendor, receipt_name, company_id, location_id`. `kind` is expense, advance, card,
travel or third_party. Lines with the same `external_id` become one claim.

API (server to implement): `GET/POST /api/v1/companies`, `GET/POST /api/v1/locations`, `PUT /api/v1/admins/{code}/entity-scope`,
`POST /api/v1/expenses/import` (same columns as the CSV, JSON array), `POST /api/v1/expense-apps/{app}/connect|sync|disconnect`,
`GET /api/v1/expenses/register?company_id=&location_id=`. In this front end the provider calls are simulated by `demoFeed`.

Files: `src/data/entities.js`, `src/lib/expenseHub.js`, `src/store/entityActions.js`, `src/components/EntitySwitcher.jsx`,
`src/pages/superadmin/CompaniesLocations.jsx`, `src/pages/suite/ExpenseHub.jsx`; changed: `AppStore.jsx` (scope, migration
v10.2), `seed.js`, `employeeFields.js`, `FieldInput.jsx`, `EmployeeMaster.jsx`, `ProfilePage.jsx`, `Requests.jsx`,
`ExpensesPage.jsx`, `PortalShell.jsx`, `PeopleHubApp.jsx`, `roleNav.js`, `Coverage.jsx`. Browsers holding older demo data are
migrated automatically (every employee is given the company and location of their country / city).

### v10.1 — Inbox & notifications in one place

One sidebar item, **Inbox & notifications**, for every role, with two tabs: **Inbox** (employees: team approvals + my
requests; admins: approvals for their modules; Super Admin: requests needing sign-off) and **Notifications** (with
mark-all-read and unread filter). The sidebar badge adds both counts. `/inbox` and `/notifications` both still work and open
the matching tab, so the bell, notification links and AI shortcuts are unchanged. File: `src/pages/inbox/InboxHub.jsx`.

### v10.0 — All-in-one HR & payroll: Payroll Agent, compliance autopilot and everything around it

v10 closes every gap in the "simple all-in-one HR and payroll" checklist without changing the existing design or removing
any feature. New screens use the same layout as the reference modules (header → tab row → AI brief strip with one-tap
actions → KPI tiles → cards) and the Ezyo palette. Super Admin → **Feature coverage** (`/coverage`) maps every checklist
point to its screen and lists what each role gets. Full list: `FEATURE-COVERAGE.md`.

| Area | Screens (route) | Who |
|---|---|---|
| **Payroll Agent** | Run (`/payroll-agent`) · Variable pay (`/variable-pay`) · Bank payouts (`/payouts`) · Filings & year-end (`/filings`) · Global & FX (`/global-payroll`) | Finance, Super Admin |
| **Compliance autopilot** | Health (`/compliance-autopilot`) · Deadlines & alerts (`/compliance-alerts`) · Rule updates (`/rule-updates`) · Audit pack & trail (`/audit-pack`) · Data privacy (`/privacy-center`) | Finance, HR (compliance), Super Admin |
| **Offboarding** | Exits & F&F settlement (`/exits`) · Resignation & exit (`/my-exit`) | HR, Finance, Super Admin · Employee |
| **Time** | Live board (`/live-board`) · Shift roster (`/shifts`) · Timesheets → payroll (`/timesheets`) · Leave rule-sets, 52 controls (`/leave-rules`) · My shifts (`/my-shifts`) | HR, Finance, Super Admin · Employee |
| **People experience** | PeopleXP — feed, recognition, pulse, vouchers, insights (`/people-xp`) · Mobile app (`/my-app`) | Everyone |
| **Global & spend** | Global hiring — EOR, CoR, contractors, cost calculator (`/global-hiring`) · Relocation & visas (`/relocation`, `/my-relocation`) · Spend cards (`/spend-cards`, `/my-card`) | Finance, HR, Super Admin · Employee |
| **Platform** | Integrations & API (`/integrations`) · Workforce intelligence (`/insights`) · Setup & data import (`/setup`) · Plan & billing (`/billing`) · Security & backups (`/security`) · Expert support (`/expert-support`) · Privacy & my data (`/my-privacy`) | Super Admin, Finance · Employee |

India payroll now also deducts **Labour Welfare Fund** (Telangana, Karnataka, Maharashtra) and pays **hourly, bonus and
commission** through the engine. All v10 data lives in `data.suite` (`src/data/seedSuite.js`); every change goes through
`suiteDo()` in `src/store/suiteActions.js`, which checks the role / module and writes the audit log.

Files: `src/pages/suite/*` (PayrollAgent, ComplianceAutopilot, Exits, Workforce, LeaveRules, PeopleXP, GlobalTeams, Platform,
Coverage), `src/components/suite/Hub.jsx`, `src/lib/suitePayroll.js`, `src/store/suiteActions.js`, `src/data/seedSuite.js`;
changed `src/lib/payroll/in.js`, `src/data/roleNav.js`, `src/PeopleHubApp.jsx`, `src/components/PortalShell.jsx`, `src/store/AppStore.jsx`, `src/data/seed.js`.


v8 adds six modules on top of v7 without removing any feature. Every module uses generative AI (Claude) and still works
offline: each AI button computes an answer from your real data first, and the live model only writes the narrative.

| Module | Who | What it does |
|---|---|---|
| **Background verification** (`/bgv`, `/bgv-me`, `/team-bgv`) | HR admin (module `bgv`), Super Admin · employees · managers | Cases for employees and candidates with packages (Basic / Standard / Comprehensive / Leadership), vendors, TAT and due dates; **e-signed consent** before any check; per-check status (pending, in progress, insufficient, verified, discrepancy); document upload by the employee; reminders; close as Clear / Clear with remarks / Discrepancy (updates the employee master `background_check`, ticks the onboarding KYC task, notifies employee and manager); AI risk summary and AI document-request email. |
| **BGV status on employee screens** | — | BGV column in the People directory, the Employee master, the person dialog, a card on My profile, Team BGV status for managers, BGV in the applicant drawer. Shown only to people allowed to see it. |
| **BGV access & details** | Super Admin, BGV admins | Access levels **status / summary / full**; default rules (BGV admins full, recruiters see candidate status, managers see their team's status, employees see their own case without internal remarks); **time-bound grants with a reason**, revocation, and an access log — every case view is written to the audit log. |
| **Applicant tracking / recruitment** (`/recruitment`) | HR admin (module `recruitment`), Super Admin | Applicants with an explainable **AI match score** (skills, experience, pay vs budget, notice), AI shortlist, **fill applicant from pasted resume**, applicant drawer (stage moves, rating, notes, AI screening report, AI invite / rejection / offer-call emails, start BGV, prepare offer), **interviews** with AI slot finding for the panel, feedback scorecards that panel members fill in from their calendar, **job postings** with AI-written inclusive JDs and AI interview kits, and the original requisitions & funnel. |
| **Compliance calendar** (`/compliance-calendar`) | Admins with `compliance` or `payroll`, Super Admin | Month grid and list of every statutory filing from the 22 country payroll engines plus company labour-law, licence, policy and audit items and your own obligations; owners, overdue / due-soon tracking, mark filed with acknowledgement number and amount, not applicable, reopen; **.ics export** with 3-day reminders; AI compliance brief and AI filing checklist. Country / region filter follows the header country selector. |
| **Internal chat** (`/chat`) | Everyone | Company channels (#general, read-only #announcements, #hr-help), department channels, groups and DMs; @mentions (notify), reactions, attachments, unread badges; **AI smart replies**, **AI catch-me-up** summaries, Ctrl+J rewrite, and **/schedule** to book a meeting with the people in the conversation. Tabs of the same browser stay in sync. |
| **Client meetings** (`/meetings`) | Everyone | Client and internal meetings, clients list, AI agenda, **AI pre-meeting brief** (account, last meeting, open actions), notes → **AI minutes + action items** (owners notified), **AI follow-up email** to the client, action-item tracker. |
| **Calendar with AI scheduling** (`/calendar`) | Everyone | Day / week / month / agenda views of meetings, client visits, interviews, leave, team leave, holidays, compliance and BGV due dates and joinings; **Schedule with AI**: describe a meeting in plain words — the assistant parses it (rules offline, Claude when connected), checks every attendee's meetings, interviews, leave and public holidays, **working hours in each person's own time zone**, lunch and buffers, ranks the best slots, explains why, and books with invitations; AI week planner; focus-time blocks; .ics export. |

### v8.8 — Hours calendar, granular reports, Sahayog points removed

* **My hours (home)** replaces “Your week”: presets *Today, Yesterday, This week, Last week, This month, Last month* and a **Custom** calendar range picker.
  Shows **worked hours**, **system screen-off hours** (idle / locked time from activity data when the employee shares it; otherwise estimated breaks) and
  **total hours** (first in → last out), days present, average per day, late days and the change against the previous period, with a per-day stacked chart.
* **Report centre** for HR admins, Finance admins and the Super Admin (*Reports*): 34 row-level reports across workforce, time & attendance, leave,
  hiring & onboarding, talent, contract workforce, payroll & payslips, expenses & loans, benefits & assets and system & audit. Each report filters by
  period (presets or custom), department, location, country, worker type, status and free text; **groups** by any dimension with counts and subtotals;
  **drills down** into a group; sorts, chooses columns, totals, and exports CSV or prints. Admins see only reports for their modules and only employees in
  their org-unit scope (HR: 21 reports, Finance: 15, Super Admin: all incl. approvals turnaround, audit log, sign-ins and user access). Catalogue: `src/lib/reports.js`.
* **Sahayog points removed** from the whole application (pages, menus, approvals, inbox, dashboards, policies, reports, admin modules).
* **Finance admin** (payroll, expenses, loans …) no longer has the IT service desk or background verification; open IT tickets move to the Super Admin.
* **Country space** is the menu and page name for everyone (was “Country workspace” / “My company info”).
* **My assets**: the *Raise IT ticket* buttons are gone from the assets tab; tickets are raised from the IT support tab.
* Browsers holding older data are upgraded automatically (`migrateV88`).

### v9.0 — One country selector drives the whole app

The **Country** dropdown in the header is now the only country picker. Choosing a country (e.g. India) hides the per-page country chips
(Local policies & compliance, Run payroll, Live location, Geofences) and aligns every screen to it: dashboards and all module pages,
the employee database, People / Org chart, approvals, contract management and every report (the report "Country" filter is hidden).
Page eyebrows show the selected country. With **All countries** the chips come back; with a **region** they list only that region's countries.
Employees always see their own country. Implemented with `useCountryFilter()` and `useCountryChoice()` in `src/country/CountryContext.jsx`.

### v8.9 — Screen-off time claims

On **Home → My hours**, *Claim screen-off time* lets an employee say they were working while the screen was off or locked (meeting, call,
training, field work, offline work, system issue): pick a day with unclaimed screen-off time, the hours / minutes (optionally from–to),
a reason and what they worked on. The claim (`SOF-…`, request type `screenoff`) goes to the **reporting manager** (HR admin with the
attendance module when there is no manager) in Inbox → Team approvals with AI review. When approved, the time moves from screen-off into
**worked hours** for that day everywhere hours are shown (My hours, the Worked, screen-off & total hours report). Pending claims show as
"awaiting manager"; claims can be withdrawn while pending; you cannot claim more than the unclaimed screen-off time of the day or beyond the
correction window. New report: *Screen-off time claims*. Fix: the approvals screen no longer crashes on the removed points request type.

### v8.7 — Worker types, contract management and customisable payslip designs

**1 · Worker types drive the employee form** (SAP SuccessFactors *employee class* / Oracle HCM *worker type & assignment category*).
The employee form opens with choice cards: **Permanent, Contract (fixed term), Freelancer, Consultant / independent contractor, Agency worker, Intern, Temporary, Apprentice**.
The type decides which tabs and fields appear and which are required (`workers` / `requiredFor` in `src/data/employeeFields.js`): contingent workers get a
**Contract & engagement** tab (pay basis hourly / daily / monthly / milestone, rate, standard hours, overtime multiplier, how they are paid — payroll, self-billed
invoice or staffing vendor — vendor, GST / GSTIN, TDS section 192 / 194C / 194J, approver, PO / SOW, cost centre, renewal option, NDA); PF / UAN, grade,
probation, tax regime and leave policy appear only where they apply. Misclassification rules block, for example, paying a freelancer through payroll.
Monthly gross for contingent workers is the monthly equivalent of the contract rate, so CTC, budgets and analytics stay correct. Saving can create a draft contract.
The employee master gets a worker-type column and filter; the field reference shows *Applies to* per field; the profile shows only the sections that apply.

**2 · Contract management** (`/contracts` — admins with the new `contracts` module (HR, ADM01) or `payroll` (Finance, ADM02), and the Super Admin).
Modelled on SAP Fieldglass work orders and Oracle HCM contingent-worker assignments, integrated with payroll and payslips:

| Tab | What it does |
|---|---|
| **Overview** | Live contracts, contracts ending in 30 days, timesheets to approve, hours, last run cost, alerts, workforce mix, **AI contingent-workforce brief**. |
| **Contracts** | Register with budget burn, e-signature and alerts. Lifecycle: draft → **approval** (Finance or Super Admin; maker ≠ checker) → worker **e-signs** (typed name, NDA / IP acceptance) → **amend** (rate with effective date and rate history, extension, hours, budget, scope) · **renew** (linked contract, old one marked Renewed) · **hold / resume** · **terminate** (reason, last day). Printable contract from an editable clause template. **AI renewal advice** per contract. |
| **Timesheets & milestones** | Weekly timesheets (hours, overtime, task) submitted by workers, approved by the named approver or reporting manager (bulk approve / send back); milestones submitted and accepted for fixed-fee contracts. |
| **Contractor pay runs** | One run per month from approved timesheets, accepted milestones and pro-rated monthly fees (LOP aware). HR prepares → Finance approves → **Post**: contract employees and interns on payroll go into a **draft payslip run** (normal Finance → Super Admin → release flow, CONTRACT_PAY / hours / rate lines, PF / PT / TDS from the India engine); freelancers and consultants get **self-billed invoices** (GST, TDS 194J); agency workers go on the **vendor invoice** with markup (TDS 194C). Also under **Payroll → Contractor pay**. |
| **Invoices & payments** | To pay / overdue, record payment with UTR (worker gets a payment advice), cancel, CSV for bank / TDS. |
| **Staffing vendors** | Markup, payment terms, GSTIN, Contract Labour (CLRA) licence and expiry, MSME. |
| **Compliance** | Expiry (30 / 7 days), NDA and e-signature, budget 80 % / 100 %, co-employment (tenure ≥ 11 months, > 45 h weeks), repeated renewals, vendor licence, missing PAN / GSTIN, late approvals, missing timesheets. |
| **Settings** | Alert days, max hours, GST rate, payment terms, invoice prefixes, NDA / signature rules, who approves (Super Admin only), contract clause template with placeholders. |

Workers get **My contract** (contract & e-sign, renewal request, weekly timesheet grid with estimated pay, milestones, payments / payment advices);
approvers get **Contractor timesheets**. The regular payroll run and *Generate payslips* leave contingent workers to the contractor run.
Demo: Arjun Mehta EMP050 (hourly contract, expiring), Pooja Iyer EMP051 (monthly contract), Rohan Das EMP052 (freelancer, pending renewal),
Leela Krishnan EMP053 (consultant, milestones, unsigned NDA), Manoj Yadav EMP054 (agency via TeamStaff), Sana Sheikh EMP055 (intern). Bindu (EMP007) approves Arjun's timesheets.

**3 · Payslip design studio** (Payslips → **Payslip design**; HR with `payslips`, Finance with `payroll`, Super Admin — who can lock designs to Super Admins).
Six built-in layouts — **Classic** (company template), **Modern**, **Remuneration statement (SAP-style)**, **Pay advice (Oracle-style)**, **Compact**, **Minimal** —
or **upload your own format**: Word **.docx** (converted in the browser) or **HTML**; sample values next to recognised labels are replaced with `{{placeholders}}`
automatically (*Auto-map*), or with **Map with AI**; scripts are stripped and documents render in a sandboxed frame. An image of an old payslip can be used as a
background to trace; designs export / import as **.json**. Customise every colour (6 presets), font, size and weight, logo (size, position), letterhead, background,
watermark, sections, every label, employee fields (add, rename, reorder), signature, notes, footer, paper, margins, columns, borders, density, currency format,
account masking and extra CSS. Live preview with any employee's real payslip and YTD; save drafts, publish, 12 versions with restore.
**Assignment**: default, per worker type and per country; a design for payment advices, invoices and contracts. Employees see YTD figures on their payslip.

**Fix:** new employees were all given code EMP001 (the ID sequence ignored codes without a hyphen); `nextSeq` now reads trailing digits.

New files: `src/lib/contracts.js`, `src/lib/contractDocs.js`, `src/data/seedContracts.js`, `src/data/payslipDesign.js`, `src/store/contractActions.js`,
`src/store/payslipDesignActions.js`, `src/components/contracts/ContractViews.jsx`, `src/components/contracts/MyContract.jsx`, `src/components/pay/PayslipDesigner.jsx`,
`src/components/pay/DocFrame.jsx`. New dependency: `mammoth` (Word → HTML). New collections (added automatically to browsers holding v8.6 data):
`contracts`, `timesheets`, `contractRuns`, `contractInvoices`, `contractVendors`, `contractSettings`, `payslipDesigns`, `payslipDesignRules`.
GST / TDS rates and Contract Labour Act points are defaults to confirm with your tax and legal advisers.

### v8.6 — Payroll workspace (Keka-style)

The **Payroll** page (admins with the `payroll` module, Super Admin) is now a workspace with the same top-level tabs as Keka.
Run payroll is the existing country-engine run, unchanged.

| Tab | What it adds |
|---|---|
| **Payroll analytics → Analytics** | Pay-group picker (one per country, or all in ₹); *Last salary processed*, *Upcoming salary*, *Upcoming revisions (3 months)* and *Pending revisions* with **View employees** (apply pending revisions → master updated, arrears computed, employee notified); compensation summary by **department** and **location** for a chosen financial year; monthly cost (processed vs projected); where the payroll goes. |
| **→ Compensation planning** | Increment cycle: budget % of payroll, guideline % by performance rating (±2 pts for compa-ratio), editable per-person %, budget used, save draft, **finalise** → approved salary revisions. |
| **→ Budget estimation** | Next-FY cost by department from increment %, effective month, attrition/backfill, new hires and hire premium; CSV. |
| **→ Compare compensation cost** | Two departments / locations / grades / pay groups side by side; two months by department with variance. |
| **→ Employee competitiveness** | Compa-ratio, range penetration and market position (P25/P50/P75) per India employee; retention-risk flag for high performers paid under market. |
| **→ Geographical differentials** | Cost-of-living index, pay by location in ₹ and in Hyderabad terms, relocation calculator. |
| **Payroll admin** | Pay groups (cut-off, pay day, approver), salary components (incl. flexible-benefit components), pay bands & market data, locations index, perquisite valuation rules, payroll settings. |
| **Component claims** | Flexible-benefit claims queue (approve / reject with reason / mark paid with payroll), entitlement balance, FBP declarations per employee. |
| **Loans** | Loan register from disbursed loan requests: EMI schedule, recovered, outstanding, record prepayment, skip a month's EMI, foreclose; flag for interest-free loans above the exempt limit. |
| **Perks** | Perquisites (car, accommodation, concessional loan, gifts, club, ESOP, other) with monthly taxable value; flows into Form 16 / 130. |
| **Reports** | 14 CSV reports with preview: payroll register, bank transfer, PF ECR, ESI, PT, TDS, annual CTC, month-on-month variance, department cost, loans, claims, perquisites, revisions, competitiveness. |
| **Form 16 / 130** | Salary TDS certificate per employee: **Form 16** for FY 2025-26, **Form 130** from tax year 2026-27 (Income-tax Act 2025). Part A quarterly TDS, Part B computation, generate / publish (publishing opens after March), printable download, summary CSV. |

New files: `src/lib/payrollSuite.js`, `src/data/seedPayrollSuite.js`, `src/store/payrollSuiteActions.js`, `src/components/pay/suite/*`.
New data collections (filled automatically in browsers holding older data): `paySettings`, `salaryRevisions`, `compCycle`, `fbp`, `componentClaims`, `perks`, `loanLedger`, `taxCerts`.
Perquisite rates, pay bands, market percentiles and the city index are company defaults to confirm with your tax adviser / benchmarking provider.

### v8.2 — My documents (BGV & missing documents on the Documents page)

* **Employees – Documents → My documents** (shown above the existing document library, which is unchanged): the joining & statutory
  documents required for their country (from the country packs – e.g. PAN, Aadhaar, UAN, cancelled cheque, Form 11, Form F for India)
  with status *Missing / Submitted · HR reviewing / Verified / Re-upload needed*, HR's note and an Upload / Re-upload button; plus their
  **background-verification documents** per check (what HR asked for, files uploaded, Upload). BGV uploads go into the same BGV case as
  *My background check*, so both pages stay in step. "Only missing" filter; sidebar badge with the number of documents needing action.
* **HR (onboarding / BGV / accounts modules) and Super Admin – Documents → Employee documents**: queue of uploads to verify (preview,
  Verify, ask for a re-upload with a reason), list of employees with missing documents (joining, BGV and consent) with *Remind*.
  When every joining document is verified and the BGV identity & address checks are not waiting on the employee, the onboarding task
  **Documents & KYC verified** is ticked automatically. Every upload, decision and reminder notifies the other side and is audited.
* New files: `src/lib/empdocs.js`, `src/store/docActions.js`, `src/components/collab/MyDocuments.jsx`. API: `GET /api/v1/me/documents` ·
  `POST /me/documents/{type}` (upload, virus scan) · `POST /employee-documents/{id}/review` · `POST /employees/{code}/documents/remind`.

### v8.1 — IT support

* **My assets → IT support**: an *IT support* button in the header, *Get IT help* on each laptop / monitor / phone / SIM / headset card
  (the ticket is linked to that asset and shown on the asset), and an IT support section with service-desk contacts and your open IT tickets.
* **IT support page** (`/it-support`, employees and admins, like HR support): service-desk hours and SLA, contact cards (phone, email,
  #it-help chat channel, walk-in desk), **AI self-help** from an IT knowledge base (VPN, passwords/MFA, Outlook/Teams, printers, software,
  hardware, security), raise a ticket (AI suggests category and impact from the description, optional screenshot), track replies,
  reply to reopen, confirm fixed with a rating. HR support links to it for IT issues.
* **IT service desk** (`/it-helpdesk`, admins with the new `it` module – ADM02 in the demo – and Super Admin): queue sorted by SLA
  (Critical 4 h · High 8 h · Normal 24 h · Low 72 h), unassigned / breached / mine views, assign, re-prioritise, waiting-on-employee,
  resolve with a resolution note, internal notes, **AI suggested reply**, AI service-desk brief, CSAT.
* Notifications go to IT agents on new tickets (critical ones also to the Super Admin), to the employee on replies / resolution and to the
  assignee on employee replies. New files: `src/lib/itdesk.js`, `src/store/itActions.js`, `src/components/collab/ItSupport.jsx`.
* API: `POST /api/v1/it-tickets` · `POST /it-tickets/{id}/comments` · `PATCH /it-tickets/{id}` (assign, status, priority, resolution) · `POST /it-tickets/{id}/rating`.

The AI copilot also sees your schedule, open action items, unread chat, your BGV status (employees) and BGV / compliance queues (admins).

### Demo walkthrough

* **Employee / manager** – sign in as Bindu (EMP007): *Calendar → Schedule with AI* “45 min with Akhil and Kartik next Tuesday afternoon about release retro”; *Chat → Akhil Reddy*, “Suggest replies”, “/schedule 30 min tomorrow”; *Team BGV status*.
* **BGV self-service** – Meera Nair (EMP012) has *insufficient documents*: *My background check → Upload*.
* **HR admin** – Swetha (ADM01): *Background verification* (open Neha Kapoor's discrepancy → AI risk summary → Close case), *Access & permissions*; *Recruitment (ATS)* → open an applicant → AI screening report → Schedule interview → Find a slot; *Job postings → Write JD with AI*; *Compliance calendar* → the overdue Telangana PT return → AI filing checklist → Mark filed.
* **Sales** – Sanjay (EMP024): *Client meetings* → Acme Logistics → Pre-meeting brief → type notes → AI minutes & action items → Save & complete.

ADM01 gained the `bgv` and `compliance` modules and ADM02 the `compliance` module; browsers holding v7 data are upgraded automatically.

### Files (v8)

```
NEW  src/lib/collab.js                       BGV rules & access levels, ATS match score, time zones, busy blocks, compliance calendar, chat helpers
NEW  src/lib/scheduler.js                    AI scheduling: natural-language parser, multi-time-zone slot finder, model prompt + merge
NEW  src/data/seedCollab.js                  demo BGV cases/vendors/grants, applicant profiles, interviews, postings, compliance, clients, meetings, chat
NEW  src/store/collabActions.js              store actions for all v8 modules (audit + notifications)
NEW  src/components/collab/aiKit.jsx          AI button / result panel / runAi with offline answers
NEW  src/components/collab/BgvViews.jsx       BGV admin page, case drawer, access panel, My background check, Team BGV, status chips
NEW  src/components/collab/AtsViews.jsx       recruitment hub: applicants, interviews, job postings, requisitions
NEW  src/components/collab/ComplianceCalendar.jsx
NEW  src/components/collab/ChatPage.jsx
NEW  src/components/collab/CalendarViews.jsx  calendar, AI scheduling dialog, meeting dialog, interview feedback
NEW  src/components/collab/MeetingsViews.jsx
```

Wired (no feature removed): `AppStore.jsx` (actions, v8 migration, cross-tab sync), `seed.js`, `roleNav.js`, `PeopleHubApp.jsx`, `PortalShell.jsx`
(icons, badges), `PeoplePage.jsx`, `EmployeeMaster.jsx`, `ProfilePage.jsx`, `PortalDialog.jsx`, `UsersAccess.jsx` (module list), `ai/mock.js`, `ai/prompts.js`, `ai/context.js`.

### API contract (v8 additions)

| Store action | Endpoint |
|---|---|
| initiateBgv / cancelBgv / reopenBgv | `POST /api/v1/bgv` · `POST /bgv/{id}/cancel` · `/reopen` |
| giveBgvConsent | `POST /api/v1/bgv/{id}/consent` (e-sign; server stores IP, time, consent text version) |
| updateBgvCheck / uploadBgvDoc | `PATCH /api/v1/bgv/{id}/checks/{type}` · `POST /bgv/{id}/checks/{type}/documents` (virus scan, encrypted storage) |
| closeBgv / remindBgv | `POST /api/v1/bgv/{id}/close` · `/remind` |
| logBgvView / grantBgvAccess / revokeBgvAccess | `GET /api/v1/bgv/{id}` (server logs every read) · `POST /bgv-access` · `DELETE /bgv-access/{id}` |
| addApplicant / updateApplicant / addAtsNote | `POST /api/v1/candidates` (CV upload + parse) · `PATCH /candidates/{id}` · `POST /candidates/{id}/notes` |
| scheduleInterview / setInterviewStatus / submitInterviewFeedback | `POST /api/v1/interviews` · `PATCH /interviews/{id}` · `POST /interviews/{id}/feedback` |
| saveJobPosting | `PUT /api/v1/requisitions/{id}/posting` (publish to careers page / job boards) |
| setComplianceStatus / upsertComplianceItem / deleteComplianceItem | `PUT /api/v1/compliance/{key}/status` · `POST/PATCH/DELETE /compliance/items` |
| sendChatMessage / markChannelRead / openDm / createChannel / reactChat / deleteChatMessage | `POST /api/v1/chat/{channel}/messages` (WebSocket fan-out) · `PUT /chat/{channel}/read` · `POST /chat/dm` · `POST /chat/channels` · `POST /chat/messages/{id}/reactions` · `DELETE /chat/messages/{id}` |
| saveMeeting / cancelMeeting / saveMinutes / toggleActionItem / upsertClient | `POST/PATCH /api/v1/meetings` (calendar invite e-mail / Google / Outlook sync) · `POST /meetings/{id}/cancel` · `PUT /meetings/{id}/minutes` · `PATCH /meetings/{id}/actions/{n}` · `POST/PATCH /clients` |
| saveEvent / deleteEvent | `POST/PATCH/DELETE /api/v1/events` |
| AI scheduling | `POST /api/v1/schedule/suggest` – the server must run the same free/busy search against real calendars; the model only parses text and explains. |

In production: BGV needs consent records, purpose limitation and retention under the DPDP Act 2023 (India), FCRA (US), GDPR (EU/UK)
and local law; restrict BGV documents to the BGV team; run chat over WebSockets with server-side membership checks and retention;
send real calendar invites (ICS / Google / Microsoft Graph). Compliance dates come from the payroll engines and a company list —
confirm them with your advisers.

---

# ONAS PeopleHub v7 — global regions: AMER · EMEA · ASIA · AFRICA

v7 extends the v6 country mode to **22 countries in four regions**:

| Region | Countries (payroll engine in `src/lib/payroll/<cc>.js`) |
|---|---|
| 🌎 **AMER** | United States · **Canada** (federal + Ontario, CPP/CPP2, EI) · **Mexico** (ISR 2026, Subsidio, IMSS, INFONAVIT, ISN) · **Brazil** (INSS 2026, IRRF with Lei 15.270/2025, FGTS, 13º) |
| 🌍 **EMEA** | United Kingdom · UAE · **Germany** (§32a EStG 2026, Soli, RV/AV/KV/PV with 2026 ceilings) · **France** (PMSS 2026, CSG/CRDS, prélèvement à la source; approximate) · **Ireland** (PAYE, USC 2026, PRSI incl. Oct 2026 rise) · **Saudi Arabia** (GOSI legacy/new system, end-of-service) |
| 🌏 **ASIA** | India · Singapore · **Malaysia** (PCB, EPF, SOCSO, EIS) · **Philippines** (TRAIN tax, SSS 15%, PhilHealth 5%, Pag-IBIG) · **Indonesia** (PPh 21, BPJS) |
| 🌍 **AFRICA** | Namibia · South Africa · Kenya · Nigeria · Botswana · **Ghana** (revised PAYE bands from Sep 2026, SSNIT) · **Zambia** (PAYE, NAPSA 2026 ceiling, NHIMA, SDL) |

**Region mode.** The header selector now offers *All countries*, *Whole AMER / EMEA / ASIA / AFRICA region*, or a single country.
In region mode the Country workspace becomes a **Region workspace**: countries, staff, monthly cost in ₹, blocking compliance issues,
every statutory filing due in the next 14 days across the region, and an AI region summary. Payroll, Local policies & compliance
and the live map open on the first country of the region, and every AI answer gets all the region's rules.

Every new country also has its 2026 public holidays, statutory leave floor (e.g. France 25 days, Brazil 22, Zambia 24, Saudi sick leave 30),
onboarding documents, exit terms, local languages for AI translation, data-protection law and seven automations — exactly as for the v6 countries.

New demo staff: EMP035 Canada · EMP036 Mexico · EMP037 Brazil · EMP038 Germany · EMP039 France · EMP040 Ireland · EMP041 Saudi Arabia ·
EMP042 Malaysia · EMP043 Philippines · EMP044 Indonesia · EMP045 Ghana · EMP046 Zambia (password Points@2026), each with an office geofence.

Approximations to confirm with local payroll advisers: France (mutuelle, prévoyance, RGDU not applied), Mexico employer cesantía rate,
Canada (Ontario surtax/health premium not applied), Indonesia (monthly TER vs. annual method), Zambia (PAYE on gross vs. after NAPSA).

---

# ONAS PeopleHub — AI-enabled HRMS with country mode (v6)

This version adds three things on top of v5 without removing or rewriting any existing feature:

1. **Country mode.** A country selector sits in the header of every page (Admin and Super Admin; employees are locked to their own country).
   Choosing a country switches payroll, statutory deductions, leave, public holidays, compliance checks, filing deadlines,
   onboarding documents, exit terms, automations and every AI answer to that country's rules.
2. **Africa-region payroll engines** for **Namibia, South Africa, Kenya, Nigeria and Botswana**, alongside India, UK, US, UAE and Singapore.
3. **ONAS look and feel.** Colours come from the ONAS logo (navy-teal `#124554`, mint `#3EE8B0`); the ONAS logo replaces the "p" mark.

### What changes when a country is selected

| Area | What happens |
|---|---|
| **Country workspace** (new page: *Country workspace* for admins, *My country rules* for employees) | Overview with AI insight · payroll register and a live pay calculator · leave entitlements and the country's public holidays · compliance checks and filing calendar · onboarding documents, contract and exit terms · automations |
| **Payroll** | The payroll page, Local policies & compliance and the live map open on the selected country. Each country runs its own engine in `src/lib/payroll/<cc>.js`. |
| **Leave** | Leave balances, the leave request dialog and approval checks use the employee's country: company leave is **lifted to the statutory minimum** where it is lower (e.g. Namibia earned leave 18 → 20 days, Kenya 18 → 21, UAE 18 → 22) and country leave types are added (Namibia compassionate leave, South Africa family responsibility leave). **India is unchanged.** |
| **Holidays** | Leave working-day counts, attendance and the home dashboard use the employee's country holiday calendar (India keeps the company calendar). |
| **Automations** | Statutory filing reminders, payroll pre-check (blocks the run on failures), missing statutory registrations, public-holiday announcements, probation confirmations, statutory leave floor, country onboarding pack — each with *Run now*, an on/off switch, an action log and *Draft with AI*. |
| **AI** | Every AI feature (copilot, field writing, explain-a-word, insights, approval reviews) gets the selected country's rules, currency, authorities and leave law in its prompt (`src/country/aiCountry.js`). |
| **Translate page** (header) | AI translates **every string in the application** — sidebar, header and page — into the country's local languages (e.g. Afrikaans / Oshiwambo for Namibia, Swahili for Kenya, Hausa / Yoruba / Igbo for Nigeria, Setswana for Botswana) or 9 other languages, and keeps translating new text as you move around. Needs a live Claude connection (proxy or key). |

### Country engines added (2026 rates)

| Country | Tax year | Employee deductions | Employer costs | Filing calendar |
|---|---|---|---|---|
| 🇳🇦 Namibia | 1 Mar 2026 – 28 Feb 2027 | PAYE (0 % to N$100,000, then 18 – 37 %), SSC 0.9 % (ceiling N$11,000, N$12,500 from Sep 2026), pension (deductible to N$150,000) | SSC 0.9 %, pension, VET levy 1 % | PAYE & VET by the 20th, SSC month end, annual PAYE reconciliation |
| 🇿🇦 South Africa | 1 Mar 2026 – 28 Feb 2027 | PAYE (18 – 45 %, rebates by age, medical credits), UIF 1 % (ceiling R17,712), retirement fund | UIF 1 %, SDL 1 % | EMP201 by the 7th, EMP501, COIDA |
| 🇰🇪 Kenya | Calendar year | PAYE (10 – 35 %, relief KES 2,400), NSSF 6 % (KES 9,000 / 108,000), SHIF 2.75 %, Housing Levy 1.5 % | NSSF match, Housing Levy 1.5 %, NITA | All by the 9th, P9 forms |
| 🇳🇬 Nigeria | Calendar year (Nigeria Tax Act 2025) | PAYE (0 % on first ₦800,000, then 15 – 25 %, rent relief), pension 8 %, NHF 2.5 % | Pension 10 %, NSITF 1 %, ITF 1 % | PAYE by the 10th, pension, NHF, Form H1 |
| 🇧🇼 Botswana | 1 Jul 2026 – 30 Jun 2027 | PAYE (0 – 27.5 %, new top band from 1 Jul 2026), approved pension | Pension, severance accrual (non-pension staff) | PAYE by the 15th, ITW10 |

Rates were checked against PwC, SARS-based and payroll-provider tables published in 2026. **Confirm them with a local adviser before filing**; the
Namibia 2026/27 Budget proposes new brackets that are not law yet — update `RATES.tax.slabs` in `na.js` when they are gazetted.
Public holidays are for 2026; Islamic holidays are marked "date may move".

### New demo accounts

| Country | Login ID | Code | Password |
|---|---|---|---|
| Namibia | ndapewa.shikongo@peoplehub.demo | EMP030 | Points@2026 |
| Kenya | wanjiru.kamau@peoplehub.demo | EMP032 | Points@2026 |

Also in the data: Lerato Mokoena (EMP031, South Africa), Chinedu Okafor (EMP033, Nigeria), Kagiso Molefe (EMP034, Botswana), and offices
(geofences) in Windhoek, Johannesburg, Nairobi, Lagos and Gaborone. Browsers that already hold v5 data get these added automatically.

### Ezyo brand colours

`brand/ezyoBrandPlugin.mjs` is a Vite plugin that re-skins colours at build time: the old forest-green palette is mapped to the Ezyo palette,
so the original source keeps its colours. Run `EZYO_BRAND=off npm run dev` to see the original PeopleHub colours.

| Role | Colour | Used for |
|---|---|---|
| Major dark teal | `#004A77` | primary buttons, active nav, headings accents, sidebar, banners |
| Glob colour (orange, from the EzyGlob wordmark) | `#F48A3E` | secondary colour, badge counts, notification dot, banner highlights, AI gradient |
| Bright teal | `#10FCBE` (deep shade `#0A9E78` for text on white) | highlight buttons on dark surfaces, success states, charts, links, gradient ends |

Warning (amber), error (red) and info (blue) colours are kept so status meaning stays clear.

### Files

```
NEW  src/country/countryPacks.js      holidays, leave floors, documents, languages, formats per country; leave/holiday helpers
NEW  src/country/CountryContext.jsx    selected-country state (per user), employees locked to their own country
NEW  src/country/CountrySwitcher.jsx   header country selector
NEW  src/country/CountryWorkspace.jsx  Country workspace / My country rules page, calculator, automations
NEW  src/country/AiPageLocalizer.jsx   AI translation of every string on screen
NEW  src/country/aiCountry.js          country rules added to every AI prompt
NEW  src/country/brand.js              Ezyo colour tokens
NEW  src/lib/payroll/{na,za,ke,ng,bw}.js   country payroll engines
NEW  brand/ezyoBrandPlugin.mjs         build-time Ezyo colour mapping
```

Existing files were only wired up (138 changed lines across 21 files, no feature removed): engine registration (`payroll/index.js`),
country lists (`employeeFields.js`, `LiveLocationView.jsx`, `OpsSuper.jsx`, `TalentAdmin.jsx`), demo data (`seed.js`, `seedOps.js`),
the provider (`main.jsx`), the menu entry (`roleNav.js`, `PeopleHubApp.jsx`), header and logo (`PortalShell.jsx`, `LoginPage.jsx`),
the selected country as default (`PayViews.jsx`, `OpsSuper.jsx`, `LiveLocationView.jsx`), country leave and holidays
(`AppStore.jsx`, `LeavePage.jsx`, `EmployeeGlassHome.jsx`, `MyAttendance.jsx`, `ai/facts.js`, `ai/context.js`), the AI base prompt
(`ai/prompts.js`) and the plugin (`vite.config.js`).

---

# PeopleHub — role-based employee workspace (HRportal-main, extended)

This is the HRportal-main code (React 18 + Vite + MUI 9 + React Router 7) with role-based sign-in and the parts
that were missing compared with Keka and PeopleHR: manager approvals, an Inbox, leave policy and balances,
expenses and advances, salary loans, tax, a team summary, an all-approvals screen for admins, and a Super Admin
employee master built from the Sahayog field reference. Sahayog points (submit → manager → HR → credit) is included.

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ — HashRouter + base "./", so it runs on GitHub Pages or any static host
```

All data is stored in the browser (`localStorage`). Each store action maps to one REST endpoint (table below),
so the pages stay the same when you connect a backend.

## Generative AI (Claude) — everywhere in the portal

Every role gets generative AI on every page, every text field and every word on screen:

| Where | What it does |
|---|---|
| **Every text field** (✨ button, or **Ctrl+J** in any text box) | Write it for me (from the label, form and page context), improve, fix spelling & grammar, professional / friendly tone, shorten, expand, bullet points, continue writing, translate into 15 languages, or any custom instruction. Replace, add below, copy, retry. |
| **While typing** in long fields | Ghost-text autocomplete — press **Tab** to accept. |
| **Any word on screen** (select text) | Explain, simplify, translate, or ask the copilot about it (CTC, TDS, LOP, geofence, policy text…). |
| **Copilot on every page** ("Ask AI", **Ctrl+/**) | Sees the current page plus a *role-scoped* data snapshot: employees see only their own records (and their team if they manage one); admins see their org units and modules; Super Admin sees company aggregates. Answers, summaries, drafts, and links that jump to the right screen. |
| **"AI summary" on every page header** | One click summary of the page and what needs attention. |
| **Home dashboards** | AI daily brief (employee), operations brief (admin), company pulse (Super Admin). |
| **Approval drawers** (leave, expense, advance, loan, attendance correction, asset, points) | AI review: recommendation, policy checks (balance, notice, limits, receipts, claim window, duplicates, EMI load), and a ready-to-send note with *Use note & approve/reject*. The human still decides. |
| **Payslips** | "AI explains your payslip" — each earning and deduction, and the change from last month. |

Facts for insights and reviews are computed from the real data in the browser; the model only writes the narrative, so it cannot invent numbers.

### Connecting Claude

**Super Admin → System settings → Generative AI** chooses how the browser reaches the model:

* **Secure proxy (recommended).** The key stays on the server.
  ```sh
  cp .env.example .env          # put ANTHROPIC_API_KEY=... in .env
  npm run ai-proxy              # http://localhost:8787 (also serves dist/ after a build)
  npm run dev                   # Vite forwards /api/ai to the proxy
  # production, one process:
  npm start                     # builds, then serves the app + /api/ai on $PORT
  ```
  Proxy options (env): `AI_ALLOWED_ORIGINS`, `AI_MODELS` (allow-list), `AI_MAX_TOKENS`, `AI_RATE_PER_MIN`, `AI_UPSTREAM_URL` (corporate gateway). If the app is hosted elsewhere (e.g. GitHub Pages), build with `VITE_AI_PROXY_URL=https://your-proxy/api/ai`.
* **Browser key (demo only).** Paste an Anthropic API key; calls go directly from the browser. Anyone using that browser can read it.
* **Offline demo.** No network calls: rule-based answers from your own data so every AI control still works.
* **Auto (default).** Proxy if it answers → browser key if saved → offline demo.

Models: main `claude-sonnet-5-5` (copilot, insights, reviews) and fast `claude-haiku-5-5` (field writing, autocomplete, explain-a-word) — both switchable, including `claude-opus-5-5`. Each user can pick their AI language and turn individual AI features on or off in the copilot's preferences. Fields for passwords, OTP, PIN, captcha, bank/PAN/Aadhaar numbers, amounts and phone numbers are excluded from AI assist.

AI code lives in `src/lib/ai/` (client, prompts, role-scoped context, policy facts, offline generator) and `src/components/ai/` (field assist, selection, copilot, insight/review cards, settings), plus `server/ai-proxy.mjs`.

## Demo accounts (click a chip on the sign-in page, then type the captcha)

| Role | Login ID | Code | Password | Notes |
|---|---|---|---|---|
| Employee | akhil.reddy@peoplehub.demo | EMP001 | Points@2026 | Reports to Bindu |
| Manager (employee) | bindu@peoplehub.demo | EMP007 | Points@2026 | 5 direct reports → Inbox + Team summary |
| First login | rahul.verma@peoplehub.demo | EMP010 | Welcome@123 | Must set a new password |
| Locked | kiran.patil@peoplehub.demo | EMP011 | Points@2026 | Locked after 5 failures |
| Pending | meera.nair@peoplehub.demo | EMP012 | Welcome@123 | Waits for HR to activate |
| Sales manager | sanjay.reddy@peoplehub.demo | EMP024 | Points@2026 | Team live location, team calls, team activity |
| Field sales | neha.kapoor@peoplehub.demo | EMP022 | Points@2026 | Geofenced mobile punch (client sites allowed), call log |
| HR admin | swetha.reddy@peoplehub.demo | ADM01 | Points@2026 | Leave, points, accounts, attendance, location, calls, monitoring, talent, hiring, learning, workforce, wellness |
| Finance admin | ashok.kumar@peoplehub.demo | ADM02 | Points@2026 | Expenses, advances, loans, payroll, benefits, assets · pays / disburses / assigns |
| Super Admin | praveen.kumar@peoplehub.demo | — | Points@2026 | One-time code + security PIN 4321 |

## Approval workflow

```
Employee submits ──► Reporting manager (Inbox) ──► HR admin (leave, points, accounts)
                                              └──► Finance admin (expense, advance, loan) ──► Paid / Disbursed
Super Admin: sees everything, overrides with an audit note, configures the chain per module
```

* Employees without an active manager go straight to the admin. The chain per module (manager → admin, manager only,
  admin only) is set in **Policies & rules → Approval workflow**.
* Admins finalise only the modules they hold (`modules` on the admin record) for their org units (child units included).
* Rejections always need a reason; admins can approve a smaller amount (with a note); bulk approve skips flagged items.
* Every step notifies the next person and the employee, and is written to the audit log.

## What each role sees

**Employee** — Home (original overview, tap in/out) · **Inbox** (team approvals for managers + "My requests" with who it is
waiting on) · Notifications · Attendance · **Leave** (pending requests, stats, balances per type, holidays, history,
request dialog with working-day count, half days, notice, overlap, balance and certificate rules) · **Expenses & travel**
(multi-line claims with receipts and policy limits, advance requests with the PeopleHR fields, policy tab) · **Sahayog points**
· **My finances** (My pay, Manage tax with regime switch and Form 130 / Form 124, salary loans) · **My profile**
(HR-master fields read-only, contact/bank/personal editable, sign-in activity) · **Team summary** for managers
(who is off, not in yet, on time / late / WFH / remote, team calendar, team balances) · People, Org chart, Documents,
Learning, HR support.

**Admin** — Dashboard · **All approvals** (waiting for me, to pay / disburse, new accounts, all; filters, bulk, CSV) ·
People (add employee with the full master form, remove) · Org chart · Reports (leave & expenses by department, points) ·
Documents, Learning upload, HR support · Profile with modules and permissions.

**Super Admin** — Dashboard and system health · **Employee master** (47 fields: Sahayog core HR + payroll, PeopleHR contacts and
employment, Keka policies and pay) · **Field reference** (data dictionary, Excel export) · Users & access (admins with modules,
org units and permissions; unlock, suspend, force reset, reset MFA, adjust points, HR sync) · **Policies & rules** (approval
workflow, leave types, expense categories, holidays, points rules/categories/org) · All requests with override · Reports & fraud ·
Audit log · System settings (session, lockout, MFA, file limits, SLA, expense/advance/loan limits).

**Sign-in (all roles)** — login ID, password, role tab, captcha, remember me, hidden device fingerprint; employee code /
admin code checked against the master; MFA code for admins, MFA + security PIN for Super Admin; forced reset on first
login; lock after 5 failures; 15-minute idle timeout with warning; status shown only after correct credentials.

## Glass dashboards and workforce modules (v2)

Every role now opens on a **glass dashboard** (frosted panels on a forest-green mesh). "Classic view" switches back to the
previous home and the choice is remembered per user. The sidebar follows the Sahayog module groups.

| Module | Employee | Manager | Admin (by module) | Super Admin |
|---|---|---|---|---|
| Biometric attendance | Punch orb: device fingerprint/face (WebAuthn), selfie + location, office terminal, web punch; timesheet; correction requests | — | Register (late / not in / flagged), devices, sync | + register devices, all sites |
| Geofencing & live location | Punch is checked against allowed geofences (block / flag / allow) | Team live map | Live map for scope | Geofence editor (click map to place), all countries |
| Performance | Goals (weights ≤ 100 %), self review, feedback | Team reviews | Cycle stages, calibration, 9-box, flight risk, succession | Same, all staff |
| Assets | My assets, confirm receipt, report issue, request asset | Approves requests | Inventory, assign / return, book value, requests to fulfil | Same |
| Team call tracker | My calls vs target | Team calls | Calls, connect rate, talk time, follow-ups | Same + targets |
| Employee monitoring | My activity & privacy: see your data, change consent | Team category totals (if allowed) | Activity by category / app (consenting staff only) | Policy, consent register, retention purge |
| Recruitment & onboarding | My onboarding checklist | — | Requisitions, pipeline, funnel, checklists, buddies | Same |
| Payroll & benefits | Benefits enrolment, wellness pulse (anonymous) | — | Payroll per country (IN, UK, US, UAE, SG engines), payslips with steps, compliance blocks, run / lock; benefits cost; wellness by team (min 3 responses) | Same |
| Workforce & learning | Roster | — | Plan vs budget, span of control, shift roster, courses, training hours | Same |
| Global & insight | — | — | — | Multi-territory cost in ₹ with editable FX, local policy & filing calendar, HR analytics |

**Privacy by design for monitoring:** consent per employee (location and activity separately), location only while clocked in,
activity counted as active / idle minutes by app category inside work hours — no keystrokes, content, browsing history,
microphone or camera; screenshots are off and cannot be turned on in this build; managers see category totals only; data is purged
after the retention period. Check local law (DPDP Act 2023 in India, GDPR in the UK) before switching on any monitoring.

The demo builds "today" as at 14:30 when it is opened outside working hours, so the dashboards always have data.

## Payslips (v3)

Built from the company payslip template (`ONASTech_Payslip_Aug2026.docx`): logo and company address, employee details
(employee number, date joined, department, designation, payment mode, bank, IFSC, account, UAN, PF number, PAN), salary
details (actual payable days, total working days, loss of pay days, days payable), Earnings (A), Contributions (B),
Taxes & deductions (C), reimbursements, gross / total deductions / total net payable, **Net salary payable = A − B − C**,
and the amount in words.

```
HR admin (module "payslips")  ──►  Finance (module "payroll")  ──►  Super Admin  ──►  HR / Super Admin releases
   prepares fields and runs          approves                      final approval       → My pay + email to employee
```

* **Payslip fields** (Pay & benefits → Payslips → Payslip fields): HR adds or changes a line (code, label, section,
  type, order, *Required*, *Visible to employee*). Each change goes Finance → Super Admin and is used only once Active.
  Retiring a field needs the same approvals. Released payslips keep the fields they were approved with.
* **Payslip runs**: *Generate from payroll* (India engine: basic 50 %, HRA 40 % of basic, PF, ESI, PT, TDS, LOP from
  approved leave, overtime from punches) or *Upload file* (CSV; template download pre-filled with active employees).
  Uploads are checked in full before anything is imported (required columns, known employees, numbers, days, duplicates,
  deductions ≤ earnings). The person who prepares a run cannot approve it; rejection needs a reason and returns it to HR.
* **Release** publishes payslips under **My finances → My pay** (print / save as PDF, download) and emails each employee
  using the template in Payslip settings. The browser demo queues emails in the **Email outbox**; the server must send them.
* Employee master gained **PF number** and **Payment mode**. Admin modules gained **payslips**.

Template differences to confirm with Finance: the title reads "PAYSLIP Jul JULY PAYSLIP 2026" in the August file; TDS shows
"0.000.00"; "Total Taxes & Deductions (C)" shows 2,000 although PT 200 + TDS 0 = 200 (the 2,000 includes PF, which is B);
"TOTAL NER PAYABLE" is a typo. The portal uses C = 200 and Total deductions = B + C = 2,000, which gives the same 95,633 net.

## Offer letters (v4)

Hire & onboard → **Offer letters** (HR admin with module `offers`, and Super Admin), built from
`Offer_Letter-_Updated_New_v2.0.docx`: welcome page, terms (joining date, location, remote work, probation, leave,
compensation, bonus, notice, background checks, other terms, acceptance), Annexure I salary breakup and Annexure II
non-compete, with the company letterhead and footer.

* **Standard fields** cover every variable part of the template (candidate, offer terms, CTC and percentages).
  Annexure I is calculated: Basic = % of CTC, HRA and LTA = % of basic, PF = 12 % of basic (capped at ₹1,800 by default),
  special allowance = CTC − PF − the rest, take home = gross − PF employee − PT.
* **Offer fields** tab: HR adds fields — an extra detail (Candidate / Offer terms), an extra monthly earning in Annexure I,
  or a whole extra clause whose text can use `{{field_key}}` placeholders. Each field can be required, has a default,
  can be switched off, and becomes a column in the upload file.
* **Manually**: New offer (optionally filled from a candidate in the recruitment pipeline), live Annexure I preview,
  letter preview, save draft. **By upload**: CSV template download, paste or choose file, full check before import.
* Issue (locks the letter, emails the candidate via the outbox) → record Accepted (starts onboarding, moves the candidate to
  Hired) / Declined / Withdrawn. Print / save as PDF, or download a **Word (.docx)** file.

Corrections made to the template text (confirm with HR/legal): Infosys references removed ("Infosys requires you to furnish
a copy of your passport" now uses the company name; the "intranet sparsh" became a setting; the Infosys logo in the template
header is not used); Annexure I annual figures recalculated (the template shows PF employee 59,040 / deductions 83,040 /
take home 9,00,960 a year, which should be 21,600 / 24,000 / 9,38,400, and monthly deductions 3,800 should be 2,000);
the incomplete compensation and bonus sentences were rewritten; the "Digitally signed … 07-04-2022" stamp is not reproduced,
because a digital signature must be applied by a signing service, not printed.

## Files added or changed

```
src/store/AppStore.jsx          auth, approvals engine, employee master, policies, audit, notifications
src/data/seed.js                demo masters and transactions (people from HRportal)
src/data/employeeFields.js      employee field dictionary + validation (drives forms, profile, field reference)
src/data/roleNav.js             sidebar per role
src/lib/requests.js             leave / expense / advance / loan rules
src/lib/validation.js, utils.js points rules, helpers
src/components/PortalShell.jsx  role sidebar with badges, notifications, idle timeout, account menu
src/components/kit/*            shared UI, approval chain, request drawer, points review, reports, field input
src/PeopleHubApp.jsx            role routing (original pages kept)
src/pages/LoginPage.jsx         replaces Loginpage.jsx (the old import used a different case and failed on Linux/CI)
src/pages/{LeavePage,ExpensesPage,FinancesPage,ProfilePage,NotificationsPage}.jsx
src/pages/{inbox,team,points,requests,admin,superadmin}/*
v2:
src/data/seedOps.js              geofences, devices, punches, locations, consents, activity, calls, assets, goals, reviews, hiring, payroll, benefits, analytics
src/store/opsActions.js          punch / geofence / device / asset / performance / hiring / payroll / benefits / workforce / monitoring actions
src/lib/{geo,biometric,hrcalc,workforce}.js and src/lib/payroll/* (Sahayog country engines)
src/components/glass/*           glass kit + SVG live map (no map tiles or keys needed)
src/components/{workforce,talent,hire,pay}/*   shared views used by manager, admin and Super Admin pages
src/pages/glass/*                employee and admin / Super Admin dashboards
src/pages/workforce/*, talent/*  employee pages (attendance, activity, assets, benefits, onboarding, performance)
src/pages/modules/ModulePages.jsx  admin module routes, scoped to the admin's org units
src/data/payslipFields.js, seedPayslips.js, companyLogo.js   payslip layout, fields, totals, CSV parse/validate, demo data
src/store/payslipActions.js     payslip field and run approvals, release, email outbox
src/lib/payslipGen.js           payslip rows from the India payroll engine
src/components/pay/PayslipDocument.jsx, PayslipViews.jsx   payslip in the template layout, My pay, admin page
src/data/offerFields.js         offer letter fields, Annexure I calculation, letter content, CSV checks
src/store/offerActions.js       offer fields, prepare / upload / issue / respond
src/lib/offerDocx.js            Word file generator (docx package)
src/components/offers/OfferViews.jsx   offers page, form, upload, preview, fields, letterhead settings
src/pages/superadmin/OpsSuper.jsx  geofences & devices, monitoring policy, territory, compliance, HR analytics, workforce policies
```

Fixes to the original code: the `LoginPage` import case (build failed on Linux and in the GitHub Action), MUI 9 no longer
accepting layout props such as `justifyContent` / `alignItems` directly on `Stack`, `Box` and `Typography`
(moved into `sx`, otherwise layouts silently collapsed), `inputProps` → `slotProps.htmlInput`, and a missing icon in `EmptyState`.

## API contract the store mirrors

| Store action | Endpoint |
|---|---|
| beginLogin / verifyMfa / completeReset / logout | `POST /api/v1/auth/login`, `/auth/mfa`, `/auth/reset-password`, `/auth/logout` |
| createRequest(type) / cancelRequest | `POST /api/v1/{leaves,expenses,advances,loans}` · `POST /…/{id}/cancel` |
| decideRequest / bulkDecideRequests | `POST /api/v1/requests/{id}/decision` (manager or admin step) · `POST /requests/bulk-decision` |
| payoutRequest | `POST /api/v1/requests/{id}/payout` (Finance: UTR + date) |
| saveSubmission / managerDecidePoints / decide | `POST /api/v1/submissions` · `/submissions/{id}/manager-decision` · `/decision` |
| escalate / setFlag / reassign / override(Request) | `POST /…/{id}/escalate` · `/flag` · `/reassign` · `/override` |
| upsertEmployee / removeEmployee / updateProfile | `POST/PATCH /api/v1/employees` · `DELETE /employees/{code}` · `PATCH /me` |
| decideAccount / setUserStatus / forceReset / resetMfa | `POST /employees/{code}/account-decision` · `PATCH /users/{code}/status` · … |
| upsertAdmin / hrSync | `POST/PATCH /api/v1/admins` · `POST /hr/sync` |
| updateMaster / upsertRule / upsertCategory / updateSettings | `PUT /leave-types`, `/expense-categories`, `/holidays`, `/rules`, `/categories`, `/settings` |
| punch / pingLocation / setConsent | `POST /api/v1/attendance/punches` (method, geo, selfie, device assertion) · `POST /me/location` · `PUT /me/monitoring-consent` |
| createRequest("regularize" / "asset") | `POST /api/v1/attendance/regularizations` · `POST /assets/requests` |
| upsertGeofence / upsertDevice / syncDevice | `POST/PATCH /api/v1/geofences` · `/biometric-devices` · `POST /biometric-devices/{id}/sync` |
| assignAsset / returnAsset / acknowledgeAsset | `POST /api/v1/assets/{id}/assign` · `/return` · `/acknowledge` |
| logCall / recordMyActivity / purgeMonitoring | `POST /api/v1/calls` · `POST /me/activity` · `POST /monitoring/purge` |
| upsertGoal / submitSelfReview / submitManagerReview / calibrate | `POST /api/v1/goals` · `/reviews/{code}/self` · `/manager` · `/calibration` |
| upsertReq / addCandidate / moveCandidate / toggleOnbTask | `POST /api/v1/requisitions` · `/candidates` · `PATCH /candidates/{id}` · `PATCH /onboarding/{id}/tasks/{n}` |
| runPayroll / lockPayroll | `POST /api/v1/payroll/runs` · `POST /payroll/runs/{id}/lock` |
| updateBenefits / submitPulse / setBudget / setRoster / setFx | `PUT /benefits/{code}` · `POST /wellness/pulse` (anonymous) · `PUT /workforce/budget` · `PUT /roster` · `PUT /fx` |
| proposeComponent / decideComponent | `POST /api/v1/payslip-fields` · `POST /payslip-fields/{code}/decision` (Finance, then Super Admin) |
| createBatch / submitBatch / decideBatch | `POST /api/v1/payslips/runs` (JSON or CSV upload) · `/runs/{id}/submit` · `/runs/{id}/decision` |
| releaseBatch / resendPayslipEmail | `POST /api/v1/payslips/runs/{id}/release` (publish + email with PDF) · `POST /payslips/{id}/email` |
| employee My pay | `GET /api/v1/me/payslips` · `GET /me/payslips/{id}.pdf` (released only) |
| upsertOfferField / setOfferFieldActive | `POST/PATCH /api/v1/offer-fields` |
| saveOffer / bulkCreateOffers / deleteOffer | `POST/PATCH /api/v1/offers` · `POST /offers/upload` (CSV) · `DELETE /offers/{id}` |
| issueOffer / respondOffer | `POST /api/v1/offers/{id}/issue` (PDF + email) · `POST /offers/{id}/response` |
| redeem / adjustPoints | `POST /me/redemptions` · `POST /ledger/adjustments` |

The server must repeat every validation, hash passwords with bcrypt, issue real TOTP codes, record the real client IP,
store and scan uploaded files, verify WebAuthn assertions and biometric device signatures server-side, re-check geofences from the raw position, and enforce role, module and org-unit scope on every endpoint.

## v8.3 — Core HR · Documents drive (folders + uploads)

`/documents` is now a file manager for every role:

* **My files** (private per user) and **Shared drive** (everyone can view; Admin and Super Admin can add, rename, move and delete). **Company library** keeps the read-only reference documents.
* **New folder**, **Upload files** (multi-select), **Upload folder** (keeps the whole sub-folder tree), and **drag & drop** of files or folders onto the list.
* Breadcrumb navigation, search across all folders, preview (images, PDF, text), download, rename, **Move to…**, and delete (folders delete recursively, with a confirmation).
* Files are stored as real Blobs in the browser's **IndexedDB** (`peoplehub-docs`), up to 50 MB per file, instead of the old 1.5 MB localStorage cap. Earlier uploads are moved into *My files* automatically the first time the page opens.

Files: `src/lib/docStore.js` (new), `src/pages/DocumentsPage.jsx` (rewritten), `src/PeopleHubApp.jsx` (wiring).
Note: like the rest of this demo, storage is per browser. A backend (for example S3 or SharePoint) is needed for files to be shared across devices.

## v8.4 — Calendar & client meetings: Microsoft Teams, Google Meet, Zoom, Webex, Jitsi

Every video meeting (Calendar → New meeting, Client meetings, Schedule with AI) now has a **video platform**:

| Platform | What happens when you book |
|---|---|
| **Microsoft Teams** | With a Microsoft sign-in app configured: the meeting is created in the organiser's Outlook calendar with a Teams link, and Outlook sends the invitations (colleagues + client guests). Editing or cancelling in PeopleHub updates or cancels it there too. Without one: *Open Teams with this meeting* opens Teams pre-filled (title, time, attendees); paste the join link back. |
| **Google Meet** | With a Google sign-in app configured: created in the organiser's Google Calendar with a Meet link (`conferenceDataVersion=1`, `sendUpdates=all`). Without one: *Open Google Calendar with this meeting* / *Instant Meet link*, then paste. |
| **Zoom, Webex** | *Schedule in Zoom/Webex* opens their scheduler; paste the join link (their APIs need a server-side secret). |
| **Jitsi Meet** | Free, no account: a working link is generated instantly (default). |
| **Other link** | Paste any link; Teams, Meet, Zoom, Webex and Jitsi links are recognised automatically. |

Also new:
* **External guests (emails)** on meetings. The client contact's email is added automatically for client meetings.
* **Join Teams / Join Meet / Join Zoom** buttons in the provider's colour (calendar event, meeting drawer, meetings list).
* **Add to calendar**: Google Calendar, Outlook / Microsoft 365, a `.ics` file with attendees, or copy the invite text.
* The old demo links (`meet.peoplehub.demo/...`), which never opened, are mapped to working Jitsi rooms.

**Setup (Super Admin → System settings → Video conferencing)**: default platform, Microsoft *Application (client) ID* and tenant, Google *OAuth client ID*. The card shows the exact redirect URI (`<site>/auth-redirect.html`). Client IDs can also come from `VITE_MS_CLIENT_ID`, `VITE_MS_TENANT` and `VITE_GOOGLE_CLIENT_ID` at build time.
* Microsoft Entra → App registrations: platform *Single-page application*, redirect URI above, tick *Access tokens (implicit)*, delegated Graph permission `Calendars.ReadWrite`.
* Google Cloud: enable *Google Calendar API*, OAuth client of type *Web application* with your site as JavaScript origin and the redirect URI above, scope `.../auth/calendar.events`.

Files: `src/lib/conferencing.js`, `src/components/collab/ConferencingUI.jsx`, `public/auth-redirect.html` (new); `CalendarViews.jsx`, `MeetingsViews.jsx`, `AtsViews.jsx`, `collabActions.js`, `seed.js`, `seedCollab.js`, `SystemSettings.jsx` (updated).

## v8.5 — Employee experience & privacy

1. **My company info** (was *My country rules*); the country card is now **Profile**.
2. **Ask AI about <country>** answers with the country brief: employment policy, leave & holidays, statutory compliance (authorities, data law, social security, upcoming filings, onboarding documents), taxes, and a market profile (capital, business hubs, time zone, key industries, local notes) for all 22 supported countries. It works offline from `src/country/countryBrief.js`, and the live model gets the same facts.
3. **Chat privacy**: conversations are readable only by their members (a `?c=` link to someone else's chat shows nothing), and department channels contain only that department.
4. **Calendar / meetings**: *Colleagues* is now **Invite**, a type-to-search picker (any word of the name, surname, initials, title or department), also used in the AI scheduler and new chat. Teams, Google Meet, Zoom, Webex or Jitsi work for both internal and client meetings (v8.4).
5. **Employees see only their own and involved data**: People and Org chart show their manager, teammates and direct reports (leave status and joining dates only for themselves and their reports), the AI scheduler says "away" instead of showing a colleague's leave, and Client meetings → Clients lists only clients they own or have met.
6. **Performance & goals**: *Goal setting* lets employees **create goals** at any time (category, description, key result, start/due, weight, with automatic rebalancing to 100%). The **Review** tab has a full **self review**: a rating and evidence per goal, overall ratings, achievements, strengths, areas to develop, a saved draft, and resubmission until the manager reviews.
7. **Learning**: **My learning** (upload videos and documents or add YouTube/Vimeo/Loom/web links), **Send for review** to colleagues (notification plus a copyable link), **Shared with me** (watch, rate and comment; the owner is notified), and **Training library** (the company library).
8. **Benefits & wellness → My enrolment**: *Deductions & contributions* for the employee from their country's payroll rules: PF/pension, ESI/health, professional tax, income tax and employer contributions, each with rate, monthly amount and % of gross, plus the health-insurance split and the government rules behind them.
9. **My assets & IT support** in one menu item with two tabs (`/assets` and `/it-support` both work, including notification links).
