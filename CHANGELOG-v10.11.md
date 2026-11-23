# EZY HR v10.11 — Approval workflows: asset purchase, IT support, automatic set-up

The existing approval chains are unchanged:
- Leave, expense, advance, loan, attendance correction, asset request and screen-off keep the same chains and approvers.
- Requests already in progress keep their steps.

## 1. New: Asset purchase request
Use it to ask the company to **buy** equipment that is not in stock. Employees raise it from **My assets & IT support → Purchase request**, or by asking the AI, e.g. *"Buy 2 Dell monitors for the design team, about 15k each"*.

**Default chain:** Reporting manager → IT admin → HR admin → Finance admin

**Form fields:**
- item;
- category;
- quantity;
- estimated cost per unit (the total is worked out for you);
- needed-by date;
- vendor or link (optional);
- reason.

**At each step:**
- The employee is told who has it now.
- The next approver gets a notification.
- Each admin sees only the step waiting on their own function.
- A rejection at any step ends the request, and the reason is sent to the employee.

## 2. New: IT support approval
**Default chain:** Reporting manager → IT admin

1. An employee raises an IT ticket. It waits for the reporting manager (status "Awaiting manager approval"), and the SLA has not started.
2. **If the manager approves:** the ticket joins the IT queue, the SLA clock starts, and IT admins are notified.
3. **If the manager rejects:** the ticket is closed and the reason is sent to the employee.

Some tickets skip the manager and go straight to IT:
- critical tickets;
- security incidents;
- tickets from employees without an active manager.

## 3. Approval workflow is set up automatically when an admin is created
When the Super Admin creates an admin, that admin becomes the approver for every step that matches their modules. This happens through Users & access or by asking the AI.
- **IT admin:** `it` module.
- **HR admin:** `accounts` module.
- **Finance admin:** `expense` module.

On creation:
- The confirmation lists which chains they now approve.
- Steps already waiting with no working approver (none existed, or that admin was suspended) move to them, and they are notified.
- The same happens when an admin is changed, suspended or reactivated.
- An admin scoped to a top-level unit (e.g. Head Office) covers the whole company, including departments added later.
- An "Employee + IT admin" preset was added to the admin form.

## 4. Super Admin → Policies & rules → Approval workflow
Each request type has its own approval chain, and the screen shows who fills each step now.
- **Asset requests and purchases** can use any of these chains:
  - Manager → IT → HR → Finance
  - Manager → IT → Finance
  - Manager → IT
  - Manager → admin
  - Manager only
  - Admin only
- **IT support** can use either of these chains:
  - Manager → IT
  - IT only

## 5. AI
- "Buy …" / "Raise a purchase request for …" fills the purchase form.
- "Approve all pending purchase requests" works for each approver, and only for the step waiting on them.
- The ticket reply says when it is going to the manager first.

## Tests
- Browser, sample company. The asset purchase went through all four steps: manager, IT, HR, Finance.
  - The IT step had no approver until a new IT admin was created. It was then given to that admin automatically.
  - The IT ticket waited for the manager, then opened with its SLA.
  - Leave still went manager → HR.
  - No page errors.
- Every screen opened with no errors:
  - Super Admin: 73 screens
  - HR: 45
  - IT: 15
  - Finance: 34
  - Manager: 40
  - Employee: 36
