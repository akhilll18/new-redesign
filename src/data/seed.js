import { freshCompany } from "./freshCompany.js";
// Master data and sample transactions for the role-based portal.
// Replace with API responses (README → API contract). Demo passwords are SHA-256 here; the server must use bcrypt.
import { daysAgo, isoDate, DAY, sampleDocDataUrl } from "../lib/utils.js";
import { DEFAULT_COMPANY } from "./payslipFields.js";
import { buildOps } from "./seedOps.js";
import { buildCollabSeed } from "./seedCollab.js";
import { buildPayrollSuiteSeed } from "./seedPayrollSuite.js";
import { buildSuiteSeed } from "./seedSuite.js";
import { buildContractSeed } from "./seedContracts.js";
import { buildPayslipDesignSeed } from "./payslipDesign.js";
import { buildPayslipSeed, buildOfferSeed } from "./seedPayslips.js";
import { DEFAULT_OFFER_COMPANY } from "./offerFields.js";
import { COMPANIES, LOCATIONS, defaultEntityFor } from "./entities.js";
import { applyImport, demoFeed } from "../lib/expenseHub.js";

export const APP_CONFIG = {
  productName: "EZY HR",
  companyName: "ONAS Global Services",
  storageKey: "peoplehub-roles-v3",
};

const HASH = {
  "Points@2026": "368f496798f50667c206141909d7707a99af1adc8faa3993733e54adaf78299e",
  "Welcome@123": "c75f28325cfa028ea13872f977a29e0e87c99a4f390fe260f24d7e1f05fb8d75",
  4321: "fe2592b42a727e977f055947385b709cc82b16b9a87f88c6abf3900d65d0cdc3",
};

// v10.10: the app starts as a clean company — the Super Admin and the company set-up, no sample people or activity.
// The full sample company (buildDemoSeed) is kept for the server's automated tests and the 10-lakh load data.
export function buildSeed() {
  const demo = buildDemoSeed();
  const sa = demo.superAdmins[0];
  return { ...freshCompany(demo, { full_name: sa.full_name, email: sa.email, login_id: sa.login_id, designation: "Super Admin", keepEntities: false }), v109: true, v110: true };
}
// v10.9: only the Super Admin can sign in out of the box. Every other login (admins, employees, contract staff)
// is created by the Super Admin in Users & access — "Create admin", or "Create login" for an existing person.
export const DEMO_ACCOUNTS = [
  { role: "superadmin", label: "Super Admin", login_id: "praveen.kumar@peoplehub.demo", password: "Points@2026", pin: "4321", note: "PIN 4321 · creates every other login" },
];

// People keep their records, history and content; only their sign-in credentials are removed.
export function withoutLogins(d) {
  const strip = (u) => ({ ...u, password_hash: null, security_pin_hash: null, must_reset: false, failed_attempts: 0, has_login: false });
  return { ...d, employees: (d.employees || []).map(strip), admins: (d.admins || []).map(strip) };
}

// Org master. org_unit_id equals the department name used across PeopleHub pages.
const orgUnits = [
  { org_unit_id: "Head Office", name: "Head Office", parent_unit: null },
  { org_unit_id: "Engineering", name: "Engineering", parent_unit: "Head Office" },
  { org_unit_id: "Data Migration", name: "Data Migration", parent_unit: "Engineering" },
  { org_unit_id: "Design", name: "Design", parent_unit: "Head Office" },
  { org_unit_id: "People", name: "People", parent_unit: "Head Office" },
  { org_unit_id: "Finance", name: "Finance", parent_unit: "Head Office" },
  { org_unit_id: "Operations", name: "Operations", parent_unit: "Head Office" },
  { org_unit_id: "Marketing", name: "Marketing", parent_unit: "Head Office" },
  { org_unit_id: "Sales", name: "Sales", parent_unit: "Head Office" },
  { org_unit_id: "IT", name: "IT", parent_unit: "Head Office" },
];

// [code, name, department, title, manager, joined days ago, monthly equivalent, worker fields]
const CONTINGENT_DEMO = [
  ["EMP050", "Arjun Mehta", "Engineering", "Contract Frontend Developer", "EMP007", 160, 112667, { worker_type: "contract", pay_basis: "hourly", pay_rate: 650, std_hours_week: 40, ot_multiplier: "1.5", payment_route: "payroll", tds_section: "192", end_in: 21, timesheet_approver: "EMP007", po_number: "PO-ENG-2291", nda_signed: "yes", renewal_option: "review" }],
  ["EMP051", "Pooja Iyer", "Marketing", "Content Marketing Specialist (Contract)", "EMP005", 420, 70000, { worker_type: "contract", pay_basis: "monthly", pay_rate: 70000, std_hours_week: 40, ot_multiplier: "1", payment_route: "payroll", tds_section: "192", end_in: 125, nda_signed: "yes", renewal_option: "auto" }],
  ["EMP052", "Rohan Das", "Design", "Freelance UX Designer", "EMP006", 300, 208000, { worker_type: "freelance", pay_basis: "hourly", pay_rate: 1200, std_hours_week: 40, ot_multiplier: "1", payment_route: "invoice", tds_section: "194J", gst_registered: "yes", gstin: "36AAKPD4521K1Z9", business_name: "Rohan Das Design Studio", end_in: 65, nda_signed: "yes", renewal_option: "review", leave_policy: "none", uan: "", pf_number: "" }],
  ["EMP053", "Leela Krishnan", "Data Migration", "Data Governance Consultant", "EMP009", 75, 100000, { worker_type: "consultant", pay_basis: "milestone", pay_rate: 600000, std_hours_week: 30, ot_multiplier: "1", payment_route: "invoice", tds_section: "194J", gst_registered: "no", business_name: "LK Advisory LLP", end_in: 105, nda_signed: "no", renewal_option: "end", leave_policy: "none", uan: "", pf_number: "" }],
  ["EMP054", "Manoj Yadav", "Operations", "Warehouse Operations Associate (Agency)", "EMP005", 400, 78000, { worker_type: "agency", pay_basis: "hourly", pay_rate: 450, std_hours_week: 40, ot_multiplier: "2", payment_route: "vendor", vendor_id: "VEN-01", tds_section: "194C", end_in: 330, nda_signed: "yes", renewal_option: "auto", leave_policy: "none", uan: "", pf_number: "", bank_name: "", bank_account: "", bank_ifsc: "" }],
  ["EMP055", "Sana Sheikh", "Engineering", "Software Engineering Intern", "EMP007", 50, 25000, { worker_type: "intern", pay_basis: "monthly", pay_rate: 25000, std_hours_week: 40, ot_multiplier: "1", payment_route: "payroll", tds_section: "192", end_in: 130, nda_signed: "yes", renewal_option: "end", leave_policy: "intern" }],
];
function contingentExtra(doj, x) {
  const end = isoDate(Date.now() + x.end_in * DAY);
  return { fixed_term_end_date: end, end_in: undefined, probation_status: x.worker_type === "contract" ? "confirmed" : "", notice_period: x.worker_type === "contract" ? "30" : "15", cost_centre: "", grade_code: ["contract", "intern"].includes(x.worker_type) ? "P1" : "", tax_regime: ["freelance", "consultant", "agency"].includes(x.worker_type) ? "" : "new", employment_type: "full_time" };
}

let phoneSeq = 0;
function emp(code, name, dept, designation, manager, dojDaysAgo, grade, gross, extra = {}) {
  phoneSeq += 1;
  const parts = name.toLowerCase().split(" ");
  const login = `${parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0]}@peoplehub.demo`;
  const n = code.slice(-3);
  const doj = isoDate(Date.now() - dojDaysAgo * DAY);
  return {
    employee_code: code,
    full_name: name,
    designation,
    department: dept,
    reporting_manager: manager,
    grade_code: grade,
    employment_type: "full_time",
    fte: "1",
    date_of_joining: doj,
    date_of_birth: `19${88 + (phoneSeq % 10)}-0${1 + (phoneSeq % 9)}-1${phoneSeq % 9}`,
    gender: ["F", "M"][phoneSeq % 2],
    country_code: "IN",
    region: "TG",
    city: "Hyderabad",
    email: login,
    login_id: login,
    work_phone: `+91 40${n}55${n}1`.slice(0, 14),
    phone: `+91 98${n}04${n}2`.slice(0, 14),
    personal_mobile: "",
    personal_email: "",
    current_address: `Flat ${100 + phoneSeq}, Blooming Dale Road, Nizampet, Hyderabad, Telangana 500090`,
    permanent_address: "",
    blood_group: ["O+", "B+", "A+", "AB+"][phoneSeq % 4],
    emergency_contact_name: "",
    emergency_contact_phone: "",
    probation_status: dojDaysAgo > 183 ? "confirmed" : "in_probation",
    probation_end_date: isoDate(Date.now() - (dojDaysAgo - 183) * DAY),
    next_review_date: isoDate(Date.now() + ((phoneSeq * 23) % 120) * DAY),
    notice_period: grade.startsWith("M") ? "90" : "60",
    fixed_term_end_date: "",
    method_of_recruitment: ["referral", "portal", "campus", "agency"][phoneSeq % 4],
    recruitment_cost: 15000 + phoneSeq * 2500,
    background_check: "clear",
    right_to_work: "verified",
    shift: "general",
    leave_policy: "standard",
    expense_policy: "standard",
    monthly_gross: gross,
    pay_cycle: "monthly",
    tax_regime: "new",
    pan: `ABCPR${1000 + phoneSeq * 7}K`.slice(0, 10),
    uan: `1009${String(88000000 + phoneSeq * 1371).slice(0, 8)}`,
    bank_name: "HDFC Bank",
    bank_account: `5010${n}88${n}21`,
    bank_ifsc: "HDFC0001234",
    profile_photo: null,
    status: "active",
    must_reset: false,
    failed_attempts: 0,
    password_hash: HASH["Points@2026"],
    last_login: null,
    hr_synced_at: daysAgo(2),
    ...extra,
  };
}

const employees = [
  emp("EMP001", "Akhil Reddy", "Engineering", "Associate Software Engineer", "EMP007", 500, "P1", 58333, { last_login: daysAgo(1, 9) }),
  emp("EMP002", "Swetha Reddy", "People", "People Operations Lead", "EMP005", 1020, "M1", 160000),
  emp("EMP003", "Ashok Kumar", "Finance", "Senior Accountant", "EMP005", 1130, "P3", 120000),
  emp("EMP004", "Kartik", "Engineering", "Software Engineer", "EMP007", 580, "P2", 90000),
  emp("EMP005", "Praveen", "Operations", "Operations Head", null, 980, "M2", 270000),
  emp("EMP006", "Vikram", "Design", "Product Designer", "EMP005", 720, "P2", 95000),
  emp("EMP007", "Bindu", "Engineering", "Engineering Manager", "EMP005", 1740, "M2", 285000, { last_login: daysAgo(0, 9) }),
  emp("EMP008", "Sneha Kulkarni", "Data Migration", "Data Engineer", "EMP009", 1380, "P2", 98000),
  emp("EMP009", "Suresh Babu", "Data Migration", "Lead - Data Migration", "EMP007", 2600, "M1", 175000),
  emp("EMP010", "Rahul Verma", "Data Migration", "Associate Data Engineer", "EMP009", 20, "P1", 50000, { must_reset: true, password_hash: HASH["Welcome@123"] }),
  emp("EMP011", "Kiran Patil", "Engineering", "QA Engineer", "EMP007", 480, "P2", 82000, { status: "locked", failed_attempts: 5 }),
  emp("EMP025", "Ravi Teja", "IT", "IT Administrator", "EMP005", 900, "P3", 110000),
  emp("EMP012", "Meera Nair", "Engineering", "Software Engineer", "EMP007", 4, "P2", 90000, { status: "pending_approval", must_reset: true, password_hash: HASH["Welcome@123"] }),
  emp("EMP013", "Divya Menon", "Operations", "Operations Executive", "EMP005", 1100, "P1", 52000),
  emp("EMP014", "Nisha Gupta", "People", "HR Executive", "EMP002", 830, "P1", 55000, { status: "suspended" }),
  emp("EMP015", "Ritu Sharma", "Marketing", "Marketing Executive", "EMP005", 400, "P1", 60000),
  // Overseas staff (multi-territory payroll through the Sahayog country engines)
  emp("EMP018", "Oliver Bennett", "Sales", "Account Manager – UK", "EMP024", 700, "P3", 5200, { country_code: "GB", region: "ENG", city: "London", pan: "", uan: "", bank_name: "Barclays", bank_ifsc: "", tax_regime: "", payroll_profile: { tax_code: "1257L", pension: "enrolled" } }),
  emp("EMP019", "Maya Thompson", "Engineering", "Solutions Engineer – US", "EMP007", 900, "P3", 9500, { country_code: "US", region: "TX", city: "Austin", pan: "", uan: "", bank_name: "Chase", bank_ifsc: "", tax_regime: "", payroll_profile: { filing: "single", k401: 5 } }),
  emp("EMP020", "Omar Haddad", "Sales", "Business Development – UAE", "EMP024", 520, "P3", 22000, { country_code: "AE", region: "DXB", city: "Dubai", pan: "", uan: "", bank_name: "Emirates NBD", bank_ifsc: "", tax_regime: "", payroll_profile: { national: "expat", iloe: "yes" } }),
  emp("EMP021", "Wei Lin Tan", "Data Migration", "Data Engineer – Singapore", "EMP009", 610, "P2", 7800, { country_code: "SG", region: "SG", city: "Singapore", pan: "", uan: "", bank_name: "DBS", bank_ifsc: "", tax_regime: "", payroll_profile: { residency: "citizen" } }),
  // ONAS · Africa region (country payroll engines NA, ZA, KE, NG, BW)
  emp("EMP030", "Ndapewa Shikongo", "Operations", "HR & Payroll Consultant – Namibia", "EMP005", 640, "P3", 32000, { country_code: "NA", region: "KH", city: "Windhoek", pan: "", uan: "", bank_name: "Bank Windhoek", bank_ifsc: "", tax_regime: "", current_address: "12 Robert Mugabe Avenue, Windhoek", payroll_profile: { pension_ee: 7, pension_er: 10, ssc_number: "SSC-0458812", tin: "", week_days: "5" } }),
  emp("EMP031", "Lerato Mokoena", "Finance", "Payroll Specialist – South Africa", "EMP003", 820, "P3", 42000, { country_code: "ZA", region: "GP", city: "Johannesburg", pan: "", uan: "", bank_name: "Standard Bank", bank_ifsc: "", tax_regime: "", current_address: "45 Rivonia Road, Sandton, Johannesburg", payroll_profile: { retirement_pct: 7.5, medical_members: 2, tax_number: "0123456789" } }),
  emp("EMP032", "Wanjiru Kamau", "Engineering", "Software Engineer – Kenya", "EMP007", 410, "P2", 180000, { country_code: "KE", region: "NBO", city: "Nairobi", pan: "", uan: "", bank_name: "Equity Bank", bank_ifsc: "", tax_regime: "", current_address: "Westlands, Nairobi", payroll_profile: { kra_pin: "A012345678Z", nssf_no: "NSSF-778812", sha_no: "" } }),
  emp("EMP033", "Chinedu Okafor", "Sales", "Business Development – Nigeria", "EMP024", 300, "P3", 850000, { country_code: "NG", region: "LA", city: "Lagos", pan: "", uan: "", bank_name: "GTBank", bank_ifsc: "", tax_regime: "", current_address: "Victoria Island, Lagos", payroll_profile: { annual_rent: 3000000, nhf: "yes", tin: "", pfa: "Stanbic IBTC Pension" } }),
  emp("EMP034", "Kagiso Molefe", "Data Migration", "Data Analyst – Botswana", "EMP009", 520, "P2", 18000, { country_code: "BW", region: "GBE", city: "Gaborone", pan: "", uan: "", bank_name: "First National Bank Botswana", bank_ifsc: "", tax_regime: "", current_address: "Plot 54, CBD, Gaborone", payroll_profile: { pension_pct: 5, pension_er: 10, omang: "" } }),
  // ONAS · AMER, EMEA, ASIA and more AFRICA
  emp("EMP035", "Emily Tremblay", "Engineering", "Software Engineer – Canada", "EMP007", 450, "P3", 8500, { country_code: "CA", region: "ON", city: "Toronto", pan: "", uan: "", bank_name: "RBC", bank_ifsc: "", tax_regime: "", current_address: "Toronto", payroll_profile: { sin: "046 454 286", td1: "basic" } }),
  emp("EMP036", "Sofía Hernández", "Sales", "Account Executive – Mexico", "EMP024", 380, "P2", 45000, { country_code: "MX", region: "CMX", city: "Mexico City", pan: "", uan: "", bank_name: "BBVA México", bank_ifsc: "", tax_regime: "", current_address: "Mexico City", payroll_profile: { rfc: "HEHS900101AB1", curp: "HEHS900101MDFRRF09", nss: "12345678901" } }),
  emp("EMP037", "Lucas Oliveira", "Engineering", "Backend Developer – Brazil", "EMP007", 560, "P2", 12000, { country_code: "BR", region: "SP", city: "São Paulo", pan: "", uan: "", bank_name: "Itaú", bank_ifsc: "", tax_regime: "", current_address: "São Paulo", payroll_profile: { cpf: "123.456.789-09", dependents: 1, regime: "general" } }),
  emp("EMP038", "Lena Schmidt", "Data Migration", "Data Consultant – Germany", "EMP009", 700, "P3", 5200, { country_code: "DE", region: "BE", city: "Berlin", pan: "", uan: "", bank_name: "Deutsche Bank", bank_ifsc: "", tax_regime: "", current_address: "Berlin", payroll_profile: { tax_class: "1", church: "no", children: 0, tax_id: "12 345 678 901" } }),
  emp("EMP039", "Camille Dubois", "Marketing", "Marketing Manager – France", "EMP005", 820, "M1", 4200, { country_code: "FR", region: "IDF", city: "Paris", pan: "", uan: "", bank_name: "BNP Paribas", bank_ifsc: "", tax_regime: "", current_address: "Paris", payroll_profile: { pas_rate: "", status: "cadre", nir: "2 90 01 75 123 456 78" } }),
  emp("EMP040", "Aoife Murphy", "Finance", "Payroll Analyst – Ireland", "EMP003", 610, "P3", 4500, { country_code: "IE", region: "D", city: "Dublin", pan: "", uan: "", bank_name: "AIB", bank_ifsc: "", tax_regime: "", current_address: "Dublin", payroll_profile: { ppsn: "1234567TA", status: "single" } }),
  emp("EMP041", "Faisal Al-Otaibi", "Operations", "Operations Lead – Saudi Arabia", "EMP005", 900, "M1", 28000, { country_code: "SA", region: "RUH", city: "Riyadh", pan: "", uan: "", bank_name: "Al Rajhi Bank", bank_ifsc: "", tax_regime: "", current_address: "Riyadh", payroll_profile: { national: "saudi_new", iqama: "1012345678" } }),
  emp("EMP042", "Nurul Aisyah", "Engineering", "QA Engineer – Malaysia", "EMP007", 330, "P2", 7500, { country_code: "MY", region: "KUL", city: "Kuala Lumpur", pan: "", uan: "", bank_name: "Maybank", bank_ifsc: "", tax_regime: "", current_address: "Kuala Lumpur", payroll_profile: { citizen: "citizen", tin: "IG12345678090" } }),
  emp("EMP043", "Miguel Santos", "Operations", "HR Operations – Philippines", "EMP005", 500, "P2", 45000, { country_code: "PH", region: "NCR", city: "Taguig", pan: "", uan: "", bank_name: "BDO", bank_ifsc: "", tax_regime: "", current_address: "Taguig", payroll_profile: { tin: "123-456-789-000", sss_no: "34-1234567-8" } }),
  emp("EMP044", "Putri Wulandari", "Data Migration", "Data Engineer – Indonesia", "EMP009", 420, "P2", 18000000, { country_code: "ID", region: "JKT", city: "Jakarta", pan: "", uan: "", bank_name: "Bank Mandiri", bank_ifsc: "", tax_regime: "", current_address: "Jakarta", payroll_profile: { ptkp: "K/1", npwp: "3171234567890001" } }),
  emp("EMP045", "Kwame Mensah", "Sales", "Sales Executive – Ghana", "EMP024", 360, "P2", 9500, { country_code: "GH", region: "GA", city: "Accra", pan: "", uan: "", bank_name: "GCB Bank", bank_ifsc: "", tax_regime: "", current_address: "Accra", payroll_profile: { ghana_card: "GHA-123456789-0", ssnit_no: "C012345678901" } }),
  emp("EMP046", "Chanda Mwila", "Finance", "Accountant – Zambia", "EMP003", 480, "P2", 15000, { country_code: "ZM", region: "LSK", city: "Lusaka", pan: "", uan: "", bank_name: "Zanaco", bank_ifsc: "", tax_regime: "", current_address: "Lusaka", payroll_profile: { tpin: "1001234567", napsa_no: "123456789" } }),
  // Sales team (field staff with call tracking)
  emp("EMP022", "Neha Kapoor", "Sales", "Sales Executive", "EMP024", 300, "P1", 45000),
  emp("EMP023", "Aditya Rao", "Sales", "Sales Executive", "EMP024", 160, "P1", 42000),
  emp("EMP024", "Sanjay Reddy", "Sales", "Sales Manager – India", "EMP005", 1500, "M1", 165000),
  // Contingent workforce (v8.7 contract management): one of each worker type
  ...CONTINGENT_DEMO.map(([code, name, dept, title, mgr, doj, gross, extra]) => emp(code, name, dept, title, mgr, doj, "P1", gross, { ...extra, ...contingentExtra(doj, extra) })),
];

// Workforce, device and talent attributes per employee (feeds attendance, geofencing, calls, monitoring, 9-box).
const OPS = {
  EMP001: { primary_geofence: "GF-HQ", biometric_id: "1001", engagement: 3.9, last_promotion: null, potential: 2, attendance_mode: "any" },
  EMP002: { primary_geofence: "GF-HQ", biometric_id: "1002", engagement: 4.1, potential: 2 },
  EMP003: { primary_geofence: "GF-HQ", biometric_id: "1003", engagement: 3.6, potential: 2 },
  EMP004: { primary_geofence: "GF-HQ", biometric_id: "1004", engagement: 3.2, potential: 3 },
  EMP005: { primary_geofence: "GF-HQ", biometric_id: "1005", engagement: 4.3, potential: 3 },
  EMP006: { primary_geofence: "GF-HQ", biometric_id: "1006", engagement: 2.8, potential: 2 },
  EMP007: { primary_geofence: "GF-HQ", biometric_id: "1007", engagement: 4.0, potential: 3 },
  EMP008: { primary_geofence: "GF-NZP", biometric_id: "1008", engagement: 3.4, potential: 2, field_staff: "yes" },
  EMP009: { primary_geofence: "GF-NZP", biometric_id: "1009", engagement: 3.8, potential: 2 },
  EMP010: { primary_geofence: "GF-NZP", biometric_id: "1010", engagement: 3.5, potential: 1 },
  EMP011: { primary_geofence: "GF-HQ", biometric_id: "1011", engagement: 3.0, potential: 1 },
  EMP012: { primary_geofence: "GF-HQ", biometric_id: "", engagement: 3.5, potential: 2 },
  EMP013: { primary_geofence: "GF-WH", biometric_id: "1013", engagement: 3.3, potential: 1, call_tracking: "yes", attendance_mode: "biometric" },
  EMP014: { primary_geofence: "GF-HQ", biometric_id: "1014", engagement: 2.9, potential: 1 },
  EMP015: { primary_geofence: "GF-HQ", biometric_id: "1015", engagement: 3.7, potential: 2, call_tracking: "yes" },
  EMP018: { primary_geofence: "GF-LDN", biometric_id: "", engagement: 3.9, potential: 2, call_tracking: "yes", attendance_mode: "geo_mobile", field_staff: "yes" },
  EMP019: { primary_geofence: "GF-AUS", biometric_id: "", engagement: 4.2, potential: 3, attendance_mode: "web" },
  EMP020: { primary_geofence: "GF-DXB", biometric_id: "", engagement: 3.1, potential: 2, call_tracking: "yes", attendance_mode: "geo_mobile", field_staff: "yes" },
  EMP021: { primary_geofence: "GF-SG", biometric_id: "", engagement: 3.8, potential: 2, attendance_mode: "web" },
  EMP022: { primary_geofence: "GF-HQ", biometric_id: "1022", engagement: 3.6, potential: 2, call_tracking: "yes", attendance_mode: "geo_mobile", field_staff: "yes" },
  EMP023: { primary_geofence: "GF-HQ", biometric_id: "1023", engagement: 3.2, potential: 2, call_tracking: "yes", attendance_mode: "geo_mobile", field_staff: "yes" },
  EMP024: { primary_geofence: "GF-HQ", biometric_id: "1024", engagement: 3.9, potential: 3, call_tracking: "yes", attendance_mode: "any", field_staff: "yes" },
  EMP030: { primary_geofence: "GF-WHK", biometric_id: "", engagement: 4.0, potential: 3, attendance_mode: "web" },
  EMP031: { primary_geofence: "GF-JNB", biometric_id: "", engagement: 3.7, potential: 2, attendance_mode: "web" },
  EMP032: { primary_geofence: "GF-NBO", biometric_id: "", engagement: 3.9, potential: 3, attendance_mode: "web" },
  EMP033: { primary_geofence: "GF-LOS", biometric_id: "", engagement: 3.4, potential: 2, call_tracking: "yes", attendance_mode: "geo_mobile", field_staff: "yes" },
  EMP034: { primary_geofence: "GF-GBE", biometric_id: "", engagement: 3.6, potential: 2, attendance_mode: "web" },
  EMP035: { primary_geofence: "GF-TOR", biometric_id: "", engagement: 3.7, potential: 2, attendance_mode: "web" },
  EMP036: { primary_geofence: "GF-MEX", biometric_id: "", engagement: 3.7, potential: 2, attendance_mode: "web" },
  EMP037: { primary_geofence: "GF-SAO", biometric_id: "", engagement: 3.7, potential: 2, attendance_mode: "web" },
  EMP038: { primary_geofence: "GF-BER", biometric_id: "", engagement: 3.7, potential: 2, attendance_mode: "web" },
  EMP039: { primary_geofence: "GF-PAR", biometric_id: "", engagement: 3.7, potential: 2, attendance_mode: "web" },
  EMP040: { primary_geofence: "GF-DUB", biometric_id: "", engagement: 3.7, potential: 2, attendance_mode: "web" },
  EMP041: { primary_geofence: "GF-RUH", biometric_id: "", engagement: 3.7, potential: 2, attendance_mode: "web" },
  EMP042: { primary_geofence: "GF-KUL", biometric_id: "", engagement: 3.7, potential: 2, attendance_mode: "web" },
  EMP043: { primary_geofence: "GF-MNL", biometric_id: "", engagement: 3.7, potential: 2, attendance_mode: "web" },
  EMP044: { primary_geofence: "GF-JKT", biometric_id: "", engagement: 3.7, potential: 2, attendance_mode: "web" },
  EMP045: { primary_geofence: "GF-ACC", biometric_id: "", engagement: 3.7, potential: 2, attendance_mode: "web" },
  EMP046: { primary_geofence: "GF-LUN", biometric_id: "", engagement: 3.7, potential: 2, attendance_mode: "web" },
};
employees.forEach((e, i) => {
  Object.assign(e, { attendance_mode: "biometric", field_staff: "no", call_tracking: "no", primary_geofence: "GF-HQ", biometric_id: "", engagement: 3.5, potential: 2, last_promotion: isoDate(Date.now() - (300 + i * 97) * DAY), payroll_profile: e.payroll_profile || {}, payment_mode: "bank_transfer", pf_number: (e.country_code || "IN") === "IN" ? `TSHYD00412870000${String(i + 1).padStart(6, "0")}` : "" }, OPS[e.employee_code] || {});
  if (OPS[e.employee_code]?.last_promotion === null) e.last_promotion = e.date_of_joining;
  // Self-employed and agency workers are not in PF; agency workers are paid by their vendor.
  if (["freelance", "consultant", "agency"].includes(e.worker_type)) Object.assign(e, { pf_number: "", uan: "", payment_mode: e.worker_type === "agency" ? "" : "bank_transfer", attendance_mode: e.worker_type === "agency" ? "biometric" : "web" });
  if (!e.worker_type) e.worker_type = "permanent";
});

// Admins are separate logins. modules = which approvals they finalise.
const admins = [
  { admin_code: "ADM01", access_profile: "hr", locale_access: false, full_name: "Swetha Reddy", email: "swetha.reddy@peoplehub.demo", login_id: "swetha.reddy@peoplehub.demo", employee_code: "EMP002", org_units: ["Head Office"], modules: ["leave", "accounts", "payslips", "offers", "attendance", "location", "performance", "recruitment", "onboarding", "monitoring", "calls", "wellness", "workforce", "learning", "bgv", "compliance", "contracts"], permissions_scope: ["approve", "bulk", "reassign", "export", "flag", "escalate", "people"], mfa_status: "enabled", status: "active", failed_attempts: 0, must_reset: false, password_hash: HASH["Points@2026"], last_login: daysAgo(0, 9), created_at: daysAgo(400) },
  { admin_code: "ADM02", access_profile: "finance", locale_access: false, full_name: "Ashok Kumar", email: "ashok.kumar@peoplehub.demo", login_id: "ashok.kumar@peoplehub.demo", employee_code: "EMP003", org_units: ["Head Office"], modules: ["expense", "advance", "loan", "payroll", "benefits", "compliance", "contracts"], permissions_scope: ["approve", "bulk", "export", "flag", "escalate"], mfa_status: "enabled", status: "active", failed_attempts: 0, must_reset: false, password_hash: HASH["Points@2026"], last_login: daysAgo(1, 10), created_at: daysAgo(380) },
  { admin_code: "ADM03", full_name: "Suresh Babu", email: "suresh.babu@peoplehub.demo", login_id: "suresh.babu.admin@peoplehub.demo", employee_code: "EMP009", org_units: ["Data Migration"], modules: ["leave"], permissions_scope: ["approve", "export"], mfa_status: "pending_setup", status: "suspended", failed_attempts: 0, must_reset: false, password_hash: HASH["Points@2026"], last_login: daysAgo(40, 10), created_at: daysAgo(200) },
  { admin_code: "ADM04", access_profile: "it", locale_access: false, full_name: "Ravi Teja", email: "ravi.teja@peoplehub.demo", login_id: "ravi.teja@peoplehub.demo", employee_code: "EMP025", org_units: ["Head Office"], modules: ["it", "assets"], permissions_scope: ["approve", "bulk", "export", "flag", "escalate"], mfa_status: "enabled", status: "active", failed_attempts: 0, must_reset: false, password_hash: HASH["Points@2026"], last_login: daysAgo(0, 9), created_at: daysAgo(300) },
];

const superAdmins = [
  { superadmin_code: "SA001", employee_code: "EMP005", full_name: "Praveen Kumar M", email: "praveen.kumar@peoplehub.demo", login_id: "praveen.kumar@peoplehub.demo", security_pin_hash: HASH[4321], mfa_secret: "JBSW Y3DP EHPK 3PXP", status: "active", failed_attempts: 0, must_reset: false, password_hash: HASH["Points@2026"], last_login: daysAgo(1, 18) },
];

// Points: Category master and Points rule master
const categories = [
  { category_id: "CAT-INV", name: "Innovation & Ideas", max_points: 500, active: true },
  { category_id: "CAT-CUS", name: "Customer Appreciation", max_points: 300, active: true },
  { category_id: "CAT-LRN", name: "Learning & Certification", max_points: 400, active: true },
  { category_id: "CAT-SAH", name: "Sahayog (Peer Support)", max_points: 200, active: true },
  { category_id: "CAT-CSR", name: "CSR & Volunteering", max_points: 250, active: true },
  { category_id: "CAT-PRC", name: "Process Improvement", max_points: 450, active: true },
];
const rules = [
  { rule_id: "RULE-01", category: "CAT-INV", sub_category: "Idea implemented in production", points: 300, validity_days: 60, doc_required: true, active: true },
  { rule_id: "RULE-02", category: "CAT-INV", sub_category: "Patent or IP disclosure filed", points: 500, validity_days: 90, doc_required: true, active: true },
  { rule_id: "RULE-03", category: "CAT-INV", sub_category: "Hackathon winner", points: 250, validity_days: 30, doc_required: true, active: true },
  { rule_id: "RULE-04", category: "CAT-CUS", sub_category: "Written client appreciation", points: 150, validity_days: 30, doc_required: true, active: true },
  { rule_id: "RULE-05", category: "CAT-CUS", sub_category: "Successful go-live", points: 300, validity_days: 45, doc_required: true, active: true },
  { rule_id: "RULE-06", category: "CAT-LRN", sub_category: "Professional certification", points: 400, validity_days: 60, doc_required: true, active: true },
  { rule_id: "RULE-07", category: "CAT-LRN", sub_category: "Internal course completed", points: 100, validity_days: 30, doc_required: true, active: true },
  { rule_id: "RULE-08", category: "CAT-SAH", sub_category: "Mentoring a new joiner", points: 150, validity_days: 60, doc_required: true, active: true },
  { rule_id: "RULE-09", category: "CAT-SAH", sub_category: "Covering a colleague's critical work", points: 100, validity_days: 15, doc_required: true, active: true },
  { rule_id: "RULE-10", category: "CAT-CSR", sub_category: "Volunteering day", points: 200, validity_days: 30, doc_required: true, active: true },
  { rule_id: "RULE-11", category: "CAT-PRC", sub_category: "Automation saving 10+ hours a month", points: 450, validity_days: 60, doc_required: true, active: true },
  { rule_id: "RULE-12", category: "CAT-PRC", sub_category: "Runbook or documentation", points: 120, validity_days: 30, doc_required: true, active: true },
];

// Leave policy (Keka-style types, India)
const leaveTypes = [
  { code: "EL", name: "Earned leave", annual: 18, carry_forward: 30, min_notice_days: 7, doc_after_days: null, active: true },
  { code: "CL", name: "Casual leave", annual: 12, carry_forward: 0, min_notice_days: 1, doc_after_days: null, active: true },
  { code: "SL", name: "Sick leave", annual: 12, carry_forward: 0, min_notice_days: 0, doc_after_days: 2, active: true },
  { code: "FL", name: "Floater leave", annual: 2, carry_forward: 0, min_notice_days: 1, doc_after_days: null, floater_only: true, active: true },
  { code: "LOP", name: "Loss of pay", annual: null, carry_forward: 0, min_notice_days: 0, doc_after_days: null, active: true },
];

const y = new Date().getFullYear();
const holidays = [
  { date: `${y}-01-26`, name: "Republic Day", type: "holiday" },
  { date: `${y}-03-04`, name: "Holi", type: "holiday" },
  { date: `${y}-08-15`, name: "Independence Day", type: "holiday" },
  { date: `${y}-10-02`, name: "Gandhi Jayanti", type: "holiday" },
  { date: `${y}-10-19`, name: "Mahaashtami", type: "floater" },
  { date: `${y}-10-20`, name: "Dussehra", type: "holiday" },
  { date: `${y}-11-08`, name: "Diwali", type: "holiday" },
  { date: `${y}-12-25`, name: "Christmas Day", type: "holiday" },
  { date: `${y + 1}-01-01`, name: "New Year's Day", type: "holiday" },
];

// Expense policy (per item limits, ₹)
const expenseCategories = [
  { code: "TRAVEL", name: "Travel (air / rail / bus)", limit: 15000, receipt_always: true },
  { code: "STAY", name: "Accommodation (per night)", limit: 5000, receipt_always: true },
  { code: "FOOD", name: "Food & meals (per day)", limit: 1000, receipt_always: false },
  { code: "LOCAL", name: "Local conveyance", limit: 1500, receipt_always: false },
  { code: "PHONE", name: "Internet & phone (monthly)", limit: 1000, receipt_always: true },
  { code: "CLIENT", name: "Client entertainment", limit: 5000, receipt_always: true },
  { code: "SUPPLY", name: "Office supplies", limit: 2000, receipt_always: true },
  { code: "OTHER", name: "Other", limit: 2000, receipt_always: true },
];

const defaultSettings = {
  // Video conferencing for meetings and interviews (System settings → Video conferencing)
  conferencing: { default_provider: "jitsi", google_client_id: "", ms_client_id: "", ms_tenant: "organizations" },
  payslip_company: DEFAULT_COMPANY,
  offer_company: DEFAULT_OFFER_COMPANY,
  offer_email_subject: "Offer of employment – {designation} at {company}",
  offer_email_body: "Dear {name},\n\nCongratulations! Please find attached your offer letter for the position of {designation}, with a joining date of {joining_date}.\n\nPlease review the terms, sign the letter and the annexures, and reply to this email with your acceptance. Bring signed copies on your joining date.\n\nWe look forward to welcoming you to {company}.\n\nWarm regards,\nHR Team, {company}",
  payslip_email_on_release: true,
  payslip_email_subject: "Your payslip for {month} – {company}",
  payslip_email_body: "Dear {name},\n\nYour payslip for {month} is now available in EZY HR under Pay & benefits → My payslips. Net payable: {net}.\n\nFor any questions, raise an HR support request.\n\nRegards,\nHR & Payroll\n{company}",
  session_timeout_min: 15,
  // v10.6: approvals when the reporting manager is absent / missing — "skip_level", "department_head" or "hr".
  leave_fallback: "skip_level",
  // v10.6: HR & IT support response targets (TAT).
  support_tat: { hr_hours: 1, it_days: 1, it_min_minutes: 30, it_max_minutes: 60 },
  // v10.7: loans open automatically after 1 year of service unless Finance switches a person off.
  loan_auto_enable: true,
  // v10.3: country & currency follow the work location (frozen); default language English.
  lock_country_to_location: true,
  default_language: "English",
  // v10.3: contract and freelance workers get "Request leave" only — no pay & payslips, leave balances, spend card;
  // benefits & wellness only once the engagement is longer than long_term_days.
  restricted_worker_types: ["contract", "freelance"],
  long_term_days: 365,
  // v10.4: interns, contract and freelance workers carry zero leave balances and raise request-level leave only.
  zero_leave_worker_types: ["intern", "contract", "freelance"],
  max_failed_attempts: 5,
  password_min_length: 8,
  mfa_admin_required: true,
  mfa_superadmin_required: true,
  otp_ttl_sec: 120,
  max_file_mb: 5,
  allowed_file_types: ["pdf", "jpg", "jpeg", "png"],
  approval_sla_days: 3,
  point_value_inr: 1,
  min_redeem_points: 100,
  auto_credit_on_approval: true,
  duplicate_window_days: 7,
  // Approval chain per module: steps joined by "_" — "manager", "admin" (that module's admin), "it", "hr", "finance" (v10.11)
  workflow: { leave: "manager_admin", expense: "manager_admin", advance: "manager_admin", loan: "manager_admin", regularize: "manager_admin", asset: "manager_admin", screenoff: "manager", asset_purchase: "manager_it_hr_finance", itsupport: "manager_it" },
  receipt_required_above: 200,
  expense_claim_window_days: 60,
  max_advance_inr: 50000,
  advance_settle_days: 30,
  loan_max_multiple: 2,
  loan_max_tenure_months: 12,
  // Attendance and geofencing
  shift_start: "09:30",
  late_after: "09:45",
  shift_hours: 8,
  geofence_enforcement: "flag", // block · flag · allow
  selfie_required_geo: true,
  biometric_device_verification: true,
  regularize_window_days: 7,
  // Live location and monitoring (privacy-first defaults)
  location_tracking: "clocked_in", // off · clocked_in · work_hours
  location_ping_min: 5,
  activity_tracking: true,
  activity_detail: "categories", // categories · apps
  screenshots: "off",
  // v10.6: consent removed from the monitoring policy — the company policy covers everyone during work hours.
  monitoring_consent_required: false,
  managers_see_team_activity: true,
  monitoring_retention_days: 90,
  work_hours_start: "08:00",
  work_hours_end: "20:00",
  // Calls
  call_daily_target: 25,
  call_talk_target_min: 60,
  call_source: "mobile_app",
  // Assets
  asset_depreciation_years: 3,
  // Performance
  merit_budget_pct: 8,
  benefits_window_open: true,
};

// ── Points claims ─────────────────────────────────────────
function step(level, approver, status, at, note = "") {
  return { level, approver, status, at, note };
}

function sub(n, empCode, ruleId, actDays, pts, status, extra = {}) {
  const rule = rules.find((r) => r.rule_id === ruleId);
  const e = employees.find((x) => x.employee_code === empCode);
  const subDays = extra.subDays ?? Math.max(0, actDays - 2);
  const mgr = e.reporting_manager;
  const history = [{ status: "Draft", at: daysAgo(subDays + 0.2, 10), by: empCode, note: "" }];
  const steps = [];
  if (status !== "Draft") history.push({ status: "Submitted", at: daysAgo(subDays, 11), by: empCode, note: "Auto-validation passed" });
  const managerDone = !["Draft", "Submitted"].includes(status) || extra.stage === "admin";
  if (status !== "Draft") steps.push(step("manager", mgr, mgr ? (managerDone ? (status === "Rejected" && extra.rejectedBy === "manager" ? "rejected" : "approved") : "pending") : "skipped", managerDone ? daysAgo(Math.max(0, subDays - 0.5), 12) : null, managerDone && mgr ? extra.managerNote || "Looks right." : ""));
  if (managerDone && mgr && status !== "Draft" && extra.rejectedBy !== "manager") history.push({ status: "Manager Approved", at: daysAgo(Math.max(0, subDays - 0.5), 12), by: mgr, note: extra.managerNote || "" });
  const decided = Math.max(0, subDays - 1);
  if (["Under Review", "Credited", "On Hold", "Escalated"].includes(status) || (status === "Rejected" && extra.rejectedBy !== "manager")) history.push({ status: "Under Review", at: daysAgo(decided, 15), by: "ADM01", note: "" });
  if (status === "On Hold") history.push({ status: "On Hold", at: daysAgo(decided, 16), by: "ADM01", note: extra.admin_remarks || "" });
  if (status === "Escalated") history.push({ status: "Escalated", at: daysAgo(decided, 16), by: "ADM01", note: extra.escalation?.note || "" });
  if (status === "Rejected") history.push({ status: "Rejected", at: extra.approval_timestamp, by: extra.approver_admin_code, note: extra.rejection_reason });
  if (status === "Credited") {
    history.push({ status: "Approved", at: extra.approval_timestamp, by: "ADM01", note: extra.admin_remarks || "" });
    history.push({ status: "Credited", at: extra.approval_timestamp, by: "SYSTEM", note: `${extra.approved_points} points credited` });
  }
  if (["Credited", "Rejected"].includes(status) && extra.rejectedBy !== "manager") steps.push(step("admin", "ADM01", status === "Credited" ? "approved" : "rejected", extra.approval_timestamp));
  else if (managerDone && status !== "Draft") steps.push(step("admin", "ADM01", "pending", null));
  return {
    submission_id: `SUB-${y}-${String(n).padStart(4, "0")}`,
    employee_code: empCode,
    category_id: rule.category,
    rule_id: ruleId,
    description: extra.description || "",
    points_requested: pts,
    activity_date: isoDate(Date.now() - actDays * DAY),
    supporting_document: status === "Draft" ? null : { name: `${ruleId.toLowerCase()}-evidence.svg`, size: 2400 + n * 310, type: "image/svg+xml", data_url: sampleDocDataUrl(rule.sub_category, extra.description || "") },
    witness: extra.witness || "",
    remarks: "",
    declaration: status !== "Draft",
    status,
    stage: status === "Draft" ? null : ["Submitted"].includes(status) && !managerDone ? "manager" : ["Credited", "Rejected", "Withdrawn"].includes(status) ? null : "admin",
    steps,
    manager_code: mgr,
    created_at: history[0].at,
    submitted_at: status === "Draft" ? null : history[1].at,
    assigned_admin: status === "Draft" ? null : "ADM01",
    admin_decision: extra.admin_decision || null,
    approved_points: extra.approved_points ?? null,
    rejection_reason: extra.rejection_reason || "",
    admin_remarks: extra.admin_remarks || "",
    approval_timestamp: extra.approval_timestamp || null,
    approver_admin_code: extra.approver_admin_code || null,
    flags: extra.flags || [],
    flagged: extra.flagged || null,
    escalation: extra.escalation || null,
    override: null,
    history,
  };
}

const submissions = [
  sub(1, "EMP001", "RULE-06", 70, 400, "Credited", { description: "Cleared AWS Certified Solutions Architect – Associate. Certificate ID attached.", admin_decision: "Approve", approved_points: 400, approver_admin_code: "ADM01", approval_timestamp: daysAgo(64, 12) }),
  sub(2, "EMP001", "RULE-08", 40, 150, "Credited", { description: "Mentored two new joiners through their first 30 days.", admin_decision: "Approve", approved_points: 120, approver_admin_code: "ADM01", approval_timestamp: daysAgo(35, 12), admin_remarks: "Approved 120: one mentee joined mid-period." }),
  sub(3, "EMP001", "RULE-12", 9, 120, "Submitted", { subDays: 1, description: "Wrote the on-call runbook for the payments service, including rollback steps.", witness: "Kartik" }),
  sub(4, "EMP001", "RULE-03", 25, 250, "Rejected", { description: "Internal hackathon – runner-up team.", admin_decision: "Reject", rejection_reason: "Runner-up placements are not covered by the Hackathon winner rule.", approver_admin_code: "ADM01", approval_timestamp: daysAgo(20, 14) }),
  sub(5, "EMP001", "RULE-10", 3, 200, "Draft", { description: "Tree plantation drive with the CSR team." }),
  sub(6, "EMP004", "RULE-11", 12, 450, "Manager Approved", { subDays: 4, description: "Automated nightly reconciliation; saves the support team about 14 hours a month.", flags: [{ code: "AT_MAX", level: "info", text: "Requested points equal the rule maximum (450)." }] }),
  sub(7, "EMP008", "RULE-05", 6, 300, "Submitted", { subDays: 2, description: "Go-live of the customer master migration (1.2M records) with zero post-cutover defects.", witness: "Suresh Babu" }),
  sub(8, "EMP009", "RULE-09", 13, 100, "Manager Approved", { subDays: 5, description: "Covered Sneha's cutover validation during her leave.", flags: [{ code: "NEAR_WINDOW", level: "warn", text: "Submitted 2 days before the 15-day claim window closes." }] }),
  sub(9, "EMP004", "RULE-04", 18, 150, "On Hold", { subDays: 6, description: "Client email praising the API performance fix.", admin_remarks: "Asked for the original email with headers; the attachment is a screenshot." }),
  sub(10, "EMP013", "RULE-10", 8, 200, "Manager Approved", { subDays: 1, description: "Blood donation camp coordinator." }),
  sub(11, "EMP003", "RULE-12", 20, 120, "Credited", { description: "Month-end close checklist documented.", admin_decision: "Approve", approved_points: 120, approver_admin_code: "ADM01", approval_timestamp: daysAgo(15, 11) }),
  sub(12, "EMP006", "RULE-02", 30, 500, "Escalated", { subDays: 8, description: "Filed an invention disclosure for a design-token sync method.", escalation: { by: "ADM01", at: daysAgo(7, 16), note: "500 points needs Super Admin sign-off per policy." }, flags: [{ code: "AT_MAX", level: "info", text: "Requested points equal the rule maximum (500)." }] }),
  sub(13, "EMP015", "RULE-04", 10, 150, "Manager Approved", { subDays: 2, description: "Client thanked the marketing team for a same-day campaign fix.", flagged: { by: "ADM01", at: daysAgo(1, 10), reason: "Attachment looks edited; checking with the account manager." } }),
  sub(14, "EMP008", "RULE-07", 120, 100, "Credited", { description: "Completed the Snowflake fundamentals course.", admin_decision: "Approve", approved_points: 100, approver_admin_code: "ADM01", approval_timestamp: daysAgo(115, 12) }),
];

const ledger = [
  ...submissions.filter((s) => s.status === "Credited").map((s, i) => ({ entry_id: `LED-${String(i + 1).padStart(4, "0")}`, employee_code: s.employee_code, type: "credit", points: s.approved_points, ref: s.submission_id, note: "Approved claim", at: s.approval_timestamp })),
  { entry_id: "LED-0090", employee_code: "EMP001", type: "redeem", points: -200, ref: "RDM-0001", note: "Payout to bank •••• 0121", at: daysAgo(30, 15) },
];

// ── Requests: leave, expense, advance, loan (two-step approvals) ──
function req(type, id, empCode, status, stage, payload, createdDays, opts = {}) {
  const e = employees.find((x) => x.employee_code === empCode);
  const mgr = e.reporting_manager;
  const adminCode = ["leave", "regularize"].includes(type) ? "ADM01" : "ADM02";
  const created = daysAgo(createdDays, 10);
  const steps = [step("manager", mgr, "pending", null), step("admin", adminCode, "waiting", null)];
  const history = [{ status: "Submitted", at: created, by: empCode, note: "" }];
  if (stage === "admin" || ["Approved", "Paid", "Disbursed", "Rejected"].includes(status)) {
    if (!(status === "Rejected" && opts.rejectedBy === "manager")) {
      steps[0] = step("manager", mgr, "approved", daysAgo(createdDays - 0.4, 12), opts.managerNote || "");
      history.push({ status: "Manager approved", at: steps[0].at, by: mgr, note: opts.managerNote || "" });
      steps[1].status = "pending";
    }
  }
  if (["Approved", "Paid", "Disbursed"].includes(status)) {
    steps[1] = step("admin", adminCode, "approved", daysAgo(createdDays - 1, 12), opts.adminNote || "");
    history.push({ status: "Approved", at: steps[1].at, by: adminCode, note: opts.adminNote || "" });
  }
  if (status === "Rejected") {
    const lvl = opts.rejectedBy === "manager" ? 0 : 1;
    steps[lvl] = step(lvl ? "admin" : "manager", lvl ? adminCode : mgr, "rejected", daysAgo(createdDays - 1, 12), opts.reason);
    history.push({ status: "Rejected", at: steps[lvl].at, by: steps[lvl].approver, note: opts.reason });
  }
  if (status === "Paid" || status === "Disbursed") history.push({ status, at: daysAgo(createdDays - 3, 12), by: adminCode, note: opts.payRef || "" });
  return { request_id: id, type, employee_code: empCode, status, stage: status === "Pending" ? stage : null, steps, history, created_at: created, ...payload, ...(opts.fields || {}) };
}

const today = isoDate();
const dIso = (n) => isoDate(Date.now() + n * DAY);
const requests = [
  req("leave", "LV-0201", "EMP001", "Approved", null, { leave_type: "CL", from_date: dIso(-40), to_date: dIso(-40), half_day: "none", days: 1, reason: "Family appointment outside the city.", contact: "" }, 45),
  req("leave", "LV-0202", "EMP001", "Pending", "manager", { leave_type: "EL", from_date: dIso(9), to_date: dIso(11), half_day: "none", days: 3, reason: "Visiting family for Diwali week.", contact: "+91 98001 04001" }, 1),
  req("leave", "LV-0203", "EMP004", "Approved", null, { leave_type: "SL", from_date: dIso(-1), to_date: dIso(1), half_day: "none", days: 3, reason: "Fever; doctor's note attached.", contact: "", attachment: { name: "medical-note.pdf", size: 82000, type: "application/pdf", data_url: null } }, 3),
  req("leave", "LV-0204", "EMP009", "Pending", "admin", { leave_type: "EL", from_date: dIso(14), to_date: dIso(18), half_day: "none", days: 5, reason: "Annual vacation.", contact: "" }, 2, { managerNote: "Covered by Sneha." }),
  req("leave", "LV-0205", "EMP011", "Pending", "manager", { leave_type: "CL", from_date: dIso(3), to_date: dIso(3), half_day: "first", days: 0.5, reason: "Bank work in the morning.", contact: "" }, 0.5),
  req("leave", "LV-0206", "EMP008", "Rejected", null, { leave_type: "EL", from_date: dIso(-10), to_date: dIso(-6), half_day: "none", days: 5, reason: "Short trip.", contact: "" }, 20, { rejectedBy: "manager", reason: "Overlaps the cutover weekend; please move by a week." }),
  req("leave", "LV-0207", "EMP006", "Approved", null, { leave_type: "FL", from_date: `${y}-10-19`, to_date: `${y}-10-19`, half_day: "none", days: 1, reason: "Mahaashtami.", contact: "" }, 12),
  req("expense", "EXP-0101", "EMP001", "Pending", "manager", { title: "Client visit – Bengaluru", purpose: "Requirements workshop with the retail client.", project: "Retail CRM", payment_mode: "payroll", advance_ref: "ADV-0031", items: [
    { date: dIso(-6), category: "TRAVEL", description: "Return train Hyderabad–Bengaluru", amount: 2380, receipt: { name: "irctc-ticket.pdf", size: 64000, type: "application/pdf", data_url: null } },
    { date: dIso(-6), category: "STAY", description: "Hotel, 1 night", amount: 4200, receipt: { name: "hotel-invoice.pdf", size: 120000, type: "application/pdf", data_url: null } },
    { date: dIso(-5), category: "FOOD", description: "Meals", amount: 860, receipt: null },
    { date: dIso(-5), category: "LOCAL", description: "Cabs to client office", amount: 940, receipt: { name: "uber-receipts.pdf", size: 40000, type: "application/pdf", data_url: null } },
  ] }, 2),
  req("expense", "EXP-0102", "EMP008", "Paid", null, { title: "Snowflake summit registration", purpose: "Conference pass", project: "Data platform", payment_mode: "bank", items: [{ date: dIso(-50), category: "OTHER", description: "Conference pass", amount: 1800, receipt: { name: "pass.pdf", size: 30000, type: "application/pdf", data_url: null } }], approved_amount: 1800 }, 48, { payRef: "UTR 4521889023", fields: { paid_on: dIso(-44), payment_ref: "UTR 4521889023" } }),
  req("expense", "EXP-0103", "EMP004", "Pending", "admin", { title: "Home internet – September", purpose: "Work from home connectivity", project: "", payment_mode: "payroll", items: [{ date: dIso(-25), category: "PHONE", description: "ACT Fibernet bill", amount: 1180, receipt: { name: "act-bill.pdf", size: 52000, type: "application/pdf", data_url: null } }] }, 4, { managerNote: "OK" }),
  req("expense", "EXP-0104", "EMP013", "Pending", "manager", { title: "Vendor meeting lunch", purpose: "Facilities vendor negotiation", project: "Facilities", payment_mode: "payroll", items: [{ date: dIso(-3), category: "CLIENT", description: "Lunch for 4", amount: 3200, receipt: { name: "bill.jpg", size: 210000, type: "image/jpeg", data_url: null } }] }, 1),
  req("advance", "ADV-0031", "EMP001", "Disbursed", null, { request_date: dIso(-9), request_amount: 8000, purpose: "Client visit – Bengaluru travel and stay", required_by: dIso(-7), note: "", attachment: null }, 9, { payRef: "UTR 4529001771", fields: { approved_amount: 8000, disbursed_date: dIso(-7), payment_ref: "UTR 4529001771", settle_by: dIso(23) } }),
  req("advance", "ADV-0032", "EMP009", "Pending", "manager", { request_date: today, request_amount: 15000, purpose: "Team offsite logistics", required_by: dIso(7), note: "Will settle with receipts.", attachment: null }, 0.3),
  req("regularize", "REG-0001", "EMP004", "Pending", "manager", { date: dIso(-2), in_time: "09:20", out_time: "18:40", reason_code: "forgot_punch", reason: "Forgot to punch out; was in the release call till 18:40." }, 1),
  req("regularize", "REG-0002", "EMP008", "Pending", "admin", { date: dIso(-3), in_time: "10:05", out_time: "19:10", reason_code: "client_site", reason: "At the client site; mobile had no network for the geofence check." }, 2, { managerNote: "Confirmed with the client lead." }),
  req("asset", "AST-0001", "EMP001", "Pending", "manager", { category: "Monitor", reason: "Second monitor for code reviews.", needed_by: dIso(7), priority: "normal" }, 1),
  req("asset", "AST-0002", "EMP023", "Approved", null, { category: "Phone", reason: "Field sales handset with the dialer app.", needed_by: dIso(2), priority: "high" }, 3, { managerNote: "Needed for call tracking." }),
  req("loan", "LN-0008", "EMP004", "Disbursed", null, { amount: 90000, tenure_months: 9, emi: 10000, reason: "Home renovation.", start_month: isoDate(Date.now() - 125 * DAY).slice(0, 7) }, 160, { payRef: "UTR 4511200987", fields: { approved_amount: 90000, disbursed_date: dIso(-150), payment_ref: "UTR 4511200987" } }),
  req("loan", "LN-0009", "EMP022", "Disbursed", null, { amount: 40000, tenure_months: 8, emi: 5000, reason: "Two-wheeler for field visits.", start_month: isoDate(Date.now() - 95 * DAY).slice(0, 7) }, 130, { payRef: "UTR 4513300441", fields: { approved_amount: 40000, disbursed_date: dIso(-120), payment_ref: "UTR 4513300441" } }),
  req("loan", "LN-0011", "EMP013", "Pending", "admin", { amount: 60000, tenure_months: 6, emi: 10000, reason: "Medical expenses for a family member.", start_month: dIso(30).slice(0, 7) }, 3, { managerNote: "Supported." }),
];

const notifications = [
  { id: "N-2", to: "EMP001", text: "Advance ADV-0031 of ₹8,000 was disbursed.", at: daysAgo(7, 12), read: false, link: "/expenses" },
  { id: "N-3", to: "EMP007", text: "Akhil Reddy requested 3 days of earned leave.", at: daysAgo(1, 10), read: false, link: "/inbox" },
  { id: "N-4", to: "EMP007", text: "Akhil Reddy submitted expense claim EXP-0101 (₹8,380).", at: daysAgo(2, 10), read: false, link: "/inbox" },
  { id: "N-5", to: "ADM01", text: "5 approvals are waiting for you.", at: daysAgo(0, 9), read: false, link: "/approvals" },
  { id: "N-6", to: "ADM02", text: "Loan LN-0011 from Divya Menon is waiting for you.", at: daysAgo(2, 12), read: false, link: "/approvals" },
  { id: "N-8", to: "SA001", text: "Kiran Patil (EMP011) was locked after 5 failed sign-ins.", at: daysAgo(2, 9), read: false, link: "/users" },
  { id: "N-9", to: "ADM01", text: "New employee Meera Nair (EMP012) is waiting for account approval.", at: daysAgo(2, 12), read: false, link: "/approvals" },
];

const audit = [
  { log_id: "AUD-0001", user_code: "SA001", role: "superadmin", action: "CONFIG_CHANGE", timestamp: daysAgo(30, 11), ip: "10.12.4.20", device: "Edge on Windows", details: "Session timeout set to 15 min" },
  { log_id: "AUD-0002", user_code: "EMP011", role: "emp", action: "ACCOUNT_LOCKED", timestamp: daysAgo(2, 9), ip: "10.40.2.77", device: "Chrome on Android", details: "5 failed sign-in attempts" },
  { log_id: "AUD-0003", user_code: "ADM01", role: "admin", action: "ESCALATE", timestamp: daysAgo(7, 16), ip: "10.12.9.4", device: "Chrome on Windows", details: "SUB-2026-0012 escalated: 500 points needs Super Admin sign-off" },
  { log_id: "AUD-0004", user_code: "SYSTEM", role: "system", action: "HR_SYNC", timestamp: daysAgo(2, 12), ip: "—", device: "HR connector", details: "1 new employee (EMP012) added as pending approval" },
  { log_id: "AUD-0005", user_code: "EMP001", role: "emp", action: "LOGIN_SUCCESS", timestamp: daysAgo(1, 9), ip: "10.12.7.18", device: "Edge on Windows", details: "Signed in" },
];

export const HR_FEED = [
  emp("EMP016", "Tanvi Deshpande", "Finance", "Financial Analyst", "EMP005", 1, "P2", 85000, { status: "pending_approval", must_reset: true, password_hash: HASH["Welcome@123"] }),
  emp("EMP017", "Imran Khan", "Data Migration", "Data Engineer", "EMP009", 0, "P2", 92000, { status: "pending_approval", must_reset: true, password_hash: HASH["Welcome@123"] }),
];

// Third-party (non-employee) expenses booked against a company and location: vendors, agencies, facility partners.
function thirdPartySeed() {
  return [
    { id: "TPE-0001", payee: "Swift Facility Services", title: "Housekeeping & pantry supplies – October", date: dIso(-12), category: "SUPPLY", currency: "INR", amount: 42800, amount_inr: 42800, company_id: "ONAS-IN", location_id: "IN-HYD-WH", status: "Booked", source: { app: "manual", external_id: "INV-SFS-1188" }, lines: [] },
    { id: "TPE-0002", payee: "TeamLease (agency staff travel)", title: "Agency staff travel – Medchal deployment", date: dIso(-8), category: "TRAVEL", currency: "INR", amount: 15600, amount_inr: 15600, company_id: "ONAS-IN", location_id: "IN-HYD-HQ", status: "Pending", source: { app: "manual", external_id: "TL-77812" }, lines: [] },
    { id: "TPE-0003", payee: "Regus Canary Wharf", title: "Meeting room hire – client QBR", date: dIso(-15), category: "CLIENT", currency: "GBP", amount: 380, amount_inr: 380 * 112, company_id: "ONAS-UK", location_id: "GB-LDN", status: "Booked", source: { app: "manual", external_id: "RG-44120" }, lines: [] },
    { id: "TPE-0004", payee: "Bolt Business Kenya", title: "Contractor rides – Nairobi rollout", date: dIso(-6), category: "LOCAL", currency: "KES", amount: 24000, amount_inr: Math.round(24000 * 0.68), company_id: "ONAS-AF", location_id: "KE-NBO", status: "Booked", source: { app: "manual", external_id: "BOLT-5521" }, lines: [] },
  ];
}

export function buildDemoSeed() {
  // Every employee belongs to a company (legal entity) and a location.
  employees.forEach((e) => Object.assign(e, e.company_id && e.location_id ? {} : defaultEntityFor(e)));
  HR_FEED.forEach((e) => Object.assign(e, e.company_id && e.location_id ? {} : defaultEntityFor(e)));
  const ops = buildOps({ employees, orgUnits });
  const base = buildSeedBase(ops);
  base.requests = base.requests.map((r) => {
    const e = employees.find((x) => x.employee_code === r.employee_code);
    return e ? { ...r, company_id: e.company_id, location_id: e.location_id } : r;
  });
  // Two apps already connected, so the expense hub opens with imported claims, card spends and advances.
  base.expenseHub = { connections: { concur: { connected: true, landing: "trust", auto_sync: true, connected_at: daysAgo(30, 10) }, mmt_mybiz: { connected: true, landing: "review", auto_sync: false, connected_at: daysAgo(20, 10) } }, runs: [], exceptions: [], categoryMaps: { concur: { "Ground transport": "LOCAL" } } };
  base.thirdPartyExpenses = thirdPartySeed();
  for (const app of ["concur", "mmt_mybiz"]) applyImport(base, app, demoFeed(app, 1, base.employees, isoDate()), { actor: "SYSTEM", adminFor: () => "ADM02" });
  base.expenseHub.runs.forEach((r, i) => { r.at = daysAgo(1 + i, 9); });
  // v10.5: My files (HR-uploaded employee documents) and document requests
  const txt = (t) => `data:text/plain;charset=utf-8,${encodeURIComponent(t)}`;
  base.empFiles = [];
  let ef = 1;
  const addFile = (code, title, category, body, by = "ADM01", d = 20) => base.empFiles.push({ id: `EF-${String(ef++).padStart(5, "0")}`, employee_code: code, title, category, note: "", file: { name: `${title.replace(/[^a-z0-9]+/gi, "_")}.txt`, size: body.length, type: "text/plain", data_url: txt(body) }, source: "hr", uploaded_by: by, at: daysAgo(d, 11) });
  base.employees.filter((e) => e.status === "active").forEach((e) => {
    addFile(e.employee_code, "Appointment letter", "Letters", `Appointment letter for ${e.full_name} (${e.employee_code}), ${e.designation}. Issued by HR.`, "ADM01", 40);
    addFile(e.employee_code, "Employee handbook 2026", "Policies", "Employee handbook 2026 - code of conduct, leave, travel and IT policies.", "ADM01", 12);
  });
  base.docRequests = [
    { id: "DR-0001", title: "Updated PAN card copy", note: "Needed for the FY 2026-27 tax declarations.", due: isoDate(new Date(Date.now() + 7 * 86400000)), target: { kind: "department", value: "Engineering" }, by: "ADM01", by_role: "admin", at: daysAgo(2, 10), status: "open",
      recipients: base.employees.filter((e) => e.status === "active" && e.department === "Engineering").map((e) => ({ code: e.employee_code, status: "pending", file_id: null, at: null, note: "" })) },
  ];
  return withoutLogins(base);
}

function buildSeedBase(ops) {
  return {
    version: 3,
    // v10.3: AI automation engine state (rule overrides, review queue, log, ids already handled)
    automation: { rules: {}, queue: [], log: [], done: [], last_run: null, paused: false },
    companies: COMPANIES.map((c) => ({ ...c, statutory: { ...(c.statutory || {}) } })),
    workLocations: LOCATIONS.map((l) => ({ ...l, statutory: { ...(l.statutory || {}) } })),
    orgUnits,
    employees,
    admins,
    superAdmins,
    categories,
    rules,
    leaveTypes,
    holidays,
    expenseCategories,
    settings: defaultSettings,
    submissions,
    ledger,
    requests,
    notifications,
    audit,
    redemptions: [],
    ...ops,
    ...buildPayslipSeed(employees),
    ...buildOfferSeed(),
    ...buildCollabSeed({ employees, candidates: ops.candidates }),
    ...buildPayrollSuiteSeed(employees),
    ...buildContractSeed(employees),
    ...buildPayslipDesignSeed(),
    ...buildSuiteSeed(employees),
  };
}
