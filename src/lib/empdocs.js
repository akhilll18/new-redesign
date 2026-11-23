// Employee document checklist: the joining / statutory documents for the employee's country (country packs)
// plus the documents their background verification needs. Used by the Documents page and the sidebar badge.
import { packFor, countryOf } from "../country/countryPacks.js";
import { bgvFor, BGV_CHECK_LABEL } from "./collab.js";

const DEFAULT_DOCS = ["Government photo ID / passport", "Work permit or visa (if not a citizen)", "Tax identification number", "Bank account proof", "Education & experience certificates", "Signed employment contract"];
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const DOC_STATUS = {
  missing: { label: "Missing", tone: "bad" },
  submitted: { label: "Submitted · HR reviewing", tone: "info" },
  verified: { label: "Verified", tone: "good" },
  rejected: { label: "Re-upload needed", tone: "warn" },
};
export const BGV_DOC_STATUS = {
  needed: { label: "Upload needed", tone: "bad" },
  uploaded: { label: "Uploaded · with verifier", tone: "info" },
  verified: { label: "Verified", tone: "good" },
  pending: { label: "Not needed yet", tone: "neutral" },
  discrepancy: { label: "HR will contact you", tone: "warn" },
  na: { label: "Not applicable", tone: "neutral" },
};

export function requiredDocs(emp) {
  const list = packFor(countryOf(emp))?.documents || DEFAULT_DOCS;
  return list.map((name) => ({ key: slug(name), name }));
}

export function docChecklist(data, emp) {
  if (!emp) return { statutory: [], bgv: [], bgvCase: null, missing: 0, total: 0, done: 0 };
  const recs = (data.empDocs || []).filter((d) => d.employee_code === emp.employee_code);
  const statutory = requiredDocs(emp).map((r) => {
    const rec = recs.find((d) => d.doc_key === r.key) || null;
    return { ...r, rec, status: rec?.status || "missing" };
  });
  const c = bgvFor(data, emp.employee_code);
  const bgv = c && !c.closed_status
    ? c.checks.map((k) => {
        const mine = (k.docs || []).filter((d) => d.by === emp.employee_code);
        const status = k.status === "verified" ? "verified" : k.status === "na" ? "na" : k.status === "discrepancy" ? "discrepancy" : k.status === "insufficient" ? "needed" : mine.length ? "uploaded" : c.consent?.status === "given" ? "pending" : "pending";
        return { type: k.type, name: BGV_CHECK_LABEL[k.type], status, ask: k.candidate_note, docs: mine, check: k };
      })
    : c ? c.checks.map((k) => ({ type: k.type, name: BGV_CHECK_LABEL[k.type], status: k.status === "discrepancy" ? "discrepancy" : "verified", docs: (k.docs || []).filter((d) => d.by === emp.employee_code), check: k })) : [];
  const missingStat = statutory.filter((s) => s.status === "missing" || s.status === "rejected").length;
  const missingBgv = bgv.filter((b) => b.status === "needed").length + (c && !c.closed_status && c.consent?.status !== "given" ? 1 : 0);
  const total = statutory.length;
  const done = statutory.filter((s) => s.status === "verified").length;
  return { statutory, bgv, bgvCase: c, missing: missingStat + missingBgv, missingStat, missingBgv, total, done };
}
