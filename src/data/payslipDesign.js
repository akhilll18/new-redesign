// Payslip designs: fully customisable payslip / payment-advice formats per organisation.
// A design is either one of the built-in layouts (classic, modern, SAP-style remuneration statement, Oracle-style pay advice,
// compact, minimal) styled with the organisation's colours, fonts, logo, letterhead, labels, fields and sections — or the
// organisation's own uploaded format (HTML or Word converted to HTML) with {{placeholders}}.
// Designs are assigned by rule: default, per worker type (permanent, contract, intern …) and per country.
// One renderer (renderPayslipHtml) is used for the on-screen view, print / PDF, download and the emailed attachment.
import { payslipEntity } from "../lib/statutory.js";
import { SECTIONS, payslipTotals, amountInWords, periodLabel, PAYSLIP_EMPLOYEE_FIELDS, PAYSLIP_DAY_FIELDS } from "./payslipFields.js";
import { WORKER_TYPES, WORKER_TYPE_BY, COUNTRIES } from "./employeeFields.js";

export const LAYOUTS = [
  { id: "classic", name: "Classic (company template)", desc: "Logo and title with a heavy rule, boxed detail grid, two-column earnings / deductions. Matches the original ONAS template." },
  { id: "modern", name: "Modern", desc: "Coloured header band, summary tiles for gross, deductions and net, rounded cards." },
  { id: "sap", name: "Remuneration statement (SAP-style)", desc: "Single boxed statement with wage-type codes, description and amount columns, like SAP HCM / SuccessFactors." },
  { id: "oracle", name: "Pay advice (Oracle-style)", desc: "Pay summary strip first, then earnings and deductions tables with current and year-to-date columns." },
  { id: "compact", name: "Compact", desc: "Dense one-page table — prints small; good for large workforces and contract staff." },
  { id: "minimal", name: "Minimal", desc: "No boxes, generous white space, accent rules. Clean modern look." },
];

export const FONTS = [
  ["'DM Sans', Arial, sans-serif", "DM Sans"],
  ["Arial, Helvetica, sans-serif", "Arial / Helvetica"],
  ["'Segoe UI', Roboto, sans-serif", "Segoe UI / Roboto"],
  ["Calibri, Carlito, sans-serif", "Calibri"],
  ["Georgia, 'Times New Roman', serif", "Georgia (serif)"],
  ["'Times New Roman', Times, serif", "Times New Roman"],
  ["Verdana, Geneva, sans-serif", "Verdana"],
  ["'Courier New', monospace", "Courier (monospace)"],
];

export const COLOR_PRESETS = [
  { id: "onas", name: "ONAS navy", colors: { primary: "#163A44", accent: "#1A8C8C", text: "#163A44", muted: "#5B6F75", border: "#C9D3D6", headerBg: "#FFFFFF", headerText: "#163A44", tableHeadBg: "#EEF4F5", tableHeadText: "#163A44", netBg: "#EEF4F5", netText: "#163A44", pageBg: "#FFFFFF" } },
  { id: "forest", name: "EZY green", colors: { primary: "#1E493A", accent: "#27614E", text: "#202922", muted: "#66716A", border: "#D5DED6", headerBg: "#1E493A", headerText: "#FFFFFF", tableHeadBg: "#E8F2EC", tableHeadText: "#1E493A", netBg: "#E8F2EC", netText: "#1E493A", pageBg: "#FFFFFF" } },
  { id: "sap", name: "SAP blue", colors: { primary: "#0A6ED1", accent: "#354A5F", text: "#32363A", muted: "#6A6D70", border: "#C5CCD3", headerBg: "#354A5F", headerText: "#FFFFFF", tableHeadBg: "#EFF4F9", tableHeadText: "#32363A", netBg: "#E5F0FA", netText: "#0A6ED1", pageBg: "#FFFFFF" } },
  { id: "oracle", name: "Oracle red", colors: { primary: "#C74634", accent: "#312D2A", text: "#312D2A", muted: "#6F6A66", border: "#D9D4CF", headerBg: "#312D2A", headerText: "#FFFFFF", tableHeadBg: "#F5F2EE", tableHeadText: "#312D2A", netBg: "#FBEDEA", netText: "#C74634", pageBg: "#FFFFFF" } },
  { id: "royal", name: "Royal purple", colors: { primary: "#4B2E83", accent: "#B7A57A", text: "#2B2238", muted: "#6E6680", border: "#DCD6E8", headerBg: "#4B2E83", headerText: "#FFFFFF", tableHeadBg: "#F1EDF8", tableHeadText: "#4B2E83", netBg: "#F1EDF8", netText: "#4B2E83", pageBg: "#FFFFFF" } },
  { id: "mono", name: "Monochrome (print-friendly)", colors: { primary: "#111111", accent: "#444444", text: "#111111", muted: "#555555", border: "#BBBBBB", headerBg: "#FFFFFF", headerText: "#111111", tableHeadBg: "#F0F0F0", tableHeadText: "#111111", netBg: "#F0F0F0", netText: "#111111", pageBg: "#FFFFFF" } },
];

export const COLOR_KEYS = [
  ["primary", "Primary (titles, rules)"], ["accent", "Accent (highlights)"], ["text", "Body text"], ["muted", "Labels / secondary text"], ["border", "Borders & lines"],
  ["headerBg", "Header background"], ["headerText", "Header text"], ["tableHeadBg", "Table heading background"], ["tableHeadText", "Table heading text"],
  ["netBg", "Net pay box background"], ["netText", "Net pay box text"], ["pageBg", "Page background"],
];

export const SECTION_KEYS = [
  ["header", "Header (logo & title)"], ["company", "Company name & address"], ["employee", "Employee details"], ["days", "Salary days"],
  ["earnings", "Earnings"], ["contributions", "Contributions"], ["deductions", "Taxes & deductions"], ["reimbursements", "Reimbursements"],
  ["details", "Additional details (custom fields)"], ["summary", "Totals strip"], ["net", "Net pay box"], ["words", "Amount in words"],
  ["ytd", "Year-to-date figures"], ["notes", "Notes / message"], ["signature", "Authorised signature"], ["footer", "Footer"],
];

export const EXTRA_EMP_FIELDS = [
  ["full_name", "Employee name"], ["email", "Email"], ["worker_type", "Worker type"], ["grade_code", "Grade"], ["city", "Location"],
  ["country_code", "Country"], ["tax_regime", "Tax regime"], ["cost_centre", "Cost centre"], ["po_number", "PO / SOW number"],
  ["business_name", "Business name"], ["gstin", "GSTIN"], ["date_of_birth", "Date of birth"], ["work_phone", "Work phone"],
];
export const ALL_EMP_FIELDS = [...PAYSLIP_EMPLOYEE_FIELDS, ...EXTRA_EMP_FIELDS];

export const DEFAULT_LABELS = {
  title: "PAYSLIP", employee: "Employee details", days: "Salary details", earnings: SECTIONS.earning.label, contributions: SECTIONS.contribution.label,
  deductions: SECTIONS.deduction.label, reimbursements: SECTIONS.reimbursement.label, details: SECTIONS.detail.label,
  totalEarnings: SECTIONS.earning.total, totalContributions: SECTIONS.contribution.total, totalDeductions: SECTIONS.deduction.total, totalReimbursements: SECTIONS.reimbursement.total,
  gross: "Gross earnings", allDeductions: "Total deductions", net: "Net salary payable (A − B − C)", payable: "Total net payable", words: "Amount in words", ytd: "Year to date",
  signature: "Authorised signatory",
};

export function defaultDesign(over = {}) {
  return {
    id: "PSD-001", name: "ONAS classic", description: "The company payslip template (ONASTech_Payslip_Aug2026.docx).", status: "active", kind: "layout", layout: "classic",
    colors: { ...COLOR_PRESETS[0].colors }, preset: "onas",
    font: { family: FONTS[0][0], size: 12, headingWeight: 800, uppercaseHeadings: true },
    header: { logo: null, logoSize: 46, logoPosition: "left", showPeriod: true, companyNameOverride: "", letterhead: null, letterheadHeight: 110, letterheadReplacesHeader: false, background: null, backgroundOpacity: 0.08 },
    sections: Object.fromEntries(SECTION_KEYS.map(([k]) => [k, !["ytd", "notes", "signature"].includes(k)])),
    labels: { ...DEFAULT_LABELS },
    employeeFields: PAYSLIP_EMPLOYEE_FIELDS.map(([key, label]) => ({ key, label, on: true })),
    columns: 4, borders: "full", radius: 4, density: "normal",
    currency: { mode: "code", decimals: 2, hideZeroLines: true },
    watermark: { text: "", opacity: 0.06 },
    signature: { image: null, name: "", title: "HR & Payroll" },
    footer: { text: "", showGenerated: false },
    notes: "",
    paper: "A4", margins: 12,
    maskAccount: true,
    html: "", css: "",
    source: null,
    history: [{ at: "2026-04-01T09:00:00.000Z", by: "SYSTEM", action: "Imported from the company payslip template" }],
    versions: [],
    updated_at: "2026-04-01T09:00:00.000Z", updated_by: "SYSTEM",
    ...over,
  };
}

export function buildPayslipDesignSeed() {
  const classic = defaultDesign();
  const contract = defaultDesign({
    id: "PSD-002", name: "Contract & intern pay statement", description: "Compact SAP-style statement used for contract employees and interns on payroll. Shows hours and contract rate.",
    layout: "sap", preset: "sap", colors: { ...COLOR_PRESETS[2].colors },
    labels: { ...DEFAULT_LABELS, title: "REMUNERATION STATEMENT", earnings: "Payments", totalEarnings: "Total payments (A)" },
    employeeFields: [...PAYSLIP_EMPLOYEE_FIELDS.filter(([k]) => !["uan", "pf_number"].includes(k)).map(([key, label]) => ({ key, label, on: true })), { key: "worker_type", label: "Worker type", on: true }, { key: "po_number", label: "PO / SOW number", on: true }],
    history: [{ at: "2026-07-01T09:00:00.000Z", by: "ADM01", action: "Created for contract workers" }], updated_by: "ADM01", updated_at: "2026-07-01T09:00:00.000Z",
  });
  const modern = defaultDesign({
    id: "PSD-003", name: "Modern green (draft)", description: "Modern layout in the EZY greens — try it before publishing.", status: "draft", layout: "modern", preset: "forest", colors: { ...COLOR_PRESETS[1].colors },
    sections: { ...defaultDesign().sections, ytd: true, signature: true }, signature: { image: null, name: "Swetha Reddy", title: "People Operations Lead" },
    history: [{ at: "2026-09-12T09:00:00.000Z", by: "ADM01", action: "Draft created" }], updated_by: "ADM01", updated_at: "2026-09-12T09:00:00.000Z",
  });
  return {
    payslipDesigns: [classic, contract, modern],
    payslipDesignRules: { default_id: "PSD-001", by_worker: { contract: "PSD-002", intern: "PSD-002", temporary: "PSD-002", apprentice: "PSD-002" }, by_country: {}, advice_id: "PSD-002", locked_to_super: false },
  };
}

/** Which design applies to an employee (country rule beats worker-type rule beats default). */
export function designFor(data, emp) {
  const list = data.payslipDesigns || [];
  const rules = data.payslipDesignRules || {};
  const usable = (id) => list.find((d) => d.id === id && d.status === "active");
  const wt = emp?.worker_type || "permanent";
  return usable(rules.by_country?.[emp?.country_code]) || usable(rules.by_worker?.[wt]) || usable(rules.default_id) || list.find((d) => d.status === "active") || defaultDesign();
}
export function adviceDesign(data) {
  const list = data.payslipDesigns || [];
  const rules = data.payslipDesignRules || {};
  return list.find((d) => d.id === rules.advice_id && d.status === "active") || list.find((d) => d.id === rules.default_id) || defaultDesign();
}

// ── Rendering ─────────────────────────────────────────
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const fmtD = (v) => { if (!v) return ""; const d = new Date(`${String(v).slice(0, 10)}T12:00:00`); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
const SYM = { INR: "₹", GBP: "£", USD: "$", EUR: "€", AED: "AED ", SGD: "S$", NAD: "N$", ZAR: "R ", KES: "KSh ", NGN: "₦", BWP: "P ", CAD: "C$", MXN: "MX$", BRL: "R$", SAR: "SAR ", MYR: "RM ", PHP: "₱", IDR: "Rp ", GHS: "GH₵", ZMW: "K " };
function fmtMoney(n, design, cur) {
  const dec = Number(design.currency?.decimals ?? 2);
  const v = (Number(n) || 0).toLocaleString(cur === "INR" ? "en-IN" : "en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return design.currency?.mode === "symbol" ? `${SYM[cur] || `${cur} `}${v}` : v;
}
const maskAcc = (acc) => (acc ? `${"•".repeat(Math.max(0, String(acc).length - 4))}${String(acc).slice(-4)}` : "");

/** Everything a template needs, resolved once. */
export function payslipModel({ slip, batch, company, design, audience = "employee", liveEmp, ytd }) {
  const d = design || defaultDesign();
  const comps = (batch.components || []).filter((k) => audience !== "employee" || k.visible).sort((a, b) => a.order - b.order);
  const t = payslipTotals(slip.values || {}, batch.components || []);
  const emp = { ...(liveEmp || {}), ...(slip.emp || {}) };
  const cur = slip.currency || COUNTRIES.find((c) => c.code === (liveEmp?.country_code || emp.country_code || "IN"))?.currency || "INR";
  const hideZero = d.currency?.hideZeroLines !== false && audience === "employee";
  // v10.3: payslips from a local country engine carry the engine's own line names (PAYE, NIC, CPF…).
  const local = slip.local_lines || null;
  const lines = (sec) => local?.[sec] ? local[sec].map(([label, value], i) => ({ code: `L-${sec}-${i}`, label, value: Number(value) || 0 })) : comps.filter((k) => k.section === sec && k.type === "amount").map((k) => ({ code: k.code, label: k.label, value: Number(slip.values?.[k.code]) || 0, ytd: ytd?.lines?.[k.code] })).filter((k) => !hideZero || k.value || comps.find((c) => c.code === k.code)?.required);
  const details = comps.filter((k) => k.section === "detail" && (slip.values?.[k.code] || audience !== "employee")).map((k) => ({ code: k.code, label: k.label, value: k.type === "date" ? fmtD(slip.values?.[k.code]) : slip.values?.[k.code] ?? "" }));
  const empVal = (k) => {
    const v = emp[k];
    if (k === "date_of_joining" || k === "date_of_birth") return fmtD(v);
    if (k === "bank_account" && d.maskAccount !== false) return maskAcc(v);
    if (k === "worker_type") return WORKER_TYPE_BY[v || "permanent"]?.short || v;
    if (k === "country_code") return COUNTRIES.find((c) => c.code === v)?.name || v;
    if (k === "tax_regime") return v ? `${v[0].toUpperCase()}${v.slice(1)} regime` : "";
    return v ?? "";
  };
  // v10.3: India-only identifiers (UAN, PF, PAN, IFSC) are left off payslips of other countries when empty.
  const indiaOnly = new Set(["uan", "pf_number", "pan", "bank_ifsc"]);
  const empFields = (d.employeeFields || []).filter((f) => f.on && !(cur !== "INR" && indiaOnly.has(f.key) && !emp[f.key])).map((f) => ({ key: f.key, label: f.label, value: empVal(f.key) }));
  const days = PAYSLIP_DAY_FIELDS.map(([k, l]) => ({ key: k, label: l, value: k === "lop_days" ? Number(slip[k] || 0).toFixed(2) : String(slip[k] ?? "") }));
  const month = periodLabel(batch.period);
  const m = (n) => fmtMoney(n, d, cur);
  return {
    d, t, emp, cur, month, m, empFields, days, details,
    earnings: lines("earning"), contributions: lines("contribution"), deductions: lines("deduction"), reimbursements: lines("reimbursement"),
    company: (() => { const ent = payslipEntity({ ...emp, ...(liveEmp || {}) }, company || {}); return { name: d.header?.companyNameOverride || ent.name || "", address: [...(ent.address || []), ...(ent.registration ? [ent.registration] : [])], logo: d.header?.logo || company?.logo || "", footer: d.footer?.text || company?.footer || "" }; })(),
    words: amountInWords(Math.round(t.payable)),
    ytd,
  };
}

function baseCss(d) {
  const c = d.colors;
  const pad = d.density === "compact" ? 4 : 7;
  const bw = d.borders === "none" ? 0 : 1;
  return `
:root{--p:${c.primary};--a:${c.accent};--t:${c.text};--mu:${c.muted};--b:${c.border};--hb:${c.headerBg};--ht:${c.headerText};--thb:${c.tableHeadBg};--tht:${c.tableHeadText};--nb:${c.netBg};--nt:${c.netText};--pg:${c.pageBg};--r:${Number(d.radius) || 0}px;--pad:${pad}px}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--pg)}
body{font-family:${d.font.family};font-size:${Number(d.font.size) || 12}px;color:var(--t);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ps{position:relative;max-width:820px;margin:0 auto;padding:22px 26px;background:var(--pg);overflow:hidden}
.ps h1,.ps h2,.ps h3{margin:0;font-weight:${d.font.headingWeight || 800};color:var(--p)}
.ps .up{${d.font.uppercaseHeadings === false ? "" : "text-transform:uppercase;letter-spacing:.04em;"}}
.lbl{font-size:.74em;font-weight:700;color:var(--mu);${d.font.uppercaseHeadings === false ? "" : "text-transform:uppercase;letter-spacing:.03em;"}}
.val{font-weight:700;margin-top:2px;word-break:break-word}
.grid{display:grid;grid-template-columns:repeat(${Number(d.columns) || 4},minmax(0,1fr));${bw ? "border-top:1px solid var(--b);border-left:1px solid var(--b);" : "gap:8px 18px;"}}
.grid .cell{padding:var(--pad) 9px;${bw ? "border-right:1px solid var(--b);border-bottom:1px solid var(--b);" : ""}}
.sec{margin-top:14px}
.sec-title{font-size:.86em;font-weight:${d.font.headingWeight || 800};color:var(--p);padding-bottom:4px;margin-bottom:4px;border-bottom:2px solid var(--p)}
table.lines{width:100%;border-collapse:collapse}
table.lines td{padding:calc(var(--pad) - 2px) 0;border-bottom:1px dashed var(--b)}
table.lines td.amt,table.lines th.amt{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
table.lines tr.total td{border-bottom:0;font-weight:800;padding-top:var(--pad)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:26px}
.net{margin-top:14px;padding:12px 14px;background:var(--nb);color:var(--nt);border-radius:var(--r)}
.net .row{display:flex;justify-content:space-between;gap:10px;font-weight:800}
.words{margin-top:6px;font-weight:700;font-size:.92em}
.foot{margin-top:18px;text-align:center;font-size:.8em;color:var(--mu)}
.notes{margin-top:12px;padding:9px 11px;border-left:3px solid var(--a);background:rgba(0,0,0,.025);font-size:.9em;white-space:pre-wrap}
.sign{margin-top:26px;display:flex;justify-content:flex-end}
.sign .box{text-align:center;min-width:190px}
.sign img{max-height:48px;display:block;margin:0 auto 4px}
.sign .line{border-top:1px solid var(--t);padding-top:4px;font-size:.85em}
.wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-size:72px;font-weight:900;color:var(--p);transform:rotate(-24deg);white-space:nowrap}
.bgimg{position:absolute;inset:0;background-size:cover;background-position:center;pointer-events:none}
.letterhead{display:block;width:100%;object-fit:contain;object-position:left top;margin-bottom:10px}
@media (max-width:560px){.cols{grid-template-columns:1fr;gap:0}.grid{grid-template-columns:1fr 1fr}.ps{padding:14px}}
@page{size:${d.paper === "Letter" ? "letter" : "A4"};margin:${Number(d.margins) || 12}mm}
@media print{.ps{max-width:none;padding:0}}
`;
}

const LAYOUT_CSS = {
  classic: `.hdr{display:flex;justify-content:space-between;align-items:center;gap:14px;padding-bottom:10px;border-bottom:3px solid var(--p);background:var(--hb);color:var(--ht)}.hdr .ttl{text-align:right}.hdr h1{font-size:1.35em;color:var(--ht)}.hdr .co{font-size:.8em;font-weight:700;color:var(--mu)}`,
  modern: `.hdr{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:16px 18px;margin:-22px -26px 14px;background:var(--hb);color:var(--ht)}.hdr h1{color:var(--ht);font-size:1.4em}.hdr .co{color:var(--ht);opacity:.85;font-size:.82em}.hdr .logo{background:#fff;padding:6px 10px;border-radius:10px}.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.tile{border:1px solid var(--b);border-radius:var(--r);padding:10px 12px}.tile .big{font-size:1.35em;font-weight:800;color:var(--p);margin-top:3px}.tile.hl{background:var(--nb);border-color:transparent}.tile.hl .big{color:var(--nt)}.grid{border-radius:var(--r);overflow:hidden}.sec-title{border-bottom-width:1px}`,
  sap: `.hdr{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:10px 12px;background:var(--hb);color:var(--ht)}.hdr h1{color:var(--ht);font-size:1.2em}.hdr .co{color:var(--ht);opacity:.85;font-size:.8em}.frame{border:1px solid var(--b)}.frame .sec{margin:0;padding:8px 12px;border-top:1px solid var(--b)}.frame .sec-title{border:0;background:var(--thb);color:var(--tht);margin:-8px -12px 6px;padding:5px 12px}table.wt{width:100%;border-collapse:collapse}table.wt th{background:var(--thb);color:var(--tht);text-align:left;font-size:.82em;padding:5px 8px;border-bottom:1px solid var(--b)}table.wt td{padding:4px 8px;border-bottom:1px solid var(--b)}table.wt td.code{font-family:'Courier New',monospace;color:var(--mu);width:90px}table.wt td.amt,table.wt th.amt{text-align:right;font-variant-numeric:tabular-nums}table.wt tr.sub td{font-weight:800;background:rgba(0,0,0,.02)}table.wt tr.neg td.amt{color:var(--t)}`,
  oracle: `.hdr{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;padding-bottom:10px;border-bottom:4px solid var(--p);background:var(--hb);color:var(--ht)}.hdr h1{font-size:1.5em;color:var(--p)}.hdr .co{color:var(--mu);font-size:.8em}.strip{display:grid;grid-template-columns:repeat(4,1fr);margin-top:12px}.strip>div{padding:10px 12px;background:var(--thb);border-right:2px solid var(--pg)}.strip>div:last-child{background:var(--p);color:#fff}.strip>div:last-child .lbl{color:#fff;opacity:.85}.strip .big{font-size:1.25em;font-weight:800;margin-top:3px}table.oa{width:100%;border-collapse:collapse;margin-top:4px}table.oa th{text-align:left;background:var(--thb);color:var(--tht);padding:5px 8px;font-size:.8em}table.oa td{padding:5px 8px;border-bottom:1px solid var(--b)}table.oa .amt{text-align:right;font-variant-numeric:tabular-nums}table.oa tr.total td{font-weight:800;border-top:2px solid var(--p);border-bottom:0}`,
  compact: `.ps{padding:14px 16px}.hdr{display:flex;justify-content:space-between;align-items:center;padding-bottom:6px;border-bottom:2px solid var(--p);background:var(--hb);color:var(--ht)}.hdr h1{font-size:1.1em;color:var(--ht)}.hdr .co{font-size:.78em;color:var(--mu)}table.cp{width:100%;border-collapse:collapse;margin-top:8px}table.cp th,table.cp td{border:1px solid var(--b);padding:3px 6px;font-size:.92em}table.cp th{background:var(--thb);color:var(--tht);text-align:left}table.cp .amt{text-align:right;font-variant-numeric:tabular-nums}table.cp tr.total td{font-weight:800;background:var(--nb);color:var(--nt)}`,
  minimal: `.hdr{display:flex;justify-content:space-between;align-items:center;gap:14px;padding-bottom:16px;background:var(--hb);color:var(--ht)}.hdr h1{font-weight:300;font-size:1.7em;letter-spacing:.12em;color:var(--p)}.hdr .co{color:var(--mu);font-size:.8em}.grid{border:0!important;gap:10px 22px}.grid .cell{border:0!important;padding:0}.sec-title{border-bottom:1px solid var(--a);color:var(--a);font-weight:600}table.lines td{border-bottom:0}.net{background:none;border-top:2px solid var(--a);border-bottom:2px solid var(--a);border-radius:0;color:var(--t)}`,
};

function logoHtml(md) {
  const d = md.d;
  return md.company.logo ? `<img class="logo-img" src="${esc(md.company.logo)}" alt="${esc(md.company.name)}" style="height:${Number(d.header.logoSize) || 46}px;width:auto;display:block">` : "";
}
function headerHtml(md) {
  const d = md.d;
  if (d.header.letterhead && d.header.letterheadReplacesHeader) return `<img class="letterhead" src="${esc(d.header.letterhead)}" alt="" style="max-height:${Number(d.header.letterheadHeight) || 110}px">${titleOnly(md)}`;
  const lh = d.header.letterhead ? `<img class="letterhead" src="${esc(d.header.letterhead)}" alt="" style="max-height:${Number(d.header.letterheadHeight) || 110}px">` : "";
  if (!d.sections.header) return lh;
  const logo = `<div class="logo">${logoHtml(md) || "<span></span>"}</div>`;
  const ttl = `<div class="ttl"><h1 class="up">${esc(d.labels.title)}${d.header.showPeriod ? ` · ${esc(md.month)}` : ""}</h1><div class="co">${esc(md.company.name)}</div></div>`;
  const pos = d.header.logoPosition;
  if (pos === "center") return `${lh}<div class="hdr" style="flex-direction:column;text-align:center">${logo}<div class="ttl" style="text-align:center"><h1 class="up">${esc(d.labels.title)}${d.header.showPeriod ? ` · ${esc(md.month)}` : ""}</h1><div class="co">${esc(md.company.name)}</div></div></div>`;
  return `${lh}<div class="hdr">${pos === "right" ? `${ttl.replace('class="ttl"', 'class="ttl" style="text-align:left"')}${logo}` : `${logo}${ttl}`}</div>`;
}
function titleOnly(md) {
  const d = md.d;
  return `<h1 class="up" style="font-size:1.25em;margin:4px 0 8px">${esc(d.labels.title)}${d.header.showPeriod ? ` · ${esc(md.month)}` : ""}</h1>`;
}
function companyHtml(md) {
  if (!md.d.sections.company) return "";
  return `<div style="margin-top:12px"><div style="font-weight:800">${esc(md.company.name)}</div>${md.company.address.map((l) => `<div style="font-size:.86em;color:var(--mu)">${esc(l)}</div>`).join("")}</div>`;
}
const cellsHtml = (pairs) => pairs.map((p) => `<div class="cell"><div class="lbl">${esc(p.label)}</div><div class="val">${esc(p.value) || "—"}</div></div>`).join("");
function empHtml(md) {
  const d = md.d;
  if (!d.sections.employee) return "";
  const pairs = [...md.empFields, ...(d.sections.details ? md.details : [])];
  return `<div class="sec"><div style="font-weight:800;font-size:1.1em;margin-bottom:6px" class="up">${esc(md.emp.full_name || "")}</div><div class="grid">${cellsHtml(pairs)}</div></div>`;
}
function daysHtml(md) {
  if (!md.d.sections.days) return "";
  return `<div class="sec"><div class="sec-title up">${esc(md.d.labels.days)}</div><div class="grid">${cellsHtml(md.days)}</div></div>`;
}
function linesHtml(md, key, items, totalLabel, total) {
  if (!md.d.sections[key] || (!items.length && key === "reimbursements")) return "";
  const ytd = md.d.sections.ytd && md.ytd;
  return `<div class="sec"><div class="sec-title up">${esc(md.d.labels[key])}</div><table class="lines">${ytd ? `<tr><td class="lbl"></td><td class="amt lbl">Current</td><td class="amt lbl">${esc(md.d.labels.ytd)}</td></tr>` : ""}${items.map((k) => `<tr><td>${esc(k.label)}</td><td class="amt">${md.m(k.value)}</td>${ytd ? `<td class="amt">${md.m(k.ytd || 0)}</td>` : ""}</tr>`).join("")}<tr class="total"><td>${esc(totalLabel)}</td><td class="amt">${md.m(total)}</td>${ytd ? "<td></td>" : ""}</tr></table></div>`;
}
function twoCols(md) {
  const { d, t } = md;
  const left = linesHtml(md, "earnings", md.earnings, d.labels.totalEarnings, t.A) + linesHtml(md, "reimbursements", md.reimbursements, d.labels.totalReimbursements, t.R);
  const right = linesHtml(md, "contributions", md.contributions, d.labels.totalContributions, t.B) + linesHtml(md, "deductions", md.deductions, d.labels.totalDeductions, t.C);
  return `<div class="cols"><div>${left}</div><div>${right}</div></div>`;
}
function summaryHtml(md) {
  if (!md.d.sections.summary) return "";
  const { d, t } = md;
  return `<div class="sec"><div class="grid">${cellsHtml([{ label: d.labels.gross, value: md.m(t.gross) }, { label: d.labels.allDeductions, value: md.m(t.deductions) }, { label: d.labels.totalReimbursements.replace(/\s*\(R\)/, ""), value: md.m(t.R) }, { label: d.labels.payable, value: md.m(t.payable) }])}</div></div>`;
}
function netHtml(md) {
  const { d, t } = md;
  if (!d.sections.net && !d.sections.words) return "";
  return `<div class="net">${d.sections.net ? `<div class="row"><span>${esc(d.labels.net)}</span><span>${md.m(t.net)}</span></div>` : ""}${d.sections.words ? `<div class="words">${esc(d.labels.payable)} ${esc(md.cur)} ${Math.round(t.payable).toLocaleString(md.cur === "INR" ? "en-IN" : "en-GB")} (${esc(md.words)})</div>` : ""}</div>`;
}
function ytdHtml(md) {
  if (!md.d.sections.ytd || !md.ytd) return "";
  return `<div class="sec"><div class="sec-title up">${esc(md.d.labels.ytd)}</div><div class="grid">${cellsHtml([{ label: md.d.labels.gross, value: md.m(md.ytd.gross) }, { label: md.d.labels.allDeductions, value: md.m(md.ytd.deductions) }, { label: "Tax deducted", value: md.m(md.ytd.tax) }, { label: md.d.labels.payable, value: md.m(md.ytd.payable) }])}</div></div>`;
}
function tailHtml(md) {
  const d = md.d;
  let h = "";
  if (d.sections.notes && d.notes) h += `<div class="notes">${esc(d.notes)}</div>`;
  if (d.sections.signature) h += `<div class="sign"><div class="box">${d.signature.image ? `<img src="${esc(d.signature.image)}" alt="Signature">` : '<div style="height:40px"></div>'}<div class="line"><b>${esc(d.signature.name || d.labels.signature)}</b>${d.signature.title ? `<br>${esc(d.signature.title)}` : ""}</div></div></div>`;
  if (d.sections.footer) h += `<div class="foot">${esc(md.company.footer)}${d.footer.showGenerated ? `<br>Generated on ${esc(fmtD(new Date().toISOString()))}` : ""}</div>`;
  return h;
}
function overlays(md) {
  const d = md.d;
  let h = "";
  if (d.header.background) h += `<div class="bgimg" style="background-image:url('${esc(d.header.background)}');opacity:${Number(d.header.backgroundOpacity) || 0.08}"></div>`;
  if (d.watermark?.text) h += `<div class="wm" style="opacity:${Number(d.watermark.opacity) || 0.06}">${esc(d.watermark.text)}</div>`;
  return h;
}

function bodyFor(md) {
  const { d, t } = md;
  const L = d.layout;
  if (L === "modern") {
    const tiles = d.sections.summary ? `<div class="tiles"><div class="tile"><div class="lbl">${esc(d.labels.gross)}</div><div class="big">${md.m(t.gross)}</div></div><div class="tile"><div class="lbl">${esc(d.labels.allDeductions)}</div><div class="big">${md.m(t.deductions)}</div></div><div class="tile hl"><div class="lbl">${esc(d.labels.payable)}</div><div class="big">${md.m(t.payable)}</div></div></div>` : "";
    return headerHtml(md) + companyHtml(md) + tiles + empHtml(md) + daysHtml(md) + twoCols(md) + netHtml(md) + ytdHtml(md) + tailHtml(md);
  }
  if (L === "sap") {
    const wt = (title, items, totalLabel, total, key) => (!d.sections[key] || (!items.length && key === "reimbursements") ? "" : `<tr><th colspan="3">${esc(title)}</th></tr>${items.map((k) => `<tr><td class="code">${esc(k.code)}</td><td>${esc(k.label)}</td><td class="amt">${md.m(k.value)}</td></tr>`).join("")}<tr class="sub"><td></td><td>${esc(totalLabel)}</td><td class="amt">${md.m(total)}</td></tr>`);
    const emp = d.sections.employee ? `<div class="sec"><div class="sec-title up">${esc(d.labels.employee)}</div><div style="font-weight:800;margin-bottom:4px">${esc(md.emp.full_name || "")}</div><div class="grid" style="border:0;gap:4px 16px">${[...md.empFields, ...(d.sections.details ? md.details : [])].map((p) => `<div class="cell" style="border:0;padding:2px 0"><span class="lbl">${esc(p.label)}:</span> <b>${esc(p.value) || "—"}</b></div>`).join("")}</div></div>` : "";
    const days = d.sections.days ? `<div class="sec"><div class="sec-title up">${esc(d.labels.days)}</div><div class="grid" style="border:0;gap:4px 16px">${md.days.map((p) => `<div class="cell" style="border:0;padding:2px 0"><span class="lbl">${esc(p.label)}:</span> <b>${esc(p.value)}</b></div>`).join("")}</div></div>` : "";
    const table = `<div class="sec"><table class="wt"><tr><th style="width:90px">Wage type</th><th>Description</th><th class="amt">Amount (${esc(md.cur)})</th></tr>${wt(d.labels.earnings, md.earnings, d.labels.totalEarnings, t.A, "earnings")}${wt(d.labels.contributions, md.contributions, d.labels.totalContributions, t.B, "contributions")}${wt(d.labels.deductions, md.deductions, d.labels.totalDeductions, t.C, "deductions")}${wt(d.labels.reimbursements, md.reimbursements, d.labels.totalReimbursements, t.R, "reimbursements")}</table></div>`;
    return `${headerHtml(md)}<div class="frame">${d.sections.company ? `<div class="sec" style="border-top:0">${companyHtml(md).replace('style="margin-top:12px"', "")}</div>` : ""}${emp}${days}${table}${d.sections.summary ? `<div class="sec">${summaryHtml(md)}</div>` : ""}${d.sections.net || d.sections.words ? `<div class="sec">${netHtml(md)}</div>` : ""}${ytdHtml(md) ? `<div class="sec">${ytdHtml(md)}</div>` : ""}</div>${tailHtml(md)}`;
  }
  if (L === "oracle") {
    const strip = `<div class="strip"><div><div class="lbl">${esc(d.labels.gross)}</div><div class="big">${md.m(t.gross)}</div></div><div><div class="lbl">${esc(d.labels.allDeductions)}</div><div class="big">${md.m(t.deductions)}</div></div><div><div class="lbl">${esc(d.labels.totalReimbursements.replace(/\s*\(R\)/, ""))}</div><div class="big">${md.m(t.R)}</div></div><div><div class="lbl">Net pay</div><div class="big">${md.m(t.payable)}</div></div></div>`;
    const ytdOn = d.sections.ytd && md.ytd;
    const tbl = (key, items, totalLabel, total) => (!d.sections[key] || (!items.length && key === "reimbursements") ? "" : `<div class="sec"><div class="sec-title up">${esc(d.labels[key])}</div><table class="oa"><tr><th>Description</th><th class="amt">Current</th>${ytdOn ? `<th class="amt">${esc(d.labels.ytd)}</th>` : ""}</tr>${items.map((k) => `<tr><td>${esc(k.label)}</td><td class="amt">${md.m(k.value)}</td>${ytdOn ? `<td class="amt">${md.m(k.ytd || 0)}</td>` : ""}</tr>`).join("")}<tr class="total"><td>${esc(totalLabel)}</td><td class="amt">${md.m(total)}</td>${ytdOn ? "<td></td>" : ""}</tr></table></div>`);
    return headerHtml(md) + (d.sections.summary ? strip : "") + companyHtml(md) + empHtml(md) + daysHtml(md) + `<div class="cols"><div>${tbl("earnings", md.earnings, d.labels.totalEarnings, t.A)}${tbl("reimbursements", md.reimbursements, d.labels.totalReimbursements, t.R)}</div><div>${tbl("contributions", md.contributions, d.labels.totalContributions, t.B)}${tbl("deductions", md.deductions, d.labels.totalDeductions, t.C)}</div></div>` + netHtml(md) + tailHtml(md);
  }
  if (L === "compact") {
    const rows = [];
    const max = Math.max(md.earnings.length + md.reimbursements.length, md.contributions.length + md.deductions.length);
    const left = [...(d.sections.earnings ? md.earnings : []), ...(d.sections.reimbursements ? md.reimbursements : [])];
    const right = [...(d.sections.contributions ? md.contributions : []), ...(d.sections.deductions ? md.deductions : [])];
    for (let i = 0; i < max; i += 1) rows.push(`<tr><td>${esc(left[i]?.label || "")}</td><td class="amt">${left[i] ? md.m(left[i].value) : ""}</td><td>${esc(right[i]?.label || "")}</td><td class="amt">${right[i] ? md.m(right[i].value) : ""}</td></tr>`);
    const emp = d.sections.employee ? `<table class="cp"><tr><th colspan="4">${esc(md.emp.full_name || "")}</th></tr>${chunk([...md.empFields, ...(d.sections.details ? md.details : []), ...(d.sections.days ? md.days : [])], 2).map((pr) => `<tr>${pr.map((p) => `<td class="lbl" style="width:22%">${esc(p.label)}</td><td style="width:28%"><b>${esc(p.value) || "—"}</b></td>`).join("")}</tr>`).join("")}</table>` : "";
    return `${headerHtml(md)}${companyHtml(md)}${emp}<table class="cp"><tr><th>${esc(d.labels.earnings)}</th><th class="amt">${esc(md.cur)}</th><th>${esc(d.labels.deductions)}</th><th class="amt">${esc(md.cur)}</th></tr>${rows.join("")}<tr class="total"><td>${esc(d.labels.gross)}</td><td class="amt">${md.m(t.gross + t.R)}</td><td>${esc(d.labels.allDeductions)}</td><td class="amt">${md.m(t.deductions)}</td></tr><tr class="total"><td colspan="3">${esc(d.labels.payable)}${d.sections.words ? ` — ${esc(md.words)}` : ""}</td><td class="amt">${md.m(t.payable)}</td></tr></table>${tailHtml(md)}`;
  }
  // classic + minimal share the structure; CSS differs.
  return headerHtml(md) + companyHtml(md) + empHtml(md) + daysHtml(md) + twoCols(md) + summaryHtml(md) + netHtml(md) + ytdHtml(md) + tailHtml(md);
}
const chunk = (arr, n) => arr.reduce((a, x, i) => (i % n ? a[a.length - 1].push(x) : a.push([x]), a), []);

// ── Custom (uploaded) templates ───────────────────────
export const PLACEHOLDERS = [
  ["{{company.name}}", "Company name"], ["{{company.address}}", "Company address (lines)"], ["{{logo}}", "Logo image"], ["{{company.footer}}", "Footer text"],
  ["{{period}}", "Pay month, e.g. October 2026"], ["{{employee.full_name}}", "Employee name"], ["{{employee.<field>}}", "Any employee field, e.g. {{employee.pan}}"],
  ["{{days.total_working_days}}", "Total working days"], ["{{days.actual_payable_days}}", "Actual payable days"], ["{{days.lop_days}}", "Loss-of-pay days"], ["{{days.days_payable}}", "Days payable"],
  ["{{value.CODE}}", "Amount of a payslip field, e.g. {{value.BASIC}}"], ["{{label.CODE}}", "Label of a payslip field"],
  ["{{earnings_rows}}", "<tr> rows of earnings (label, amount)"], ["{{contributions_rows}}", "<tr> rows of contributions"], ["{{deductions_rows}}", "<tr> rows of taxes & deductions"], ["{{reimbursements_rows}}", "<tr> rows of reimbursements"],
  ["{{employee_table}}", "Employee details grid"], ["{{earnings_table}}", "Earnings table with total"], ["{{deductions_table}}", "Contributions + deductions table"],
  ["{{totals.A}} {{totals.B}} {{totals.C}} {{totals.R}}", "Section totals"], ["{{totals.gross}}", "Gross earnings"], ["{{totals.deductions}}", "Total deductions"], ["{{totals.net}}", "Net salary (A − B − C)"], ["{{totals.payable}}", "Total net payable"],
  ["{{amount_words}}", "Net payable in words"], ["{{currency}}", "Currency code"], ["{{signature}}", "Signature block"], ["{{colors.primary}} …", "Design colours (primary, accent, text, border …)"],
];

function customVars(md) {
  const { t, d } = md;
  const v = {
    "company.name": esc(md.company.name), "company.address": md.company.address.map(esc).join("<br>"), "company.footer": esc(md.company.footer), logo: logoHtml(md),
    period: esc(md.month), currency: esc(md.cur), amount_words: esc(md.words),
    "totals.A": md.m(t.A), "totals.B": md.m(t.B), "totals.C": md.m(t.C), "totals.R": md.m(t.R), "totals.gross": md.m(t.gross), "totals.deductions": md.m(t.deductions), "totals.net": md.m(t.net), "totals.payable": md.m(t.payable),
    employee_table: `<div class="grid">${cellsHtml([...md.empFields, ...md.details])}</div>`,
    earnings_table: linesHtml({ ...md, d: { ...d, sections: { ...d.sections, earnings: true } } }, "earnings", md.earnings, d.labels.totalEarnings, t.A),
    deductions_table: linesHtml({ ...md, d: { ...d, sections: { ...d.sections, contributions: true } } }, "contributions", md.contributions, d.labels.totalContributions, t.B) + linesHtml({ ...md, d: { ...d, sections: { ...d.sections, deductions: true } } }, "deductions", md.deductions, d.labels.totalDeductions, t.C),
    signature: tailHtml({ ...md, d: { ...d, sections: { signature: true } } }),
  };
  const rows = (items) => items.map((k) => `<tr><td>${esc(k.label)}</td><td class="amt" style="text-align:right">${md.m(k.value)}</td></tr>`).join("");
  v.earnings_rows = rows(md.earnings);
  v.contributions_rows = rows(md.contributions);
  v.deductions_rows = rows(md.deductions);
  v.reimbursements_rows = rows(md.reimbursements);
  Object.entries(d.colors).forEach(([k, c]) => { v[`colors.${k}`] = c; });
  Object.entries(md.emp).forEach(([k, x]) => { if (typeof x !== "object") v[`employee.${k}`] = esc(md.empFields.find((f) => f.key === k)?.value ?? x); });
  md.days.forEach((x) => { v[`days.${x.key}`] = esc(x.value); });
  [...md.earnings, ...md.contributions, ...md.deductions, ...md.reimbursements].forEach((k) => { v[`value.${k.code}`] = md.m(k.value); v[`label.${k.code}`] = esc(k.label); });
  md.details.forEach((k) => { v[`value.${k.code}`] = esc(k.value); v[`label.${k.code}`] = esc(k.label); });
  return v;
}
/** Strip active content from an uploaded template (scripts, event handlers, javascript: URLs). */
export function sanitizeTemplate(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(iframe|object|embed|link|meta|base)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "$1=$2#$2");
}
function renderCustom(md) {
  const vars = customVars(md);
  const body = sanitizeTemplate(md.d.html).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => (k in vars ? vars[k] : /^value\./.test(k) ? md.m(0) : ""));
  // A full HTML document keeps its own <head>; otherwise wrap it.
  if (/<html[\s>]/i.test(body)) return body.replace(/<\/head>/i, `<style>${baseCss(md.d)}${md.d.css || ""}</style></head>`);
  return `<div class="ps custom">${overlays(md)}${body}</div>`;
}

/** Complete, self-contained HTML document for one payslip. */
export function renderPayslipHtml(opts) {
  const md = payslipModel(opts);
  const d = md.d;
  const title = `Payslip ${md.month} – ${md.emp.full_name || ""}`;
  if (d.kind === "custom_html" && d.html) {
    const out = renderCustom(md);
    if (/<html[\s>]/i.test(out)) return out;
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${baseCss(d)}${d.css || ""}</style></head><body>${out}</body></html>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${baseCss(d)}${LAYOUT_CSS[d.layout] || LAYOUT_CSS.classic}${d.css || ""}</style></head><body><div class="ps layout-${esc(d.layout)}">${overlays(md)}${bodyFor(md)}</div></body></html>`;
}

/** Sample payslip used for previews in the designer. */
export function samplePayslip(components, emp) {
  const e = emp || { employee_code: "EMP001", full_name: "Akhil Reddy", date_of_joining: "2025-06-20", department: "Engineering", designation: "Associate Software Engineer", payment_mode: "Bank Transfer", bank_name: "HDFC Bank", bank_ifsc: "HDFC0001234", bank_account: "50100018800121", uan: "100988001371", pf_number: "TSHYD004128700000000001", pan: "ABCPR1007K", worker_type: "permanent", country_code: "IN", city: "Hyderabad", grade_code: "P1", email: "akhil.reddy@peoplehub.demo" };
  const values = { BASIC: 29166.5, HRA: 11666.6, SPECIAL: 17499.9, OTHER_ALW: 0, PF_EE: 1800, ESI_EE: 0, PT: 200, TDS: 1125, REIMB: 1850, CW_HOURS: "", CW_RATE: "" };
  (components || []).forEach((k) => { if (!(k.code in values)) values[k.code] = k.type === "amount" ? 0 : k.section === "detail" ? "—" : ""; });
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const period = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  return { slip: { id: "SAMPLE", employee_code: e.employee_code, actual_payable_days: 30, total_working_days: 30, lop_days: 0, days_payable: 30, values, emp: e }, batch: { period, components: (components || []).filter((k) => k.status === "Active") } };
}

// ── Uploaded formats: map sample values in an uploaded HTML / Word format to placeholders ──
const LABEL_MAP = [
  [/pf\s*employee|provident|employee\s*pf/i, "{{value.PF_EE}}"], [/esi\s*employee|employee\s*esi/i, "{{value.ESI_EE}}"],
  [/^\s*(employee\s*)?name\s*$|^\s*employee\s*name/i, "{{employee.full_name}}"], [/^\s*(employee|emp\.?)\s*(no\.?|number|id|code)/i, "{{employee.employee_code}}"], [/date\s*(of\s*)?join/i, "{{employee.date_of_joining}}"],
  [/department/i, "{{employee.department}}"], [/designation|job\s*title/i, "{{employee.designation}}"], [/payment\s*mode/i, "{{employee.payment_mode}}"], [/bank\s*ifsc|ifsc/i, "{{employee.bank_ifsc}}"],
  [/bank\s*(a\/c|account)|account\s*(no|number)/i, "{{employee.bank_account}}"], [/^\s*bank\s*(name)?\s*$/i, "{{employee.bank_name}}"], [/\buan\b/i, "{{employee.uan}}"], [/pf\s*(no|number)/i, "{{employee.pf_number}}"], [/\bpan\b/i, "{{employee.pan}}"],
  [/actual\s*payable\s*days/i, "{{days.actual_payable_days}}"], [/total\s*working\s*days/i, "{{days.total_working_days}}"], [/loss\s*of\s*pay|lop/i, "{{days.lop_days}}"], [/days\s*payable/i, "{{days.days_payable}}"],
  [/^\s*basic/i, "{{value.BASIC}}"], [/\bhra\b|house\s*rent/i, "{{value.HRA}}"], [/special\s*allow/i, "{{value.SPECIAL}}"], [/other\s*allow/i, "{{value.OTHER_ALW}}"], [/pf\s*employee|provident/i, "{{value.PF_EE}}"],
  [/esi/i, "{{value.ESI_EE}}"], [/professional\s*tax/i, "{{value.PT}}"], [/\btds\b|income\s*tax/i, "{{value.TDS}}"], [/^\s*reimbursements?\s*$/i, "{{value.REIMB}}"],
  [/total\s*earnings/i, "{{totals.A}}"], [/total\s*contributions/i, "{{totals.B}}"], [/total\s*taxes|total\s*deductions/i, "{{totals.C}}"], [/gross/i, "{{totals.gross}}"], [/net\s*(salary|pay)/i, "{{totals.net}}"], [/total\s*net\s*payable/i, "{{totals.payable}}"],
];
/** Replace the value next to each recognised label in table cells; returns { html, mapped: [label → placeholder] }. */
export function autoMapTemplate(html) {
  const mapped = [];
  let out = String(html || "");
  // <td>Label</td><td>value</td>  (also <th>, <p> wrappers inside cells)
  out = out.replace(/(<t[dh][^>]*>(?:\s*<[^>]+>)*\s*)([^<]{2,60}?)(\s*(?:<\/[^>]+>\s*)*<\/t[dh]>\s*<t[dh][^>]*>(?:\s*<[^>]+>)*\s*)([^<]*?)(\s*(?:<\/[^>]+>\s*)*<\/t[dh]>)/gi, (all, a, label, mid, value, end) => {
    if (/\{\{/.test(value)) return all;
    const hit = LABEL_MAP.find(([re]) => re.test(label.trim()));
    if (!hit) return all;
    mapped.push([label.trim(), hit[1]]);
    return `${a}${label}${mid}${hit[1]}${end}`;
  });
  // Name / period headings
  out = out.replace(/(payslip\s*(for|·|-|–)?\s*)([A-Z][a-z]+\s+\d{4})/i, (all, a, b, m) => { mapped.push([m, "{{period}}"]); return `${a}{{period}}`; });
  return { html: out, mapped };
}
export const WORKER_RULE_OPTIONS = WORKER_TYPES.map((w) => [w.id, w.label]);
