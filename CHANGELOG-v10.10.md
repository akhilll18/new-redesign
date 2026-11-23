# EZY HR v10.10 — Clean start + "tell the AI what to do"

Nothing was removed. Every screen, role and look stays the same. The changes are listed below.

## 1. Sample data cleaned up

- A new install now starts as an **empty company with only the Super Admin**:
  - Praveen Kumar M, `praveen.kumar@peoplehub.demo`, password `Points@2026`, security PIN `4321`.
  - There are no sample employees, admins, requests, punches, payslips, jobs, tickets, notifications or company names.
- Settings stay in place so every screen still works on day one: pay rules, payslip designs, offer-letter fields, billing plans, shifts and automation rules.
  - Any company-specific wording in them is replaced with `{{company}}`.
- A browser that still holds the old sample data is moved to the clean company once, on its next load.
- New, empty companies created on the server (`db/create-company.mjs`) use the same clean start.
- The old sample company is still available as a **test fixture**:
  - Server: `npm run seed:demo`, used by the 44 API tests and the 10-lakh scale seed.
  - Code: `buildDemoSeed()`.
- Fixes for an empty company:
  - Statutory filing reminders are no longer raised before a legal entity exists.
  - The "sample data shown as at …" note is hidden.
  - Benefits and analytics screens cope with having no data yet.

## 2. AI that does the work (Ask AI → type in plain words)

Type a sentence and the AI fills in a **preview card**. You can check or edit any field, then press **Confirm**, and it is saved through the same rules as the screens:
- validation;
- audit log;
- approvals;
- role permissions.

Reports, counts and "open a screen" run straight away.

| Say… | It does |
|---|---|
| Create a company Acme Technologies in India | New legal entity |
| Add a Hyderabad office for Acme | Work location plus a geofence (map position and radius filled in) |
| Create departments Sales and Engineering | Org units |
| Add holiday Republic Day on 26 Jan 2027 | Holiday calendar |
| Create a leave type Casual leave with 12 days a year | Leave type (code CAS) |
| Add an expense category Travel with limit 5k | Expense category |
| Add a pay component Night shift allowance 2000 | Pay component, sent for approval |
| Create an HR admin Swathi Rao swathi@acme.in | Admin login (ADM01) with HR access |
| Create employee Ravi Kumar ravi@acme.in as Sales Executive in Sales, salary 40k | Employee (EMP002). Fields the employee form needs are asked for on the card |
| Create a login for Ravi Kumar | Temporary password |
| Change Ravi's designation to Senior Executive / salary to 50k | Employee update |
| Approve Ravi Kumar's account · Approve all pending accounts | Account approval |
| Suspend Ravi Kumar · Reactivate Swathi Rao | User status (Super Admin) |
| Open 2 jobs for Java Developer in Engineering, budget 12 lakh | Requisition |
| Apply casual leave tomorrow (employee) | Leave request |
| My printer is not working (any user) | IT ticket |
| Approve all pending leave requests | Bulk approval |
| Run the headcount report for last month | Report table plus CSV download |
| How many employees are in Sales? · Who is Ravi? | Instant answer |
| Open the org chart | Navigation |

**Understanding the request**
- **Live suggestions with every letter typed.** For example, "cr" suggests Create an employee, Create a leave type and Create a location.
- **Values the AI understands:**
  - names and e-mails;
  - phone numbers;
  - amounts (5k, 12 lakh, 1.2 cr, 6 LPA);
  - dates (26 Jan, tomorrow, next Friday, in 3 days);
  - periods (last month, this year);
  - cities and countries, with their currency and map position.
- **With an AI key** (Settings → AI), Claude reads the sentence. **Without one**, a built-in reader works offline. Both lead to the same preview card.
- **Each role sees only its own actions.** For example, employees cannot create employees, and only the Super Admin can create admins or suspend users.

## Tests
- Browser test: 14 AI commands typed into a clean company all completed, with no page errors. Script: `tools/e2e_ai.py`.
- Every screen opened with no errors on the clean company: Super Admin 73 screens, employee 34 screens.
- Server API tests: 44 / 44 passed on a freshly seeded fixture. See TEST-CASES §11.
