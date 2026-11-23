// Facts handed to the AI for approval reviews. Computed from real data so the AI cannot invent them.
import { REQUEST_TYPES, leaveBalances } from "../requests.js";
import { isoDate } from "../utils.js";
import { leaveTypesFor } from "../../country/countryPacks.js";

const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

export function requestFacts(r, store) {
  const { data, empBy, nameOf, leaveTypeBy, expCatBy } = store;
  const e = empBy[r.employee_code] || {};
  const st = data.settings;
  const facts = [`${REQUEST_TYPES[r.type]?.label} ${r.request_id} from ${e.full_name} (${e.designation}, ${e.department}), joined ${e.date_of_joining}`, `Submitted ${String(r.created_at).slice(0, 10)} — ${days(r.created_at, new Date())} day(s) ago; approval SLA is ${st.approval_sla_days} day(s)`];
  const flags = [...(r.flags || []).map((f) => (typeof f === "string" ? f : f.text || f.label || JSON.stringify(f)))];
  if (r.type === "leave") {
    const t = leaveTypeBy[r.leave_type];
    const bal = leaveBalances(e, leaveTypesFor(data, e), data.requests, { excludeId: r.request_id }).find((b) => b.code === r.leave_type);
    facts.push(`${t?.name}: ${r.days} working day(s) from ${r.from_date} to ${r.to_date}${r.half_day && r.half_day !== "none" ? ` (${r.half_day} half day)` : ""}`, `Reason given: ${r.reason || "none"}`);
    if (bal && bal.available != null) {
      facts.push(`Balance before this request: ${bal.available} day(s) available of ${bal.entitled} entitled`);
      if (bal.available < r.days) flags.push(`Not enough ${t?.name} balance (${bal.available} available, ${r.days} requested)`);
    }
    const notice = days(String(r.created_at).slice(0, 10), r.from_date);
    if (t?.min_notice_days && notice < t.min_notice_days && r.from_date >= isoDate()) flags.push(`Only ${notice} day(s) notice; policy asks for ${t.min_notice_days}`);
    if (t?.doc_after_days && r.days > t.doc_after_days && !r.attachment) flags.push(`No certificate attached for more than ${t.doc_after_days} day(s)`);
    const overlap = data.requests.filter((x) => x.type === "leave" && x.request_id !== r.request_id && ["Approved", "Pending"].includes(x.status) && x.from_date <= r.to_date && x.to_date >= r.from_date && empBy[x.employee_code]?.department === e.department);
    if (overlap.length) facts.push(`${overlap.length} other person(s) in ${e.department} are off in the same period: ${overlap.map((x) => nameOf(x.employee_code)).join(", ")}`);
  } else if (r.type === "expense") {
    const total = (r.items || []).reduce((s, i) => s + Number(i.amount || 0), 0);
    facts.push(`Title: ${r.title}; purpose: ${r.purpose}; project: ${r.project || "—"}; total ₹${total}`);
    (r.items || []).forEach((i) => {
      const c = expCatBy[i.category];
      facts.push(`Line ${i.date} · ${c?.name} · ₹${i.amount} · ${i.description || ""} · receipt ${i.receipt ? "attached" : "missing"}${c?.limit ? ` · category limit ₹${c.limit}` : ""}`);
      if (c?.limit && Number(i.amount) > c.limit) flags.push(`${c.name} line ₹${i.amount} is over the ₹${c.limit} limit`);
      if (!i.receipt && (c?.receipt_always || Number(i.amount) > st.receipt_required_above)) flags.push(`Receipt missing for ${c?.name} ₹${i.amount}`);
      if (i.date && days(i.date, r.created_at) > st.expense_claim_window_days) flags.push(`${i.date} line is outside the ${st.expense_claim_window_days}-day claim window`);
    });
    if (r.advance_ref) facts.push(`Adjusts advance ${r.advance_ref}`);
  } else if (r.type === "advance") {
    facts.push(`Amount ₹${r.request_amount ?? r.amount}; purpose: ${r.purpose || r.reason || "—"}; maximum advance ₹${st.max_advance_inr}; must settle within ${st.advance_settle_days} days`);
    const open = data.requests.filter((x) => x.type === "advance" && x.employee_code === r.employee_code && ["Approved", "Disbursed"].includes(x.status) && !x.settled && x.request_id !== r.request_id);
    if (open.length) flags.push(`${open.length} earlier advance(s) not yet settled: ${open.map((x) => x.request_id).join(", ")}`);
    if (Number(r.request_amount ?? r.amount) > st.max_advance_inr) flags.push("Above the maximum advance");
  } else if (r.type === "loan") {
    const limit = (e.monthly_gross || 0) * st.loan_max_multiple;
    facts.push(`Loan ₹${r.amount} over ${r.tenure_months} months, EMI ₹${r.emi}; reason: ${r.reason || "—"}`, `Monthly gross ₹${e.monthly_gross}; policy limit ${st.loan_max_multiple}× gross = ₹${limit}; max tenure ${st.loan_max_tenure_months} months`);
    if (r.amount > limit) flags.push("Loan is above the policy limit");
    if (r.tenure_months > st.loan_max_tenure_months) flags.push("Tenure is longer than policy allows");
    if (e.monthly_gross && r.emi > e.monthly_gross * 0.4) flags.push("EMI is more than 40% of monthly gross");
  } else if (r.type === "regularize") {
    facts.push(`Correction for ${r.date}: in ${r.in_time || "—"}, out ${r.out_time || "—"}; reason: ${r.reason_code} — ${r.reason || ""}`, `Shift starts ${st.shift_start}, late after ${st.late_after}`);
    const recent = data.requests.filter((x) => x.type === "regularize" && x.employee_code === r.employee_code && x.request_id !== r.request_id && days(x.created_at, new Date()) < 31).length;
    if (recent >= 2) flags.push(`${recent} other attendance corrections in the last 30 days`);
  } else if (r.type === "asset") {
    facts.push(`${r.category} requested, needed by ${r.needed_by}, priority ${r.priority}; reason: ${r.reason}`);
    const has = data.assets.filter((a) => a.assigned_to === r.employee_code && a.category === r.category);
    if (has.length) facts.push(`Already holds ${has.length} ${r.category}(s): ${has.map((a) => a.asset_id).join(", ")}`);
    facts.push(`${data.assets.filter((a) => a.status === "in_stock" && a.category === r.category).length} ${r.category}(s) in stock`);
  }
  (r.steps || []).filter((s) => s.status === "approved" && s.note).forEach((s) => facts.push(`${s.level} note: ${s.note}`));
  const rec = flags.some((f) => /over|above|not enough|outside|limit/i.test(f)) ? "Ask for more information" : flags.length ? "Ask for more information" : "Approve";
  return { facts, flags, rec };
}

export function submissionFacts(s, store) {
  const { data, empBy, ruleBy, catBy } = store;
  const e = empBy[s.employee_code] || {};
  const rule = ruleBy[s.rule_id] || {};
  const facts = [
    `Sahayog points claim ${s.submission_id} from ${e.full_name} (${e.designation}, ${e.department})`,
    `Category: ${catBy[s.category_id]?.name}; rule: ${rule.sub_category} worth ${rule.points} pts, valid within ${rule.validity_days} days of the activity, document ${rule.doc_required ? "required" : "optional"}`,
    `Requested ${s.points_requested} pts for activity on ${s.activity_date}; description: ${s.description}`,
    `Supporting document: ${s.supporting_document ? "attached" : "none"}`,
  ];
  const flags = [...(s.flags || []).map((f) => (typeof f === "string" ? f : f.text || f.label || JSON.stringify(f)))];
  if (rule.points && Number(s.points_requested) > rule.points) flags.push(`Requests more than the rule's ${rule.points} pts`);
  if (rule.doc_required && !s.supporting_document) flags.push("Required document is missing");
  if (rule.validity_days && s.activity_date && days(s.activity_date, s.submitted_at || s.created_at || new Date()) > rule.validity_days) flags.push(`Submitted after the ${rule.validity_days}-day window`);
  const dup = data.submissions.filter((x) => x.submission_id !== s.submission_id && x.employee_code === s.employee_code && x.rule_id === s.rule_id && !["Rejected", "Withdrawn", "Draft"].includes(x.status) && Math.abs(days(x.activity_date, s.activity_date)) <= data.settings.duplicate_window_days);
  if (dup.length) flags.push(`Possible duplicate of ${dup.map((x) => x.submission_id).join(", ")}`);
  const rec = flags.some((f) => /missing|duplicate|after/i.test(f)) ? "Ask for more information" : flags.length ? "Ask for more information" : "Approve";
  return { facts, flags, rec };
}
