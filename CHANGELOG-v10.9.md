# EZY HR · v10.9.1 — One sign-in form

- **Selector removed:** the Employee / Admin / Super Admin selector is gone from the sign-in page; there is one **Sign in** form for everyone.
- **Fields:** the form asks for the work email, an **Employee or admin code** and the password.
- **Who is signing in follows from the code:**
  - **EMP…** (or any employee code): employee
  - **ADM…**: admin
  - **empty**: Super Admin
- **Missing code:** if someone forgets their code, the message says: "Employees and admins: enter your employee or admin code".
- **Unchanged:** after the first step, one-time codes, the Super Admin PIN, first-time password changes and every screen work exactly as before. Tested in both editions.
- **Server:** background jobs (payroll, attendance roll-up, statistics) are no longer cut off by the 15-second limit meant for interactive requests.

---

# EZY HR · v10.9.0 — Only the Super Admin signs in out of the box

Screens, content, data and look are unchanged; only the sign-in access changed.

## What changed
- **One login to start: the Super Admin** (`praveen.kumar@peoplehub.demo` · `Points@2026` · PIN `4321`).
  - Everyone else (employees, managers, contract staff, HR, Finance and IT admins) keeps their record and all their content, but has **no login** until the Super Admin creates one.
- **Sign-in page:** shows only the Super Admin shortcut under *Demo accounts*.
- **Someone without a login** is told *"You don't have a login yet. Ask your Super Admin to create one for you."* The attempt isn't counted toward a lockout.
- **Users, access & policies (Super Admin):**
  - People without a login carry a small **No login yet** tag.
  - Their action menu shows **Create login** (in place of *Force password reset*). They then sign in with the temporary password **Welcome@123** and set their own password straight away. Admins also confirm a one-time code.
  - **Create admin** works as before for new admins. Only the Super Admin can create or reset an admin's login.
- **Unchanged:**
  - Once someone has a login, every admin and employee screen works exactly as before. All 7 roles were re-checked: 272 screens, 0 errors, in both the browser and database editions.
  - Adding a new employee (Employee database → Add employee) and HR's approval of new joiners from HR sync still give the temporary password **Welcome@123**, as before.
- **Existing browsers:** their saved demo copy is cleaned once (logins removed, records kept). Logins the Super Admin creates afterwards stay.

## Fixes
- **Admin actions:** Unlock / Set active / Suspend / Force password reset / Reset MFA in Users & access acted on the admin's *employee* record (e.g. EMP002) instead of the admin account (ADM01). They now act on the admin account, and a failed action shows an error instead of a success message.
- **Duplicate code:** Ravi Teja (IT admin) moves from EMP016 to **EMP025**, because EMP016 is Tanvi Deshpande in the HR sync feed. HR sync was skipping her.

## For QA
- `server/test/demo-logins.mjs` signs in as the Super Admin and creates logins for any demo people through the same *Create login* (test / demo workspaces only):
  `node test/demo-logins.mjs --tenant demo --password Points@2026 EMP001 EMP007 ADM01`
- **Automated API tests:** 44 pass, including the new TC-LOGIN-01…05.
