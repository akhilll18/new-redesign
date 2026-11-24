import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCountryFilter } from "./country/CountryContext.jsx";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import PortalShell from "./components/PortalShell.jsx";
import PortalDialog from "./components/PortalDialog.jsx";
import { ToastHost, PageHeader } from "./components/kit/UI.jsx";
import AiLayer from "./components/ai/AiLayer.jsx";

// Original PeopleHub pages
import OverviewPage from "./pages/OverviewPage.jsx";
import PeoplePage from "./pages/PeoplePage.jsx";
import DocumentsPage from "./pages/DocumentsPage.jsx";
import LearningHub from "./pages/learning/LearningHub.jsx";
import AssetsAndIt from "./pages/workforce/AssetsAndIt.jsx";
import MyForms from "./pages/requests/MyForms.jsx";
import DropdownLists from "./pages/superadmin/DropdownLists.jsx";
import SupportPage from "./pages/SupportPage.jsx";
import OrganizationPage from "./pages/OrganizationPage.jsx";

// Employee (Keka / PeopleHR modules)
import InboxPage from "./pages/inbox/InboxPage.jsx";
import InboxHub from "./pages/inbox/InboxHub.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import LeavePage from "./pages/LeavePage.jsx";
import ExpensesPage from "./pages/ExpensesPage.jsx";
import FinancesPage from "./pages/FinancesPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import MyTeamPage from "./pages/team/MyTeamPage.jsx";

// Admin
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminReports from "./pages/admin/AdminReports.jsx";
import AdminProfile from "./pages/admin/AdminProfile.jsx";
import ApprovalsPage from "./pages/requests/ApprovalsPage.jsx";

// Super Admin
import SuperDashboard from "./pages/superadmin/SuperDashboard.jsx";
import EmployeeMaster, { EmployeeFormDialog } from "./pages/superadmin/EmployeeMaster.jsx";
import FieldReference from "./pages/superadmin/FieldReference.jsx";
import UsersAccess from "./pages/superadmin/UsersAccess.jsx";
import PoliciesPage from "./pages/superadmin/PoliciesPage.jsx";
import AllRequests from "./pages/superadmin/AllRequests.jsx";
import SuperReports from "./pages/superadmin/SuperReports.jsx";
import AuditLog from "./pages/superadmin/AuditLog.jsx";
import SystemSettings from "./pages/superadmin/SystemSettings.jsx";

// Glass dashboards, workforce, talent, pay and global modules
import EmployeeGlassHome from "./pages/glass/EmployeeGlassHome.jsx";
import { CelebrationsCard } from "./pages/v106/HomeExtras.jsx";
import { EnterpriseHeadcount, EnterpriseDirectory, EnterpriseApprovals, EnterprisePayroll, EnterpriseImport, DatabaseHealth } from "./pages/v108/Enterprise.jsx";
import OpsGlassHome from "./pages/glass/OpsGlassHome.jsx";
import MyAttendance from "./pages/workforce/MyAttendance.jsx";
import MyActivity from "./pages/workforce/MyActivity.jsx";
import MyBenefits from "./pages/workforce/MyBenefits.jsx";
import MyOnboarding from "./pages/workforce/MyOnboarding.jsx";
import MyPerformance, { TeamReviews } from "./pages/talent/MyPerformance.jsx";
import CallTracker from "./components/workforce/CallTracker.jsx";
import { ModulePage, TeamModulePage, MODULE_PAGES, PayrollReportsPage } from "./pages/modules/ModulePages.jsx";
import { useScopedEmployees as useScopedEmployeesV106 } from "./pages/glass/OpsGlassHome.jsx";
import { GeofencesDevices, MonitoringPolicy, Territory, Compliance, HRAnalytics } from "./pages/superadmin/OpsSuper.jsx";
import { getPosition } from "./lib/geo.js";
import { PayslipsAdminPage } from "./components/pay/PayslipViews.jsx";
import { OffersPage } from "./components/offers/OfferViews.jsx";
import CountryWorkspace from "./country/CountryWorkspace.jsx";
// v8: BGV, applicant tracking, compliance calendar, chat, meetings, AI calendar
import { BgvAdminPage, MyBgvPage, TeamBgvPage, useBgvLookup } from "./components/collab/BgvViews.jsx";
import { RecruitmentHub } from "./components/collab/AtsViews.jsx";
import ComplianceCalendarPage from "./components/collab/ComplianceCalendar.jsx";
import ChatPage from "./components/collab/ChatPage.jsx";
import CalendarPage from "./components/collab/CalendarViews.jsx";
import MeetingsPage from "./components/collab/MeetingsViews.jsx";
import ItSupportPage, { ItHelpdeskPage } from "./components/collab/ItSupport.jsx";
import { MyDocumentChecklist, EmployeeDocReview, canReviewDocs } from "./components/collab/MyDocuments.jsx";
import { bgvStatus, canSeeBgvColumn } from "./lib/collab.js";
// v8.7: contract management
import ContractsHub from "./components/contracts/ContractViews.jsx";
import MyContractPage, { TeamTimesheetsPage } from "./components/contracts/MyContract.jsx";
// v10: all-in-one suite — Payroll Agent, compliance autopilot, exits & F&F, shifts, leave rule-sets, PeopleXP,
// global hiring, relocation, spend cards, integrations, insights, setup, billing, security, expert support, coverage.
import PayrollAgent from "./pages/suite/PayrollAgent.jsx";
import ComplianceAutopilot, { MyPrivacy } from "./pages/suite/ComplianceAutopilot.jsx";
import Exits, { MyExit } from "./pages/suite/Exits.jsx";
import { LiveBoard, Shifts, MyShifts, MonitoringTab } from "./pages/suite/Workforce.jsx";
import LeaveRules from "./pages/suite/LeaveRules.jsx";
import PeopleXP, { MyApp } from "./pages/suite/PeopleXP.jsx";
import { GlobalHiring, Relocation, MyRelocation, SpendCards, MyCard } from "./pages/suite/GlobalTeams.jsx";
import { Integrations, Insights, SetupImport, Billing, Security, ExpertSupport } from "./pages/suite/Platform.jsx";
import Coverage from "./pages/suite/Coverage.jsx";
// v10.2: companies & locations, expense hub
import CompaniesLocations from "./pages/superadmin/CompaniesLocations.jsx";
import ExpenseHub from "./pages/suite/ExpenseHub.jsx";
// v10.3: payroll entities & tax registration, AI automation, HR all-activities view
import PayrollEntities from "./pages/suite/PayrollEntities.jsx";
import AutomationCentre from "./pages/suite/AutomationCentre.jsx";
import ActivityCentre from "./pages/suite/ActivityCentre.jsx";
import AutomationRunner from "./components/ai/AutomationRunner.jsx";
// v10.4: IJP (internal job postings, position upgrades, relocation to client / company locations)
import { MyIjp, MyIjpRelocation, IjpAdmin } from "./pages/suite/Ijp.jsx";
// v10.5: My files, document requests
import { MyFiles, EmployeeFilesAdmin, DocRequestsPage } from "./pages/suite/MyFiles.jsx";
import BulkActions from "./pages/suite/BulkActions.jsx";
import StatutoryPortals from "./pages/suite/StatutoryPortals.jsx";
// v10.6: merged screens, IT admin, HR toolkit, statutory compliances, team calendar
import { MergedTabs, Stacked } from "./pages/v106/Merged.jsx";
import { ItPurchaseApprovals, ItDashboard } from "./pages/v106/ItAdmin.jsx";
import HrToolkit from "./pages/v106/HrToolkit.jsx";
import StatutoryChecklist from "./pages/v106/StatutoryChecklist.jsx";
import TeamCalendar from "./pages/v106/TeamCalendar.jsx";
import AutoLetters from "./pages/v106/AutoLetters.jsx";
import Tasks from "./pages/v106/Tasks.jsx";
import { HolidaysCard, LoanAccessAdmin, ItSupportTatCard, EzySupportChat } from "./pages/v107/Extras.jsx";
import { Box } from "@mui/material";
import { PlanCard } from "./pages/suite/Platform.jsx";
import { adminKind } from "./lib/statutory.js";
import { isContingent } from "./data/employeeFields.js";

function ContractsPageWrap() {
  const { user } = useStore();
  const who = user.role === "superadmin" ? "SUPER ADMIN" : user.modules?.includes("payroll") ? "FINANCE · APPROVES & PAYS" : "HR · PREPARES";
  return (
    <>
      <PageHeader eyebrow={`CORE HR · CONTINGENT WORKFORCE · ${who}`} title="Contract management" subtitle="Contracts and work orders for contract, freelance, consultant, agency, intern, temporary and apprentice workers — approvals, e-signature, amendments and renewals, timesheets and milestones, the month-end contractor pay run into payslips and invoices, vendors and compliance." />
      <ContractsHub />
    </>
  );
}

function OffersPageWrap() {
  return (
    <>
      <PageHeader eyebrow="HIRE & ONBOARD · OFFER LETTERS" title="Offer letters" subtitle="Prepare offers from your company template by hand or by CSV upload, add your own fields and clauses, preview, print or download as Word, then issue and email the candidate." />
      <OffersPage />
    </>
  );
}

function PayslipsPageWrap() {
  const { user } = useStore();
  const who = user.role === "superadmin" ? "Super Admin · final approval" : user.modules?.includes("payroll") ? "Finance · approves runs and fields" : "HR · prepares and releases";
  return (
    <>
      <PageHeader eyebrow={`PAY & BENEFITS · ${who.toUpperCase()}`} title="Payslips" subtitle="Payslip fields from your company template, monthly payslip runs from payroll or a CSV upload, approval by Finance and Super Admin, then release to employees with an email." />
      <PayslipsAdminPage />
    </>
  );
}

import { tickets as ticketSeed } from "./data/peopleHubData.js";
import { theme } from "./theme.js";
import { useStore, ROLE_HOME } from "./store/AppStore.jsx";
import { navFor } from "./data/roleNav.js";
import { APP_CONFIG } from "./data/seed.js";
import { initials, isoDate } from "./lib/utils.js";

function load(key, fallback) {
  try {
    const value = localStorage.getItem(`peoplehub-${key}`);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(`peoplehub-${key}`, JSON.stringify(value));
  } catch {
    /* Browser storage may be disabled. */
  }
}

export default function PeopleHubApp() {
  const store = useStore();
  const { user, data, notifyToast, removeEmployee, reportsOf, session } = store;
  const navigate = useNavigate();
  const location = useLocation();
  const page = location.pathname.split("/")[1] || "";
  const code = user?.code || "anon";

  // PeopleHub's own browser-stored workspace data (attendance and documents per user; library and tickets shared)
  const [trainingVideos, setTrainingVideos] = useState(() => load("training-videos", []));
  const [supportTickets, setSupportTickets] = useState(() => load("tickets", ticketSeed));
  const [userDocuments, setUserDocuments] = useState(() => load(`${code}-user-documents`, []));
  const [attendanceRecords, setAttendanceRecords] = useState(() => load(`${code}-attendance-records`, []));
  const [dialog, setDialog] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [employeeForm, setEmployeeForm] = useState(false);
  const [employeeRecord, setEmployeeRecord] = useState(null);
  const [homeView, setHomeView] = useState(() => load(`${code}-home-view`, "glass"));
  useEffect(() => { save(`${code}-home-view`, homeView); }, [homeView, code]);

  useEffect(() => { save("training-videos", trainingVideos); }, [trainingVideos]);
  useEffect(() => { save("tickets", supportTickets); }, [supportTickets]);
  useEffect(() => { save(`${code}-user-documents`, userDocuments); }, [userDocuments, code]);
  useEffect(() => { save(`${code}-attendance-records`, attendanceRecords); }, [attendanceRecords, code]);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  // Keep PeopleHub's theme user (used by the original pages) in step with the signed-in account.
  if (user) {
    theme.workspaceName = APP_CONFIG.companyName;
    theme.companyName = APP_CONFIG.companyName;
    Object.assign(theme.currentUser, {
      name: user.full_name,
      shortName: user.full_name.split(" ")[0],
      role: user.designation || (user.role === "admin" ? "Administrator" : "Super Admin"),
      employeeId: user.employee_code || user.code,
      department: user.department || "Administration",
      email: user.email,
      initials: initials(user.full_name),
    });
  }

  const today = isoDate();
  const bgvOf = useBgvLookup();
  // Employees see only the people they work with (their manager, teammates under the same manager and their own
  // direct reports), and personal details (leave status, joining date) only for themselves and their direct reports.
  const empSelf = user?.role === "emp" ? data.employees.find((e) => e.employee_code === user.employee_code) : null;
  const inCountry = useCountryFilter();
  const people = useMemo(() => {
    // v10.6: contract / freelance workers see only higher management (their manager chain up to the top) and their own team.
    const chain = [];
    if (empSelf && isContingent(empSelf)) { let m = data.employees.find((e) => e.employee_code === empSelf.reporting_manager); for (let i = 0; m && i < 6; i += 1) { chain.push(m.employee_code); m = data.employees.find((e) => e.employee_code === m.reporting_manager); } }
    const mine = empSelf
      ? new Set([empSelf.employee_code, empSelf.reporting_manager, ...chain, ...data.employees.filter((e) => e.reporting_manager === empSelf.employee_code || (empSelf.reporting_manager && e.reporting_manager === empSelf.reporting_manager)).map((e) => e.employee_code)].filter(Boolean))
      : null;
    const detailFor = (e) => !empSelf || e.employee_code === empSelf.employee_code || e.reporting_manager === empSelf.employee_code;
    return data.employees
      .filter((e) => e.status !== "rejected" && (!mine || (mine.has(e.employee_code) && e.status === "active")) && (!!mine || inCountry(e)))
      .map((e) => ({
        id: e.employee_code,
        name: e.full_name,
        role: e.designation,
        department: e.department,
        email: e.email,
        photo: e.profile_photo || "",
        relation: empSelf ? (e.employee_code === empSelf.employee_code ? "You" : e.employee_code === empSelf.reporting_manager ? "Your manager" : chain.includes(e.employee_code) ? "Senior management" : e.reporting_manager === empSelf.employee_code ? "Reports to you" : "Teammate") : undefined,
        status: !detailFor(e) ? "Active" : data.requests.some((r) => r.type === "leave" && r.status === "Approved" && r.employee_code === e.employee_code && r.from_date <= today && r.to_date >= today) ? "On leave" : e.status === "active" ? "Active" : e.status === "pending_approval" ? "Pending approval" : e.status[0].toUpperCase() + e.status.slice(1),
        joined: detailFor(e) ? new Date(`${e.date_of_joining}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "",
        bgv: !empSelf && bgvOf(e.employee_code) ? bgvStatus(bgvOf(e.employee_code)) : null,
      }));
  }, [data.employees, data.requests, today, bgvOf, empSelf, inCountry]); // eslint-disable-line react-hooks/exhaustive-deps
  const departments = data.orgUnits.filter((o) => o.parent_unit).map((o) => o.name);

  if (!user) return null;
  const isManager = user.role === "emp" && reportsOf(user.employee_code).length > 0;
  // `alias`: extra routes served by the same menu entry (e.g. /it-support opens "My assets & IT support").
  const allowed = new Set(navFor(user.role, isManager, { user, data, origin: session?.origin }).flatMap((g) => g.items.filter((i) => !i.action).flatMap((i) => [i.id, ...(i.alias || [])])));
  if (!allowed.has(page)) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const canManagePeople = user.role === "superadmin" || (user.role === "admin" && user.permissions_scope.includes("people"));
  const LEGACY = { timeoff: "leave", pay: "finances", overview: "home" };
  const go = (id) => {
    const path = id.startsWith("/") ? id : `/${id}`;
    const seg = path.split(/[/?]/)[1];
    navigate(LEGACY[seg] ? path.replace(seg, LEGACY[seg]) : path);
  };

  function submitAction(type, values) {
    if (type === "delete-employee") {
      const r = removeEmployee(dialog.data.id);
      notifyToast(r.ok ? `${dialog.data.name} was removed from the directory.` : r.error, r.ok ? "success" : "error");
    } else if (type === "ticket") {
      setSupportTickets((current) => [{ id: `HR-${1025 + current.length}`, subject: values.subject, category: values.category, created: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }), status: "Open", by: user.code }, ...current]);
      notifyToast("Your HR support request was created.");
    }
    setDialog(null);
  }

  function pageAction(type, data2) {
    if (type === "leave") return go("/leave?new=1");
    if (type === "employee") {
      if (!canManagePeople) return notifyToast("Only HR can add employees.", "info");
      setEmployeeRecord(null);
      return setEmployeeForm(true);
    }
    if (type === "person" && canManagePeople) {
      const rec = data.employees.find((e) => e.employee_code === data2.id);
      if (rec) {
        setEmployeeRecord(rec);
        return setEmployeeForm(true);
      }
    }
    return setDialog({ type, data: data2 });
  }

  function toggleCheckIn() {
    const last = attendanceRecords[0];
    const type = last?.type === "Tap in" ? "Tap out" : "Tap in";
    setAttendanceRecords((current) => [{ id: `ATT-${Date.now()}`, type, timestamp: new Date().toISOString() }, ...current]);
    notifyToast(type === "Tap in" ? "You are now clocked in." : "You are now clocked out.");
  }
  const checkedIn = attendanceRecords[0]?.type === "Tap in";
  const clockInAt = attendanceRecords.find((r) => r.type === "Tap in")?.timestamp || null;
  const clockOutAt = checkedIn ? null : attendanceRecords.find((r) => r.type === "Tap out")?.timestamp || null;

  function uploadTrainingVideo(file, details) {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return notifyToast("Choose an image or video file to upload.", "error");
    const storedBytes = trainingVideos.reduce((total, v) => total + (v.size || 0), 0);
    if (storedBytes + file.size > 2 * 1024 * 1024) return notifyToast("Training media is limited to 2 MB in this browser demo.", "error");
    const reader = new FileReader();
    reader.onload = () => {
      setTrainingVideos((current) => [{ id: `TRAIN-${Date.now()}`, title: details.title, description: details.description, category: details.category, fileName: file.name, size: file.size, type: file.type, data: reader.result, uploaded: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) }, ...current]);
      notifyToast(`"${details.title}" was added to the learning library.`);
    };
    reader.readAsDataURL(file);
  }

  const shared = {
    "dropdown-lists": user.role === "emp" ? <Navigate to="/home" replace /> : <DropdownLists />, // v10.13
    people: <PeoplePage people={people} myTeamOnly={user.role === "emp"} departments={departments} query={searchQuery} onAction={pageAction} canManage={canManagePeople} showBgv={canSeeBgvColumn(data, user)} />,
    organization: <OrganizationPage people={people} myTeamOnly={user.role === "emp"} departments={departments} onAction={pageAction} canManage={canManagePeople} />,
    documents: (
      <DocumentsPage
        topSlot={user.role === "emp" ? <><MyFiles /><MyDocumentChecklist /></> : <><Box sx={{ mb: 2.5 }}><AutoLetters /></Box><EmployeeFilesAdmin />{canReviewDocs(user) && <EmployeeDocReview />}</>}
        key={code}
        user={user}
        canManageShared={user.role === "superadmin" || user.role === "admin"}
        notify={notifyToast}
        legacyDocuments={userDocuments}
        onLegacyImported={() => setUserDocuments([])}
      />
    ),
    learning: <LearningHub libraryProps={{ videos: trainingVideos, canUpload: user.role !== "emp", onUpload: uploadTrainingVideo, onDelete: (id) => (user.role === "emp" ? notifyToast("Only admins can remove library items.", "info") : setTrainingVideos((c) => c.filter((v) => v.id !== id))) }} />,
    support: <SupportPage tickets={user.role === "emp" ? supportTickets.filter((t) => !t.by || t.by === user.code) : supportTickets} onAction={(type) => setDialog({ type })} onItSupport={() => go("/it-support")} />,
    notifications: <InboxHub tab="notifications" />,
    inbox: <InboxHub tab="inbox" />,
    country: <CountryWorkspace />,
    chat: <ChatPage />,
    calendar: <CalendarPage />,
    meetings: <MeetingsPage kind="client" />,
    "meetings-internal": <MeetingsPage kind="internal" />,
    bgv: <BgvAdminPage />,
    recruitment: <RecruitmentHub />,
    "compliance-calendar": <ComplianceCalendarPage />,
    "it-support": <><ItSupportTatCard /><ItSupportPage /></>,
    "loan-access": <LoanAccessAdmin />,
    "ezy-support": <EzySupportChat />,
    "ent-directory": <EnterpriseDirectory />,
    "ent-approvals": <EnterpriseApprovals />,
    "ent-payroll": <EnterprisePayroll />,
    "ent-import": <EnterpriseImport />,
    "ent-database": <DatabaseHealth />,
    "it-helpdesk": <ItHelpdeskPage />,
    contracts: <ContractsPageWrap />,
    // v10 suite (role access is decided by the sidebar; actions are guarded in the store)
    "people-xp": <PeopleXP />,
    "doc-requests": <DocRequestsPage />,
    "bulk-upload": <BulkActions />,
    "statutory-portals": <StatutoryPortals />,
    "payroll-agent": <PayrollAgent tab="run" />,
    "variable-pay": <PayrollAgent tab="variable" />,
    payouts: <PayrollAgent tab="payouts" />,
    filings: <PayrollAgent tab="filings" />,
    "global-payroll": <PayrollAgent tab="global" />,
    "compliance-autopilot": <ComplianceAutopilot tab="health" />,
    "compliance-alerts": <ComplianceAutopilot tab="alerts" />,
    "rule-updates": <ComplianceAutopilot tab="rules" />,
    "audit-pack": <ComplianceAutopilot tab="audit" />,
    "privacy-center": <ComplianceAutopilot tab="privacy" />,
    exits: <Exits />,
    "leave-rules": <LeaveRules />,
    "global-hiring": <GlobalHiring />,
    relocation: <Relocation />,
    "spend-cards": <SpendCards />,
    integrations: <Integrations />,
    "expense-hub": <ExpenseHub />,
    companies: <CompaniesLocations />,
    insights: <Insights />,
    setup: <SetupImport />,
    security: <Security />,
    "expert-support": <ExpertSupport />,
    "payroll-entities": <PayrollEntities />,
    "ijp-admin": <IjpAdmin />,
    automation: <AutomationCentre />,
    activity: <ActivityCentre />,
    // v10.6
    toolkit: <HrToolkit />,
    tasks: <Tasks />,
    "my-tasks": <Tasks mine />,
    "emp-requests": <InboxHub tab="empreq" />,
    "statutory-checklist": <StatutoryChecklist />,
    "it-purchase": user.role === "admin" && adminKind(user) !== "it" ? <InboxHub tab="purchase" /> : <ItPurchaseApprovals />,
    billing: <Billing tab={/explore=1/.test(location.search) ? "explore" : "my"} />,
    coverage: <Billing tab="my" />,
    // v10.6: Employee monitoring is a tab of the live board (with Shift roster and, for Finance / Super Admin, Timesheets).
    "live-board": <LiveBoard />,
    shifts: <Shifts tab="shifts" />,
    timesheets: user.role === "admin" && adminKind(user) === "hr" ? <Navigate to="/live-board" replace /> : <Shifts tab="timesheets" />,
  };

  const byRole = {
    emp: {
      home: (
        <EmployeeGlassHome view={homeView} onView={setHomeView} classic={<>
        <CelebrationsCard glass={false} />
        <OverviewPage
          onNavigate={go}
          onAction={pageAction}
          checkedIn={checkedIn}
          onToggle={toggleCheckIn}
          employeeCount={people.length}
          pendingLeaves={data.requests.filter((r) => r.type === "leave" && r.employee_code === user.employee_code && r.status === "Pending").length}
          departmentCount={departments.length}
          attendanceRecords={attendanceRecords}
        /></>} />
      ),

      // v10.6: attendance and my activity on one screen
      attendance: <Stacked sections={[{ node: <MyAttendance /> }, { title: "My activity", hint: "work activity and privacy choices", node: <MyActivity /> }]} />,
      "my-activity": <Navigate to="/attendance" replace />,
      "doc-requests": <InboxHub tab="docreq" />,
      assets: <><ItSupportTatCard /><AssetsAndIt /></>,
      "my-forms": <MyForms />,
      "it-support": <Navigate to="/assets" replace />,
      "benefits-me": <MyBenefits />,
      "onboarding-me": <MyOnboarding />,
      "performance-me": <MyPerformance />,
      calls: (
        <>
          <PageHeader eyebrow="ME · CALLS" title="My calls" subtitle={`Your calls, talk time and follow-ups. Daily target ${data.settings.call_daily_target} calls.`} />
          <CallTracker employees={data.employees.filter((e) => e.employee_code === user.employee_code)} self />
        </>
      ),
      "team-live": <TeamModulePage id="team-live" />,
      "team-calls": <TeamModulePage id="team-calls" />,
      "team-reviews": <TeamReviews />,
      "team-bgv": <TeamBgvPage />,
      "bgv-me": <MyBgvPage />,
      // v10.7: Leave & holidays under Calendar & tasks
      leave: <Stacked sections={[{ node: <LeavePage /> }, { node: <HolidaysCard /> }]} />,
      holidays: <Navigate to="/leave" replace />,
      expenses: <ExpensesPage />,
      // v10.4: Pay & benefits → My payslips / Manage tax, salary & loan (older ?tab= links open the second one)
      finances: /[?&]tab=(tax|loans)/.test(location.search) ? <Navigate to={`/finances-manage${location.search}`} replace /> : <FinancesPage view="pay" />,
      "finances-manage": <FinancesPage view="manage" />,
      // v10.4: My profile sub-tabs
      // v10.6: "Core HR" → Personal details, with workforce & devices included
      profile: <ProfilePage section={["core", "workforce"]} />,
      "profile-workforce": <Navigate to="/profile" replace />,
      "profile-contacts": <ProfilePage section="contact" />,
      "profile-employment": <ProfilePage section="employment" />,
      "profile-contract": <ProfilePage section="engagement" />,
      "profile-pay": <ProfilePage section="pay" />,
      "profile-signins": <ProfilePage section="activity" />,
      ijp: <MyIjp />,
      "ijp-relocation": <MyIjpRelocation />,
      // v10.6: team summary + team calendar (names on each day, custom dates) + team activity
      team: <Stacked sections={[{ node: <MyTeamPage /> }, { node: <TeamCalendar /> }, data.settings.managers_see_team_activity && { title: "Team activity", hint: "category totals for people who chose to share", node: <TeamModulePage id="team-activity" bare /> }]} />,
      "team-activity": <Navigate to="/team" replace />,
      "my-contract": <MyContractPage />,
      "team-timesheets": <TeamTimesheetsPage />,
      // v10.5: My team → All approvals (reporting managers)
      "team-approvals": (
        <>
          <PageHeader title="Approvals" subtitle="Requests from your direct reports that are waiting for your decision." />
          <ApprovalsPage mode="manager" />
        </>
      ),
      "my-app": <MyApp />,
      "my-shifts": <MyShifts />,
      "my-card": <MyCard />,
      "my-privacy": <MyPrivacy />,
      "my-relocation": <MyRelocation />,
      "my-exit": <MyExit />,
    },
    admin: {
      admin: adminKind(user) === "it" ? <><CelebrationsCard glass={false} /><ItDashboard /></> : <><EnterpriseHeadcount /><OpsGlassHome view={homeView} onView={setHomeView} classic={<><CelebrationsCard glass={false} /><AdminDashboard /></>} /></>,
      payslips: <PayslipsPageWrap />,
      offers: <OffersPageWrap />,
      // v10.6: All approvals is merged into Inbox & approvals
      approvals: <InboxHub tab="inbox" />,
      monitoring: <MonitoringTab><MonitoringBody /></MonitoringTab>,
      reports: (user.modules || []).includes("payroll") ? <MergedTabs tabs={[{ id: "all", label: "Report centre", node: <AdminReports /> }, { id: "payroll", label: "Payroll reports", node: <PayrollReportsPage /> }]} /> : <AdminReports />,
      profile: <AdminProfile />,
      requests: <AllRequests />,
    },
    superadmin: {
      super: <><PlanCard /><EnterpriseHeadcount /><OpsGlassHome view={homeView} onView={setHomeView} classic={<><CelebrationsCard glass={false} /><SuperDashboard /></>} /></>,
      approvals: <InboxHub tab="inbox" />,
      geofences: <GeofencesDevices />,
      monitoring: <MonitoringTab><MonitoringBody /></MonitoringTab>,
      "monitoring-policy": <MonitoringPolicy />,
      territory: <Territory />,
      offers: <OffersPageWrap />,
      payslips: <PayslipsPageWrap />,
      compliance: <Compliance />,
      analytics: <HRAnalytics />,
      employees: <EmployeeMaster />,
      fields: <FieldReference />,
      users: <UsersAccess />,
      policies: <PoliciesPage />,
      requests: <AllRequests />,
      reports: <MergedTabs tabs={[{ id: "all", label: "Report centre", node: <SuperReports /> }, { id: "payroll", label: "Payroll reports", node: <PayrollReportsPage /> }]} />,
      audit: <AuditLog />,
      settings: <SystemSettings />,
    },
  };
  // Older links from notifications in the original workspace
  const content = byRole[user.role][page] || (page === "recruitment" ? shared.recruitment : null) || (user.role !== "emp" && MODULE_PAGES[page] ? <ModulePage id={page} /> : null) || shared[page] || null;
  const glassStage = ["home", "admin", "super"].includes(page) && homeView === "glass" && !(user.role === "admin" && adminKind(user) === "it");
  if (page === "timeoff") return <Navigate to="/leave" replace />;

  return (
    <>
      <LocationBeacon />
      <AutomationRunner />
      <ActivityMeter />
      <PortalShell
        page={page}
        stage={glassStage ? "glass" : undefined}
        onNavigate={go}
        onSearch={(q) => {
          setSearchQuery(q);
          go("/people");
        }}
      >
        {content}
      </PortalShell>
      <PortalDialog dialog={dialog} onClose={() => setDialog(null)} onSubmit={submitAction} departments={departments} onDeleteEmployee={canManagePeople ? (person) => setDialog({ type: "delete-employee", data: person }) : undefined} />
      <EmployeeFormDialog open={employeeForm} rec={employeeRecord} onClose={() => { setEmployeeForm(false); setEmployeeRecord(null); }} />
      <ToastHost />
      <AiLayer />
    </>
  );
}

// While an employee is clocked in and has agreed to share location, send a position every few minutes.
function LocationBeacon() {
  const { user, data, pingLocation } = useStore();
  const ref = useRef({ data, pingLocation });
  ref.current = { data, pingLocation };
  const isEmp = user?.role === "emp";
  useEffect(() => {
    if (!isEmp) return undefined;
    const tick = () => {
      const { data: d, pingLocation: ping } = ref.current;
      const c = d.consents[user.employee_code];
      const open = d.punches.filter((p) => p.employee_code === user.employee_code && p.ts.startsWith(isoDate())).sort((a, b) => a.ts.localeCompare(b.ts)).pop();
      if (!c?.location || d.settings.location_tracking === "off" || open?.type !== "in") return;
      getPosition({ timeout: 6000 }).then((pos) => { if (pos) ping(pos); }).catch(() => {});
    };
    tick();
    const minutes = Math.max(1, Number(data.settings.location_ping_min) || 5);
    const t = setInterval(tick, minutes * 60000);
    return () => clearInterval(t);
  }, [isEmp, user?.employee_code, data.settings.location_ping_min]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// Counts active vs idle minutes inside this portal only (no other apps, no content), for consenting employees.
function ActivityMeter() {
  const { user, recordMyActivity } = useStore();
  const ref = useRef({ recordMyActivity, lastInput: Date.now() });
  ref.current.recordMyActivity = recordMyActivity;
  const isEmp = user?.role === "emp";
  useEffect(() => {
    if (!isEmp) return undefined;
    const mark = () => { ref.current.lastInput = Date.now(); };
    ["pointerdown", "keydown", "scroll", "pointermove"].forEach((ev) => window.addEventListener(ev, mark, { passive: true }));
    const t = setInterval(() => {
      if (document.hidden) return;
      const idle = Date.now() - ref.current.lastInput > 5 * 60000;
      ref.current.recordMyActivity(idle ? 0 : 1, idle ? 1 : 0);
    }, 60000);
    return () => {
      clearInterval(t);
      ["pointerdown", "keydown", "scroll", "pointermove"].forEach((ev) => window.removeEventListener(ev, mark));
    };
  }, [isEmp]);
  return null;
}

// v10.6: monitoring content for the live-board tab (scoped like the old module page).
function MonitoringBody() {
  const emps = useScopedEmployeesV106();
  return MODULE_PAGES.monitoring[4](emps);
}
