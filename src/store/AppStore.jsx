// Central client store: masters, points, leave/expense/advance/loan requests, approvals,
// notifications, audit and the auth session. Each action mirrors one REST endpoint (README).
import { OPTION_LISTS, canEditList, checkNewOption, listDef } from "../lib/optionLists.js";
import { checkCustomField, customFieldsActive } from "../lib/customFields.js";
import { FORM_TYPES, validateForm, formPayload } from "../lib/forms.js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { APP_CONFIG, HR_FEED, buildSeed, withoutLogins } from "../data/seed.js";
import { validateSubmission, OPEN_STATUSES } from "../lib/validation.js";
import { validateLeave, validateExpense, validateAdvance, validateLoan, validateRegularize, validateAssetRequest, validateScreenOff, validateAssetPurchase, chainSteps, defaultChain, currentAdminStep, stepModule, stepLabel, fmtMins, expenseTotal, REQUEST_TYPES, leaveBalances } from "../lib/requests.js";
import { slaDue } from "../lib/itdesk.js";
import { hoursInRange } from "../lib/hrcalc.js";
import { makeOpsActions } from "./opsActions.js";
import { makePayslipActions } from "./payslipActions.js";
import { makeOfferActions } from "./offerActions.js";
import { makeCollabActions } from "./collabActions.js";
import { makeItActions } from "./itActions.js";
import { makeDocActions } from "./docActions.js";
import { makeFileActions } from "./fileActions.js";
import { makeBulkActions } from "./bulkActions.js";
import { makePayrollSuiteActions } from "./payrollSuiteActions.js";
import { makeSuiteActions } from "./suiteActions.js";
import { makeContractActions } from "./contractActions.js";
import { makePayslipDesignActions } from "./payslipDesignActions.js";
import { makeEntityActions } from "./entityActions.js";
import { makeStatutoryActions } from "./statutoryActions.js";
import { makeAutomationActions } from "./automationActions.js";
import { enrichBgvCase } from "../data/seedBgvTracking.js";
import { ALL, allowedEntities, scopeData, scopeLocationIds, defaultEntityFor } from "../data/entities.js";
import { CONTRACT_COMPONENT_CODES, LOCAL_COMPONENT_CODES } from "../data/payslipFields.js";
import { setStatutoryDirectory, canSwitchEntity } from "../lib/statutory.js";
import { isoDate, setExportContext } from "../lib/utils.js";
import { validateEmployee, isContingent, monthlyEquivalent, workerTypeOf, REGIONS } from "../data/employeeFields.js";
import { leaveTypesFor, holidaysFor, withCountryData } from "../country/countryPacks.js";
import { serverOn, api as serverApi, apiPost as serverPost, setToken as setServerToken, getToken as getServerToken, getTenant, setUnauthorizedHandler, isDemoTenant } from "../lib/server/api.js";
import { createSyncEngine } from "../lib/server/sync.js";
import { deviceFingerprint, deviceLabel, demoIp, makeOtp, nowIso, sha256, nextSeq, maskAccount, fmtNum } from "../lib/utils.js";

const Ctx = createContext(null);
const SESSION_KEY = `${APP_CONFIG.storageKey}-session`;
const REMEMBER_KEY = `${APP_CONFIG.storageKey}-remember`;
const clone = (o) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

function loadData() {
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Fill any collections added since this browser saved its copy.
      // v10.10: sample data is cleaned up — a browser still holding the old sample company starts fresh (once)
      if (parsed?.version === 3 && !parsed.v110) return policyConsents(clone(buildSeed()));
      if (parsed?.version === 3) {
        const fresh = clone(buildSeed());
        return policyConsents(migrateV109(migrateV108(migrateV107(migrateV106(migrateV103(migrateBgvTrack(migrateV101(migrateV88b(migrateV88(migrateV87(migrateV8(withCountryData({ ...fresh, ...parsed, settings: { ...fresh.settings, ...parsed.settings } }, fresh)), fresh))), parsed), fresh), fresh), fresh), fresh))));
      }
    }
  } catch {
    /* storage unavailable */
  }
  // a brand-new copy already has no demo logins: mark it so the v10.9 clean-up never runs on it (it would remove
  // logins the Super Admin creates afterwards)
  return policyConsents({ ...clone(buildSeed()), v109: true });
}
// v10.8 · Server mode: data comes from PostgreSQL. It is used as the server sends it (no demo upgrades, so no demo
// people are ever added to a real company); collections the server has no rows for start empty.
const SERVER_FLAGS = { v8: true, v87: true, v88: true, v88b: true, v101: true, v103: true, v106: true, v107: true, v108: true, v109: true, v110: true, bgvTrack: true };
function prepareServer(boot) {
  const fresh = buildSeed();
  const d = { ...boot };
  for (const [k, v] of Object.entries(fresh)) if (!(k in d)) d[k] = Array.isArray(v) ? [] : v && typeof v === "object" ? clone(v) : v;
  d.settings = { ...fresh.settings, ...(boot.settings || {}) };
  return policyConsents({ ...d, ...SERVER_FLAGS, version: 3 });
}
const serverCacheKey = () => `${APP_CONFIG.storageKey}-server-${getTenant()}`;
function loadServerCache() {
  try {
    const raw = getServerToken() && localStorage.getItem(serverCacheKey());
    if (raw) return prepareServer(JSON.parse(raw));
  } catch { /* ignore */ }
  return prepareServer({ employees: [], admins: [], superAdmins: [], requests: [], punches: [], notifications: [], audit: [] });
}
function saveServerCache(data) {
  try { localStorage.setItem(serverCacheKey(), JSON.stringify(data, (k, v) => (k === "data_url" && typeof v === "string" && v.length > 50000 ? null : v))); } catch { /* quota: the app reloads from the server */ }
}
// v10.6: with employee consent off (company policy), and for contract / freelance workers by default, location and
// "record my activity" are both on. People who already chose keep their choice when consent is required.
function policyConsents(d) {
  const policy = d.settings?.monitoring_consent_required === false;
  const consents = { ...(d.consents || {}) };
  (d.employees || []).forEach((e) => {
    if (e.status !== "active") return;
    const contingent = ["contract", "freelance"].includes(e.worker_type);
    if (policy || (contingent && !consents[e.employee_code])) consents[e.employee_code] = { location: true, activity: true, at: consents[e.employee_code]?.at || new Date().toISOString(), version: policy ? "policy-2026.11" : "default-on" };
  });
  return { ...d, consents };
}
// v8: browsers holding older data get the new admin modules once (new collections are filled by the merge above).
function migrateV8(d) {
  if (!d.v8it) {
    const ch = { id: "CH-it", kind: "channel", name: "it-help", topic: "IT service desk: quick questions. For anything that blocks you, raise a ticket under IT support.", members: "all", created_by: "ADM02", created_at: new Date().toISOString() };
    d = { ...d, v8it: true, chatChannels: (d.chatChannels || []).some((c) => c.id === "CH-it") ? d.chatChannels : [...(d.chatChannels || []), ch], admins: d.admins };
  }
  if (d.v8) return d;
  const add = { ADM01: ["bgv", "compliance"], ADM02: ["compliance"] };
  return { ...d, v8: true, admins: d.admins.map((a) => (add[a.admin_code] ? { ...a, modules: [...new Set([...(a.modules || []), ...add[a.admin_code]])] } : a)) };
}
// v8.8: Sahayog points removed; Finance admin (ADM02) no longer works the IT service desk or sees BGV.
function migrateV88(d) {
  if (d.v88) return d;
  const wf = { ...(d.settings?.workflow || {}) };
  delete wf.points;
  return {
    ...d,
    v88: true,
    settings: { ...d.settings, workflow: wf },
    admins: d.admins.map((a) => ({ ...a, modules: (a.modules || []).filter((m) => m !== "points" && !(a.admin_code === "ADM02" && (m === "it" || m === "bgv"))) })),
    itTickets: (d.itTickets || []).map((t) => (t.assigned_to === "ADM02" ? { ...t, assigned_to: "SA001" } : t)),
    bgvAccess: (d.bgvAccess || []).map((g) => (g.code === "ADM02" && !g.revoked ? { ...g, revoked: true, revoked_at: new Date().toISOString(), revoked_by: "SYSTEM" } : g)),
  };
}
// v10.2b: BGV tracking content — fill checks nobody has worked on with their stage, tracking log, details and
// document checklist, and add the demo candidate cases that show the started / on-hold / HR-review statuses.
function migrateBgvTrack(d, fresh) {
  if (d.bgvTrack || !Array.isArray(d.bgv)) return { ...d, bgvTrack: true };
  const empBy = Object.fromEntries((d.employees || []).map((e) => [e.employee_code, e]));
  const bgv = d.bgv.map((c) => enrichBgvCase(clone(c), empBy[c.employee_code] || null));
  const candIds = new Set((d.candidates || []).map((c) => c.id));
  const ids = new Set(bgv.map((c) => c.id));
  let n = bgv.reduce((m, c) => Math.max(m, Number(String(c.id).replace(/\D/g, "")) || 0), 0);
  for (const c of fresh.bgv || []) {
    if (!c.candidate_id || !candIds.has(c.candidate_id) || bgv.some((x) => x.candidate_id === c.candidate_id)) continue;
    const id = ids.has(c.id) ? `BGV-${String(++n).padStart(4, "0")}` : c.id;
    ids.add(id);
    bgv.push({ ...clone(c), id });
  }
  return { ...d, bgv, bgvTrack: true };
}
// v10.3: statutory registrations & payroll modes on companies / locations, local-payslip components, AI automation,
// and country frozen to the work location for browsers holding older data.
function migrateV103(d, fresh) {
  if (d.v103) return d;
  const fc = Object.fromEntries((fresh.companies || []).map((c) => [c.company_id, c]));
  const fl = Object.fromEntries((fresh.workLocations || []).map((l) => [l.location_id, l]));
  const locs = (d.workLocations || []).map((l) => (l.statutory ? l : { ...l, statutory: { ...(fl[l.location_id]?.statutory || {}) } }));
  const locBy = Object.fromEntries(locs.map((l) => [l.location_id, l]));
  const comps = fresh.payslipComponents.filter((k) => LOCAL_COMPONENT_CODES.includes(k.code) && !(d.payslipComponents || []).some((x) => x.code === k.code));
  return {
    ...d,
    v103: true,
    companies: (d.companies || []).map((c) => (c.payroll_mode ? c : { ...c, payroll_mode: fc[c.company_id]?.payroll_mode || "central", statutory: { ...(fc[c.company_id]?.statutory || {}) }, default_language: "English" })),
    workLocations: locs,
    employees: d.employees.map((e) => (locBy[e.location_id] && locBy[e.location_id].country !== e.country_code ? { ...e, country_code: locBy[e.location_id].country } : e)),
    payslipComponents: [...(d.payslipComponents || []), ...comps],
    automation: d.automation || fresh.automation,
  };
}
// v10.6: IT admin (ADM04 / EMP013, IT department), assets and asset approvals move from Finance to IT.
// v10.7: every admin and the Super Admin has an employee record (My employee space ↔ Back to admin workspace).
export const NO_LOGIN_MSG = "You don't have a login yet. Ask your Super Admin to create one for you.";
export const hasLogin = (u) => !!u?.password_hash || u?.has_login === true;

// v10.9: only the Super Admin signs in out of the box — everyone else's credentials are removed once (records and
// content stay). Also: Ravi Teja (IT admin) moves from EMP016 to EMP025, because EMP016 is Tanvi Deshpande in the HR feed.
function migrateV109(d) {
  if (d.v109) return d;
  const ravi = (d.employees || []).find((e) => e.employee_code === "EMP016" && e.department === "IT" && /ravi/i.test(e.full_name));
  const moved = {
    ...d,
    employees: ravi ? d.employees.map((e) => (e === ravi ? { ...e, employee_code: "EMP025" } : e)) : d.employees,
    admins: (d.admins || []).map((a) => (a.admin_code === "ADM04" && a.employee_code === "EMP016" ? { ...a, employee_code: "EMP025" } : a)),
  };
  return { ...withoutLogins(moved), v109: true };
}
// v10.8: the IT admin's employee record (Ravi Teja) clashed with Divya Menon on EMP013 — he moves to EMP016.
function migrateV108(d) {
  if (d.v108) return d;
  const ravi = (d.employees || []).find((e) => e.employee_code === "EMP013" && e.department === "IT" && /ravi/i.test(e.full_name));
  return {
    ...d,
    v108: true,
    employees: ravi ? d.employees.map((e) => (e === ravi ? { ...e, employee_code: "EMP025" } : e)) : d.employees,
    admins: (d.admins || []).map((a) => (a.admin_code === "ADM04" && a.employee_code === "EMP013" ? { ...a, employee_code: "EMP025" } : a)),
  };
}
function migrateV107(d, fresh) {
  if (d.v107) return d;
  const sa = (d.superAdmins || []).map((x) => (x.superadmin_code === "SA001" && !x.employee_code ? { ...x, employee_code: "EMP005" } : x));
  return { ...d, v107: true, superAdmins: sa, settings: { ...fresh.settings, ...d.settings } };
}
function migrateV106(d, fresh) {
  if (d.v106) return d;
  const has = (list, key, v) => (list || []).some((x) => x[key] === v);
  const freshEmp = fresh.employees.find((e) => e.employee_code === "EMP025");
  const freshAdm = fresh.admins.find((a) => a.admin_code === "ADM04");
  return {
    ...d,
    v106: true,
    orgUnits: has(d.orgUnits, "org_unit_id", "IT") ? d.orgUnits : [...d.orgUnits, { org_unit_id: "IT", name: "IT", parent_unit: "Head Office" }],
    employees: d.employees.some((e) => e.department === "IT" && /ravi teja/i.test(e.full_name)) || !freshEmp ? d.employees : [...d.employees, freshEmp],
    admins: [...d.admins.map((a) => (a.admin_code === "ADM02" ? { ...a, modules: (a.modules || []).filter((m) => m !== "assets") } : a)), ...(has(d.admins, "admin_code", "ADM04") || !freshAdm ? [] : [freshAdm])],
    suite: d.suite ? { ...d.suite, integrations: { ...(fresh.suite?.integrations || {}), ...(d.suite.integrations || {}), whatsapp: d.suite.integrations?.whatsapp || fresh.suite?.integrations?.whatsapp } } : d.suite,
    settings: { ...fresh.settings, ...d.settings, leave_fallback: d.settings?.leave_fallback || fresh.settings.leave_fallback, support_tat: d.settings?.support_tat || fresh.settings.support_tat, monitoring_consent_required: false },
  };
}
// v10.2: companies & locations, and the expense hub, for browsers holding older data.
function migrateV101(d, parsed) {
  if (d.v101) return d;
  const locs = Array.isArray(d.workLocations) ? d.workLocations : [];
  const hub = parsed?.expenseHub ? d.expenseHub : { connections: {}, runs: [], exceptions: [], categoryMaps: {} };
  return {
    ...d,
    v101: true,
    expenseHub: hub,
    thirdPartyExpenses: parsed?.thirdPartyExpenses || d.thirdPartyExpenses || [],
    employees: d.employees.map((e) => (e.company_id && e.location_id ? e : { ...e, ...defaultEntityFor(e, locs.length ? locs : undefined) })),
  };
}
// v8.8b: drop leftover Sahayog points notifications (their pages no longer exist).
function migrateV88b(d) {
  if (d.v88b) return d;
  return { ...d, v88b: true, settings: { ...d.settings, workflow: { screenoff: "manager", ...(d.settings?.workflow || {}) } }, notifications: (d.notifications || []).filter((n) => !String(n.link || "").startsWith("/points") && !/\bSUB-\d{4}-\d+|\bpoints\b/i.test(n.text || "")) };
}
// v8.7: worker types, contract management and payslip designs for browsers holding v8.6 data.
function migrateV87(d, fresh) {
  if (d.v87) return d;
  const have = new Set(d.employees.map((e) => e.employee_code));
  const add = fresh.employees.filter((e) => e.worker_type && e.worker_type !== "permanent" && !have.has(e.employee_code));
  const comps = fresh.payslipComponents.filter((k) => CONTRACT_COMPONENT_CODES.includes(k.code) && !(d.payslipComponents || []).some((x) => x.code === k.code));
  return {
    ...d,
    v87: true,
    employees: [...d.employees.map((e) => ({ ...e, worker_type: e.worker_type || (e.employment_type === "contract" ? "contract" : e.employment_type === "intern" ? "intern" : "permanent") })), ...add],
    admins: d.admins.map((a) => (["ADM01", "ADM02"].includes(a.admin_code) ? { ...a, modules: [...new Set([...(a.modules || []), "contracts"])] } : a)),
    payslipComponents: [...(d.payslipComponents || []), ...comps],
  };
}
function persistData(data) {
  try {
    // Large attachments stay in memory only so browser storage does not overflow.
    localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(data, (k, v) => (k === "data_url" && typeof v === "string" && v.length > 350000 ? null : v)));
  } catch {
    /* quota or storage disabled */
  }
}
function loadSession() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  return null;
}
function saveSession(s) {
  for (const store of [sessionStorage, localStorage]) {
    try {
      store.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
  if (!s) return;
  try {
    (s.remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export const ROLE_LABEL = { emp: "Employee", admin: "Admin", superadmin: "Super Admin", system: "System" };
export const ROLE_HOME = { emp: "/home", admin: "/admin", superadmin: "/super" };

function listFor(data, role) {
  return role === "emp" ? data.employees : role === "admin" ? data.admins : data.superAdmins;
}
export function codeOf(role, rec) {
  return role === "emp" ? rec.employee_code : role === "admin" ? rec.admin_code : rec.superadmin_code;
}
function roleOfCode(code) {
  if (code?.startsWith("EMP")) return "emp";
  if (code?.startsWith("ADM")) return "admin";
  if (code?.startsWith("SA")) return "superadmin";
  return "system";
}

// v10.11: an admin scoped to a top-level org unit covers the whole company.
export function coversCompany(d, admin) {
  const roots = (d.orgUnits || []).filter((o) => !o.parent_unit).map((o) => o.org_unit_id);
  return (admin?.org_units || []).some((u) => roots.includes(u) || !(d.orgUnits || []).some((o) => o.org_unit_id === u));
}
/** The approval steps an admin fills, e.g. ["Asset purchase request: IT admin step", …] (v10.11). */
export function chainsFor(d, admin) {
  if (!admin || admin.status !== "active" || !(admin.permissions_scope || []).includes("approve")) return [];
  return Object.keys(REQUEST_TYPES).flatMap((type) => {
    const steps = chainSteps(d.settings?.workflow?.[type] || defaultChain(type), type).filter((st) => st.level === "admin" && admin.modules.includes(st.module));
    return steps.length ? [`${REQUEST_TYPES[type].label} (${steps.map((st) => st.label).join(", ")})`] : [];
  });
}

export function AppStoreProvider({ children }) {
  const srv = serverOn();
  const [data, setData] = useState(() => (srv ? loadServerCache() : loadData()));
  const [bootReady, setBootReady] = useState(!srv);
  const engineRef = useRef(null);
  const dataRef = useRef(data);
  const [session, setSession] = useState(() => {
    const s = loadSession();
    if (!s) return null;
    const idleMs = Date.now() - new Date(s.last_active).getTime();
    return idleMs > dataRef.current.settings.session_timeout_min * 60000 ? null : s;
  });
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [pending, setPending] = useState(null);
  const [toast, setToast] = useState(null);
  const [logoutReason, setLogoutReason] = useState("");

  useEffect(() => {
    if (!srv) persistData(data);
    else if (sessionRef.current) { saveServerCache(data); engineRef.current?.schedule(data); }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  // Payslip rendering and other pure helpers read companies / locations / registrations from here.
  setStatutoryDirectory(data);
  // Keep tabs in step (chat, meetings, approvals) when another tab of this browser saves.
  useEffect(() => {
    const onStorage = (ev) => {
      if (srv || ev.key !== APP_CONFIG.storageKey || !ev.newValue) return;
      try {
        const next = JSON.parse(ev.newValue);
        if (next?.version !== 3) return;
        dataRef.current = next;
        setData(next);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => { saveSession(session); }, [session]);

  const notifyToast = useCallback((text, tone = "success") => setToast({ text, tone, id: Date.now() }), []);
  const mutate = useCallback((recipe) => {
    const draft = clone(dataRef.current);
    const result = recipe(draft);
    dataRef.current = draft;
    setData(draft);
    return result;
  }, []);

  const fp = useMemo(() => deviceFingerprint(), []);
  const device = useMemo(() => deviceLabel(), []);
  const pushAudit = (d, user_code, role, action, details) => {
    d.audit.unshift({ log_id: nextSeq(d.audit, "AUD-", "log_id"), user_code, role, action, timestamp: nowIso(), ip: demoIp(fp), device, fingerprint: fp, details });
  };
  const pushNote = (d, to, text, link) => {
    if (!to) return;
    d.notifications.unshift({ id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, to, text, at: nowIso(), read: false, link });
  };

  const user = useMemo(() => {
    if (!session) return null;
    const rec = listFor(data, session.role).find((r) => codeOf(session.role, r) === session.code);
    return rec ? { ...rec, role: session.role, code: session.code } : null;
  }, [session, data]);

  // ── COMPANY & LOCATION SCOPE ─────────────────────────
  // Admins and the Super Admin pick a company and location in the header; every page then reads data narrowed to it.
  // Admins can also be limited to some companies / locations (Companies & locations → Admin access).
  const scopeKey = (code) => `${APP_CONFIG.storageKey}-entity-${code || "anon"}`;
  const readScope = (code) => {
    try {
      const v = JSON.parse(localStorage.getItem(scopeKey(code)) || "null");
      return v && typeof v === "object" ? { company: v.company || ALL, location: v.location || ALL } : { company: ALL, location: ALL };
    } catch {
      return { company: ALL, location: ALL };
    }
  };
  const [entityScope, setEntityScopeState] = useState(() => readScope(session?.code));
  useEffect(() => setEntityScopeState(readScope(session?.code)), [session?.code]); // eslint-disable-line react-hooks/exhaustive-deps
  const setEntityScope = useCallback((next) => {
    setEntityScopeState((cur) => {
      const v = { ...cur, ...next };
      if (next.company && next.company !== cur.company && !("location" in next)) v.location = ALL;
      try {
        localStorage.setItem(scopeKey(sessionRef.current?.code), JSON.stringify(v));
      } catch {
        /* storage disabled */
      }
      return v;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const scopeIds = useMemo(() => {
    if (!user || user.role === "emp") return null;
    const companies = data.companies || [];
    const locations = data.workLocations || [];
    if (!companies.length || !locations.length) return null;
    const allowed = allowedEntities(user, companies, locations);
    // A remembered choice the user may no longer see falls back to everything they are allowed.
    const s = { company: allowed.companies.some((c) => c.company_id === entityScope.company) ? entityScope.company : ALL, location: allowed.locations.some((l) => l.location_id === entityScope.location) ? entityScope.location : ALL };
    // v10.7: only HR admins and the Super Admin pick an entity; everyone else always sees all they are allowed.
    if (!canSwitchEntity(user)) { s.company = ALL; s.location = ALL; }
    return scopeLocationIds(s, user, companies, locations);
  }, [user, data.companies, data.workLocations, entityScope]);
  const scopedData = useMemo(() => scopeData(data, scopeIds), [data, scopeIds]);
  const entityAccess = useMemo(() => allowedEntities(user, data.companies || [], data.workLocations || []), [user, data.companies, data.workLocations]);
  // v10.14: exports name their legal entity (see downloadCsv)
  useEffect(() => {
    const co = Object.fromEntries((data.companies || []).map((c) => [c.company_id, c.short || c.name]));
    const byEmp = Object.fromEntries((data.employees || []).map((e) => [e.employee_code, co[e.company_id] || ""]));
    const one = entityScope?.company && entityScope.company !== ALL && canSwitchEntity(user) ? co[entityScope.company] || null : null;
    setExportContext(Object.keys(co).length ? { companyOf: (code) => byEmp[code] || "", scoped: one } : null);
  }, [data.companies, data.employees, entityScope, user]);

  // ── AUTH ─────────────────────────────────────────────
  function completeLogin(p) {
    const now = nowIso();
    mutate((x) => {
      const r = listFor(x, p.role).find((u) => codeOf(p.role, u) === p.code);
      r.failed_attempts = 0;
      r.last_login = now;
      if (p.role === "admin" && r.mfa_status === "pending_setup") {
        r.mfa_status = "enabled";
        pushAudit(x, p.code, p.role, "MFA_ENROLLED", "Authenticator verified at sign-in");
      }
      pushAudit(x, p.code, p.role, "LOGIN_SUCCESS", `Signed in${p.remember ? " (remember me)" : ""}`);
    });
    try {
      if (p.remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ role: p.role, login_id: listFor(dataRef.current, p.role).find((u) => codeOf(p.role, u) === p.code).login_id }));
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* ignore */
    }
    setPending(null);
    setLogoutReason("");
    setSession({ role: p.role, code: p.code, remember: !!p.remember, started_at: now, last_active: now, fingerprint: fp });
  }

  // ── SERVER MODE (v10.8) ─────────────────────────────
  function startEngine(d) {
    engineRef.current?.stop();
    let warned = false;
    engineRef.current = createSyncEngine({
      onRejected: (list) => {
        const taken = list.filter((r) => r.reason === "code_taken");
        if (taken.length) notifyToast(`Code ${taken.map((r) => r.key).join(", ")} was just used by someone else. Refresh the page and add the person again.`, "error");
        else notifyToast(`Not saved: ${[...new Set(list.map((r) => r.reason))].join("; ")}.`, "error");
      },
      onRenamed: (list) => {
        const cur = dataRef.current;
        const next = { ...cur };
        const cols = [...new Set(list.map((r) => r.c))];
        for (const c of cols) {
          if (!Array.isArray(cur[c])) continue;
          next[c] = cur[c].map((rec) => {
            const hit = list.find((r) => r.c === c && rec?.[r.field] === r.from);
            return hit ? { ...rec, [hit.field]: hit.to } : rec;
          });
        }
        dataRef.current = next;
        setData(next);
        engineRef.current?.accept(next, cols);
        const emp = list.filter((r) => r.c === "employees");
        if (emp.length) notifyToast(`Saved with a new code: ${emp.map((r) => `${r.from} → ${r.to}`).join(", ")} (the first code was just taken by someone else).`, "info");
      },
      onError: (e, n) => { if (n >= 2 && !warned) { warned = true; notifyToast("Cannot reach the server — your changes are kept and will be saved when the connection is back.", "error"); } },
      onSaved: () => { warned = false; },
    });
    engineRef.current.reset(d);
  }
  async function loadFromServer() {
    const boot = await serverApi("/bootstrap");
    const d = prepareServer(boot);
    dataRef.current = d;
    setData(d);
    startEngine(d);
    setBootReady(true);
    return d;
  }
  async function finishServerLogin(r, p) {
    setServerToken(r.token);
    try { await loadFromServer(); } catch (e) { setServerToken(""); return { ok: false, error: e.message || "Could not load your data." }; }
    const now = nowIso();
    try {
      if (p.remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ role: r.role, login_id: p.login_id }));
      else localStorage.removeItem(REMEMBER_KEY);
    } catch { /* ignore */ }
    setPending(null);
    setLogoutReason("");
    setSession({ role: r.role, code: r.code, remember: !!p.remember, started_at: now, last_active: now, fingerprint: fp, tenant: getTenant() });
    return { ok: true, next: "done" };
  }
  async function serverStep(path, body, p) {
    try {
      const r = await serverPost(path, body);
      if (r.next === "mfa") { setPending({ ...p, server: true, challenge_id: r.challenge_id, otp: r.otp || "", otp_expires: Date.now() + 300000, step: "mfa" }); return { ok: true, next: "mfa", otp: r.otp || "" }; }
      if (r.next === "reset") { setPending({ ...p, server: true, challenge_id: r.challenge_id, step: "reset" }); return { ok: true, next: "reset" }; }
      return finishServerLogin(r, p);
    } catch (e) {
      if (e.body?.locked) setPending(null);
      return { ok: false, error: e.message, locked: !!e.body?.locked };
    }
  }
  useEffect(() => {
    if (!srv) return undefined;
    setUnauthorizedHandler(() => { engineRef.current?.stop(); setServerToken(""); setSession(null); setLogoutReason("Your session ended. Sign in again."); });
    // a remembered session after a reload: refresh the data from the server
    if (session && getServerToken()) loadFromServer().catch((e) => { if (e.status === 401) { setSession(null); setServerToken(""); } else { setBootReady(true); startEngine(dataRef.current); notifyToast("Working from saved data — the server could not be reached.", "error"); } });
    else if (session) setSession(null);
    return undefined;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // other people's changes (approvals, notifications, shared settings) every 30 s
  useEffect(() => {
    if (!srv || !session || !bootReady) return undefined;
    let since = new Date().toISOString();
    const id = setInterval(async () => {
      if (engineRef.current?.pending()) return;
      try {
        const c = await serverApi(`/changes?since=${encodeURIComponent(since)}`);
        since = c.server_time;
        const cols = [];
        const next = { ...dataRef.current };
        if (c.notifications?.length) {
          const have = new Map(next.notifications.map((n, i) => [n.id, i]));
          const list = [...next.notifications];
          for (const n of c.notifications) { if (have.has(n.id)) list[have.get(n.id)] = { ...list[have.get(n.id)], ...n }; else list.unshift(n); }
          next.notifications = list; cols.push("notifications");
        }
        if (c.requests?.length) {
          const list = [...next.requests];
          const have = new Map(list.map((r, i) => [r.request_id, i]));
          for (const r of c.requests) { if (have.has(r.request_id)) list[have.get(r.request_id)] = r; else list.unshift(r); }
          next.requests = list; cols.push("requests");
        }
        for (const [k, v] of Object.entries(c.docs || {})) { if (JSON.stringify(next[k]) !== JSON.stringify(v)) { next[k] = k === "settings" ? { ...next.settings, ...v } : v; cols.push(k); } }
        if (!cols.length) return;
        dataRef.current = next;
        engineRef.current?.accept(next, cols);
        setData(next);
      } catch { /* try again next time */ }
    }, Number(import.meta.env?.VITE_POLL_MS || 30000));
    return () => clearInterval(id);
  }, [srv, session, bootReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const beginLogin = useCallback(
    async ({ role, login_id, password, entered_code, remember }) => {
      if (srv) return serverStep("/auth/login", { tenant: getTenant(), role, login_id: login_id.trim(), password, entered_code }, { role, remember, login_id: login_id.trim() });
      const d = dataRef.current;
      const s = d.settings;
      const id = login_id.trim().toLowerCase();
      const rec = listFor(d, role).find((r) => r.login_id.toLowerCase() === id);
      const hash = await sha256(password);
      if (!rec) {
        mutate((x) => pushAudit(x, id || "unknown", role, "LOGIN_FAILED", "Unknown login ID"));
        return { ok: false, error: "Those sign-in details do not match." };
      }
      const code = codeOf(role, rec);
      if (rec.status === "locked") return { ok: false, error: `This account is locked after ${s.max_failed_attempts} failed attempts. Ask your Super Admin to unlock it.` };
      const codeMismatch = (role === "emp" || role === "admin") && (entered_code || "").trim().toUpperCase() !== code;
      // v10.9: people without a login yet (the Super Admin creates logins) get a clear answer; no attempt is counted
      if (!rec.password_hash && !codeMismatch) {
        mutate((x) => pushAudit(x, code, role, "LOGIN_NO_ACCOUNT", "No login created yet"));
        return { ok: false, error: NO_LOGIN_MSG };
      }
      if (hash !== rec.password_hash || codeMismatch) {
        return mutate((x) => {
          const r = listFor(x, role).find((u) => codeOf(role, u) === code);
          r.failed_attempts = (r.failed_attempts || 0) + 1;
          const left = s.max_failed_attempts - r.failed_attempts;
          pushAudit(x, code, role, "LOGIN_FAILED", `${codeMismatch && hash === rec.password_hash ? "Code did not match" : "Wrong password"} (attempt ${r.failed_attempts} of ${s.max_failed_attempts})`);
          if (left <= 0) {
            r.status = "locked";
            pushAudit(x, code, role, "ACCOUNT_LOCKED", `${s.max_failed_attempts} failed sign-in attempts`);
            x.superAdmins.forEach((sa) => pushNote(x, sa.superadmin_code, `${rec.full_name} (${code}) was locked after ${s.max_failed_attempts} failed sign-ins.`, "/users"));
            return { ok: false, error: `Account locked after ${s.max_failed_attempts} failed attempts. Ask your Super Admin to unlock it.` };
          }
          return { ok: false, error: `Those sign-in details do not match. ${left} attempt${left === 1 ? "" : "s"} left before the account locks.` };
        });
      }
      if (rec.status !== "active") {
        mutate((x) => pushAudit(x, code, role, "LOGIN_BLOCKED", `Status: ${rec.status}`));
        if (rec.status === "suspended") return { ok: false, error: "This account is suspended. Contact your HR administrator." };
        if (rec.status === "pending_approval") return { ok: false, error: "Your account is waiting for approval by HR. You will be notified when it is activated." };
        return { ok: false, error: "This account request was declined. Contact HR." };
      }
      const needsMfa = (role === "admin" && s.mfa_admin_required) || role === "superadmin";
      const p = { role, code, remember, started: nowIso() };
      if (needsMfa) {
        p.otp = makeOtp();
        p.otp_expires = Date.now() + s.otp_ttl_sec * 1000;
        p.step = "mfa";
        setPending(p);
        mutate((x) => pushAudit(x, code, role, "MFA_CHALLENGE", "Password accepted; one-time code issued"));
        return { ok: true, next: "mfa", otp: p.otp };
      }
      if (rec.must_reset) {
        setPending({ ...p, step: "reset" });
        return { ok: true, next: "reset" };
      }
      completeLogin(p);
      return { ok: true, next: "done" };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutate],
  );

  const resendOtp = useCallback(() => {
    if (!pending) return null;
    const otp = makeOtp();
    setPending({ ...pending, otp, otp_expires: Date.now() + dataRef.current.settings.otp_ttl_sec * 1000 });
    return otp;
  }, [pending]);

  const verifyMfa = useCallback(
    async ({ otp, pin }) => {
      if (!pending) return { ok: false, error: "Your sign-in expired. Start again." };
      if (pending.server) return serverStep("/auth/mfa", { challenge_id: pending.challenge_id, otp: otp.trim(), pin }, pending);
      const d = dataRef.current;
      const { role, code } = pending;
      if (Date.now() > pending.otp_expires) return { ok: false, error: "That code has expired. Send a new one." };
      if (otp.trim() !== pending.otp) {
        mutate((x) => pushAudit(x, code, role, "MFA_FAILED", "Wrong one-time code"));
        return { ok: false, error: "That code is not right. Check your authenticator and try again." };
      }
      if (role === "superadmin") {
        const rec = d.superAdmins.find((r) => r.superadmin_code === code);
        if ((await sha256(pin || "")) !== rec.security_pin_hash) {
          return mutate((x) => {
            const r = x.superAdmins.find((u) => u.superadmin_code === code);
            r.failed_attempts = (r.failed_attempts || 0) + 1;
            pushAudit(x, code, role, "PIN_FAILED", `Wrong security PIN (attempt ${r.failed_attempts})`);
            if (r.failed_attempts >= d.settings.max_failed_attempts) {
              r.status = "locked";
              setPending(null);
              return { ok: false, error: "Account locked after repeated security PIN failures.", locked: true };
            }
            return { ok: false, error: "That security PIN is not right." };
          });
        }
      }
      const rec = listFor(d, role).find((r) => codeOf(role, r) === code);
      if (rec.must_reset) {
        setPending({ ...pending, step: "reset" });
        return { ok: true, next: "reset" };
      }
      completeLogin(pending);
      return { ok: true, next: "done" };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, mutate],
  );

  const completeReset = useCallback(
    async (newPassword) => {
      if (!pending) return { ok: false, error: "Your sign-in expired. Start again." };
      if (pending.server) return serverStep("/auth/reset-password", { challenge_id: pending.challenge_id, new_password: newPassword }, pending);
      const { role, code } = pending;
      const hash = await sha256(newPassword);
      const rec = listFor(dataRef.current, role).find((r) => codeOf(role, r) === code);
      if (hash === rec.password_hash) return { ok: false, error: "Choose a password different from the temporary one." };
      mutate((x) => {
        const r = listFor(x, role).find((u) => codeOf(role, u) === code);
        r.password_hash = hash;
        r.must_reset = false;
        r.password_changed_at = nowIso();
        pushAudit(x, code, role, "PASSWORD_RESET", "First-time password set");
      });
      completeLogin(pending);
      return { ok: true };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, mutate],
  );

  const cancelPending = useCallback(() => setPending(null), []);
  const logout = useCallback(
    (reason = "") => {
      if (srv) {
        const eng = engineRef.current;
        (async () => { try { await eng?.flush(); await serverPost("/auth/logout", {}); } catch { /* already gone */ } eng?.stop(); setServerToken(""); try { localStorage.removeItem(serverCacheKey()); } catch { /* ignore */ } })();
        setSession(null);
        setLogoutReason(reason);
        return;
      }
      if (session) mutate((x) => pushAudit(x, session.code, session.role, reason ? "SESSION_TIMEOUT" : "LOGOUT", reason || "Signed out"));
      setSession(null);
      setLogoutReason(reason);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, mutate],
  );
  const touch = useCallback(() => setSession((s) => (s ? { ...s, last_active: nowIso() } : s)), []);
  // v10.4: an HR / Finance admin or the Super Admin who is also an employee opens their own employee workspace
  // (their employee login) without signing out, and comes back the same way. Both moves are audited.
  const switchWorkspace = useCallback(
    (target) => {
      const s = sessionRef.current;
      if (!s) return { ok: false, error: "Not signed in." };
      const d = dataRef.current;
      if (target === "back") {
        if (!s.origin) return { ok: false, error: "You are already in your main workspace." };
        mutate((x) => pushAudit(x, s.origin.code, s.origin.role, "WORKSPACE_SWITCH", `Back to ${s.origin.role} workspace from employee ${s.code}`));
        setSession({ ...s, role: s.origin.role, code: s.origin.code, origin: undefined, last_active: nowIso() });
        return { ok: true, role: s.origin.role };
      }
      if (s.role === "emp") return { ok: false, error: "You are already in your employee workspace." };
      const rec = listFor(d, s.role).find((r) => codeOf(s.role, r) === s.code);
      const emp = rec?.employee_code && d.employees.find((e) => e.employee_code === rec.employee_code);
      if (!emp) return { ok: false, error: "No employee record is linked to this account. Ask the Super Admin to link one in Users & access." };
      if (["exited", "rejected", "locked", "suspended"].includes(emp.status)) return { ok: false, error: `The linked employee account ${emp.employee_code} is ${emp.status}.` };
      mutate((x) => pushAudit(x, s.code, s.role, "WORKSPACE_SWITCH", `Opened employee workspace ${emp.employee_code}`));
      setSession({ ...s, role: "emp", code: emp.employee_code, origin: { role: s.role, code: s.code }, last_active: nowIso() });
      return { ok: true, role: "emp" };
    },
    [mutate], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // v10.4: the Super Admin decides each admin's access profile (Employee + HR, Employee + Finance, Employee + HR + Finance),
  // whether they may switch country and language, and which employee record (if any) is theirs.
  const setAccountAccess = useCallback(
    (role, code, patch) =>
      mutate((x) => {
        if (sessionRef.current?.role !== "superadmin") return { ok: false, error: "Only the Super Admin can change access." };
        const r = listFor(x, role).find((u) => codeOf(role, u) === code);
        if (!r) return { ok: false, error: "Account not found." };
        const keys = role === "admin" ? ["access_profile", "locale_access", "employee_code"] : ["employee_code"];
        const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => keys.includes(k)));
        if (clean.employee_code && !x.employees.some((e) => e.employee_code === clean.employee_code)) return { ok: false, error: "That employee does not exist." };
        Object.assign(r, clean);
        pushAudit(x, sessionRef.current.code, "superadmin", "ACCESS_CHANGE", `${code} · ${Object.entries(clean).map(([k, v]) => `${k}=${v === "" ? "none" : v}`).join(", ")}`);
        return { ok: true };
      }),
    [mutate], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const rememberedLogin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(REMEMBER_KEY) || "null");
    } catch {
      return null;
    }
  }, []);

  // ── derived helpers ──────────────────────────────────
  const helpers = useMemo(() => {
    const empBy = Object.fromEntries(data.employees.map((e) => [e.employee_code, e]));
    const adminBy = Object.fromEntries(data.admins.map((a) => [a.admin_code, a]));
    const saBy = Object.fromEntries(data.superAdmins.map((a) => [a.superadmin_code, a]));
    const catBy = Object.fromEntries(data.categories.map((c) => [c.category_id, c]));
    const ruleBy = Object.fromEntries(data.rules.map((r) => [r.rule_id, r]));
    const orgBy = Object.fromEntries(data.orgUnits.map((o) => [o.org_unit_id, o]));
    const leaveTypeBy = Object.fromEntries(data.leaveTypes.map((t) => [t.code, t]));
    const expCatBy = Object.fromEntries(data.expenseCategories.map((c) => [c.code, c]));
    const nameOf = (code) => empBy[code]?.full_name || adminBy[code]?.full_name || saBy[code]?.full_name || (code === "SYSTEM" ? "System" : code || "—");
    const balanceOf = (empCode) => {
      const entries = data.ledger.filter((l) => l.employee_code === empCode);
      const earned = entries.filter((l) => l.points > 0).reduce((s, l) => s + l.points, 0);
      const used = -entries.filter((l) => l.points < 0).reduce((s, l) => s + l.points, 0);
      const pendingPts = data.submissions.filter((s) => s.employee_code === empCode && OPEN_STATUSES.includes(s.status)).reduce((sum, s) => sum + Number(s.points_requested || 0), 0);
      return { earned, used, pending: pendingPts, available: earned - used };
    };
    const scopeUnits = (admin) => {
      const set = new Set(admin?.org_units || []);
      // v10.11: an admin scoped to a top-level unit (e.g. "Head Office") covers the whole company — including
      // departments created later and departments typed on employees that are not in the org tree yet.
      if (coversCompany(data, admin)) { data.orgUnits.forEach((o) => set.add(o.org_unit_id)); data.employees.forEach((e) => e.department && set.add(e.department)); return set; }
      let grew = true;
      while (grew) {
        grew = false;
        data.orgUnits.forEach((o) => {
          if (o.parent_unit && set.has(o.parent_unit) && !set.has(o.org_unit_id)) {
            set.add(o.org_unit_id);
            grew = true;
          }
        });
      }
      return set;
    };
    const reportsOf = (code) => data.employees.filter((e) => e.reporting_manager === code);
    const leaveBalanceOf = (empCode) => leaveBalances(empBy[empCode], leaveTypesFor(data, empBy[empCode]), data.requests);
    // Items waiting on a manager (employee code) or an admin (admin record)
    const pendingForManager = (code) => ({
      requests: data.requests.filter((r) => r.status === "Pending" && r.stage === "manager" && r.steps[0]?.approver === code),
      points: [], // Sahayog points removed (v8.8)
    });
    const pendingForAdmin = (admin) => {
      const scope = scopeUnits(admin);
      const inScope = (empCode) => scope.has(empBy[empCode]?.department);
      return {
        requests: data.requests.filter((r) => r.status === "Pending" && r.stage === "admin" && admin.modules.includes(stepModule(r, currentAdminStep(r))) && inScope(r.employee_code)),
        payouts: data.requests.filter((r) => r.status === "Approved" && ["expense", "advance", "loan", "asset"].includes(r.type) && admin.modules.includes(r.type === "asset" ? "assets" : r.type) && inScope(r.employee_code)),
        points: [], // Sahayog points removed (v8.8)
        accounts: admin.modules.includes("accounts") ? data.employees.filter((e) => e.status === "pending_approval" && scope.has(e.department)) : [],
      };
    };
    return { empBy, adminBy, saBy, catBy, ruleBy, orgBy, leaveTypeBy, expCatBy, nameOf, balanceOf, scopeUnits, reportsOf, leaveBalanceOf, pendingForManager, pendingForAdmin, roleOfCode };
  }, [data]);

  function adminFor(d, deptId, module) {
    const can = (ad) => ad.status === "active" && ad.modules.includes(module) && ad.permissions_scope.includes("approve");
    let unit = deptId;
    while (unit) {
      const a = d.admins.find((ad) => ad.status === "active" && ad.org_units.includes(unit) && ad.modules.includes(module) && ad.permissions_scope.includes("approve"));
      if (a) return a.admin_code;
      unit = d.orgUnits.find((o) => o.org_unit_id === unit)?.parent_unit;
    }
    return d.admins.find((ad) => can(ad) && coversCompany(d, ad))?.admin_code || null;
  }
  // v10.11: approval workflow is wired automatically. Whenever an admin is created, changed, suspended or reactivated,
  // every open admin step without a working approver is given to the right admin for its function (IT / HR / Finance…),
  // and that admin is told about any step that is already waiting on them.
  function rerouteSteps(x) {
    const ok = (code, module) => { const a = x.admins.find((ad) => ad.admin_code === code); return a && a.status === "active" && a.modules.includes(module); };
    const moved = [];
    x.requests.forEach((r) => {
      if (r.status !== "Pending") return;
      const emp = x.employees.find((e) => e.employee_code === r.employee_code);
      (r.steps || []).forEach((st) => {
        if (st.level !== "admin" || !["pending", "waiting"].includes(st.status)) return;
        const module = stepModule(r, st);
        if (st.approver && ok(st.approver, module)) return;
        const next = adminFor(x, emp?.department, module);
        if (!next || next === st.approver) return;
        st.approver = next;
        moved.push(r.request_id);
        if (st.status === "pending") pushNote(x, next, `${REQUEST_TYPES[r.type].label} ${r.request_id} from ${emp?.full_name || r.employee_code} needs your approval.`, "/approvals");
      });
    });
    return moved;
  }
  // v10.6: when the reporting manager is missing, inactive or on approved leave today, the approval follows the
  // organisation's fallback (settings.leave_fallback): "skip_level" → the next manager up the chain,
  // "department_head" → the head of the employee's department, "hr" → straight to the HR admin.
  function activeManager(d, emp) {
    const today = new Date().toISOString().slice(0, 10);
    const by = (c) => d.employees.find((e) => e.employee_code === c);
    const away = (c) => d.requests.some((r) => r.type === "leave" && r.status === "Approved" && r.employee_code === c && r.from_date <= today && r.to_date >= today);
    const ok = (m) => m && m.status === "active" && m.employee_code !== emp.employee_code && !away(m.employee_code);
    const m = by(emp.reporting_manager);
    if (ok(m)) return m.employee_code;
    const fb = d.settings?.leave_fallback || "skip_level";
    if (fb === "skip_level") {
      let cur = m;
      for (let i = 0; i < 4 && cur; i += 1) {
        cur = by(cur.reporting_manager);
        if (ok(cur)) return cur.employee_code;
      }
    }
    if (fb === "department_head") {
      const head = d.employees.filter((e) => e.department === emp.department && e.status === "active" && d.employees.some((x) => x.reporting_manager === e.employee_code) && !(by(e.reporting_manager)?.department === emp.department)).find(ok);
      if (head) return head.employee_code;
    }
    return null;
  }

  // ── POINTS (employee) ────────────────────────────────
  const saveSubmission = useCallback(
    (form, { submit }) => {
      const d = dataRef.current;
      const me = d.employees.find((e) => e.employee_code === session.code);
      const { errors, flags } = validateSubmission(form, { ...d, employee: me }, { forDraft: !submit });
      if (Object.keys(errors).length) return { ok: false, errors };
      return mutate((x) => {
        let s = form.submission_id && x.submissions.find((i) => i.submission_id === form.submission_id);
        const now = nowIso();
        if (!s) {
          s = { submission_id: nextSeq(x.submissions, `SUB-${new Date().getFullYear()}-`, "submission_id"), employee_code: me.employee_code, status: "Draft", created_at: now, history: [{ status: "Draft", at: now, by: me.employee_code, note: "" }], steps: [], approved_points: null, admin_decision: null, rejection_reason: "", admin_remarks: "", approval_timestamp: null, approver_admin_code: null, flagged: null, escalation: null, override: null };
          x.submissions.unshift(s);
        }
        Object.assign(s, { category_id: form.category_id, rule_id: form.rule_id, description: form.description.trim(), points_requested: form.points_requested === "" ? "" : Number(form.points_requested), activity_date: form.activity_date, supporting_document: form.supporting_document, witness: form.witness, remarks: form.remarks, declaration: !!form.declaration, flags });
        if (submit) {
          const wf = x.settings.workflow.points;
          const mgr = wf !== "admin" ? activeManager(x, me) : null;
          s.status = "Submitted";
          s.submitted_at = now;
          s.manager_code = mgr;
          s.assigned_admin = adminFor(x, me.department, "points");
          s.stage = mgr ? "manager" : "admin";
          s.steps = [{ level: "manager", approver: mgr, status: mgr ? "pending" : "skipped", at: null, note: "" }, { level: "admin", approver: s.assigned_admin, status: mgr ? "waiting" : "pending", at: null, note: "" }];
          s.history.push({ status: "Submitted", at: now, by: me.employee_code, note: flags.length ? `Auto-validation passed with ${flags.length} flag(s)` : "Auto-validation passed" });
          pushNote(x, me.employee_code, `${s.submission_id} was submitted for ${s.points_requested} points.`, "/points/claims");
          if (mgr) pushNote(x, mgr, `${me.full_name} claimed ${s.points_requested} points (${s.submission_id}). Your approval is needed.`, "/inbox");
          else if (s.assigned_admin) pushNote(x, s.assigned_admin, `New claim ${s.submission_id} from ${me.full_name} (${s.points_requested} pts).`, "/approvals");
          pushAudit(x, me.employee_code, "emp", "SUBMIT", `${s.submission_id} · ${s.rule_id} · ${s.points_requested} pts${flags.length ? ` · flags: ${flags.map((f) => f.code).join(", ")}` : ""}`);
        } else pushAudit(x, me.employee_code, "emp", "SAVE_DRAFT", s.submission_id);
        return { ok: true, submission: s };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, mutate],
  );

  const withdrawSubmission = useCallback(
    (id) =>
      mutate((x) => {
        const s = x.submissions.find((i) => i.submission_id === id);
        if (!s || s.status !== "Submitted") return { ok: false, error: "Only claims not yet approved by anyone can be withdrawn." };
        s.status = "Withdrawn";
        s.stage = null;
        s.history.push({ status: "Withdrawn", at: nowIso(), by: s.employee_code, note: "Withdrawn by employee" });
        pushAudit(x, s.employee_code, "emp", "WITHDRAW", id);
        return { ok: true };
      }),
    [mutate],
  );
  const deleteDraft = useCallback(
    (id) =>
      mutate((x) => {
        x.submissions = x.submissions.filter((s) => !(s.submission_id === id && s.status === "Draft"));
        pushAudit(x, session.code, session.role, "DELETE_DRAFT", id);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, mutate],
  );

  // Manager step on a points claim
  const managerDecidePoints = useCallback(
    (id, { approve, note }) =>
      mutate((x) => {
        const s = x.submissions.find((i) => i.submission_id === id);
        if (!s || s.status !== "Submitted" || s.stage !== "manager" || s.manager_code !== session.code) return { ok: false, error: "This claim is not waiting for you." };
        if (!approve && !(note || "").trim()) return { ok: false, error: "Give a reason so the employee knows what to fix." };
        const now = nowIso();
        s.steps[0] = { ...s.steps[0], status: approve ? "approved" : "rejected", at: now, note: note || "" };
        const me = x.employees.find((e) => e.employee_code === session.code);
        if (approve) {
          const final = x.settings.workflow.points === "manager";
          s.history.push({ status: "Manager Approved", at: now, by: session.code, note: note || "" });
          if (final) {
            // Manager-only workflow: credit straight away.
            const pts = Number(s.points_requested);
            Object.assign(s, { status: "Credited", stage: null, admin_decision: "Approve", approved_points: pts, approval_timestamp: now, approver_admin_code: session.code });
            x.ledger.unshift({ entry_id: nextSeq(x.ledger, "LED-", "entry_id"), employee_code: s.employee_code, type: "credit", points: pts, ref: s.submission_id, note: "Approved claim", at: now });
            s.history.push({ status: "Credited", at: now, by: "SYSTEM", note: `${pts} points credited` });
            pushNote(x, s.employee_code, `${s.submission_id} approved by ${me.full_name}: ${pts} points credited.`, "/points/ledger");
          } else {
            s.status = "Manager Approved";
            s.stage = "admin";
            s.steps[1] = { ...s.steps[1], status: "pending" };
            pushNote(x, s.employee_code, `${me.full_name} approved ${s.submission_id}; it is now with HR.`, "/points/claims");
            pushNote(x, s.assigned_admin, `${s.submission_id} was approved by ${me.full_name} and needs your decision.`, "/approvals");
          }
        } else {
          Object.assign(s, { status: "Rejected", stage: null, rejection_reason: note.trim(), approval_timestamp: now, approver_admin_code: session.code });
          s.history.push({ status: "Rejected", at: now, by: session.code, note: note.trim() });
          pushNote(x, s.employee_code, `${s.submission_id} was rejected by ${me.full_name}: ${note.trim()}`, "/points/claims");
        }
        pushAudit(x, session.code, "emp", approve ? "MANAGER_APPROVE" : "MANAGER_REJECT", `${id}${note ? ` · ${note}` : ""}`);
        return { ok: true };
      }),
    [session, mutate],
  );

  const redeem = useCallback(
    (points) => {
      const d = dataRef.current;
      const me = d.employees.find((e) => e.employee_code === session.code);
      const bal = helpers.balanceOf(me.employee_code);
      const p = Number(points);
      if (!Number.isInteger(p) || p < d.settings.min_redeem_points) return { ok: false, error: `Redeem at least ${d.settings.min_redeem_points} points.` };
      if (p > bal.available) return { ok: false, error: `You have ${bal.available} points available.` };
      if (!me.bank_account) return { ok: false, error: "Add your bank account in My profile first." };
      return mutate((x) => {
        const ref = nextSeq(x.redemptions, "RDM-", "ref");
        x.redemptions.push({ ref, employee_code: me.employee_code, points: p, amount_inr: p * x.settings.point_value_inr, status: "Payout queued", at: nowIso() });
        x.ledger.unshift({ entry_id: nextSeq(x.ledger, "LED-", "entry_id"), employee_code: me.employee_code, type: "redeem", points: -p, ref, note: `Payout to bank ${maskAccount(me.bank_account)}`, at: nowIso() });
        pushNote(x, me.employee_code, `${p} points redeemed (₹${p * x.settings.point_value_inr}). Paid with the next payroll.`, "/points/ledger");
        pushAudit(x, me.employee_code, "emp", "REDEEM", `${ref} · ${p} pts`);
        return { ok: true, ref };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, helpers, mutate],
  );

  // ── REQUESTS: leave / expense / advance / loan ───────
  const createRequest = useCallback(
    (type, form) => {
      const d = dataRef.current;
      const me = d.employees.find((e) => e.employee_code === session.code);
      let v;
      if (type === "leave") v = validateLeave(form, { emp: me, leaveTypes: leaveTypesFor(d, me), holidays: holidaysFor(d, me), requests: d.requests });
      if (type === "expense") v = validateExpense(form, { emp: me, expenseCategories: d.expenseCategories, settings: d.settings });
      if (type === "advance") v = validateAdvance(form, { settings: d.settings, requests: d.requests, emp: me });
      if (type === "loan") v = validateLoan(form, { settings: d.settings, emp: me, requests: d.requests });
      if (type === "regularize") v = validateRegularize(form, { settings: d.settings, punches: d.punches, emp: me });
      if (type === "asset") v = validateAssetRequest(form);
      if (type === "asset_purchase") v = validateAssetPurchase(form);
      if (FORM_TYPES[type]) v = validateForm(type, form, { emp: me, requests: d.requests }); // v10.13
      if (type === "screenoff") v = validateScreenOff(form, { settings: d.settings, available: form.date ? (hoursInRange(d, me.employee_code, form.date, form.date).days[0]?.claimable || 0) * 60 : null });
      if (Object.keys(v.errors).length) return { ok: false, errors: v.errors, itemErrors: v.itemErrors };
      return mutate((x) => {
        const now = nowIso();
        // Screen-off claims are approved by the reporting manager only (HR admin when there is no manager).
        // v10.11: the chain is a list of steps (e.g. manager → IT admin → HR admin → Finance admin).
        const plan = chainSteps(x.settings.workflow?.[type] || defaultChain(type), type);
        // v10.13: confidential forms (grievance / speak-up) never go to the reporting manager
        const mgr = plan.some((st) => st.level === "manager") && !FORM_TYPES[type]?.confidential ? activeManager(x, me) : null;
        let adminPlan = plan.filter((st) => st.level === "admin");
        if (!adminPlan.length && !mgr) adminPlan = chainSteps("admin", type); // no manager available → the module admin
        const adminSteps = adminPlan.map((st, i) => ({ level: "admin", role: st.role || null, module: st.module, approver: adminFor(x, me.department, st.module), status: !mgr && i === 0 ? "pending" : "waiting", at: null, note: "" }));
        const adminCode = adminSteps[0]?.approver || null;
        const id = nextSeq(x.requests.filter((r) => r.type === type), REQUEST_TYPES[type].prefix, "request_id");
        const payload = { ...form };
        delete payload.declaration;
        if (type === "leave") { payload.days = v.days; if (v.lop) payload.lop_days = v.lop; }
        if (type === "loan") payload.emi = v.emi;
        if (FORM_TYPES[type]) { Object.keys(payload).forEach((k) => delete payload[k]); Object.assign(payload, formPayload(type, form)); }
        if (type === "expense") payload.items = form.items.map((i) => ({ ...i, amount: Number(i.amount) }));
        if (type === "advance") payload.request_amount = Number(form.request_amount);
        if (type === "loan") payload.amount = Number(form.amount);
        if (type === "screenoff") { payload.minutes = Math.round(Number(form.minutes)); payload.reason = form.reason.trim(); }
        if (type === "asset_purchase") { payload.quantity = Number(form.quantity); payload.est_cost = Number(form.est_cost); payload.total_cost = v.total; payload.item = form.item.trim(); payload.reason = form.reason.trim(); }
        const r = {
          ...payload,
          request_id: id,
          type,
          employee_code: me.employee_code,
          company_id: me.company_id,
          location_id: me.location_id,
          status: "Pending",
          stage: mgr ? "manager" : "admin",
          flags: v.flags || [],
          steps: [
            { level: "manager", approver: mgr, status: mgr ? "pending" : "skipped", at: null, note: "" },
            ...adminSteps,
          ],
          history: [{ status: "Submitted", at: now, by: me.employee_code, note: "" }],
          created_at: now,
        };
        x.requests.unshift(r);
        const label = REQUEST_TYPES[type].label.toLowerCase();
        const amount = FORM_TYPES[type] ? (FORM_TYPES[type].confidential ? "confidential" : FORM_TYPES[type].summary(r, fmtNum).title) : type === "asset_purchase" ? `${payload.quantity} × ${payload.item}, ₹${fmtNum(payload.total_cost)}` : type === "leave" ? `${v.days} day(s)` : type === "expense" ? `₹${fmtNum(v.total)}` : type === "regularize" ? payload.date : type === "screenoff" ? `${fmtMins(payload.minutes)} on ${payload.date}` : type === "asset" ? payload.category : `₹${fmtNum(payload.request_amount || payload.amount)}`;
        pushNote(x, me.employee_code, `Your ${label} ${id} (${amount}) was sent for approval.`, linkFor(r));
        if (mgr) pushNote(x, mgr, `${me.full_name} sent ${/^[aeiou]/i.test(label) ? "an" : "a"} ${label} ${id} (${amount}) for your approval.`, "/inbox");
        else pushNote(x, adminCode, `${me.full_name} sent ${/^[aeiou]/i.test(label) ? "an" : "a"} ${label} ${id} (${amount}).`, "/approvals");
        pushAudit(x, me.employee_code, "emp", `${type.toUpperCase()}_SUBMIT`, `${id} · ${amount}`);
        return { ok: true, id };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, mutate],
  );

  const cancelRequest = useCallback(
    (id) =>
      mutate((x) => {
        const r = x.requests.find((i) => i.request_id === id);
        if (!r || r.employee_code !== session.code) return { ok: false, error: "Not your request." };
        const futureLeave = r.type === "leave" && r.status === "Approved" && r.from_date > new Date().toISOString().slice(0, 10);
        if (r.status !== "Pending" && !futureLeave) return { ok: false, error: "Only pending requests (or approved future leave) can be cancelled." };
        r.status = "Cancelled";
        r.stage = null;
        r.history.push({ status: "Cancelled", at: nowIso(), by: session.code, note: "Cancelled by employee" });
        const notify = r.steps.find((st) => st.status === "pending" || st.status === "approved")?.approver;
        pushNote(x, notify, `${id} was cancelled by ${x.employees.find((e) => e.employee_code === session.code).full_name}.`, notify?.startsWith("ADM") ? "/approvals" : "/inbox");
        pushAudit(x, session.code, "emp", "REQUEST_CANCEL", id);
        return { ok: true };
      }),
    [session, mutate],
  );

  // v10.11: an IT support ticket held for the manager's approval is released to the IT queue (or closed if rejected).
  function itTicketDecided(x, r, approve, note, by) {
    const k = (x.itTickets || []).find((t) => t.id === r.ticket_id);
    if (!k || k.status !== "awaiting_approval") return;
    const at = nowIso();
    if (approve) {
      k.status = "open";
      k.created_at = k.created_at || at;
      k.sla_due = slaDue(at, k.priority);
      k.history.push({ at, by: session.code, action: `Approved by ${by} → sent to IT` });
      (x.admins || []).filter((a) => a.status === "active" && a.modules.includes("it")).forEach((a) => pushNote(x, a.admin_code, `New IT ticket ${k.id} from ${x.employees.find((e) => e.employee_code === k.requester)?.full_name || k.requester} (approved by ${by}): ${k.subject}`, `/it-helpdesk?t=${k.id}`));
    } else {
      k.status = "closed";
      k.resolution = `Not approved by ${by}: ${note}`;
      k.history.push({ at, by: session.code, action: `Not approved by ${by}: ${note}` });
    }
    k.updated_at = at;
  }

  // Decide the current step. Managers act on stage "manager"; admins on stage "admin".
  function applyRequestDecision(x, r, { approve, note, approved_amount }) {
    const now = nowIso();
    const role = session.role;
    const isMgr = role === "emp";
    if (r.status !== "Pending") return { ok: false, error: "This request is no longer pending." };
    if (isMgr && (r.stage !== "manager" || r.steps[0].approver !== session.code)) return { ok: false, error: "This request is not waiting for you." };
    if (!isMgr && r.stage !== "admin") return { ok: false, error: "This request is still with the manager." };
    // v10.11: an admin decides only the step that is waiting on their function (IT, HR, Finance…)
    const curStep = isMgr ? null : currentAdminStep(r);
    if (!isMgr && !curStep) return { ok: false, error: "This request has no step waiting." };
    if (role === "admin" && !(x.admins.find((a) => a.admin_code === session.code)?.modules || []).includes(stepModule(r, curStep))) return { ok: false, error: `This step is waiting for the ${stepLabel(r, curStep)}.` };
    if (!approve && !(note || "").trim()) return { ok: false, error: "A reason is required to reject." };
    const idx = isMgr ? 0 : r.steps.indexOf(curStep);
    const label = REQUEST_TYPES[r.type].label;
    const actorName = isMgr ? x.employees.find((e) => e.employee_code === session.code).full_name : x.admins.find((a) => a.admin_code === session.code)?.full_name || "Super Admin";
    r.steps[idx] = { ...r.steps[idx], approver: session.code, status: approve ? "approved" : "rejected", at: now, note: note || "" };
    if (!approve) {
      r.status = "Rejected";
      r.stage = null;
      if (r.type === "itsupport") itTicketDecided(x, r, false, note.trim(), actorName);
      r.history.push({ status: "Rejected", at: now, by: session.code, note: note.trim() });
      pushNote(x, r.employee_code, `${label} ${r.request_id} was rejected by ${actorName}: ${note.trim()}`, linkFor(r));
      return { ok: true };
    }
    if (!isMgr && ["expense", "advance", "loan"].includes(r.type) && approved_amount != null && approved_amount !== "") {
      const asked = r.type === "expense" ? expenseTotal(r.items) : r.request_amount || r.amount;
      const amt = Number(approved_amount);
      if (Number.isNaN(amt) || amt <= 0 || amt > asked) return { ok: false, error: `Approved amount must be between 1 and ₹${fmtNum(asked)}.` };
      if (amt < asked && !(note || "").trim()) return { ok: false, error: "Explain why you are approving less than claimed." };
      r.approved_amount = amt;
      if (r.type === "loan") r.emi = Math.ceil(amt / r.tenure_months);
    }
    const nextIdx = r.steps.findIndex((st, i) => i > idx && st.status === "waiting");
    if (nextIdx > -1) {
      r.steps[nextIdx].status = "pending";
      if (!r.steps[nextIdx].approver) r.steps[nextIdx].approver = x.admins.find((a) => a.status === "active" && a.modules.includes(stepModule(r, r.steps[nextIdx])))?.admin_code || null;
      r.stage = "admin";
      r.history.push({ status: isMgr ? "Manager approved" : `${stepLabel(r, r.steps[idx])} approved`, at: now, by: session.code, note: note || "" });
      const nextLabel = r.steps[nextIdx].role ? `the ${stepLabel(r, r.steps[nextIdx])}` : ["leave", "regularize", "screenoff"].includes(r.type) ? "HR" : r.type === "asset" ? "the asset team" : "Finance";
      pushNote(x, r.employee_code, `${actorName} approved ${r.request_id}; it is now with ${nextLabel}.`, linkFor(r));
      pushNote(x, r.steps[nextIdx].approver, `${label} ${r.request_id} from ${x.employees.find((e) => e.employee_code === r.employee_code).full_name} needs your approval.`, "/approvals");
    } else {
      r.status = "Approved";
      r.stage = null;
      r.history.push({ status: "Approved", at: now, by: session.code, note: note || "" });
      if (r.type === "itsupport") itTicketDecided(x, r, true, note || "", actorName);
      const tail = r.type === "asset_purchase" ? " Finance will raise the purchase order; the asset team adds it to stock on delivery." : r.type === "itsupport" ? " The IT team now has your ticket." : r.type === "expense" ? " Reimbursement will follow." : r.type === "advance" || r.type === "loan" ? " Disbursement will follow." : r.type === "asset" ? " The asset team will assign it from stock." : r.type === "regularize" ? " Your attendance for that day is corrected." : r.type === "screenoff" ? ` ${fmtMins(r.minutes)} was moved from screen-off time into your worked hours for ${r.date}.` : "";
      if (r.type === "regularize") {
        // Replace that day's punches with the approved times.
        const keep = x.punches.filter((p) => !(p.employee_code === r.employee_code && p.ts.startsWith(r.date)));
        const mk = (type, t) => ({ id: `PN-R${r.request_id}-${type}`, employee_code: r.employee_code, ts: new Date(`${r.date}T${t}:00`).toISOString(), type, source: "regularized", device_id: null, verified: "approval", lat: null, lng: null, accuracy: null, geofence_id: null, inside: true, flag: null, ref: r.request_id });
        x.punches = [...keep, mk("in", r.in_time), mk("out", r.out_time)];
      }
      pushNote(x, r.employee_code, `${label} ${r.request_id} was approved by ${actorName}.${tail}`, linkFor(r));
      // v10.7: when Finance approves a salary loan, HR admins are told.
      if (r.type === "loan") (x.admins || []).filter((a) => a.status === "active" && (a.access_profile === "hr" || a.access_profile === "hr_finance" || (!a.access_profile && (a.modules || []).includes("accounts")))).forEach((a) => pushNote(x, a.admin_code, `Salary loan ${r.request_id} for ${x.employees.find((e) => e.employee_code === r.employee_code)?.full_name} approved by Finance: ₹${r.approved_amount ?? r.amount} over ${r.tenure_months} months (EMI ₹${r.emi || Math.ceil((r.approved_amount ?? r.amount) / r.tenure_months)}).`, "/inbox"));
    }
    return { ok: true };
  }
  const linkFor = (r) => ({ leave: "/leave", loan: "/finances", regularize: "/attendance", asset: "/assets", asset_purchase: "/assets", itsupport: `/it-support?t=${r.ticket_id || ""}`, screenoff: "/home", ...Object.fromEntries(Object.keys(FORM_TYPES).map((k) => [k, "/my-forms"])) })[r.type] || "/expenses";

  const decideRequest = useCallback(
    (id, payload) =>
      mutate((x) => {
        const r = x.requests.find((i) => i.request_id === id);
        const res = applyRequestDecision(x, r, payload);
        if (res.ok) pushAudit(x, session.code, session.role, `${r.type.toUpperCase()}_${payload.approve ? "APPROVE" : "REJECT"}`, `${id}${payload.approved_amount ? ` · ₹${payload.approved_amount}` : ""}${payload.note ? ` · ${payload.note}` : ""}`);
        return res;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, mutate],
  );

  const bulkDecideRequests = useCallback(
    (ids, approve, note = "") =>
      mutate((x) => {
        let done = 0;
        const skipped = [];
        ids.forEach((id) => {
          const r = x.requests.find((i) => i.request_id === id);
          const res = r ? applyRequestDecision(x, r, { approve, note }) : { ok: false };
          if (res.ok) done += 1;
          else skipped.push(id);
        });
        pushAudit(x, session.code, session.role, approve ? "BULK_APPROVE" : "BULK_REJECT", `${done} request(s); skipped ${skipped.length}`);
        return { ok: true, done, skipped };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, mutate],
  );

  // Finance: mark an approved expense paid, or an advance / loan disbursed.
  const payoutRequest = useCallback(
    (id, { ref, date }) =>
      mutate((x) => {
        const r = x.requests.find((i) => i.request_id === id);
        if (!r || r.status !== "Approved") return { ok: false, error: "Only approved requests can be paid." };
        if (!(ref || "").trim() || !date) return { ok: false, error: "Enter the payment reference and date." };
        const amount = r.approved_amount ?? (r.type === "expense" ? expenseTotal(r.items) : r.request_amount || r.amount);
        r.approved_amount = amount;
        r.payment_ref = ref.trim();
        if (r.type === "expense") {
          r.status = "Paid";
          r.paid_on = date;
        } else {
          r.status = "Disbursed";
          r.disbursed_date = date;
          if (r.type === "advance") r.settle_by = new Date(new Date(date).getTime() + x.settings.advance_settle_days * 86400000).toISOString().slice(0, 10);
        }
        r.history.push({ status: r.status, at: nowIso(), by: session.code, note: ref.trim() });
        pushNote(x, r.employee_code, `${REQUEST_TYPES[r.type].label} ${id}: ₹${fmtNum(amount)} ${r.status === "Paid" ? "reimbursed" : "disbursed"} (${ref.trim()}).`, linkFor(r));
        pushAudit(x, session.code, session.role, r.status === "Paid" ? "EXPENSE_PAID" : "DISBURSED", `${id} · ₹${amount} · ${ref.trim()}`);
        return { ok: true };
      }),
    [session, mutate],
  );

  // ── ADMIN: points decisions ──────────────────────────
  const openForReview = useCallback(
    (id) => {
      const s0 = dataRef.current.submissions.find((i) => i.submission_id === id);
      if (!s0 || !(s0.status === "Manager Approved" || (s0.status === "Submitted" && s0.stage === "admin"))) return;
      mutate((x) => {
        const s = x.submissions.find((i) => i.submission_id === id);
        s.status = "Under Review";
        s.history.push({ status: "Under Review", at: nowIso(), by: session.code, note: "" });
        pushNote(x, s.employee_code, `${id} is now under review by HR.`, "/points/claims");
        pushAudit(x, session.code, session.role, "REVIEW_OPEN", id);
      });
    },
    [session, mutate],
  );

  function applyDecision(x, s, { decision, approved_points, rejection_reason, admin_remarks }, by, role) {
    const now = nowIso();
    const rule = x.rules.find((r) => r.rule_id === s.rule_id);
    const adminStep = s.steps?.find((st) => st.level === "admin");
    if (decision === "Approve") {
      const pts = Number(approved_points);
      if (!Number.isInteger(pts) || pts < 1) return { ok: false, error: "Approved points must be a whole number of 1 or more." };
      if (pts > rule.points) return { ok: false, error: `Approved points cannot exceed the rule maximum (${rule.points}).` };
      Object.assign(s, { admin_decision: "Approve", approved_points: pts, rejection_reason: "", admin_remarks: admin_remarks || "", approval_timestamp: now, approver_admin_code: by, status: "Approved", stage: null });
      if (adminStep) Object.assign(adminStep, { status: "approved", at: now, approver: by, note: admin_remarks || "" });
      s.history.push({ status: "Approved", at: now, by, note: admin_remarks || (pts !== Number(s.points_requested) ? `Approved ${pts} of ${s.points_requested}` : "") });
      if (x.settings.auto_credit_on_approval) {
        x.ledger.unshift({ entry_id: nextSeq(x.ledger, "LED-", "entry_id"), employee_code: s.employee_code, type: "credit", points: pts, ref: s.submission_id, note: "Approved claim", at: now });
        s.status = "Credited";
        s.history.push({ status: "Credited", at: now, by: "SYSTEM", note: `${pts} points credited` });
        pushNote(x, s.employee_code, `${s.submission_id} approved: ${pts} points credited${pts !== Number(s.points_requested) ? ` (you asked for ${s.points_requested})` : ""}.`, "/points/ledger");
      }
      pushAudit(x, by, role, "APPROVE", `${s.submission_id} · ${pts} of ${s.points_requested} pts${admin_remarks ? ` · ${admin_remarks}` : ""}`);
    } else if (decision === "Reject") {
      if (!(rejection_reason || "").trim()) return { ok: false, error: "A rejection reason is required." };
      Object.assign(s, { admin_decision: "Reject", approved_points: 0, rejection_reason: rejection_reason.trim(), admin_remarks: admin_remarks || "", approval_timestamp: now, approver_admin_code: by, status: "Rejected", stage: null });
      if (adminStep) Object.assign(adminStep, { status: "rejected", at: now, approver: by, note: rejection_reason.trim() });
      s.history.push({ status: "Rejected", at: now, by, note: rejection_reason.trim() });
      pushNote(x, s.employee_code, `${s.submission_id} was rejected: ${rejection_reason.trim()}`, "/points/claims");
      pushAudit(x, by, role, "REJECT", `${s.submission_id} · ${rejection_reason.trim()}`);
    } else if (decision === "Hold") {
      if (!(admin_remarks || "").trim()) return { ok: false, error: "Add a remark telling the employee what is needed." };
      Object.assign(s, { admin_decision: "Hold", admin_remarks: admin_remarks.trim(), status: "On Hold" });
      s.history.push({ status: "On Hold", at: now, by, note: admin_remarks.trim() });
      pushNote(x, s.employee_code, `${s.submission_id} is on hold: ${admin_remarks.trim()}`, "/points/claims");
      pushAudit(x, by, role, "HOLD", `${s.submission_id} · ${admin_remarks.trim()}`);
    }
    return { ok: true };
  }

  const decide = useCallback(
    (id, payload) =>
      mutate((x) => {
        const s = x.submissions.find((i) => i.submission_id === id);
        if (!s || !OPEN_STATUSES.includes(s.status) || s.stage === "manager") return { ok: false, error: "This claim is not open for an admin decision." };
        if (s.status !== "Under Review") s.history.push({ status: "Under Review", at: nowIso(), by: session.code, note: "" });
        return applyDecision(x, s, payload, session.code, session.role);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, mutate],
  );

  const bulkDecide = useCallback(
    (ids, decision, reason = "") =>
      mutate((x) => {
        let done = 0;
        const skipped = [];
        ids.forEach((id) => {
          const s = x.submissions.find((i) => i.submission_id === id);
          if (!s || !OPEN_STATUSES.includes(s.status) || s.status === "Escalated" || s.stage === "manager") return skipped.push(id);
          if (decision === "Approve" && (s.flagged || s.flags?.some((f) => f.level === "warn"))) return skipped.push(id);
          const r = applyDecision(x, s, { decision, approved_points: s.points_requested, rejection_reason: reason, admin_remarks: decision === "Approve" ? "Bulk approved" : "" }, session.code, session.role);
          if (r.ok) done += 1;
          else skipped.push(id);
        });
        return { ok: true, done, skipped };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, mutate],
  );

  const escalate = useCallback(
    (id, note) =>
      mutate((x) => {
        if (!note.trim()) return { ok: false, error: "Say why you are escalating." };
        const s = x.submissions.find((i) => i.submission_id === id);
        const now = nowIso();
        s.status = "Escalated";
        s.escalation = { by: session.code, at: now, note: note.trim() };
        s.history.push({ status: "Escalated", at: now, by: session.code, note: note.trim() });
        x.superAdmins.forEach((sa) => pushNote(x, sa.superadmin_code, `${id} escalated by ${session.code}: ${note.trim()}`, "/requests"));
        pushAudit(x, session.code, session.role, "ESCALATE", `${id} · ${note.trim()}`);
        return { ok: true };
      }),
    [session, mutate],
  );
  const setFlag = useCallback(
    (id, reason) =>
      mutate((x) => {
        const s = x.submissions.find((i) => i.submission_id === id);
        s.flagged = reason ? { by: session.code, at: nowIso(), reason } : null;
        pushAudit(x, session.code, session.role, reason ? "FLAG" : "UNFLAG", `${id}${reason ? ` · ${reason}` : ""}`);
        if (reason) x.superAdmins.forEach((sa) => pushNote(x, sa.superadmin_code, `${id} was flagged as suspicious by ${session.code}.`, "/reports"));
        return { ok: true };
      }),
    [session, mutate],
  );
  const reassign = useCallback(
    (id, adminCode, note) =>
      mutate((x) => {
        const s = x.submissions.find((i) => i.submission_id === id);
        const from = s.assigned_admin;
        s.assigned_admin = adminCode;
        const st = s.steps?.find((t) => t.level === "admin");
        if (st) st.approver = adminCode;
        s.history.push({ status: s.status, at: nowIso(), by: session.code, note: `Reassigned from ${from || "—"} to ${adminCode}${note ? `: ${note}` : ""}` });
        pushNote(x, adminCode, `${id} was reassigned to you by ${session.code}.`, "/approvals");
        pushAudit(x, session.code, session.role, "REASSIGN", `${id} · ${from || "—"} → ${adminCode}`);
        return { ok: true };
      }),
    [session, mutate],
  );

  const decideAccount = useCallback(
    (empCode, approve, note = "") =>
      mutate((x) => {
        const e = x.employees.find((i) => i.employee_code === empCode);
        if (e.status !== "pending_approval") return { ok: false, error: "This account is not waiting for approval." };
        e.status = approve ? "active" : "rejected";
        e.account_decided_by = session.code;
        e.account_decided_at = nowIso();
        pushAudit(x, session.code, session.role, approve ? "ACCOUNT_APPROVE" : "ACCOUNT_REJECT", `${empCode}${note ? ` · ${note}` : ""}`);
        if (approve) pushNote(x, empCode, "Your account is active. Sign in with your temporary password; you will be asked to set a new one.", "/home");
        return { ok: true };
      }),
    [session, mutate],
  );

  // ── EMPLOYEES (master) ───────────────────────────────
  const upsertEmployee = useCallback(
    (rec) => {
      const d = dataRef.current;
      const role = session.role === "superadmin" ? "super" : session.role === "admin" ? "admin" : "self";
      const isNew = !rec.employee_code;
      const code = isNew ? nextSeq(d.employees, "EMP", "employee_code", 3) : rec.employee_code;
      const base = isNew ? {} : d.employees.find((e) => e.employee_code === code);
      const merged = { ...base, ...rec, employee_code: code, login_id: (rec.login_id || rec.email || "").trim().toLowerCase() };
      merged.worker_type = workerTypeOf(merged);
      // Company follows the location; new staff default to the location chosen in the header, else their country's office.
      if (!merged.location_id && isNew && entityScope.location !== ALL) merged.location_id = entityScope.location;
      const loc = (d.workLocations || []).find((l) => l.location_id === merged.location_id);
      if (loc) merged.company_id = loc.company_id;
      else if (d.workLocations?.length) Object.assign(merged, defaultEntityFor(merged, d.workLocations));
      // v10.3: country (and so currency, tax engine and payslip) is frozen to the work location's country.
      const fixedLoc = (d.workLocations || []).find((l) => l.location_id === merged.location_id);
      if (fixedLoc && d.settings.lock_country_to_location !== false && merged.country_code !== fixedLoc.country) {
        merged.country_code = fixedLoc.country;
        if (!(REGIONS[fixedLoc.country] || []).some(([r]) => r === merged.region)) merged.region = "";
      }
      if (!merged.preferred_language) merged.preferred_language = d.settings.default_language || "English";
      // Contingent workers: monthly gross is the monthly equivalent of the contract rate, so CTC, budgets and analytics stay right.
      if (isContingent(merged)) merged.monthly_gross = monthlyEquivalent(merged);
      const errors = validateEmployee(merged, { role: role === "admin" ? "super" : role, employees: d.employees });
      // v10.15: required dropdowns the Super Admin created
      customFieldsActive(d).forEach((c) => { if (c.required && !String(merged[c.key] ?? "").trim()) errors[c.key] = `${c.label} is required.`; });
      if (Object.keys(errors).length) return { ok: false, errors };
      return mutate((x) => {
        if (isNew) {
          x.employees.push({ ...merged, status: "pending_approval", must_reset: true, failed_attempts: 0, password_hash: "c75f28325cfa028ea13872f977a29e0e87c99a4f390fe260f24d7e1f05fb8d75", last_login: null, hr_synced_at: nowIso(), profile_photo: null });
          const adm = adminFor(x, merged.department, "accounts");
          pushNote(x, adm, `New employee ${merged.full_name} (${code}) is waiting for account approval.`, "/approvals");
          pushAudit(x, session.code, session.role, "EMPLOYEE_CREATE", `${code} · ${merged.full_name} · ${merged.department}`);
        } else {
          const e = x.employees.find((i) => i.employee_code === code);
          const changed = Object.keys(rec).filter((k) => JSON.stringify(e[k]) !== JSON.stringify(merged[k]));
          Object.assign(e, merged);
          pushAudit(x, session.code, session.role, "EMPLOYEE_UPDATE", `${code} · ${changed.join(", ") || "no changes"}`);
        }
        return { ok: true, code };
      });
    },
    [session, mutate, entityScope],
  );
  const removeEmployee = useCallback(
    (code) =>
      mutate((x) => {
        const e = x.employees.find((i) => i.employee_code === code);
        if (!e) return { ok: false };
        if (x.employees.some((i) => i.reporting_manager === code && i.status === "active")) return { ok: false, error: `${e.full_name} still has direct reports. Move them to another manager first.` };
        e.status = "rejected";
        e.exited_at = nowIso();
        x.employees = x.employees.filter((i) => i.employee_code !== code);
        pushAudit(x, session.code, session.role, "EMPLOYEE_REMOVE", `${code} · ${e.full_name}`);
        return { ok: true };
      }),
    [session, mutate],
  );

  const updateProfile = useCallback(
    (patch) => {
      const d = dataRef.current;
      const me = d.employees.find((i) => i.employee_code === session.code);
      const errors = validateEmployee({ ...me, ...patch }, { role: "self" });
      Object.keys(errors).forEach((k) => {
        if (!(k in patch)) delete errors[k];
      });
      if (Object.keys(errors).length) return { ok: false, errors };
      return mutate((x) => {
        const e = x.employees.find((i) => i.employee_code === session.code);
        const changed = Object.keys(patch).filter((k) => e[k] !== patch[k]);
        Object.assign(e, patch);
        pushAudit(x, e.employee_code, "emp", "PROFILE_UPDATE", `Changed: ${changed.join(", ") || "nothing"}`);
        return { ok: true };
      });
    },
    [session, mutate],
  );

  const changePassword = useCallback(
    async (current, next) => {
      if (srv) { try { await serverPost("/auth/change-password", { current, next }); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } }
      const rec = listFor(dataRef.current, session.role).find((r) => codeOf(session.role, r) === session.code);
      if ((await sha256(current)) !== rec.password_hash) return { ok: false, error: "Your current password is not right." };
      const h = await sha256(next);
      if (h === rec.password_hash) return { ok: false, error: "Choose a different password." };
      mutate((x) => {
        const r = listFor(x, session.role).find((u) => codeOf(session.role, u) === session.code);
        r.password_hash = h;
        r.password_changed_at = nowIso();
        pushAudit(x, session.code, session.role, "PASSWORD_CHANGE", "Password changed");
      });
      return { ok: true };
    },
    [session, mutate],
  );

  // ── SUPER ADMIN ──────────────────────────────────────
  const override = useCallback(
    (id, { decision, approved_points, note }) =>
      mutate((x) => {
        if (!(note || "").trim()) return { ok: false, error: "An audit note is required for overrides." };
        const s = x.submissions.find((i) => i.submission_id === id);
        const prevCredited = x.ledger.filter((l) => l.ref === s.submission_id).reduce((a, l) => a + l.points, 0);
        const now = nowIso();
        const rule = x.rules.find((r) => r.rule_id === s.rule_id);
        let newCredit = 0;
        if (decision === "Approve") {
          newCredit = Number(approved_points);
          if (!Number.isInteger(newCredit) || newCredit < 1 || newCredit > rule.points) return { ok: false, error: `Points must be 1 to ${rule.points}.` };
        }
        const diff = newCredit - prevCredited;
        if (diff !== 0) x.ledger.unshift({ entry_id: nextSeq(x.ledger, "LED-", "entry_id"), employee_code: s.employee_code, type: "adjust", points: diff, ref: s.submission_id, note: `Super Admin override: ${note.trim()}`, at: now });
        Object.assign(s, { status: decision === "Approve" ? "Credited" : "Rejected", stage: null, admin_decision: decision, approved_points: decision === "Approve" ? newCredit : 0, rejection_reason: decision === "Reject" ? note.trim() : "", approval_timestamp: now, approver_admin_code: session.code, override: { by: session.code, at: now, note: note.trim(), previous_status: s.status } });
        s.history.push({ status: decision === "Approve" ? "Approved" : "Rejected", at: now, by: session.code, note: `Override: ${note.trim()}` });
        if (decision === "Approve") s.history.push({ status: "Credited", at: now, by: "SYSTEM", note: `${newCredit} points credited` });
        pushNote(x, s.employee_code, `${id} was ${decision === "Approve" ? `approved for ${newCredit} points` : "rejected"} by a Super Admin: ${note.trim()}`, "/points/claims");
        pushAudit(x, session.code, "superadmin", "OVERRIDE", `${id} · ${decision}${decision === "Approve" ? ` ${newCredit} pts` : ""} · ${note.trim()}`);
        return { ok: true };
      }),
    [session, mutate],
  );

  const overrideRequest = useCallback(
    (id, { approve, note }) =>
      mutate((x) => {
        if (!(note || "").trim()) return { ok: false, error: "An audit note is required for overrides." };
        const r = x.requests.find((i) => i.request_id === id);
        const now = nowIso();
        const prev = r.status;
        r.status = approve ? "Approved" : "Rejected";
        r.stage = null;
        r.override = { by: session.code, at: now, note: note.trim(), previous_status: prev };
        r.history.push({ status: r.status, at: now, by: session.code, note: `Override: ${note.trim()}` });
        pushNote(x, r.employee_code, `${REQUEST_TYPES[r.type].label} ${id} was ${approve ? "approved" : "rejected"} by a Super Admin: ${note.trim()}`, linkFor(r));
        pushAudit(x, session.code, "superadmin", "OVERRIDE", `${id} · ${prev} → ${r.status} · ${note.trim()}`);
        return { ok: true };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, mutate],
  );

  const upsertAdmin = useCallback(
    async (rec, tempPassword) => {
      const hash = tempPassword ? await sha256(tempPassword) : null;
      return mutate((x) => {
        const id = rec.login_id.trim().toLowerCase();
        if (x.admins.some((a) => a.login_id.toLowerCase() === id && a.admin_code !== rec.admin_code)) return { ok: false, error: "Another admin already uses that login ID." };
        const existing = x.admins.find((a) => a.admin_code === rec.admin_code);
        if (existing) {
          Object.assign(existing, { full_name: rec.full_name, email: rec.email, login_id: id, org_units: rec.org_units, permissions_scope: rec.permissions_scope, modules: rec.modules, access_profile: rec.access_profile || "", locale_access: !!rec.locale_access, employee_code: rec.employee_code || "" });
          pushAudit(x, session.code, "superadmin", "ADMIN_UPDATE", `${rec.admin_code} · scope ${rec.org_units.join(", ")} · modules ${rec.modules.join(", ")}`);
          const moved = rerouteSteps(x);
          return { ok: true, chains: chainsFor(x, existing), moved };
        }
        const code = nextSeq(x.admins, "ADM", "admin_code", 2);
        x.admins.push({ ...rec, admin_code: code, login_id: id, mfa_status: "pending_setup", status: "active", failed_attempts: 0, must_reset: true, password_hash: hash, last_login: null, created_at: nowIso() });
        pushAudit(x, session.code, "superadmin", "ADMIN_CREATE", `${code} · ${rec.full_name} · modules ${rec.modules.join(", ")}`);
        const adm = x.admins[x.admins.length - 1];
        const chains = chainsFor(x, adm);
        const moved = rerouteSteps(x);
        if (chains.length) pushAudit(x, session.code, "superadmin", "WORKFLOW_AUTO", `${code} added as approver: ${chains.join("; ")}${moved.length ? ` · took over ${moved.join(", ")}` : ""}`);
        return { ok: true, code, chains, moved };
      });
    },
    [session, mutate],
  );
  const setUserStatus = useCallback(
    (role, code, status) =>
      mutate((x) => {
        const r = listFor(x, role).find((u) => codeOf(role, u) === code);
        const prev = r.status;
        r.status = status;
        if (status === "active") r.failed_attempts = 0;
        pushAudit(x, session.code, "superadmin", status === "active" && prev === "locked" ? "ACCOUNT_UNLOCK" : "STATUS_OVERRIDE", `${code}: ${prev} → ${status}`);
        const moved = role === "admin" ? rerouteSteps(x) : [];
        return { ok: true, moved };
      }),
    [session, mutate],
  );
  const forceReset = useCallback(
    async (role, code) => {
      if (srv) { try { await serverPost("/admin/users/force-reset", { role, code }); } catch (e) { return { ok: false, error: e.message }; } }
      const hash = await sha256("Welcome@123");
      return mutate((x) => {
        const r = listFor(x, role).find((u) => codeOf(role, u) === code);
        Object.assign(r, { must_reset: true, password_hash: hash, failed_attempts: 0, has_login: true });
        if (r.status === "locked") r.status = "active";
        pushAudit(x, session.code, "superadmin", "FORCE_RESET", `${code} must set a new password at next sign-in`);
        return { ok: true };
      });
    },
    [session, mutate],
  );
  const resetMfa = useCallback(
    (code) =>
      mutate((x) => {
        x.admins.find((i) => i.admin_code === code).mfa_status = "pending_setup";
        pushAudit(x, session.code, "superadmin", "MFA_RESET", `${code} must re-enrol MFA`);
        return { ok: true };
      }),
    [session, mutate],
  );
  const hrSync = useCallback(
    () =>
      mutate((x) => {
        // the sample HR feed belongs to the demo company only; a real company's HR connector fills this
        const added = (x.fresh_company ? [] : HR_FEED).filter((e) => !x.employees.some((i) => i.employee_code === e.employee_code)).map((e) => ({ ...clone(e), hr_synced_at: nowIso() }));
        x.employees.push(...added);
        x.employees.forEach((e) => {
          e.hr_synced_at = nowIso();
        });
        added.forEach((e) => pushNote(x, adminFor(x, e.department, "accounts"), `New employee ${e.full_name} (${e.employee_code}) is waiting for account approval.`, "/approvals"));
        pushAudit(x, session?.code || "SYSTEM", session?.role || "system", "HR_SYNC", `${x.employees.length} records checked; ${added.length} new (pending approval)`);
        return { ok: true, added: added.length };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, mutate],
  );
  const upsertCategory = useCallback(
    (c) =>
      mutate((x) => {
        const ex = x.categories.find((i) => i.category_id === c.category_id);
        if (ex) Object.assign(ex, c);
        else x.categories.push({ ...c, category_id: `CAT-${c.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()}${x.categories.length + 1}` });
        pushAudit(x, session.code, "superadmin", "CONFIG_CHANGE", `Category ${c.category_id || c.name}: max ${c.max_points}`);
        return { ok: true };
      }),
    [session, mutate],
  );
  const upsertRule = useCallback(
    (r) =>
      mutate((x) => {
        const cat = x.categories.find((c) => c.category_id === r.category);
        if (Number(r.points) > cat.max_points) return { ok: false, error: `Points cannot exceed the category maximum (${cat.max_points}).` };
        const ex = x.rules.find((i) => i.rule_id === r.rule_id);
        const clean = { ...r, points: Number(r.points), validity_days: Number(r.validity_days) };
        if (ex) Object.assign(ex, clean);
        else x.rules.push({ ...clean, rule_id: nextSeq(x.rules, "RULE-", "rule_id", 2) });
        pushAudit(x, session.code, "superadmin", "CONFIG_CHANGE", `Rule ${r.rule_id || "new"} · ${r.sub_category}: ${r.points} pts, ${r.validity_days} days`);
        return { ok: true };
      }),
    [session, mutate],
  );
  const updateMaster = useCallback(
    (key, list) =>
      mutate((x) => {
        x[key] = list;
        pushAudit(x, session.code, "superadmin", "CONFIG_CHANGE", `${key} updated (${list.length} rows)`);
        return { ok: true };
      }),
    [session, mutate],
  );
  const updateSettings = useCallback(
    (patch) =>
      mutate((x) => {
        const changes = Object.keys(patch).filter((k) => JSON.stringify(x.settings[k]) !== JSON.stringify(patch[k])).map((k) => `${k}: ${JSON.stringify(x.settings[k])} → ${JSON.stringify(patch[k])}`);
        Object.assign(x.settings, patch);
        if (changes.length) pushAudit(x, session.code, "superadmin", "CONFIG_CHANGE", changes.join("; "));
        return { ok: true, changed: changes.length };
      }),
    [session, mutate],
  );
  // v10.13: grow a dropdown list (+). Super Admin: any list. Admin: lists for their modules. Values are audited.
  const addListOption = useCallback(
    (key, raw, base) =>
      mutate((x) => {
        const me = { role: session.role, code: session.code };
        if (!canEditList(me, x, key)) return { ok: false, error: "Only the Super Admin or the admin who looks after this list can add to it." };
        const c = checkNewOption(x, key, raw, base);
        if (c.error) return { ok: false, error: c.error };
        x.settings.custom_options = { ...(x.settings.custom_options || {}) };
        x.settings.custom_options[key] = [...(x.settings.custom_options[key] || []), c.value];
        pushAudit(x, session.code, session.role, "LIST_OPTION_ADD", `${listDef(key, x).label}: + ${c.value}`);
        return { ok: true, value: c.value };
      }),
    [session, mutate],
  );
  const removeListOption = useCallback(
    (key, value) =>
      mutate((x) => {
        if (!canEditList({ role: session.role, code: session.code }, x, key)) return { ok: false, error: "You can't change this list." };
        const cur = x.settings.custom_options?.[key] || [];
        if (!cur.includes(value)) return { ok: false, error: "Built-in values can't be removed." };
        x.settings.custom_options = { ...x.settings.custom_options, [key]: cur.filter((v) => v !== value) };
        pushAudit(x, session.code, session.role, "LIST_OPTION_REMOVE", `${listDef(key, x).label}: − ${value}`);
        return { ok: true };
      }),
    [session, mutate],
  );
  // v10.15: the Super Admin creates new dropdowns (custom employee fields); never deleted, only switched off/on.
  const createCustomField = useCallback(
    (draft) =>
      mutate((x) => {
        if (session.role !== "superadmin") return { ok: false, error: "Only the Super Admin can create dropdowns." };
        const c = checkCustomField(x, draft);
        if (c.error) return { ok: false, error: c.error };
        x.settings.custom_fields = [...(x.settings.custom_fields || []), { ...c.field, created_by: session.code, created_at: new Date().toISOString() }];
        pushAudit(x, session.code, session.role, "CUSTOM_FIELD_CREATE", `${c.field.label} (${c.field.key}) · ${c.field.options.length} values · ${c.field.section}${c.field.required ? " · required" : ""}`);
        return { ok: true, key: c.field.key, label: c.field.label };
      }),
    [session, mutate],
  );
  const setCustomFieldActive = useCallback(
    (key, active) =>
      mutate((x) => {
        if (session.role !== "superadmin") return { ok: false, error: "Only the Super Admin can change dropdowns." };
        const list = x.settings.custom_fields || [];
        const f = list.find((c) => c.key === key);
        if (!f) return { ok: false, error: "Dropdown not found." };
        x.settings.custom_fields = list.map((c) => (c.key === key ? { ...c, active } : c));
        pushAudit(x, session.code, session.role, active ? "CUSTOM_FIELD_ON" : "CUSTOM_FIELD_OFF", `${f.label} (${key})`);
        return { ok: true };
      }),
    [session, mutate],
  );
  const adjustPoints = useCallback(
    (empCode, points, note) =>
      mutate((x) => {
        const p = Number(points);
        if (!Number.isInteger(p) || p === 0) return { ok: false, error: "Enter a non-zero whole number." };
        if (!note.trim()) return { ok: false, error: "An audit note is required." };
        x.ledger.unshift({ entry_id: nextSeq(x.ledger, "LED-", "entry_id"), employee_code: empCode, type: "adjust", points: p, ref: "MANUAL", note: note.trim(), at: nowIso() });
        pushNote(x, empCode, `${p > 0 ? "+" : ""}${p} points adjusted by a Super Admin: ${note.trim()}`, "/points/ledger");
        pushAudit(x, session.code, "superadmin", "POINTS_ADJUST", `${empCode} · ${p} · ${note.trim()}`);
        return { ok: true };
      }),
    [session, mutate],
  );

  const markRead = useCallback((id) => mutate((x) => { const n = x.notifications.find((i) => i.id === id); if (n) n.read = true; }), [mutate]);
  const markAllRead = useCallback(() => mutate((x) => x.notifications.forEach((n) => { if (n.to === session?.code) n.read = true; })), [session, mutate]);
  const resetDemo = useCallback(() => {
    const fresh = { ...clone(buildSeed()), v109: true };
    dataRef.current = fresh;
    setData(fresh);
    setSession(null);
    setPending(null);
    try {
      localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ops = useMemo(() => makeOpsActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }), [mutate]);
  const offerOps = useMemo(() => makeOfferActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }), [mutate]);
  const payslipOps = useMemo(() => makePayslipActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }), [mutate]);
  const docOps = useMemo(() => makeDocActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }), [mutate]);
  const bulkOps = useMemo(() => makeBulkActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }), [mutate]); // eslint-disable-line react-hooks/exhaustive-deps
  const fileOps = useMemo(() => makeFileActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }), [mutate]); // eslint-disable-line react-hooks/exhaustive-deps
  const itOps = useMemo(() => makeItActions({ mutate, dataRef, sessionRef, pushAudit, pushNote, activeManager, adminFor }), [mutate]);
  const collabOps = useMemo(() => makeCollabActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }), [mutate]);
  const payrollSuiteOps = useMemo(() => makePayrollSuiteActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }), [mutate]);
  const suiteOps = useMemo(() => makeSuiteActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }), [mutate]);
  const contractOps = useMemo(() => makeContractActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }), [mutate]);
  const designOps = useMemo(() => makePayslipDesignActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }), [mutate]);
  const entityOps = useMemo(() => makeEntityActions({ mutate, dataRef, sessionRef, pushAudit, pushNote, adminFor }), [mutate]); // eslint-disable-line react-hooks/exhaustive-deps
  const statutoryOps = useMemo(() => makeStatutoryActions({ mutate, dataRef, sessionRef, pushAudit }), [mutate]); // eslint-disable-line react-hooks/exhaustive-deps
  const automationOps = useMemo(() => makeAutomationActions({ mutate, dataRef, sessionRef, pushAudit, pushNote, adminFor }), [mutate]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    ...ops,
    ...payslipOps,
    ...offerOps,
    ...collabOps,
    ...itOps,
    ...docOps,
    ...fileOps,
    ...bulkOps,
    ...payrollSuiteOps,
    ...suiteOps,
    ...contractOps,
    ...designOps,
    ...entityOps,
    ...statutoryOps,
    ...automationOps,
    // `data` is narrowed to the company / location chosen in the header; `allData` is everything.
    data: scopedData, allData: data, entityScope, setEntityScope, entityAccess, scopeIds,
    session, user, pending, toast, setToast, notifyToast, logoutReason, rememberedLogin, fingerprint: fp, device, ...helpers,
    beginLogin, resendOtp, verifyMfa, completeReset, cancelPending, logout, touch, switchWorkspace, setAccountAccess,
    saveSubmission, withdrawSubmission, deleteDraft, managerDecidePoints, redeem,
    createRequest, cancelRequest, decideRequest, bulkDecideRequests, payoutRequest,
    openForReview, decide, bulkDecide, escalate, setFlag, reassign, decideAccount,
    upsertEmployee, removeEmployee, updateProfile, changePassword,
    override, overrideRequest, upsertAdmin, setUserStatus, forceReset, resetMfa, hrSync, upsertCategory, upsertRule, updateMaster, updateSettings, addListOption, createCustomField, setCustomFieldActive, removeListOption, adjustPoints,
    markRead, markAllRead, resetDemo,
    // v10.8: server mode details (null in the browser-only demo)
    server: srv ? { on: true, tenant: getTenant(), demo: isDemoTenant(), meta: data.__server || null, reload: loadFromServer, flush: () => engineRef.current?.flush() } : null,
  };
  if (srv && session && !bootReady) return <ServerLoading />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
function ServerLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center",  color: "#15414F", background: "#f3f6f7" }}>
      <div style={{ textAlign: "center" }}><div style={{ fontWeight: 800, fontSize: 18 }}>Loading your workspace…</div><div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>Getting the latest data from the EZY HR server</div></div>
    </div>
  );
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside AppStoreProvider");
  return v;
}
