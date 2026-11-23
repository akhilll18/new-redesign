// BGV demo content: fills each check of a case with what HR would have captured while tracking it — the stage it
// has reached, a dated tracking log, PF / address / company-email details and the document checklist — consistent
// with the check's status. Used by the seed and to fill older saved cases. Checks that already have a tracking log
// (anything HR has touched) are left exactly as they are.
import { stagesOf, CHECK_DONE, DOCUMENT_ITEMS } from "../lib/collab.js";

const hash = (s) => [...String(s)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const pickOf = (arr, key) => arr[hash(key) % arr.length];
const day = (iso) => String(iso || "").slice(0, 10);

const EMPLOYERS = [
  ["Infosys Ltd", "infosys.com", "Lakshmi Narayan"],
  ["Wipro Ltd", "wipro.com", "Deepa Kulkarni"],
  ["Tech Mahindra", "techmahindra.com", "Harish Rao"],
  ["Cognizant Technology Solutions", "cognizant.com", "Meera Pillai"],
  ["Accenture Solutions Pvt Ltd", "accenture.com", "Rahul Khanna"],
  ["Deloitte India (USI)", "deloitte.com", "Sneha Agarwal"],
  ["Genpact India", "genpact.com", "Vivek Menon"],
  ["HCLTech", "hcltech.com", "Anitha Raman"],
];
const AGENTS = ["Ramesh K (VeriTrust field team)", "Suresh Babu (VeriTrust field team)", "Mohammed Irfan (VeriTrust field team)", "Kiran Kumar (VeriTrust field team)"];
const RESPONDENTS = ["Self", "Mother", "Spouse", "Father", "Landlord"];
const GEO = { Hyderabad: [17.4948, 78.3996], Bengaluru: [12.9716, 77.5946], Chennai: [13.0827, 80.2707], Pune: [18.5204, 73.8567], Mumbai: [19.076, 72.8777], London: [51.5054, -0.0235], Dubai: [25.2116, 55.2793] };
const SOURCE = {
  identity: "UIDAI e-KYC and NSDL PAN verification",
  education: "University registrar (written confirmation)",
  employment: "Previous employer HR (written confirmation)",
  criminal: "District court records and local police station",
  reference: "Referees by phone",
  database: "Global sanctions, PEP and adverse media lists",
  credit: "CIBIL credit report",
  drug: "Accredited lab (5-panel)",
};

/** Index of the stage a check of this status has reached. */
function stageFor(type, status, key) {
  const n = stagesOf(type).length;
  if (CHECK_DONE.includes(status)) return n - 1;
  if (status === "in_progress") return Math.min(n - 2, 2 + (hash(key) % 2));
  if (status === "insufficient") return type === "address" ? 0 : Math.min(1, n - 2);
  return 0;
}

/** Spread `count` timestamps evenly from `from` to `to`, never later than now. */
function spread(from, to, count) {
  const a = new Date(from).getTime();
  const b = Math.min(new Date(to).getTime(), Date.now() - 3600000);
  const end = Math.max(a + 3600000, b);
  return Array.from({ length: count }, (_, i) => new Date(a + ((end - a) * (count === 1 ? 0 : i / (count - 1)))).toISOString());
}

function details(type, idx, status, ctx) {
  const { key, e, start, end, cid } = ctx;
  const [employer, domain, hr] = pickOf(EMPLOYERS, `${cid}-emp`); // same previous employer across a case's checks
  if (type === "pf") {
    const d = {};
    if (idx >= 1) d.uan = String(e?.uan || `1009${String(hash(key)).padStart(8, "0").slice(-8)}`);
    if (idx >= 2) {
      d.establishment = `${employer} · ${pickOf(["APHYD", "KNBNG", "TNMAS", "MHPUN"], key)}${String(hash(`${key}-est`) % 90000 + 10000)}`;
      d.member_id = `${pickOf(["APHYD", "KNBNG", "TNMAS", "MHPUN"], key)}00${String(hash(`${key}-mem`)).slice(0, 12)}`;
      const y = 2018 + (hash(key) % 4);
      d.epfo_from = `${y}-0${1 + (hash(key) % 8)}-01`;
      d.epfo_to = day(new Date(new Date(start).getTime() - 40 * 86400000).toISOString());
    }
    if (idx >= 3) d.result = status === "discrepancy" ? "mismatch" : status === "na" ? "no_pf" : "match";
    return d;
  }
  if (type === "address") {
    const physical = (e?.country_code || "IN") === "IN";
    const d = { method: physical ? "physical" : "digital", address_type: hash(key) % 3 === 0 ? "both" : "current" };
    if (idx >= 1 && physical) d.agent = pickOf(AGENTS, key);
    if (idx >= 2) d.visit_date = day(spread(start, end, 5)[2]);
    if (idx >= 4) {
      d.outcome = status === "discrepancy" ? "not_found" : hash(key) % 5 === 0 ? "short_stay" : "confirmed";
      d.respondent = pickOf(RESPONDENTS, key);
      d.stay_since = String(2012 + (hash(key) % 12));
      const g = GEO[e?.city] || GEO.Hyderabad;
      d.geo = `${(g[0] + (hash(key) % 100) / 10000).toFixed(5)}, ${(g[1] + (hash(`${key}g`) % 100) / 10000).toFixed(5)}`;
    }
    return d;
  }
  if (type === "company_email") {
    const d = { employer, hr_name: hr };
    if (idx >= 1) d.hr_email = `${hr.split(" ")[0].toLowerCase()}.${hr.split(" ")[1].toLowerCase()}@${domain}`;
    if (idx >= 2) d.sent_on = day(spread(start, end, 6)[2]);
    if (idx >= 4) {
      d.response = status === "discrepancy" ? "dates_differ" : status === "unable_to_verify" ? "no_response" : "confirmed";
      d.response_on = day(spread(start, end, 6)[4]);
    }
    return d;
  }
  if (type === "documents") return idx >= 2 ? { source: "Originals sighted at HR desk; copies checked with issuers" } : {};
  return idx >= 2 ? { vendor_ref: `VT-${new Date(start).getFullYear()}-${String(hash(key) % 90000 + 10000)}`, source: SOURCE[type] || "" } : {};
}

function documentItems(status, idx, key) {
  const noPassport = hash(key) % 2 === 0;
  return DOCUMENT_ITEMS.map((name, i) => {
    let s;
    if (CHECK_DONE.includes(status)) s = "verified";
    else if (status === "insufficient") s = i % 3 === 2 ? "pending" : "received";
    else if (idx === 0) s = "pending";
    else s = i < 2 + idx ? "verified" : "received";
    if (name === "Passport" && noPassport) s = "na";
    if (status === "discrepancy" && name === "Relieving / experience letter") s = "mismatch";
    return { name, status: s };
  });
}

const NOTES = {
  pf: { uan_requested: "Asked the employee for their UAN", uan_received: "UAN shared by the employee", epfo_fetched: "Passbook downloaded from the EPFO member portal", history_matched: "Contribution history compared with declared employers" },
  address: { address_captured: "Address taken from the joining form", agent_assigned: "Assigned to the field team", visit_scheduled: "Visit slot confirmed with the employee", visit_done: "Agent visited and took geo-tagged photos", report_submitted: "Field report uploaded" },
  company_email: { hr_identified: "HR contact found on the employer's careers page", domain_checked: "Email is on the employer's own domain", email_sent: "Verification request emailed", reminder_sent: "Reminder sent", response_received: "Employer replied" },
  documents: { awaiting_docs: "Checklist shared with the employee", docs_received: "Copies uploaded", originals_seen: "Originals sighted at the HR desk", authenticity: "Checked for tampering", issuer_confirmed: "Confirmed with the issuing body" },
};

/**
 * Fill one case's checks with stage, tracking log, details and document checklist.
 * `e` is the employee (or null for a candidate). Returns the same case, changed in place.
 */
export function enrichBgvCase(c, e) {
  if (!c?.checks) return c;
  const consentAt = c.consent?.status === "given" ? c.consent.at || c.initiated_at : null;
  for (const k of c.checks) {
    if (k.tracking?.length) continue; // HR has worked on this check – keep it as it is
    const key = `${c.id}-${k.type}`;
    const stages = stagesOf(k.type);
    const idx = consentAt ? stageFor(k.type, k.status, key) : 0;
    const start = consentAt || c.initiated_at;
    const end = k.verified_at || c.closed_at || (CHECK_DONE.includes(k.status) ? new Date(new Date(start).getTime() + 7 * 86400000).toISOString() : Date.now());
    const times = spread(start, end, idx + 1);
    k.stage = stages[idx][0];
    k.tracking = stages.slice(0, idx + 1).map(([s], i) => ({ stage: s, at: times[i], by: i === 0 ? c.initiated_by || "ADM01" : "ADM01", note: s === "completed" ? (k.status === "verified" ? "Verified" : k.remarks || "") : NOTES[k.type]?.[s] || "" }));
    k.details = { ...details(k.type, idx, k.status, { key, e, start, end, cid: c.id }), ...(k.details || {}) };
    if (k.type === "documents" && !k.items?.length) k.items = documentItems(k.status, idx, key);
  }
  return c;
}
