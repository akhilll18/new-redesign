# EZY HR v10.8 · Test cases for 10 lakh employees

How the application was tested on a company of **10,02,000 employees** (workspace `scale`), the demo company (`demo`)
and a brand-new company that starts with one Super Admin (`acme`).

**Status key**: ✅ passed in this release · 🤖 automated (re-run any time) · 🖐 manual / environment check before go-live

**Test bed**: 2 vCPU · 7 GB RAM · PostgreSQL 16 + API + load generator on one machine. Data: 10,02,000 employees,
2.67 crore attendance days, 3 lakh requests, 5 lakh notifications, 10 lakh audit rows, 19.8 lakh payslips (~10 GB).

## How to re-run

```bash
cd server
npm run seed:demo && npm run seed:scale -- --employees 1000000      # test data (≈ 4 min)
DEMO_OTP=1 LOGIN_RATE_PER_MIN=1000 npm start &                       # test mode: OTP returned in responses
node db/seed-demo.mjs --reset                                        # fresh fixture before each test run (tests create logins)
node --test test/api.test.mjs                                        # 44 automated API tests (🤖)
npm run bench -- 15 50                                               # load test → bench/results.json
node test/demo-logins.mjs --tenant demo EMP001 ADM01 …               # Super Admin creates demo logins (v10.9: none exist at first)
```

The browser crawls (every screen for every role, browser and server mode) use Playwright with Chrome; see §9.

---

## 0. Only the Super Admin signs in out of the box (v10.9)

| ID | Case | Expected | Result |
|---|---|---|---|
| TC-LOGIN-01 | Employee without a login signs in (6 times) | "You don't have a login yet. Ask your Super Admin…"; no attempts counted, no lock-out | ✅🤖 |
| TC-LOGIN-02 | Admin without a login signs in | same message | ✅🤖 |
| TC-LOGIN-03 | HR admin tries to create an admin's login | refused (Super Admin only) | ✅🤖 |
| TC-LOGIN-04 | Super Admin → Create login → person signs in with Welcome@123 → sets own password | signed in | ✅🤖 + ✅ browser (both editions) |
| TC-LOGIN-05 | The app shows who has a login | "No login yet" tag; no password data leaves the server | ✅🤖 |
| TC-LOGIN-06 | Sign-in page | only the *Super Admin* shortcut | ✅ |
| TC-LOGIN-07 | Every screen once logins exist | 272 screens, 0 errors (browser and database editions) | ✅ |

## 1. Sign-in & sessions

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| TC-AUTH-01 | Employee sign-in | workspace + login ID + employee code + password + captcha | lands on Home | ✅🤖 |
| TC-AUTH-02 | Wrong employee code | correct password, wrong code | refused, attempt counted | ✅🤖 |
| TC-AUTH-03 | Admin one-time code | admin password → OTP; wrong OTP | asked for OTP; wrong OTP refused | ✅🤖 |
| TC-AUTH-04 | Super Admin OTP + PIN | right OTP, wrong PIN | refused "security PIN is not right" | ✅🤖 |
| TC-AUTH-05 | Locked account | sign in as a locked user | 423 "account is locked" | ✅🤖 |
| TC-AUTH-06 | Waiting for approval | sign in before HR approves | refused with the approval message | ✅🤖 |
| TC-AUTH-07 | First sign-in | temporary password | forced to set a new one; same password refused | ✅🤖 |
| TC-AUTH-08 | No / forged token | call API without or with a tampered token | 401 | ✅🤖 |
| TC-AUTH-09 | Sign-out revokes | sign out, reuse token | 401 | ✅🤖 |
| TC-AUTH-10 | Unknown workspace | sign in to a workspace that doesn't exist | refused; sign-in page says "No workspace with that ID" | ✅🤖 |
| TC-AUTH-11 | Lock-out after N failures | 5 wrong passwords | account locks, Super Admin notified | ✅🤖 |
| TC-AUTH-12 | Old browser passwords | demo users (SHA-256) sign in | accepted once, upgraded to scrypt | ✅🤖 |
| TC-AUTH-13 | Password change ends other sessions | change password on phone | laptop session signed out | ✅🤖 |
| TC-AUTH-14 | Sign-in rate limit | 21 sign-ins / minute from one IP (`LOGIN_RATE_PER_MIN`, default 20) | 429 | 🖐 |
| TC-AUTH-15 | Session timeout | idle past the company timeout | signed out with reason | 🖐 |

## 2. One login creates everything (fresh company)

| ID | Case | Expected | Result |
|---|---|---|---|
| TC-ONB-01 | `create-company.mjs` makes workspace `acme` | only **one** sign-in exists (Super Admin), standard leave types / pay components / templates present, no demo people | ✅ |
| TC-ONB-02 | Super Admin signs in (OTP + PIN) and opens Users & access → **Create admin** | admin ADM01 saved in the database with a temporary password | ✅ (browser) |
| TC-ONB-03 | New admin's first sign-in | OTP → forced new password (scrypt) → admin workspace | ✅ (browser) |
| TC-ONB-04 | Super Admin adds an employee and approves the account | employee row active, `must_reset` on | ✅ |
| TC-ONB-05 | New employee's first sign-in | temporary `Welcome@123` → new password → Home | ✅ (browser) |
| TC-ONB-06 | Demo shortcuts | shown for `demo` / `scale`, hidden for `acme` | ✅ |
| TC-ONB-07 | Two admins add people at the same moment | second one gets the next free code, app shows "Saved with a new code" | ✅🤖 (TC-SYNC-06) |
| TC-ONB-08 | Pricing page creates a company (`ALLOW_SIGNUP=1`) | workspace + Super Admin created, sign-in works | 🖐 |

## 3. Privacy & data loading

| ID | Case | Expected | Result |
|---|---|---|---|
| TC-DATA-01 | Password / PIN hashes never reach the app | none in any app payload | ✅🤖 |
| TC-DATA-02 | Colleague's salary & bank | employees see 0 / blank for others, their own figures for themselves | ✅🤖 |
| TC-DATA-03 | Working set on 10 lakh | app loads ≤ 2,200 people, knows the total (10,02,000) | ✅🤖 |
| TC-DATA-04 | Directory name search on 10 lakh | results < 1.5 s, next page by cursor | ✅🤖 |
| TC-DATA-05 | Code lookup `E0500000` | exactly that person | ✅🤖 |
| TC-DATA-06 | Employee tries company export | 403 | ✅🤖 |
| TC-DATA-07 | Employee opens a colleague's profile | no pay, PAN, bank or personal contact | ✅🤖 |
| TC-DATA-08 | Billing headcount on 10 lakh | Plan & billing uses the whole company's active headcount, not the loaded slice | ✅ |
| TC-DATA-09 | Partial-list note | classic Employee master says "Showing 2,100 of 10,02,000" with a link to the directory | ✅ |

## 4. Saving changes (sync) & concurrency

| ID | Case | Expected | Result |
|---|---|---|---|
| TC-SYNC-01 | Employee applies leave | request lands in the manager's inbox (`pending_with` = manager) | ✅🤖 |
| TC-SYNC-02 | Employee forges an approval / someone else's request | rejected | ✅🤖 |
| TC-SYNC-03 | Employee edits own salary | ignored; stored salary unchanged | ✅🤖 |
| TC-SYNC-04 | Employee changes company settings | rejected "only admins change this" | ✅🤖 |
| TC-SYNC-05 | Two admins save different parts of one settings document at once | both changes kept | ✅🤖 |
| TC-SYNC-06 | New record on a taken code | given the next free code, original untouched | ✅🤖 |
| TC-SYNC-07 | Delete audit entry | entry survives (append-only) | ✅🤖 |
| TC-SYNC-08 | HR admin creates an admin | rejected (Super Admin only) | ✅🤖 |
| TC-SYNC-09 | Server unreachable while saving | toast "changes are kept"; retried with back-off; saved when back | 🖐 |
| TC-SYNC-10 | Others' approvals appear | inbox / notifications refresh within 30 s | ✅🤖 |

## 5. 10-lakh scale & performance

| ID | Case | Target | Measured | Result |
|---|---|---|---|---|
| TC-SCALE-01 | Headcount dashboard | < 2 s | 3 ms p50 under load | ✅🤖 |
| TC-SCALE-02 | Approvals inbox with 2,000+ pending | paged 100 at a time | 49 ms | ✅🤖 |
| TC-SCALE-03 | Bulk approve | manager stage → HR, HR stage → approved, employee notified | 20 in 43 ms | ✅🤖 |
| TC-SCALE-04 | Punch storm (biometric upload) | 5,000 punches in one call < 5 s | 128 ms | ✅🤖 |
| TC-SCALE-05 | Employee punches for someone else | saved only for themselves | ✅ | ✅🤖 |
| TC-SCALE-06 | Attendance register for a day | paged with day summary | 380 ms | ✅🤖 |
| TC-SCALE-07 | Export employees CSV | streams; cancelling stops the query | 808 ms to first bytes | ✅🤖 |
| TC-SCALE-08 | Import 2,000 employees CSV | inserted / updated counts | 207 ms | ✅🤖 |
| TC-SCALE-09 | **Payroll for 10 lakh** (LOP from attendance, PF, ESI, PT, new-regime TDS) | < 5 min | **9,91,689 payslips in 96 s** | ✅ |
| TC-SCALE-10 | Bank advice for the payroll batch | CSV streams | ✅ | ✅🤖 |
| TC-SCALE-11 | Sign-in data load, employee | < 1 s | 0.09 – 0.13 s | ✅ |
| TC-SCALE-12 | Sign-in data load, Super Admin | < 2 s | 0.40 – 0.48 s | ✅ |
| TC-SCALE-13 | Load test, 50 users (see table) | 0 errors | 0 errors | ✅🤖 |
| TC-SCALE-14 | Generate 10 lakh test employees + month of attendance | — | 4 min 12 s | ✅ |
| TC-SCALE-15 | Aborted download doesn't leak a connection | no COPY left running | none | ✅ |

**Load test** (`npm run bench -- 12 50`, 50 concurrent users, 12 s each):

| Scenario | Req/s | p50 | p90 | p99 | Errors |
|---|---:|---:|---:|---:|---:|
| Dashboard headcount | 12,662 | 3 ms | 4 ms | 15 ms | 0 |
| Directory — first page | 2,593 | 18 ms | 26 ms | 37 ms | 0 |
| Directory — department filter | 1,567 | 30 ms | 41 ms | 51 ms | 0 |
| Employee profile lookup | 3,450 | 13 ms | 20 ms | 27 ms | 0 |
| Punch in (write) | 4,560 | 10 ms | 15 ms | 21 ms | 0 |
| Approvals inbox | 144 | 326 ms | 434 ms | 636 ms | 0 |
| Directory — name search (common first names) | 63 | 685 ms | 1.1 s | 1.2 s | 0 |
| Employee app start | 18 | 1.05 s | 1.2 s | 1.3 s | 0 |

Fixed during testing: a slow department list (981 ms → index), directory first page (1.1 s → 0.3 ms, sort index),
common-name search (1.8 s → 0.12 s), code search (279 ms → 3 ms), Super Admin data load (1.35 s → 0.31 s),
a database connection leak on cancelled downloads.

## 6. Every screen, every role

| ID | Case | Result |
|---|---|---|
| TC-UI-01 | Browser edition (no server): every menu item for Employee, Manager, Contract worker, HR, Finance, IT, Super Admin | ✅ 272 screens, 0 errors |
| TC-UI-02 | Database edition, demo company: real sign-in per role, every screen | ✅ 272 screens, 0 errors |
| TC-UI-03 | Database edition, **10-lakh company**: real sign-in per role, every screen | ✅ 272 screens, 0 errors |
| TC-UI-04 | Enterprise data screens on 10 lakh (directory, approvals, payroll, import, database health) | ✅ |
| TC-UI-05 | Salary loan access with a missing joining date (imported data) | ✅ shows "Joining date missing" (crashed before the fix) |
| TC-UI-06 | Inbox with requests that came in without expense lines | ✅ shows the total (crashed before the fix) |

## 7. Multi-company isolation & security

| ID | Case | Expected | Result |
|---|---|---|---|
| TC-SEC-01 | A token for `demo` can't read `scale` | every query is filtered by the token's workspace | ✅🤖 |
| TC-SEC-02 | BI login without `app.tenant` | row-level security returns nothing | 🖐 |
| TC-SEC-03 | AI endpoint without sign-in | 401; the Claude key never reaches the browser | ✅ |
| TC-SEC-04 | `DEMO_OTP` off in production | no one-time code in responses | 🖐 |
| TC-SEC-05 | HTTPS, HSTS, backups, restore drill | per your infrastructure | 🖐 |

## 8. SEO

| ID | Case | Expected | Result |
|---|---|---|---|
| TC-SEO-01 | Public pages have real URLs | `/`, `/pricing/`, `/contact/`, `/service-desk/`, `/login/` return HTML (200), `/pricing` → 301 | ✅ |
| TC-SEO-02 | Unique title, description, canonical, Open Graph, Twitter per page | yes, filled with the site's address | ✅ |
| TC-SEO-03 | Structured data | Organization, WebSite, SoftwareApplication with 3 INR offers, BreadcrumbList, FAQPage (pricing) | ✅ |
| TC-SEO-04 | `robots.txt` & `sitemap.xml` | sitemap lists the public pages; `/api/` disallowed | ✅ |
| TC-SEO-05 | Signed-in screens | own title per screen ("Leave & holidays · Calendar & tasks · EZY HR"), `noindex, nofollow`, no canonical | ✅ |
| TC-SEO-06 | Lighthouse, `/pricing/` | SEO 100 · accessibility 96 · best practices 93 · performance 86 (LCP 1.4 s) | ✅ |
| TC-SEO-07 | Lighthouse, `/` | SEO 100 · accessibility 96 · best practices 93 · performance 89 (LCP 1.6 s) | ✅ |
| TC-SEO-08 | Search Console: submit sitemap, URL inspection | indexed after go-live | 🖐 |

## 9. Mobile & devices

| ID | Case | Result |
|---|---|---|
| TC-MOB-01 | Android / iOS app → Connect to a server → sign in | 🖐 (needs a device build) |
| TC-MOB-02 | Geofenced punch from the phone lands in `punches` | 🖐 |
| TC-MOB-03 | App offline → reopen → shell loads from cache | 🖐 |

## 11. Clean start & AI actions (v10.10)

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| TC-AI-01 | Clean start | Open the app in a new browser | Only the Super Admin exists. No sample people, requests or notifications. Every screen opens. | ✅ 73 + 34 screens, 0 errors |
| TC-AI-02 | Old data upgraded | Load with v10.9 sample data in storage | Moved once to the clean company | ✅ |
| TC-AI-03 | Live suggestions | Type "cr" in Ask AI | Create employee / leave type / location suggested | ✅ |
| TC-AI-04 | Create company | "Create a company Acme Technologies in India" → Confirm | Company saved, INR | ✅ |
| TC-AI-05 | Create location | "Add a Hyderabad office for Acme" → Confirm | Location plus geofence (lat/lng/radius) | ✅ |
| TC-AI-06 | Departments, holiday, leave type | 3 commands → Confirm | Saved with correct date and code | ✅ |
| TC-AI-07 | Create admin | "Create an HR admin Swathi Rao swathi@acme.in" | ADM01 with HR modules and a temporary password | ✅ |
| TC-AI-08 | Create employee | "Create employee Ravi Kumar ravi@acme.in as Sales Executive" | Missing required fields asked for on the card; EMP002 pending approval | ✅ |
| TC-AI-09 | Job | "Open 2 jobs for Java Developer in Engineering, budget 12 lakh" | Requisition, 2 openings | ✅ |
| TC-AI-10 | Report & count | "Run the headcount report" / "How many employees are in Sales?" | Table plus CSV / instant answer | ✅ |
| TC-AI-11 | Approve & suspend | "Approve Ravi Kumar's account", "Suspend Ravi Kumar" | Active, then suspended | ✅ |
| TC-AI-12 | Navigation | "Open the org chart" | Org chart opens | ✅ |
| TC-AI-13 | Permissions | As an employee, type "Create an employee" | Not offered and not run; "apply casual leave tomorrow" still works | ✅ |
| TC-AI-14 | Nothing saved without Confirm | Press Cancel on a card | No change, no audit entry | ✅ |

## 12. Approval workflows (v10.11)

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| TC-WF-01 | Existing chains untouched | Employee applies leave | Reporting manager → HR admin, as before | ✅ |
| TC-WF-02 | Asset purchase chain | Employee raises a purchase request; manager, IT, HR and Finance each approve | Moves step by step, then Approved. Notifications at each step. | ✅ |
| TC-WF-03 | Only your own step | HR admin opens "approve all" while the purchase is at the IT step | Not offered to HR; "This step is waiting for the IT admin" | ✅ |
| TC-WF-04 | Reject mid-chain | HR admin rejects with a reason | Request rejected; employee told the reason | ✅ |
| TC-WF-05 | IT support chain | Employee raises a ticket | Awaiting manager approval, SLA not started. Approved → open with SLA, IT notified | ✅ |
| TC-WF-06 | Urgent IT bypass | Critical or security ticket | Goes straight to IT | ✅ |
| TC-WF-07 | Auto set-up on admin create | IT admin suspended, purchase waiting at the IT step; Super Admin creates a new IT admin | Confirmation lists the chains; waiting step moves to the new admin, who is notified | ✅ |
| TC-WF-08 | Change chain | Super Admin sets Asset purchase to Manager → IT → Finance | New requests use it; open ones keep their steps | ✅ |

## 13. Approval chain choices and custom chains (v10.12)

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| TC-WF-09 | Same list everywhere | Open each of the 9 Approval chain dropdowns | 6 standard chains plus "Add another approval chain…" (IT support shows its two identical chains once) | ✅ |
| TC-WF-10 | Build a chain from a dropdown | Leave → Add another… → + HR admin, + Finance admin, tick IT support → Add chain | Saved and audited; Leave and IT support use it; offered (Custom) in every list | ✅ |
| TC-WF-11 | Builder rules | Manager after another step; same approver twice; no steps | Blocked with a clear message | ✅ |
| TC-WF-12 | Custom chain runs | Employee applies leave; manager, HR, Finance approve | Moves step by step, then Approved | ✅ |
| TC-WF-13 | IT support custom chain | Ticket with Manager → HR → Finance | Awaiting approval until Finance approves, then open with SLA | ✅ |
| TC-WF-14 | Remove chain | Remove a chain that is in use | Refused, naming the request types | ✅ |

## 14. Dropdown lists, request forms, sign-up comparison (v10.13)

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| TC-DD-01 | Inventory | Super Admin → Dropdown lists | 350 dropdowns with their source (+ list / master / people / fixed) | ✅ |
| TC-DD-02 | Add from the page | Letter types → + Add value "Visa letter (Schengen)" | Saved, audited, green chip | ✅ |
| TC-DD-03 | Duplicate | Add "visa letter (schengen)" again | "That value is already in the list." | ✅ |
| TC-DD-04 | Add inside a dropdown | Exits → Start an exit → Reason → + Add to exit reasons… | Saved and selected in the form | ✅ |
| TC-DD-05 | Admin scope | HR admin / IT admin open Dropdown lists | HR: 13 lists; IT & assets: 3 lists | ✅ |
| TC-DD-06 | Everywhere it is used | Employee opens Letter request; HR admin opens Exits | New values listed; no + for the employee | ✅ |
| TC-FM-01 | Work from home | Employee sends it | Reporting manager only → Approved | ✅ |
| TC-FM-02 | Travel | Employee sends it | Manager → Finance admin → Approved | ✅ |
| TC-FM-03 | Overtime | Employee sends it | Manager → HR admin → Approved | ✅ |
| TC-FM-04 | Letter | Employee sends it | HR admin → Approved | ✅ |
| TC-FM-05 | Grievance | Employee sends it | HR admin only; never in the manager's inbox | ✅ |
| TC-WEB-01 | Why EZY HR | Open the sign-up page; switch to "For your employees" | Company and employee benefits; comparison table opens; works on a phone | ✅ |

**Module coverage by role** (screen ids each role can open):

| Module | Employee | Manager | HR admin | Finance admin | IT admin | Super Admin |
|---|---|---|---|---|---|---|
| Core HR / records | profile | profile, team | people | people | people | employees |
| Payroll | finances | finances | payslips | payroll, payslips | — | payroll, payslips |
| Benefits | benefits | benefits | wellness | benefits admin | — | benefits admin |
| Compensation | my pay | my pay, team reviews | — | payroll (planning) | — | payroll (planning) |
| Multi-currency payroll | — | — | — | payroll entities | — | payroll entities |
| Time & attendance | attendance | attendance, team live | attendance admin | — | — | attendance admin |
| Leave | leave | leave, inbox | leave rules, inbox | inbox | inbox | leave rules |
| Recruitment / ATS | internal jobs | internal jobs | recruitment | — | — | recruitment |
| On/offboarding | my exit | my exit | onboarding, exits | exits | — | onboarding, exits |
| Performance | my performance | team reviews | performance | — | — | performance |
| Learning (LMS) | learning | learning | learning admin | — | — | learning admin |
| Succession | people XP | people XP | succession | — | — | succession |
| Employee self-service | profile, forms | profile, forms | — | — | — | — |
| Manager self-service | — | team, inbox | inbox | inbox | inbox | inbox |
| Documents | documents | documents | documents | documents | people | documents |
| Requests & forms | my forms | my forms, inbox | inbox | inbox | inbox | inbox |
| Dropdown lists (+) | — | — | ✅ | ✅ | ✅ | ✅ |

"—" is by design: the IT admin works in the Service Desk, HR does not see pay figures, and Finance does not run recruitment.

## 15. Legal entity in reports, exports and forms (v10.14)

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| TC-LE-01 | Report filter | Reports → Headcount → Legal entity | All entities listed; "Legal entity" column shown | ✅ 6 entities |
| TC-LE-02 | Filtered export | Pick ONAS India → Export CSV | File name and column carry ONAS India; only its people | ✅ 25 rows |
| TC-LE-03 | Print | Print a filtered report | "Legal entity: …" under the title | ✅ |
| TC-LE-04 | Other exports | Header → ONAS Middle East; export employee master and audit log | `-onas-middle-east` in file name; Legal entity column | ✅ |
| TC-LE-05 | Export without people | Export a rules/settings table while one entity is selected | Legal entity column with that entity | ✅ (unit) |
| TC-LE-06 | Requisition form | Header → ONAS Middle East → Open requisition | Legal entity starts on ONAS Middle East; saved with ONAS-ME | ✅ |
| TC-LE-07 | Scoping | Switch header to ONAS India / All companies | Requisition hidden / shown | ✅ |
| TC-LE-08 | Asset form | Add asset to stock with a legal entity | Shown only under that entity when unassigned | Same dropdown and scope rule as TC-LE-06; form opens with no errors in the crawl — not separately clicked through |

## 16. Employee-form dropdowns and custom dropdowns (v10.15)

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| TC-DD-01 | Field reference match | Field reference → Dropdowns only | Every dropdown shows Grow with + / Master data · + Add new / People records / Fixed (with the rule) | ✅ 37 dropdowns |
| TC-DD-02 | Grow an employee list | Employee form → Shift → Add to shifts… → "Split" | Value accepted and listed after the built-in shifts; a repeat ("split") refused | ✅ (unit; the same + flow was clicked through for the custom list in TC-DD-08) |
| TC-DD-03 | Number lists | Add "1.2" to FTE / "5" to Overtime rate | Refused with the allowed range | ✅ (unit) |
| TC-DD-04 | + Add new in place | Add employee → Department → Add new department… → "Customer Success" | Department created and picked; form behind kept | ✅ |
| TC-DD-05 | Create a dropdown | Dropdown lists → Create a dropdown "T-shirt size" (S, M, L, XL; required; employee-editable) | On employee form (Personal details), profile, Field reference (Custom), export | ✅ |
| TC-DD-06 | Duplicate name | Create a dropdown named "Grade" | "A field with this name already exists." | ✅ |
| TC-DD-07 | Required | Save an employee without the required custom dropdown | "T-shirt size is required."; saves after choosing | ✅ |
| TC-DD-08 | Grow a custom list | + Add value "XXL" | Appears in the form | ✅ |
| TC-DD-09 | Admin access | HR admin → Dropdown lists | Can add values to custom lists; no Create button. Finance admin doesn't see the list | ✅ |
| TC-DD-10 | Switch off | Turn "On the form" off | Hidden from the form; saved values kept; can be switched back on | ✅ |

## 10. Before go-live checklist (🖐)

1. Production secrets set: `JWT_SECRET`, `POSTGRES_PASSWORD`; `DEMO_OTP` unset.
2. HTTPS in front of the API; `SITE_URL` set to the public address.
3. Backups with point-in-time recovery; one restore tested.
4. `seed:demo` / `seed:scale` **not** run on production; create the real company with `create-company.mjs`.
5. Load test on production-sized hardware with your expected morning peak.
6. Sitemap submitted in Google Search Console.
