# EZY HR v10.13 — Dropdown lists with (+), new request forms, and "Why EZY HR" on sign-up

Existing screens, tabs, values and approval chains are unchanged. Everything below is added alongside them.

## 1. Dropdown lists (+)
**Super Admin → Users, access & policies → Dropdown lists**

The page lists **every dropdown in the app (350)** and shows where each one gets its choices:

| Choices come from | How many | How to add a value |
|---|---|---|
| **Lists you can grow** (19 lists) | 24 dropdowns | Use **+ Add value** on this page, or **+ Add to …** at the bottom of the dropdown itself |
| Master data (departments, locations, leave types, holidays …) | 70 | **Open to add**, which takes you to the screen where those records are kept |
| People records (employees, managers, admins) | 26 | Values appear as people are added |
| Fixed rule values (status, worker type, tax section …) | 230 | These stay fixed because pay, leave and access depend on them |

**Who can add a value**
- The **Super Admin** can add to every list.
- **Admins** see a **Dropdown lists** menu item with the lists that belong to their work. They can also use the **+** inside those dropdowns:
  - **HR:** grades, notice periods, letter types, exit reasons, WFH, overtime and grievance reasons, document categories, candidate sources, learning.
  - **Finance:** travel modes and purposes, off-cycle payroll reasons.
  - **IT & assets:** asset categories, asset return conditions, IT purchase categories.
- Employees see the new values but get no **+**.

**What happens when a value is added**
- It appears in **every dropdown that uses that list**, for every role.
- It is written to the audit log.
- Duplicates are refused.
- Added values (shown in green) can be removed. Records that already use a removed value keep it.

**Keeping the count current:** `scripts/dropdown-inventory.mjs` rebuilds the list of dropdowns on every `npm run build`.

## 2. New request forms
**Employee → Requests & forms**

There are five new forms. Each one runs on the approval engine: it follows the chain set in Approval workflow, uses the manager's inbox, admin approvals and notifications, and is audited.

| Form | Default chain |
|---|---|
| Work from home | Reporting manager |
| Travel request | Reporting manager → Finance admin |
| Overtime claim | Reporting manager → HR admin |
| Letter request | HR admin |
| Grievance / speak-up | HR admin; **never** shown to the reporting manager |

- Their reason, mode, purpose and category dropdowns are growable lists, so the Super Admin and the owning admin can add values with **+**.
- All five forms are added to the Approval workflow screen, so the Super Admin can change any of their chains.

## 3. Sign-up page: "Why EZY HR" panel and comparison
**Right-hand panel**, with a switch:
- **For your company** (dark teal):
  - the 15 modules from the comparison list, in four groups: Core HR & Payroll, Time & Workforce, Talent, Self-Service & Documents;
  - five benefits: AI that does the work, your own approval chains, India statutory and 22-country payroll, IT service desk, every device.
- **For your employees** (warm orange): payslips in your pocket, requests in a few taps, an assistant in 15 languages, advances and loans, recognition, learning, speaking up safely, benefits and wellness.

**Under the form:** an "At a glance" card with coverage bars comparing EZY HR (20 of 20) with:
- payroll-first tools;
- recruiting-only tools;
- performance tools;
- enterprise HCM suites.

**Comparison table:** opens from **Compare with other HR software**, and also appears below the plans on the pricing step together with a "Good for your employees, too" band.

**How the other software is described:** by product type, using examples from the vendor list, based on vendors' public descriptions and stated as such on the page. There are no claims about any single product.

## 4. Module coverage by role
Every module from the comparison list was checked against each role: employee, manager, HR, Finance and IT admin, and Super Admin. See TEST-CASES §14. No module was missing, and no existing tabs were moved.

## Tests (browser)
- **Dropdown lists:**
  - The page shows 350 dropdowns.
  - **+** works from the page and from inside a dropdown, and duplicates are refused.
  - HR sees 13 lists, IT/assets sees 3, and employees see new values without the **+**.
- **Forms:** all five were sent from the UI and reached the right approvers. The grievance never reached the manager, and all five ended Approved.
- **Screens:** every screen opened with no errors:

  | Role | Screens |
  |---|---|
  | Super Admin | 74 |
  | HR | 46 |
  | IT | 16 |
  | Finance | 35 |
  | Manager | 41 |
  | Employee | 37 |

  The clean company also opens with no errors.
- **Regression:** the approval-chain, chain-builder and AI tests (14 of 14 commands) passed again.
