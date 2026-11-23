// Demo payslip data: the template's fields, one pending field proposal, and last month's released payslips.
import { DEFAULT_COMPONENTS, payslipTotals, periodLabel, PAYMENT_MODE_LABEL, PAYSLIP_EMPLOYEE_FIELDS } from "./payslipFields.js";
import { indiaPayslipRow } from "../lib/payslipGen.js";
import { paysThroughPayroll } from "./employeeFields.js";

export function buildPayslipSeed(employees) {
  const components = JSON.parse(JSON.stringify(DEFAULT_COMPONENTS));
  components.push({ code: "ESI_EE", label: "ESI Employee", section: "contribution", type: "amount", required: false, visible: true, order: 2, status: "Active", stage: null, draft: null, proposed_by: "ADM01", history: [{ at: "2026-05-02T10:00:00.000Z", by: "ADM01", action: "Proposed new field" }, { at: "2026-05-02T15:00:00.000Z", by: "ADM02", action: "Finance approved" }, { at: "2026-05-03T09:30:00.000Z", by: "SA001", action: "Super Admin approved → Active" }] });
  components.push({ code: "COST_CENTRE", label: "Cost centre", section: "detail", type: "text", required: false, visible: true, order: 1, status: "Pending", stage: "finance", draft: { label: "Cost centre", section: "detail", type: "text", required: false, visible: true, order: 1 }, proposed_by: "ADM01", history: [{ at: new Date(Date.now() - 86400000).toISOString(), by: "ADM01", action: "Proposed new field" }] });

  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const period = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const active = components.filter((k) => k.status === "Active");
  const india = employees.filter((e) => e.status === "active" && (e.country_code || "IN") === "IN" && paysThroughPayroll(e));
  const releasedAt = new Date(now.getFullYear(), now.getMonth(), 1, 10, 30).toISOString();
  const slips = india.map((e, i) => {
    const row = indiaPayslipRow(e, { period, totalWorkingDays: 30, lopDays: e.employee_code === "EMP006" ? 1 : 0, otPay: 0, reimbursement: e.employee_code === "EMP001" ? 1850 : 0 });
    const emp = { full_name: e.full_name, email: e.email };
    PAYSLIP_EMPLOYEE_FIELDS.forEach(([k]) => { emp[k] = k === "payment_mode" ? PAYMENT_MODE_LABEL[e.payment_mode] || e.payment_mode || "Bank Transfer" : e[k] || ""; });
    return { id: `PSB-0001-${String(i + 1).padStart(3, "0")}`, ...row, emp, emailed_at: releasedAt };
  });
  const batch = {
    id: "PSB-0001", period, source: "payroll", note: "", status: "Released", created_by: "ADM01", created_at: new Date(now.getFullYear(), now.getMonth() - 1, 28, 11).toISOString(),
    finance_by: "ADM02", super_by: "SA001", released_by: "ADM01", released_at: releasedAt, components: JSON.parse(JSON.stringify(active)), slips,
    history: [
      { at: new Date(now.getFullYear(), now.getMonth() - 1, 28, 11).toISOString(), by: "ADM01", action: `Created from payroll · ${slips.length} payslip(s)` },
      { at: new Date(now.getFullYear(), now.getMonth() - 1, 28, 11, 5).toISOString(), by: "ADM01", action: "Sent to Finance for approval" },
      { at: new Date(now.getFullYear(), now.getMonth() - 1, 29, 16).toISOString(), by: "ADM02", action: "Finance approved" },
      { at: new Date(now.getFullYear(), now.getMonth() - 1, 30, 9, 40).toISOString(), by: "SA001", action: "Super Admin approved" },
      { at: releasedAt, by: "ADM01", action: `Released to ${slips.length} employee(s) and emailed` },
    ],
  };
  const emails = slips.map((s) => {
    const t = payslipTotals(s.values, batch.components);
    return { id: `EM-seed-${s.id}`, to: s.emp.email, to_name: s.emp.full_name, employee_code: s.employee_code, subject: `Your payslip for ${periodLabel(period)} – ONASTECH GLOBAL SERVICES PRIVATE LIMITED`, body: `Dear ${s.emp.full_name.split(" ")[0]},\n\nYour payslip for ${periodLabel(period)} is now available in PeopleHub under Pay & benefits → My payslips. Net payable: ₹${t.payable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}.\n\nFor any questions, raise an HR support request.\n\nRegards,\nHR & Payroll\nONASTECH GLOBAL SERVICES PRIVATE LIMITED`, batch_id: "PSB-0001", slip_id: s.id, at: releasedAt, status: "Sent" };
  });
  return { payslipComponents: components, payslipBatches: [batch], emails };
}

// Demo offer letters (fictional candidates from the recruitment pipeline).
export function buildOfferSeed() {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const plus = (n) => iso(new Date(today.getTime() + n * 86400000));
  const offerFields = [
    { key: "reporting_to", label: "Reporting to", group: "offer", type: "text", required: false, default: "", help: "Name and title of the manager", active: true, updated_by: "ADM01", updated_at: today.toISOString() },
    { key: "night_shift_allowance", label: "Night Shift Allowance", group: "salary_earning", type: "amount", required: false, default: 0, active: true, updated_by: "ADM01", updated_at: today.toISOString() },
    { key: "client_deputation", label: "Client deputation", group: "clause", type: "clause", required: false, default: "During your employment you may be deputed to client locations in and around {{work_city}}. Travel and stay for such deputations will be reimbursed as per Company policy.", active: true, updated_by: "ADM01", updated_at: today.toISOString() },
  ];
  const base = { salutation: "Ms.", country: "India", offer_date: iso(today), work_city: "HYDERABAD", work_address: "Vasavi Sky City, 8th Floor, Tower 1\nQuick Start – Co-Working, Gachibowli Circle\nTelecom Nagar, Gachibowli\nHyderabad, Telangana – 500081, India", remote_work: "no", probation_months: 6, leave_probation_days: 15, leave_confirmed_days: 20, notice_months: 3, non_compete_months: 6, passport_required: "yes", shifts_clause: "yes", basic_pct: 50, hra_pct: 40, lta_pct: 10, pf_mode: "capped", professional_tax: 200, performance_bonus_annual: 0, night_shift_allowance: 0, client_deputation: offerFields[2].default };
  const offers = [
    { id: "OFR-0001", status: "Draft", source: "manual", candidate_id: "CD-6", values: { ...base, candidate_name: "Ishita Bose", address: "12-4-88, Lakshmi Nagar Colony\nKukatpally, Hyderabad – 500072", phone: "+91 90000 11122", email: "ishita@mail.demo", designation: "Account Executive", role: "Sales", joining_date: plus(21), monthly_ctc: 65000, performance_bonus_annual: 60000, reporting_to: "Sanjay Reddy, Sales Manager – India" }, fields: offerFields, ctc_annual: 780000, created_by: "ADM01", created_at: today.toISOString(), history: [{ at: today.toISOString(), by: "ADM01", action: "Prepared (manual)" }] },
    { id: "OFR-0002", status: "Accepted", source: "manual", candidate_id: "CD-8", values: { ...base, salutation: "Mr.", candidate_name: "Nikhil Joshi", address: "Plot 7, Sri Sai Residency\nMiyapur, Hyderabad – 500049", phone: "+91 90000 33344", email: "nikhil@mail.demo", designation: "Data Analyst", role: "Analytics", joining_date: plus(7), monthly_ctc: 52000, remote_work: "yes", reporting_to: "Suresh Babu, Lead – Data Migration" }, fields: offerFields, ctc_annual: 624000, created_by: "ADM01", created_at: new Date(today.getTime() - 9 * 86400000).toISOString(), issued_at: new Date(today.getTime() - 8 * 86400000).toISOString(), issued_by: "ADM01", emailed_at: new Date(today.getTime() - 8 * 86400000).toISOString(), responded_at: new Date(today.getTime() - 5 * 86400000).toISOString(), history: [{ at: new Date(today.getTime() - 9 * 86400000).toISOString(), by: "ADM01", action: "Prepared (manual)" }, { at: new Date(today.getTime() - 8 * 86400000).toISOString(), by: "ADM01", action: "Issued and emailed to nikhil@mail.demo" }, { at: new Date(today.getTime() - 5 * 86400000).toISOString(), by: "ADM01", action: "Accepted · onboarding started" }] },
  ];
  return { offerFields, offers };
}
