// Adds the active country's rules to every AI prompt (copilot, field writing, explain-a-word, insights, approval reviews).
// prompts.js calls countryAiContext() inside its shared BASE() prompt, so each AI feature becomes country-aware
// without changing the features themselves.
import { packFor, countriesIn, REGION_INFO } from "./countryPacks.js";
import { MARKET } from "./countryBrief.js";

let active = { country: null, role: null, employeeCountry: null };

export function setAiCountry(country, extra = {}) {
  active = { country, ...extra };
}
export function getAiCountry() {
  return active.country;
}

function engineSummary(p) {
  const pol = p.engine?.policy || {};
  return Object.entries(pol)
    .map(([head, rows]) => `${head}: ${rows.map(([k, v]) => `${k} — ${v}`).join("; ")}`)
    .join("\n");
}

export function countryAiContext() {
  const cc = active.country;
  if (!cc && active.region && REGION_INFO[active.region]) {
    const list = countriesIn(active.region).map((c) => packFor(c));
    return (
      `\nREGION MODE: ${active.region} — ${REGION_INFO[active.region].name} (${list.map((p) => p.name).join(", ")}). ` +
      `Answer for these countries; when a rule differs by country, say which country it applies to and use that country's currency.\n` +
      list.map((p) => `${p.name}: ${p.currency}; tax year ${p.taxYear}; ${p.workWeek}; payroll ${p.engine?.RATES?.effective}; leave — ${p.leaveNotes.map(([k, v]) => `${k}: ${v}`).join("; ")}`).join("\n") +
      `\nAlways add "check with a local adviser" for legal or tax conclusions.`
    );
  }
  if (!cc) {
    return "\nCOUNTRY MODE: All countries (global view). Employees are paid under their own country's rules; the data shows each employee's country_code. When you answer about pay, tax, leave or law, say which country the rule belongs to.";
  }
  const p = packFor(cc);
  if (!p) return "";
  return (
    `\nCOUNTRY MODE: ${p.name} (${cc}). Answer using ${p.name}'s labour law, statutory payroll and holidays unless the user asks about another country. ` +
    `Currency: ${p.currency} (${p.symbol}) — use it instead of rupees for ${p.name} amounts. Dates: ${p.dateFormat}. ` +
    `Tax year: ${p.taxYear}. Pay cycle: ${p.payCycle}. Working week: ${p.workWeek}. ` +
    `Authorities: ${p.authorities.join(", ")}. Data protection: ${p.dataLaw}. Payroll rules effective: ${p.engine?.RATES?.effective}.\n` +
    `${p.name} rules:\n${engineSummary(p)}\n` +
    `Statutory leave: ${p.leaveNotes.map(([k, v]) => `${k} — ${v}`).join("; ")}.\n` +
    `Onboarding documents: ${p.documents.join(", ")}.\n` +
    (MARKET[cc] ? `Market: capital ${MARKET[cc].capital}; business hubs ${MARKET[cc].hubs}; time zone ${MARKET[cc].tz}; key industries ${MARKET[cc].industries}; ${MARKET[cc].notes.join("; ")}.\n` : "") +
    `When asked about "${p.name}" in general, answer with sections: Employment policy, Leave & holidays, Statutory compliance, Taxes, Market — not the user's personal balances.\n` +
    `Always add "check with a local adviser" when giving legal or tax conclusions; never invent rates that are not listed here.`
  );
}
