# EZY HR · v10.7.1 — change log

## v10.7.1 · IT admin branding
- Signing in as an **IT admin** now shows the **EZY Service Desk** logo, with the tag **"AI Enabled Service Desk by [Ezyo logo]"**.
  - It appears in the side bar (full and collapsed), the breadcrumb, the page footer and the browser tab title.
- All other sign-ins keep **EZY HR · AI-enabled HRMS by Ezyo**.

---

# v10.7.0

The look and feel is unchanged. New items sit under the existing menus and keep the colour-by-function palette.

## Before sign-in
- **Contact page → Employee count → Pricing & subscription → Sign in** (`/welcome`).
  - Visitors who are not signed in now land here first.
  - **Pricing** is worked out from the employee count, has a monthly/annual switch (annual = 2 months free) and marks the best-fit plan.
  - The sign-in page links back with "New to EZY HR? Contact us & see pricing".
  - The **Super Admin** sees every enquiry (contact, employee count, plan, monthly estimate) under *Platform → Chat with EZY Support*.

## All logins
- **Inbox & notifications:** Inbox, Notifications (and Document requests where applicable) are now **items in the side bar**, not a tab row.
- **My sign-in activity** is removed from My profile.
- **My employee space / Back to admin workspace:** shown first in the side bar for every admin and the Super Admin, so each can work as an employee and as an admin.
- **Language and legal-entity selectors:** shown only to **HR admins and the Super Admin**.
  - The chosen company and location filter every dashboard statistic, list and report.
  - Finance and IT admins always see everything they have access to.
- **Work anniversaries & birthdays** appear on every home page: the employee home (glass and classic), the admin and HR dashboards, the IT dashboard and the Super Admin home.

## Employee
- **Documents → My files:** the background-verification documents (BGV-0001…) block is removed.
- **Privacy & my data → Your consent:** now **mandatory**. The switches are on and locked, marked "Mandatory · company policy".
- **Calendar & tasks → Leave & holidays:** request leave and see the holiday list in one place. Country space is removed from My profile.
- **Talent & recognition → Request learning:**
  - **Provider** is now a pick-list of employees, teams and groups (you can still type an outside provider).
  - The **Cost** field is removed.
- **Pay & benefits → Salary loan:**
  - You can request a loan only after **one year of service**, and only once Finance has enabled you. The screen shows the reason when it is not open yet.
  - When Finance approves a loan, **HR admins are notified**.
- **Pay & benefits → Government compliances:** a **+ button** to add PF / ESI / NPS / UAN / nomination enrolments. These go to HR for approval, then update the record.
- **Org chart & people → Org chart:**
  - **Higher authorities are shown with their pictures** in a leadership row; team leads and members also show photos.
  - **HR admins and the Super Admin can change any picture** from the chart (camera button).
- **Quick support:**
  - The IT support button and IT TAT are removed from the HR support card.
  - **IT support & my assets** shows the IT response time of **30 minutes to 1 hour**.

## Contract, freelance & intern
- The **Employment** tab is removed. Its fields now sit at the top of **Contract & engagement**:
  - Contract period (contract, start/end, days remaining, on-expiry review)
  - End date, method of recruitment, recruitment cost
  - Background check, right to work, shift
  - HR edits all of these.
- **My contract & payment → Payslips:** contract and freelance payslips (Sep 2026 onward). Each shows fee, overtime, GST and TDS (194J/194C) and downloads as Word.
- **Timesheets:**
  - **Project drop-down**, with **multiple project lines** per week (add or remove).
  - Optional **client approval attachment**.
  - **Public holidays are blocked.** HR controls this in Contract management → Settings ("Block timesheets on public holidays"), along with the project list.
- The **Document requests** tab is removed.

## HR admin
- **Oversight · task authorisation** tab removed.
- **Bulk uploads:** "Bulk employee data upload" removed.
- **Documents & letters → Auto-generated letters & documents:**
  - **Upload your own format:** a Word .docx with `{placeholders}`, or .txt/.html. Generate letters from it, or from the built-in format.
  - Choose **individuals, ticked groups, a whole department or All**, with **search**. One person gives a .docx; several give a .zip of Word files.
  - The placeholder list is shown on screen, and any employee field also works (e.g. `{pan}`, `{uan}`).
- **Background verification:**
  - Start BGV for **many employees at once**: multi-select search, or **names/codes separated by commas**.
  - Anyone with an open BGV is skipped.
- **HR toolkit · ready-to-use templates:**
  - Downloads are filled with **live data**.
  - **Upload filled** on every template sends the file to a **review list** (Approve / Send back).
  - **Your organisation's templates:** upload, store, download and remove your own formats by category.

## Finance admin
- **Auto-generated letters:** **Payslips only**, in the built-in or your own uploaded Word format.
- **HR toolkit removed.**
- **Pay & benefits → Salary loan access:**
  - Switch the loan request on or off per employee. It is eligible only after 1 year of service.
  - Optionally enable it automatically at 1 year.

## IT admin
- **HR toolkit removed.**
- My employee space is now available.

## Super Admin
- **All admin data flows to the Super Admin:** salary loan access, employee requests (enrolments, learning, bank changes), BGV, letters, toolkit reviews and organisation templates, contract settings and every audit entry.
- **Platform → Chat with EZY Support:** a support chat with ticket numbers, quick topics, and the list of website enquiries.

## Checks
- The production build is clean.
- An automated walk through every menu item for 7 sign-ins opened **273 screens with 0 errors**: employee, manager, contract worker, HR admin, Finance admin, IT admin and Super Admin.
