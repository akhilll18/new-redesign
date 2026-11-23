// Payslip design actions (v8.7): admins with the payslips or payroll module and Super Admins create, edit, publish and assign
// payslip designs (unless a Super Admin has locked design changes to Super Admins). Every save keeps a version to restore.
import { nowIso, nextSeq } from "../lib/utils.js";
import { defaultDesign } from "../data/payslipDesign.js";

const err = (error) => ({ ok: false, error });
const MAX_VERSIONS = 12;

export function makePayslipDesignActions({ mutate, dataRef, sessionRef, pushAudit }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;
  const isSuper = () => S()?.role === "superadmin";
  const adminRec = () => (S()?.role === "admin" ? D().admins.find((a) => a.admin_code === S().code) : null);
  const canDesign = () => isSuper() || (!D().payslipDesignRules?.locked_to_super && !!adminRec()?.modules.some((m) => ["payslips", "payroll"].includes(m)));
  const guard = () => (canDesign() ? null : err(D().payslipDesignRules?.locked_to_super ? "A Super Admin has locked payslip designs. Ask them to make the change." : "Only HR (payslips), Finance (payroll) or a Super Admin can change payslip designs."));
  const audit = (x, a, d) => pushAudit(x, S().code, S().role, a, d);
  const strip = (d) => { const o = JSON.parse(JSON.stringify(d)); delete o.versions; delete o.history; return o; };

  function saveDesign(input, { publish = false, label = "" } = {}) {
    const g = guard();
    if (g) return g;
    if (!String(input.name || "").trim()) return err("Give the design a name.");
    if (input.kind === "custom_html" && !String(input.html || "").trim()) return err("Upload or paste your payslip format (HTML), or switch to a built-in layout.");
    if (input.kind === "custom_html" && !/\{\{\s*[\w.]+\s*\}\}/.test(input.html)) return err("Your format has no {{placeholders}} yet, so every payslip would look the same. Use “Auto-map fields” or insert placeholders.");
    return mutate((x) => {
      x.payslipDesigns = x.payslipDesigns || [];
      let rec = x.payslipDesigns.find((d) => d.id === input.id);
      const now = nowIso();
      if (!rec) {
        rec = { ...defaultDesign(), ...input, id: nextSeq(x.payslipDesigns, "PSD-", "id", 3), status: publish ? "active" : "draft", history: [], versions: [] };
        x.payslipDesigns.push(rec);
        rec.history.push({ at: now, by: S().code, action: `Created${input.source?.name ? ` from ${input.source.name}` : ""}` });
      } else {
        rec.versions = [{ at: rec.updated_at, by: rec.updated_by, label: rec.history?.slice(-1)[0]?.action || "", snapshot: strip(rec) }, ...(rec.versions || [])].slice(0, MAX_VERSIONS);
        Object.assign(rec, { ...input, versions: rec.versions, history: rec.history || [] });
        if (publish) rec.status = "active";
        rec.history.push({ at: now, by: S().code, action: label || (publish ? "Published" : "Saved") });
      }
      rec.updated_at = now;
      rec.updated_by = S().code;
      audit(x, "PAYSLIP_DESIGN_SAVE", `${rec.id} · ${rec.name}${publish ? " · published" : ""}`);
      return { ok: true, id: rec.id };
    });
  }
  function duplicateDesign(id) {
    const g = guard();
    if (g) return g;
    const src = (D().payslipDesigns || []).find((d) => d.id === id);
    if (!src) return err("Design not found.");
    const copy = strip(src);
    delete copy.id;
    return saveDesign({ ...copy, name: `${src.name} (copy)`, status: "draft" });
  }
  function setDesignStatus(id, status) {
    const g = guard();
    if (g) return g;
    const r = D().payslipDesignRules || {};
    if (status !== "active" && (r.default_id === id || Object.values(r.by_worker || {}).includes(id) || Object.values(r.by_country || {}).includes(id) || r.advice_id === id)) return err("This design is assigned. Assign another design first.");
    return mutate((x) => {
      const d = x.payslipDesigns.find((y) => y.id === id);
      d.status = status;
      d.history.push({ at: nowIso(), by: S().code, action: status === "active" ? "Published" : "Moved to drafts" });
      audit(x, "PAYSLIP_DESIGN_STATUS", `${id} · ${status}`);
      return { ok: true };
    });
  }
  function deleteDesign(id) {
    const g = guard();
    if (g) return g;
    const r = D().payslipDesignRules || {};
    if (r.default_id === id || Object.values(r.by_worker || {}).includes(id) || Object.values(r.by_country || {}).includes(id) || r.advice_id === id) return err("This design is in use. Assign another design first.");
    if ((D().payslipDesigns || []).length <= 1) return err("Keep at least one design.");
    return mutate((x) => {
      x.payslipDesigns = x.payslipDesigns.filter((d) => d.id !== id);
      audit(x, "PAYSLIP_DESIGN_DELETE", id);
      return { ok: true };
    });
  }
  function restoreDesignVersion(id, index) {
    const d = (D().payslipDesigns || []).find((y) => y.id === id);
    const v = d?.versions?.[index];
    if (!v) return err("Version not found.");
    return saveDesign({ ...v.snapshot, id, status: d.status }, { label: `Restored version from ${new Date(v.at).toLocaleString("en-GB")}` });
  }
  function updateDesignRules(patch) {
    if ("locked_to_super" in patch && !isSuper()) return err("Only a Super Admin can lock or unlock payslip designs.");
    const g = guard();
    if (g) return g;
    const ids = new Set((D().payslipDesigns || []).filter((d) => d.status === "active").map((d) => d.id));
    const check = [patch.default_id, patch.advice_id, ...Object.values(patch.by_worker || {}), ...Object.values(patch.by_country || {})].filter(Boolean);
    if (check.some((i) => !ids.has(i))) return err("Only published designs can be assigned.");
    return mutate((x) => {
      x.payslipDesignRules = { ...(x.payslipDesignRules || {}), ...patch };
      audit(x, "PAYSLIP_DESIGN_RULES", Object.keys(patch).join(", "));
      return { ok: true };
    });
  }
  return { saveDesign, duplicateDesign, setDesignStatus, deleteDesign, restoreDesignVersion, updateDesignRules, canDesignPayslips: canDesign };
}
