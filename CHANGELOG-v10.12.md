# EZY HR v10.12 — Every approval chain for every request type, plus your own chains (+)

The approval chains already in use are unchanged.

## 1. Same chain list for every request type
Super Admin → Policies & rules → Approval workflow.

Every request type now offers the same choices:
- Leave
- Expense claim
- Advance
- Salary loan
- Attendance correction
- Asset request
- Screen-off time claim
- Asset purchase request
- IT support

The choices are:
- Reporting manager → IT admin → HR admin → Finance admin
- Reporting manager → *module admin*
- Reporting manager only
- *Module admin* only
- Reporting manager → IT admin → Finance admin
- Reporting manager → IT admin

The *module admin* depends on the request type:
- **HR admin:** leave, attendance correction and screen-off.
- **Finance admin:** expense, advance and loan.
- **Asset admin:** asset and asset purchase requests.
- **IT admin:** IT support.

For IT support, "Reporting manager → IT admin" covers both the module-admin choice and the named one, so it is listed once.

## 2. Add your own approval chains (+)
You can open the builder in two ways:
- **Add approval chain** at the top of the screen.
- **Add another approval chain…** at the bottom of any dropdown. This ticks that request type for you.

**Building a chain**
- Add steps in order from these building blocks:
  - Reporting manager
  - Module admin
  - IT admin
  - HR admin
  - Finance admin
- The builder checks three rules:
  - the reporting manager can only be the first step;
  - each approver can appear only once;
  - a chain has 1–6 steps.
- Optionally tick the request types that should use it.

**After you add it**
- The new chain is saved and audited.
- It appears in **every** request type's list, marked "Custom".
- It is listed under "Your approval chains", which shows where each chain is used.
- A chain that is in use cannot be removed until those request types are moved to another chain.

## 3. IT support follows any chain
Before, IT support could only use "reporting manager first". It now follows whichever chain is set.
- The ticket waits for every approver in the chain, for example Manager → HR → Finance, and then joins the IT queue. The SLA clock starts at that point.
- IT admin steps are the IT queue itself.
- Critical issues and security incidents still go straight to IT.

## Tests
- **Dropdowns (browser):** all 9 dropdowns list the six chains and the "Add another" item.
- **Custom chain:** I built Manager → HR → Finance with the **+** builder and applied it to Leave and IT support. Expense was unchanged.
- **Approvals:**
  - A leave request and an IT ticket each went through manager → HR → Finance.
  - The ticket opened for IT only after the last approval.
- **Removing chains:** a chain in use could not be removed.
- **Regression:** the v10.11 chain test passed again.
- **Screens:**
  - Super Admin, sample company: 73 screens, no errors.
  - Super Admin, clean company: 73 screens, no errors.
  - Employee, sample company: 36 screens, no errors.
