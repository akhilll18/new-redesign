// Sidebar per role. v10.4: every sidebar entry is a hub; its `tabs` are the screens (route ids) inside it, shown as
// sub-tabs at the top of the page. Each screen lives in exactly one hub, so there are no duplicate tabs or sub-tabs.
// `module` / `modules`: an admin sees the tab only when they hold that module. `when(ctx)`: extra condition.
// `grant`: admin kinds that see the tab regardless of modules. `alias`: extra routes served by the same tab.
// `action`: not a route — the shell runs it (switch to the employee workspace and back).
import { isContingent } from "./employeeFields.js";
import { isRestrictedWorker, isZeroLeaveWorker, benefitsEligible, adminKind } from "../lib/statutory.js";

// v10.6 (review of 17–20 Nov 2026): menus re-aligned role by role. Nothing was deleted from the code base; screens that
// were merged now open inside the screen they were merged into (hidden tabs keep old links working).
// Finance admins: finance, payment and compliance only — no HR screens, no assets (assets go to IT), no time & workforce.
export const FINANCE_HIDE = new Set(["people-xp", "organization", "learning", "insights", "recruitment", "offers", "bgv", "onboarding", "performance", "talent", "succession", "learning-admin", "workforce", "live-map", "calls-admin", "monitoring", "wellness", "it-helpdesk", "activity", "global-hiring", "leave-rules", "ijp-admin", "assets-admin", "attendance-admin", "live-board", "bulk-upload", "toolkit"]);
// HR admins: HR screens plus the high-level pay view (payslip release, benefits, wellness) — no payroll engine, payouts,
// payroll entities, expense hub, spend cards or finance integrations; compliance and expert support sit with Finance.
export const HR_HIDE = new Set(["loan-access", "payroll-agent", "payroll", "payroll-entities", "expense-hub", "spend-cards", "integrations", "compliance-autopilot", "compliance-calendar", "statutory-checklist", "expert-support", "statutory-portals"]);
// v10.6: IT admins see the IT service desk, assets, IT purchase approvals and the collaboration screens only.
export const IT_SHOW = new Set(["admin", "inbox", "notifications", "approvals", "it-helpdesk", "it-purchase", "assets-admin", "it-reports", "calendar", "meetings-internal", "meetings", "chat", "support", "it-support", "profile", "people", "organization", "tasks", "switch-emp", "dropdown-lists"]); // v10.13: dropdown lists for IT & asset lists

const hasLinkedEmployee = ({ data, user }) => !!user?.employee_code && (data?.employees || []).some((e) => e.employee_code === user.employee_code && !["exited", "rejected"].includes(e.status));
const notContingent = ({ me }) => !isContingent(me);

export const ROLE_NAV = {
  emp: [
    { group: "", items: [
      { id: "switch-back", label: "Back to admin workspace", icon: "SwitchAccount", action: "switch-back", when: ({ origin }) => !!origin },
      { id: "home", label: "Home", icon: "Home" },
      // v10.6: one screen — Inbox, Notifications and Document requests are tabs inside it (no extra side bar).
      // v10.7: Inbox, Notifications and Document requests are items in the side bar (not a row of tabs).
      { id: "inbox-hub", label: "Inbox & notifications", icon: "Inbox", badges: ["inbox-all", "docreq", "notes"], tabs: [
        { id: "inbox", label: "Inbox", badge: "inbox-all" },
        { id: "notifications", label: "Notifications", badge: "notes" },
        { id: "doc-requests", label: "Document requests", badge: "docreq", when: notContingent },
      ] },
      { id: "profile-hub", label: "My profile", icon: "Person", badges: ["docs-me", "bgv-me", "contract-me"], tabs: [
        { id: "profile", label: "Personal details", alias: ["profile-workforce"] },
        { id: "profile-contacts", label: "Contacts" },
        // v10.7: contract / freelance / intern: no Employment tab — its fields are under Contract & engagement.
        { id: "profile-employment", label: "Employment", when: notContingent },
        { id: "profile-contract", label: "Contract & engagement", when: ({ me }) => isContingent(me) },
        { id: "my-contract", label: "My contract & payment", badge: "contract-me", when: ({ me }) => isContingent(me) },
        { id: "profile-pay", label: "Pay & statutory", when: ({ me, data }) => !isRestrictedWorker(me, data.settings) },
        { id: "documents", label: "Documents · My files", badge: "docs-me" },
        { id: "bgv-me", label: "BGV", badge: "bgv-me", when: ({ data, me }) => (data.bgv || []).some((c) => c.employee_code === me?.employee_code && !c.cancelled) },
        { id: "onboarding-me", label: "Onboarding", when: ({ data, me }) => data.onboarding.some((o) => o.employee_code === me?.employee_code) },
        { id: "my-privacy", label: "Privacy & my data" },
        // v10.7: Country space (holidays) moved to Calendar & tasks → Leave & holidays; My sign-in activity removed.
      ] },
      { id: "calendar-hub", label: "Calendar & tasks", icon: "CalendarMonth", tabs: [
        { id: "calendar", label: "Calendar" },
        { id: "leave", label: "Leave & holidays", alias: ["holidays"], relabel: ({ me, data }) => (isZeroLeaveWorker(me, data.settings) ? "Request leave & holidays" : null) },
        { id: "my-tasks", label: "My tasks" },
        { id: "meetings-internal", label: "Internal meetings" },
        { id: "meetings", label: "Client meetings" },
      ] },
      { id: "attendance-hub", label: "Attendance", icon: "Fingerprint", badges: ["ts-approve"], tabs: [
        // v10.6: attendance and my activity are one screen (punch location, IP address, custom dates).
        { id: "attendance", label: "Attendance & activity", alias: ["my-activity"] },
        { id: "my-shifts", label: "Timesheet & shifts" },
        { id: "calls", label: "My calls", when: ({ me }) => me?.call_tracking === "yes" },
        { id: "team-timesheets", label: "Contractor timesheets", badge: "ts-approve", when: ({ data, me }) => (data.contracts || []).some((c) => ["active", "suspended", "pending_approval"].includes(c.status) && (c.timesheet_approver || data.employees.find((e) => e.employee_code === c.employee_code)?.reporting_manager) === me?.employee_code) },
      ] },
      { id: "talent-hub", label: "Talent & recognition", icon: "EmojiEvents", tabs: [
        { id: "performance-me", label: "Performance & goals" },
        { id: "people-xp", label: "People & recognition" },
        { id: "learning", label: "Learning" },
      ] },
      { id: "pay-hub", label: "Pay & benefits", icon: "AccountBalanceWallet", tabs: [
        { id: "finances", label: "My payslips", when: ({ data, me }) => !isRestrictedWorker(me, data.settings) },
        { id: "finances-manage", label: "Tax, salary & loan", when: ({ data, me }) => !isRestrictedWorker(me, data.settings) },
        { id: "expenses", label: "Expenses & travel" },
        { id: "benefits-me", label: "Benefits & wellness", when: ({ data, me }) => benefitsEligible(data, me) },
        { id: "my-card", label: "My spend card", when: ({ data, me }) => !isRestrictedWorker(me, data.settings) && (data.suite?.cards || []).some((c) => c.employee_code === me?.employee_code) },
      ] },
      // v10.13: self-service forms on the approval engine (work from home, travel, overtime, letters, grievance)
      { id: "my-forms", label: "Requests & forms", icon: "Assignment" },
      { id: "my-relocation", label: "Relocation & visa", icon: "FlightTakeoff" },
      { id: "people-hub", label: "Org chart & people", icon: "AccountTree", tabs: [
        { id: "organization", label: "Org chart" },
        { id: "people", label: "People" },
      ] },
      { id: "support-hub", label: "Quick support", icon: "SupportAgent", badges: ["chat", "it-me"], tabs: [
        { id: "support", label: "HR support" },
        { id: "assets", label: "IT support & my assets", badge: "it-me", alias: ["it-support"] },
        { id: "chat", label: "Chat", badge: "chat" },
        { id: "my-app", label: "Mobile app" },
      ] },
      // v10.6: IJP is for employees on payroll only (not contract / freelance); position-upgrade requests removed.
      { id: "ijp-hub", label: "IJP", icon: "Work", when: notContingent, tabs: [
        { id: "ijp", label: "Internal job postings" },
        { id: "ijp-relocation", label: "Relocation requests" },
      ] },
      { id: "my-exit", label: "Resignation & exit", icon: "ExitToApp" },
    ] },
    { group: "MY TEAM", managerOnly: true, items: [
      { id: "team-hub", label: "My team", icon: "Groups", badges: ["inbox"], tabs: [
        { id: "team-approvals", label: "All approvals", badge: "inbox" },
        // v10.6: team calendar (names on each day) and team activity are part of the team summary.
        { id: "team", label: "Team summary", alias: ["team-activity"] },
        { id: "team-live", label: "Live location" },
        { id: "team-calls", label: "Calls", when: ({ data, me }) => data.employees.some((e) => e.reporting_manager === me?.employee_code && e.call_tracking === "yes") },
        { id: "team-reviews", label: "Reviews" },
      ] },
    ] },
  ],
  // HR admin, Finance admin and IT admin share one menu; the admin kind and modules decide which tabs appear.
  admin: [
    { group: "WORKSPACE", items: [
      // v10.7: every admin also works as an employee — My employee space ↔ Back to admin workspace.
      { id: "switch-emp", label: "My employee space", icon: "SwitchAccount", action: "switch-emp", when: hasLinkedEmployee },
      { id: "admin", label: "Dashboard", icon: "Dashboard" },
      // v10.8: whole-company screens on the database (server mode only)
      { id: "enterprise-hub", label: "Enterprise data", icon: "Hub", when: ({ data }) => !!data?.__server, tabs: [
        { id: "ent-directory", label: "Employee directory", when: ({ data }) => !!data?.__server },
        { id: "ent-approvals", label: "Approvals at scale", when: ({ data }) => !!data?.__server },
        { id: "ent-payroll", label: "Payroll for all", modules: ["payroll", "payslips"], when: ({ data }) => !!data?.__server },
        { id: "ent-import", label: "Bulk import", modules: ["accounts"], when: ({ data }) => !!data?.__server },
      ] },
      // v10.6: inbox, all approvals and notifications merged into one screen.
      { id: "inbox-hub", label: "Inbox & notifications", icon: "Inbox", badges: ["inbox-all", "it-buy", "emp-req", "notes"], tabs: [
        { id: "inbox", label: "Inbox · approvals", alias: ["approvals"], badge: "inbox-all" },
        { id: "it-purchase", label: "IT purchases", badge: "it-buy", when: ({ user }) => adminKind(user) !== "it" },
        { id: "emp-requests", label: "Employee requests", badge: "emp-req", modules: ["accounts"] },
        { id: "notifications", label: "Notifications", badge: "notes" },
      ] },
      // v10.13: the dropdown lists that belong to this admin's work (+ to add values)
      { id: "dropdown-lists", label: "Dropdown lists", icon: "ListAlt", modules: ["accounts", "expense", "payroll", "payslips", "assets", "it", "recruitment", "learning", "attendance"] },
      { id: "it-desk-hub", label: "IT service desk", icon: "Computer", badges: ["it-desk", "it-buy"], tabs: [
        { id: "it-helpdesk", label: "IT tickets", badge: "it-desk", module: "it" },
        { id: "it-purchase", label: "IT purchase approvals", badge: "it-buy", module: "it" },
        { id: "assets-admin", label: "Assets & allocation", module: "assets" },
      ] },
      // v10.7: Oversight · task authorisation removed for HR admins (All activities stays with the Super Admin).
    ] },
    { group: "MODULES", items: [
      { id: "corehr-hub", label: "People & organisation", icon: "Badge", badges: ["contracts", "docreq-admin"], tabs: [
        { id: "people", label: "Employee database" },
        { id: "bulk-upload", label: "Bulk uploads", modules: ["accounts"] },
        { id: "organization", label: "Org chart" },
        { id: "documents", label: "Documents & letters" },
        { id: "doc-requests", label: "Document requests" },
        { id: "contracts", label: "Contract management", badge: "contracts", modules: ["contracts", "payroll"] },
        { id: "exits", label: "Exits & F&F", modules: ["accounts", "payroll", "onboarding", "leave"] },
      ] },
      { id: "hire-hub", label: "Hire & onboard", icon: "Work", badges: ["bgv"], tabs: [
        { id: "recruitment", label: "Recruitment · shared profiles", module: "recruitment" },
        { id: "offers", label: "Offer letters", module: "offers" },
        { id: "bgv", label: "Background verification", badge: "bgv", when: ({ data, user }) => user?.modules?.includes("bgv") || (data.bgvAccess || []).some((g) => g.code === user?.code && !g.revoked) },
        { id: "onboarding", label: "Onboarding", module: "onboarding" },
        { id: "ijp-admin", label: "IJP & internal moves", modules: ["recruitment", "onboarding", "accounts"] },
        { id: "global-hiring", label: "Global hiring · EOR & CoR", modules: ["contracts", "payroll", "recruitment"] },
      ] },
      { id: "reloc-hub", label: "Relocation & visa", icon: "FlightTakeoff", tabs: [
        { id: "relocation", label: "Relocation & visas", modules: ["onboarding", "accounts", "payroll"] },
        { id: "companies", label: "Companies & locations", modules: ["accounts", "payroll", "expense"] },
      ] },
      { id: "pay-hub", label: "Pay & benefits", icon: "Payments", badges: ["payslips"], tabs: [
        { id: "payroll-agent", label: "Payroll Agent", module: "payroll", alias: ["variable-pay", "payouts", "filings", "global-payroll"] },
        { id: "payroll", label: "Payroll runs", module: "payroll" },
        { id: "payslips", label: "Payslips", badge: "payslips", modules: ["payslips", "payroll"] },
        { id: "statutory-portals", label: "PF & income-tax portals", modules: ["payroll", "payslips", "accounts"] },
        { id: "payroll-entities", label: "Payroll entities & tax", modules: ["payroll", "accounts", "payslips"] },
        { id: "expense-hub", label: "Expense hub", modules: ["expense", "advance", "payroll"] },
        // v10.7: Finance switches the salary-loan request on / off per employee (after 1 year of service)
        { id: "loan-access", label: "Salary loan access", modules: ["loan", "payroll"] },
        { id: "spend-cards", label: "Spend cards", modules: ["expense", "payroll"] },
        { id: "benefits-admin", label: "Benefits", module: "benefits" },
        { id: "wellness", label: "Wellness", module: "wellness" },
      ] },
      // v10.6: compliance sits under Finance.
      { id: "compliance-hub", label: "Compliance", icon: "Policy", badges: ["compliance"], tabs: [
        { id: "statutory-checklist", label: "Statutory compliances", modules: ["compliance", "payroll"] },
        { id: "compliance-autopilot", label: "Compliance autopilot", modules: ["compliance", "payroll"], alias: ["compliance-alerts", "rule-updates", "audit-pack", "privacy-center"] },
        { id: "compliance-calendar", label: "Compliance calendar", badge: "compliance", modules: ["compliance", "payroll"] },
        { id: "country", label: "Country space", when: ({ user }) => !!user?.locale_access },
      ] },
      { id: "talent-hub", label: "Talent", icon: "AutoGraph", tabs: [
        { id: "performance", label: "Performance & goals", module: "performance" },
        { id: "talent", label: "Talent management", module: "performance" },
        { id: "succession", label: "Succession", module: "performance" },
        { id: "learning-admin", label: "Learning & development", module: "learning" },
        { id: "learning", label: "Learning library" },
        { id: "people-xp", label: "Recognition & rewards" },
      ] },
      { id: "time-hub", label: "Time & workforce", icon: "Schedule", tabs: [
        { id: "attendance-admin", label: "Time & attendance", module: "attendance" },
        { id: "live-board", label: "Live board, roster & monitoring", modules: ["attendance", "workforce", "payroll"], alias: ["shifts", "timesheets", "monitoring"] },
        { id: "workforce", label: "Workforce management", module: "workforce" },
        { id: "leave-rules", label: "Leave rule-sets", module: "leave" },
        { id: "live-map", label: "Geofencing & live location", module: "location" },
        { id: "calls-admin", label: "Call tracker", module: "calls" },
      ] },
      { id: "reports-hub", label: "Reports & AI automation", icon: "Insights", badges: ["automation"], tabs: [
        { id: "reports", label: "Reports" },
        { id: "insights", label: "Workforce intelligence" },
        { id: "automation", label: "AI automation", badge: "automation" },
        { id: "integrations", label: "Integrations & API", modules: ["payroll", "expense"] },
      ] },
      { id: "toolkit", label: "HR toolkit · templates", icon: "Folder", tone: "green" },
    ] },
    { group: "COLLABORATE & SUPPORT", items: [
      { id: "calendar-hub", label: "Calendar & tasks", icon: "CalendarMonth", tabs: [
        { id: "calendar", label: "Calendar" },
        { id: "tasks", label: "Tasks & projects" },
        { id: "meetings-internal", label: "Internal meetings" },
        { id: "meetings", label: "Client meetings" },
      ] },
      { id: "support-hub", label: "Chat & support", icon: "SupportAgent", badges: ["chat", "it-me"], tabs: [
        { id: "chat", label: "Chat", badge: "chat" },
        { id: "support", label: "HR support" },
        { id: "it-support", label: "IT support", badge: "it-me" },
        { id: "expert-support", label: "Expert support" },
        // v10.6: "My admin profile" left the menu; it opens from the account menu (top right).
        { id: "profile", label: "My admin profile", hidden: true },
      ] },
    ] },
  ],
  superadmin: [
    { group: "CONTROL", items: [
      { id: "switch-emp", label: "My employee space", icon: "SwitchAccount", action: "switch-emp", when: hasLinkedEmployee },
      { id: "super", label: "Dashboard", icon: "Dashboard" },
      // v10.8: whole-company screens on the database (server mode only)
      { id: "enterprise-hub", label: "Enterprise data", icon: "Hub", when: ({ data }) => !!data?.__server, tabs: [
        { id: "ent-directory", label: "Employee directory", when: ({ data }) => !!data?.__server },
        { id: "ent-approvals", label: "Approvals at scale", when: ({ data }) => !!data?.__server },
        { id: "ent-payroll", label: "Payroll for all", modules: ["payroll", "payslips"], when: ({ data }) => !!data?.__server },
        { id: "ent-import", label: "Bulk import", when: ({ data }) => !!data?.__server },
        { id: "ent-database", label: "Database & performance", when: ({ data }) => !!data?.__server },
      ] },
      // v10.6: inbox, notifications and all approvals / requests / activities merged.
      { id: "inbox-hub", label: "Inbox & notifications", icon: "Inbox", badges: ["inbox-all", "escalated", "emp-req", "notes"], tabs: [
        { id: "inbox", label: "Inbox · approvals", badge: "inbox-all" },
        { id: "emp-requests", label: "Employee requests", badge: "emp-req" },
        { id: "notifications", label: "Notifications", badge: "notes" },
        { id: "requests", label: "All requests", badge: "escalated" },
        { id: "activity", label: "All activities" },
        { id: "audit", label: "Audit log" },
      ] },
      { id: "access-hub", label: "Users, access & policies", icon: "AdminPanelSettings", badges: ["locked"], tabs: [
        { id: "users", label: "Users & access", badge: "locked" },
        { id: "policies", label: "Policies & rules" },
        { id: "settings", label: "System settings" },
        { id: "security", label: "Security & backups" },
        // v10.13: every dropdown in the app; + adds values to the growable lists
        { id: "dropdown-lists", label: "Dropdown lists" },
      ] },
      { id: "platform-hub", label: "Platform", icon: "RocketLaunch", tabs: [
        // v10.6: Plan & billing = My plan (with feature coverage) + Explore plans; also shown on the dashboard.
        { id: "billing", label: "Plan & billing", alias: ["coverage"] },
        { id: "setup", label: "Setup & data import" },
        { id: "integrations", label: "Integrations & API" },
        { id: "expert-support", label: "Expert support" },
        // v10.7: chat with EZY Support (the vendor) from the Super Admin login
        { id: "ezy-support", label: "Chat with EZY Support" },
      ] },
    ] },
    { group: "MODULES", items: [
      { id: "corehr-hub", label: "People & organisation", icon: "Badge", badges: ["contracts"], tabs: [
        { id: "employees", label: "Employee database" },
        { id: "bulk-upload", label: "Bulk uploads" },
        { id: "organization", label: "Org chart" },
        { id: "documents", label: "Documents & letters" },
        { id: "doc-requests", label: "Document requests" },
        { id: "contracts", label: "Contract management", badge: "contracts" },
        { id: "exits", label: "Exits & F&F" },
        { id: "fields", label: "Field reference" },
      ] },
      { id: "it-desk-hub", label: "IT service desk", icon: "Computer", badges: ["it-desk", "it-buy"], tabs: [
        { id: "it-helpdesk", label: "IT tickets", badge: "it-desk" },
        { id: "it-purchase", label: "IT purchase approvals", badge: "it-buy" },
        { id: "assets-admin", label: "Assets & allocation" },
      ] },
      { id: "hire-hub", label: "Hire & onboard", icon: "Work", badges: ["bgv"], tabs: [
        { id: "recruitment", label: "Recruitment · shared profiles" },
        { id: "offers", label: "Offer letters" },
        { id: "bgv", label: "Background verification", badge: "bgv" },
        { id: "onboarding", label: "Onboarding" },
        { id: "ijp-admin", label: "IJP & internal moves" },
        { id: "global-hiring", label: "Global hiring · EOR & CoR" },
      ] },
      { id: "reloc-hub", label: "Relocation & visa", icon: "FlightTakeoff", tabs: [
        { id: "relocation", label: "Relocation & visas" },
        { id: "companies", label: "Companies & locations" },
      ] },
      { id: "pay-hub", label: "Pay & benefits", icon: "Payments", badges: ["payslips"], tabs: [
        { id: "payroll-agent", label: "Payroll Agent", alias: ["variable-pay", "payouts", "filings", "global-payroll"] },
        { id: "payroll", label: "Payroll runs" },
        { id: "payslips", label: "Payslips", badge: "payslips" },
        { id: "statutory-portals", label: "PF & income-tax portals" },
        { id: "payroll-entities", label: "Payroll entities & tax" },
        { id: "expense-hub", label: "Expense hub" },
        { id: "loan-access", label: "Salary loan access" },
        { id: "spend-cards", label: "Spend cards" },
        { id: "benefits-admin", label: "Benefits & wellness" },
      ] },
      { id: "global-hub", label: "Global & compliance", icon: "Public", badges: ["compliance"], tabs: [
        { id: "statutory-checklist", label: "Statutory compliances" },
        { id: "compliance-autopilot", label: "Compliance autopilot", alias: ["compliance-alerts", "rule-updates", "audit-pack", "privacy-center"] },
        { id: "compliance-calendar", label: "Compliance calendar", badge: "compliance" },
        { id: "compliance", label: "Local policies" },
        { id: "country", label: "Country space" },
        { id: "territory", label: "Multi-territory workforce" },
      ] },
      { id: "talent-hub", label: "Talent", icon: "AutoGraph", tabs: [
        { id: "performance", label: "Performance & goals" },
        { id: "talent", label: "Talent management" },
        { id: "succession", label: "Succession" },
        { id: "learning-admin", label: "Learning & development" },
        { id: "people-xp", label: "Recognition & rewards" },
      ] },
      { id: "time-hub", label: "Time & workforce", icon: "Schedule", tabs: [
        { id: "attendance-admin", label: "Time & attendance" },
        { id: "live-board", label: "Live board, roster & monitoring", alias: ["shifts", "timesheets", "monitoring"] },
        { id: "workforce", label: "Workforce management" },
        { id: "leave-rules", label: "Leave rule-sets" },
        { id: "geofences", label: "Geofences & devices" },
        { id: "live-map", label: "Live location" },
        { id: "calls-admin", label: "Call tracker" },
        { id: "monitoring-policy", label: "Monitoring policy" },
      ] },
      { id: "reports-hub", label: "Reports & AI automation", icon: "Insights", badges: ["automation"], tabs: [
        { id: "reports", label: "Reports" },
        { id: "analytics", label: "HR analytics" },
        { id: "insights", label: "Workforce intelligence" },
        { id: "automation", label: "AI automation", badge: "automation" },
      ] },
      { id: "toolkit", label: "HR toolkit · templates", icon: "Folder", tone: "green" },
    ] },
    { group: "COLLABORATE", items: [
      { id: "calendar-hub", label: "Calendar & tasks", icon: "CalendarMonth", tabs: [
        { id: "calendar", label: "Calendar" },
        { id: "tasks", label: "Tasks & projects" },
        { id: "meetings-internal", label: "Internal meetings" },
        { id: "meetings", label: "Client meetings" },
      ] },
      { id: "chat", label: "Chat", icon: "Forum", badge: "chat" },
    ] },
  ],
};

function tabAllowed(i, { role, kind, user, data, me, origin }) {
  if (kind === "it") return IT_SHOW.has(i.id) && (!i.when || !data || i.when({ data, me, user, origin }));
  if (i.id === "toolkit" && kind === "finance") return false;
  if (kind === "finance" && FINANCE_HIDE.has(i.id)) return false;
  if (kind === "hr" && HR_HIDE.has(i.id)) return false;
  const granted = kind && (i.grant || []).includes(kind);
  if (!granted && i.module && role === "admin" && !(user?.modules || []).includes(i.module)) return false;
  if (!granted && i.modules && role === "admin" && !i.modules.some((m) => (user?.modules || []).includes(m))) return false;
  if (i.when && data && !i.when({ data, me, user, origin })) return false;
  return true;
}

/**
 * Menu for this user. Each item is either a single screen, an action, or a hub whose `tabs` were filtered for this user;
 * a hub's `id` becomes its first visible tab so clicking it opens that screen.
 */
export function navFor(role, isManager, ctx = {}) {
  const { user, data, origin } = ctx;
  const me = role === "emp" && data && user ? data.employees.find((e) => e.employee_code === user.employee_code) : null;
  const kind = role === "admin" ? adminKind(user) : null;
  const c = { role, kind, user, data, me, origin };
  const relabel = (i) => (i.relabel && data ? { ...i, label: i.relabel({ data, me, user }) || i.label } : i);
  return (ROLE_NAV[role] || [])
    .filter((g) => !g.managerOnly || isManager)
    .map((g) => ({
      ...g,
      items: g.items
        .filter((i) => !i.hrOnly || kind === "hr" || kind === "hr_finance")
        .map((i) => {
          if (!i.tabs) return tabAllowed(i, c) ? relabel(i) : null;
          if (i.when && data && !i.when({ data, me, user, origin })) return null;
          const all = i.tabs.filter((t) => tabAllowed(t, c)).map(relabel);
          // v10.6: `hidden` tabs are routes served by this hub that open inside another tab's screen (merged screens).
          const tabs = all.filter((t) => !t.hidden);
          if (!tabs.length) return null;
          return { ...i, hub: i.id, id: tabs[0].id, tabs, alias: all.flatMap((t) => [t.id, ...(t.alias || [])]) };
        })
        .filter(Boolean),
    }))
    .filter((g) => g.items.length);
}

/** The hub (sidebar entry) that serves this route, if any. */
export function hubFor(groups, page) {
  for (const g of groups) for (const i of g.items) if (i.id === page || (i.alias || []).includes(page)) return i;
  return null;
}

/** Every screen (route) in the menu as { id, label, hub } — hubs expanded to their tabs; actions left out. */
export function navScreens(groups) {
  return groups.flatMap((g) => g.items).flatMap((i) => (i.action ? [] : i.tabs ? i.tabs.map((t) => ({ icon: i.icon, ...t, hub: i.label })) : [i]));
}
