// Leave, expense, advance and loan totals by department, with CSV export.
import React from "react";
import { Button, Stack, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { DownloadRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, TableWrap } from "./UI.jsx";
import { expenseTotal } from "../../lib/requests.js";
import { downloadCsv, fmtNum } from "../../lib/utils.js";

export default function RequestsReport({ employees }) {
  const { data } = useStore();
  const codes = new Set(employees.map((e) => e.employee_code));
  const reqs = data.requests.filter((r) => codes.has(r.employee_code));
  const dept = (c) => employees.find((e) => e.employee_code === c)?.department;
  const depts = [...new Set(employees.map((e) => e.department))];
  const amt = (r) => r.approved_amount ?? (r.type === "expense" ? expenseTotal(r.items) : r.request_amount ?? r.amount ?? 0);
  const rows = depts.map((d) => {
    const mine = reqs.filter((r) => dept(r.employee_code) === d);
    return {
      d,
      leaveDays: mine.filter((r) => r.type === "leave" && r.status === "Approved").reduce((s, r) => s + r.days, 0),
      leavePending: mine.filter((r) => r.type === "leave" && r.status === "Pending").length,
      expClaimed: mine.filter((r) => r.type === "expense" && r.status !== "Cancelled").reduce((s, r) => s + expenseTotal(r.items), 0),
      expPaid: mine.filter((r) => r.type === "expense" && r.status === "Paid").reduce((s, r) => s + amt(r), 0),
      adv: mine.filter((r) => r.type === "advance" && r.status === "Disbursed").reduce((s, r) => s + amt(r), 0),
      loans: mine.filter((r) => r.type === "loan" && ["Approved", "Disbursed"].includes(r.status)).reduce((s, r) => s + amt(r), 0),
      rejected: mine.filter((r) => r.status === "Rejected").length,
    };
  });
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  return (
    <Stack spacing={2.5}>
      <Grid min={170}>
        <StatCard label="Leave days approved" value={fmtNum(sum("leaveDays"))} hint={`${sum("leavePending")} request(s) pending`} />
        <StatCard label="Expenses claimed" value={`₹${fmtNum(sum("expClaimed"))}`} tone="warn" hint={`₹${fmtNum(sum("expPaid"))} paid`} />
        <StatCard label="Advances outstanding" value={`₹${fmtNum(sum("adv"))}`} tone="info" />
        <StatCard label="Salary loans" value={`₹${fmtNum(sum("loans"))}`} tone="neutral" />
      </Grid>
      <SectionCard title="By department" action={<Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv("requests-by-department.csv", ["Department", "Leave days approved", "Leave pending", "Expenses claimed", "Expenses paid", "Advances disbursed", "Loans", "Rejected"], rows.map((r) => [r.d, r.leaveDays, r.leavePending, r.expClaimed, r.expPaid, r.adv, r.loans, r.rejected]))}>CSV</Button>} noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead><TableRow><TableCell>Department</TableCell><TableCell align="right">Leave days</TableCell><TableCell align="right">Leave pending</TableCell><TableCell align="right">Expenses claimed</TableCell><TableCell align="right">Paid</TableCell><TableCell align="right">Advances</TableCell><TableCell align="right">Loans</TableCell><TableCell align="right">Rejected</TableCell></TableRow></TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.d}><TableCell sx={{ fontWeight: 700 }}>{r.d}</TableCell><TableCell align="right">{r.leaveDays}</TableCell><TableCell align="right">{r.leavePending}</TableCell><TableCell align="right">₹{fmtNum(r.expClaimed)}</TableCell><TableCell align="right">₹{fmtNum(r.expPaid)}</TableCell><TableCell align="right">₹{fmtNum(r.adv)}</TableCell><TableCell align="right">₹{fmtNum(r.loans)}</TableCell><TableCell align="right">{r.rejected}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
    </Stack>
  );
}
