# EZY HR v10.15 — Every employee-form dropdown matched to Dropdown lists, + Add new in place, Create a dropdown

Built-in values, rules, screens and tabs are unchanged. Values already saved on employees keep working.

## 1. The 37 dropdowns on the employee form, matched
The field list (Super Admin → People & organisation → **Field reference**) has a new **Dropdown list** column. It shows how each dropdown is filled and how it can be extended, using the same terms as **Dropdown lists**.

| How it grows | Dropdowns |
|---|---|
| **Grow with +** (13). Any value can be added in the form or in Dropdown lists. | Grade, Work schedule, FTE, Blood group, Probation status, Notice period, Method of recruitment, Background check, Right to work, Shift, Overtime rate, On expiry, Payment mode |
| **Master data · + Add new** (5). The Super Admin creates the record in place: the form behind stays open and the new record is picked. | Department, Company (legal entity), Location / branch, Work location (geofence), Staffing vendor |
| **People records** (2). | Reporting manager, Timesheet approver |
| **Fixed rule values** (17). The column says which rule each one drives. | Worker type, Gender, Country, Work state / region, Leave policy, Expense policy, Attendance method, Field staff, Call tracking, Potential, Pay basis, How they are paid, GST registered, Tax withholding (TDS), NDA signed, Pay cycle, Tax regime |

**New in this release:** 10 of the 13 growable lists. Grade, Notice period and Method of recruitment were already growable in v10.13.

**Extra checks for some growable lists:**
- FTE accepts 0.1–1.0.
- Overtime rate accepts 1–4×.

**Custom values are handled safely wherever these fields are used:**
- **Payment mode:** shown on payslips as typed.
- **On expiry (contracts):** a custom option is shown as typed and treated like "Review" in the contract text.
- **Shift:** a custom shift uses the 09:45 late-mark grace time.
- **Probation status:** any status other than "Confirmed" still raises the probation reminder.

**Other updates:**
- The Field reference has a **Dropdowns only** filter and dropdown counts.
- Its Excel export includes the Dropdown list column.

## 2. Create a dropdown (Super Admin)
**Super Admin → Dropdown lists → Create a dropdown**

**Setting one up:**
- Give it a name and its values (one per line, or separated by commas).
- Choose the employee-form section it appears in.
- Choose who can fill it in: Super Admin, HR admin, and the employee on My profile.
- Choose whether it is required.

**Where it appears:**
- the employee form, in the chosen section;
- the employee's profile;
- the Field reference, marked "Custom";
- the employee-master export, as column `cf_<name>`;
- the AI's "create employee" card, when the dropdown is required.

**Values:**
- They grow with **+**, like any other list.
- HR admins can add values too, because the list belongs to HR.

**Checks:**
- The name can't repeat an existing field.
- At least 2 values, and at most 100.
- A required dropdown blocks saving an employee until it is filled.

**Switching off:** the **On the form** switch hides a dropdown; it is never deleted. Saved values stay on the records, and switching it back on brings them back.

**Audit:** creating, switching off and switching on are all recorded in the audit log.

## Tests
**Browser: custom dropdown** ("T-shirt size": S, M, L, XL, required, employee-editable)
- **Creating it:** it was created, and reusing an existing name ("Grade") was refused.
- **Adding a value:** XXL was added with **+**.
- **On the employee form:**
  - it appeared there;
  - saving without it was blocked;
  - M was chosen and saved.
- **Elsewhere:**
  - it showed on the employee's profile;
  - the Field reference listed it as "Custom · grow with +", and the export included it;
  - the employee export had the column.
- **Switching off:** after switching it off, it was gone from the form and the saved value M was kept.

**Browser: Add new department**
- **+ Add new department** in the "Add employee" form created "Customer Success" and picked it.

**Browser: who can change lists**
- The HR admin could add "Route 3" to a custom list but had no **Create a dropdown** button.
- The Finance admin didn't see the HR list.

**Regression**
- All 14 clean-company AI commands passed again.
- Every screen opened with no errors on both the sample and clean companies:
  - Super Admin: 74 screens
  - HR: 46
  - IT: 16
  - Finance: 35
  - Manager: 41
  - Employee: 37

## Known issue in the sample data (not changed)
- **What happens:** every sample employee's **Work phone** is an office landline (+91 40…). The existing rule accepts mobile numbers only, so editing a sample employee asks for a valid work phone before it saves.
- **Who is affected:** only the sample company. New companies start clean.
- **Possible fix:** say if the rule should accept landlines.
