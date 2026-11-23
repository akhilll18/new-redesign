// v10.3: AI automation engine actions. runAutomation() is called by <AutomationRunner/> on sign-in and every few minutes;
// it applies "auto" proposals straight away and queues "review" ones. People decide queued items with one tap.
import { scanAutomation, RULE_BY, ruleConfig, canManageRule, automationVisible } from "../lib/automation.js";
import { nowIso } from "../lib/utils.js";

const err = (error) => ({ ok: false, error });
const KEEP_DONE = 2000;
const KEEP_LOG = 600;

export function makeAutomationActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;
  const me = () => {
    const s = S();
    if (!s) return null;
    if (s.role === "admin") return { ...D().admins.find((a) => a.admin_code === s.code), role: "admin" };
    return { role: s.role, code: s.code };
  };
  const ensure = (x) => { x.automation ||= { rules: {}, queue: [], log: [], done: [], last_run: null, paused: false }; ["queue", "log", "done"].forEach((k) => { x.automation[k] ||= []; }); x.automation.rules ||= {}; return x.automation; };
  const log = (a, p, text, by = "AI") => { a.log.unshift({ id: `AL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, at: nowIso(), rule: p.rule, text, by, ref: p.id }); a.log.length = Math.min(a.log.length, KEEP_LOG); };

  // Apply one proposal to the draft. Returns a short text for the log, or null when nothing could be done.
  function apply(x, p, by = "AI") {
    if (p.kind === "notify") {
      [...new Set(p.to || [])].forEach((to) => pushNote(x, to, `🤖 ${p.text || p.title}`, p.link));
      return `${p.title} → notified ${[...new Set(p.to || [])].length}`;
    }
    if (p.kind === "fix_country") {
      const e = x.employees.find((y) => y.employee_code === p.employee_code);
      if (!e || e.country_code === p.country) return null;
      e.country_code = p.country;
      e.region = "";
      pushAudit(x, "SYSTEM", "system", "AI_COUNTRY_ALIGN", `${e.employee_code} → ${p.country} (follows location)`);
      return p.title;
    }
    if (p.kind === "approve_request") {
      const r = x.requests.find((y) => y.request_id === p.ref);
      if (!r || r.status !== "Pending") return null;
      const now = nowIso();
      const note = by === "AI" ? `Auto-approved by AI rule “${RULE_BY[p.rule]?.label}”` : `Approved from the AI review queue by ${by}`;
      r.steps = r.steps.map((st) => (["pending", "waiting"].includes(st.status) ? { ...st, status: "approved", at: now, note, by_ai: true } : st));
      r.status = "Approved";
      r.stage = null;
      r.ai_approved = { rule: p.rule, at: now, by };
      r.history.push({ status: "Approved", at: now, by: by === "AI" ? "SYSTEM" : by, note });
      pushNote(x, r.employee_code, `${r.request_id} was approved (${note.toLowerCase()}).`, r.type === "leave" ? "/leave" : "/expenses");
      r.steps.filter((st) => st.approver).forEach((st) => pushNote(x, st.approver, `🤖 ${r.request_id} from ${x.employees.find((e) => e.employee_code === r.employee_code)?.full_name} was approved within policy (${RULE_BY[p.rule]?.label}). No action needed.`, "/approvals"));
      pushAudit(x, by === "AI" ? "SYSTEM" : by, by === "AI" ? "system" : S()?.role || "system", `AI_${r.type.toUpperCase()}_APPROVE`, `${r.request_id} · ${RULE_BY[p.rule]?.label}`);
      return p.title;
    }
    return null;
  }

  function runAutomation({ manual = false } = {}) {
    const proposals = scanAutomation(D());
    if (!proposals.length) {
      if (manual) mutate((x) => { ensure(x).last_run = nowIso(); });
      return { ok: true, auto: 0, queued: 0 };
    }
    return mutate((x) => {
      const a = ensure(x);
      let auto = 0, queued = 0;
      proposals.forEach((p) => {
        if (p.mode === "auto") {
          const t = apply(x, p);
          if (t) { log(a, p, t); auto += 1; }
          a.done.push(p.id);
        } else if (p.mode === "review") {
          a.queue.unshift({ ...p, status: "review", at: nowIso() });
          queued += 1;
        }
      });
      a.done = a.done.slice(-KEEP_DONE);
      a.queue = a.queue.slice(0, 400);
      a.last_run = nowIso();
      if (auto || queued) pushAudit(x, "SYSTEM", "system", "AI_AUTOMATION_RUN", `${auto} done automatically · ${queued} queued for review`);
      return { ok: true, auto, queued };
    });
  }

  function decideAutomation(id, approve) {
    const u = me();
    const item = (D().automation?.queue || []).find((q) => q.id === id);
    if (!item) return err("This item is no longer in the queue.");
    if (!automationVisible(item, u) || !canManageRule(RULE_BY[item.rule], u)) return err("This rule belongs to another module.");
    return mutate((x) => {
      const a = ensure(x);
      const q = a.queue.find((y) => y.id === id);
      let text = null;
      if (approve) text = apply(x, q, S().code);
      q.status = approve ? (text ? "done" : "stale") : "dismissed";
      q.decided_by = S().code;
      q.decided_at = nowIso();
      a.done.push(q.id);
      log(a, q, approve ? (text ? `${q.title} (approved by ${S().code})` : `${q.title} — already handled`) : `${q.title} — dismissed by ${S().code}`, S().code);
      return { ok: true, stale: approve && !text };
    });
  }

  function setAutomationRule(id, patch) {
    const r = RULE_BY[id];
    if (!r) return err("Unknown rule.");
    if (!canManageRule(r, me())) return err("Only admins who own this module (or the Super Admin) can change this rule.");
    return mutate((x) => {
      const a = ensure(x);
      const cur = ruleConfig(x, id);
      a.rules[id] = { mode: patch.mode || cur.mode, params: { ...cur.params, ...(patch.params || {}) } };
      pushAudit(x, S().code, S().role, "AI_AUTOMATION_RULE", `${id} · mode ${a.rules[id].mode} · ${Object.entries(a.rules[id].params).map(([k, v]) => `${k}=${v}`).join(", ")}`);
      return { ok: true };
    });
  }

  function pauseAutomation(paused) {
    if (S()?.role !== "superadmin") return err("Only the Super Admin can pause all automation.");
    return mutate((x) => { ensure(x).paused = !!paused; pushAudit(x, S().code, S().role, "AI_AUTOMATION_PAUSE", paused ? "paused" : "resumed"); return { ok: true }; });
  }

  return { runAutomation, decideAutomation, setAutomationRule, pauseAutomation };
}
