// v10.2: companies & locations (Super Admin) and the expense hub (Finance with the expense module, or Super Admin).
import { nowIso } from "../lib/utils.js";
import { EXPENSE_APPS, APP_BY, SOURCE_LABEL, applyImport, demoFeed, toInr, mapCategory } from "../lib/expenseHub.js";
import { isoDate } from "../lib/utils.js";

const err = (error) => ({ ok: false, error });
const ID = /^[A-Z0-9][A-Z0-9-]{1,23}$/;

export function makeEntityActions({ mutate, dataRef, sessionRef, pushAudit, pushNote, adminFor }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;
  const isSuper = () => S()?.role === "superadmin";
  const adminRec = () => (S()?.role === "admin" ? D().admins.find((a) => a.admin_code === S().code) : null);
  const canExpense = () => isSuper() || !!adminRec()?.modules?.some((m) => ["expense", "advance", "payroll"].includes(m));
  const audit = (x, a, d) => pushAudit(x, S().code, S().role, a, d);
  const hooks = (x) => ({ actor: S().code, adminFor: (d, emp, type) => adminFor(d, emp.department, type === "advance" ? "advance" : "expense"), note: (to, text, link) => pushNote(x, to, text, link) });

  // ── Companies & locations ──
  function upsertCompany(rec) {
    if (!isSuper()) return err("Only a Super Admin can change companies.");
    const id = String(rec.company_id || "").trim().toUpperCase();
    if (!ID.test(id)) return err("Company code: 2–24 capital letters, digits or dashes.");
    if (String(rec.name || "").trim().length < 3) return err("Enter the registered company name.");
    if (!rec.country) return err("Choose the country of incorporation.");
    return mutate((x) => {
      x.companies ||= [];
      const ex = x.companies.find((c) => c.company_id === id);
      if (rec.isNew && ex) return err("That company code is already used.");
      const clean = { company_id: id, name: rec.name.trim(), short: (rec.short || rec.name).trim(), country: rec.country, currency: rec.currency || "INR", registration: rec.registration || "", tax_id: rec.tax_id || "", address: rec.address || "", status: rec.status || "active" };
      if (ex) Object.assign(ex, clean); else x.companies.push(clean);
      audit(x, ex ? "COMPANY_UPDATE" : "COMPANY_CREATE", `${id} · ${clean.name}`);
      return { ok: true, id };
    });
  }
  function upsertLocation(rec) {
    if (!isSuper()) return err("Only a Super Admin can change locations.");
    const id = String(rec.location_id || "").trim().toUpperCase();
    if (!ID.test(id)) return err("Location code: 2–24 capital letters, digits or dashes.");
    if (String(rec.name || "").trim().length < 2) return err("Enter the location name.");
    if (!D().companies?.some((c) => c.company_id === rec.company_id)) return err("Choose the company this location belongs to.");
    return mutate((x) => {
      x.workLocations ||= [];
      const ex = x.workLocations.find((l) => l.location_id === id);
      if (rec.isNew && ex) return err("That location code is already used.");
      const clean = { location_id: id, name: rec.name.trim(), company_id: rec.company_id, country: rec.country || x.companies.find((c) => c.company_id === rec.company_id)?.country, city: (rec.city || "").trim(), type: rec.type || "office", geofence_id: rec.geofence_id || "", cost_centre: (rec.cost_centre || "").trim(), status: rec.status || "active" };
      const moved = ex && ex.company_id !== clean.company_id;
      if (ex) Object.assign(ex, clean); else x.workLocations.push(clean);
      // Staff at a location that moves to another company move with it.
      if (moved) x.employees.forEach((e) => { if (e.location_id === id) e.company_id = clean.company_id; });
      audit(x, ex ? "LOCATION_UPDATE" : "LOCATION_CREATE", `${id} · ${clean.name} · ${clean.company_id}`);
      return { ok: true, id };
    });
  }
  function assignEmployeesToLocation(codes, locationId) {
    if (!isSuper() && !adminRec()?.modules?.includes("accounts")) return err("Only HR (accounts) or a Super Admin can move employees.");
    const loc = D().workLocations?.find((l) => l.location_id === locationId);
    if (!loc) return err("Choose a location.");
    if (!codes.length) return err("Select at least one employee.");
    return mutate((x) => {
      x.employees.forEach((e) => { if (codes.includes(e.employee_code)) { if (x.settings.lock_country_to_location !== false && e.country_code !== loc.country) Object.assign(e, { country_code: loc.country, region: "" }); Object.assign(e, { location_id: loc.location_id, company_id: loc.company_id }); } });
      audit(x, "EMPLOYEE_RELOCATE", `${codes.join(", ")} → ${loc.location_id} (${loc.company_id})`);
      return { ok: true, n: codes.length };
    });
  }
  function setAdminEntityAccess(adminCode, companies, locations) {
    if (!isSuper()) return err("Only a Super Admin can change admin access.");
    return mutate((x) => {
      const a = x.admins.find((i) => i.admin_code === adminCode);
      if (!a) return err("Admin not found.");
      a.entity_companies = companies;
      a.entity_locations = locations;
      audit(x, "ADMIN_ENTITY_SCOPE", `${adminCode} · companies ${companies.join(", ") || "all"} · locations ${locations.join(", ") || "all"}`);
      return { ok: true };
    });
  }

  // ── Expense hub ──
  function connectExpenseApp(app, opts = {}) {
    if (!canExpense()) return err("Only Finance or a Super Admin can connect expense apps.");
    if (!APP_BY[app]) return err("Unknown app.");
    return mutate((x) => {
      x.expenseHub ||= { connections: {}, runs: [], exceptions: [], categoryMaps: {} };
      x.expenseHub.connections[app] = { ...(x.expenseHub.connections[app] || {}), connected: true, landing: opts.landing || "trust", auto_sync: opts.auto_sync ?? true, connected_at: nowIso(), account: opts.account || "" };
      audit(x, "EXPENSE_APP_CONNECT", `${APP_BY[app].name} · ${opts.landing || "trust"}`);
      return { ok: true };
    });
  }
  function updateExpenseApp(app, patch) {
    if (!canExpense()) return err("Only Finance or a Super Admin can change expense apps.");
    return mutate((x) => {
      const c = x.expenseHub?.connections?.[app];
      if (!c) return err("Connect the app first.");
      Object.assign(c, patch);
      audit(x, "EXPENSE_APP_UPDATE", `${SOURCE_LABEL(app)} · ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")}`);
      return { ok: true };
    });
  }
  function disconnectExpenseApp(app) {
    if (!canExpense()) return err("Only Finance or a Super Admin can disconnect expense apps.");
    return mutate((x) => {
      const c = x.expenseHub?.connections?.[app];
      if (c) { c.connected = false; c.disconnected_at = nowIso(); }
      audit(x, "EXPENSE_APP_DISCONNECT", SOURCE_LABEL(app));
      return { ok: true };
    });
  }
  function syncExpenseApp(app) {
    if (!canExpense()) return err("Only Finance or a Super Admin can sync expense apps.");
    const c = D().expenseHub?.connections?.[app];
    if (!c?.connected) return err("Connect the app first.");
    return mutate((x) => {
      const recs = demoFeed(app, (c.syncs || 0) + 1, x.employees, isoDate());
      const stats = applyImport(x, app, recs, hooks(x));
      audit(x, "EXPENSE_SYNC", `${SOURCE_LABEL(app)} · ${stats.created} new · ${stats.updated} updated · ${stats.exceptions} exceptions`);
      return { ok: true, stats };
    });
  }
  function syncAllExpenseApps() {
    const apps = EXPENSE_APPS.filter((a) => D().expenseHub?.connections?.[a.id]?.connected).map((a) => a.id);
    const total = { created: 0, updated: 0, exceptions: 0, apps: apps.length };
    apps.forEach((a) => { const r = syncExpenseApp(a); if (r.ok) { total.created += r.stats.created; total.updated += r.stats.updated; total.exceptions += r.stats.exceptions; } });
    return { ok: true, stats: total };
  }
  function importExpenseRecords(records, source = "csv") {
    if (!canExpense()) return err("Only Finance or a Super Admin can import expenses.");
    if (!records.length) return err("There is nothing to import.");
    return mutate((x) => {
      const stats = applyImport(x, source, records.map((r) => ({ ...r, employee_code_resolved: r.match || undefined })), hooks(x));
      audit(x, "EXPENSE_IMPORT", `${SOURCE_LABEL(source)} · ${stats.created} new · ${stats.updated} updated · ${stats.exceptions} exceptions`);
      return { ok: true, stats };
    });
  }
  function resolveExpenseException(id, { action, employee_code, location_id, payee }) {
    if (!canExpense()) return err("Only Finance or a Super Admin can resolve exceptions.");
    const ex = D().expenseHub?.exceptions?.find((e) => e.id === id);
    if (!ex || ex.resolved) return err("This exception is already resolved.");
    if (action === "map" && !D().employees.some((e) => e.employee_code === employee_code)) return err("Choose the employee this belongs to.");
    if (action === "third_party" && !D().workLocations?.some((l) => l.location_id === location_id)) return err("Choose the location to book this against.");
    return mutate((x) => {
      const e = x.expenseHub.exceptions.find((i) => i.id === id);
      let made = null;
      if (action === "map") made = applyImport(x, e.app, [{ ...e.record, employee_code_resolved: employee_code }], { ...hooks(x), silent: true }).created_ids[0];
      if (action === "third_party") {
        const loc = x.workLocations.find((l) => l.location_id === location_id);
        made = applyImport(x, e.app, [{ ...e.record, kind: "third_party", payee: payee || e.record.vendor || e.record.employee_name, location_id, company_id: loc.company_id }], { ...hooks(x), silent: true }).created_ids[0];
      }
      e.resolved = { action, by: S().code, at: nowIso(), ref: made };
      audit(x, "EXPENSE_EXCEPTION_RESOLVE", `${id} · ${action}${made ? ` → ${made}` : ""}`);
      return { ok: true, ref: made };
    });
  }
  function saveThirdPartyExpense(rec) {
    if (!canExpense()) return err("Only Finance or a Super Admin can book third-party expenses.");
    const loc = D().workLocations?.find((l) => l.location_id === rec.location_id);
    if (!String(rec.payee || "").trim()) return err("Enter the third party (vendor, agency or person).");
    if (!String(rec.title || "").trim()) return err("Describe the expense.");
    if (!loc) return err("Choose the location to book it against.");
    if (!(Number(rec.amount) > 0)) return err("Enter an amount above 0.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.date || "")) return err("Enter the expense date.");
    return mutate((x) => {
      x.thirdPartyExpenses ||= [];
      const id = rec.id || `TPE-${String(x.thirdPartyExpenses.reduce((m, t) => Math.max(m, Number(t.id.slice(4)) || 0), 0) + 1).padStart(4, "0")}`;
      const clean = { id, payee: rec.payee.trim(), title: rec.title.trim(), date: rec.date, category: rec.category || mapCategory(rec.title), currency: rec.currency || "INR", amount: Number(rec.amount), amount_inr: toInr(rec.amount, rec.currency, x.fx), company_id: loc.company_id, location_id: loc.location_id, status: rec.status || "Pending", reference: rec.reference || "", source: rec.source || { app: "manual", external_id: rec.reference || "" }, lines: rec.lines || [] };
      const ex = x.thirdPartyExpenses.find((t) => t.id === id);
      if (ex) Object.assign(ex, clean); else x.thirdPartyExpenses.unshift(clean);
      audit(x, ex ? "THIRD_PARTY_EXPENSE_UPDATE" : "THIRD_PARTY_EXPENSE_CREATE", `${id} · ${clean.payee} · ₹${clean.amount_inr} · ${loc.location_id}`);
      return { ok: true, id };
    });
  }
  function setThirdPartyStatus(id, status) {
    if (!canExpense()) return err("Only Finance or a Super Admin can change third-party expenses.");
    return mutate((x) => {
      const t = x.thirdPartyExpenses?.find((i) => i.id === id);
      if (!t) return err("Not found.");
      t.status = status;
      audit(x, "THIRD_PARTY_EXPENSE_STATUS", `${id} → ${status}`);
      return { ok: true };
    });
  }
  function setExpenseCategoryMap(app, ext, code) {
    if (!canExpense()) return err("Only Finance or a Super Admin can map categories.");
    return mutate((x) => {
      x.expenseHub.categoryMaps ||= {};
      x.expenseHub.categoryMaps[app] = { ...(x.expenseHub.categoryMaps[app] || {}), [ext]: code };
      audit(x, "EXPENSE_CATEGORY_MAP", `${SOURCE_LABEL(app)} · ${ext} → ${code}`);
      return { ok: true };
    });
  }

  return { upsertCompany, upsertLocation, assignEmployeesToLocation, setAdminEntityAccess, connectExpenseApp, updateExpenseApp, disconnectExpenseApp, syncExpenseApp, syncAllExpenseApps, importExpenseRecords, resolveExpenseException, saveThirdPartyExpense, setThirdPartyStatus, setExpenseCategoryMap, canExpenseHub: canExpense };
}
