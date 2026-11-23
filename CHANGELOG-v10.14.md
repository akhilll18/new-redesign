# EZY HR v10.14 — Legal entity across forms, reports and exports

Existing screens, tabs, dropdowns and approval chains are unchanged. This release builds on v10.13, which added:
- dropdown lists with **+**;
- new request forms;
- the "Why EZY HR" comparison on sign-up.

## 1. Reports by legal entity
The **Report Centre** covers all 46 reports for the Super Admin, and each role's own set.
- **Legal entity on every row.** Each row now carries its legal entity, worked out from the employee or from the record itself.
- **Legal entity column.** Every report shows a **Legal entity** column, next to *Employee*.
  - It can be hidden from **Columns**, like any other column.
- **Legal entity filter.** It sits first in the filter row. It can also be used for **Group by**, for example headcount or cost by entity.
- **Works with the header selector.** When the header's company selector is set to one entity, the report shows only that entity.
- **CSV export and print-out name the entity:**
  - file name, e.g. `headcount-onas-india-2026-04-01_to_2026-11-22.csv`;
  - **Legal entity** column in the file;
  - **Legal entity: …** at the top of the print-out.

## 2. Every other export names its legal entity
This covers all 47 CSV exports across the app, for example the employee master, audit log, expenses, assets and the activity centre.
- **Legal entity column.** A **Legal entity** column is added, worked out from each row's employee code (EMP…, CW…, VN…).
- **One entity selected in the header.** Every export gets that entity in its file name, e.g. `employee-master-onas-middle-east.csv`.
  - Exports with no people in them (rules, settings) still get a Legal entity column.
- **Exports that already have the column** are left as they are.

## 3. Forms connected to the legal entity
Records that belong to a person already follow that person's entity:
- the employee form (it already had the company field);
- requests and every v10.13 form;
- expenses, attendance, payroll, tickets, assets assigned to someone.

Two forms create records that don't belong to one person. They now have a **Legal entity** dropdown, which starts on the entity chosen in the header:

| Form | Where |
|---|---|
| **Open requisition** | Hire & onboard → Recruitment → Requisitions & pipeline |
| **Add asset to stock** | IT service desk → Assets |

- **Visibility:** the record then shows only under its own entity, both on screen and in reports. Under **All companies** everything shows, as before.
- **Older records** with no entity stay visible under every entity, as before.
- **Holidays are unchanged.** They are kept per country by the country packs, and leave and attendance counting rely on that.

## Tests
**Browser, sample company with 6 legal entities**
- **Report filter:** the headcount report's Legal entity filter lists all 6 entities.
  - The **Legal entity** column appears.
  - Choosing *ONAS India* gives 25 people, and the CSV file name and column carry *ONAS India*.
- **Exports:** with the header set to *ONAS Middle East*, the employee-master and audit-log exports carried *onas-middle-east* in the file name and a **Legal entity** column.
- **Requisition form:** the form opened on *ONAS Middle East* and saved with `company_id = ONAS-ME`.
  - The requisition is visible under ONAS Middle East and All companies.
  - It is hidden under ONAS India.

**Regression**
- Every screen opened with no errors:

  | Role | Screens |
  |---|---|
  | Super Admin | 74 |
  | HR | 46 |
  | IT | 16 |
  | Finance | 35 |
  | Manager | 41 |
  | Employee | 37 |

  The clean company also opens with no errors.
- The approval-chain test passed again: all four steps of the asset purchase, IT ticket approval, and the new IT admin automatically taking over the waiting step.
