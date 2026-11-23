// Demo contract-management data: staffing vendors, contracts (with a renewal chain and a pending renewal),
// weekly timesheets, milestones, last month's posted contractor pay run and its invoices.
import { isoDate, DAY } from "../lib/utils.js";
import { DEFAULT_CONTRACT_SETTINGS, contractFromEmployee, contractPayLine, weekStart, addDays, monthBounds } from "../lib/contracts.js";

const at = (dateIso, h = 10) => `${dateIso}T${String(h).padStart(2, "0")}:00:00.000Z`;

export function buildContractSeed(employees) {
  const today = isoDate();
  const by = Object.fromEntries(employees.map((e) => [e.employee_code, e]));
  const vendors = [
    { id: "VEN-01", name: "TeamStaff Manpower Services Pvt Ltd", gstin: "36AACCT7781M1ZQ", pan: "AACCT7781M", contact: "Ravi Teja", email: "accounts@teamstaff.demo", phone: "+91 40 4455 7788", markup_pct: 12, payment_terms_days: 30, clra_licence: "CLRA/TG/HYD/2023/0412", licence_expiry: isoDate(Date.now() + 20 * DAY), msme: "yes", status: "active", address: "Ameerpet, Hyderabad 500016" },
    { id: "VEN-02", name: "QuickHire Contract Solutions LLP", gstin: "29AAFFQ2210C1Z2", pan: "AAFFQ2210C", contact: "Deepa Rao", email: "billing@quickhire.demo", phone: "+91 80 2211 9090", markup_pct: 10, payment_terms_days: 15, clra_licence: "CLRA/KA/BLR/2024/1187", licence_expiry: isoDate(Date.now() + 400 * DAY), msme: "no", status: "active", address: "Koramangala, Bengaluru 560034" },
  ];

  const base = (code, extra = {}) => ({ ...contractFromEmployee(by[code]), ...extra });
  const hist = (by_, action, d) => ({ at: at(d), by: by_, action });
  const arjun = by.EMP050;
  const arjunFirstEnd = addDays(arjun.date_of_joining, 89);
  const contracts = [
    {
      ...base("EMP050", { end_date: arjunFirstEnd, rate: 600 }),
      id: "CTR-0001", status: "renewed", title: "Contract Frontend Developer – Phase 1", rate_history: [{ from: arjun.date_of_joining, rate: 600 }],
      signed: { worker: { at: at(addDays(arjun.date_of_joining, -3)), name: arjun.full_name }, company: { at: at(addDays(arjun.date_of_joining, -2)), by: "ADM01" } },
      milestones: [], amendments: [], deliverables: "Customer portal UI (React), component library.", work_location: "hybrid", budget_amount: 450000,
      history: [hist("ADM01", "Created from the employee record", addDays(arjun.date_of_joining, -5)), hist("ADM02", "Approved by Finance", addDays(arjun.date_of_joining, -4)), hist("EMP050", "E-signed by the worker", addDays(arjun.date_of_joining, -3)), hist("ADM01", "Renewed as CTR-0002", arjunFirstEnd)],
    },
    {
      ...base("EMP050", { start_date: addDays(arjunFirstEnd, 1) }),
      id: "CTR-0002", parent_id: "CTR-0001", status: "active", title: "Contract Frontend Developer – Phase 2",
      rate_history: [{ from: addDays(arjunFirstEnd, 1), rate: 650 }],
      signed: { worker: { at: at(addDays(arjunFirstEnd, -4)), name: arjun.full_name }, company: { at: at(addDays(arjunFirstEnd, -3)), by: "ADM01" } },
      milestones: [], deliverables: "Payments module front end, accessibility fixes (WCAG 2.2 AA), handover documentation.", work_location: "hybrid", budget_amount: 520000,
      amendments: [{ id: "AMD-1", type: "rate", at: at(addDays(arjunFirstEnd, -5)), by: "ADM01", from: "₹600 / hour", to: "₹650 / hour", effective: addDays(arjunFirstEnd, 1), note: "Renewal with 8% rate increase (market correction)." }],
      history: [hist("ADM01", "Renewal of CTR-0001 created", addDays(arjunFirstEnd, -6)), hist("ADM02", "Approved by Finance", addDays(arjunFirstEnd, -5)), hist("EMP050", "E-signed by the worker", addDays(arjunFirstEnd, -4))],
    },
    {
      ...base("EMP051"), id: "CTR-0003", status: "active", title: "Content Marketing Specialist – 12-month fixed term", rate_history: [{ from: by.EMP051.date_of_joining, rate: 70000 }],
      signed: { worker: { at: at(addDays(by.EMP051.date_of_joining, -2)), name: by.EMP051.full_name }, company: { at: at(addDays(by.EMP051.date_of_joining, -2)), by: "ADM01" } },
      milestones: [], amendments: [], deliverables: "Monthly content calendar, 8 long-form articles a month, campaign landing copy.", work_location: "onsite", budget_amount: "",
      history: [hist("ADM01", "Created from the employee record", addDays(by.EMP051.date_of_joining, -6)), hist("SA001", "Approved by Super Admin", addDays(by.EMP051.date_of_joining, -4))],
    },
    {
      ...base("EMP052", { timesheet_approver: "EMP006" }), id: "CTR-0004", status: "active", title: "UX design – design system and product flows", rate_history: [{ from: by.EMP052.date_of_joining, rate: 1200 }],
      signed: { worker: { at: at(addDays(by.EMP052.date_of_joining, -1)), name: by.EMP052.full_name }, company: { at: at(addDays(by.EMP052.date_of_joining, -1)), by: "ADM01" } },
      milestones: [], amendments: [], deliverables: "Design system v2 in Figma, 6 product flows with prototypes, usability test reports.", work_location: "remote", budget_amount: 2400000,
      history: [hist("ADM01", "Created", addDays(by.EMP052.date_of_joining, -4)), hist("ADM02", "Approved by Finance", addDays(by.EMP052.date_of_joining, -3)), hist("EMP052", "E-signed by the worker", addDays(by.EMP052.date_of_joining, -1))],
    },
    {
      ...base("EMP053"), id: "CTR-0005", status: "active", title: "Data governance framework – SOW 2026-07", rate_history: [{ from: by.EMP053.date_of_joining, rate: 600000 }],
      signed: { company: { at: at(addDays(by.EMP053.date_of_joining, -1)), by: "ADM01" } },
      amendments: [], deliverables: "Data inventory, governance policies, stewardship model, rollout and training.", work_location: "hybrid", budget_amount: 600000,
      milestones: [
        { id: "MS-1", title: "Data inventory & maturity assessment", due: addDays(by.EMP053.date_of_joining, 30), amount: 150000, status: "processed", submitted_at: at(addDays(by.EMP053.date_of_joining, 28)), decided_by: "EMP009", note: "Inventory of 46 systems delivered." },
        { id: "MS-2", title: "Governance framework & policies", due: addDays(by.EMP053.date_of_joining, 70), amount: 250000, status: "submitted", submitted_at: at(addDays(today, -2)), note: "Policies v1, RACI and data-quality rules attached." },
        { id: "MS-3", title: "Rollout, stewardship training & handover", due: addDays(by.EMP053.date_of_joining, 175), amount: 200000, status: "planned" },
      ],
      history: [hist("ADM01", "Created (statement of work)", addDays(by.EMP053.date_of_joining, -5)), hist("ADM02", "Approved by Finance", addDays(by.EMP053.date_of_joining, -2))],
    },
    {
      ...base("EMP054"), id: "CTR-0006", status: "active", title: "Warehouse operations – agency work order", rate_history: [{ from: by.EMP054.date_of_joining, rate: 450 }],
      signed: { worker: { at: at(addDays(by.EMP054.date_of_joining, -1)), name: by.EMP054.full_name }, company: { at: at(addDays(by.EMP054.date_of_joining, -1)), by: "ADM01" } },
      milestones: [], amendments: [], deliverables: "Inbound receiving, put-away and dispatch at the Medchal warehouse.", work_location: "onsite", budget_amount: "",
      history: [hist("ADM01", "Work order raised with TeamStaff", addDays(by.EMP054.date_of_joining, -7)), hist("ADM02", "Approved by Finance", addDays(by.EMP054.date_of_joining, -6))],
    },
    {
      ...base("EMP055"), id: "CTR-0007", status: "active", title: "Software engineering internship (6 months)", rate_history: [{ from: by.EMP055.date_of_joining, rate: 25000 }],
      signed: { worker: { at: at(addDays(by.EMP055.date_of_joining, -3)), name: by.EMP055.full_name }, company: { at: at(addDays(by.EMP055.date_of_joining, -3)), by: "ADM01" } },
      milestones: [], amendments: [], deliverables: "Rotations in front end and QA; capstone project.", work_location: "onsite", budget_amount: "",
      history: [hist("ADM01", "Created from the employee record", addDays(by.EMP055.date_of_joining, -8)), hist("ADM02", "Approved by Finance", addDays(by.EMP055.date_of_joining, -6))],
    },
    {
      ...base("EMP052", { timesheet_approver: "EMP006", start_date: addDays(by.EMP052.fixed_term_end_date, 1), end_date: addDays(by.EMP052.fixed_term_end_date, 182) }),
      id: "CTR-0008", parent_id: "CTR-0004", kind: "renewal", status: "pending_approval", title: "UX design – phase 2 (mobile app)", rate: 1300, rate_history: [{ from: addDays(by.EMP052.fixed_term_end_date, 1), rate: 1300 }],
      milestones: [], amendments: [], deliverables: "Mobile app flows, design-system tokens for native, accessibility audit.", work_location: "remote", budget_amount: 1400000, signed: {},
      history: [hist("ADM01", "Renewal of CTR-0004 proposed at ₹1,300 / hour", addDays(today, -1)), hist("ADM01", "Sent for approval", addDays(today, -1))],
    },
  ];

  // Weekly timesheets for the hourly workers: six past weeks + this week's draft.
  const thisWeek = weekStart(today);
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  const prevPeriod = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const prevEnd = monthBounds(prevPeriod).end;
  const plan = [
    { code: "EMP050", ctr: "CTR-0002", approver: "EMP007", days: 5, hours: 8, ot: [[2, 2, "Release hot-fix for checkout"]] },
    { code: "EMP052", ctr: "CTR-0004", approver: "EMP006", days: 5, hours: 7.5, ot: [] },
    { code: "EMP054", ctr: "CTR-0006", approver: "EMP005", days: 6, hours: 9, ot: [[5, 1.5, "Festive-season dispatch backlog"]] },
  ];
  const timesheets = [];
  let n = 0;
  plan.forEach((p) => {
    const ctr = contracts.find((c) => c.id === p.ctr);
    for (let w = 6; w >= 0; w -= 1) {
      const ws = addDays(thisWeek, -7 * w);
      if (ws < ctr.start_date) continue;
      const entries = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(ws, i);
        const worked = i < p.days && date <= today && date >= ctr.start_date;
        const ot = p.ot.find(([d]) => d === i && w % 2 === 1);
        const short = p.code === "EMP052" && i === 4 && w % 3 === 0;
        return { date, hours: worked ? (short ? 4 : p.hours) : 0, ot_hours: worked && ot ? ot[1] : 0, task: worked ? (ot ? ot[2] : p.code === "EMP054" ? "Receiving & dispatch" : p.code === "EMP052" ? "Design system / flows" : "Payments module UI") : "" };
      });
      if (!entries.some((e) => e.hours)) continue;
      n += 1;
      const status = w === 0 ? "draft" : w >= 2 && addDays(ws, 6) <= addDays(prevEnd, 1) ? "processed" : w === 1 && p.code !== "EMP052" ? "submitted" : "approved";
      timesheets.push({
        id: `TS-${String(n).padStart(4, "0")}`, contract_id: p.ctr, employee_code: p.code, week_start: ws, entries, status,
        approver: p.approver, submitted_at: w === 0 ? null : at(addDays(ws, 7), 9), decided_by: ["approved", "processed"].includes(status) ? p.approver : null, decided_at: ["approved", "processed"].includes(status) ? at(addDays(ws, 8), 11) : null,
        note: "", run_id: status === "processed" ? "CPR-0001" : null, comments: [],
      });
    }
  });

  // Last month's contractor pay run, computed with the same rules the UI uses.
  const tmp = { employees, contracts, contractVendors: vendors, contractSettings: DEFAULT_CONTRACT_SETTINGS, contractRuns: [], timesheets: timesheets.map((t) => (t.status === "processed" ? { ...t, status: "approved" } : { ...t, status: "x" })) };
  const leela = contracts.find((c) => c.id === "CTR-0005");
  const runContracts = contracts.filter((c) => ["CTR-0002", "CTR-0003", "CTR-0004", "CTR-0006", "CTR-0007"].includes(c.id) || c.id === "CTR-0005");
  const lines = runContracts.map((c) => {
    const cc = c.id === "CTR-0005" ? { ...leela, milestones: leela.milestones.map((m) => (m.status === "processed" ? { ...m, status: "approved" } : m)) } : c;
    return contractPayLine(tmp, cc, prevPeriod);
  }).filter((l) => l.has_work);
  const postedAt = at(addDays(prevEnd, 2), 12);
  const inv = [];
  let k = 0;
  lines.filter((l) => l.route === "invoice").forEach((l) => {
    k += 1;
    inv.push({ id: `${DEFAULT_CONTRACT_SETTINGS.invoice_prefix}${prevPeriod.replace("-", "")}/${String(k).padStart(3, "0")}`, kind: "self_billed", run_id: "CPR-0001", period: prevPeriod, employee_code: l.employee_code, contract_id: l.contract_id, currency: l.currency, lines: invoiceLines(l), subtotal: l.gross, gst: l.gst, tds: l.tds, total: Math.round((l.gross + l.gst) * 100) / 100, net_payable: l.net, status: "paid", issued_at: postedAt, due_date: addDays(prevEnd, 17), paid_at: at(addDays(prevEnd, 9), 15), utr: `HDFCN${String(52011873 + k)}` });
  });
  const vend = lines.filter((l) => l.route === "vendor");
  if (vend.length) {
    k += 1;
    const sub = vend.reduce((s, l) => s + l.invoice_base, 0);
    const gst = vend.reduce((s, l) => s + l.gst, 0);
    const tds = vend.reduce((s, l) => s + l.tds, 0);
    inv.push({ id: `${DEFAULT_CONTRACT_SETTINGS.vendor_invoice_prefix}${prevPeriod.replace("-", "")}/${String(k).padStart(3, "0")}`, kind: "vendor", run_id: "CPR-0001", period: prevPeriod, vendor_id: "VEN-01", vendor_ref: `TS/${prevPeriod.replace("-", "")}/0917`, currency: "INR", lines: vend.flatMap(invoiceLines), subtotal: round(sub), gst: round(gst), tds: round(tds), total: round(sub + gst), net_payable: round(sub + gst - tds), status: "paid", issued_at: postedAt, due_date: addDays(prevEnd, 32), paid_at: at(addDays(prevEnd, 12), 15), utr: "HDFCN52011999" });
  }
  const runs = [{
    id: "CPR-0001", period: prevPeriod, status: "posted", lines, created_by: "ADM01", created_at: at(addDays(prevEnd, 1), 10), approved_by: "ADM02", approved_at: at(addDays(prevEnd, 2), 11), posted_at: postedAt, payslip_batch_id: "PSB-0001", invoice_ids: inv.map((i) => i.id), note: "",
    history: [{ at: at(addDays(prevEnd, 1), 10), by: "ADM01", action: `Run created · ${lines.length} contract(s)` }, { at: at(addDays(prevEnd, 1), 10), by: "ADM01", action: "Sent to Finance" }, { at: at(addDays(prevEnd, 2), 11), by: "ADM02", action: "Approved by Finance" }, { at: postedAt, by: "ADM02", action: `Posted: payroll lines to payslip run PSB-0001, ${inv.length} invoice(s) raised` }],
  }];
  return { contractVendors: vendors, contracts, timesheets, contractRuns: runs, contractInvoices: inv, contractSettings: { ...DEFAULT_CONTRACT_SETTINGS } };
}

const round = (n) => Math.round(n * 100) / 100;
export function invoiceLines(l) {
  const out = [];
  const unit = l.basis === "daily" ? "day" : l.basis === "monthly" ? "month" : "hour";
  if (l.base) out.push({ desc: `${l.name} – ${l.basis === "monthly" ? "monthly fee (pro-rated)" : `${unit}s worked`}`, qty: l.units, unit, rate: l.rate, amount: l.base });
  if (l.ot) out.push({ desc: `${l.name} – approved overtime`, qty: l.ot_hours, unit: "hour", rate: l.ot_hours ? round(l.ot / l.ot_hours) : 0, amount: l.ot });
  if (l.milestones) out.push({ desc: `${l.name} – accepted milestone(s)`, qty: l.milestone_ids.length, unit: "milestone", rate: "", amount: l.milestones });
  if (l.markup) out.push({ desc: `Vendor service charge on ${l.name}`, qty: "", unit: "", rate: "", amount: l.markup });
  return out;
}
