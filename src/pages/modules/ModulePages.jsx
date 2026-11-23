// Route-level wrappers: one header + one shared view, scoped to the viewer
// (manager → direct reports, admin → their org units, Super Admin → everyone).
import React, { useState } from "react";
import { Box, Tab, Tabs } from "@mui/material";
import { useStore } from "../../store/AppStore.jsx";
import { useCountry } from "../../country/CountryContext.jsx";
import { COUNTRIES as COUNTRY_LIST } from "../../data/employeeFields.js";
import { PageHeader } from "../../components/kit/UI.jsx";
import { useScopedEmployees } from "../glass/OpsGlassHome.jsx";
import AttendanceAdminView from "../../components/workforce/AttendanceAdminView.jsx";
import LiveLocationView from "../../components/workforce/LiveLocationView.jsx";
import CallTracker from "../../components/workforce/CallTracker.jsx";
import MonitoringView from "../../components/workforce/MonitoringView.jsx";
import AssetsAdminView from "../../components/workforce/AssetsAdminView.jsx";
import { WorkforcePlanView, CoursesView } from "../../components/workforce/WorkforcePlanView.jsx";
import { PerformanceAdminView, TalentView, SuccessionView } from "../../components/talent/TalentAdmin.jsx";
import { RecruitmentView, OnboardingView } from "../../components/hire/HireViews.jsx";
import { BenefitsAdminView, WellnessAdminView } from "../../components/pay/PayViews.jsx";
import PayrollSuite from "../../components/pay/suite/PayrollSuite.jsx";
import { PayrollReports } from "../../components/pay/suite/ReportsForm16.jsx";

function Tabbed({ tabs }) {
  const [t, setT] = useState(tabs[0][0]);
  const cur = tabs.find((x) => x[0] === t) || tabs[0];
  return (
    <>
      <Box sx={{ mb: 2, borderBottom: "1px solid #e5eae4" }}>
        <Tabs value={cur[0]} onChange={(_, v) => setT(v)} variant="scrollable" allowScrollButtonsMobile>
          {tabs.map(([k, l]) => <Tab key={k} value={k} label={l} sx={{ fontSize: "0.7rem" }} />)}
        </Tabs>
      </Box>
      {cur[2]}
    </>
  );
}

// id → [module, eyebrow, title, subtitle, render(employees, ctx)]
export const MODULE_PAGES = {
  "attendance-admin": ["attendance", "TIME & WORKFORCE", "Time & attendance", "Today's register from biometric terminals, geofenced selfie punches and web punches. Late, missing and flagged punches first.", (emps) => <AttendanceAdminView employees={emps} />],
  "live-map": ["location", "TIME & WORKFORCE", "Geofencing & live location", "Where clocked-in, consenting staff are now, against each site's geofence.", (emps) => <LiveLocationView employees={emps} />],
  "calls-admin": ["calls", "TIME & WORKFORCE", "Team call tracker", "Calls, connect rate, talk time and follow-ups for staff with call tracking on.", (emps) => <CallTracker employees={emps} />],
  monitoring: ["monitoring", "TIME & WORKFORCE", "Employee monitoring", "Active and idle time by app category for people who chose to share it. No keystrokes, content or screenshots.", (emps) => <MonitoringView employees={emps} appDetail />],
  workforce: ["workforce", "TIME & WORKFORCE", "Workforce management", "Headcount and cost against plan, span of control and the shift roster.", (emps) => <WorkforcePlanView employees={emps} />],
  "assets-admin": ["assets", "CORE HR", "Assets", "Laptops, phones, SIMs, access cards and vehicles: who has what, its book value, and requests to fulfil.", () => <AssetsAdminView />],
  performance: ["performance", "TALENT", "Performance management", "Review cycle, goals, ratings and calibration. Weighted score = 50% goals + 30% competencies + 20% values.", (emps) => <PerformanceAdminView employees={emps} />],
  talent: ["performance", "TALENT", "Talent management", "Nine-box placement, flight risk and high-potential staff.", (emps) => <TalentView employees={emps} />],
  succession: ["performance", "TALENT", "Succession planning", "Critical roles, ready-now and ready-later successors and bench strength.", () => <SuccessionView />],
  "learning-admin": ["learning", "TALENT", "Learning & development", "Course outcomes and training hours.", (emps) => <CoursesView employees={emps} />],
  recruitment: ["recruitment", "HIRE & ONBOARD", "Recruitment", "Requisitions, the candidate pipeline and the hiring funnel.", () => <RecruitmentView />],
  onboarding: ["onboarding", "HIRE & ONBOARD", "Onboarding", "Joining checklists, due dates and buddies for new starters.", () => <OnboardingView />],
  payroll: ["payroll", "PAY & BENEFITS", "Payroll", "Analytics, compensation planning, monthly runs per country engine, payroll admin, component claims, loans, perks, reports and Form 16 / Form 130.", (emps) => <PayrollSuite employees={emps} />],
  "benefits-admin": ["benefits", "PAY & BENEFITS", "Benefits administration", "Health cover, life cover and NPS enrolment with the employer cost of each.", (emps) => (
    <Tabbed tabs={[["enrol", "Enrolment", <BenefitsAdminView employees={emps} />], ["wellness", "Employee wellness", <WellnessAdminView />]]} />
  )],
  wellness: ["wellness", "PAY & BENEFITS", "Employee wellness", "Anonymous monthly pulse by team and programme uptake.", () => <WellnessAdminView />],
};

export function ModulePage({ id }) {
  const { user } = useStore();
  const emps = useScopedEmployees();
  const def = MODULE_PAGES[id];
  if (!def) return null;
  const [, eyebrow, title, subtitle, render] = def;
  const { country, region } = useCountry();
  const where = country ? (COUNTRY_LIST.find((c) => c.code === country)?.name || country).toUpperCase() : region ? `REGION ${region}` : null;
  const scope = user.role === "superadmin" ? where || "ALL COMPANIES" : `SCOPE ${user.org_units.join(", ").toUpperCase()}${where ? ` · ${where}` : ""}`;
  return (
    <>
      <PageHeader eyebrow={user.role === "superadmin" && where ? `${eyebrow} · ${where}` : eyebrow} title={title} subtitle={subtitle} />
      {render(emps)}
    </>
  );
}

// Manager pages (employees with direct reports)
export function TeamModulePage({ id, bare }) {
  const { user, reportsOf, data } = useStore();
  const team = reportsOf(user.employee_code);
  const pages = {
    "team-live": ["Team live location", "Your direct reports who are clocked in and sharing their location.", <LiveLocationView employees={team} />],
    "team-calls": ["Team calls", "Calls logged by your direct reports.", <CallTracker employees={team.filter((e) => e.call_tracking === "yes")} />],
    "team-activity": ["Team activity", data.settings.managers_see_team_activity ? "Category totals only, for people who chose to share. App names are not shown to managers." : "Your company has switched team activity off for managers.", data.settings.managers_see_team_activity ? <MonitoringView employees={team} appDetail={false} /> : null],
  };
  const p = pages[id];
  if (!p) return null;
  if (bare) return p[2];
  return (
    <>
      <PageHeader eyebrow="MY TEAM" title={p[0]} subtitle={p[1]} />
      {p[2]}
    </>
  );
}

// v10.6: payroll reports (moved from Payroll → Reports) shown under Reports & AI automation.
export function PayrollReportsPage() {
  const emps = useScopedEmployees();
  return <PayrollReports employees={emps} />;
}
