# Ezyo HRMS v10.6 — review of 17–20 Nov 2026

The look and feel is unchanged. New features sit under the existing sections, merged screens open inside the screen
they were merged into, and old links still work. Nothing was deleted from the code base.

## Colour by function
Every sidebar section has its own colour. The colour shows on the rail icon, the active item, the sub-menu panel, the
tabs and a bar beside each page title (`src/theme/tones.js`).

| Colour | Meaning | Used for |
|---|---|---|
| Red | Strength, passion, energy | Inbox & approvals, IT tickets |
| Orange | Joy, creativity, stimulation | Hire & onboard, IJP |
| Yellow | Happiness, intellect, light | Attendance, Time & workforce, leave rules |
| Green | Nature, balance, growth | Pay & benefits, HR toolkit, IT purchases |
| Blue | Trust, loyalty, calm | Home / Dashboard, Calendar, Org chart |
| Purple | Power, luxury, noble wisdom | Talent, Reports & AI |
| Pink | Care, sensitivity, playfulness | Support, My team, recognition, daily vibe |
| Brown | Stability, comfort, reliability | My profile, People & organisation, Relocation |
| Black | Elegance, authority, power | Oversight, Platform, Compliance, Users & access |
| Gray | Maturity, intelligence, balance | Resignation & exit |
| White | Clarity, purity, minimalism | Default / neutral |

Layout: grids that left empty columns now fill the row (Ops dashboard, Workforce management after the removal of span
of control), and the employee home has no bar charts.

## Finance admin
- **Inbox, all approvals and notifications are merged** into one *Inbox & approvals* screen. It has tabs for Approvals,
  IT purchases and Notifications. The approvals history tab is now *Approved / all* with a status drop-down
  (All, Approved, Rejected, Pending, Paid, Cancelled).
- **Core HR is renamed *People & organisation*.** The profile section "Core HR" is now *Personal details*.
- **Document requests** sit under People & organisation, so Finance can ask employees for documents. One-tap templates
  cover income-tax proofs (Form 12BB), rent receipts, Form 16, PAN, Aadhaar and cancelled cheque.
- **Companies & locations** moved into a new *Relocation & visa* section, which Finance now sees too.
- **Contract management:** Finance gets *OT approvals (from HR)* instead of the full timesheets.
- **Removed for Finance:** Assets (they now go to IT), Time & workforce, and the Talent screens.
- **Payroll Agent:**
  - A *Data taken for this payroll* panel lists the 10 sources with live counts.
  - There are two runs a month: *Run 1 · Regular* and *Run 2 · Off-cycle / supplementary*.
- **Payroll reports** moved to *Reports & AI automation → Reports → Payroll reports*.
- **Salary components:** a *Payslip field* column shows which components are also payslip fields, and payslip-only
  fields are listed under them, so nothing is kept twice.
- **Expense hub:** "Third party" is renamed *Miscellaneous*.
- **Compliance now sits with Finance.** It gains *Statutory compliances*: all 15 Indian compliance areas, each with a
  monthly tick-off.

## Super Admin
- Inbox, notifications, all requests, all activities and the audit log are one *Inbox & approvals* section.
- **Plan & billing:**
  - It now has two tabs: *My plan* (which includes the feature coverage) and *Explore plans*, with a suggested plan.
  - A plan card also shows on the dashboard.
- **Monitoring policy:** employee consent is removed, and the company policy now covers everyone during work hours.

## HR admin
- **Dashboard:**
  - Average daily working hours and on-time arrival are shown department-wise, with a toggle to see the top 5 people.
  - Team attendance can be filtered to *My team · under me*.
  - Absenteeism uses green, orange and red with a legend.
  - *My recent decisions* is removed.
- **Approvals when the reporting manager is absent or missing** now follow the organisation's choice: next manager up,
  department head, or HR. Set it in Leave rule-sets.
- **Documents & letters** can auto-generate an offer, designation change, resignation acceptance, relieving letter,
  experience letter, F&F statement or payslip as Word, filled from the employee record.
- **Contract management:**
  - The AI contingent-workforce brief is removed.
  - Overtime on a timesheet goes HR → Finance.
  - A *How to raise a vendor invoice* guide was added on Staffing vendors.
- **Exits:**
  - The steps are now Clearance → Notice → Exit interview → F&F.
  - The exit interview is no longer masked: each reviewer's review is shown individually.
- **Recruitment** is renamed *Recruitment · shared profiles*.
- **Offer letters** gain employer ESI (3.25%), employee ESI (0.75%), estimated TDS, the new PF wage rule (₹15,000 cap)
  and PF for senior citizens.
- **Payslips:**
  - A run can be for regular employees, contract workers or both.
  - The tabs are merged: runs + email outbox, fields + upload format, design + settings.
- **Talent:**
  - The tabs are rearranged.
  - HR can set any employee's goals.
  - Learning & development has a *Manual marks update*.
- **Chat & support:** Expert support is Finance only, and *My admin profile* left the menu (it opens from the account
  menu).
- **Time & workforce:**
  - Today's register, the punch log and timesheet & overtime are one tab.
  - The roster is updated from a drop-down in each cell.
  - Employee monitoring is a tab of the live board.
  - HR no longer sees Timesheets → payroll.
  - Span of control is removed.
- **Reports:**
  - Counts say *Employees*, not "rows".
  - Headcount overview and the register are merged.
  - The daily attendance register now includes worked / screen-off / total hours.
  - Screen-off claims and Attendance corrections are removed.
  - *Missing clock-in / clock-out* is available.

## Reporting manager
- Workforce & devices are now part of *Personal details*.
- Documents are available to everyone.
- The team BGV tab is removed.
- *Team summary* adds a team calendar with names on each day (month view or custom dates) and team activity.
- Managers approve their team's shift swaps and shift-time changes.

## Contract workers
- No vertical sub-menu for Inbox.
- *Employment* shows the contract period and end date.
- *My contract & e-sign* is renamed **My contract & payment**:
  - The week grid has days as columns.
  - Week hours and the timesheet history are combined, with custom dates and the worker's sign-in activity.
  - Payments say *Hours* (not "units").
- Location and "record my activity" are on by default.
- *Request leave* shows a rules & regulations box.
- My activity is part of Attendance.
- No shift swap; a shift-time change request is available instead.
- Document requests are under My profile.
- No advance amount (expenses only).
- The org chart shows higher management and their own team.
- IJP is not shown.

## Employees (handwritten notes)
- **Home:**
  - The *How's your vibe today?* pop-up appears after sign-in, once a day.
  - Work anniversaries and birthdays are on the home page.
  - There are no bar charts.
- **Pay & statutory:** a bank-details change request goes to HR; once approved, the record updates and Finance is told.
- **Attendance:**
  - Attendance and my activity are on one screen, with a custom date range.
  - Each day shows the punch-in location and IP address.
- **Leave:** when a balance is exhausted, the extra days become LOP automatically, with a notice.
- **Timesheet & shifts:**
  - Swaps go to the reporting manager.
  - Shift-time change requests are available.
  - Each request's status is shown in the timesheet.
- **IJP:**
  - Each posting has a custom criteria box: tenure, okay to relocate, updated CV, awards & recognition, same location.
  - Position-upgrade requests are removed.
- **Relocation & visa:** the request takes the current location, the location to relocate to (from Companies &
  locations), passport details and the reason.
- **Talent & recognition:**
  - Performance & goals has no upper tab bar; quick links jump to Goals, Review and Feedback.
  - HR can add custom rewards.
  - Recognition posts reach the inbox of the person and their manager.
  - Employees can request learning from My learning.
- **Document requests** moved into Inbox & notifications.
- **Salary loan:**
  - The dialog shows the eligible and default amount, salary bank and take-home.
  - It asks for a payslip upload, PAN and the last 4 digits of Aadhaar, and shows previous loans.
  - Finance confirms the amount the employee gets.
- **Benefits:** the meal card is removed.
- **HR support:** one quick-response card with the TAT — HR 1 working hour, IT 1 working day. The repeated "contact"
  banners are removed.

## IT admin (new access profile, demo login ravi.teja@peoplehub.demo / Points@2026)
- Asset requests and asset approvals now go to IT, not Finance.
- The *IT service desk* holds the IT ticketing tool, *IT purchase approvals* and *Assets & allocation*.
- Employees raise IT purchases from *IT support & my assets*. They go **IT → HR → Finance**, and each stage is notified.
- IT admins get their own dashboard.

## HR toolkit & reference screens
- **HR toolkit · templates** has 56 ready-to-use items, covering every item of the toolkit reference:
  - The groups are policies, templates, forms, SOPs, checklists, letters, reports, HR Excel tools and the premium
    bonuses.
  - Excel tools have working formulas, and many can be filled with your company's data.
- **Tasks & projects** (admins) and **My tasks** (employees) sit under the Calendar section.
- **WhatsApp Business:** you can apply for and approve leave on WhatsApp. Set it up in Integrations → Messaging.
- **AI automation** gains 6 rules from the HR automation ideas: IT ticket triage, payroll anomalies before payday, early
  attrition signs, IT purchases stuck at a stage, fairness checks on approvals, and weekly feedback themes.
- *Plan & billing → My plan → Feature coverage* maps every reference-screen feature to its screen.

## Waiting for Praveen's clarity (not changed)
Override task authorisation, global hiring, PF & income-tax portals, team call tracker, notification changes ("on
hold"), bulk-upload Excel opening ("hold") and the BGV module re-check.
