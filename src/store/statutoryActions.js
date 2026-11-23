// v10.3: payroll registration modes, statutory registration numbers and the frozen-defaults switch.
// Super Admin and Finance (payroll module) change them; HR with the accounts module can view. Every change is audited.
import { PAYROLL_MODES, regFieldsFor } from "../lib/statutory.js";

const err = (error) => ({ ok: false, error });

export function makeStatutoryActions({ mutate, dataRef, sessionRef, pushAudit }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;
  const isSuper = () => S()?.role === "superadmin";
  const adminRec = () => (S()?.role === "admin" ? D().admins.find((a) => a.admin_code === S().code) : null);
  const canEdit = () => isSuper() || !!adminRec()?.modules?.includes("payroll");
  const audit = (x, a, d) => pushAudit(x, S().code, S().role, a, d);

  function setPayrollMode(companyId, mode) {
    if (!canEdit()) return err("Only Finance (payroll) or a Super Admin can change how a company runs payroll.");
    if (!PAYROLL_MODES.some((m) => m.id === mode)) return err("Choose a payroll mode.");
    return mutate((x) => {
      const c = (x.companies || []).find((y) => y.company_id === companyId);
      if (!c) return err("Company not found.");
      const was = c.payroll_mode || "central";
      c.payroll_mode = mode;
      audit(x, "PAYROLL_MODE_CHANGE", `${companyId} · ${was} → ${mode}`);
      return { ok: true };
    });
  }

  /** level: "company" | "location". values: { key: value } for that country's registration fields. */
  function saveRegistration(level, id, values) {
    if (!canEdit()) return err("Only Finance (payroll) or a Super Admin can change registration numbers.");
    return mutate((x) => {
      const rec = level === "company" ? (x.companies || []).find((c) => c.company_id === id) : (x.workLocations || []).find((l) => l.location_id === id);
      if (!rec) return err("Not found.");
      const allowed = new Set(regFieldsFor(rec.country).map(([k]) => k));
      const clean = Object.fromEntries(Object.entries(values || {}).filter(([k]) => allowed.has(k)).map(([k, v]) => [k, String(v || "").trim().slice(0, 60)]));
      rec.statutory = { ...(rec.statutory || {}), ...clean };
      audit(x, "STATUTORY_REG_UPDATE", `${level} ${id} · ${Object.keys(clean).join(", ") || "no fields"}`);
      return { ok: true };
    });
  }

  function setStatutorySettings(patch) {
    if (!isSuper()) return err("Only a Super Admin can change these defaults.");
    const keys = ["lock_country_to_location", "default_language", "restricted_worker_types", "long_term_days"];
    return mutate((x) => {
      const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => keys.includes(k)));
      if ("long_term_days" in clean) clean.long_term_days = Math.max(30, Math.min(3650, Number(clean.long_term_days) || 365));
      Object.assign(x.settings, clean);
      // Turning the lock on aligns everyone's country to their location straight away.
      if (clean.lock_country_to_location) {
        const by = Object.fromEntries((x.workLocations || []).map((l) => [l.location_id, l]));
        x.employees.forEach((e) => { const l = by[e.location_id]; if (l && e.country_code !== l.country) { e.country_code = l.country; e.region = ""; } });
      }
      audit(x, "CONFIG_CHANGE", `Statutory defaults · ${Object.entries(clean).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("/") : v}`).join(", ")}`);
      return { ok: true };
    });
  }

  /** Local language of a location: listed first in the language dropdown for that location (English stays the default). */
  function setLocationLanguage(locationId, language) {
    if (!canEdit() && !adminRec()?.modules?.includes("accounts")) return err("Only HR, Finance (payroll) or a Super Admin can change this.");
    return mutate((x) => {
      const l = (x.workLocations || []).find((y) => y.location_id === locationId);
      if (!l) return err("Location not found.");
      l.local_language = language && language !== "English" ? String(language).slice(0, 40) : "";
      audit(x, "CONFIG_CHANGE", `Local language · ${locationId} → ${l.local_language || "none"}`);
      return { ok: true };
    });
  }

  return { setPayrollMode, saveRegistration, setStatutorySettings, setLocationLanguage, canEditStatutory: canEdit };
}
