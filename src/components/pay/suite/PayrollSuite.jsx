// Payroll workspace laid out like Keka: Payroll analytics · Run payroll · Payroll admin · Component claims ·
// Loans · Perks · Reports · Form 16 / 130. Run payroll is the existing country-engine view.
import React from "react";
import { Box, Tab, Tabs } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { PayrollView } from "../PayViews.jsx";
import { AnalyticsHome, CompensationPlanning, BudgetEstimation, CompareCost, EmployeeCompetitiveness, GeoDifferentials } from "./AnalyticsTabs.jsx";
import { PayrollAdmin, ComponentClaims, LoansView, PerksView } from "./OpsTabs.jsx";
import { PayrollReports, Form16View } from "./ReportsForm16.jsx";
import { ContractPayRuns } from "../../contracts/ContractViews.jsx";

const TOP = [
  ["analytics", "Payroll analytics"],
  ["run", "Run payroll"],
  ["contractors", "Contractor pay"],
  ["admin", "Payroll admin"],
  ["claims", "Component claims"],
  ["loans", "Loans"],
  ["perks", "Perks"],
  // v10.6: payroll reports moved to Reports & AI automation → Reports → Payroll reports.
  ["form16", "Form 16 / 130"],
];
const SUB = [
  ["overview", "Analytics", AnalyticsHome],
  ["planning", "Compensation planning", CompensationPlanning],
  ["budget", "Budget estimation", BudgetEstimation],
  ["compare", "Compare compensation cost", CompareCost],
  ["competitiveness", "Employee competitiveness", EmployeeCompetitiveness],
  ["geo", "Geographical differentials", GeoDifferentials],
];

const tabSx = { minHeight: 40, "& .MuiTab-root": { minHeight: 40, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" } };
const subSx = { minHeight: 36, "& .MuiTab-root": { minHeight: 36, fontSize: "0.72rem", textTransform: "none" } };

export default function PayrollSuite({ employees }) {
  const [sp, setSp] = useSearchParams();
  const top = TOP.some((t) => t[0] === sp.get("tab")) ? sp.get("tab") : "analytics";
  const sub = SUB.some((t) => t[0] === sp.get("view")) ? sp.get("view") : "overview";
  const go = (tab, view) => { const n = new URLSearchParams(sp); n.set("tab", tab); if (view) n.set("view", view); else n.delete("view"); setSp(n, { replace: true }); };
  const Sub = SUB.find((s) => s[0] === sub)[2];
  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: top === "analytics" ? 0 : 2.5 }}>
        <Tabs value={top} onChange={(_, v) => go(v)} variant="scrollable" allowScrollButtonsMobile sx={tabSx}>
          {TOP.map(([k, l]) => <Tab key={k} value={k} label={l} />)}
        </Tabs>
      </Box>
      {top === "analytics" && (
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2.5 }}>
          <Tabs value={sub} onChange={(_, v) => go("analytics", v)} variant="scrollable" allowScrollButtonsMobile sx={subSx}>
            {SUB.map(([k, l]) => <Tab key={k} value={k} label={l} />)}
          </Tabs>
        </Box>
      )}
      {top === "analytics" && <Sub employees={employees} />}
      {top === "run" && <PayrollView employees={employees} />}
      {top === "contractors" && <ContractPayRuns />}
      {top === "admin" && <PayrollAdmin />}
      {top === "claims" && <ComponentClaims employees={employees} />}
      {top === "loans" && <LoansView employees={employees} />}
      {top === "perks" && <PerksView employees={employees} />}
      {top === "reports" && <PayrollReports employees={employees} />}
      {top === "form16" && <Form16View employees={employees} />}
    </>
  );
}
