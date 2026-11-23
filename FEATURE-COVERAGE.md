# PeopleHub v10.2 — feature coverage

Every point of the all-in-one HR & payroll checklist, the screen that delivers it, and who uses it. The same map is in the app under Super Admin → Feature coverage (`/coverage`).

> Add employee → attendance flows in → payroll runs itself → taxes filed → employee gets the payslip on their phone.

## 1. Payroll that just works

| Requirement | Screens | Roles |
|---|---|---|
| Automatic pay for salary, hourly, overtime, bonuses and commissions | Payroll Agent (`/payroll-agent`), Variable pay (`/variable-pay`), Timesheets → payroll (`/timesheets`) | Finance, Super Admin |
| Automatic tax & statutory deductions per country — India PF, ESI, PT, TDS, LWF; PAYE, Social Security, pension elsewhere | Payroll Agent (`/payroll-agent`), Payroll (country engines) (`/payroll?tab=run`) | Finance, Super Admin |
| Payslips sent automatically and direct bank transfers | Payroll Agent → approve (`/payroll-agent`), Bank payouts (`/payouts`), Payslips (`/payslips`) | Finance, HR, Super Admin |
| Returns and year-end forms (Form 16, W-2, P60…) without manual work | Filings & year-end (`/filings`), Form 16 / 130 (`/payroll?tab=form16`) | Finance, Super Admin |
| Multiple currencies and countries in one system | Global & FX (`/global-payroll`), Country space (`/country`) | Finance, Super Admin |

## 2. Compliance without worry

| Requirement | Screens | Roles |
|---|---|---|
| Rules that update themselves when tax or labour laws change | Rule updates (`/rule-updates`) | Finance, Super Admin |
| Alerts before filing deadlines | Deadlines & alerts (`/compliance-alerts`), Compliance calendar (`/compliance-calendar`) | Finance, HR, Super Admin |
| Audit trails and ready-to-submit reports | Audit pack & trail (`/audit-pack`), Audit log (`/audit`), Reports (`/reports`) | Finance, Super Admin |
| Data privacy compliance (GDPR, India DPDP Act and similar) | Data privacy (`/privacy-center`), Privacy & my data (`/my-privacy`) | Employee, HR, Super Admin |

## 3. Core HR in the same place

| Requirement | Screens | Roles |
|---|---|---|
| One employee record used everywhere | Employee database (`/employees`), People (`/people`) | HR, Super Admin |
| Onboarding with digital documents and e-signatures | Onboarding (`/onboarding`), Offer letters (`/offers`), Documents (`/documents`) | HR, Super Admin, Employee |
| Offboarding and final settlement | Exits & F&F (`/exits`), Resignation & exit (`/my-exit`) | Employee, HR, Finance, Super Admin |
| Leave, holidays and attendance with biometric, mobile or GPS check-in | Live board (`/live-board`), Leave rule-sets (`/leave-rules`), Attendance (`/attendance`), Leave (`/leave`) | Employee, HR, Super Admin |
| Shift scheduling and timesheets that feed payroll | Shift roster (`/shifts`), Timesheets → payroll (`/timesheets`), My shifts (`/my-shifts`) | Employee, HR, Finance, Super Admin |

## 4. Employee self-service

| Requirement | Screens | Roles |
|---|---|---|
| Mobile app — payslips, leave, expenses, tax declarations | Mobile app (`/my-app`), My pay & payslips (`/finances`), Expenses (`/expenses`) | Employee |
| Fewer “where's my payslip?” questions to HR | Payslip-ready alerts (`/notifications`), Ask AI (`/home`) | Employee, HR |

## 5. Ease of use

| Requirement | Screens | Roles |
|---|---|---|
| Setup in days with help moving data from spreadsheets or the old system | Setup & import (`/setup`) | Super Admin |
| A clean, simple screen for non-technical HR staff | AI summary on every page (`/home`), Classic / glass views (`/home`) | Employee, HR, Finance, Super Admin |
| Payroll run in a few clicks | Payroll Agent — one tap (`/payroll-agent`) | Finance, Super Admin |

## 6. Extras that grow with the business

| Requirement | Screens | Roles |
|---|---|---|
| Benefits, insurance and reimbursements | Benefits administration (`/benefits-admin`), Component claims (`/payroll?tab=claims`), Spend cards (`/spend-cards`) | Employee, Finance, Super Admin |
| Performance reviews, goals and appraisals | Performance (`/performance`), Talent management (`/talent`), Performance & goals (`/performance-me`) | Employee, HR, Super Admin |
| Recruitment and applicant tracking | Recruitment (ATS) (`/recruitment`), Background verification (`/bgv`) | HR, Super Admin |
| EOR and contractor payments where there's no legal entity | Global hiring — EOR / CoR (`/global-hiring`), Contract management (`/contracts`), Relocation & visas (`/relocation`) | Finance, HR, Super Admin |

## 7. Connections and reports

| Requirement | Screens | Roles |
|---|---|---|
| Accounting (Tally, QuickBooks, Xero, Zoho Books, SAP), banks and ERP | Integrations & API (`/integrations`) | Finance, Super Admin |
| Dashboards for headcount, payroll cost and attrition | Workforce intelligence (`/insights`), HR analytics (`/analytics`) | Finance, HR, Super Admin |
| Employee expenses, third-party expenses and advances from other apps (Concur, Zoho Expense, Expensify, Happay, Fyle, Rydoo, Navan, MakeMyTrip myBiz, Uber for Business, Amex, Ramp, NetSuite, Dynamics 365, Tally) or CSV | Expense hub (`/expense-hub`), Expenses & travel (`/expenses`) | Employee, Finance, Super Admin |
| Everything segregated by company (legal entity) and location | Companies & locations (`/companies`), Company · location picker (header) | HR, Finance, Super Admin |

## 8. Trust and support

| Requirement | Screens | Roles |
|---|---|---|
| Clear per-employee monthly pricing, no hidden fees | Plan & billing (`/billing`) | Super Admin |
| Local-language support from people who know local payroll law | Expert support (`/expert-support`), Translate (top bar) (`/home`) | Finance, HR, Super Admin |
| Strong security: encryption, role-based access and backups | Security & backups (`/security`), Users & access (`/users`) | Super Admin |

## Reference modules (screenshots & solutions menu)

| Requirement | Screens | Roles |
|---|---|---|
| Payroll Agent — the month from start to one-tap approval | Payroll Agent (`/payroll-agent`) | Finance, Super Admin |
| Attendance live — “X of Y in office right now”, check-in density, live team pulse | Live board (`/live-board`) | HR, Super Admin |
| Leave policies — 50+ controls bundled into rule-sets per team | Leave rule-sets (`/leave-rules`) | HR, Super Admin |
| Performance review cycle with calibration | Talent management (`/talent`) | HR, Super Admin |
| Compliance & reports — health score, due list, applicable laws by class | Compliance health (`/compliance-autopilot`) | Finance, Super Admin |
| Employee app & PeopleXP — culture feed, recognition, pulse, vouchers | PeopleXP (`/people-xp`), Mobile app (`/my-app`) | Employee, HR, Super Admin |
| AI Copilot & workforce intelligence (attrition risk) | Ask AI (`/home`), Workforce intelligence (`/insights`) | Employee, HR, Finance, Super Admin |
| Expense claims & payouts; SpendCards | Expenses & travel (`/expenses`), Spend cards (`/spend-cards`), My spend card (`/my-card`) | Employee, Finance, Super Admin |
| Contractor management, Contractor of Record, Employer of Record, local payroll | Contract management (`/contracts`), Global hiring (`/global-hiring`) | Finance, HR, Super Admin |
| Relocation (visa & work permit) and background checks | Relocation & visas (`/relocation`), Background verification (`/bgv`) | HR, Super Admin |
| APIs and integrations | Integrations & API (`/integrations`) | Finance, Super Admin |

## What each role gets

### Employee

- See payslips, Form 16 and tax on the phone
- Apply for leave in a tap; see balances
- Clock in with GPS + selfie, face or biometric
- Claim expenses with a receipt; spend card if issued
- Submit tax declarations and proofs
- See shifts, ask for swaps, see timesheet hours
- Resign, follow clearance and see the F&F estimate
- Recognise colleagues, daily pulse, redeem points
- Download my data and make privacy requests
- Track relocation / visa
- Ask AI any HR or pay question

### Finance

- Run payroll with the Payroll Agent and approve in one tap
- Enter hourly, overtime, bonus and commission
- Bank payout files per country and mark paid
- Generate and file statutory returns and year-end forms
- Consolidated multi-currency payroll cost
- Approve full & final settlements
- Issue and control spend cards; export to accounting
- Salary journal to Tally / QuickBooks / Xero / Zoho / SAP
- Compliance health, deadlines and alerts
- Contractor and EOR payments
- Headcount, payroll cost and attrition dashboards

### HR

- One employee record used everywhere
- Onboarding with e-sign; offboarding with clearance
- Live attendance board and corrections
- Shift roster and swap approvals
- Leave rule-sets with 50+ controls
- Performance, goals, calibration
- Recruitment (ATS), offers and background checks
- Relocation & visa cases
- PeopleXP insights and manager nudges
- Privacy requests

### Super Admin

- Everything Finance and HR can do
- Users, roles and module access (RBAC)
- Statutory rule updates and auto-apply
- Audit pack and the full audit trail
- Data privacy set-up, retention, breach register
- Setup checklist and data import
- Integrations, API keys and webhooks
- Plan & billing
- Security, encryption status and backups
- Feature coverage map

## v10.3 — Ezyo (everything made ezy · AI-enabled HRMS)

| Requirement | Where | Who |
|---|---|---|
| Country, currency, tax engine frozen to legal entity & registered location; language dropdown, default English | Payroll entities → Frozen defaults; employee form (Country locked to location); header language | Super Admin, Finance, HR |
| Location-wise vs central vs hybrid payroll per legal entity, all possibilities generated, registrations & gaps | `/payroll-entities` | Finance, Super Admin (HR view) |
| Taxes, TDS, payslips in local country & currency | Payslips → Generate (each country's engine); payslip header with entity & registration | HR prepares, Finance & Super Admin approve |
| Web, iOS, Android | PWA + `android/` + `ios/` (Capacitor), phone bottom bar — see MOBILE.md | Everyone |
| Contract & freelance: no pay & payslips, leave balances, spend card — request leave only | Sidebar, `/leave` request-only view, home tile, mobile app page | Employee |
| Benefits & wellness hidden for contract & freelance unless engaged > 1 year | Sidebar rule + AI notice on the anniversary | Employee, HR |
| Ezyo logo and tagline | Sign-in, sidebar, footer, title, app icons, splash | — |
| Finance admin: finance, payment & attendance-for-pay only | Sidebar filter, Finance dashboard | Finance |
| HR sees all activities | `/activity`, `/requests` (read-only, all modules) | HR, Super Admin |
| Palette: dark, light blue, teal, mint #0FFCBE | Whole app | — |
| Granular AI automation | `/automation` — 14 rules, Auto / Review / Off, thresholds, queue, log | Finance, HR, Super Admin |
