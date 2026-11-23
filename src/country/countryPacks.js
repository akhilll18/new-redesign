// ONAS country packs — everything outside the payroll engine that changes when a country is selected:
// currency & formats, public holidays, statutory leave floors, onboarding documents, data-protection law,
// languages for AI translation, and notes the AI uses when it answers for that country.
// Payroll, statutory deductions, compliance checks, filing calendars and employment policy come from
// src/lib/payroll/<cc>.js (one engine per country). India keeps the company's own calendar and leave rules unchanged.
import { COUNTRIES } from "../lib/payroll/index.js";

const H = (date, name, approx) => ({ date, name, type: "holiday", ...(approx ? { approx: true } : {}) });

export const PACKS = {
  IN: {
    flag: "🇮🇳", currency: "INR", symbol: "₹", locale: "en-IN", dateFormat: "DD/MM/YYYY", region: "ASIA",
    taxYear: "1 April – 31 March", payCycle: "Monthly, credited by the 7th", workWeek: "Mon–Fri / Mon–Sat, 48 h max",
    authorities: ["Income Tax Department", "EPFO", "ESIC", "State PT departments"],
    languages: ["Hindi", "Telugu", "Tamil", "Kannada", "Marathi", "Bengali"],
    dataLaw: "Digital Personal Data Protection Act 2023",
    holidays: null, // uses the company holiday calendar (Policies & rules)
    leave: { annual: null, sick: null, extra: [] }, // company leave policy applies as-is
    leaveNotes: [["Earned leave", "Company 18 days; statute 1 day per 20 days worked"], ["Maternity", "26 weeks paid"], ["Paternity", "Company policy"]],
    documents: ["PAN card", "Aadhaar", "UAN / previous PF details", "Bank account proof (cancelled cheque)", "Education & experience certificates", "Signed appointment letter", "Form 11 (EPF declaration)", "Form F (gratuity nomination)"],
    probationMonths: 6,
  },
  GB: {
    flag: "🇬🇧", currency: "GBP", symbol: "£", locale: "en-GB", dateFormat: "DD/MM/YYYY", region: "EMEA",
    taxYear: "6 April – 5 April", payCycle: "Monthly", workWeek: "Mon–Fri, 48 h average max (opt-out allowed)",
    authorities: ["HMRC", "The Pensions Regulator"], languages: ["Welsh", "Polish", "Urdu"], dataLaw: "UK GDPR & Data Protection Act 2018",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-04-03", "Good Friday"), H("2026-04-06", "Easter Monday"), H("2026-05-04", "Early May bank holiday"), H("2026-05-25", "Spring bank holiday"), H("2026-08-31", "Summer bank holiday"), H("2026-12-25", "Christmas Day"), H("2026-12-28", "Boxing Day (substitute)")],
    leave: { annual: 20, sick: null, extra: [] },
    leaveNotes: [["Statutory holiday", "5.6 weeks (28 days) including the 8 bank holidays"], ["Sick pay", "SSP from day one"], ["Maternity", "Up to 52 weeks; 39 weeks SMP"]],
    documents: ["Right-to-work check (passport / share code)", "P45 or starter checklist", "National Insurance number", "Bank details", "Written statement of particulars (day one)", "Pension auto-enrolment notice"],
    probationMonths: 6,
  },
  US: {
    flag: "🇺🇸", currency: "USD", symbol: "$", locale: "en-US", dateFormat: "MM/DD/YYYY", region: "AMER",
    taxYear: "Calendar year", payCycle: "Bi-weekly or semi-monthly", workWeek: "40 h; FLSA overtime 1.5× for non-exempt",
    authorities: ["IRS", "Social Security Administration", "State tax agencies"], languages: ["Spanish"], dataLaw: "State privacy laws (e.g. CCPA/CPRA)",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-01-19", "Martin Luther King Jr. Day"), H("2026-02-16", "Presidents’ Day"), H("2026-05-25", "Memorial Day"), H("2026-06-19", "Juneteenth"), H("2026-07-03", "Independence Day (observed)"), H("2026-09-07", "Labor Day"), H("2026-10-12", "Columbus Day"), H("2026-11-11", "Veterans Day"), H("2026-11-26", "Thanksgiving"), H("2026-12-25", "Christmas Day")],
    leave: { annual: null, sick: null, extra: [] },
    leaveNotes: [["Vacation", "No federal minimum; company policy"], ["Sick leave", "State / city laws may require paid sick time"], ["FMLA", "Up to 12 weeks unpaid, job-protected (eligible staff)"]],
    documents: ["Form I-9 with identity documents", "Form W-4", "State withholding form", "Direct deposit form", "Offer letter", "Benefits enrolment"],
    probationMonths: 3,
  },
  AE: {
    flag: "🇦🇪", currency: "AED", symbol: "AED", locale: "en-AE", dateFormat: "DD/MM/YYYY", region: "EMEA",
    taxYear: "No personal income tax", payCycle: "Monthly through WPS", workWeek: "Mon–Fri, 48 h max",
    authorities: ["MOHRE", "GPSSA", "ICP / GDRFA"], languages: ["Arabic", "Hindi", "Urdu"], dataLaw: "Federal Decree-Law 45/2021 (PDPL)",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-03-20", "Eid al-Fitr", true), H("2026-03-21", "Eid al-Fitr holiday", true), H("2026-05-26", "Arafat Day", true), H("2026-05-27", "Eid al-Adha", true), H("2026-05-28", "Eid al-Adha holiday", true), H("2026-06-16", "Hijri New Year", true), H("2026-08-25", "Prophet’s Birthday", true), H("2026-12-01", "Commemoration Day"), H("2026-12-02", "National Day"), H("2026-12-03", "National Day holiday")],
    leave: { annual: 22, sick: 15, extra: [] },
    leaveNotes: [["Annual leave", "30 calendar days (≈ 22 working days) after one year"], ["Sick leave", "90 days: 15 full pay, 30 half pay, 45 unpaid"], ["Maternity", "60 days"]],
    documents: ["Passport & visa / Emirates ID", "MOHRE contract (signed)", "Attested education certificates", "Medical fitness & insurance", "Bank / WPS account", "ILOE subscription"],
    probationMonths: 6,
  },
  SG: {
    flag: "🇸🇬", currency: "SGD", symbol: "S$", locale: "en-SG", dateFormat: "DD/MM/YYYY", region: "ASIA",
    taxYear: "Calendar year (YA following)", payCycle: "Monthly, within 7 days of period end", workWeek: "44 h (Employment Act Part IV)",
    authorities: ["CPF Board", "IRAS", "MOM"], languages: ["Mandarin Chinese", "Malay", "Tamil"], dataLaw: "Personal Data Protection Act 2012",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-02-17", "Chinese New Year"), H("2026-02-18", "Chinese New Year (2nd day)"), H("2026-03-21", "Hari Raya Puasa", true), H("2026-04-03", "Good Friday"), H("2026-05-01", "Labour Day"), H("2026-05-27", "Hari Raya Haji", true), H("2026-06-01", "Vesak Day (observed)", true), H("2026-08-10", "National Day (observed)"), H("2026-11-09", "Deepavali (observed)", true), H("2026-12-25", "Christmas Day")],
    leave: { annual: 7, sick: 14, extra: [] },
    leaveNotes: [["Annual leave", "7 days in year one, +1 a year to 14"], ["Sick leave", "14 days outpatient, 60 days hospitalisation"], ["Childcare", "6 days a year (Singapore citizen child under 7)"]],
    documents: ["NRIC / FIN & work pass", "Key employment terms (within 14 days)", "CPF details", "Bank account", "Signed contract"],
    probationMonths: 3,
  },
  NA: {
    flag: "🇳🇦", currency: "NAD", symbol: "N$", locale: "en-NA", dateFormat: "DD/MM/YYYY", region: "AFRICA",
    taxYear: "1 March – 28/29 February", payCycle: "Monthly", workWeek: "Mon–Fri, 45 h (9 h a day)",
    authorities: ["Namibia Revenue Agency (NamRA)", "Social Security Commission (SSC)", "Namibia Training Authority (NTA)", "Ministry of Labour, Industrial Relations & Employment Creation", "Employment Equity Commission"],
    languages: ["Afrikaans", "Oshiwambo", "German", "Otjiherero"], dataLaw: "Constitution Art. 13 (privacy); Data Protection Bill pending",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-03-21", "Independence Day"), H("2026-04-03", "Good Friday"), H("2026-04-06", "Easter Monday"), H("2026-05-01", "Workers’ Day"), H("2026-05-04", "Cassinga Day"), H("2026-05-14", "Ascension Day"), H("2026-05-25", "Africa Day"), H("2026-05-28", "Genocide Remembrance Day"), H("2026-08-26", "Heroes’ Day"), H("2026-12-10", "Human Rights Day"), H("2026-12-25", "Christmas Day"), H("2026-12-26", "Family Day")],
    leave: { annual: 20, sick: 10, extra: [{ code: "CMP", name: "Compassionate leave", annual: 5, carry_forward: 0, min_notice_days: 0, doc_after_days: null, active: true, country: "NA" }] },
    leaveNotes: [["Annual leave", "4 consecutive weeks: 20 working days (5-day week), 24 (6-day week)"], ["Sick leave", "30 working days paid per 36-month cycle (≈ 10 a year)"], ["Compassionate leave", "5 working days a year"], ["Maternity", "12 weeks, paid through SSC up to the ceiling"]],
    documents: ["Namibian ID or passport + work permit", "SSC registration (within 30 days)", "NamRA TIN", "Bank confirmation letter", "Written particulars of employment (Labour Act s.33)", "Pension / provident fund nomination", "Affirmative Action profile (designated group)"],
    probationMonths: 6,
  },
  ZA: {
    flag: "🇿🇦", currency: "ZAR", symbol: "R", locale: "en-ZA", dateFormat: "YYYY/MM/DD", region: "AFRICA",
    taxYear: "1 March – 28/29 February", payCycle: "Monthly", workWeek: "Mon–Fri, 45 h",
    authorities: ["SARS", "Department of Employment and Labour (UIF)", "Compensation Fund", "SETA"], languages: ["Afrikaans", "isiZulu", "isiXhosa", "Sesotho"], dataLaw: "Protection of Personal Information Act 2013 (POPIA)",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-03-21", "Human Rights Day"), H("2026-04-03", "Good Friday"), H("2026-04-06", "Family Day"), H("2026-04-27", "Freedom Day"), H("2026-05-01", "Workers’ Day"), H("2026-06-16", "Youth Day"), H("2026-08-10", "National Women’s Day (observed)"), H("2026-09-24", "Heritage Day"), H("2026-12-16", "Day of Reconciliation"), H("2026-12-25", "Christmas Day"), H("2026-12-26", "Day of Goodwill")],
    leave: { annual: 15, sick: 10, extra: [{ code: "FRL", name: "Family responsibility leave", annual: 3, carry_forward: 0, min_notice_days: 0, doc_after_days: 1, active: true, country: "ZA" }] },
    leaveNotes: [["Annual leave", "21 consecutive days (15 working days)"], ["Sick leave", "30 days per 36-month cycle"], ["Family responsibility", "3 days a year"], ["Maternity / parental", "4 months / 10 days"]],
    documents: ["SA ID or passport + work visa", "SARS tax number", "Bank confirmation letter", "Signed contract (BCEA s.29 particulars)", "UIF registration", "EE1 employment-equity declaration"],
    probationMonths: 3,
  },
  KE: {
    flag: "🇰🇪", currency: "KES", symbol: "KSh", locale: "en-KE", dateFormat: "DD/MM/YYYY", region: "AFRICA",
    taxYear: "Calendar year", payCycle: "Monthly", workWeek: "Mon–Fri (+ half Sat), 52 h max",
    authorities: ["Kenya Revenue Authority (KRA)", "NSSF", "Social Health Authority (SHA)", "NITA", "State Department for Labour"], languages: ["Swahili", "Kikuyu"], dataLaw: "Data Protection Act 2019",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-03-20", "Idd-ul-Fitr", true), H("2026-04-03", "Good Friday"), H("2026-04-06", "Easter Monday"), H("2026-05-01", "Labour Day"), H("2026-06-01", "Madaraka Day"), H("2026-10-10", "Mazingira Day"), H("2026-10-20", "Mashujaa Day"), H("2026-12-12", "Jamhuri Day"), H("2026-12-25", "Christmas Day"), H("2026-12-26", "Boxing Day")],
    leave: { annual: 21, sick: 14, extra: [] },
    leaveNotes: [["Annual leave", "21 working days after 12 months"], ["Sick leave", "7 days full pay + 7 days half pay"], ["Maternity / paternity", "3 months / 2 weeks"]],
    documents: ["National ID or passport + work permit", "KRA PIN certificate", "NSSF card", "SHA registration", "Bank details", "Signed contract (Employment Act s.9)", "Certificate of good conduct (where required)"],
    probationMonths: 6,
  },
  NG: {
    flag: "🇳🇬", currency: "NGN", symbol: "₦", locale: "en-NG", dateFormat: "DD/MM/YYYY", region: "AFRICA",
    taxYear: "Calendar year", payCycle: "Monthly", workWeek: "Mon–Fri, 40 h (contract)",
    authorities: ["State Internal Revenue Service", "Nigeria Revenue Service", "PenCom / PFA", "NSITF", "ITF", "FMBN (NHF)"], languages: ["Hausa", "Yoruba", "Igbo", "Nigerian Pidgin"], dataLaw: "Nigeria Data Protection Act 2023",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-03-20", "Eid-el-Fitr", true), H("2026-03-23", "Eid-el-Fitr holiday", true), H("2026-04-03", "Good Friday"), H("2026-04-06", "Easter Monday"), H("2026-05-01", "Workers’ Day"), H("2026-05-27", "Eid-el-Kabir", true), H("2026-06-12", "Democracy Day"), H("2026-08-26", "Eid-el-Maulud", true), H("2026-10-01", "Independence Day"), H("2026-12-25", "Christmas Day"), H("2026-12-26", "Boxing Day")],
    leave: { annual: 6, sick: 12, extra: [] },
    leaveNotes: [["Annual leave", "At least 6 working days after 12 months"], ["Sick leave", "Up to 12 working days a year"], ["Maternity", "12 weeks (Labour Act)"]],
    documents: ["NIN slip / international passport", "Tax ID (TIN)", "RSA PIN & PFA", "Bank verification number (BVN)", "Signed contract (within 3 months)", "Guarantor form (company policy)"],
    probationMonths: 6,
  },
  BW: {
    flag: "🇧🇼", currency: "BWP", symbol: "P", locale: "en-BW", dateFormat: "DD/MM/YYYY", region: "AFRICA",
    taxYear: "1 July – 30 June", payCycle: "Monthly", workWeek: "Mon–Fri, 48 h max",
    authorities: ["Botswana Unified Revenue Service (BURS)", "Ministry of Labour and Home Affairs", "NBFIRA (pension funds)"], languages: ["Setswana"], dataLaw: "Data Protection Act 2024",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-01-02", "New Year holiday"), H("2026-04-03", "Good Friday"), H("2026-04-04", "Holy Saturday"), H("2026-04-06", "Easter Monday"), H("2026-05-01", "Labour Day"), H("2026-05-14", "Ascension Day"), H("2026-07-01", "Sir Seretse Khama Day"), H("2026-07-20", "President’s Day"), H("2026-07-21", "President’s Day holiday"), H("2026-09-30", "Botswana Day"), H("2026-10-01", "Botswana Day holiday"), H("2026-12-25", "Christmas Day"), H("2026-12-26", "Boxing Day")],
    leave: { annual: 15, sick: 14, extra: [] },
    leaveNotes: [["Annual leave", "15 working days after 12 months"], ["Sick leave", "14 working days a year"], ["Maternity", "Paid under the Employment Act (confirm current terms)"]],
    documents: ["Omang or passport + work & residence permit", "BURS TIN", "Bank details", "Signed contract", "Pension fund nomination"],
    probationMonths: 6,
  },
  // ─────────────── AMER ───────────────
  CA: {
    flag: "🇨🇦", currency: "CAD", symbol: "C$", locale: "en-CA", dateFormat: "YYYY-MM-DD", region: "AMER",
    taxYear: "Calendar year", payCycle: "Bi-weekly or semi-monthly", workWeek: "Mon–Fri, overtime after 44 h (Ontario)",
    authorities: ["Canada Revenue Agency (CRA)", "Service Canada (ROE)", "Ontario Ministry of Labour", "WSIB"], languages: ["French"], dataLaw: "PIPEDA",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-02-16", "Family Day (ON)"), H("2026-04-03", "Good Friday"), H("2026-05-18", "Victoria Day"), H("2026-07-01", "Canada Day"), H("2026-09-07", "Labour Day"), H("2026-10-12", "Thanksgiving"), H("2026-12-25", "Christmas Day"), H("2026-12-28", "Boxing Day (observed)")],
    leave: { annual: 10, sick: null, extra: [] },
    leaveNotes: [["Vacation", "2 weeks (4%), 3 weeks (6%) after 5 years"], ["Sick leave", "3 unpaid days (Ontario)"], ["Parental", "Up to 18 months with EI benefits"]],
    documents: ["Social Insurance Number (SIN)", "Federal and provincial TD1 forms", "Direct deposit form", "Proof of work eligibility", "Signed offer letter", "Ontario ESA poster acknowledgement"],
    probationMonths: 3,
  },
  MX: {
    flag: "🇲🇽", currency: "MXN", symbol: "MX$", locale: "es-MX", dateFormat: "DD/MM/YYYY", region: "AMER",
    taxYear: "Calendar year", payCycle: "Bi-weekly (quincenal)", workWeek: "Mon–Sat, 48 h (40-hour reform phasing in)",
    authorities: ["SAT", "IMSS", "INFONAVIT", "STPS", "State treasury (ISN)"], languages: ["Spanish"], dataLaw: "LFPDPPP 2025",
    holidays: [H("2026-01-01", "Año Nuevo"), H("2026-02-02", "Día de la Constitución"), H("2026-03-16", "Natalicio de Benito Juárez"), H("2026-05-01", "Día del Trabajo"), H("2026-09-16", "Día de la Independencia"), H("2026-11-16", "Día de la Revolución"), H("2026-12-25", "Navidad")],
    leave: { annual: 12, sick: null, extra: [] },
    leaveNotes: [["Vacaciones", "12 days in year one, rising to 20 by year five"], ["Prima vacacional", "25% of vacation pay"], ["Maternity / paternity", "12 weeks (IMSS) / 5 days"]],
    documents: ["INE or passport", "CURP", "RFC with Constancia de Situación Fiscal", "IMSS number (NSS)", "Proof of address", "INFONAVIT loan notice (if any)", "Signed contract"],
    probationMonths: 1,
  },
  BR: {
    flag: "🇧🇷", currency: "BRL", symbol: "R$", locale: "pt-BR", dateFormat: "DD/MM/YYYY", region: "AMER",
    taxYear: "Calendar year", payCycle: "Monthly, by the 5th working day", workWeek: "Mon–Fri, 44 h",
    authorities: ["Receita Federal", "INSS", "Caixa (FGTS)", "Ministério do Trabalho", "eSocial"], languages: ["Portuguese"], dataLaw: "LGPD (Lei 13.709/2018)",
    holidays: [H("2026-01-01", "Confraternização Universal"), H("2026-02-16", "Carnaval (ponto facultativo)"), H("2026-02-17", "Carnaval (ponto facultativo)"), H("2026-04-03", "Sexta-feira Santa"), H("2026-04-21", "Tiradentes"), H("2026-05-01", "Dia do Trabalho"), H("2026-06-04", "Corpus Christi (ponto facultativo)"), H("2026-09-07", "Independência"), H("2026-10-12", "Nossa Senhora Aparecida"), H("2026-11-02", "Finados"), H("2026-11-15", "Proclamação da República"), H("2026-11-20", "Consciência Negra"), H("2026-12-25", "Natal")],
    leave: { annual: 22, sick: null, extra: [] },
    leaveNotes: [["Férias", "30 calendar days a year + 1/3 bonus"], ["Sick leave", "Employer pays 15 days, then INSS"], ["Maternity / paternity", "120 days / 5 days"]],
    documents: ["CPF", "RG or CNH", "CTPS digital", "PIS/PASEP number", "Proof of address", "Admission medical exam (ASO)", "Dependants’ documents"],
    probationMonths: 3,
  },
  // ─────────────── EMEA ───────────────
  DE: {
    flag: "🇩🇪", currency: "EUR", symbol: "€", locale: "de-DE", dateFormat: "DD.MM.YYYY", region: "EMEA",
    taxYear: "Calendar year", payCycle: "Monthly, end of month", workWeek: "Mon–Fri, 8 h a day (max 10)",
    authorities: ["Finanzamt (ELStAM)", "Krankenkasse", "Deutsche Rentenversicherung", "Bundesagentur für Arbeit"], languages: ["German"], dataLaw: "GDPR & BDSG",
    holidays: [H("2026-01-01", "Neujahr"), H("2026-04-03", "Karfreitag"), H("2026-04-06", "Ostermontag"), H("2026-05-01", "Tag der Arbeit"), H("2026-05-14", "Christi Himmelfahrt"), H("2026-05-25", "Pfingstmontag"), H("2026-10-03", "Tag der Deutschen Einheit"), H("2026-12-25", "1. Weihnachtstag"), H("2026-12-26", "2. Weihnachtstag")],
    leave: { annual: 20, sick: null, extra: [] },
    leaveNotes: [["Urlaub", "20 working days (5-day week), company usually 25–30"], ["Sick pay", "Full pay for 6 weeks"], ["Elternzeit", "Up to 3 years; Mutterschutz 14 weeks"]],
    documents: ["Steuer-ID", "Social insurance number", "Health insurance membership", "Bank details (IBAN)", "Written contract (Nachweisgesetz)", "Residence / work permit (non-EU)"],
    probationMonths: 6,
  },
  FR: {
    flag: "🇫🇷", currency: "EUR", symbol: "€", locale: "fr-FR", dateFormat: "DD/MM/YYYY", region: "EMEA",
    taxYear: "Calendar year", payCycle: "Monthly", workWeek: "Mon–Fri, 35 h",
    authorities: ["URSSAF", "DGFiP", "Agirc-Arrco", "France Travail"], languages: ["French"], dataLaw: "GDPR & Loi Informatique et Libertés",
    holidays: [H("2026-01-01", "Jour de l’an"), H("2026-04-06", "Lundi de Pâques"), H("2026-05-01", "Fête du Travail"), H("2026-05-08", "Victoire 1945"), H("2026-05-14", "Ascension"), H("2026-05-25", "Lundi de Pentecôte"), H("2026-07-14", "Fête nationale"), H("2026-08-15", "Assomption"), H("2026-11-01", "Toussaint"), H("2026-11-11", "Armistice"), H("2026-12-25", "Noël")],
    leave: { annual: 25, sick: null, extra: [] },
    leaveNotes: [["Congés payés", "5 weeks (25 working days)"], ["RTT", "Extra days where hours exceed 35 (by agreement)"], ["Maternity / paternity", "16 weeks / 28 days"]],
    documents: ["Social security number (NIR)", "ID / residence permit", "RIB (bank details)", "Signed contract", "DPAE confirmation", "Mutuelle enrolment or exemption"],
    probationMonths: 2,
  },
  IE: {
    flag: "🇮🇪", currency: "EUR", symbol: "€", locale: "en-IE", dateFormat: "DD/MM/YYYY", region: "EMEA",
    taxYear: "Calendar year", payCycle: "Monthly or weekly", workWeek: "Mon–Fri, 39 h typical (48 h average max)",
    authorities: ["Revenue (PAYE Modernisation)", "Department of Social Protection", "Workplace Relations Commission"], languages: ["Irish"], dataLaw: "GDPR & Data Protection Act 2018",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-02-02", "St Brigid’s Day"), H("2026-03-17", "St Patrick’s Day"), H("2026-04-06", "Easter Monday"), H("2026-05-04", "May bank holiday"), H("2026-06-01", "June bank holiday"), H("2026-08-03", "August bank holiday"), H("2026-10-26", "October bank holiday"), H("2026-12-25", "Christmas Day"), H("2026-12-26", "St Stephen’s Day")],
    leave: { annual: 20, sick: 5, extra: [] },
    leaveNotes: [["Annual leave", "4 working weeks"], ["Statutory sick pay", "5 days at 70% of pay"], ["Maternity / paternity", "26 + 16 weeks / 2 weeks"]],
    documents: ["PPS number", "Bank details", "Written terms (5-day statement)", "Work permit / Stamp (non-EEA)", "Pension auto-enrolment notice"],
    probationMonths: 6,
  },
  SA: {
    flag: "🇸🇦", currency: "SAR", symbol: "SAR", locale: "en-SA", dateFormat: "DD/MM/YYYY", region: "EMEA",
    taxYear: "No personal income tax", payCycle: "Monthly through Mudad (WPS)", workWeek: "Sun–Thu, 48 h",
    authorities: ["MHRSD (Qiwa, Mudad)", "GOSI", "Jawazat"], languages: ["Arabic", "Urdu"], dataLaw: "Personal Data Protection Law (PDPL)",
    holidays: [H("2026-02-22", "Founding Day"), H("2026-03-19", "Eid al-Fitr holiday", true), H("2026-03-20", "Eid al-Fitr", true), H("2026-03-21", "Eid al-Fitr holiday", true), H("2026-03-22", "Eid al-Fitr holiday", true), H("2026-05-26", "Arafat Day", true), H("2026-05-27", "Eid al-Adha", true), H("2026-05-28", "Eid al-Adha holiday", true), H("2026-05-29", "Eid al-Adha holiday", true), H("2026-09-23", "Saudi National Day")],
    leave: { annual: 21, sick: 30, extra: [] },
    leaveNotes: [["Annual leave", "21 days; 30 after 5 years"], ["Sick leave", "30 days full pay, 60 at 75%, 30 unpaid"], ["Maternity", "12 weeks paid"]],
    documents: ["Iqama or national ID", "Qiwa contract", "GOSI registration", "Medical insurance (CCHI)", "Bank account for Mudad", "Attested certificates (expats)"],
    probationMonths: 6,
  },
  // ─────────────── ASIA ───────────────
  MY: {
    flag: "🇲🇾", currency: "MYR", symbol: "RM", locale: "en-MY", dateFormat: "DD/MM/YYYY", region: "ASIA",
    taxYear: "Calendar year", payCycle: "Monthly, by the 7th", workWeek: "Mon–Fri, 45 h",
    authorities: ["LHDN (Inland Revenue)", "KWSP / EPF", "PERKESO / SOCSO", "HRD Corp"], languages: ["Malay", "Mandarin Chinese", "Tamil"], dataLaw: "Personal Data Protection Act 2010",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-02-02", "Thaipusam (observed)", true), H("2026-02-17", "Chinese New Year"), H("2026-02-18", "Chinese New Year (2nd day)"), H("2026-03-20", "Hari Raya Aidilfitri", true), H("2026-03-21", "Hari Raya Aidilfitri (2nd day)", true), H("2026-05-01", "Labour Day"), H("2026-05-27", "Hari Raya Haji", true), H("2026-06-01", "Agong’s Birthday / Wesak (observed)"), H("2026-06-16", "Awal Muharram", true), H("2026-08-25", "Maulidur Rasul", true), H("2026-08-31", "Hari Merdeka"), H("2026-09-16", "Malaysia Day"), H("2026-11-09", "Deepavali (observed)", true), H("2026-12-25", "Christmas Day")],
    leave: { annual: 8, sick: 14, extra: [] },
    leaveNotes: [["Annual leave", "8 / 12 / 16 days by service"], ["Sick leave", "14 / 18 / 22 days + 60 hospitalisation"], ["Maternity / paternity", "98 days / 7 days"]],
    documents: ["MyKad or passport + work pass", "Income tax number", "EPF & SOCSO numbers", "Bank details", "Signed contract", "Form TP3 (previous employer)"],
    probationMonths: 3,
  },
  PH: {
    flag: "🇵🇭", currency: "PHP", symbol: "₱", locale: "en-PH", dateFormat: "MM/DD/YYYY", region: "ASIA",
    taxYear: "Calendar year", payCycle: "Semi-monthly (15th and 30th)", workWeek: "Mon–Fri, 8 h a day",
    authorities: ["BIR", "SSS", "PhilHealth", "Pag-IBIG (HDMF)", "DOLE"], languages: ["Filipino", "Cebuano"], dataLaw: "Data Privacy Act 2012",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-02-17", "Chinese New Year (special)"), H("2026-03-20", "Eid’l Fitr", true), H("2026-04-02", "Maundy Thursday"), H("2026-04-03", "Good Friday"), H("2026-04-09", "Araw ng Kagitingan"), H("2026-05-01", "Labor Day"), H("2026-06-12", "Independence Day"), H("2026-08-21", "Ninoy Aquino Day (special)"), H("2026-08-31", "National Heroes Day"), H("2026-11-01", "All Saints’ Day (special)"), H("2026-11-30", "Bonifacio Day"), H("2026-12-08", "Immaculate Conception (special)"), H("2026-12-25", "Christmas Day"), H("2026-12-30", "Rizal Day")],
    leave: { annual: 5, sick: null, extra: [] },
    leaveNotes: [["Service incentive leave", "5 days after 1 year"], ["Maternity / paternity", "105 days / 7 days"], ["Solo parent", "7 days a year"]],
    documents: ["TIN (BIR Form 1902)", "SSS, PhilHealth and Pag-IBIG numbers", "NBI clearance", "Birth certificate (PSA)", "Form 2316 from previous employer", "Signed contract"],
    probationMonths: 6,
  },
  ID: {
    flag: "🇮🇩", currency: "IDR", symbol: "Rp", locale: "id-ID", dateFormat: "DD/MM/YYYY", region: "ASIA",
    taxYear: "Calendar year", payCycle: "Monthly", workWeek: "Mon–Fri, 40 h",
    authorities: ["DJP (Coretax)", "BPJS Kesehatan", "BPJS Ketenagakerjaan", "Kemnaker"], languages: ["Indonesian", "Javanese"], dataLaw: "Personal Data Protection Law 27/2022",
    holidays: [H("2026-01-01", "Tahun Baru"), H("2026-01-16", "Isra Mi’raj", true), H("2026-02-17", "Tahun Baru Imlek"), H("2026-03-19", "Nyepi"), H("2026-03-20", "Idul Fitri", true), H("2026-03-21", "Idul Fitri (2nd day)", true), H("2026-04-03", "Wafat Isa Almasih"), H("2026-05-01", "Hari Buruh"), H("2026-05-14", "Kenaikan Isa Almasih"), H("2026-05-27", "Idul Adha", true), H("2026-05-31", "Waisak", true), H("2026-06-01", "Hari Lahir Pancasila"), H("2026-06-16", "Tahun Baru Islam", true), H("2026-08-17", "Hari Kemerdekaan"), H("2026-08-25", "Maulid Nabi", true), H("2026-12-25", "Hari Natal")],
    leave: { annual: 12, sick: null, extra: [] },
    leaveNotes: [["Cuti tahunan", "12 working days after 12 months"], ["Sick leave", "Paid with medical certificate"], ["Maternity", "3 months"]],
    documents: ["KTP (NIK)", "NPWP / NIK for tax", "Kartu Keluarga (PTKP status)", "BPJS cards", "Bank details", "Signed PKWT / PKWTT contract"],
    probationMonths: 3,
  },
  // ─────────────── more AFRICA ───────────────
  GH: {
    flag: "🇬🇭", currency: "GHS", symbol: "GH₵", locale: "en-GH", dateFormat: "DD/MM/YYYY", region: "AFRICA",
    taxYear: "Calendar year", payCycle: "Monthly", workWeek: "Mon–Fri, 40 h",
    authorities: ["Ghana Revenue Authority (GRA)", "SSNIT", "NPRA (Tier 2)", "Labour Department"], languages: ["Twi", "Ewe", "Ga"], dataLaw: "Data Protection Act 2012 (Act 843)",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-01-07", "Constitution Day"), H("2026-03-06", "Independence Day"), H("2026-03-20", "Eid al-Fitr", true), H("2026-04-03", "Good Friday"), H("2026-04-06", "Easter Monday"), H("2026-05-01", "May Day"), H("2026-05-27", "Eid al-Adha", true), H("2026-07-01", "Republic Day"), H("2026-08-04", "Founders’ Day"), H("2026-09-21", "Kwame Nkrumah Memorial Day"), H("2026-12-04", "Farmers’ Day"), H("2026-12-25", "Christmas Day"), H("2026-12-26", "Boxing Day")],
    leave: { annual: 15, sick: null, extra: [] },
    leaveNotes: [["Annual leave", "15 working days after 12 months"], ["Maternity", "12 weeks paid"], ["Sick leave", "By contract"]],
    documents: ["Ghana Card", "SSNIT number", "Tier 2 trustee enrolment", "Bank details", "Signed contract", "Police report (where required)"],
    probationMonths: 6,
  },
  ZM: {
    flag: "🇿🇲", currency: "ZMW", symbol: "K", locale: "en-ZM", dateFormat: "DD/MM/YYYY", region: "AFRICA",
    taxYear: "Calendar year", payCycle: "Monthly", workWeek: "Mon–Fri, 48 h max",
    authorities: ["Zambia Revenue Authority (ZRA)", "NAPSA", "NHIMA", "Ministry of Labour"], languages: ["Bemba", "Nyanja"], dataLaw: "Data Protection Act 2021",
    holidays: [H("2026-01-01", "New Year’s Day"), H("2026-03-09", "Women’s Day (observed)"), H("2026-03-12", "Youth Day"), H("2026-04-03", "Good Friday"), H("2026-04-04", "Holy Saturday"), H("2026-04-06", "Easter Monday"), H("2026-04-28", "Kenneth Kaunda Day"), H("2026-05-01", "Labour Day"), H("2026-05-25", "Africa Day"), H("2026-07-06", "Heroes’ Day"), H("2026-07-07", "Unity Day"), H("2026-08-03", "Farmers’ Day"), H("2026-10-19", "National Prayer Day (observed)"), H("2026-10-24", "Independence Day"), H("2026-12-25", "Christmas Day")],
    leave: { annual: 24, sick: null, extra: [] },
    leaveNotes: [["Annual leave", "2 days per month (24 a year)"], ["Sick leave", "Up to 26 weeks"], ["Maternity / paternity", "14 weeks / 5 days"]],
    documents: ["NRC or passport + permit", "ZRA TPIN", "NAPSA number", "NHIMA registration", "Bank details", "Signed contract"],
    probationMonths: 3,
  },
};

export const COUNTRY_CODES = Object.keys(COUNTRIES);
export const AFRICA = ["NA", "ZA", "KE", "NG", "BW", "GH", "ZM"];
// Regions used by the selector and region mode.
export const REGION_INFO = {
  AMER: { name: "Americas", emoji: "🌎" },
  EMEA: { name: "Europe & Middle East", emoji: "🌍" },
  ASIA: { name: "Asia", emoji: "🌏" },
  AFRICA: { name: "Africa", emoji: "🌍" },
};
export const REGION_ORDER = ["AMER", "EMEA", "ASIA", "AFRICA"];
export const countriesIn = (region) => Object.keys(COUNTRIES).filter((c) => PACKS[c]?.region === region);
// Countries added by ONAS (demo staff and offices are back-filled for browsers with older saved data).
export const ADDED_COUNTRIES = [...AFRICA, "CA", "MX", "BR", "DE", "FR", "IE", "SA", "MY", "PH", "ID"];

export function packFor(cc) {
  const C = COUNTRIES[cc];
  if (!C) return null;
  return { code: cc, name: C.name, engine: C.engine, ...PACKS[cc] };
}

export function countryOf(e) {
  return e?.country_code || "IN";
}

/** Public holidays for a country. India returns the company calendar unchanged. */
export function countryHolidays(companyHolidays, cc) {
  const p = PACKS[cc || "IN"];
  if (!p || !p.holidays) return companyHolidays;
  return [...p.holidays].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Leave types for a country: the company policy, raised to the statutory floor where it is lower,
 * plus any statutory leave the country adds. India returns the company list unchanged.
 */
export function countryLeaveTypes(companyTypes, cc) {
  const p = PACKS[cc || "IN"];
  if (!p || cc === "IN" || !cc) return companyTypes;
  const L = p.leave || {};
  const out = companyTypes.map((t) => {
    if (t.code === "EL" && L.annual != null && (t.annual ?? 0) < L.annual) return { ...t, annual: L.annual, statutory_floor: L.annual, company_annual: t.annual };
    if (t.code === "SL" && L.sick != null && (t.annual ?? 0) < L.sick) return { ...t, annual: L.sick, statutory_floor: L.sick, company_annual: t.annual };
    return t;
  });
  return [...out, ...(L.extra || []).filter((x) => !out.some((t) => t.code === x.code))];
}

/** Shortcut for the data a signed-in employee should see: their own country's holidays and leave types. */
export function holidaysFor(data, emp) {
  return countryHolidays(data.holidays, countryOf(emp));
}
export function leaveTypesFor(data, emp) {
  return countryLeaveTypes(data.leaveTypes, countryOf(emp));
}

export function fmtMoney(n, cc) {
  const p = packFor(cc);
  if (!p || !Number.isFinite(n)) return "—";
  // Use the local symbol (N$, R, KSh, ₦, P …): some browsers print NAD/BWP as a bare "$".
  const digits = p.currency === "INR" ? 0 : 2;
  let num;
  try {
    num = Math.abs(n).toLocaleString(p.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  } catch {
    num = Math.abs(n).toFixed(digits);
  }
  const sym = p.symbol.length > 2 ? `${p.symbol} ` : p.symbol;
  return `${n < 0 ? "−" : ""}${sym}${num}`;
}

/**
 * Browser-saved data from before the country packs were added does not have the Africa-region demo staff,
 * offices or exchange rates. Add whatever is missing from the fresh seed; nothing that exists is changed.
 */
export function withCountryData(saved, fresh) {
  const out = { ...saved };
  const have = new Set((saved.employees || []).map((e) => e.employee_code));
  const add = (fresh.employees || []).filter((e) => !have.has(e.employee_code) && ADDED_COUNTRIES.includes(e.country_code));
  if (add.length) out.employees = [...saved.employees, ...add];
  const fences = new Set((saved.geofences || []).map((g) => g.id));
  const addF = (fresh.geofences || []).filter((g) => !fences.has(g.id) && ADDED_COUNTRIES.includes(g.country));
  if (addF.length) out.geofences = [...(saved.geofences || []), ...addF];
  out.fx = { ...(fresh.fx || {}), ...(saved.fx || {}) };
  for (const e of add) {
    if (fresh.consents?.[e.employee_code] !== undefined) out.consents = { ...(out.consents || {}), [e.employee_code]: fresh.consents[e.employee_code] };
    if (fresh.benefits?.[e.employee_code] && out.benefits) out.benefits = { ...out.benefits, [e.employee_code]: fresh.benefits[e.employee_code] };
  }
  const freshPunches = (fresh.punches || []).filter((pn) => add.some((e) => e.employee_code === pn.employee_code));
  if (freshPunches.length) out.punches = [...(saved.punches || []), ...freshPunches];
  return out;
}
