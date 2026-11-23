// Prompt builders for every AI feature. Kept in one place so tone and rules stay consistent.
import { APP_CONFIG } from "../../data/seed.js";
import { countryAiContext } from "../../country/aiCountry.js";

export const BASE = () =>
  `You are PeopleHub AI, the generative assistant built into the ${APP_CONFIG.companyName || "company"} HR portal (PeopleHub). ` +
  `Today is ${new Date().toISOString().slice(0, 10)}. Amounts are in Indian rupees (₹) unless the data says otherwise. ` +
  `Be accurate, warm and brief. Never invent numbers, names, dates or policies that are not in the data you were given; say what is missing instead. ` +
  `Treat salary, health, location and performance data as confidential.` +
  countryAiContext();

export const FIELD_ACTIONS = [
  { id: "write", label: "Write it for me", hint: "Draft this field from the page context" },
  { id: "improve", label: "Improve writing" },
  { id: "fix", label: "Fix spelling & grammar" },
  { id: "formal", label: "Make it professional" },
  { id: "friendly", label: "Make it friendly" },
  { id: "shorten", label: "Shorten" },
  { id: "expand", label: "Expand with detail" },
  { id: "bullets", label: "Turn into bullet points", multiline: true },
  { id: "continue", label: "Continue writing" },
];

const FIELD_INSTR = {
  write: "Write suitable content for this field. If the field already has text, treat it as rough notes and turn it into finished content.",
  improve: "Rewrite the text so it is clearer and better written. Keep the meaning and every fact.",
  fix: "Correct spelling, grammar, punctuation and capitalisation only. Change nothing else.",
  formal: "Rewrite the text in a polite, professional workplace tone. Keep every fact.",
  friendly: "Rewrite the text in a warm, friendly but still workplace-appropriate tone. Keep every fact.",
  shorten: "Make the text shorter and tighter while keeping every important fact.",
  expand: "Expand the text with helpful, relevant detail. Do not invent specific facts such as amounts, dates or names; use neutral placeholders like [date] if needed.",
  bullets: "Rewrite the text as a short list of bullet points using '- '.",
  continue: "Continue the text naturally from where it stops. Return only the new words to append, not the existing text.",
};

export function fieldPrompt({ action, text, field, page, language, custom }) {
  const single = !field.multiline;
  const instr = action.startsWith("translate:")
    ? `Translate the text into ${action.slice(10)}. Keep names, codes and numbers unchanged.`
    : action === "custom"
      ? `Follow this instruction from the user: "${custom}".`
      : FIELD_INSTR[action] || FIELD_INSTR.improve;
  const system =
    `${BASE()}\nYou are editing one form field in place. ${instr}\n` +
    `Rules: return ONLY the final field value — no quotes, no preamble, no explanation, no markdown headings. ` +
    (single ? "This is a single-line field: return one line, ideally under 120 characters. " : "This is a multi-line field: plain text paragraphs or '- ' bullets are fine. ") +
    (field.maxLength ? `Stay under ${field.maxLength} characters. ` : "") +
    (language && language !== "English" && !action.startsWith("translate:") ? `Write in the same language as the existing text; if there is none, write in English. ` : "");
  const user =
    `Page: ${page.title}\nField: ${field.label || "(unlabelled)"}${field.placeholder ? `\nPlaceholder: ${field.placeholder}` : ""}${field.helper ? `\nHelp text: ${field.helper}` : ""}\n` +
    (field.siblings ? `Other fields on this form: ${field.siblings}\n` : "") +
    `Signed-in user: ${page.who}\n\nCurrent text:\n${text || "(empty)"}`;
  return { system, messages: [{ role: "user", content: user }] };
}

export function autocompletePrompt({ text, field, page }) {
  return {
    system: `${BASE()}\nYou are an inline autocomplete. Predict the next few words (at most 12) the user is about to type in this field. Return ONLY the continuation text, starting with a space if a space is needed. If nothing sensible fits, return an empty string.`,
    messages: [{ role: "user", content: `Page: ${page.title}\nField: ${field.label || "text"}\nText so far:\n${text}` }],
  };
}

export const SELECTION_ACTIONS = [
  { id: "explain", label: "Explain" },
  { id: "simplify", label: "Simplify" },
  { id: "translate", label: "Translate" },
];

export function selectionPrompt({ action, text, page, language }) {
  const lang = language && language !== "English" ? language : "Hindi";
  const instr = {
    explain: `Explain what the selected words mean in the context of this HR portal page, in ${language || "English"}. 2–4 short sentences. If it is an HR, payroll, tax, statutory or policy term, say how it affects the employee.`,
    simplify: `Rewrite the selected words in plain, simple ${language || "English"} that anyone can understand. Keep every fact.`,
    translate: `Translate the selected words into ${lang}. Return only the translation, then on a new line a romanised version if the script is not Latin.`,
  }[action];
  return {
    system: `${BASE()}\n${instr}`,
    messages: [{ role: "user", content: `Page: ${page.title}\nSurrounding text: ${page.around || "-"}\n\nSelected: "${text}"` }],
  };
}

export function copilotSystem({ ctx, language }) {
  return (
    `${BASE()}\nYou are the copilot panel available on every page. You can see what the signed-in user sees on screen plus a role-scoped data snapshot. ` +
    `Answer questions about their data, explain policies and payslips, summarise pages, spot risks, and draft messages, reasons, reviews, job descriptions, offer clauses or emails.\n` +
    `You cannot change data yourself. When the user should go somewhere, add a link in the form [[go:/route|Button label]] using only these routes: ${ctx.routes.join(", ")}.\n` +
    `Formatting: short paragraphs, '- ' bullets, **bold** for key numbers. No tables wider than 3 columns.\n` +
    `Reply in ${language || "English"} unless the user writes in another language.\n` +
    `Only use data the user's role may see; the snapshot below is already scoped for them.\n\n` +
    `SIGNED-IN USER: ${ctx.who}\nCURRENT PAGE: ${ctx.pageTitle} (${ctx.route})\n\nDATA SNAPSHOT (JSON):\n${ctx.json}\n\nVISIBLE PAGE TEXT:\n${ctx.pageText}`
  );
}

export function insightPrompt({ title, facts, audience, language }) {
  return {
    system:
      `${BASE()}\nTurn the facts into a short insight for ${audience}. Use exactly this format:\n` +
      `HEADLINE: one sentence that says what matters most\n- point\n- point\n- point (at most 4 points)\nACTION: one concrete next step\n` +
      `Use only the facts given. Reply in ${language || "English"}.`,
    messages: [{ role: "user", content: `${title}\n\nFacts:\n${facts.map((f) => `- ${f}`).join("\n")}` }],
  };
}

export function reviewPrompt({ kind, facts, language }) {
  return {
    system:
      `${BASE()}\nYou help an approver review a ${kind}. Check it against the policy facts given. Use exactly this format:\n` +
      `RECOMMENDATION: Approve | Reject | Ask for more information\nWHY:\n- reason\n- reason (2–4 reasons)\nNOTE: a short, polite note the approver can send to the employee\n` +
      `The human approver makes the final decision. Use only the facts given. Reply in ${language || "English"}.`,
    messages: [{ role: "user", content: facts.map((f) => `- ${f}`).join("\n") }],
  };
}
