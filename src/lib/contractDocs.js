// Printable contract, self-billed invoice / payment advice and vendor invoice, styled with the organisation's
// payslip design (colours, font, logo, letterhead, footer) so every pay document looks the same.
import { esc } from "../data/payslipDesign.js";
import { contractVars, fillTemplate, money, rateText, DEFAULT_CONTRACT_SETTINGS, AMENDMENT_TYPES, contractState } from "./contracts.js";
import { WORKER_TYPE_BY } from "../data/employeeFields.js";
import { amountInWords, periodLabel } from "../data/payslipFields.js";

const fmt = (v) => { if (!v) return "—"; const d = new Date(`${String(v).slice(0, 10)}T12:00:00`); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };

function shell(design, company, title, body) {
  const c = design.colors;
  const logo = design.header?.logo || company.logo;
  const lh = design.header?.letterhead;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
*{box-sizing:border-box}body{margin:0;font-family:${design.font.family};font-size:${Number(design.font.size) || 12}px;color:${c.text};background:${c.pageBg};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc{max-width:820px;margin:0 auto;padding:24px 28px}
.hdr{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:${design.layout === "modern" || design.layout === "sap" ? "14px 16px" : "0 0 10px"};background:${c.headerBg};color:${c.headerText};border-bottom:3px solid ${c.primary}}
.hdr h1{margin:0;font-size:1.3em;font-weight:${design.font.headingWeight || 800};letter-spacing:.04em;color:${c.headerBg.toUpperCase() === "#FFFFFF" ? c.primary : c.headerText}}
.hdr .co{font-size:.8em;opacity:.85}
.lbl{font-size:.74em;font-weight:700;color:${c.muted};text-transform:uppercase;letter-spacing:.03em}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid ${c.border};border-left:1px solid ${c.border};margin-top:12px}
.grid>div{padding:7px 9px;border-right:1px solid ${c.border};border-bottom:1px solid ${c.border}}
.grid b{display:block;margin-top:2px}
h2{font-size:.95em;color:${c.primary};border-bottom:2px solid ${c.primary};padding-bottom:4px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.04em}
table.t{width:100%;border-collapse:collapse}table.t th{background:${c.tableHeadBg};color:${c.tableHeadText};text-align:left;padding:6px 8px;font-size:.85em}table.t td{padding:6px 8px;border-bottom:1px solid ${c.border}}.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr.tot td{font-weight:800;border-top:2px solid ${c.primary};border-bottom:0}
.net{margin-top:14px;padding:12px 14px;background:${c.netBg};color:${c.netText};border-radius:${Number(design.radius) || 0}px;font-weight:800}
.clauses{white-space:pre-wrap;line-height:1.55}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:34px}.sig div{border-top:1px solid ${c.text};padding-top:6px;font-size:.9em}
.stamp{display:inline-block;margin-top:4px;padding:2px 8px;border:1px solid ${c.accent};color:${c.accent};border-radius:4px;font-size:.8em;font-weight:700}
.foot{margin-top:20px;text-align:center;color:${c.muted};font-size:.8em}
.lh{display:block;width:100%;max-height:${Number(design.header?.letterheadHeight) || 110}px;object-fit:contain;object-position:left top;margin-bottom:8px}
@page{size:${design.paper === "Letter" ? "letter" : "A4"};margin:${Number(design.margins) || 12}mm}@media print{.doc{padding:0}}
</style></head><body><div class="doc">${lh ? `<img class="lh" src="${esc(lh)}" alt="">` : ""}<div class="hdr"><div>${logo && !(lh && design.header?.letterheadReplacesHeader) ? `<img src="${esc(logo)}" alt="" style="height:${Number(design.header?.logoSize) || 44}px;background:#fff;padding:${design.header?.logoPosition === "left" && c.headerBg.toUpperCase() !== "#FFFFFF" ? "4px 8px;border-radius:8px" : "0"}">` : ""}</div><div style="text-align:right"><h1>${esc(title)}</h1><div class="co">${esc(company.name)}</div></div></div>${body}<div class="foot">${esc((design.footer?.text || company.footer || "This is a system-generated document.").replace(/payslip/gi, "document"))}</div></div></body></html>`;
}

export function contractDocumentHtml(data, c, company, design) {
  const s = { ...DEFAULT_CONTRACT_SETTINGS, ...(data.contractSettings || {}) };
  const emp = data.employees.find((e) => e.employee_code === c.employee_code) || {};
  const vars = contractVars(data, c, company.name);
  const vendor = (data.contractVendors || []).find((v) => v.id === c.vendor_id);
  const st = contractState(c, s);
  const grid = [
    ["Contract no.", c.id], ["Worker", `${emp.full_name || ""} (${c.employee_code})`], ["Worker type", WORKER_TYPE_BY[c.worker_type]?.label || c.worker_type],
    ["Role / SOW", c.title], ["Department", c.department || emp.department], ["Status", st.replace("_", " ")],
    ["Start date", fmt(c.start_date)], ["End date", c.end_date ? fmt(c.end_date) : "Open"], ["Notice", `${c.notice_days || 15} days`],
    ["Rate", rateText(c)], ["Standard hours", c.pay_basis === "milestone" ? "—" : `${c.std_hours_week} h / week`], ["Overtime", `${c.ot_multiplier || 1}×`],
    ["Paid through", c.payment_route === "payroll" ? "Company payroll (payslip)" : c.payment_route === "vendor" ? `Vendor: ${vendor?.name || "—"}` : "Self-billed invoice"], ["TDS section", c.tds_section], ["PO / SOW no.", c.po_number || "—"],
    ["Work location", c.work_location || "—"], ["Budget cap", c.budget_amount ? money(c.budget_amount, c.currency) : "—"], ["Business / GSTIN", [c.business_name || emp.business_name, c.gstin || emp.gstin].filter(Boolean).join(" · ") || "—"],
  ];
  const ms = (c.milestones || []).length ? `<h2>Milestones</h2><table class="t"><tr><th>Milestone</th><th>Due</th><th class="r">Amount</th><th>Status</th></tr>${c.milestones.map((m) => `<tr><td>${esc(m.title)}</td><td>${fmt(m.due)}</td><td class="r">${money(m.amount, c.currency)}</td><td>${esc(m.status)}</td></tr>`).join("")}</table>` : "";
  const am = (c.amendments || []).length ? `<h2>Amendments</h2><table class="t"><tr><th>No.</th><th>Type</th><th>Change</th><th>Effective</th><th>Reason</th></tr>${c.amendments.map((a) => `<tr><td>${esc(a.id)}</td><td>${esc(AMENDMENT_TYPES.find(([k]) => k === a.type)?.[1] || a.type)}</td><td>${esc(a.from)} → ${esc(a.to)}</td><td>${fmt(a.effective)}</td><td>${esc(a.note)}</td></tr>`).join("")}</table>` : "";
  const sigW = c.signed?.worker ? `<span class="stamp">E-signed ${fmt(c.signed.worker.at)}</span>` : "<i>Awaiting e-signature</i>";
  const sigC = c.signed?.company ? `<span class="stamp">Approved ${fmt(c.signed.company.at)}</span>` : "<i>Awaiting approval</i>";
  const body = `<div class="grid">${grid.map(([k, v]) => `<div><span class="lbl">${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>
${c.deliverables ? `<h2>Scope & deliverables</h2><div class="clauses">${esc(c.deliverables)}</div>` : ""}
<h2>Terms</h2><div class="clauses">${esc(fillTemplate(s.clause_template, vars))}</div>${ms}${am}
<div class="sig"><div><b>For ${esc(company.name)}</b><br>${sigC}</div><div><b>${esc(emp.full_name || "")}</b><br>${sigW}</div></div>`;
  return shell(design, company, c.payment_route === "vendor" ? "WORK ORDER" : "CONTRACT FOR SERVICES", body);
}

export function invoiceHtml(data, inv, company, design) {
  const emp = data.employees.find((e) => e.employee_code === inv.employee_code) || {};
  const vendor = (data.contractVendors || []).find((v) => v.id === inv.vendor_id);
  const self = inv.kind === "self_billed";
  const title = self ? (inv.status === "paid" ? "PAYMENT ADVICE" : "SELF-BILLED INVOICE") : "VENDOR INVOICE (RECORDED)";
  const party = self
    ? [["Supplier", `${emp.business_name || emp.full_name} (${inv.employee_code})`], ["PAN", emp.pan || "—"], ["GSTIN", emp.gstin || "Not registered"], ["Bank", emp.bank_name ? `${emp.bank_name} ····${String(emp.bank_account || "").slice(-4)}` : "—"]]
    : [["Vendor", vendor?.name || inv.vendor_id], ["GSTIN", vendor?.gstin || "—"], ["Vendor ref.", inv.vendor_ref || "—"], ["CLRA licence", vendor?.clra_licence || "—"]];
  const grid = [["Invoice no.", inv.id], ["Period", periodLabel(inv.period)], ["Issued", fmt(inv.issued_at)], ["Due", fmt(inv.due_date)], ["Status", inv.status === "paid" ? `Paid ${fmt(inv.paid_at)}` : inv.status], ["Bank ref. (UTR)", inv.utr || "—"], ...party];
  const body = `<div class="grid">${grid.map(([k, v]) => `<div><span class="lbl">${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>
<h2>Billed to</h2><div>${esc(company.name)}<br>${(company.address || []).map(esc).join("<br>")}</div>
<h2>Details</h2><table class="t"><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>${inv.lines.map((l) => `<tr><td>${esc(l.desc)}</td><td class="r">${esc(l.qty)} ${esc(l.unit || "")}</td><td class="r">${l.rate === "" ? "" : money(l.rate, inv.currency)}</td><td class="r">${money(l.amount, inv.currency)}</td></tr>`).join("")}
<tr><td colspan="3" class="r">Subtotal</td><td class="r">${money(inv.subtotal, inv.currency)}</td></tr>
<tr><td colspan="3" class="r">GST ${inv.gst ? `@ ${(data.contractSettings || DEFAULT_CONTRACT_SETTINGS).gst_rate}%` : "(not applicable)"}</td><td class="r">${money(inv.gst, inv.currency)}</td></tr>
<tr class="tot"><td colspan="3" class="r">Invoice total</td><td class="r">${money(inv.total, inv.currency)}</td></tr>
<tr><td colspan="3" class="r">Less TDS</td><td class="r">− ${money(inv.tds, inv.currency)}</td></tr></table>
<div class="net">Net ${inv.status === "paid" ? "paid" : "payable"}: ${money(inv.net_payable, inv.currency)}<br><span style="font-weight:600">${esc(inv.currency)} ${esc(amountInWords(Math.round(inv.net_payable)))}</span></div>
<p style="font-size:.85em;color:${design.colors.muted};margin-top:12px">${self ? "Self-billed invoice raised by the company from timesheets and milestones approved in PeopleHub, under the agreement in the contract. TDS deducted is deposited against the supplier's PAN and shown in Form 16A." : "Recorded from the vendor's invoice; TDS under section 194C is deducted and certified in Form 16A."}</p>`;
  return shell(design, company, title, body);
}
