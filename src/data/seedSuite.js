// v10 "all-in-one" suite: sample data for the modules that close the gaps in the HR & payroll checklist —
// Payroll Agent, variable pay, bank payouts, statutory filings & year-end forms, compliance autopilot (rule updates,
// alerts, audit pack, data privacy), exits & full-and-final settlement, shift rosters, leave rule-sets, PeopleXP,
// mobile app, relocation & visas, EOR / contractor-of-record hiring, spend cards, integrations & APIs, data import,
// plan & billing, security & backups and expert support. Everything lives under `data.suite`.
import { isoDate, DAY } from "../lib/utils.js";

const d = (n) => isoDate(Date.now() + n * DAY);
const at = (n, h = 10) => { const x = new Date(Date.now() + n * DAY); x.setHours(h, 12, 0, 0); return x.toISOString(); };
const prevMonth = (k = 1) => { const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() - k); return isoDate(x).slice(0, 7); };

export function buildSuiteSeed(employees) {
  const india = employees.filter((e) => (e.country_code || "IN") === "IN" && e.status !== "pending_approval");
  const thisMonth = isoDate().slice(0, 7);

  return {
    suite: {
      // ── Payroll ───────────────────────────────────────
      variable: {
        [thisMonth]: {
          EMP022: { commission: 18500, bonus: 0, ot_hours: 0, hours: 0, hourly_rate: 0, note: "Q-end deals closed" },
          EMP023: { commission: 12400, bonus: 0, ot_hours: 0, hours: 0, hourly_rate: 0, note: "" },
          EMP024: { commission: 26000, bonus: 0, ot_hours: 0, hours: 0, hourly_rate: 0, note: "Team target hit" },
          EMP013: { commission: 0, bonus: 0, ot_hours: 6, hours: 0, hourly_rate: 0, note: "Month-end stock count" },
          EMP011: { commission: 0, bonus: 5000, ot_hours: 4, hours: 0, hourly_rate: 0, note: "Spot award – release QA" },
          EMP010: { commission: 0, bonus: 0, ot_hours: 0, hours: 32, hourly_rate: 450, note: "Weekend migration support (hourly)" },
        },
      },
      agentRuns: [
        { id: "RUN-" + prevMonth(1), period: prevMonth(1), status: "completed", started_at: at(-36, 9), finished_at: at(-36, 9), approved_by: "SA001", people: india.length + 22, net_inr: 4105000, cost_inr: 4870000, flags: 2, minutes: 6 },
        { id: "RUN-" + prevMonth(2), period: prevMonth(2), status: "completed", started_at: at(-66, 9), finished_at: at(-66, 9), approved_by: "SA001", people: india.length + 21, net_inr: 3990000, cost_inr: 4720000, flags: 1, minutes: 7 },
      ],
      currentRun: null,
      payouts: [
        { id: "PAY-" + prevMonth(1) + "-IN", period: prevMonth(1), country: "IN", bank: "HDFC Bank", format: "HDFC bulk NEFT/RTGS (CSV)", count: india.length, amount: 3480000, currency: "INR", status: "paid", created_at: at(-35), utr: "HDFCN52" + prevMonth(1).replace("-", "") + "0091" },
        { id: "PAY-" + prevMonth(1) + "-GB", period: prevMonth(1), country: "GB", bank: "Barclays", format: "Bacs Standard 18", count: 1, amount: 4120, currency: "GBP", status: "paid", created_at: at(-35), utr: "BACS-77120" },
        { id: "PAY-" + prevMonth(1) + "-US", period: prevMonth(1), country: "US", bank: "Chase", format: "NACHA ACH", count: 1, amount: 7110, currency: "USD", status: "paid", created_at: at(-35), utr: "ACH-310044" },
      ],
      filings: [
        { id: "FIL-1", country: "IN", form: "PF ECR", period: prevMonth(1), status: "filed", filed_at: at(-24), ack: "ECR-TRRN-" + prevMonth(1).replace("-", "") + "4471" },
        { id: "FIL-2", country: "IN", form: "ESI challan", period: prevMonth(1), status: "filed", filed_at: at(-24), ack: "ESIC-CH-55193" },
        { id: "FIL-3", country: "IN", form: "PT (Telangana)", period: prevMonth(1), status: "filed", filed_at: at(-27), ack: "TGPT-90813" },
        { id: "FIL-4", country: "IN", form: "TDS challan 281", period: prevMonth(1), status: "filed", filed_at: at(-30), ack: "CIN-0510308-" + prevMonth(1).replace("-", "") },
        { id: "FIL-5", country: "GB", form: "RTI FPS", period: prevMonth(1), status: "filed", filed_at: at(-35), ack: "HMRC-FPS-2291" },
        { id: "FIL-6", country: "US", form: "Form 941 (quarterly)", period: prevMonth(2), status: "filed", filed_at: at(-50), ack: "IRS-941-8812" },
      ],

      // ── Compliance autopilot ──────────────────────────
      ruleUpdates: [
        { id: "RU-101", country: "IN", area: "Income tax", title: "New-regime slabs and ₹75,000 standard deduction for tax year 2026-27", effective: "2026-04-01", status: "applied", applied_at: at(-220), source: "Income-tax Act 2025 / Finance Act 2026", impact: "TDS for all India staff on the new regime" },
        { id: "RU-102", country: "IN", area: "Labour welfare fund", title: "Karnataka LWF revised to ₹50 employee + ₹100 employer", effective: "2026-01-01", status: "applied", applied_at: at(-300), source: "Karnataka Labour Welfare Fund (Amendment)", impact: "December deduction for Karnataka staff" },
        { id: "RU-103", country: "IN", area: "Professional tax", title: "Maharashtra PT February instalment ₹300 confirmed for 2026-27", effective: "2026-04-01", status: "applied", applied_at: at(-210), source: "Maharashtra State Tax on Professions Act", impact: "February payroll, Maharashtra staff" },
        { id: "RU-104", country: "IN", area: "Labour codes", title: "Code on Wages: wage definition (basic + DA ≥ 50%) — validation tightened", effective: d(18), status: "pending_review", source: "Ministry of Labour notification", impact: "Salary structures where basic is below 50% are flagged before the run" },
        { id: "RU-105", country: "GB", area: "Statutory pay", title: "SSP and SMP weekly rates uprated from April", effective: d(140), status: "scheduled", source: "HMRC rates and thresholds", impact: "UK statutory sick and maternity pay" },
        { id: "RU-106", country: "US", area: "Social Security", title: "Social Security wage base updated for the new tax year", effective: d(54), status: "scheduled", source: "SSA COLA announcement", impact: "OASDI stops at the new wage base" },
        { id: "RU-107", country: "AE", area: "End of service", title: "ILOE unemployment insurance — enrolment check added for new joiners", effective: d(-12), status: "applied", applied_at: at(-12), source: "MOHRE", impact: "UAE onboarding checklist" },
        { id: "RU-108", country: "KE", area: "Housing levy", title: "Affordable housing levy 1.5% + 1.5% — rate confirmed", effective: d(-40), status: "applied", applied_at: at(-40), source: "Kenya Revenue Authority", impact: "Kenya payroll deductions" },
      ],
      autoApply: true,
      alertSettings: { days_before: [7, 3, 1], email: true, inapp: true, whatsapp: false, sms: false, escalate_overdue: true, recipients: ["ADM02", "SA001"] },
      auditPacks: [
        { id: "AP-1", name: "Statutory audit pack — " + prevMonth(1), period: prevMonth(1), created_at: at(-20), by: "ADM02", items: 9 },
      ],
      privacy: {
        dpo: { name: "Praveen Kumar", email: "dpo@onasglobal.demo", phone: "+91 40 4455 0000" },
        residency: "India (Mumbai region) · EU data for EU staff stays in Frankfurt",
        laws: ["India DPDP Act 2023", "EU / UK GDPR", "UAE PDPL", "South Africa POPIA", "Kenya DPA 2019", "Brazil LGPD", "Singapore PDPA"],
        requests: [
          { id: "DSR-021", employee_code: "EMP038", type: "access", detail: "Copy of all personal data held", raised_at: at(-6), due: d(24), status: "in_progress" },
          { id: "DSR-020", employee_code: "EMP015", type: "correction", detail: "Update permanent address", raised_at: at(-15), due: d(15), status: "completed", closed_at: at(-13) },
        ],
        retention: [
          ["Payroll records & payslips", "8 years after the tax year", "Income-tax Act; GDPR art. 6(1)(c)"],
          ["Attendance & punches", "3 years", "Shops & Establishments Act"],
          ["Live location pings", "90 days, then deleted", "Consent-based (DPDP s.6)"],
          ["Selfies & biometric templates", "Template only, deleted on exit", "Sensitive data — consent"],
          ["Candidate data (not hired)", "12 months", "Consent / legitimate interest"],
          ["Exited employee profile", "7 years, then anonymised", "Legal obligation"],
        ],
        breaches: [],
      },

      // ── Core HR ───────────────────────────────────────
      exits: [
        { id: "EXT-007", employee_code: "EMP013", type: "resignation", reason: "Higher studies", resigned_on: d(-20), last_day: d(40), notice_days: 60, status: "notice", buyout_days: 0,
          clearance: { manager: "done", it: "pending", assets: "pending", finance: "pending", hr: "pending" }, exit_interview: false, fnf_status: "draft" },
        { id: "EXT-006", employee_code: "EMP011", type: "resignation", reason: "Relocating to Pune", resigned_on: d(-70), last_day: d(-10), notice_days: 60, status: "fnf", buyout_days: 0,
          clearance: { manager: "done", it: "done", assets: "done", finance: "done", hr: "done" }, exit_interview: true, fnf_status: "computed", fnf_due: d(20) },
      ],
      shiftTemplates: [
        { code: "G", name: "General", start: "09:30", end: "18:30", brk: 60, color: "#004A77" },
        { code: "M", name: "Morning", start: "06:00", end: "14:00", brk: 30, color: "#0A9E78" },
        { code: "E", name: "Evening", start: "14:00", end: "22:00", brk: 30, color: "#F48A3E" },
        { code: "N", name: "Night", start: "22:00", end: "06:00", brk: 30, color: "#5B4BB7", night_allowance: 250 },
        { code: "O", name: "Week off", start: "", end: "", brk: 0, color: "#B8C6D0" },
      ],
      roster: {},
      swaps: [{ id: "SW-1", employee_code: "EMP013", with: "EMP008", day: d(3), from: "M", to: "E", status: "pending", at: at(-1) }],
      leaveRuleSets: [
        { id: "LRS-STD", name: "Standard — India full-time", teams: ["Engineering", "Data Migration", "Design", "Finance", "People", "Marketing"], default: true,
          controls: { accrual: "monthly", accrual_start: "joining", prorate_joiners: true, probation_can_apply: "casual_only", probation_accrue: true, carry_forward_cap: 30, carry_forward_expiry_months: 12, encashment: true, encash_basis: "basic_div_26", encash_max: 15, encash_on_exit: true, sandwich: false, sandwich_holidays: false, min_notice_days: 2, max_continuous: 15, backdated_days: 7, half_day: true, hourly_leave: false, negative_balance: 0, doc_after_days: 2, club_with_others: true, comp_off: true, comp_off_expiry_days: 60, weekend_count: false, holiday_count: false, approvals: "manager_then_hr", auto_approve_after_hours: 0, lop_auto: true, year_start: "january", restricted_holidays: 2, maternity_weeks: 26, paternity_days: 5, bereavement_days: 3, marriage_days: 3, optional_floater: 2, blackout_dates: "", notify_team: true, payroll_sync: true } },
        { id: "LRS-SALES", name: "Sales field team", teams: ["Sales"], default: false,
          controls: { accrual: "monthly", accrual_start: "confirmation", prorate_joiners: true, probation_can_apply: "none", probation_accrue: true, carry_forward_cap: 15, carry_forward_expiry_months: 3, encashment: true, encash_basis: "basic_div_30", encash_max: 10, encash_on_exit: true, sandwich: true, sandwich_holidays: true, min_notice_days: 3, max_continuous: 10, backdated_days: 3, half_day: true, hourly_leave: false, negative_balance: 2, doc_after_days: 1, club_with_others: false, comp_off: true, comp_off_expiry_days: 30, weekend_count: true, holiday_count: false, approvals: "manager", auto_approve_after_hours: 48, lop_auto: true, year_start: "april", restricted_holidays: 1, maternity_weeks: 26, paternity_days: 5, bereavement_days: 3, marriage_days: 3, optional_floater: 1, blackout_dates: "Last 3 days of each quarter", notify_team: true, payroll_sync: true } },
      ],

      // ── People experience ─────────────────────────────
      values: ["Customer first", "Own it", "Raise the bar", "One team", "Keep it simple"],
      posts: [
        { id: "XP-9", kind: "recognition", by: "EMP007", to: ["EMP012"], value: "Raise the bar", points: 100, text: "Meera shipped the leave-sync fix in 3 days and wrote the tests nobody asked for. Thank you!", at: at(-1, 15), likes: ["EMP004", "EMP001", "EMP011"], comments: [{ by: "EMP012", text: "Team effort 🙌", at: at(-1, 16) }] },
        { id: "XP-8", kind: "milestone", by: "SYSTEM", to: ["EMP003"], text: "Ashok Kumar completes 3 years at ONAS Global today 🎉", at: at(-2, 9), likes: ["EMP002", "EMP005", "EMP016"], comments: [] },
        { id: "XP-7", kind: "recognition", by: "EMP024", to: ["EMP022", "EMP023"], value: "Customer first", points: 75, text: "Neha and Aditya turned around the Kakinada account renewal in one week.", at: at(-3, 18), likes: ["EMP005"], comments: [] },
        { id: "XP-6", kind: "post", by: "EMP002", to: [], text: "Diwali potluck on Friday at 4 pm in the cafeteria — bring your favourite sweet! 🪔", at: at(-4, 11), likes: ["EMP014", "EMP013", "EMP015", "EMP001"], comments: [] },
      ],
      pulses: [],
      vouchers: [
        { id: "V-AMZ", name: "Amazon Pay gift card", points: 500, value: "₹500" },
        { id: "V-SWG", name: "Swiggy food voucher", points: 300, value: "₹300" },
        { id: "V-BMS", name: "Movie tickets (2)", points: 600, value: "₹600" },
        { id: "V-DON", name: "Donate to Akshaya Patra", points: 250, value: "50 school meals" },
        { id: "V-LRN", name: "Course credit (any platform)", points: 1000, value: "₹1,000" },
      ],
      xpWallet: { EMP012: 100, EMP022: 75, EMP023: 75, EMP001: 220, EMP024: 180 },
      xpRedemptions: [],
      appInstalls: { EMP024: { platform: "Android", at: at(-30) }, EMP001: { platform: "iOS", at: at(-12) }, EMP022: { platform: "Android", at: at(-8) } },

      // ── Global hiring & relocation ────────────────────
      globalHires: [
        { id: "GH-14", name: "Hannah Weber", country: "DE", model: "EOR", role: "Senior Data Consultant", monthly: 6200, start: d(21), status: "contract_sent", steps: { quote: "done", contract: "sent", onboarding: "pending", payroll: "pending" } },
        { id: "GH-13", name: "Tomás Ruiz", country: "MX", model: "CoR", role: "React Developer (contractor)", monthly: 52000, start: d(-30), status: "active", steps: { quote: "done", contract: "done", onboarding: "done", payroll: "done" }, risk: "low" },
        { id: "GH-12", name: "Grace Wanjiku", country: "KE", model: "Contractor", role: "UX Researcher", monthly: 210000, start: d(-90), status: "active", steps: { quote: "done", contract: "done", onboarding: "done", payroll: "done" }, risk: "medium" },
      ],
      relocations: [
        { id: "REL-05", employee_code: "EMP021", from: "Singapore", to: "Hyderabad, India", visa: "Employment visa (E)", stage: "documents", started: d(-12), target: d(45), checklist: { offer: true, passport: true, degree: true, police: false, medical: false, fees: false, appointment: false, flights: false, housing: false }, budget: 450000, spent: 38000 },
        { id: "REL-04", employee_code: "EMP001", from: "Hyderabad, India", to: "London, UK", visa: "Skilled Worker visa", stage: "approved", started: d(-80), target: d(10), checklist: { offer: true, passport: true, degree: true, police: true, medical: true, fees: true, appointment: true, flights: true, housing: false }, budget: 900000, spent: 612000 },
      ],

      // ── Spend ─────────────────────────────────────────
      cards: [
        { id: "CARD-1", employee_code: "EMP024", last4: "4821", type: "physical", limit: 75000, period: "monthly", status: "active", categories: ["Travel", "Meals", "Client entertainment"], issued_at: at(-120) },
        { id: "CARD-2", employee_code: "EMP022", last4: "9013", type: "virtual", limit: 25000, period: "monthly", status: "active", categories: ["Travel", "Meals"], issued_at: at(-60) },
        { id: "CARD-3", employee_code: "EMP001", last4: "3307", type: "virtual", limit: 15000, period: "monthly", status: "active", categories: ["Software", "Learning"], issued_at: at(-20) },
        { id: "CARD-4", employee_code: "EMP003", last4: "7765", type: "virtual", limit: 200000, period: "monthly", status: "frozen", categories: ["Software", "Vendors"], issued_at: at(-200) },
      ],
      cardTxns: [
        { id: "TX-31", card: "CARD-1", merchant: "IndiGo Airlines", category: "Travel", amount: 8460, date: d(-2), receipt: true, status: "matched" },
        { id: "TX-30", card: "CARD-1", merchant: "Taj Deccan", category: "Client entertainment", amount: 6240, date: d(-2), receipt: false, status: "missing_receipt" },
        { id: "TX-29", card: "CARD-2", merchant: "Uber India", category: "Travel", amount: 640, date: d(-3), receipt: true, status: "matched" },
        { id: "TX-28", card: "CARD-3", merchant: "GitHub", category: "Software", amount: 1680, date: d(-5), receipt: true, status: "matched" },
        { id: "TX-27", card: "CARD-1", merchant: "Swiggy", category: "Meals", amount: 1120, date: d(-6), receipt: false, status: "missing_receipt" },
        { id: "TX-26", card: "CARD-2", merchant: "Café Coffee Day", category: "Meals", amount: 380, date: d(-8), receipt: true, status: "matched" },
      ],

      // ── Connections ───────────────────────────────────
      integrations: {
        tally: { connected: true, last_sync: at(-1, 19), mode: "Tally XML (TallyPrime)" },
        quickbooks: { connected: false }, xero: { connected: false }, zoho_books: { connected: false }, sap: { connected: false }, netsuite: { connected: false },
        hdfc: { connected: true, last_sync: at(-1, 18), mode: "Corporate net-banking bulk upload" }, icici: { connected: false }, axis: { connected: false }, razorpayx: { connected: false },
        barclays: { connected: true, last_sync: at(-35), mode: "Bacs bureau file" }, chase: { connected: true, last_sync: at(-35), mode: "NACHA ACH" }, enbd: { connected: false },
        essl: { connected: true, last_sync: at(0, 9), mode: "eSSL / ZKTeco biometric push" }, whatsapp: { connected: true, last_sync: at(0, 10), mode: "WhatsApp Business API · +91 90000 12345" }, sms: { connected: false }, google: { connected: true, last_sync: at(0, 8), mode: "Google Workspace SSO" }, microsoft: { connected: false }, slack: { connected: false }, teams: { connected: true, last_sync: at(0, 8) }, whatsapp: { connected: false },
      },
      apiKeys: [{ id: "KEY-1", name: "ERP sync (read-only)", prefix: "ph_live_7Kq2", scopes: ["employees:read", "payroll:read"], created_at: at(-90), last_used: at(-1) }],
      webhooks: [{ id: "WH-1", url: "https://erp.onasglobal.demo/hooks/peoplehub", events: ["employee.created", "payroll.approved", "payslip.released"], active: true, last_status: 200 }],

      // ── Setup, billing, security, support ─────────────
      setup: { company: true, entities: true, bank: true, salary_structures: true, statutory_ids: true, leave_policy: true, holidays: true, attendance: true, import_employees: true, opening_balances: false, ytd_import: false, approvers: true, first_parallel_run: false, go_live: false },
      imports: [{ id: "IMP-3", file: "employees_from_spreadsheet.xlsx", kind: "employees", rows: 41, ok: 41, errors: 0, at: at(-400), by: "SA001" }],
      billing: {
        plan: "growth",
        currency: "INR",
        plans: [
          { id: "free", name: "Free", per_employee: 0, base: 0, blurb: "Core HR, attendance, leave and payroll compute with PF, ESI, PT, TDS and LWF — unlimited employees." },
          { id: "growth", name: "Payroll OS", per_employee: 99, base: 1249, blurb: "Everything in Free + Payroll Agent, bank payouts, statutory filing, year-end forms and the mobile app." },
          { id: "global", name: "Global", per_employee: 249, base: 4999, blurb: "Everything in Payroll OS + multi-country payroll, EOR and contractor payments, spend cards and API access." },
        ],
        addons: [["Performance & OKRs", 39], ["Recruitment (ATS)", 29], ["PeopleXP recognition", 19], ["Background verification", "pay per check"]],
        invoices: [
          { id: "INV-2026-10", period: prevMonth(1), employees: 41, amount: 1249 + 41 * 99, status: "paid", paid_at: at(-30) },
          { id: "INV-2026-09", period: prevMonth(2), employees: 40, amount: 1249 + 40 * 99, status: "paid", paid_at: at(-60) },
        ],
      },
      security: {
        encryption_at_rest: "AES-256 (per-tenant keys, rotated every 90 days)", encryption_in_transit: "TLS 1.3, HSTS", field_encryption: ["Bank account", "PAN / tax ID", "Aadhaar / national ID", "Salary", "Medical"],
        sso: true, ip_allowlist: ["10.12.0.0/16"], session_minutes: 15, password_min: 10, backup_schedule: "Every 6 hours · kept 35 days · copy in a second region", last_pen_test: d(-75), certifications: ["ISO 27001 (in audit)", "SOC 2 Type II (planned)"],
        backups: [
          { id: "BK-" + d(0), at: at(0, 6), kind: "auto", size_kb: 812, status: "ok" },
          { id: "BK-" + d(-1), at: at(-1, 18), kind: "auto", size_kb: 809, status: "ok" },
          { id: "BK-" + d(-1) + "m", at: at(-1, 11), kind: "manual", size_kb: 806, status: "ok", by: "SA001" },
        ],
      },
      supportTickets: [
        { id: "EXP-118", topic: "PT slab for Karnataka February instalment", area: "Payroll law", language: "Kannada", status: "answered", expert: "Ravi S. — payroll compliance (KA)", at: at(-4), by: "ADM02" },
        { id: "EXP-117", topic: "Bacs file rejected — sort code format", area: "Bank payouts", language: "English", status: "resolved", expert: "Emma J. — UK payroll", at: at(-12), by: "ADM02" },
      ],
    },
  };
}
