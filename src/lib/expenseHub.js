// Expense hub: brings employee expenses, third-party (company-paid / vendor) spends and advances in from other
// apps — expense tools, travel desks, corporate cards, ERPs, a CSV file or the API — and turns them into
// PeopleHub expense / advance requests stamped with the company and location they belong to.
// A real deployment calls each provider's API from the server; here `demoFeed` stands in for that call.

export const EXPENSE_APPS = [
  { id: "concur", name: "SAP Concur", group: "Expense management", kinds: ["expense", "advance", "travel"], what: "Expense reports, cash advances and Concur Travel bookings" },
  { id: "zoho_expense", name: "Zoho Expense", group: "Expense management", kinds: ["expense", "advance"], what: "Reports, advances and per-diem claims" },
  { id: "expensify", name: "Expensify", group: "Expense management", kinds: ["expense"], what: "SmartScan receipts and approved reports" },
  { id: "happay", name: "Happay", group: "Expense management", kinds: ["expense", "advance", "card"], what: "Claims, advances and Happay prepaid card spends" },
  { id: "fyle", name: "Fyle", group: "Expense management", kinds: ["expense", "card"], what: "Receipts, mileage and card transactions" },
  { id: "rydoo", name: "Rydoo", group: "Expense management", kinds: ["expense", "advance"], what: "Expenses and per diems across countries" },
  { id: "navan", name: "Navan (TripActions)", group: "Travel desk", kinds: ["travel", "card"], what: "Company-paid flights, hotels and Navan card spends" },
  { id: "mmt_mybiz", name: "MakeMyTrip myBiz", group: "Travel desk", kinds: ["travel"], what: "Company-paid flights, trains and hotels (India)" },
  { id: "uber_business", name: "Uber for Business", group: "Travel desk", kinds: ["travel"], what: "Business rides billed to the company" },
  { id: "amex_corp", name: "American Express Corporate", group: "Corporate cards", kinds: ["card"], what: "Corporate card statements by cardholder" },
  { id: "ramp", name: "Ramp", group: "Corporate cards", kinds: ["card"], what: "Card transactions with receipts and coding" },
  { id: "netsuite_exp", name: "Oracle NetSuite", group: "ERP & accounting", kinds: ["expense", "advance"], what: "Employee expense reports and employee advances from the ERP" },
  { id: "d365_exp", name: "Microsoft Dynamics 365", group: "ERP & accounting", kinds: ["expense", "advance"], what: "Expense management and cash advances" },
  { id: "tally_exp", name: "Tally Prime", group: "ERP & accounting", kinds: ["advance"], what: "Staff advance ledgers (imprest) per employee" },
];
export const APP_BY = Object.fromEntries(EXPENSE_APPS.map((a) => [a.id, a]));
export const SOURCE_LABEL = (id) => (id === "csv" ? "CSV upload" : id === "api" ? "API" : APP_BY[id]?.name || "PeopleHub");

export const KIND_LABEL = { expense: "Employee claim", advance: "Advance", travel: "Travel desk (company-paid)", card: "Corporate card", third_party: "Third-party expense" };
export const PAID_BY = [["employee", "Employee (reimburse)"], ["company_card", "Corporate card"], ["travel_desk", "Travel desk / agency"], ["vendor", "Vendor / miscellaneous"]];
export const PAID_BY_LABEL = Object.fromEntries(PAID_BY);
export const WORKER_GROUP = (e) => (!e ? "Miscellaneous" : ["agency", "freelance", "consultant", "contract", "temporary"].includes(e.worker_type) ? "Contingent workers" : "Employees");

// Words used by the other apps → PeopleHub expense category codes.
const CATEGORY_WORDS = [
  [/air|flight|rail|train|bus|travel|mileage|fuel|petrol/i, "TRAVEL"],
  [/hotel|lodg|stay|accommodation|airbnb/i, "STAY"],
  [/meal|food|lunch|dinner|breakfast|per.?diem|restaurant/i, "FOOD"],
  [/taxi|cab|uber|ola|lyft|ride|parking|toll|local|metro/i, "LOCAL"],
  [/phone|mobile|internet|broadband|telecom/i, "PHONE"],
  [/client|entertain|gift/i, "CLIENT"],
  [/office|suppl|stationery|equipment|software|subscription/i, "SUPPLY"],
];
export function mapCategory(ext, map = {}) {
  if (!ext) return "OTHER";
  if (map[ext]) return map[ext];
  return CATEGORY_WORDS.find(([re]) => re.test(ext))?.[1] || "OTHER";
}

export const toInr = (amount, currency, fx = {}) => Math.round(Number(amount || 0) * (fx[currency || "INR"] ?? 1));

/** Find the PeopleHub employee for an external record: code, then work email, then exact name. */
export function matchEmployee(rec, employees) {
  const code = String(rec.employee_code || "").trim().toUpperCase();
  const email = String(rec.employee_email || "").trim().toLowerCase();
  const name = String(rec.employee_name || "").trim().toLowerCase();
  return (code && employees.find((e) => e.employee_code === code))
    || (email && employees.find((e) => [e.email, e.login_id, e.personal_email].some((x) => x && x.toLowerCase() === email)))
    || (name && employees.filter((e) => e.full_name.toLowerCase() === name).length === 1 && employees.find((e) => e.full_name.toLowerCase() === name))
    || null;
}

// External status → PeopleHub status. "review" landing sends everything to Finance; "trust" keeps the source decision.
export function landingStatus(type, extStatus, landing) {
  const s = String(extStatus || "submitted").toLowerCase();
  if (/reject|declin/.test(s)) return "Rejected";
  if (landing === "review") return "Pending";
  if (type === "advance" && /disburs|paid|issued/.test(s)) return "Disbursed";
  if (type === "expense" && /reimburs|paid|settled|posted/.test(s)) return "Paid";
  if (/approv/.test(s)) return "Approved";
  return "Pending";
}

/**
 * Turn one normalised external record into a PeopleHub request (without id / steps; the store adds those).
 * rec: { external_id, kind, employee_*, title, purpose, project, date, currency, status, paid_by, vendor, lines[], amount, required_by }
 */
export function toRequest(rec, emp, { fx, categoryMap, landing, app, runId, now }) {
  const type = rec.kind === "advance" ? "advance" : "expense";
  const currency = (rec.currency || "INR").toUpperCase();
  const paidBy = rec.paid_by || (rec.kind === "card" ? "company_card" : rec.kind === "travel" ? "travel_desk" : "employee");
  const base = {
    type,
    employee_code: emp.employee_code,
    company_id: emp.company_id,
    location_id: emp.location_id,
    currency,
    source: { app, external_id: rec.external_id, external_status: rec.status || "submitted", kind: rec.kind || type, imported_at: now, run_id: runId },
    paid_by: paidBy,
    vendor: rec.vendor || "",
    status: landingStatus(type, rec.status, landing),
  };
  if (type === "advance") {
    const amt = toInr(rec.amount, currency, fx);
    return { ...base, request_date: rec.date, request_amount: amt, orig_amount: Number(rec.amount), purpose: rec.purpose || rec.title || "Advance", required_by: rec.required_by || rec.date, note: rec.note || "", attachment: null, ...(["Disbursed", "Approved"].includes(base.status) ? { approved_amount: amt } : {}), ...(base.status === "Disbursed" ? { disbursed_date: rec.date, payment_ref: rec.payment_ref || `${SOURCE_LABEL(app)} ${rec.external_id}` } : {}) };
  }
  const items = (rec.lines?.length ? rec.lines : [{ date: rec.date, category: rec.category, description: rec.title, amount: rec.amount }]).map((l) => ({
    date: l.date || rec.date,
    category: mapCategory(l.category, categoryMap),
    ext_category: l.category || "",
    description: l.description || rec.title || "",
    amount: toInr(l.amount, currency, fx),
    orig_amount: Number(l.amount),
    receipt: l.receipt_name ? { name: l.receipt_name, size: 0, type: "application/pdf", data_url: null } : null,
  }));
  const total = items.reduce((s, i) => s + i.amount, 0);
  return {
    ...base,
    title: rec.title || `${SOURCE_LABEL(app)} ${rec.external_id}`,
    purpose: rec.purpose || rec.title || "",
    project: rec.project || "",
    payment_mode: paidBy === "employee" ? "payroll" : "company_paid",
    advance_ref: "",
    items,
    ...(["Approved", "Paid"].includes(base.status) ? { approved_amount: total } : {}),
    ...(base.status === "Paid" ? { paid_on: rec.date, payment_ref: rec.payment_ref || (paidBy === "employee" ? `${SOURCE_LABEL(app)} ${rec.external_id}` : PAID_BY_LABEL[paidBy]) } : {}),
  };
}

export const amountOf = (r) => (r.type === "advance" ? Number(r.approved_amount ?? r.request_amount ?? 0) : r.type === "third_party" ? Number(r.amount_inr || 0) : (r.items || []).reduce((s, i) => s + Number(i.amount || 0), 0));

/** One row per spend for the register and roll-ups: native and imported requests plus third-party expenses. */
export function registerRows(data) {
  const empBy = Object.fromEntries(data.employees.map((e) => [e.employee_code, e]));
  const reqs = data.requests.filter((r) => ["expense", "advance"].includes(r.type)).map((r) => {
    const e = empBy[r.employee_code];
    const kind = r.type === "advance" ? "advance" : r.source?.kind && r.source.kind !== "expense" ? r.source.kind : r.paid_by && r.paid_by !== "employee" ? (r.paid_by === "company_card" ? "card" : r.paid_by === "travel_desk" ? "travel" : "third_party") : "expense";
    return {
      id: r.request_id, ref: r.request_id, kind, type: r.type, status: r.status,
      date: r.type === "advance" ? r.request_date : r.items?.[0]?.date || r.created_at?.slice(0, 10),
      title: r.type === "advance" ? r.purpose : r.title,
      person: e?.full_name || r.employee_code, employee_code: r.employee_code, worker: WORKER_GROUP(e),
      company_id: r.company_id || e?.company_id, location_id: r.location_id || e?.location_id,
      amount: amountOf(r), currency: r.currency || "INR", source: r.source?.app || "peoplehub", external_id: r.source?.external_id || "",
      paid_by: r.type === "advance" ? "employee" : r.paid_by || "employee", vendor: r.vendor || "",
      open_advance: r.type === "advance" && r.status === "Disbursed" && !r.settled ? amountOf(r) : 0,
      dup: (r.flags || []).some((x) => x.code === "DUP_SOURCE") && r.status === "Pending",
      drawer: true,
    };
  });
  const tp = (data.thirdPartyExpenses || []).map((t) => ({
    id: t.id, ref: t.id, kind: "third_party", type: "third_party", status: t.status,
    date: t.date, title: t.title, person: t.payee, employee_code: "", worker: "Miscellaneous",
    company_id: t.company_id, location_id: t.location_id, amount: Number(t.amount_inr || 0), currency: t.currency || "INR",
    source: t.source?.app || "manual", external_id: t.source?.external_id || "", paid_by: "vendor", vendor: t.payee, open_advance: 0, drawer: false,
  }));
  return [...reqs, ...tp].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

const PAID = new Set(["Paid", "Disbursed", "Booked", "Posted"]);
const OPEN = new Set(["Pending", "Approved"]);
/** Totals per key (company_id or location_id). */
export function rollup(rows, key) {
  const out = {};
  for (const r of rows) {
    if (["Cancelled", "Rejected"].includes(r.status)) continue;
    const k = r[key] || "—";
    const o = (out[k] ||= { key: k, count: 0, claims: 0, advances: 0, open_advance: 0, company_paid: 0, third_party: 0, imported: 0, pending: 0, settled: 0, total: 0 });
    o.count += 1;
    o.total += r.amount;
    if (r.kind === "advance") o.advances += r.amount; else if (r.kind === "third_party") o.third_party += r.amount; else if (r.paid_by !== "employee") o.company_paid += r.amount; else o.claims += r.amount;
    o.open_advance += r.open_advance;
    if (!["peoplehub", "manual"].includes(r.source)) o.imported += 1;
    if (OPEN.has(r.status)) o.pending += r.amount;
    if (PAID.has(r.status)) o.settled += r.amount;
  }
  return Object.values(out).sort((a, b) => b.total - a.total);
}

// ── CSV ──────────────────────────────────────────────
export const CSV_COLUMNS = ["external_id", "kind", "employee_code", "employee_email", "employee_name", "date", "category", "description", "amount", "currency", "title", "purpose", "project", "status", "paid_by", "vendor", "receipt_name", "company_id", "location_id"];
export const CSV_TEMPLATE = [
  CSV_COLUMNS.join(","),
  "CNR-90001,expense,EMP001,,,2026-11-02,Airfare,Hyderabad–Pune return,6450,INR,Pune client workshop,Requirements workshop,Retail CRM,approved,employee,,boarding-pass.pdf,,",
  "CNR-90001,expense,EMP001,,,2026-11-03,Hotel,1 night,4100,INR,Pune client workshop,Requirements workshop,Retail CRM,approved,employee,,hotel.pdf,,",
  "ADV-77001,advance,,maya.thompson@peoplehub.demo,,2026-11-04,,Conference travel advance,900,USD,Advance for re:Invent,Conference travel,,approved,employee,,,,",
  "AMX-55102,card,,oliver.bennett@peoplehub.demo,,2026-11-01,Client entertainment,Client dinner,240,GBP,Client dinner London,Account review,,approved,company_card,The Ivy,,,",
  "VEN-3001,third_party,,,Swift Facility Services,2026-11-05,Office supplies,Housekeeping consumables,18500,INR,Facility consumables,Third-party vendor expense,,approved,vendor,Swift Facility Services,inv-3001.pdf,ONAS-IN,IN-HYD-WH",
].join("\n");

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!clean.length) return [];
  const head = clean[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return clean.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

/** Group CSV lines into records (lines sharing an external_id form one claim) and validate them. */
export function recordsFromCsv(lines, { employees, companies = [], locations = [] }) {
  const groups = new Map();
  const errors = [];
  lines.forEach((l, i) => {
    const n = i + 2;
    const kind = (l.kind || "expense").toLowerCase();
    if (!l.external_id) return errors.push({ line: n, error: "external_id is required." });
    if (!["expense", "advance", "card", "travel", "third_party"].includes(kind)) return errors.push({ line: n, error: `Unknown kind "${l.kind}".` });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(l.date || "")) return errors.push({ line: n, error: "date must be YYYY-MM-DD." });
    if (!(Number(l.amount) > 0)) return errors.push({ line: n, error: "amount must be more than 0." });
    if (kind === "third_party" && !locations.some((x) => x.location_id === l.location_id)) return errors.push({ line: n, error: "third_party lines need a valid location_id." });
    const key = `${kind}|${l.external_id}`;
    const g = groups.get(key) || { external_id: l.external_id, kind, employee_code: l.employee_code, employee_email: l.employee_email, employee_name: l.employee_name, date: l.date, currency: (l.currency || "INR").toUpperCase(), title: l.title, purpose: l.purpose, project: l.project, status: l.status || "submitted", paid_by: l.paid_by, vendor: l.vendor, company_id: l.company_id, location_id: l.location_id, amount: 0, lines: [], csv_lines: [] };
    g.lines.push({ date: l.date, category: l.category, description: l.description, amount: Number(l.amount), receipt_name: l.receipt_name });
    g.amount += Number(l.amount);
    g.csv_lines.push(n);
    groups.set(key, g);
  });
  const records = [...groups.values()].map((g) => {
    if (g.kind === "third_party") {
      const loc = locations.find((x) => x.location_id === g.location_id);
      return { ...g, company_id: loc?.company_id || g.company_id, payee: g.vendor || g.employee_name || "Third party", match: null };
    }
    return { ...g, match: matchEmployee(g, employees)?.employee_code || null };
  });
  void companies;
  return { records, errors };
}

// ── Demo feed (stands in for the provider APIs) ──────
const SAMPLE = [
  // [employee_code, kind, title, currency, lines[[category, description, amount]], status, paid_by, vendor]
  ["EMP001", "expense", "Pune client workshop", "INR", [["Airfare", "Hyderabad–Pune return", 6450], ["Hotel", "1 night, Hinjewadi", 4100], ["Meals", "Working dinner", 780]], "approved", "employee"],
  ["EMP018", "card", "Client dinner – Canary Wharf", "GBP", [["Client entertainment", "Dinner for 4", 240]], "approved", "company_card", "The Ivy"],
  ["EMP019", "advance", "Advance for re:Invent", "USD", [["", "Conference travel advance", 900]], "approved", "employee"],
  ["EMP022", "travel", "Field visits – Warangal", "INR", [["Train", "Hyderabad–Warangal return", 980], ["Hotel", "2 nights", 5200]], "approved", "travel_desk", "MakeMyTrip myBiz"],
  ["EMP032", "expense", "Mombasa partner visit", "KES", [["Flight", "NBO–MBA return", 18500], ["Taxi", "Airport transfers", 3200]], "submitted", "employee"],
  ["EMP054", "expense", "Warehouse night-shift meals", "INR", [["Meals", "Night shift meals (agency worker)", 1450]], "approved", "employee"],
  ["EMP020", "card", "Dubai partner lunch", "AED", [["Meals", "Partner lunch, DIFC", 620]], "approved", "company_card", "Zuma DIFC"],
  ["EMP031", "advance", "Cape Town audit trip advance", "ZAR", [["", "Travel advance", 6500]], "disbursed", "employee"],
  ["EMP038", "expense", "Berlin data meetup", "EUR", [["Rail", "Deutsche Bahn day ticket", 39], ["Meals", "Lunch", 24]], "reimbursed", "employee"],
  ["EMP050", "expense", "Client UAT on site", "INR", [["Cab", "Uber to client site", 640]], "submitted", "employee"],
  ["EMP021", "travel", "Singapore–KL workshop", "SGD", [["Flight", "SIN–KUL return", 310], ["Hotel", "1 night KL", 180]], "approved", "travel_desk", "Navan"],
  ["EMP013", "advance", "Warehouse event imprest", "INR", [["", "Imprest for warehouse safety day", 12000]], "submitted", "employee"],
];
const APP_SAMPLE = {
  concur: [0, 4, 8, 2], zoho_expense: [0, 5, 9, 12], expensify: [8, 6, 1], happay: [0, 5, 12, 3], fyle: [9, 1, 6], rydoo: [8, 4, 7],
  navan: [10, 1, 3], mmt_mybiz: [3, 9], uber_business: [9, 3], amex_corp: [1, 6], ramp: [6, 1], netsuite_exp: [2, 7, 4], d365_exp: [4, 8, 2], tally_exp: [11, 7],
};
const PREFIX = { concur: "CNR", zoho_expense: "ZEX", expensify: "EXF", happay: "HPY", fyle: "FYL", rydoo: "RYD", navan: "NVN", mmt_mybiz: "MMT", uber_business: "UBR", amex_corp: "AMX", ramp: "RMP", netsuite_exp: "NS", d365_exp: "D365", tally_exp: "TLY" };

/**
 * Records "returned by" a provider on sync number `n`. Re-syncing returns the earlier records again (they are
 * de-duplicated by external_id, and pick up status changes) plus one new record per sync.
 */
export function demoFeed(appId, n, employees, today) {
  const idx = APP_SAMPLE[appId] || [0];
  const take = Math.min(idx.length, 2 + n);
  const app = APP_BY[appId];
  const out = [];
  for (let i = 0; i < take; i++) {
    const [code, kind0, title, currency, lines, status0, paid_by, vendor] = SAMPLE[idx[i]];
    const kind = app && !app.kinds.includes(kind0) ? app.kinds[0] : kind0;
    const e = employees.find((x) => x.employee_code === code);
    const date = new Date(new Date(today).getTime() - (3 + i * 2) * 86400000).toISOString().slice(0, 10);
    // Older records move on in the source app between syncs (submitted → approved → reimbursed).
    const status = n > i + 1 && status0 === "submitted" ? "approved" : n > i + 2 && status0 === "approved" && kind === "expense" ? "reimbursed" : status0;
    out.push({
      external_id: `${PREFIX[appId] || appId.toUpperCase()}-${String(4101 + i * 7)}`,
      kind, employee_email: i % 2 ? e?.email : "", employee_code: i % 2 ? "" : code, employee_name: e?.full_name,
      date, currency, title, purpose: title, project: "", status,
      paid_by: kind === "card" ? "company_card" : kind === "travel" ? "travel_desk" : paid_by, vendor: vendor || (kind === "travel" ? app?.name : ""),
      amount: lines.reduce((s, l) => s + l[2], 0),
      lines: lines.map(([category, description, amount]) => ({ date, category, description, amount, receipt_name: amount > 500 ? `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}.pdf` : "" })),
    });
  }
  // One record the hub cannot match to an employee: lands in Exceptions.
  if (n >= 1 && ["concur", "happay", "amex_corp", "navan"].includes(appId)) {
    out.push({ external_id: `${PREFIX[appId]}-9${n}01`, kind: app.kinds.includes("card") ? "card" : app.kinds[0], employee_email: "r.iyer@swiftfacility.example", employee_name: "R. Iyer (Swift Facility Services)", date: today, currency: "INR", title: "Housekeeping supplies – Shamshabad", purpose: "Facility consumables", status: "approved", paid_by: "vendor", vendor: "Swift Facility Services", amount: 18500, lines: [{ date: today, category: "Office supplies", description: "Housekeeping consumables", amount: 18500, receipt_name: "swift-inv.pdf" }] });
  }
  return out;
}

/** An existing, live request for the same person, type, first date and amount (within ₹1). */
export function findDuplicate(requests, body) {
  const day = body.type === "advance" ? body.request_date : body.items?.[0]?.date;
  const amt = amountOf(body);
  return requests.find((r) => r.type === body.type && r.employee_code === body.employee_code && !["Cancelled", "Rejected"].includes(r.status)
    && (r.type === "advance" ? r.request_date : r.items?.[0]?.date) === day && Math.abs(amountOf(r) - amt) <= 1) || null;
}

// ── Import into a data draft (used by the store, the CSV upload and the demo seed) ──
const nowIso = () => new Date().toISOString();
function seqAfter(list, prefix, key) {
  const max = list.reduce((m, it) => Math.max(m, Number((String(it[key] ?? "").match(/(\d+)$/) || [])[1]) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/**
 * Apply external records to the draft `d`. New records become requests (or third-party expenses), known ones
 * (same app + external_id) pick up status changes, unmatched ones go to the exceptions queue.
 * hooks: { actor, adminFor(d, emp, type), note(to, text, link) }
 */
export function applyImport(d, app, records, hooks = {}) {
  const now = nowIso();
  d.expenseHub ||= { connections: {}, runs: [], exceptions: [], categoryMaps: {} };
  d.thirdPartyExpenses ||= [];
  const hub = d.expenseHub;
  const conn = hub.connections[app] || {};
  const landing = conn.landing || "trust";
  const categoryMap = hub.categoryMaps?.[app] || {};
  const runId = seqAfter(hub.runs, "SYNC-", "id");
  const stats = { id: runId, app, at: now, by: hooks.actor || "SYSTEM", fetched: records.length, created: 0, updated: 0, skipped: 0, exceptions: 0, created_ids: [] };
  for (const rec of records) {
    const known = d.requests.find((r) => r.source?.app === app && r.source.external_id === rec.external_id && (r.type === "advance") === (rec.kind === "advance"))
      || d.thirdPartyExpenses.find((t) => t.source?.app === app && t.source.external_id === rec.external_id);
    if (known) {
      if (rec.status && known.source.external_status !== rec.status) {
        known.source.external_status = rec.status;
        if (known.type !== undefined && landing === "trust") {
          const next = landingStatus(known.type, rec.status, landing);
          const held = (known.flags || []).some((f) => f.code === "DUP_SOURCE") && known.status === "Pending";
          if (next !== known.status && !["Cancelled"].includes(known.status) && !held) {
            known.history = [...(known.history || []), { status: next, at: now, by: "SYSTEM", note: `${SOURCE_LABEL(app)} status: ${rec.status}` }];
            known.status = next;
            // Keep the approval chain in step with the decision taken in the other app.
            if (next !== "Pending" && !(known.flags || []).some((f) => f.code === "DUP_SOURCE")) {
              (known.steps || []).forEach((st) => { if (["pending", "waiting"].includes(st.status)) Object.assign(st, { status: next === "Rejected" ? "rejected" : "approved", at: now, note: `In ${SOURCE_LABEL(app)}` }); });
              known.stage = null;
            }
            if (next === "Paid") Object.assign(known, { paid_on: now.slice(0, 10), payment_ref: known.payment_ref || `${SOURCE_LABEL(app)} ${rec.external_id}`, approved_amount: known.approved_amount ?? amountOf(known) });
            if (next === "Disbursed") Object.assign(known, { disbursed_date: now.slice(0, 10), approved_amount: known.approved_amount ?? known.request_amount });
            if (next === "Approved") known.approved_amount = known.approved_amount ?? amountOf(known);
          }
        }
        stats.updated += 1;
      } else stats.skipped += 1;
      continue;
    }
    if (rec.kind === "third_party") {
      const id = seqAfter(d.thirdPartyExpenses, "TPE-", "id");
      d.thirdPartyExpenses.unshift({ id, payee: rec.payee || rec.vendor || "Third party", title: rec.title || rec.purpose || "", date: rec.date, category: mapCategory(rec.lines?.[0]?.category, categoryMap), currency: rec.currency || "INR", amount: rec.amount, amount_inr: toInr(rec.amount, rec.currency, d.fx), company_id: rec.company_id, location_id: rec.location_id, status: /pend|submit/i.test(rec.status || "") ? "Pending" : "Booked", source: { app, external_id: rec.external_id, imported_at: now, run_id: runId }, lines: rec.lines || [] });
      stats.created += 1;
      stats.created_ids.push(id);
      continue;
    }
    const emp = rec.employee_code_resolved ? d.employees.find((e) => e.employee_code === rec.employee_code_resolved) : matchEmployee(rec, d.employees);
    if (!emp) {
      if (!hub.exceptions.some((x) => x.app === app && x.record.external_id === rec.external_id && !x.resolved)) hub.exceptions.unshift({ id: seqAfter(hub.exceptions, "EXC-", "id"), app, at: now, reason: "No PeopleHub employee matches this code, email or name.", record: rec, resolved: null });
      stats.exceptions += 1;
      continue;
    }
    const body = toRequest(rec, emp, { fx: d.fx || {}, categoryMap, landing, app, runId, now });
    const type = body.type;
    // The same spend often reaches PeopleHub twice (e.g. an expense tool and a travel desk). Hold it for Finance.
    const dup = findDuplicate(d.requests, body);
    if (dup) {
      body.flags = [{ code: "DUP_SOURCE", level: "warn", text: `Possible duplicate of ${dup.request_id} (${dup.source?.app ? SOURCE_LABEL(dup.source.app) : "raised in PeopleHub"}): same person, date and amount.` }];
      if (body.status !== "Rejected") { body.status = "Pending"; delete body.approved_amount; delete body.paid_on; delete body.payment_ref; delete body.disbursed_date; }
      stats.duplicates = (stats.duplicates || 0) + 1;
    }
    const prefix = type === "advance" ? "ADV-" : "EXP-";
    const id = seqAfter(d.requests.filter((r) => r.type === type), prefix, "request_id");
    const mgr = d.employees.find((e) => e.employee_code === emp.reporting_manager && e.status === "active")?.employee_code || null;
    const adminCode = (hooks.adminFor && hooks.adminFor(d, emp, type)) || "ADM02";
    const decided = body.status !== "Pending";
    const sourceApproved = (landing === "review" || !!dup) && /approv|reimburs|paid|disburs/i.test(rec.status || "");
    const steps = [
      { level: "manager", approver: mgr, status: decided || sourceApproved ? (mgr ? (body.status === "Rejected" ? "rejected" : "approved") : "skipped") : mgr ? "pending" : "skipped", at: decided || sourceApproved ? now : null, note: decided || sourceApproved ? `In ${SOURCE_LABEL(app)}` : "" },
      { level: "admin", approver: adminCode, status: decided ? (body.status === "Rejected" ? "rejected" : "approved") : sourceApproved || dup || !mgr ? "pending" : "waiting", at: decided ? now : null, note: decided ? `In ${SOURCE_LABEL(app)}` : "" },
    ];
    const r = {
      ...body, request_id: id, stage: decided ? null : dup || sourceApproved || !mgr ? "admin" : "manager", flags: body.flags || [],
      steps, created_at: now,
      history: [{ status: "Imported", at: now, by: "SYSTEM", note: `${SOURCE_LABEL(app)} ${rec.external_id} · ${rec.status || "submitted"}` }, ...(decided ? [{ status: body.status, at: now, by: "SYSTEM", note: `Decision kept from ${SOURCE_LABEL(app)}` }] : [])],
    };
    d.requests.unshift(r);
    stats.created += 1;
    stats.created_ids.push(id);
    if (hooks.note) {
      hooks.note(emp.employee_code, `${SOURCE_LABEL(app)} ${rec.external_id} was brought into PeopleHub as ${id}.`, type === "advance" ? "/expenses" : "/expenses");
      if (dup) hooks.note(adminCode, `${id} from ${SOURCE_LABEL(app)} looks like a duplicate of ${dup.request_id}. Check it in All approvals.`, "/approvals");
      else if (r.stage === "manager") hooks.note(mgr, `${emp.full_name}'s ${type === "advance" ? "advance" : "expense"} ${id} from ${SOURCE_LABEL(app)} needs your approval.`, "/inbox");
      else if (r.stage === "admin") hooks.note(adminCode, `${id} from ${SOURCE_LABEL(app)} (${emp.full_name}) is waiting for Finance.`, "/approvals");
    }
  }
  if (hooks.silent) return stats;
  hub.runs.unshift(stats);
  hub.connections[app] = { ...conn, last_sync: now, syncs: (conn.syncs || 0) + (app === "csv" || app === "api" ? 0 : 1), last_result: { created: stats.created, updated: stats.updated, exceptions: stats.exceptions } };
  return stats;
}
