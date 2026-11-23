// Companies (legal entities) and locations (offices, branches, warehouses).
// Every employee belongs to one company and one location. The header "Company · Location" picker
// scopes the whole application for admins and the Super Admin (see AppStore → scopeData).

export const COMPANIES = [
  { company_id: "ONAS-IN", name: "ONAS Global Services Pvt Ltd", short: "ONAS India", country: "IN", currency: "INR", registration: "CIN U72900TG2016PTC110231", tax_id: "PAN AAKCO4521K · TAN HYDO04521E", address: "HITEC City, Hyderabad, Telangana 500081", status: "active" },
  { company_id: "ONAS-UK", name: "ONAS Global Services UK Ltd", short: "ONAS UK & Europe", country: "GB", currency: "GBP", registration: "Companies House 12874401", tax_id: "VAT GB 401 2287 19", address: "1 Canada Square, London E14 5AB", status: "active" },
  { company_id: "ONAS-US", name: "ONAS Americas Inc.", short: "ONAS Americas", country: "US", currency: "USD", registration: "Delaware 7744120", tax_id: "EIN 88-4471203", address: "500 W 2nd St, Austin, TX 78701", status: "active" },
  { company_id: "ONAS-ME", name: "ONAS Middle East FZ-LLC", short: "ONAS Middle East", country: "AE", currency: "AED", registration: "DIFC licence CL-4471", tax_id: "TRN 100448812300003", address: "Gate Village, DIFC, Dubai", status: "active" },
  { company_id: "ONAS-AF", name: "ONAS Africa (Pty) Ltd", short: "ONAS Africa", country: "ZA", currency: "ZAR", registration: "CIPC 2019/447120/07", tax_id: "VAT 4470281133", address: "Sandton, Johannesburg 2196", status: "active" },
  { company_id: "ONAS-AP", name: "ONAS Asia Pacific Pte Ltd", short: "ONAS Asia Pacific", country: "SG", currency: "SGD", registration: "UEN 201944712K", tax_id: "GST M90374471K", address: "Marina Bay, Singapore 018989", status: "active" },
];

// [location_id, name, company_id, country, city, type, geofence_id, cost_centre]
const L = [
  ["IN-HYD-HQ", "Hyderabad HQ · HITEC City", "ONAS-IN", "IN", "Hyderabad", "head_office", "GF-HQ", "CC-IN-HQ"],
  ["IN-HYD-NZP", "Nizampet branch", "ONAS-IN", "IN", "Hyderabad", "branch", "GF-NZP", "CC-IN-NZP"],
  ["IN-HYD-WH", "Shamshabad warehouse", "ONAS-IN", "IN", "Hyderabad", "warehouse", "GF-WH", "CC-IN-WH"],
  ["GB-LDN", "London office", "ONAS-UK", "GB", "London", "office", "GF-LDN", "CC-UK-LDN"],
  ["IE-DUB", "Dublin office · Docklands", "ONAS-UK", "IE", "Dublin", "office", "GF-DUB", "CC-UK-DUB"],
  ["DE-BER", "Berlin office", "ONAS-UK", "DE", "Berlin", "office", "GF-BER", "CC-UK-BER"],
  ["FR-PAR", "Paris office · La Défense", "ONAS-UK", "FR", "Paris", "office", "GF-PAR", "CC-UK-PAR"],
  ["US-AUS", "Austin office", "ONAS-US", "US", "Austin", "office", "GF-AUS", "CC-US-AUS"],
  ["CA-TOR", "Toronto office", "ONAS-US", "CA", "Toronto", "office", "GF-TOR", "CC-US-TOR"],
  ["MX-MEX", "Mexico City office · Reforma", "ONAS-US", "MX", "Mexico City", "office", "GF-MEX", "CC-US-MEX"],
  ["BR-SAO", "São Paulo office · Faria Lima", "ONAS-US", "BR", "São Paulo", "office", "GF-SAO", "CC-US-SAO"],
  ["AE-DXB", "Dubai office · DIFC", "ONAS-ME", "AE", "Dubai", "office", "GF-DXB", "CC-ME-DXB"],
  ["SA-RUH", "Riyadh office · KAFD", "ONAS-ME", "SA", "Riyadh", "office", "GF-RUH", "CC-ME-RUH"],
  ["ZA-JNB", "Johannesburg office · Sandton", "ONAS-AF", "ZA", "Johannesburg", "office", "GF-JNB", "CC-AF-JNB"],
  ["NA-WHK", "Windhoek office", "ONAS-AF", "NA", "Windhoek", "office", "GF-WHK", "CC-AF-WHK"],
  ["KE-NBO", "Nairobi office · Westlands", "ONAS-AF", "KE", "Nairobi", "office", "GF-NBO", "CC-AF-NBO"],
  ["NG-LOS", "Lagos office · Victoria Island", "ONAS-AF", "NG", "Lagos", "office", "GF-LOS", "CC-AF-LOS"],
  ["BW-GBE", "Gaborone office · CBD", "ONAS-AF", "BW", "Gaborone", "office", "GF-GBE", "CC-AF-GBE"],
  ["GH-ACC", "Accra office · Airport City", "ONAS-AF", "GH", "Accra", "office", "GF-ACC", "CC-AF-ACC"],
  ["ZM-LUN", "Lusaka office", "ONAS-AF", "ZM", "Lusaka", "office", "GF-LUN", "CC-AF-LUN"],
  ["SG-SIN", "Singapore office", "ONAS-AP", "SG", "Singapore", "office", "GF-SG", "CC-AP-SIN"],
  ["MY-KUL", "Kuala Lumpur office", "ONAS-AP", "MY", "Kuala Lumpur", "office", "GF-KUL", "CC-AP-KUL"],
  ["PH-MNL", "Manila office · BGC", "ONAS-AP", "PH", "Taguig", "office", "GF-MNL", "CC-AP-MNL"],
  ["ID-JKT", "Jakarta office · Sudirman", "ONAS-AP", "ID", "Jakarta", "office", "GF-JKT", "CC-AP-JKT"],
];
// v10.3: statutory registrations per location. A location with its own registration can run its own payroll
// (Location-wise / Hybrid modes); one without rolls up into head office. Shamshabad warehouse is deliberately unregistered.
export const LOCATION_STATUTORY = {
  "IN-HYD-HQ": { tan: "HYDO04521E", esic_code: "52000123450001001", pt_reg: "TS-PT-36120045", lwf_reg: "TS-LWF-77120", se_licence: "SEA/HYD/ALO/2016/45210" },
  "IN-HYD-NZP": { tan: "HYDO04587K", esic_code: "52000123450011001", pt_reg: "TS-PT-36120871", lwf_reg: "TS-LWF-77544", se_licence: "SEA/HYD/KKP/2021/11873" },
  "GB-LDN": { paye_ref: "120/ON44712", ao_ref: "120PX00447120" },
  "IE-DUB": { paye_reg: "3744712OH" },
  "DE-BER": { betriebsnummer: "44712009", finanzamt: "37/447/12009" },
  "FR-PAR": { siret: "88447120000017", urssaf: "117 447120 0001" },
  "US-AUS": { state_wh: "TX-not-required", sui: "TX 99-447120-5" },
  "CA-TOR": { bn_rp: "844712030RP0001" },
  "MX-MEX": { imss_reg: "Y5144712108" },
  "BR-SAO": { cnpj: "44.712.030/0002-71" },
  "AE-DXB": { mohre: "1447120", wps_id: "0000144712" },
  "SA-RUH": { mol: "9-447120", gosi: "604471200" },
  "ZA-JNB": { paye_za: "7447120345", uif: "U447120345", sdl: "L447120345" },
  "NA-WHK": { employer_tax: "NamRA 4471203", social_reg: "SSC 44712" },
  "KE-NBO": { employer_tax: "KRA PIN P051447120Q", social_reg: "NSSF 4471203" },
  "NG-LOS": { employer_tax: "LIRS 44712030", social_reg: "PenCom ER 447120" },
  "BW-GBE": { employer_tax: "BURS 44712030", social_reg: "—" },
  "GH-ACC": { employer_tax: "GRA C0044712030", social_reg: "SSNIT ER 447120" },
  "ZM-LUN": { employer_tax: "ZRA TPIN 1004471203", social_reg: "NAPSA 447120" },
  "SG-SIN": { cpf_csn: "201944712KPTE01" },
  "MY-KUL": { employer_tax: "LHDN E 4471203-01", social_reg: "PERKESO B3204471203" },
  "PH-MNL": { employer_tax: "BIR TIN 447-120-300-000", social_reg: "SSS 03-4471203-0" },
  "ID-JKT": { employer_tax: "NPWP 44.712.030.0-071.000", social_reg: "BPJS 44712030" },
};
// Company-level registrations and the payroll mode of each legal entity (see src/lib/statutory.js).
export const COMPANY_STATUTORY = {
  "ONAS-IN": { mode: "hybrid", statutory: { pf_code: "TSHYD1234567000" } },
  "ONAS-UK": { mode: "location", statutory: {} },
  "ONAS-US": { mode: "location", statutory: { fein: "88-4471203", rfc: "OAM190412AB1" } },
  "ONAS-ME": { mode: "location", statutory: {} },
  "ONAS-AF": { mode: "location", statutory: {} },
  "ONAS-AP": { mode: "location", statutory: {} },
};
COMPANIES.forEach((c) => Object.assign(c, { payroll_mode: COMPANY_STATUTORY[c.company_id]?.mode || "central", statutory: { ...(COMPANY_STATUTORY[c.company_id]?.statutory || {}) }, default_language: "English" }));

export const LOCATIONS = L.map(([location_id, name, company_id, country, city, type, geofence_id, cost_centre]) => ({ location_id, name, company_id, country, city, type, geofence_id, cost_centre, status: "active", statutory: { ...(LOCATION_STATUTORY[location_id] || {}) } }));

export const LOCATION_TYPES = [["head_office", "Head office"], ["branch", "Branch"], ["office", "Office"], ["warehouse", "Warehouse"], ["plant", "Plant / factory"], ["site", "Client / project site"], ["remote", "Remote hub"]];

// Hyderabad staff are split across the HQ, the Nizampet sales branch and the warehouse.
const IN_SITE = { EMP022: "IN-HYD-NZP", EMP023: "IN-HYD-NZP", EMP024: "IN-HYD-NZP", EMP013: "IN-HYD-WH", EMP054: "IN-HYD-WH" };

/** Default company and location for an employee from their country and city (used for seed and migration). */
export function defaultEntityFor(e, locations = LOCATIONS) {
  const cc = e.country_code || "IN";
  const pin = IN_SITE[e.employee_code];
  const loc = (pin && locations.find((l) => l.location_id === pin))
    || locations.find((l) => l.country === cc && l.city?.toLowerCase() === String(e.city || "").toLowerCase() && l.type !== "warehouse")
    || locations.find((l) => l.country === cc && ["head_office", "office"].includes(l.type))
    || locations.find((l) => l.country === cc)
    || locations[0];
  return { company_id: loc.company_id, location_id: loc.location_id };
}

export function withEntity(e, locations) {
  if (e.company_id && e.location_id) return e;
  return { ...e, ...defaultEntityFor(e, locations) };
}

export const ALL = "ALL";

/** Companies and locations a signed-in user may see. Empty lists on an admin record mean "all". */
export function allowedEntities(user, companies, locations) {
  if (!user || user.role === "superadmin") return { companies, locations };
  if (user.role === "admin") {
    const cs = user.entity_companies?.length ? companies.filter((c) => user.entity_companies.includes(c.company_id)) : companies;
    const cIds = new Set(cs.map((c) => c.company_id));
    const ls = locations.filter((l) => cIds.has(l.company_id) && (!user.entity_locations?.length || user.entity_locations.includes(l.location_id)));
    return { companies: cs, locations: ls };
  }
  return { companies, locations };
}

/** Resolve the header choice to the set of location ids in scope (null = everything). */
export function scopeLocationIds(scope, user, companies, locations) {
  const allowed = allowedEntities(user, companies, locations);
  const restricted = allowed.locations.length !== locations.length;
  let ls = allowed.locations;
  if (scope?.company && scope.company !== ALL) ls = ls.filter((l) => l.company_id === scope.company);
  if (scope?.location && scope.location !== ALL) ls = ls.filter((l) => l.location_id === scope.location);
  if (!restricted && ls.length === locations.length) return null;
  return new Set(ls.map((l) => l.location_id));
}

const EMP_KEY = /^EMP\d+$/;
const KEEP = new Set(["admins", "superAdmins", "companies", "workLocations", "orgUnits", "settings"]);

/**
 * Narrow a data snapshot to the locations in scope: employees, every collection that carries an employee_code,
 * maps keyed by employee code, geofences of other locations and records stamped with another company/location.
 */
export function scopeData(data, locIds) {
  if (!locIds) return data;
  const locs = (data.workLocations || []).filter((l) => locIds.has(l.location_id));
  const companyIds = new Set(locs.map((l) => l.company_id));
  const countries = new Set(locs.map((l) => l.country));
  const empCodes = new Set(data.employees.filter((e) => locIds.has(e.location_id)).map((e) => e.employee_code));
  const keepRow = (row) => {
    if (!row || typeof row !== "object") return true;
    if (row.location_id && !row.employee_code) return locIds.has(row.location_id);
    if (row.company_id && !row.employee_code && !row.location_id) return companyIds.has(row.company_id);
    if (row.employee_code) return empCodes.has(row.employee_code);
    return true;
  };
  const out = { ...data, scoped: { locations: locIds, companies: companyIds, employees: empCodes } };

  // Collections that point at people, sites or countries under other field names. A row with no link at all
  // (an unassigned laptop with no site, an offer typed in by hand) stays visible everywhere.
  const geoLoc = new Map((data.workLocations || []).filter((l) => l.geofence_id).map((l) => [l.geofence_id, l.location_id]));
  const atSite = (gf) => (geoLoc.has(gf) ? locIds.has(geoLoc.get(gf)) : null);
  const person = (code) => (code && EMP_KEY.test(code) ? empCodes.has(code) : null);
  const inCountry = (c) => (c ? countries.has(c) : null);
  const first = (...xs) => xs.find((x) => x !== null && x !== undefined) ?? true;
  const inCompany = (c) => (c ? companyIds.has(c) : null); // v10.14: records stamped with a legal entity
  const reqIds = new Set((data.reqs || []).filter((r) => first(r.location_id ? locIds.has(r.location_id) : null, inCompany(r.company_id), person(r.hiring_manager))).map((r) => r.id));
  const knownReq = new Set((data.reqs || []).map((r) => r.id));
  const candIds = new Set((data.candidates || []).filter((c) => !knownReq.has(c.req_id) || reqIds.has(c.req_id)).map((c) => c.id));
  const knownCand = new Set((data.candidates || []).map((c) => c.id));
  const viaCandidate = (row) => (row.candidate_id && knownCand.has(row.candidate_id) && !row.employee_code ? candIds.has(row.candidate_id) : null);
  const RULES = {
    assets: (a) => first(person(a.assigned_to), atSite(a.location), inCompany(a.company_id)),
    devices: (x) => first(atSite(x.geofence_id)),
    itTickets: (t) => first(person(t.requester)),
    reqs: (r) => reqIds.has(r.id),
    candidates: (c) => candIds.has(c.id),
    interviews: (x) => first(viaCandidate(x)),
    atsNotes: (x) => first(viaCandidate(x)),
    offers: (x) => first(viaCandidate(x)),
    succession: (s) => first(person(s.incumbent)),
    feedback: (f) => {
      const a = person(f.from), b = person(f.to);
      return a === null && b === null ? true : Boolean(a || b);
    },
    clients: (c) => first(person(c.owner)),
    events: (e) => first(person(e.owner)),
    meetings: (m) => first(person(m.organizer)),
    complianceItems: (c) => first(inCountry(c.country)),
    exits: (x) => first(inCountry(x.ctry || x.country)),
  };

  for (const [k, v] of Object.entries(data)) {
    if (KEEP.has(k)) continue;
    if (RULES[k] && Array.isArray(v)) out[k] = v.filter((row) => (row && typeof row === "object" ? (row.employee_code ? empCodes.has(row.employee_code) : RULES[k](row)) : true));
    else if (k === "employees") out.employees = v.filter((e) => empCodes.has(e.employee_code));
    else if (k === "geofences") out.geofences = v.filter((g) => countries.has(g.country));
    else if (Array.isArray(v)) out[k] = v.some((x) => x && typeof x === "object" && ("employee_code" in x || "location_id" in x || "company_id" in x)) ? v.filter(keepRow) : v;
    else if (v && typeof v === "object" && Object.keys(v).some((x) => EMP_KEY.test(x))) out[k] = Object.fromEntries(Object.entries(v).filter(([x]) => !EMP_KEY.test(x) || empCodes.has(x)));
  }
  return out;
}

export function scopeLabel(scope, companies, locations) {
  const c = scope?.company && scope.company !== ALL ? companies.find((x) => x.company_id === scope.company) : null;
  const l = scope?.location && scope.location !== ALL ? locations.find((x) => x.location_id === scope.location) : null;
  if (l) return { company: c?.short || companies.find((x) => x.company_id === l.company_id)?.short, location: l.name };
  if (c) return { company: c.short, location: "All locations" };
  return { company: "All companies", location: "All locations" };
}
