// "Ask AI about <country>": a country brief built from the country pack + payroll engine (policies, statutory compliance,
// taxes, filing calendar) and a short market profile. Used offline by the copilot and as the facts for the live model.
import { packFor } from "./countryPacks.js";
import { filingCalendar } from "../lib/payroll/index.js";
import { isoDate } from "../lib/utils.js";

// Stable market facts only (no GDP or other figures that go out of date).
export const MARKET = {
  IN: { capital: "New Delhi", hubs: "Bengaluru, Mumbai, Hyderabad, Delhi NCR, Chennai, Pune", tz: "IST (UTC+5:30)", industries: "IT & software services, financial services, pharmaceuticals, manufacturing, telecom, retail & e-commerce", notes: ["GST (Goods and Services Tax) applies to most B2B services; companies register per state", "Large, young English-speaking talent pool; strong GCC (global capability centre) market", "State-specific rules: Shops & Establishments Acts, professional tax, labour welfare fund"] },
  GB: { capital: "London", hubs: "London, Manchester, Birmingham, Edinburgh, Leeds", tz: "GMT / BST (UTC+0 / +1)", industries: "Financial services, professional services, technology, life sciences, creative industries", notes: ["VAT applies to most services", "Right-to-work checks are mandatory before day one", "IR35 rules apply when engaging contractors"] },
  US: { capital: "Washington, D.C.", hubs: "New York, San Francisco Bay Area, Seattle, Austin, Boston, Chicago", tz: "ET, CT, MT, PT (UTC−5 to −8)", industries: "Technology, financial services, healthcare, manufacturing, energy, retail", notes: ["Employment is generally at-will; state law adds a lot (pay transparency, sick leave, non-competes)", "Payroll tax and registration in every state where staff work", "No federal VAT; state and local sales taxes"] },
  AE: { capital: "Abu Dhabi", hubs: "Dubai, Abu Dhabi, Sharjah", tz: "GST (UTC+4)", industries: "Trade & logistics, financial services, real estate, tourism, energy", notes: ["Free zones (e.g. DIFC, ADGM, DMCC) have their own employment and licensing rules", "Corporate tax 9% above the threshold; 5% VAT", "Emiratisation quotas apply to mainland companies of 20+ staff"] },
  SG: { capital: "Singapore", hubs: "Singapore (Central Business District, one-north)", tz: "SGT (UTC+8)", industries: "Financial services, technology, logistics, biomedical, advanced manufacturing", notes: ["Regional HQ hub for Asia-Pacific", "Work passes (EP, S Pass) with quota and salary thresholds", "GST applies to most services"] },
  NA: { capital: "Windhoek", hubs: "Windhoek, Walvis Bay, Swakopmund", tz: "CAT (UTC+2)", industries: "Mining (diamonds, uranium), fishing, tourism, logistics, green hydrogen", notes: ["Affirmative Action reporting for relevant employers", "Close trade links with South Africa (SACU); NAD pegged to ZAR", "VAT 15%"] },
  ZA: { capital: "Pretoria (executive)", hubs: "Johannesburg, Cape Town, Durban, Pretoria", tz: "SAST (UTC+2)", industries: "Mining, financial services, manufacturing, agriculture, tourism, BPO", notes: ["B-BBEE scorecard affects procurement and contracts", "Employment Equity plans and reports for designated employers", "VAT 15%"] },
  KE: { capital: "Nairobi", hubs: "Nairobi, Mombasa, Kisumu", tz: "EAT (UTC+3)", industries: "Agriculture, technology & mobile money, tourism, logistics, financial services", notes: ["East Africa's tech hub ('Silicon Savannah')", "Housing levy and SHIF deductions alongside PAYE", "VAT 16%"] },
  NG: { capital: "Abuja", hubs: "Lagos, Abuja, Port Harcourt", tz: "WAT (UTC+1)", industries: "Oil & gas, financial services, fintech, telecom, agriculture, entertainment", notes: ["Largest population in Africa; strong fintech ecosystem", "PAYE is paid to the state where the employee lives", "VAT 7.5%"] },
  BW: { capital: "Gaborone", hubs: "Gaborone, Francistown", tz: "CAT (UTC+2)", industries: "Diamond mining, tourism, financial services, beef", notes: ["Stable, investment-grade economy", "Work and residence permits for foreign staff", "VAT 14%"] },
  CA: { capital: "Ottawa", hubs: "Toronto, Vancouver, Montréal, Calgary, Ottawa", tz: "NT to PT (UTC−3:30 to −8)", industries: "Natural resources, financial services, technology, manufacturing, AI research", notes: ["Employment standards are mostly provincial", "Québec has its own pension plan (QPP) and French-language requirements", "GST/HST plus provincial sales taxes"] },
  MX: { capital: "Mexico City", hubs: "Mexico City, Monterrey, Guadalajara, Querétaro", tz: "CST (UTC−6)", industries: "Automotive & manufacturing, nearshoring, mining, tourism, agriculture", notes: ["Mandatory profit sharing (PTU) with employees", "Subcontracting of core activities is restricted", "VAT (IVA) 16%"] },
  BR: { capital: "Brasília", hubs: "São Paulo, Rio de Janeiro, Belo Horizonte, Curitiba", tz: "BRT (UTC−3)", industries: "Agribusiness, mining, oil & gas, financial services, fintech, manufacturing", notes: ["CLT employment code; 13th salary and 1/3 vacation bonus", "eSocial digital reporting for all payroll events", "Complex multi-layer consumption taxes (being reformed)"] },
  DE: { capital: "Berlin", hubs: "Berlin, Munich, Frankfurt, Hamburg, Stuttgart", tz: "CET / CEST (UTC+1 / +2)", industries: "Automotive, engineering, chemicals, financial services, technology", notes: ["Works councils (Betriebsrat) have co-determination rights", "Church tax and solidarity surcharge in payroll where applicable", "VAT 19% (7% reduced)"] },
  FR: { capital: "Paris", hubs: "Paris, Lyon, Toulouse, Marseille, Lille", tz: "CET / CEST (UTC+1 / +2)", industries: "Aerospace, luxury goods, tourism, energy, agri-food, technology", notes: ["Collective agreements (conventions collectives) set many terms by sector", "35-hour legal working week with RTT days", "VAT 20%"] },
  IE: { capital: "Dublin", hubs: "Dublin, Cork, Galway, Limerick", tz: "GMT / IST (UTC+0 / +1)", industries: "Technology, pharmaceuticals, medical devices, financial services, aircraft leasing", notes: ["EMEA HQ for many US tech companies", "PRSI and USC alongside PAYE", "VAT 23% standard"] },
  SA: { capital: "Riyadh", hubs: "Riyadh, Jeddah, Dammam / Khobar, NEOM", tz: "AST (UTC+3)", industries: "Oil & gas, petrochemicals, construction, tourism, logistics (Vision 2030)", notes: ["Saudization (Nitaqat) quotas", "Regional HQ programme for government contracts", "VAT 15%; no personal income tax"] },
  MY: { capital: "Kuala Lumpur", hubs: "Kuala Lumpur, Penang, Johor Bahru, Cyberjaya", tz: "MYT (UTC+8)", industries: "Electronics & semiconductors, palm oil, oil & gas, shared services, tourism", notes: ["Strong shared-services and semiconductor base", "EPF, SOCSO and EIS contributions", "Sales & Service Tax (SST)"] },
  PH: { capital: "Manila", hubs: "Metro Manila (Makati, BGC), Cebu, Clark, Davao", tz: "PHT (UTC+8)", industries: "IT-BPM / shared services, remittances, electronics, tourism, agriculture", notes: ["One of the world's largest BPO markets", "13th-month pay is mandatory", "VAT 12%"] },
  ID: { capital: "Jakarta (moving to Nusantara)", hubs: "Jakarta, Surabaya, Bandung, Batam", tz: "WIB / WITA / WIT (UTC+7 to +9)", industries: "Nickel & mining, palm oil, manufacturing, digital economy, tourism", notes: ["THR religious holiday allowance is mandatory", "BPJS health and employment programmes", "VAT 11–12%"] },
  GH: { capital: "Accra", hubs: "Accra, Kumasi, Tema, Takoradi", tz: "GMT (UTC+0)", industries: "Gold, cocoa, oil, financial services, technology", notes: ["Three-tier pension scheme (SSNIT + occupational + voluntary)", "Ghana Revenue Authority administers PAYE and VAT", "VAT plus NHIL / GETFund levies"] },
  ZM: { capital: "Lusaka", hubs: "Lusaka, Kitwe, Ndola", tz: "CAT (UTC+2)", industries: "Copper mining, agriculture, energy, tourism", notes: ["Major copper producer", "NAPSA pension and NHIMA health contributions", "VAT 16%"] },
};

const rows = (list) => list.map(([k, v]) => `- **${k}:** ${v}`);

/** Facts lines (for the live model) and a ready-to-read markdown brief (offline). */
export function countryBrief(cc, { asEmployee = false } = {}) {
  const p = packFor(cc);
  if (!p) return null;
  const pol = p.engine?.policy || {};
  const m = MARKET[cc] || {};
  const today = isoDate();
  let filings = [];
  try {
    filings = filingCalendar(cc, today).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 6);
  } catch {
    /* engine without calendar */
  }
  // Merge rows from the engine and the pack without repeating the same topic.
  const merge = (...lists) => { const seen = new Set(); return lists.flat().filter(([k]) => { const key = k.toLowerCase().split(/[ /(]/)[0]; if (seen.has(key)) return false; seen.add(key); return true; }); };
  const sections = [
    { title: "Employment policy", lines: rows(merge(pol["Working time"] || [], pol["Employment terms"] || [], [["Probation", `${p.probationMonths} months (typical)`]])) },
    { title: "Leave & holidays", lines: rows(merge(pol.Leave || [], p.leaveNotes || [])) },
    {
      title: "Statutory compliance",
      lines: [
        `- **Authorities:** ${p.authorities.join(", ")}`,
        `- **Data protection:** ${p.dataLaw}`,
        ...rows(pol["Social security"] || []),
        ...(filings.length ? [`- **Filings coming up:** ${filings.map((f) => `${f.name} (${f.authority}) – ${f.freq.toLowerCase()}, next ${f.due}`).join("; ")}`] : []),
        `- **Onboarding documents:** ${p.documents.join(", ")}`,
      ],
    },
    { title: "Taxes", lines: rows(merge([["Tax year", p.taxYear]], pol["Pay & tax"] || [], [["Pay cycle", p.payCycle], ["Rules effective", p.engine?.RATES?.effective || "—"]])) },
    {
      title: "Market",
      lines: [
        m.capital && `- **Capital:** ${m.capital}`,
        m.hubs && `- **Business hubs:** ${m.hubs}`,
        `- **Currency:** ${p.currency} (${p.symbol}) · **Time zone:** ${m.tz || "—"} · **Working week:** ${p.workWeek}`,
        m.industries && `- **Key industries:** ${m.industries}`,
        ...(m.notes || []).map((n) => `- ${n}`),
        `- **Local languages:** ${p.languages.join(", ")}`,
      ].filter(Boolean),
    },
  ];
  const markdown = [
    `**${p.flag} ${p.name}: policies, statutory compliance, taxes and market**`,
    asEmployee ? "What applies to you as an employee working in this country:" : "",
    ...sections.flatMap((s) => ["", `**${s.title}**`, ...s.lines]),
    "",
    "_Statutory rates come from the built-in country rules. Laws change, so confirm with a local adviser before acting._",
    "\n[[go:/country|Open Country space]]",
  ].filter((x) => x !== "").join("\n");
  const facts = sections.flatMap((s) => s.lines.map((l) => `${s.title}: ${l.replace(/^- /, "").replace(/\*\*/g, "")}`));
  return { pack: p, sections, markdown, facts };
}

/** Does a free-text question ask about a country's rules, compliance, tax or market (rather than "my" data)? */
export function isCountryQuestion(q) {
  const t = String(q || "").toLowerCase();
  if (/\b(complian|statutor|market|regulat|labou?r law|employment law|polic(y|ies)|authorit|filing|industr|business|economy)/.test(t)) return true;
  return /\btax(es)?\b/.test(t) && /\b(rate|slab|regime|system|country|corporate|vat|gst|income tax)\b/.test(t) && !/\bmy\b|payslip/.test(t);
}
