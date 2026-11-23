// Payslip document: rendered with the assigned payslip design (classic layout = company template ONASTech_Payslip_Aug2026.docx).
import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { useStore } from "../../store/AppStore.jsx";
import DocFrame from "./DocFrame.jsx";
import { renderPayslipHtml, designFor } from "../../data/payslipDesign.js";
import { SECTIONS, payslipTotals, amountInWords, periodLabel, PAYSLIP_EMPLOYEE_FIELDS, PAYSLIP_DAY_FIELDS } from "../../data/payslipFields.js";
import { fmtDate } from "../../lib/utils.js";

const INK = "#163A44";
const LINE = "#C9D3D6";
const money = (n) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mask = (acc) => (acc ? `${"•".repeat(Math.max(0, String(acc).length - 4))}${String(acc).slice(-4)}` : "—");

// Print just the payslip: the rest of the page is hidden by this stylesheet while printing.
export const PRINT_CSS = `@media print { body * { visibility: hidden !important; } .payslip-print, .payslip-print * { visibility: visible !important; } .payslip-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; } @page { size: A4; margin: 12mm; } }`;

function Cell({ label, value }) {
  return (
    <Box sx={{ p: 1, borderRight: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.56rem", fontWeight: 800, color: "#5B6F75", letterSpacing: "0.4px" }}>{label.toUpperCase()}</Typography>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: INK, mt: 0.3, wordBreak: "break-word" }}>{value || "—"}</Typography>
    </Box>
  );
}

function Lines({ title, items, total, totalLabel }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: "0.62rem", fontWeight: 800, color: INK, pb: 0.5, borderBottom: `2px solid ${INK}`, letterSpacing: "0.4px" }}>{title.toUpperCase()}</Typography>
      {items.map((k) => (
        <Box key={k.code} sx={{ display: "flex", justifyContent: "space-between", py: 0.55, borderBottom: `1px dashed ${LINE}` }}>
          <Typography sx={{ fontSize: "0.68rem", color: "#33464C" }}>{k.label}</Typography>
          <Typography sx={{ fontSize: "0.68rem", fontVariantNumeric: "tabular-nums", color: INK }}>{money(k.value)}</Typography>
        </Box>
      ))}
      {totalLabel && (
        <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.7 }}>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: INK }}>{totalLabel}</Typography>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: INK }}>{money(total)}</Typography>
        </Box>
      )}
    </Box>
  );
}

// v8.7: payslips render through the organisation's payslip design (data/payslipDesign.js): built-in layouts styled with the
// company's colours, fonts and logo, or the company's own uploaded format. The assigned design is chosen per worker type / country.
export default function PayslipDocument({ slip, batch, company, audience = "employee", maskAccount, design, ytd, frameRef }) {
  const { data } = useStore();
  const liveEmp = data.employees.find((e) => e.employee_code === slip.employee_code);
  const d = design || designFor(data, liveEmp || slip.emp);
  const html = useMemo(() => renderPayslipHtml({ slip, batch, company, design: maskAccount === undefined ? d : { ...d, maskAccount }, audience, liveEmp, ytd }), [slip, batch, company, d, audience, liveEmp, ytd, maskAccount]);
  return <DocFrame ref={frameRef} html={html} title={`Payslip ${batch.period} ${slip.employee_code}`} />;
}

// A standalone HTML payslip (download, or the attachment the server emails), in the assigned design.
export function payslipStandaloneHtml(slip, batch, company, data, ytd) {
  const liveEmp = data?.employees?.find((e) => e.employee_code === slip.employee_code);
  return renderPayslipHtml({ slip, batch, company, design: data ? designFor(data, liveEmp || slip.emp) : undefined, audience: "employee", liveEmp, ytd });
}

/** Year-to-date totals (Indian financial year, April–March) for the employee, up to and including this payslip's month. */
export function payslipYtd(data, employeeCode, period) {
  const [y, m] = period.split("-").map(Number);
  const fyStart = m >= 4 ? `${y}-04` : `${y - 1}-04`;
  const rows = (data.payslipBatches || []).filter((b) => b.status === "Released" && b.period >= fyStart && b.period <= period).flatMap((b) => b.slips.filter((s) => s.employee_code === employeeCode).map((s) => ({ s, b })));
  const out = { gross: 0, deductions: 0, tax: 0, payable: 0, lines: {} };
  rows.forEach(({ s, b }) => {
    const t = payslipTotals(s.values, b.components);
    out.gross += t.gross; out.deductions += t.deductions; out.tax += t.C; out.payable += t.payable;
    Object.entries(s.values).forEach(([k, v]) => { if (typeof v === "number") out.lines[k] = (out.lines[k] || 0) + v; });
  });
  return out;
}
