// v10.10 · EZY HR AI — built-in language understanding (works with no AI key; Claude improves it when connected).
// Pulls names, e-mails, phones, dates, amounts, countries, departments, people and quoted text out of a sentence.

export const norm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
// "ravi kumar" → "Ravi Kumar"; keeps what was typed in capitals (FZE, LLP, McDonald, iOS stays as typed after the first letter)
export const titleCase = (s) => String(s || "").replace(/\s+/g, " ").trim().split(" ").map((w) => (/^[A-Z0-9&.-]{2,6}$/.test(w) ? w : w.charAt(0).toUpperCase() + (/^[a-z]/.test(w.slice(1)) || w.slice(1) === w.slice(1).toLowerCase() ? w.slice(1) : w.slice(1)))).join(" ");
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const COUNTRY_WORDS = {
  IN: ["india", "indian", "bharat"], AE: ["uae", "united arab emirates", "dubai", "abu dhabi"], SG: ["singapore"], GB: ["uk", "united kingdom", "england", "britain", "london"],
  US: ["usa", "united states", "america", "us"], NA: ["namibia"], ZA: ["south africa"], KE: ["kenya", "nairobi"], NG: ["nigeria", "lagos"], BW: ["botswana"],
  CA: ["canada"], MX: ["mexico"], BR: ["brazil"], DE: ["germany", "berlin"], FR: ["france", "paris"], AU: ["australia", "sydney"], SA: ["saudi", "saudi arabia", "riyadh"],
  MY: ["malaysia", "kuala lumpur"], NL: ["netherlands", "amsterdam"], IE: ["ireland", "dublin"], JP: ["japan", "tokyo"],
};
export const CURRENCY_OF = { IN: "INR", AE: "AED", SG: "SGD", GB: "GBP", US: "USD", NA: "NAD", ZA: "ZAR", KE: "KES", NG: "NGN", BW: "BWP", CA: "CAD", MX: "MXN", BR: "BRL", DE: "EUR", FR: "EUR", AU: "AUD", SA: "SAR", MY: "MYR", NL: "EUR", IE: "EUR", JP: "JPY" };
const CITY_COUNTRY = { hyderabad: "IN", bengaluru: "IN", bangalore: "IN", mumbai: "IN", pune: "IN", chennai: "IN", delhi: "IN", "new delhi": "IN", gurugram: "IN", gurgaon: "IN", noida: "IN", kolkata: "IN", ahmedabad: "IN", kochi: "IN", jaipur: "IN", vizag: "IN", visakhapatnam: "IN", coimbatore: "IN", dubai: "AE", "abu dhabi": "AE", singapore: "SG", london: "GB", manchester: "GB", "new york": "US", "san francisco": "US", nairobi: "KE", lagos: "NG", windhoek: "NA", johannesburg: "ZA", "cape town": "ZA", toronto: "CA", berlin: "DE", paris: "FR", sydney: "AU", riyadh: "SA" };

// approximate city centres (for a location's attendance geofence) and the payroll region where the app knows it
export const CITY_GEO = { hyderabad: [17.385, 78.4867, "TG"], bengaluru: [12.9716, 77.5946, "KA"], bangalore: [12.9716, 77.5946, "KA"], mumbai: [19.076, 72.8777, "MH"], pune: [18.5204, 73.8567, "MH"],
  chennai: [13.0827, 80.2707], delhi: [28.6139, 77.209], "new delhi": [28.6139, 77.209], gurugram: [28.4595, 77.0266], gurgaon: [28.4595, 77.0266], noida: [28.5355, 77.391], kolkata: [22.5726, 88.3639],
  ahmedabad: [23.0225, 72.5714], kochi: [9.9312, 76.2673], jaipur: [26.9124, 75.7873], vizag: [17.6868, 83.2185], visakhapatnam: [17.6868, 83.2185], coimbatore: [11.0168, 76.9558], dubai: [25.2048, 55.2708],
  "abu dhabi": [24.4539, 54.3773], singapore: [1.3521, 103.8198], london: [51.5074, -0.1278, "ENG"], manchester: [53.4808, -2.2426, "ENG"], "new york": [40.7128, -74.006, "NY"], "san francisco": [37.7749, -122.4194, "CA"],
  nairobi: [-1.2921, 36.8219], lagos: [6.5244, 3.3792], windhoek: [-22.5609, 17.0658], johannesburg: [-26.2041, 28.0473], "cape town": [-33.9249, 18.4241], toronto: [43.6532, -79.3832],
  berlin: [52.52, 13.405], paris: [48.8566, 2.3522], sydney: [-33.8688, 151.2093], riyadh: [24.7136, 46.6753] };
export const geoOf = (city) => CITY_GEO[norm(city)] || null;
export function countryIn(text) {
  const t = ` ${norm(text)} `;
  for (const [code, words] of Object.entries(COUNTRY_WORDS)) for (const w of words) if (t.includes(` ${w} `) || t.includes(` ${w},`) || t.includes(` ${w}.`)) return code;
  for (const [city, code] of Object.entries(CITY_COUNTRY)) if (t.includes(` ${city} `) || t.includes(` ${city},`)) return code;
  return null;
}
export function cityIn(text) {
  const t = ` ${norm(text)} `;
  const hit = Object.keys(CITY_COUNTRY).filter((c) => t.includes(` ${c} `) || t.includes(` ${c},`)).sort((a, b) => b.length - a.length)[0];
  return hit ? titleCase(hit) : null;
}

export const emailIn = (text) => (String(text).match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/) || [])[0] || null;
export const phoneIn = (text) => { const m = String(text).match(/(\+?\d[\d\s-]{8,14}\d)/); return m ? m[1].replace(/\s+/g, " ").trim() : null; };
export const quotedIn = (text) => (String(text).match(/["“”']([^"“”']{2,80})["“”']/) || [])[1] || null;

// ₹45,000 · 45k · 6 lakh · 6.5L · 1.2 crore · 50000 per month · 9 lpa (per year → monthly when asked)
export function amountIn(text, { monthly = false } = {}) {
  const t = norm(text).replace(/,/g, "");
  const m = t.match(/(?:₹|rs\.?|inr|\$|usd|aed|£)?\s*(\d+(?:\.\d+)?)\s*(k|thousand|l|lakh|lakhs|lac|lpa|cr|crore|crores|m|million)?\b(\s*(?:per|\/|a)\s*(month|year|annum|yr|mo)|\s*pa\b|\s*lpa\b)?/);
  if (!m) return null;
  let n = Number(m[1]);
  const unit = m[2] || "";
  if (/^k|thousand/.test(unit)) n *= 1000;
  else if (/^(l|lakh|lakhs|lac|lpa)$/.test(unit)) n *= 100000;
  else if (/^(cr|crore|crores)$/.test(unit)) n *= 10000000;
  else if (/^(m|million)$/.test(unit)) n *= 1000000;
  const yearly = /year|annum|yr|pa|lpa/.test(m[3] || "") || unit === "lpa";
  if (monthly && yearly) n = Math.round(n / 12);
  return Math.round(n);
}
export const numberIn = (text) => { const m = norm(text).match(/\b(\d+(?:\.\d+)?)\b/); return m ? Number(m[1]) : null; };
const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20 };
export function countIn(text, nouns) {
  const t = norm(text);
  const re = new RegExp(`\\b(\\d+|${Object.keys(WORD_NUM).join("|")})\\s+(?:${nouns})`);
  const m = t.match(re);
  return m ? Number(m[1]) || WORD_NUM[m[1]] : null;
}

// Dates: today, tomorrow, yesterday, next monday, this friday, in 3 days, 25 dec, dec 25, 25/12/2026, 2026-12-25
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
export function datesIn(text, now = new Date()) {
  const t = norm(text);
  const out = [];
  const push = (d, at) => { if (d && !Number.isNaN(d.getTime())) out.push({ at, date: iso(d) }); };
  let m;
  const reIso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = reIso.exec(t))) push(new Date(+m[1], +m[2] - 1, +m[3]), m.index);
  const reDmy = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/g;
  while ((m = reDmy.exec(t))) push(new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]), m.index);
  const reDm = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join("|")})[a-z]*(?:\\s+(\\d{4}))?`, "g");
  while ((m = reDm.exec(t))) { const y = m[3] ? +m[3] : now.getFullYear(); let d = new Date(y, MONTHS.indexOf(m[2]), +m[1]); if (!m[3] && d < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60)) d = new Date(y + 1, MONTHS.indexOf(m[2]), +m[1]); push(d, m.index); }
  const reMd = new RegExp(`\\b(${MONTHS.join("|")})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "g");
  while ((m = reMd.exec(t))) { if (out.some((o) => Math.abs(o.at - m.index) < 4)) continue; push(new Date(m[3] ? +m[3] : now.getFullYear(), MONTHS.indexOf(m[1]), +m[2]), m.index); }
  const rel = [[/\btoday\b/, 0], [/\btomorrow\b/, 1], [/\bday after tomorrow\b/, 2], [/\byesterday\b/, -1]];
  for (const [re, add] of rel) { const r = t.match(re); if (r) push(new Date(now.getFullYear(), now.getMonth(), now.getDate() + add), r.index); }
  const inN = t.match(/\bin (\d+) (day|days|week|weeks)\b/);
  if (inN) push(new Date(now.getFullYear(), now.getMonth(), now.getDate() + +inN[1] * (/week/.test(inN[2]) ? 7 : 1)), inN.index);
  const dow = t.match(new RegExp(`\\b(next|this|on|coming)?\\s*(${DOW.join("|")})\\b`));
  if (dow) { const want = DOW.indexOf(dow[2]); let add = (want - now.getDay() + 7) % 7; if (add === 0 || dow[1] === "next") add += add === 0 ? 7 : 0; push(new Date(now.getFullYear(), now.getMonth(), now.getDate() + add), dow.index); }
  out.sort((a, b) => a.at - b.at);
  return [...new Map(out.map((o) => [o.date, o])).values()].map((o) => o.date);
}
export function periodIn(text, now = new Date()) {
  const t = norm(text);
  const first = (y, m) => iso(new Date(y, m, 1));
  const last = (y, m) => iso(new Date(y, m + 1, 0));
  if (/\bthis month\b/.test(t)) return [first(now.getFullYear(), now.getMonth()), iso(now)];
  if (/\blast month\b|\bprevious month\b/.test(t)) return [first(now.getFullYear(), now.getMonth() - 1), last(now.getFullYear(), now.getMonth() - 1)];
  if (/\bthis year\b|\bytd\b|year to date/.test(t)) return [first(now.getFullYear(), 0), iso(now)];
  if (/\blast year\b/.test(t)) return [first(now.getFullYear() - 1, 0), last(now.getFullYear() - 1, 11)];
  if (/\bthis week\b/.test(t)) { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [iso(d), iso(now)]; }
  if (/\blast (7|seven) days\b/.test(t)) { const d = new Date(now); d.setDate(d.getDate() - 6); return [iso(d), iso(now)]; }
  if (/\blast (30|thirty) days\b/.test(t)) { const d = new Date(now); d.setDate(d.getDate() - 29); return [iso(d), iso(now)]; }
  if (/\btoday\b/.test(t)) return [iso(now), iso(now)];
  const m = t.match(new RegExp(`\\b(${MONTHS.join("|")})[a-z]*\\s*(\\d{4})?\\b`));
  if (m && !/\d{1,2}\s*$/.test(t.slice(0, m.index))) { const y = m[2] ? +m[2] : now.getFullYear(); const mi = MONTHS.indexOf(m[1]); return [first(y, mi), last(y, mi)]; }
  const ds = datesIn(text, now);
  if (ds.length >= 2) return [ds[0], ds[1]];
  return null;
}

// The words after a marker ("named Ravi Kumar in Sales" → "Ravi Kumar"), stopping at the next keyword.
const STOP = "in|at|for|as|with|from|to|on|under|reporting|joining|joins|starting|salary|ctc|email|e-mail|phone|mobile|dob|born|department|dept|team|location|city|country|code|reason|because|and|who|which|that|,|\\.|;";
export function phraseAfter(text, markers) {
  const src = String(text).replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, " , ").replace(/(\+?\d[\d\s-]{8,14}\d)/g, " , ");
  for (const mk of markers) {
    const re = new RegExp(`\\b(?:${mk})\\s+(.+?)(?=\\s+(?:${STOP})\\b|[,.;]|$)`, "i");
    const m = src.match(re);
    if (m && m[1].trim()) return m[1].trim().replace(/^["“'”]|["“'”]$/g, "");
  }
  return null;
}
// The best match of a list of names inside the text (longest first): departments, companies, people, leave types…
export function pickFrom(text, items, label = (x) => x, extra = () => []) {
  const t = ` ${norm(text).replace(/[?!:;()"“”]/g, " ")} `;
  let best = null, bestLen = 0;
  for (const it of items || []) {
    for (const cand of [label(it), ...extra(it)].filter(Boolean)) {
      const c = norm(cand);
      if (c.length < 2) continue;
      if (t.includes(` ${c} `) || t.includes(` ${c},`) || t.includes(` ${c}.`) || t.includes(` ${c}'s `)) { if (c.length > bestLen) { best = it; bestLen = c.length; } }
    }
  }
  return best;
}
// Fuzzy score of a query against a phrase (word starts, then substrings) — powers as-you-type suggestions.
export function fuzzy(q, phrase) {
  const a = norm(q), b = norm(phrase);
  if (!a) return 0;
  if (b.startsWith(a)) return 100 - b.length / 10;
  const words = a.split(" ").filter(Boolean);
  let s = 0;
  for (const w of words) { if (b.split(/[\s·/,-]+/).some((x) => x.startsWith(w))) s += 20; else if (b.includes(w)) s += 8; else s -= 6; }
  return s;
}
export const codeFrom = (name, max = 12) => String(name || "").toUpperCase().replace(/&/g, " AND ").replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !["PVT", "PRIVATE", "LTD", "LIMITED", "LLP", "INC", "THE", "AND", "OF"].includes(w)).map((w, i, all) => (all.length === 1 ? w.slice(0, 6) : w.slice(0, i === 0 ? 4 : 3))).join("-").slice(0, max).replace(/-$/, "") || "NEW";
export const slugCode = (name, max = 6) => { const w = String(name || "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean); return (w.length === 1 ? w[0].slice(0, Math.min(3, max)) : w.map((x) => x[0]).join("").slice(0, max)) || "X"; };
// "Night shift allowance" → NIGHT_SHIFT_ALLOWANCE (≤ max)
export const fieldCode = (name, max = 20) => { const w = String(name || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean); let out = w.join("_"); if (out.length > max) out = w.map((x) => x.slice(0, Math.max(3, Math.floor(max / w.length) - 1))).join("_"); return out.slice(0, max).replace(/_$/, "") || "FIELD"; };
export { iso as isoDay };
