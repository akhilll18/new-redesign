// Employee master field dictionary. One config drives the Super Admin employee form,
// the employee profile (read-only vs self-editable) and the Field reference page.
// Sources: Sahayog HRMS field reference (core + payroll), PeopleHR (contacts, employment), Keka (policies, pay).
//
// editableBy: who can change the field. "super" = Super Admin, "admin" = HR admin, "self" = the employee.
// required: must be filled when the Super Admin saves the record.

export const GRADES = ["P1", "P2", "P3", "P4", "M1", "M2", "M3"];
export const COUNTRIES = [
  { code: "IN", name: "India", currency: "INR" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "NA", name: "Namibia", currency: "NAD" },
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "KE", name: "Kenya", currency: "KES" },
  { code: "NG", name: "Nigeria", currency: "NGN" },
  { code: "BW", name: "Botswana", currency: "BWP" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "MX", name: "Mexico", currency: "MXN" },
  { code: "BR", name: "Brazil", currency: "BRL" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
  { code: "MY", name: "Malaysia", currency: "MYR" },
  { code: "PH", name: "Philippines", currency: "PHP" },
  { code: "ID", name: "Indonesia", currency: "IDR" },
  { code: "GH", name: "Ghana", currency: "GHS" },
  { code: "ZM", name: "Zambia", currency: "ZMW" },
];
export const REGIONS = {
  IN: [["TG", "Telangana"], ["KA", "Karnataka"], ["MH", "Maharashtra"]],
  GB: [["ENG", "England"], ["WLS", "Wales"], ["NIR", "Northern Ireland"], ["SCT", "Scotland"]],
  US: [["TX", "Texas"], ["FL", "Florida"], ["NY", "New York"], ["CA", "California"]],
  AE: [["DXB", "Dubai"], ["AUH", "Abu Dhabi"], ["SHJ", "Sharjah"]],
  SG: [["SG", "Singapore"]],
  NA: [["KH", "Khomas (Windhoek)"], ["ER", "Erongo (Walvis Bay, Swakopmund)"], ["OS", "Oshana (Oshakati)"], ["KE", "ǁKaras (Lüderitz, Keetmanshoop)"], ["OT", "Otjozondjupa"]],
  ZA: [["GP", "Gauteng"], ["WC", "Western Cape"], ["KZN", "KwaZulu-Natal"], ["EC", "Eastern Cape"]],
  KE: [["NBO", "Nairobi"], ["MSA", "Mombasa"], ["KSM", "Kisumu"], ["NKR", "Nakuru"]],
  NG: [["LA", "Lagos"], ["FC", "Abuja (FCT)"], ["RI", "Rivers"], ["OG", "Ogun"]],
  BW: [["GBE", "Gaborone"], ["FRW", "Francistown"], ["MAU", "Maun"]],
  CA: [["ON", "Ontario"]],
  MX: [["CMX", "Ciudad de México"], ["NLE", "Nuevo León"], ["JAL", "Jalisco"]],
  BR: [["SP", "São Paulo"], ["RJ", "Rio de Janeiro"], ["MG", "Minas Gerais"]],
  DE: [["BE", "Berlin"], ["BY", "Bavaria"], ["HE", "Hesse"], ["NW", "North Rhine-Westphalia"]],
  FR: [["IDF", "Île-de-France"], ["ARA", "Auvergne-Rhône-Alpes"], ["PAC", "Provence-Alpes-Côte d’Azur"]],
  IE: [["D", "Dublin"], ["C", "Cork"], ["G", "Galway"]],
  SA: [["RUH", "Riyadh"], ["JED", "Jeddah"], ["DMM", "Dammam"]],
  MY: [["KUL", "Kuala Lumpur"], ["SGR", "Selangor"], ["PNG", "Penang"], ["JHR", "Johor"]],
  PH: [["NCR", "Metro Manila"], ["CEB", "Cebu"], ["DAV", "Davao"]],
  ID: [["JKT", "DKI Jakarta"], ["JBR", "West Java"], ["BLI", "Bali"]],
  GH: [["GA", "Greater Accra"], ["AS", "Ashanti"], ["WR", "Western"]],
  ZM: [["LSK", "Lusaka"], ["CB", "Copperbelt"]],
};

// ── Worker types (SAP SuccessFactors "employee class" / Oracle HCM "worker type & assignment category") ──
// group "employee" = on company payroll as an employee; "contingent" = engaged under a contract with an end date.
// route = default way the person is paid: "payroll" (payslip), "invoice" (worker's own / self-billed invoice), "vendor" (staffing-agency invoice).
export const WORKER_TYPES = [
  { id: "permanent", label: "Permanent employee", short: "Permanent", tone: "good", route: "payroll", tds: "192", basis: "monthly", desc: "On payroll with no end date. Probation, PF/ESI, gratuity and the full leave policy apply." },
  { id: "contract", label: "Contract employee (fixed term)", short: "Contract", tone: "info", route: "payroll", tds: "192", basis: "monthly", desc: "On company payroll for a fixed term, paid monthly, daily or hourly from the contract. Payslips are issued." },
  { id: "freelance", label: "Freelancer", short: "Freelance", tone: "accent", route: "invoice", tds: "194J", basis: "hourly", desc: "Self-employed. Paid against approved timesheets or milestones by invoice; TDS 194J, GST if registered; no PF/ESI or leave." },
  { id: "consultant", label: "Consultant / independent contractor", short: "Consultant", tone: "accent", route: "invoice", tds: "194J", basis: "milestone", desc: "Engaged (often through their own firm) under a statement of work; time-and-material or fixed-fee milestones." },
  { id: "agency", label: "Agency / third-party worker", short: "Agency", tone: "warn", route: "vendor", tds: "194C", basis: "hourly", desc: "Employed and paid by a staffing vendor, who invoices you with a markup. Contract Labour Act licence applies." },
  { id: "intern", label: "Intern / trainee", short: "Intern", tone: "neutral", route: "payroll", tds: "192", basis: "monthly", desc: "Monthly stipend through payroll for a fixed internship period; intern leave policy." },
  { id: "temporary", label: "Temporary / casual worker", short: "Temporary", tone: "neutral", route: "payroll", tds: "192", basis: "daily", desc: "Short assignments paid by the day or hour through payroll, against attendance or timesheets." },
  { id: "apprentice", label: "Apprentice", short: "Apprentice", tone: "neutral", route: "payroll", tds: "192", basis: "monthly", desc: "Apprenticeship contract with a monthly stipend (Apprentices Act 1961)." },
];
export const WORKER_TYPE_BY = Object.fromEntries(WORKER_TYPES.map((w) => [w.id, w]));
export const CONTINGENT = WORKER_TYPES.filter((w) => w.id !== "permanent").map((w) => w.id);
export const ON_PAYROLL = ["permanent", "contract", "intern", "temporary", "apprentice"];
export const SELF_EMPLOYED = ["freelance", "consultant"];
export const PAY_BASIS = [["hourly", "Hourly rate"], ["daily", "Daily rate"], ["monthly", "Monthly rate / stipend"], ["milestone", "Fixed fee · milestones"]];
export const PAY_ROUTES = [["payroll", "Company payroll → payslip"], ["invoice", "Worker invoice (self-billed)"], ["vendor", "Staffing vendor invoice"]];
export const TDS_SECTIONS = [
  ["192", "192 · Salary (slab rates via payroll)", null],
  ["194C", "194C · Contractor (1% individual / 2% others)", 1],
  ["194J", "194J · Professional fees (10%)", 10],
  ["194J_TECH", "194J · Technical services (2%)", 2],
  ["NONE", "None / non-India withholding", 0],
];
export const workerTypeOf = (rec) => rec?.worker_type || (rec?.employment_type === "contract" ? "contract" : rec?.employment_type === "intern" ? "intern" : "permanent");
export const isContingent = (rec) => workerTypeOf(rec) !== "permanent";
export const workerLabel = (rec) => WORKER_TYPE_BY[workerTypeOf(rec)]?.short || "Permanent";
/** Defaults applied when HR picks a worker type on the employee form. */
export function workerDefaults(type) {
  const w = WORKER_TYPE_BY[type] || WORKER_TYPES[0];
  return {
    worker_type: w.id,
    payment_route: w.route,
    tds_section: w.tds,
    pay_basis: w.basis,
    std_hours_week: "40",
    ot_multiplier: w.id === "permanent" ? "" : "1.5",
    leave_policy: ON_PAYROLL.includes(w.id) ? (w.id === "intern" || w.id === "apprentice" ? "intern" : "standard") : "none",
    expense_policy: "standard",
    renewal_option: w.id === "permanent" ? "" : "review",
    nda_signed: w.id === "permanent" ? "" : "no",
    gst_registered: SELF_EMPLOYED.includes(w.id) ? "no" : "",
  };
}
/** Monthly-equivalent cost of a contingent engagement (drives CTC, budgets and analytics). */
export function monthlyEquivalent(rec) {
  const rate = Number(rec?.pay_rate) || 0;
  const hrs = Number(rec?.std_hours_week) || 40;
  const b = rec?.pay_basis;
  if (b === "hourly") return Math.round((rate * hrs * 52) / 12);
  if (b === "daily") return Math.round((rate * (hrs / 8) * 52) / 12);
  if (b === "monthly") return Math.round(rate);
  if (b === "milestone") {
    // Total fee spread over the engagement months.
    const s = rec?.date_of_joining ? new Date(rec.date_of_joining) : null;
    const e = rec?.fixed_term_end_date ? new Date(rec.fixed_term_end_date) : null;
    const months = s && e && e > s ? Math.max(1, Math.round((e - s) / (30.44 * 86400000))) : 12;
    return Math.round(rate / months);
  }
  return 0;
}
/** How the person is paid, resolved from the record (payroll, invoice or vendor). */
export const payRouteOf = (rec) => (isContingent(rec) ? rec?.payment_route || WORKER_TYPE_BY[workerTypeOf(rec)]?.route || "payroll" : "payroll");
/** True when the person is paid through company payroll and gets a payslip. */
export const paysThroughPayroll = (rec) => payRouteOf(rec) === "payroll";
export const RATE_UNIT = { hourly: "/ hour", daily: "/ day", monthly: "/ month", milestone: "total fee" };
export function fieldApplies(f, rec) {
  return !f.workers || f.workers.includes(workerTypeOf(rec));
}
export function sectionApplies(s, rec) {
  return (!s.workers || s.workers.includes(workerTypeOf(rec))) && s.fields.some((f) => fieldApplies(f, rec));
}
export function isRequired(f, rec) {
  return f.requiredFor ? f.requiredFor.includes(workerTypeOf(rec)) : !!f.required;
}

export const EMPLOYEE_SECTIONS = [
  {
    id: "core",
    title: "Personal details",
    source: "Sahayog · Employee database",
    fields: [
      { key: "employee_code", label: "Employee code", type: "text", control: "Read-only", rule: "Assigned automatically: next number after the highest code (EMP001, EMP002 …).", editableBy: [], required: true },
      { key: "worker_type", label: "Worker type", type: "select", options: WORKER_TYPES.map((w) => [w.id, w.label]), control: "Choice cards", rule: "Permanent, contract, freelance, consultant, agency, intern, temporary or apprentice. Decides which sections and fields the form shows, how the person is paid and whether the Contract tab appears.", editableBy: ["super", "admin"], required: true },
      { key: "full_name", label: "Full name", type: "text", control: "Text input", rule: "2–120 characters; spaces trimmed.", min: 2, max: 120, editableBy: ["super"], required: true },
      { key: "designation", label: "Job title", type: "text", control: "Text input", rule: "2–120 characters.", min: 2, max: 120, editableBy: ["super", "admin"], required: true },
      { key: "department", label: "Department", type: "select", options: "departments", control: "Dropdown", rule: "Must be an existing org unit.", editableBy: ["super", "admin"], required: true },
      { key: "reporting_manager", label: "Reporting manager", type: "select", options: "managers", control: "Dropdown", rule: "Optional. Must be a current employee, not the person themselves. Approves leave and expenses first.", editableBy: ["super", "admin"] },
      { key: "grade_code", label: "Grade", type: "select", options: GRADES.map((g) => [g, g]), control: "Dropdown", rule: "P1–P4, M1–M3. P1–P2 are overtime-eligible. Not used for freelancers, consultants or agency workers.", editableBy: ["super"], required: true, workers: ON_PAYROLL },
      { key: "employment_type", label: "Work schedule", type: "select", options: [["full_time", "Full time"], ["part_time", "Part time"], ["shift", "Shift / rota"], ["on_demand", "On demand / as needed"]], control: "Dropdown", rule: "Part time sets FTE below 1. The worker type (above) says whether the person is permanent, contract, freelance …", editableBy: ["super", "admin"], required: true },
      { key: "fte", label: "FTE", type: "select", options: [["1", "1.0 Full-time"], ["0.5", "0.5 Part-time"]], control: "Dropdown", rule: "1.0 or 0.5 (API accepts 0.1–1.0).", editableBy: ["super"], required: true },
      { key: "date_of_joining", label: "Date of joining / engagement start", type: "date", control: "Date picker", rule: "Must be after the date of birth. For contingent workers this is the contract start date.", editableBy: ["super"], required: true },
      { key: "date_of_birth", label: "Date of birth", type: "date", control: "Date picker", rule: "Must be before the date of joining; at least 18 at joining.", editableBy: ["super"], required: true },
      { key: "gender", label: "Gender", type: "select", options: [["F", "Female"], ["M", "Male"], ["X", "Other / undisclosed"]], control: "Dropdown", rule: "One of F, M, X.", editableBy: ["super", "self"], required: true },
      { key: "country_code", label: "Country", type: "select", options: COUNTRIES.map((c) => [c.code, c.name]), control: "Dropdown", rule: "Set when the employee is created; drives payroll rules and currency.", editableBy: ["super"], required: true },
      { key: "region", label: "Work state / region", type: "select", options: "regions", control: "Dropdown", rule: "Required for payroll in IN and US (professional tax / state tax).", editableBy: ["super"], required: true },
      { key: "city", label: "Work location (city)", type: "text", control: "Text input", rule: "Max 80 characters.", max: 80, editableBy: ["super", "admin"], required: true },
      { key: "company_id", label: "Company (legal entity)", type: "select", options: "companies", control: "Dropdown", rule: "The legal entity that employs the person. Drives company / location segregation across the app (header picker), payroll entity and expense booking.", editableBy: ["super", "admin"] },
      { key: "location_id", label: "Location / branch", type: "select", options: "locations", control: "Dropdown", rule: "Office, branch or warehouse of the chosen company. The company follows the location.", editableBy: ["super", "admin"] },
      { key: "status", label: "Account status", type: "text", control: "Read-only", rule: "active · pending_approval · locked · suspended · rejected. Changed from Users & access.", editableBy: [] },
    ],
  },
  {
    id: "contact",
    title: "Contacts",
    source: "PeopleHR · Contacts",
    fields: [
      { key: "email", label: "Work email", type: "email", control: "Text input", rule: "Valid email; unique. Used as the login ID unless one is set.", editableBy: ["super"], required: true },
      { key: "login_id", label: "Login ID", type: "text", control: "Text input", rule: "Unique per user; defaults to the work email.", editableBy: ["super"], required: true },
      { key: "work_phone", label: "Work phone", type: "tel", control: "Phone input", rule: "+91 and 10 digits.", pattern: "^(\\+?91)?[6-9]\\d{9}$", editableBy: ["super", "admin"] },
      { key: "phone", label: "Mobile", type: "tel", control: "Phone input", rule: "+91 and 10 digits. Used for payout alerts.", pattern: "^(\\+?91)?[6-9]\\d{9}$", editableBy: ["super", "self"], required: true },
      { key: "personal_mobile", label: "Personal mobile", type: "tel", control: "Phone input", rule: "Optional. +91 and 10 digits.", pattern: "^(\\+?91)?[6-9]\\d{9}$", editableBy: ["super", "self"] },
      { key: "personal_email", label: "Personal email", type: "email", control: "Text input", rule: "Optional. Valid email.", editableBy: ["super", "self"] },
      { key: "current_address", label: "Current address", type: "textarea", control: "Text area", rule: "Max 300 characters.", max: 300, editableBy: ["super", "self"], required: true },
      { key: "permanent_address", label: "Permanent address", type: "textarea", control: "Text area", rule: "Max 300 characters.", max: 300, editableBy: ["super", "self"] },
      { key: "blood_group", label: "Blood group", type: "select", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => [b, b]), control: "Dropdown", rule: "Optional.", editableBy: ["super", "self"] },
      { key: "emergency_contact_name", label: "Emergency contact", type: "text", control: "Text input", rule: "Name and relationship.", max: 120, editableBy: ["super", "self"] },
      { key: "emergency_contact_phone", label: "Emergency phone", type: "tel", control: "Phone input", rule: "+91 and 10 digits.", pattern: "^(\\+?91)?[6-9]\\d{9}$", editableBy: ["super", "self"] },
    ],
  },
  {
    id: "employment",
    title: "Employment",
    source: "PeopleHR · Employment",
    fields: [
      { key: "probation_status", label: "Probation status", type: "select", options: [["in_probation", "In probation"], ["confirmed", "Confirmed"], ["extended", "Extended"]], control: "Dropdown", rule: "Probation is 6 months from joining by default. Permanent and contract employees only.", editableBy: ["super", "admin"], workers: ["permanent", "contract", "apprentice"] },
      { key: "probation_end_date", label: "Probation end date", type: "date", control: "Date picker", rule: "On or after the date of joining.", editableBy: ["super", "admin"], workers: ["permanent", "contract", "apprentice"] },
      { key: "next_review_date", label: "Next review date", type: "date", control: "Date picker", rule: "Optional.", editableBy: ["super", "admin"] },
      { key: "notice_period", label: "Notice period", type: "select", options: [["7", "7 days"], ["15", "15 days"], ["30", "30 days"], ["60", "60 days"], ["90", "90 days"]], control: "Dropdown", rule: "Per offer letter or contract.", editableBy: ["super", "admin"] },
      { key: "fixed_term_end_date", label: "Contract / engagement end date", type: "date", control: "Date picker", rule: "Required for fixed-term, freelance, consultant, intern, temporary and apprentice engagements; after the start date. Drives renewal alerts.", editableBy: ["super", "admin"], workers: CONTINGENT, requiredFor: ["contract", "freelance", "consultant", "intern", "temporary", "apprentice"] },
      { key: "method_of_recruitment", label: "Method of recruitment", type: "select", options: [["referral", "Employee referral"], ["portal", "Job portal"], ["agency", "Agency"], ["campus", "Campus"], ["direct", "Direct"]], control: "Dropdown", rule: "Optional.", editableBy: ["super", "admin"] },
      { key: "recruitment_cost", label: "Recruitment cost (₹)", type: "number", control: "Number input", rule: "0 or more.", minValue: 0, editableBy: ["super"] },
      { key: "background_check", label: "Background check", type: "select", options: [["pending", "Pending"], ["clear", "Clear"], ["flagged", "Flagged"]], control: "Dropdown", rule: "Must be Clear before confirmation.", editableBy: ["super", "admin"] },
      { key: "right_to_work", label: "Right to work", type: "select", options: [["verified", "Verified"], ["pending", "Pending"]], control: "Dropdown", rule: "ID / visa checked by HR.", editableBy: ["super", "admin"] },
      { key: "shift", label: "Shift", type: "select", options: [["general", "General 09:30–18:30"], ["morning", "Morning 06:00–15:00"], ["night", "Night 21:00–06:00"]], control: "Dropdown", rule: "Late after 09:45 on the general shift.", editableBy: ["super", "admin"] },
      { key: "leave_policy", label: "Leave policy", type: "select", options: [["standard", "Standard India (EL 18 · CL 12 · SL 12 · FL 2)"], ["intern", "Intern (CL 6 · SL 6)"], ["none", "No paid leave (contingent)"]], control: "Dropdown", rule: "Sets leave entitlements. Freelancers, consultants and agency workers have no paid leave.", editableBy: ["super", "admin"], required: true, workers: ON_PAYROLL },
      { key: "expense_policy", label: "Expense policy", type: "select", options: [["standard", "Standard"], ["sales", "Sales & travel"], ["none", "Not assigned"]], control: "Dropdown", rule: "“Not assigned” blocks expense claims.", editableBy: ["super", "admin"], required: true },
    ],
  },
  {
    id: "workforce",
    title: "Workforce & devices",
    source: "Sahayog · Time & attendance / Workforce",
    fields: [
      { key: "attendance_mode", label: "Attendance method", type: "select", options: [["biometric", "Biometric device"], ["geo_mobile", "Geofenced mobile"], ["web", "Web punch"], ["any", "Any method"]], control: "Dropdown", rule: "How the employee may punch in. Biometric = fingerprint / face terminal; geofenced mobile = location + selfie or device biometrics.", editableBy: ["super", "admin"], required: true },
      { key: "primary_geofence", label: "Work location (geofence)", type: "select", options: "geofences", control: "Dropdown", rule: "Office or site whose geofence is checked at punch time.", editableBy: ["super", "admin"], required: true },
      { key: "field_staff", label: "Field staff", type: "select", options: [["no", "No"], ["yes", "Yes"]], control: "Dropdown", rule: "Yes allows punching at client and site geofences and shows the person on the live map while clocked in.", editableBy: ["super", "admin"], required: true },
      { key: "biometric_id", label: "Biometric enrolment ID", type: "text", control: "Text input", rule: "User ID on the attendance terminals (digits). Blank = not enrolled.", pattern: "^\\d{1,8}$", editableBy: ["super", "admin"] },
      { key: "call_tracking", label: "Call tracking", type: "select", options: [["no", "No"], ["yes", "Yes"]], control: "Dropdown", rule: "Yes adds the call log and includes the person in team call reports.", editableBy: ["super", "admin"], required: true },
      { key: "last_promotion", label: "Last promotion date", type: "date", control: "Date picker", rule: "Used in the flight-risk score.", editableBy: ["super", "admin"] },
      { key: "potential", label: "Potential (9-box)", type: "select", options: [["1", "1 · Low"], ["2", "2 · Medium"], ["3", "3 · High"]], control: "Dropdown", rule: "Set during calibration; places the person on the 9-box grid.", editableBy: ["super", "admin"] },
    ],
  },
  {
    id: "engagement",
    title: "Contract & engagement",
    source: "SAP Fieldglass work order · Oracle HCM contingent worker assignment",
    workers: CONTINGENT,
    fields: [
      { key: "pay_basis", label: "Pay basis", type: "select", options: PAY_BASIS, control: "Dropdown", rule: "Hourly and daily rates are paid on approved timesheets; monthly rates are pro-rated for loss-of-pay days; fixed fee is paid per approved milestone.", editableBy: ["super", "admin"], required: true, workers: CONTINGENT },
      { key: "pay_rate", label: "Contract rate", type: "number", control: "Number input", rule: "Per hour, per day, per month, or the total fee for milestone contracts, in the country currency. More than 0.", minValue: 1, maxValue: 100000000, editableBy: ["super", "admin"], required: true, workers: CONTINGENT },
      { key: "std_hours_week", label: "Standard hours per week", type: "number", control: "Number input", rule: "1–60. Hours above this in a week are overtime; also used for the monthly-equivalent cost.", minValue: 1, maxValue: 60, editableBy: ["super", "admin"], required: true, workers: CONTINGENT },
      { key: "ot_multiplier", label: "Overtime rate", type: "select", options: [["1", "1× (no premium)"], ["1.5", "1.5×"], ["2", "2× (Factories Act)"]], control: "Dropdown", rule: "Multiplier on the hourly rate for approved overtime hours.", editableBy: ["super", "admin"], workers: ["contract", "freelance", "agency", "temporary"] },
      { key: "payment_route", label: "How they are paid", type: "select", options: PAY_ROUTES, control: "Dropdown", rule: "Payroll → monthly payslip; worker invoice → self-billed invoice and payment advice; vendor → the agency invoices you.", editableBy: ["super", "admin"], required: true, workers: CONTINGENT },
      { key: "vendor_id", label: "Staffing vendor", type: "select", options: "vendors", control: "Dropdown", rule: "Agency workers only. Vendor master is under Contracts → Vendors.", editableBy: ["super", "admin"], workers: ["agency"], requiredFor: ["agency"] },
      { key: "business_name", label: "Registered business / firm", type: "text", control: "Text input", rule: "Optional. Name on the invoice if the person bills through a firm.", max: 120, editableBy: ["super", "admin", "self"], workers: SELF_EMPLOYED },
      { key: "gst_registered", label: "GST registered", type: "select", options: [["no", "No"], ["yes", "Yes"]], control: "Dropdown", rule: "Yes adds 18% GST to invoices (reverse charge is not applied).", editableBy: ["super", "admin"], workers: SELF_EMPLOYED, requiredFor: SELF_EMPLOYED },
      { key: "gstin", label: "GSTIN", type: "text", control: "Text input", rule: "15 characters, like 36ABCDE1234F1Z5. Required when GST registered.", pattern: "^\\d{2}[A-Z]{5}\\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$", editableBy: ["super", "admin", "self"], workers: SELF_EMPLOYED },
      { key: "tds_section", label: "Tax withholding (TDS)", type: "select", options: TDS_SECTIONS.map(([k, l]) => [k, l]), control: "Dropdown", rule: "192 for anyone on payroll (slab rates); 194J / 194C flat rates for invoices; None outside India.", editableBy: ["super", "admin"], required: true, workers: CONTINGENT },
      { key: "timesheet_approver", label: "Timesheet approver", type: "select", options: "managers", control: "Dropdown", rule: "Approves timesheets and milestones. Blank = reporting manager.", editableBy: ["super", "admin"], workers: CONTINGENT },
      { key: "po_number", label: "Purchase order / SOW no.", type: "text", control: "Text input", rule: "Optional. Printed on invoices and the contract.", max: 30, editableBy: ["super", "admin"], workers: CONTINGENT },
      { key: "cost_centre", label: "Cost centre", type: "text", control: "Text input", rule: "Optional. Defaults to the department.", max: 40, editableBy: ["super", "admin"], workers: CONTINGENT },
      { key: "renewal_option", label: "On expiry", type: "select", options: [["review", "Review 30 days before"], ["auto", "Auto-renew for the same term"], ["end", "End on the end date"]], control: "Dropdown", rule: "Renewal alerts go to HR and the approver 30 and 7 days before the end date.", editableBy: ["super", "admin"], workers: CONTINGENT },
      { key: "nda_signed", label: "NDA / IP assignment signed", type: "select", options: [["no", "Not yet"], ["yes", "Signed"]], control: "Dropdown", rule: "Must be signed before the contract can be activated for freelancers, consultants and agency workers.", editableBy: ["super", "admin"], workers: CONTINGENT },
    ],
  },
  {
    id: "pay",
    title: "Pay & statutory",
    source: "Sahayog · Payroll / Keka · My pay",
    fields: [
      { key: "monthly_gross", label: "Monthly gross", type: "number", control: "Number input", rule: "0 to 100,000,000, in the country currency. For contingent workers it is calculated from the contract rate.", minValue: 0, maxValue: 100000000, editableBy: ["super"], required: true, workers: ["permanent"] },
      { key: "annual_ctc", label: "Annual CTC (₹)", type: "calc", control: "Read-only (calculated)", rule: "12 × gross × exchange rate (+ employer contributions in payroll).", editableBy: [] },
      { key: "pay_cycle", label: "Pay cycle", type: "select", options: [["monthly", "Monthly"]], control: "Dropdown", rule: "Monthly.", editableBy: ["super"] },
      { key: "tax_regime", label: "Tax regime", type: "select", options: [["new", "New regime"], ["old", "Old regime"]], control: "Dropdown", rule: "Employee may switch while the declaration window is open. Payroll workers only.", editableBy: ["super", "self"], required: true, workers: ON_PAYROLL },
      { key: "pan", label: "PAN", type: "text", control: "Text input", rule: "Format AAAAA9999A.", pattern: "^[A-Z]{5}[0-9]{4}[A-Z]$", editableBy: ["super"], required: true },
      { key: "uan", label: "UAN (PF)", type: "text", control: "Text input", rule: "12 digits.", pattern: "^\\d{12}$", editableBy: ["super"], workers: ON_PAYROLL },
      { key: "pf_number", label: "PF number", type: "text", control: "Text input", rule: "EPFO member ID, 10–26 letters, digits or /.", pattern: "^[A-Z0-9/]{10,26}$", editableBy: ["super"], workers: ON_PAYROLL },
      { key: "payment_mode", label: "Payment mode", type: "select", options: [["bank_transfer", "Bank transfer"], ["cheque", "Cheque"], ["cash", "Cash"]], control: "Dropdown", rule: "How salary or fees are paid; shown on the payslip / payment advice.", editableBy: ["super"], required: true, workers: ["permanent", "contract", "freelance", "consultant", "intern", "temporary", "apprentice"] },
      { key: "bank_name", label: "Bank name", type: "text", control: "Text input", rule: "Max 80 characters. Agency workers are paid by their vendor.", max: 80, editableBy: ["super", "admin"], requiredFor: ["permanent", "contract", "freelance", "consultant", "intern", "temporary", "apprentice"] },
      { key: "bank_account", label: "Account number", type: "text", control: "Text input", rule: "9–18 digits. Used for salary, fees, reimbursements and payouts. v10.6: employees change it through a bank-details change request that HR approves.", pattern: "^\\d{9,18}$", editableBy: ["super", "admin"], requiredFor: ["permanent", "contract", "freelance", "consultant", "intern", "temporary", "apprentice"] },
      { key: "bank_ifsc", label: "Bank code (IFSC)", type: "text", control: "Text input", rule: "11 characters, like HDFC0001234.", pattern: "^[A-Z]{4}0[A-Z0-9]{6}$", editableBy: ["super", "admin"], requiredFor: ["permanent", "contract", "freelance", "consultant", "intern", "temporary", "apprentice"] },
    ],
  },
];

export const ALL_FIELDS = EMPLOYEE_SECTIONS.flatMap((s) => s.fields.map((f) => ({ ...f, section: s.title, source: s.source })));

// Validates one employee record for a given editor role. Returns { key: message }.
export function validateEmployee(rec, { role, employees = [] }) {
  const errors = {};
  const INDIA_ONLY = ["pan", "uan", "pf_number", "bank_ifsc", "tax_regime"];
  const overseas = rec.country_code && rec.country_code !== "IN";
  ALL_FIELDS.forEach((f) => {
    if (f.type === "calc" || !f.editableBy.length) return;
    if (overseas && INDIA_ONLY.includes(f.key)) return;
    if (!fieldApplies(f, rec)) return; // field not used for this worker type
    const editable = f.editableBy.includes(role);
    const v = rec[f.key];
    const empty = v === undefined || v === null || String(v).trim() === "";
    if (empty) {
      if (isRequired(f, rec) && role === "super") errors[f.key] = `${f.label} is required.`;
      return;
    }
    if (!editable) return;
    const s = String(v).trim();
    if (f.min && s.length < f.min) errors[f.key] = `At least ${f.min} characters.`;
    if (f.max && s.length > f.max) errors[f.key] = `At most ${f.max} characters.`;
    if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) errors[f.key] = "Enter a valid email.";
    if (f.pattern && !new RegExp(f.pattern).test(f.type === "tel" ? s.replace(/[\s-]/g, "") : s.toUpperCase())) errors[f.key] = f.rule;
    if (f.type === "number") {
      const n = Number(s);
      if (Number.isNaN(n)) errors[f.key] = "Enter a number.";
      else if (f.minValue != null && n < f.minValue) errors[f.key] = `At least ${f.minValue}.`;
      else if (f.maxValue != null && n > f.maxValue) errors[f.key] = `At most ${f.maxValue.toLocaleString("en-IN")}.`;
    }
  });
  if (rec.date_of_birth && rec.date_of_joining) {
    if (rec.date_of_birth >= rec.date_of_joining) errors.date_of_joining = "Date of joining must be after the date of birth.";
    else {
      const age = (new Date(rec.date_of_joining) - new Date(rec.date_of_birth)) / (365.25 * 86400000);
      if (age < 18) errors.date_of_birth = "Employee must be at least 18 at joining.";
    }
  }
  if (rec.probation_end_date && rec.date_of_joining && rec.probation_end_date < rec.date_of_joining) errors.probation_end_date = "Probation cannot end before the date of joining.";
  if (rec.reporting_manager && rec.reporting_manager === rec.employee_code) errors.reporting_manager = "An employee cannot report to themselves.";
  if (role === "super" && rec.login_id) {
    const clash = employees.find((e) => e.login_id?.toLowerCase() === String(rec.login_id).toLowerCase() && e.employee_code !== rec.employee_code);
    if (clash) errors.login_id = `Already used by ${clash.full_name}.`;
  }
  if (role === "super" && rec.country_code && ["IN", "US"].includes(rec.country_code) && !rec.region) errors.region = "Required for payroll in this country.";
  // Worker-type rules (contract, freelance, consultant, agency …)
  if (isContingent(rec)) {
    if (rec.fixed_term_end_date && rec.date_of_joining && rec.fixed_term_end_date <= rec.date_of_joining) errors.fixed_term_end_date = "The end date must be after the engagement start date.";
    if (SELF_EMPLOYED.includes(workerTypeOf(rec)) && rec.gst_registered === "yes" && !String(rec.gstin || "").trim()) errors.gstin = "GSTIN is required when the worker is GST registered.";
    if (rec.payment_route === "vendor" && workerTypeOf(rec) !== "agency") errors.payment_route = "Only agency workers are paid through a staffing vendor.";
    if (rec.payment_route === "payroll" && SELF_EMPLOYED.includes(workerTypeOf(rec))) errors.payment_route = "Freelancers and consultants are self-employed: pay them by invoice, not payroll (misclassification risk).";
    if (rec.pay_basis === "milestone" && rec.payment_route === "payroll") errors.pay_basis = "Fixed-fee milestone contracts are paid by invoice.";
  }
  return errors;
}
