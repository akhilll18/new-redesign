// v10.6 · All HR statutory compliances (India) — the 15 areas from the compliance guide, each with its tasks, a monthly
// tick-off per task, the owner and a link to the screen that does the work. Sits under Compliance (Finance) and
// Global & compliance (Super Admin).
import React, { useState } from "react";
import { Box, Card, Checkbox, Chip, LinearProgress, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { OpenInNewRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader } from "../../components/kit/UI.jsx";
import { TONES } from "../../theme/tones.js";

export const STATUTORY = [
  ["pf", "PF (Provident Fund)", "green", ["PF registration", "Monthly PF challan & ECR return", "UAN activation", "KYC update"], "/statutory-portals"],
  ["esi", "ESI (Employees' State Insurance)", "blue", ["Employee registration", "Monthly contribution", "IP details update"], "/payroll-agent"],
  ["pt", "Professional Tax (PT)", "purple", ["PT registration", "Monthly / annual return", "Tax deposit (applicable in some states)"], "/payroll-entities"],
  ["lwf", "Labour Welfare Fund (LWF)", "brown", ["Employee & employer contribution", "Return filing (applicable in some states)"], "/payroll-entities"],
  ["tds", "TDS (Tax Deducted at Source)", "orange", ["Salary TDS deduction", "Deposit with government", "Form 16 issue"], "/statutory-portals"],
  ["minwage", "Minimum Wages Compliance", "yellow", ["Government notified wages", "Regular revision follow-up"], "/compliance-autopilot"],
  ["wages", "Payment of Wages", "green", ["Salary on time", "Salary slip provided", "Maintain wage records"], "/payslips"],
  ["bonus", "Bonus Compliance", "pink", ["Eligibility as per Payment of Bonus Act", "Bonus payment", "Bonus register maintained"], "/payroll-agent"],
  ["gratuity", "Gratuity Compliance", "brown", ["Eligibility: 5 years of service", "Gratuity calculation", "Timely payment", "Gratuity register maintained"], "/exits"],
  ["maternity", "Maternity Benefit Compliance", "pink", ["Paid leave & benefits", "Medical bonus", "Creche facility (if applicable)"], "/leave-rules"],
  ["se", "Shops & Establishment Act", "blue", ["Registration", "Working hours compliance", "Leave, holidays & overtime compliance"], "/companies"],
  ["clra", "Contract Labour Compliance (CLRA)", "orange", ["Contractor licence", "Principal employer registration", "Wage records & registers"], "/contracts"],
  ["factory", "Factory Act Compliance", "gray", ["Factory licence", "Health, safety & welfare", "Working hours & leave", "Annual return"], "/compliance-calendar"],
  ["posh", "POSH Compliance", "red", ["Internal Committee (IC)", "POSH policy", "Annual report", "Employee awareness & training"], "/compliance-autopilot"],
  ["registers", "Maintenance of Statutory Registers & Records", "black", ["Attendance register", "Wage register", "Leave register", "Overtime register", "Muster roll", "Form 11 register", "Accident register", "Inspection book", "All other required records"], "/reports"],
];

export default function StatutoryChecklist() {
  const { data, suiteDo, notifyToast } = useStore();
  const navigate = useNavigate();
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [period, setPeriod] = useState(months[0]);
  const done = data.suite?.statutory106?.[period] || {};
  const total = STATUTORY.reduce((s, x) => s + x[3].length, 0);
  const ticked = STATUTORY.reduce((s, [id, , , items]) => s + items.filter((_, i) => done[`${id}.${i}`]).length, 0);
  const toggle = (k) => {
    const r = suiteDo("compliance", (s, { now: at, code }) => { s.statutory106 = s.statutory106 || {}; const p = (s.statutory106[period] = s.statutory106[period] || {}); if (p[k]) delete p[k]; else p[k] = { by: code, at }; }, { action: "STATUTORY_TICK", details: `${period} · ${k}` });
    if (!r.ok) notifyToast(r.error, "error");
  };
  return (
    <>
      <PageHeader title="All HR statutory compliances" subtitle="Complete guide for HR and Finance: 15 compliance areas and every task under them. Tick each task when done for the month; the link opens the screen that does the work." />
      <Card sx={{ p: 2, mb: 2, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", bgcolor: "background.paper" }}>
        <TextField select size="small" label="Month" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ minWidth: 160 }}>{months.map((m) => <MenuItem key={m} value={m}>{new Date(`${m}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</MenuItem>)}</TextField>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{ticked} of {total} tasks done</Typography><Typography sx={{ fontSize: "0.72rem", color: "#66767E" }}>{Math.round((ticked / total) * 100)}%</Typography></Stack>
          <LinearProgress variant="determinate" value={(ticked / total) * 100} sx={{ height: 8, borderRadius: 4, mt: 0.5, background: "#e3e9ec", "& .MuiLinearProgress-bar": { background: "#1F9D63" } }} />
        </Box>
        <Chip label="Stay compliant, stay safe — timely compliance = happy employees + zero penalty" sx={{ fontWeight: 700, bgcolor: "#263238", color: "#fff" }} />
      </Card>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0,1fr))", xl: "repeat(3, minmax(0,1fr))" }, gap: 1.6 }}>
        {STATUTORY.map(([id, name, tone, items, route], idx) => {
          const t = TONES[tone];
          const n = items.filter((_, i) => done[`${id}.${i}`]).length;
          return (
            <Card key={id} sx={{ p: 0, overflow: "hidden", borderLeft: `5px solid ${t.main}` }}>
              <Stack direction="row" spacing={1} sx={{ px: 1.6, py: 1.1, background: t.light, alignItems: "center" }}>
                <Box sx={{ width: 26, height: 26, borderRadius: 1.5, background: t.main, color: "#fff", display: "grid", placeItems: "center", fontSize: "0.68rem", fontWeight: 800 }}>{String(idx + 1).padStart(2, "0")}</Box>
                <Typography sx={{ fontWeight: 800, fontSize: "0.76rem", flex: 1, color: "#17404D" }}>{name}</Typography>
                <Chip size="small" label={`${n}/${items.length}`} sx={{ height: 19, fontSize: "0.6rem", fontWeight: 800, bgcolor: n === items.length ? "#1F9D63" : "#fff", color: n === items.length ? "#fff" : t.main }} />
                <Chip size="small" icon={<OpenInNewRounded sx={{ fontSize: "13px !important" }} />} label="Open" onClick={() => navigate(route)} sx={{ height: 19, fontSize: "0.58rem" }} />
              </Stack>
              <Box sx={{ px: 0.6, py: 0.4 }}>
                {items.map((it, i) => (
                  <Stack key={it} direction="row" sx={{ alignItems: "center" }}>
                    <Checkbox size="small" checked={!!done[`${id}.${i}`]} onChange={() => toggle(`${id}.${i}`)} sx={{ color: t.main, "&.Mui-checked": { color: t.main } }} />
                    <Typography sx={{ fontSize: "0.68rem", textDecoration: done[`${id}.${i}`] ? "line-through" : "none", color: done[`${id}.${i}`] ? "#8a979c" : "inherit" }}>{it}</Typography>
                  </Stack>
                ))}
              </Box>
            </Card>
          );
        })}
      </Box>
    </>
  );
}
