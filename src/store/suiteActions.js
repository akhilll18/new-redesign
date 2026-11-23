// v10 suite actions. One guarded entry point, `suiteDo(area, recipe, opts)`, changes `data.suite`:
//  • Super Admins can do everything;
//  • admins can act in an area when they hold one of the modules listed for it (Finance = payroll / expense, HR = leave,
//    attendance, onboarding, …);
//  • employees can only act in self-service areas, and the recipe receives their own employee code.
// Every change is written to the audit log; an optional notification goes to the person concerned.
import { nowIso } from "../lib/utils.js";

const ADMIN_AREAS = {
  payroll: ["payroll"], payouts: ["payroll"], filings: ["payroll", "compliance"], variable: ["payroll"],
  cards: ["expense", "payroll"], integrations: ["payroll", "expense"],
  exits: ["accounts", "payroll", "onboarding", "leave"], shifts: ["attendance", "workforce"], leaveRules: ["leave"],
  relocation: ["onboarding", "accounts"], globalHires: ["contracts", "payroll", "recruitment"],
  compliance: ["compliance", "payroll"], privacy: ["compliance", "accounts"], xp: null, pulse: null, app: null,
  support: null, setup: [], billing: [], security: [],
  // v10.4: internal job postings, applications / position upgrades and relocation (internal & client sites)
  ijp: ["recruitment", "onboarding", "accounts"],
  // v10.5: EPFO and income-tax (TRACES) portal connections, Form 16 pulls, ECR filing — HR, Finance, Super Admin
  portals: ["payroll", "payslips", "accounts"],
  // v10.6: IT purchase approvals (stage checked in the screen), admin actions of the v10.6 review (rewards catalogue,
  // roster edits, manual learning marks, goals set by HR, generated letters, bank-change and learning requests).
  "it-purchase": null, admin106: null, "self106": null,
};
const EMP_AREAS = new Set(["xp", "pulse", "app", "exit-self", "relocation-self", "privacy-self", "swap", "card-self", "support", "ijp-self", "it-purchase", "self106"]);

export function makeSuiteActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;

  function allowed(area) {
    const s = S();
    if (!s) return false;
    if (s.role === "superadmin") return true;
    if (s.role === "emp") return EMP_AREAS.has(area);
    const mods = D().admins.find((a) => a.admin_code === s.code)?.modules || [];
    const need = ADMIN_AREAS[area];
    if (need === null) return true;
    if (EMP_AREAS.has(area)) return true;
    return !!need && need.some((m) => mods.includes(m));
  }

  function suiteCan(area) {
    return allowed(area);
  }

  function suiteDo(area, recipe, { action = "SUITE_UPDATE", details = area, note } = {}) {
    if (!allowed(area)) return { ok: false, error: "You don't have access to change this." };
    const s = S();
    const me = s.role === "emp" ? D().employees.find((e) => e.employee_code === s.code || e.login_id === s.code)?.employee_code || s.code : s.code;
    return mutate((x) => {
      if (!x.suite) x.suite = {};
      const r = recipe(x.suite, { x, me, role: s.role, code: s.code, now: nowIso() });
      if (r && r.ok === false) return r;
      pushAudit(x, s.code, s.role, action, typeof details === "function" ? details(r) : details);
      const n = typeof note === "function" ? note(r) : note;
      if (n?.to) [].concat(n.to).forEach((to) => pushNote(x, to, n.text, n.link));
      return { ok: true, ...(r || {}) };
    });
  }

  return { suiteDo, suiteCan };
}
