// v10.5 · Bulk actions — apply a validated data-loader batch in one step and keep a load history.
import { nowIso, nextSeq } from "../lib/utils.js";
import { workerTypeOf, isContingent, monthlyEquivalent, REGIONS } from "../data/employeeFields.js";
import { defaultEntityFor } from "../data/entities.js";
import { LOADER_BY } from "../lib/bulkLoad.js";

const err = (error) => ({ ok: false, error });

export function makeBulkActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }) {
  const S = () => sessionRef.current;
  const canBulk = () => {
    const s = S();
    if (s?.role === "superadmin") return true;
    if (s?.role !== "admin") return false;
    const a = dataRef.current.admins.find((x) => x.admin_code === s.code);
    return (a?.modules || []).includes("accounts") || (a?.permissions_scope || []).includes("people");
  };

  /** rows: the "valid" rows from validateRows (with .changes, .merged, .isNew). */
  function bulkApply({ loaderId, mode, fileName, rows, totals }) {
    if (!canBulk()) return err("Only HR admins with the accounts module, or the Super Admin, can run bulk loads.");
    const loader = LOADER_BY[loaderId];
    if (!loader) return err("Unknown loader.");
    if (!rows?.length) return err("There are no valid rows to load.");
    return mutate((x) => {
      const at = nowIso();
      let created = 0, updated = 0, skipped = 0;
      const createdCodes = [];
      if (loader.kind === "leave") {
        const year = new Date().getFullYear();
        rows.forEach((r) => {
          const e = x.employees.find((i) => i.employee_code === r.code);
          if (!e) { skipped++; return; }
          e.leave_overrides = { ...(e.leave_overrides || {}), [r.changes.leave_type]: { year, entitled: r.changes.entitled, remaining: r.changes.remaining, next_entitled: r.changes.next_entitled, next_remaining: r.changes.next_remaining, loaded_at: at, loaded_by: S().code } };
          updated++;
        });
      } else {
        rows.forEach((r) => {
          if (r.isNew) {
            const code = nextSeq(x.employees, "EMP", "employee_code", 3);
            const rec = { ...r.merged, employee_code: code, login_id: String(r.merged.login_id || r.merged.email || "").toLowerCase() };
            rec.worker_type = workerTypeOf(rec);
            if (!rec.location_id || !rec.company_id) Object.assign(rec, defaultEntityFor(rec, x.workLocations?.length ? x.workLocations : undefined));
            const loc = (x.workLocations || []).find((l) => l.location_id === rec.location_id);
            if (loc) { rec.company_id = loc.company_id; rec.country_code = loc.country; if (!(REGIONS[loc.country] || []).some(([g]) => g === rec.region)) rec.region = rec.region || ""; }
            if (isContingent(rec)) rec.monthly_gross = monthlyEquivalent(rec);
            x.employees.push({ ...rec, preferred_language: rec.preferred_language || x.settings.default_language || "English", status: "pending_approval", must_reset: true, failed_attempts: 0, password_hash: "c75f28325cfa028ea13872f977a29e0e87c99a4f390fe260f24d7e1f05fb8d75", last_login: null, hr_synced_at: at, bulk_loaded_at: at });
            createdCodes.push(code);
            created++;
          } else {
            const e = x.employees.find((i) => i.employee_code === r.code);
            if (!e) { skipped++; return; }
            Object.assign(e, r.changes);
            if (r.changes.location_id) { const loc = (x.workLocations || []).find((l) => l.location_id === r.changes.location_id); if (loc) { e.company_id = loc.company_id; e.country_code = loc.country; } }
            e.worker_type = workerTypeOf(e);
            if (isContingent(e)) e.monthly_gross = monthlyEquivalent(e);
            if (Object.keys(r.changes).length) updated++; else skipped++;
          }
        });
      }
      x.bulkLoads = x.bulkLoads || [];
      const id = nextSeq(x.bulkLoads, "BL-", "id", 4);
      x.bulkLoads.unshift({ id, loader: loaderId, label: loader.label, mode, file: fileName || "", by: S().code, by_role: S().role, at, created, updated, skipped, errors: totals?.errors || 0, warnings: totals?.warnings || 0, created_codes: createdCodes });
      if (created) {
        const approvers = x.admins.filter((a) => a.status === "active" && (a.modules || []).includes("accounts")).map((a) => a.admin_code);
        approvers.forEach((c) => c !== S().code && pushNote(x, c, `${created} new employee account(s) from bulk load ${id} are waiting for approval.`, "/approvals"));
      }
      pushAudit(x, S().code, S().role, "BULK_LOAD", `${id} · ${loader.label} · ${mode === "onetime" ? "one-time" : "frequent"} load · ${created} created · ${updated} updated · ${skipped} unchanged${fileName ? ` · ${fileName}` : ""}`);
      return { ok: true, id, created, updated, skipped };
    });
  }

  return { bulkApply, canBulkLoad: canBulk };
}
