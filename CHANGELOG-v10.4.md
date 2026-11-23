# EZY HR v10.4 — role alignment

## Navigation (all roles)
- Every sidebar entry is now a hub with sub-tabs at the top of the page. Each screen lives in exactly one hub, so there are no duplicate tabs. All earlier screens are kept; old links still work.
- The breadcrumb shows EZY HR / hub / tab.

## Employee
Home · Inbox & notifications · My profile (Core HR, Contacts, Employment, Workforce & devices, Contract & engagement*, My contract & e-sign*, Pay & statutory, Documents, BGV*, Onboarding*, Privacy & my data, Country space, My sign-in activity) · Calendar (Internal calendar, Meetings) · Attendance (Attendance, Leave, My activity, Timesheet, My calls*, Contractor timesheets*) · Talent & recognition (Performance & goals, People & recognition, Learning) · Pay & benefits (My payslips, Manage tax/salary/loan, Expenses & travel, Benefits & wellness*, My spend card*) · Relocation & visa · Org chart & people · Quick support (Chat, HR support, IT support & my assets, Mobile app) · IJP (Internal job postings, Relocation requests) · Resignation & exit · My team (managers).
(* shown only when it applies to the person.)
- The monitoring consent from My activity was merged into Privacy & my data.
- Home: new Quick info row (meetings today, inbox, latest payslip, documents, IT tickets, internal jobs, my requests) and a "Meetings for today" card; clicking a meeting opens its details.
- "Client meetings" is renamed "Meetings".

## Leave
- Interns, contract and freelance workers have a 0-day balance on every paid leave type (`settings.zero_leave_worker_types`) and get request-level options: planned time off, sick/medical, half day and unpaid.

## IJP (new)
- Employees apply to internal or client-project postings as a lateral move or a position upgrade, can request an upgrade without a posting, and can raise relocation requests to client locations or company locations.
- HR and Super Admin see all of this under Hire & onboard → IJP & internal moves, where they publish postings, shortlist, select or reject, and approve relocations. The employee and their manager get a notification at each step.

## HR admin / Finance admin
- HR: Dashboard, Inbox, All approvals (its own tab), Oversight · task authorisation (All activities, Escalated requests), Core HR, Hire & onboard, Pay & benefits (high level only: Payslips, Benefits, Wellness), Compliance, Talent, Time & workforce, Reports & AI automation. Payroll Agent, payroll, payroll entities, expense hub, spend cards, integrations and companies are removed for HR.
- Finance: Dashboard, Inbox, All approvals, Core HR (unchanged actioning data), Pay & benefits, Compliance, Time (attendance for pay), Reports & AI automation (Reports, AI automation, Integrations). HR screens are removed.
- My employee space: admins (and a Super Admin linked to an employee) open their own employee login and return through "Back to admin workspace". Both moves are audited.

## Super Admin
- Same features, grouped into hubs, plus All approvals · task authorisation (requests, all activities, audit log) and IJP.
- Users & access → Admins: access profile (Employee + HR admin, Employee + Finance admin, Employee + HR + Finance admin, or Custom), the employee record linked to the admin, and a country & language switch. Without that switch, HR and Finance admins don't see the country or language selectors and work across all countries.
- Super admins can link their own employee record.

## Brand
- New EZY HR logo in Ezyo colours with the sub-tag "AI-enabled HRMS by [Ezyo logo]" (`src/components/brand/EzyHrLogo.jsx`, `public/brand/ezyhr-logo.svg`). The ONAS logo was removed from the sidebar and login page, and product strings now say EZY HR.

## v10.4.1
- "Meetings today" is now a square box at the end of the overview row on every dashboard (employee classic and glass, HR, Finance, Super Admin). Clicking it lists today's meetings, and clicking a meeting opens its full details. The wide "Meetings for today" card was removed.
- Two-level sidebar: a dark main rail with the sections, plus a sub-menu panel beside it listing the active section's screens. On phones, the screens open nested under the section in the menu.
- Logo: the swirl symbol in front of the wordmark was removed, so it reads "EZY HR", with "AI-enabled HRMS by [Ezyo logo]" underneath.

## v10.5
- **My files:** My profile → Documents → My files holds every document HR uploads for an employee (letters, contracts, payroll & tax, policies…), for all worker types: permanent, contract, freelance, intern and others. HR and Super Admin upload to one person or a group.
- **Document requests** (Talent & recognition): ask internal employees for a document, one by one or as a group (department, location, worker type, team, everyone). Replies land in each person's My files.
- **Exit steps:** 4. Letters, then 5. Full & final.
- **Sidebar:** the profile block at the bottom of the sidebar was removed.
- **All approvals under My team** for reporting managers, HR / Finance admins and the Super Admin, plus an "Approvals pending" box on their home page (not shown to other employees).
- **Page labels:** removed code-style labels such as "ADM01 · LEAVE · ACCOUNTS · …" and "OVERSIGHT · ALL ACTIVITIES · HR".
- **HR admin:** the "On leave today" box was removed. The HR dashboard now has a profile card, today's time and punch, average daily working hours, on-time arrival, team attendance today (Present / Absent / Late), leave approvals pending (approve / reject in place, My requests), company attendance and employee absenteeism.
- **All activities:** the Today / In range / Pay & finance / People involved boxes are now clickable filters, and activities show in plain words with categories.
- **Bulk uploads** (Core HR → Bulk uploads, HR admin and Super Admin): three sections — data loaders (bulk employee, Core HR, Contacts, Employment, Workforce & devices, Contract, Pay & statutory, right to work / BGV, shifts, logbook, leave balance, earned leave and events, absence, family / emergency contacts, bank, salary, job history, maternity / paternity, paid expenses, leaver, assignment, ATS applicant, timesheet, advance), employee settings, and salary and leave. The flow:
  1. Download a prefilled Excel or CSV, filtered by company, location, department, job role, grade or employment type, with specific people included or excluded.
  2. Edit and upload it.
  3. Validate: tabs show existing records, consolidated, valid, errors and warnings.
  4. Load it as a one-time or a frequent (recurring) load.
  Every run is kept in Load history.
- **Reports:** a tile-based report centre with the missing reports added: monthly attendance summary and detail, monthly assignment detail, missing clock-in / clock-out, staff turnover, headcount overview, holidays booked and others.
- **Calendar:** tabs renamed to Internal meetings and Client meetings.
- **PF & income-tax portals** (Pay & benefits, for HR, Finance and Super Admin): connect TRACES (TAN) and EPFO (establishment). Request Form 16 Part A from TRACES, combine it with Part B from payroll, download it, or publish each employee's certificate to their My files. Build the monthly PF ECR file, download it, upload it to EPFO and record the TRRN. This build uses a sandbox connector; the password / DSC PIN is used only to verify and is never stored.
