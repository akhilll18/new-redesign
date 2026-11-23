// v10.10 · EZY HR AI — from a sentence to an action.
//   planCommand(text, ctx)  → { action, values } or null (then the copilot answers in chat)
//   suggest(text, ctx)      → live suggestions while typing, letter by letter
// With Claude connected, Claude reads the sentence (all actions and their fields are described to it); the built-in
// reader fills anything Claude leaves out, and is used on its own when there is no AI key.
import { ACTIONS, ACTION_BY } from "./actions.js";
import { fuzzy, norm } from "./nlu.js";
import { aiGenerate } from "../../lib/ai/client.js";
import { resolveProvider } from "../../lib/ai/config.js";

export const allowedActions = (ctx) => ACTIONS.filter((a) => { try { return a.allowed(ctx); } catch { return false; } });

export function localPlan(text, ctx) {
  const t = String(text || "").trim();
  if (!t) return null;
  let best = null;
  for (const a of allowedActions(ctx)) {
    let s = 0;
    try { s = a.match(t, ctx) || 0; } catch { s = 0; }
    if (s > (best?.score || 0)) best = { a, score: s };
  }
  if (!best || best.score < 0.5) return null;
  let values = {};
  try { values = best.a.extract(t, ctx) || {}; } catch { values = {}; }
  return { action: best.a.id, values: withDefaults(best.a, values, ctx), score: best.score, by: "built-in" };
}

export function withDefaults(a, values, ctx) {
  const v = { ...values };
  let fields = [];
  try { fields = a.fields(v, ctx) || []; } catch { fields = []; }
  for (const f of fields) if ((v[f.key] === undefined || v[f.key] === "") && f.default !== undefined) v[f.key] = f.default;
  return v;
}

function schemaText(list) {
  return list.map((a) => `- ${a.id}: ${a.title}. e.g. "${a.example}"`).join("\n");
}
async function claudePlan(text, ctx, signal) {
  const list = allowedActions(ctx);
  const sample = (arr, f) => (arr || []).slice(0, 40).map(f).join(", ");
  const system = `You turn an HR user's request into ONE app action for EZY HR. Reply with JSON only, no prose:
{"action": "<action id or none>", "values": { … }}
Actions available to this user:
${schemaText(list)}
Field names per action: create_company{name,company_id,country(ISO-2),currency,registration,address} create_location{name,city,company_id,location_id,type} create_department{name,parent_unit} create_holiday{name,date(YYYY-MM-DD),type(holiday|optional)} create_leave_type{name,code,annual,carry_forward,min_notice_days} create_expense_category{name,code,limit,receipt_always} create_pay_component{label,code,section(earning|deduction|contribution|reimbursement|detail)} create_admin{full_name,email,access_profile(hr|finance|hr_finance|it),temp} create_employee{full_name,email,phone,designation,department,reporting_manager(employee code),date_of_joining,date_of_birth,monthly_gross(number, per month),location_id,worker_type(permanent|contract|intern|freelance|consultant|temporary|apprentice),gender} create_login{who("emp:CODE"|"admin:CODE")} update_employee{employee_code,field,value} create_job{role,dept,n,cost,hiring_manager} apply_leave{leave_type(code),from_date,to_date,reason} raise_ticket{subject,description,category,priority} decide_requests{decision(approve|reject),type,person,note} run_report{report(id),from,to} answer_count{dept,person} open_page{to}
Today is ${new Date().toISOString().slice(0, 10)}. Use only values you can read from the request (leave others out). If the request is a question or chat, use "none".
Known departments: ${sample(ctx.data.orgUnits, (o) => o.name || o.org_unit_id) || "none"}
Known companies: ${sample(ctx.data.companies, (c) => `${c.company_id}=${c.name}`) || "none"}
Known locations: ${sample(ctx.data.workLocations, (l) => `${l.location_id}=${l.name}`) || "none"}
Known people: ${sample(ctx.data.employees, (e) => `${e.employee_code}=${e.full_name}`) || "none"}
Leave types: ${sample(ctx.leaveTypes, (l) => `${l.code}=${l.name}`) || "none"}`;
  let out = "";
  await aiGenerate({ task: "chat", system, messages: [{ role: "user", content: text }], fast: true, maxTokens: 500, temperature: 0, signal, onText: (_, full) => { out = full; } });
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) return null;
  const j = JSON.parse(m[0]);
  if (!j.action || j.action === "none" || !ACTION_BY[j.action] || !list.some((a) => a.id === j.action)) return null;
  return j;
}

export async function planCommand(text, ctx, { signal } = {}) {
  const local = localPlan(text, ctx);
  let live = false;
  try { live = (await resolveProvider())?.provider !== "mock"; } catch { live = false; }
  if (!live) return local;
  try {
    const c = await claudePlan(text, ctx, signal);
    if (!c) return local && local.score >= 0.8 ? local : null;
    const a = ACTION_BY[c.action];
    const fromText = local?.action === c.action ? local.values : (() => { try { return a.extract(text, ctx) || {}; } catch { return {}; } })();
    const merged = { ...fromText };
    for (const [k, v] of Object.entries(c.values || {})) if (v !== null && v !== undefined && v !== "") merged[k] = v;
    return { action: c.action, values: withDefaults(a, merged, ctx), score: 0.95, by: "Claude" };
  } catch {
    return local;
  }
}

// As-you-type: what you are about to ask for, refreshed on every letter.
export function suggest(text, ctx, n = 4) {
  const t = String(text || "").trim();
  const list = allowedActions(ctx);
  if (!t) return list.filter((a) => a.kind !== "read" || a.id === "run_report").slice(0, n).map((a) => ({ id: a.id, title: a.title, example: a.example.split(" · ")[0] }));
  const plan = t.length >= 6 ? localPlan(t, ctx) : null;
  const scored = list.map((a) => ({ a, s: Math.max(fuzzy(t, a.title), fuzzy(t, a.words), ...a.example.split(" · ").map((e) => fuzzy(t, e))) + (plan?.action === a.id ? 200 : 0) }))
    .filter((x) => x.s > 0).sort((x, y) => y.s - x.s).slice(0, n);
  return scored.map(({ a }) => ({ id: a.id, title: a.title, example: a.example.split(" · ")[0], detected: plan?.action === a.id ? plan : null }));
}
export const describeValues = (plan, ctx) => {
  const a = ACTION_BY[plan?.action];
  if (!a) return "";
  let fields = [];
  try { fields = a.fields(plan.values, ctx) || []; } catch { fields = []; }
  return fields.filter((f) => !f.more && f.type !== "info" && plan.values[f.key] !== undefined && plan.values[f.key] !== "").slice(0, 4)
    .map((f) => `${f.label}: ${f.options ? (f.options.find(([k]) => String(k) === String(plan.values[f.key]))?.[1] || plan.values[f.key]) : plan.values[f.key]}`).join(" · ");
};
export { norm };
