// v10.8 · SEO — the public (search-indexed) pages and the per-screen titles/descriptions of the app.
// Plain JavaScript (no JSX) so the build-time pre-renderer (scripts/seo-prerender.mjs) and the app share one source.

export const BRAND = {
  name: "EZY HR",
  tagline: "AI-enabled HRMS by Ezyo",
  org: "Ezyo",
  sdName: "EZY Service Desk",
  sdTagline: "AI Enabled Service Desk by Ezyo",
  locale: "en_IN",
  twitter: "",
};

export const PRICING = [
  { id: "free", name: "Free", base: 0, per: 0, colour: "#66767E", blurb: "Core HR, attendance, leave and payroll compute with PF, ESI, PT, TDS and LWF.", features: ["Employee records & documents", "Attendance & leave", "Payroll compute", "Employee self-service app"] },
  { id: "growth", name: "Payroll OS", base: 1249, per: 99, colour: "#1F9D63", blurb: "Everything in Free, plus the payroll agent, bank payouts and statutory filing.", features: ["Everything in Free", "Bank payouts & payslips", "Statutory filing & year-end forms", "Approvals, inbox & HR toolkit", "Mobile app"] },
  { id: "global", name: "Global", base: 4999, per: 249, colour: "#7E57C2", blurb: "Everything in Payroll OS, plus multi-country payroll, contractors and API access.", features: ["Everything in Payroll OS", "Multi-country & multi-entity", "Contract & freelance payments", "Spend cards & API access", "Priority EZY Support"] },
];

export const FAQ = [
  ["How many employees can EZY HR handle?", "From a 10-person start-up to 10 lakh (1 million) employees in one company. Large companies run on the EZY HR server with PostgreSQL, so every search, approval and payroll run stays fast."],
  ["Does EZY HR handle Indian statutory compliance?", "Yes — PF, ESI, professional tax, LWF and TDS under the new and old tax regimes, with payslips, bank advice files and year-end forms."],
  ["Is there a mobile app?", "Yes. The same EZY HR runs on the web, Android and iPhone, with geofenced attendance, leave, payslips and approvals."],
  ["How is pricing calculated?", "A monthly base fee plus a fee per employee. Annual billing gives two months free. The Free plan stays free."],
  ["Can I try it before buying?", "Yes. Contact us with your employee count, see your price instantly and start with the Free plan."],
];

// Public pages: path (real URL for search engines) → the app screen it opens.
export const PUBLIC_PAGES = [
  {
    path: "/", hash: "#/welcome", priority: 1.0, changefreq: "weekly",
    title: "EZY HR · AI-enabled HRMS & payroll software by Ezyo",
    description: "EZY HR is AI-enabled HR and payroll software for 10 to 10 lakh employees: attendance, leave, payroll with PF, ESI, PT and TDS, approvals, documents and a mobile app.",
    h1: "AI-enabled HR and payroll for every company size",
    intro: "EZY HR brings people records, attendance, leave, payroll, compliance, approvals, documents and an employee mobile app together — built for India, ready for the world, and fast from 10 to 10,00,000 employees.",
    sections: [
      ["Core HR & employee records", "One record per person with documents, background verification, org chart and self-service profile updates approved by HR."],
      ["Attendance & leave", "Geofenced mobile punch, biometric devices, shifts and rosters, leave policies and holiday calendars by location."],
      ["Payroll & compliance", "Payroll for every active employee with loss of pay from attendance, PF, ESI, professional tax, LWF and new-regime TDS, bank advice files and payslips."],
      ["Approvals inbox", "Leave, expenses, advances, loans and IT requests flow to managers and HR; approve one by one or thousands at once."],
      ["Built for scale", "PostgreSQL with monthly partitions, indexed search over 10 lakh employees and payroll computed inside the database."],
      ["Web, Android and iPhone", "The same EZY HR on every device, in English and regional languages."],
    ],
  },
  {
    path: "/pricing/", hash: "#/welcome?view=pricing", priority: 0.9, changefreq: "monthly",
    title: "EZY HR pricing · HRMS & payroll plans from ₹0",
    description: "EZY HR plans: Free, Payroll OS from ₹1,249 + ₹99 per employee per month, and Global from ₹4,999 + ₹249 per employee. Annual billing gives two months free.",
    h1: "Simple pricing for 10 to 10 lakh employees",
    intro: "A monthly base fee plus a fee per employee. Pay yearly and get two months free. Start on the Free plan and upgrade when you need payroll payouts, statutory filing or multiple countries.",
    pricing: true, faq: true,
  },
  {
    path: "/contact/", hash: "#/welcome", priority: 0.8, changefreq: "monthly",
    title: "Contact EZY HR · Get a quote for your employee count",
    description: "Tell us about your company and employee count and get your EZY HR price instantly. Our team sets up your account within one working day.",
    h1: "Contact EZY HR",
    intro: "Share your name, company, work e-mail, phone and how many employees you have. You will see your price straight away, pick a plan and we will set up your account within one working day.",
  },
  {
    path: "/service-desk/", hash: "#/welcome", priority: 0.7, changefreq: "monthly",
    title: "EZY Service Desk · AI Enabled IT Service Desk by Ezyo",
    description: "EZY Service Desk: IT tickets with SLA tracking, asset register, IT purchase approvals and a 30-minute to 1-hour response target — part of EZY HR.",
    h1: "EZY Service Desk — AI Enabled Service Desk by Ezyo",
    intro: "IT tickets with SLAs, asset allocation and returns, IT purchase approvals and a quick-support channel for every employee, built into EZY HR.",
    sections: [
      ["IT tickets with SLAs", "Employees raise tickets from the app; the desk sees what is close to or past its SLA first."],
      ["Assets", "Laptops, phones, monitors and licences — allocated, returned and tracked per employee."],
      ["IT purchase approvals", "Requests flow from IT to HR and Finance with full history."],
    ],
  },
  {
    path: "/login/", hash: "#/login", priority: 0.5, changefreq: "yearly",
    title: "Sign in · EZY HR",
    description: "Sign in to EZY HR as an employee, admin or Super Admin.",
    h1: "Sign in to EZY HR",
    intro: "Employees sign in with their work e-mail, employee code and password; admins and the Super Admin also confirm a one-time code.",
  },
];

// Per-section descriptions for the signed-in app (used for titles/descriptions; app screens are never indexed).
export const SECTION_DESC = {
  home: "Your day at a glance: attendance, leave, approvals and celebrations.",
  "inbox-hub": "Approvals waiting on you and notifications.",
  "people-hub": "Employee records, org chart, documents, letters and exits.",
  "pay-hub": "Payroll, payslips, expenses, loans and benefits.",
  "time-hub": "Attendance, shifts, rosters and leave.",
  "enterprise-hub": "Company-wide data straight from the database.",
  "platform-hub": "Plan, billing, integrations, security and support.",
};

export const pageFor = (path) => PUBLIC_PAGES.find((p) => p.path === path);
export const inr = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;

// JSON-LD for a public page. `site` is the absolute site URL (no trailing slash).
export function jsonLd(page, site) {
  const url = `${site}${page.path}`;
  const out = [
    { "@context": "https://schema.org", "@type": "Organization", name: BRAND.org, url: site, logo: `${site}/brand/icon-512.png` },
    { "@context": "https://schema.org", "@type": "WebSite", name: BRAND.name, url: site, inLanguage: "en-IN" },
    {
      "@context": "https://schema.org", "@type": "SoftwareApplication", name: page.path === "/service-desk/" ? BRAND.sdName : BRAND.name,
      applicationCategory: "BusinessApplication", applicationSubCategory: page.path === "/service-desk/" ? "IT service management" : "Human resources and payroll",
      operatingSystem: "Web, Android, iOS", url, description: page.description,
      offers: PRICING.map((p) => ({ "@type": "Offer", name: p.name, price: String(p.base), priceCurrency: "INR", description: p.per ? `${inr(p.base)} per month plus ${inr(p.per)} per employee per month` : "Free forever" })),
    },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: BRAND.name, item: `${site}/` }, ...(page.path === "/" ? [] : [{ "@type": "ListItem", position: 2, name: page.h1, item: url }])] },
  ];
  if (page.faq) out.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
  return out;
}
