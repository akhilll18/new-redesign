import { getAiCountry } from "../../country/aiCountry.js";
import { countryBrief, isCountryQuestion } from "../../country/countryBrief.js";
// Offline demo generator. Used when no proxy or API key is available so every AI control still works.
// It is rule-based and only re-uses facts it was handed — it never invents data.

const TYPOS = {
  teh: "the", recieve: "receive", recieved: "received", adress: "address", seperate: "separate", definately: "definitely",
  occured: "occurred", untill: "until", wich: "which", becuase: "because", beacuse: "because", tommorow: "tomorrow", tomorow: "tomorrow",
  accomodation: "accommodation", beleive: "believe", calender: "calendar", enviroment: "environment", goverment: "government",
  managment: "management", reciept: "receipt", succesful: "successful", sucessful: "successful", thier: "their", truely: "truly",
  wierd: "weird", acheive: "achieve", arguement: "argument", buisness: "business", collegue: "colleague", comming: "coming",
  freind: "friend", happend: "happened", knowlege: "knowledge", neccessary: "necessary", occassion: "occasion", oppurtunity: "opportunity",
  payed: "paid", prefered: "preferred", realy: "really", refered: "referred", relevent: "relevant", resonable: "reasonable",
  scedule: "schedule", shedule: "schedule", sincerly: "sincerely", travelling: "travelling", u: "you", ur: "your", pls: "please", plz: "please",
  thx: "thanks", tq: "thank you", bcz: "because", coz: "because", msg: "message", req: "request", asap: "as soon as possible", im: "I'm", dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", isnt: "isn't",
};
const CONTRACTIONS = [
  [/\bcan't\b/gi, "cannot"], [/\bwon't\b/gi, "will not"], [/\bI'm\b/g, "I am"], [/\bdon't\b/gi, "do not"], [/\bdidn't\b/gi, "did not"],
  [/\bisn't\b/gi, "is not"], [/\bit's\b/gi, "it is"], [/\bI've\b/g, "I have"], [/\bI'll\b/g, "I will"], [/\bwe're\b/gi, "we are"],
  [/\bthanks\b/gi, "thank you"], [/\bhey\b/gi, "Hello"], [/\bgonna\b/gi, "going to"], [/\bwanna\b/gi, "want to"], [/\bok\b/gi, "okay"],
];
const FILLER = /\b(really|very|just|basically|actually|kindly|literally|quite|simply|totally)\s+/gi;

function fixText(t) {
  if (!t) return t;
  let s = t.replace(/[ \t]+/g, " ").replace(/\s+([,.!?;:])/g, "$1").replace(/([,.!?;:])(?=[A-Za-z])/g, "$1 ");
  s = s.replace(/\b[A-Za-z]+\b/g, (w) => {
    const r = TYPOS[w.toLowerCase()];
    if (!r) return w;
    return w[0] === w[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r;
  });
  s = s.replace(/\bi\b/g, "I");
  s = s.replace(/(^\s*|[.!?]\s+|\n\s*(?:- )?)([a-z])/g, (m, p, c) => p + c.toUpperCase());
  s = s.trim();
  if (s.split(/\s+/).length > 3 && !/[.!?:)]$/.test(s) && !s.includes("\n")) s += ".";
  return s;
}
function sentences(t) {
  return (t.match(/[^.!?\n]+[.!?]?/g) || []).map((x) => x.trim()).filter(Boolean);
}

function templateFor(field, existing) {
  const l = `${field.label || ""} ${field.placeholder || ""} ${field.page || ""}`.toLowerCase();
  if (existing) return fixText(existing);
  if (/reject|reason.*(reject|declin)|declin/.test(l)) return "Thank you for submitting this. I am unable to approve it as it stands because the supporting details do not meet the policy requirements. Please review the policy, add the missing information and resubmit.";
  if (/remark|note|comment/.test(l) && /approv|decision|review|admin|manager/.test(l)) return "Reviewed against policy; details and supporting documents are in order. Approved.";
  if (/leave|time off|absence/.test(l) || (/reason/.test(l) && /leave/.test(l))) return "Requesting leave for personal reasons. I will hand over my pending work before I go and will be reachable on phone for anything urgent.";
  if (/expense|claim|purpose|travel|bill/.test(l)) return "Client visit expenses incurred on official travel, as per company travel policy. Receipts are attached for each line item.";
  if (/advance/.test(l)) return "Advance requested for upcoming official travel and on-site expenses. I will settle it against an expense claim with receipts within the policy window.";
  if (/loan/.test(l)) return "Requesting a salary loan for a planned personal expense. I agree to the repayment schedule through monthly salary deductions.";
  if (/subject|title|summary/.test(l) && /ticket|support|help/.test(l)) return "Need help updating my bank details in payroll";
  if (/ticket|issue|problem|support/.test(l)) return "I need help with the following issue. Please let me know if any documents or details are required from my side.";
  if (/praise|feedback|kudos|appreciat/.test(l)) return "Thank you for the outstanding effort this week — your ownership and attention to detail made a real difference to the team.";
  if (/goal|objective|okr/.test(l)) return "Deliver the planned milestone on time with agreed quality targets, and share progress updates every two weeks.";
  if (/self.?review|achievement|accomplish|strength/.test(l)) return "This cycle I delivered my committed goals, supported teammates on critical releases and improved my technical depth. Next cycle I want to take on more ownership and mentoring.";
  if (/review|rating|manager.?comment/.test(l)) return "Consistently dependable and collaborative. Delivered key goals this cycle; next step is to lead larger pieces of work end-to-end.";
  if (/job|role description|responsibilit|jd/.test(l)) return "We are looking for a motivated professional to own day-to-day delivery, collaborate across teams and continuously improve how we work.";
  if (/clause|term|condition/.test(l)) return "This offer is subject to satisfactory background verification and submission of the documents listed in the joining checklist.";
  if (/description|detail|activity|what did/.test(l)) return "Completed the activity as described with measurable impact for the team. Supporting evidence is attached for verification.";
  if (/email|message|body|letter/.test(l)) return "Dear team,\n\nI hope you are well. Please find the details below and let me know if you have any questions.\n\nWarm regards,";
  if (/address/.test(l)) return "";
  if (/name|code|id|phone|mobile|pan|aadhaar|ifsc|account/.test(l)) return "";
  return "Please find the details here. I am happy to share more information if needed.";
}

function transform(action, text, field) {
  const t = text || "";
  if (action === "write") return templateFor(field, t);
  if (action === "fix") return fixText(t);
  if (action === "improve") {
    let s = fixText(t);
    CONTRACTIONS.slice(0, 10).forEach(([r, v]) => (s = s.replace(r, v)));
    return s.replace(FILLER, "");
  }
  if (action === "formal") {
    let s = fixText(t);
    CONTRACTIONS.forEach(([r, v]) => (s = s.replace(r, v)));
    s = s.replace(FILLER, "");
    if (field.multiline && !/regards|sincerely|thank you/i.test(s)) s += "\n\nThank you.";
    return s;
  }
  if (action === "friendly") {
    const s = fixText(t);
    return field.multiline ? `Hi! ${s}${/thank/i.test(s) ? "" : " Thanks so much!"}` : s.replace(/\.$/, "") + (/[!?]$/.test(s) ? "" : "!");
  }
  if (action === "shorten") {
    const s = fixText(t).replace(FILLER, "");
    const ss = sentences(s);
    return ss.length > 2 ? ss.slice(0, Math.max(1, Math.ceil(ss.length / 2))).join(" ") : s.replace(/\b(in order to)\b/gi, "to").replace(/\b(at this point in time)\b/gi, "now");
  }
  if (action === "expand") {
    const s = fixText(t) || templateFor(field, "");
    return `${s} ${field.multiline ? "\n\n" : ""}I have made sure all the relevant details are included, and I am happy to share anything else that is needed.`.replace(/ \n/, "\n");
  }
  if (action === "bullets") return sentences(fixText(t)).map((x) => `- ${x.replace(/[.]$/, "")}`).join("\n");
  if (action === "continue") {
    const l = (field.label || "").toLowerCase();
    if (/leave/.test(l)) return " I will hand over my pending work and stay reachable for anything urgent.";
    if (/expense|claim/.test(l)) return " Receipts for each item are attached.";
    return " Please let me know if you need any further information.";
  }
  if (action.startsWith("translate:")) return `[Offline demo — connect live AI in System settings to translate into ${action.slice(10)}] ${t}`;
  if (action === "custom") return fixText(t);
  return t;
}

function autocomplete(text) {
  const tail = text.slice(-60).toLowerCase();
  const pairs = [
    [/dear$/, " team,"], [/thank you$/, " for your support."], [/please find$/, " the details attached."], [/i would like to$/, " request"],
    [/request(ing)? leave$/, " for personal reasons"], [/for personal reasons$/, ". I will hand over my pending work."], [/as per$/, " company policy"],
    [/receipts?$/, " are attached for each item."], [/let me know$/, " if you need anything else."], [/looking forward$/, " to your response."],
    [/kindly$/, " approve"], [/on behalf of$/, " the team"], [/due to$/, " an urgent personal commitment"], [/regards$/, ","],
  ];
  const hit = pairs.find(([r]) => r.test(tail.trim()));
  return hit ? hit[1] : "";
}

function explain(text, action) {
  const t = text.trim();
  const GLOSS = {
    "ctc": "CTC (cost to company) is the total yearly cost of employing you — gross salary plus employer contributions such as PF and gratuity. Take-home pay is lower than CTC.",
    "pf": "PF (Provident Fund) is a retirement saving: 12% of basic pay is deducted from you and the employer adds a matching share.",
    "epf": "EPF (Employees' Provident Fund) is a retirement saving: 12% of basic pay is deducted and the employer contributes too.",
    "tds": "TDS (tax deducted at source) is income tax your employer deducts from each salary and pays to the government on your behalf.",
    "pt": "PT (professional tax) is a small state tax deducted from salary every month.",
    "hra": "HRA (house rent allowance) is part of salary meant for rent; part of it can be tax-free if you pay rent and declare it.",
    "lop": "LOP (loss of pay) means unpaid days — salary is reduced for days absent without approved leave.",
    "esi": "ESI (Employees' State Insurance) gives medical cover to employees below a salary limit; small contributions come from employee and employer.",
    "gratuity": "Gratuity is a lump sum paid when you leave after at least five years of service.",
    "earned leave": "Earned leave (EL) builds up through the year; unused days may carry forward up to the policy limit.",
    "casual leave": "Casual leave (CL) is for short, unplanned needs; it usually does not carry forward.",
    "regime": "Tax regime: the new regime has lower rates but few deductions; the old regime allows deductions such as 80C and HRA. Pick whichever leaves you more take-home pay.",
    "geofence": "A geofence is a virtual boundary around an office or client site; mobile punches inside it count as on-site.",
    "sla": "SLA (service level agreement) here is the number of days an approval should take before it shows as overdue.",
    "payslip": "A payslip lists your earnings, deductions and net pay for one month.",
    "net pay": "Net pay is what reaches your bank account after all deductions.",
    "gross": "Gross pay is total earnings before any deductions.",
    "attrition": "Attrition is the share of employees who left in a period, as a percentage of headcount.",
  };
  const key = Object.keys(GLOSS).find((k) => t.toLowerCase().includes(k));
  if (action === "translate") return `[Offline demo — connect live AI in System settings to translate] "${t}"`;
  if (action === "simplify") return key ? GLOSS[key] : `In simple words: ${fixText(t.replace(FILLER, ""))}`;
  return key ? GLOSS[key] : `"${t.length > 80 ? `${t.slice(0, 80)}…` : t}" is shown on this page as part of your HR record. Connect live AI in System settings for a full explanation of any word or phrase.`;
}

function insight(hint) {
  const f = (hint?.facts || []).filter(Boolean);
  if (!f.length) return "HEADLINE: Nothing needs your attention right now.\nACTION: Check back later.";
  const pick = (re) => f.find((x) => re.test(x));
  const action =
    (pick(/approval\(s\) waiting|waiting for you|approval queue/i) && "Clear the pending approvals, oldest first.") ||
    (pick(/self review is open/i) && "Start your self review before the due date.") ||
    (pick(/request\(s\) are pending/i) && "Keep an eye on your pending requests and nudge your approver if one is close to the SLA.") ||
    (pick(/late|absent|not in/i) && "Check in with people who are late or not in yet.") ||
    (pick(/goal|at risk/i) && "Update the goals that are at risk this week.") ||
    (pick(/leave|balance/i) && "Plan your leave early so balances are not lost.") ||
    (pick(/locked|failed/i) && "Review locked accounts and failed sign-ins.") ||
    "Review the details below and follow up where needed.";
  return `HEADLINE: ${f[0].replace(/\.$/, "")}.\n${f.slice(1, 5).map((x) => `- ${x}`).join("\n")}\nACTION: ${action}`;
}

function review(hint) {
  const flags = hint?.flags || [];
  const rec = hint?.rec || (flags.length ? "Ask for more information" : "Approve");
  const why = [...flags, ...(hint?.facts || []).filter((x) => /within|limit|balance|attached|policy|days/i.test(x)).slice(0, 3)].slice(0, 4);
  const note =
    rec === "Approve" ? "Thank you — this is in line with policy and has been approved." : rec === "Reject" ? "Thank you for submitting this. I cannot approve it because it does not meet the policy; please see the reasons and resubmit if needed." : "Thanks for submitting this. Could you please add the missing details or documents so I can complete the review?";
  return `RECOMMENDATION: ${rec}\nWHY:\n${(why.length ? why : ["All checks available offline passed."]).map((x) => `- ${x}`).join("\n")}\nNOTE: ${note}`;
}

function chat(hint) {
  const q = (hint?.question || "").toLowerCase();
  const c = hint?.ctx || {};
  const me = c.me || {};
  const lines = [];
  const cc = getAiCountry() || c.country;
  if (cc && isCountryQuestion(q) && countryBrief(cc)) {
    lines.push(countryBrief(cc, { asEmployee: me.role === "emp" }).markdown);
  } else if (/leave|balance|holiday|off/.test(q) && c.leaveBalances) {
    lines.push("**Your leave balances**", ...c.leaveBalances.filter((b) => b.available != null).map((b) => `- ${b.name}: **${b.available}** day(s) available`));
    if (c.nextHoliday) lines.push(`\nNext holiday: **${c.nextHoliday.name}** on ${c.nextHoliday.date}.`);
    lines.push("\n[[go:/leave|Open Leave]]");
  } else if (/approv|pending|inbox|queue|waiting/.test(q) && c.pending) {
    lines.push(`You have **${c.pending.total}** item(s) waiting for you.`, ...c.pending.items.slice(0, 6).map((p) => `- ${p}`), `\n[[go:${c.pending.route}|Open approvals]]`);
  } else if (/pay|salary|payslip|net|tax|deduct/.test(q) && c.payslip) {
    const p = c.payslip;
    lines.push(`**${p.period} payslip**`, `- Gross earnings: **₹${p.gross}**`, `- Deductions: **₹${p.deductions}**`, `- Net pay: **₹${p.net}**`, "\nDeductions usually include PF, professional tax and TDS.", "\n[[go:/finances|Open My finances]]");
    } else if (/goal|performance|review/.test(q) && c.goals) {
    lines.push("**Your goals**", ...c.goals.map((g) => `- ${g.title}: ${g.progress}% (${g.status.replace("_", " ")})`), "\n[[go:/performance-me|Open performance]]");
  } else if (/team|who.*(off|late|absent)|attendance/.test(q) && c.team) {
    lines.push(`Team today: **${c.team.present}** in, **${c.team.late}** late, **${c.team.leave}** on leave, **${c.team.notIn}** not in.`);
  } else if (/headcount|employees|people|attrition|workforce/.test(q) && c.org) {
    lines.push(`Active employees in your scope: **${c.org.active}** across ${c.org.departments} departments.`, c.org.attrition != null ? `12-month attrition: **${c.org.attrition}%**.` : "");
  } else if (/draft|write|email|message|reply|letter/.test(q)) {
    lines.push("Here is a draft you can adapt:\n", `Dear team,\n\nI hope you are well. ${hint.question.replace(/^(please\s+)?(draft|write)( me)?( an?)?( email| message)?( to| about)?/i, "").trim() || "I wanted to share a quick update."}\n\nPlease let me know if you have any questions.\n\nWarm regards,\n${me.name || ""}`);
  } else if (/summar|this page|what.*(see|here)|attention/.test(q)) {
    lines.push(`**${c.page || "This page"}** — quick summary:`, ...(c.highlights || []).slice(0, 6).map((h) => `- ${h}`));
    if (!(c.highlights || []).length) lines.push("- Nothing urgent stands out on this page.");
  } else {
    lines.push(
      `Hi ${me.first || "there"}! I'm running in **offline demo mode**, so I can answer common questions from your data (leave, approvals, payslip, contract, goals, team) and draft simple messages.`,
      "\nFor full generative answers on anything, a Super Admin can connect Claude in **System settings → Generative AI**.",
    );
  }
  return lines.filter((x) => x !== "").join("\n");
}

export async function mockGenerate({ task, hint, onText, signal }) {
  let out = "";
  // v8 modules compute their own offline answer from real data and pass it in as hint.offline.
  if (hint?.offline != null) out = String(hint.offline);
  else if (task.startsWith("field:")) out = transform(task.slice(6), hint?.text || "", hint?.field || {});
  else if (task === "autocomplete") out = autocomplete(hint?.text || "");
  else if (task.startsWith("selection:")) out = explain(hint?.text || "", task.slice(10));
  else if (task === "insight") out = insight(hint);
  else if (task === "review") out = review(hint);
  else out = chat(hint);
  // Stream it so the UI behaves exactly like the live model.
  const parts = out.match(/\S+\s*|\s+/g) || [];
  let full = "";
  for (const p of parts) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    full += p;
    onText?.(p, full);
    if (parts.length > 3) await new Promise((r) => setTimeout(r, 14));
  }
  return full;
}
