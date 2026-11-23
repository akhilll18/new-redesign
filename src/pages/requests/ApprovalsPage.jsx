// One approvals screen for managers (their team), admins (their modules) and the Super Admin (everything).
// Covers leave, expense claims, advances, salary loans, attendance corrections and asset requests.
import React, { useMemo, useState } from "react";
import { useCountryFilter } from "../../country/CountryContext.jsx";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Checkbox, Chip, FormControl, InputAdornment, InputLabel, MenuItem, Select, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { SearchRounded, DoneAllRounded, ClearAllRounded, DownloadRounded, FactCheckRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, PersonCell, Mono, EmptyState, TableWrap, ConfirmDialog, Tag, StatusChip, FlagIcons } from "../../components/kit/UI.jsx";
import { RequestDrawer, RequestStatus } from "../../components/kit/Requests.jsx";
import TeamAccounts from "../admin/TeamAccounts.jsx";
import { REQUEST_TYPES, requestSummary } from "../../lib/requests.js";
import { fmtNum, timeAgo, downloadCsv, DAY } from "../../lib/utils.js";
import { OPEN_STATUSES } from "../../lib/validation.js";

const TYPE_TONE = { leave: "info", expense: "warn", advance: "accent", loan: "neutral", regularize: "info", asset: "neutral", screenoff: "good", asset_purchase: "accent", itsupport: "info" };

export default function ApprovalsPage({ mode }) {
  const store = useStore();
  const { data, user, empBy, orgBy, ruleBy, leaveTypeBy, scopeUnits, pendingForManager, pendingForAdmin, bulkDecideRequests, bulkDecide, managerDecidePoints, notifyToast } = store;
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || "waiting");
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  // v10.6: the history tab is "Approved / all" with a status drop-down (All by default).
  const [status, setStatus] = useState("all");
  const [sel, setSel] = useState([]);
  const [bulk, setBulk] = useState(null);
  const [bulkNote, setBulkNote] = useState("");
  const openReq = params.get("req");
  const openSub = params.get("sub");
  const sla = data.settings.approval_sla_days;

  const toRow = (kind, x) => {
    if (kind === "points") return { kind, id: x.submission_id, type: "points", employee_code: x.employee_code, title: ruleBy[x.rule_id]?.sub_category, detail: x.description, amount: `${x.approved_points ?? x.points_requested} pts`, submitted: x.submitted_at, raw: x };
    const s = requestSummary(x, { leaveTypes: data.leaveTypes, fmt: fmtNum });
    return { kind, id: x.request_id, type: x.type, employee_code: x.employee_code, title: s.title, detail: s.detail, amount: s.amount, submitted: x.created_at, raw: x };
  };

  const { waiting, payouts, history, accounts } = useMemo(() => {
    if (mode === "manager") {
      const p = pendingForManager(user.employee_code);
      const mineReq = data.requests.filter((r) => r.steps[0]?.approver === user.employee_code);
      const minePts = [];
      return { waiting: [...p.requests.map((r) => toRow("request", r)), ...p.points.map((s) => toRow("points", s))], payouts: [], history: [...mineReq.map((r) => toRow("request", r)), ...minePts.map((s) => toRow("points", s))], accounts: [] };
    }
    if (mode === "admin") {
      const p = pendingForAdmin(user);
      const scope = scopeUnits(user);
      const inScope = (c) => scope.has(empBy[c]?.department);
      const reqs = data.requests.filter((r) => (user.modules.includes(REQUEST_TYPES[r.type].module) || (r.steps || []).some((st) => st.level === "admin" && st.module && user.modules.includes(st.module))) && inScope(r.employee_code));
      const pts = [];
      return { waiting: [...p.requests.map((r) => toRow("request", r)), ...p.points.map((s) => toRow("points", s))], payouts: p.payouts.map((r) => toRow("request", r)), history: [...reqs.map((r) => toRow("request", r)), ...pts.map((s) => toRow("points", s))], accounts: p.accounts };
    }
    const reqs = data.requests;
    const pts = [];
    // v10.3: HR oversight — every request across all modules, read-only (decisions stay with each module's approver).
    if (mode === "oversight") return { waiting: reqs.filter((r) => r.status === "Pending").map((r) => toRow("request", r)), payouts: [], history: reqs.map((r) => toRow("request", r)), accounts: [] };
    const waitingSuper = [...reqs.filter((r) => r.status === "Pending" && !r.steps.some((st) => st.status === "pending" && st.approver)).map((r) => toRow("request", r)), ...pts.filter((s) => s.status === "Escalated" || (OPEN_STATUSES.includes(s.status) && !s.assigned_admin && s.stage === "admin")).map((s) => toRow("points", s))];
    return { waiting: waitingSuper, payouts: [], history: [...reqs.map((r) => toRow("request", r)), ...pts.map((s) => toRow("points", s))], accounts: [] };
  }, [data, mode, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const TABS = [
    ["waiting", mode === "super" ? "Needs you" : mode === "oversight" ? "Open everywhere" : "Waiting for me", waiting],
    ...(mode === "admin" && user.modules.some((m) => ["expense", "advance", "loan", "assets"].includes(m)) ? [["payouts", "To pay / assign", payouts]] : []),
    ...(mode === "admin" && user.modules.includes("accounts") ? [["accounts", "New accounts", accounts]] : []),
    ["all", mode === "manager" ? "Team history" : "Approved / all", history],
  ];
  const current = TABS.find((t) => t[0] === tab) || TABS[0];
  const inCountry = useCountryFilter();
  const rows = useMemo(() => {
    if (current[0] === "accounts") return [];
    const qq = q.trim().toLowerCase();
    return current[2]
      .filter((r) => type === "all" || r.type === type)
      .filter((r) => !dept || empBy[r.employee_code]?.department === dept)
      .filter((r) => current[0] !== "all" || status === "all" || String(r.raw?.status || "").toLowerCase().startsWith(status))
      .filter((r) => !empBy[r.employee_code] || inCountry(empBy[r.employee_code]))
      .filter((r) => !qq || [r.id, r.title, r.detail, empBy[r.employee_code]?.full_name, r.employee_code].join(" ").toLowerCase().includes(qq))
      .sort((a, b) => new Date(b.submitted) - new Date(a.submitted));
  }, [current, type, dept, q, empBy, inCountry, status]);
  const typeCounts = Object.keys(TYPE_TONE).filter((t) => REQUEST_TYPES[t]).map((t) => [t, current[2].filter?.((r) => r.type === t).length || 0]);
  const selectable = tab === "waiting" ? rows.filter((r) => !["super", "oversight"].includes(mode) && !(r.kind === "points" && r.raw.status === "Escalated")) : [];
  const allSel = selectable.length > 0 && selectable.every((r) => sel.includes(r.id));

  function runBulk() {
    const reqIds = sel.filter((id) => rows.find((r) => r.id === id)?.kind === "request");
    const subIds = sel.filter((id) => rows.find((r) => r.id === id)?.kind === "points");
    if (bulk === "reject" && !bulkNote.trim()) return notifyToast("Give a reason for the rejection.", "error");
    let done = 0;
    let skipped = 0;
    if (reqIds.length) {
      const r = bulkDecideRequests(reqIds, bulk === "approve", bulkNote);
      done += r.done;
      skipped += r.skipped.length;
    }
    if (subIds.length) {
      if (mode === "manager") {
        subIds.forEach((id) => {
          const r = managerDecidePoints(id, { approve: bulk === "approve", note: bulkNote });
          if (r.ok) done += 1;
          else skipped += 1;
        });
      } else {
        const r = bulkDecide(subIds, bulk === "approve" ? "Approve" : "Reject", bulkNote);
        done += r.done;
        skipped += r.skipped.length;
      }
    }
    notifyToast(`${done} ${bulk === "approve" ? "approved" : "rejected"}${skipped ? `; ${skipped} skipped (flagged items need individual review)` : ""}.`, skipped ? "warning" : "success");
    setSel([]);
    setBulk(null);
    setBulkNote("");
  }

  const open = (r) => setParams(r.kind === "points" ? { sub: r.id, tab } : { req: r.id, tab });
  const close = () => setParams({ tab });
  const scopeDepts = mode === "admin" ? [...scopeUnits(user)] : data.orgUnits.map((o) => o.org_unit_id);

  return (
    <>
      <SectionCard noPad>
        <Box sx={{ px: 1.5, pt: 1, borderBottom: "1px solid #edf0ec" }}>
          <Tabs value={current[0]} onChange={(_, v) => (setTab(v), setSel([]))} variant="scrollable" allowScrollButtonsMobile>
            {TABS.map(([k, label, list]) => (
              <Tab key={k} value={k} label={`${label} (${list.length})`} sx={{ minHeight: 44, fontSize: "0.7rem" }} />
            ))}
          </Tabs>
        </Box>

        {current[0] === "accounts" ? (
          <TeamAccounts embedded />
        ) : (
          <>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ p: 1.5, alignItems: { md: "center" } }}>
              <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap", flex: 1 }}>
                <Chip size="small" label={`All (${current[2].length})`} color={type === "all" ? "primary" : "default"} onClick={() => setType("all")} />
                {typeCounts.map(([t, n]) => (
                  <Chip key={t} size="small" label={`${REQUEST_TYPES[t].label} (${n})`} color={type === t ? "primary" : "default"} variant={type === t ? "filled" : "outlined"} onClick={() => setType(t)} />
                ))}
              </Stack>
              <TextField placeholder="Search ID, employee, reason" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: { md: 260 } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
              {current[0] === "all" && (
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Status</InputLabel>
                  <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="approved">Approved</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="paid">Paid</MenuItem>
                    <MenuItem value="cancel">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              )}
              {mode !== "manager" && (
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Department</InputLabel>
                  <Select label="Department" value={dept} onChange={(e) => setDept(e.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    {scopeDepts.map((d) => (
                      <MenuItem key={d} value={d}>{orgBy[d]?.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <Button
                variant="outlined"
                startIcon={<DownloadRounded />}
                disabled={!rows.length}
                onClick={() => downloadCsv(`approvals-${mode}-${current[0]}.csv`, ["ID", "Type", "Employee code", "Employee", "Department", "Summary", "Detail", "Amount", "Submitted", "Status"], rows.map((r) => [r.id, REQUEST_TYPES[r.type].label, r.employee_code, empBy[r.employee_code]?.full_name, empBy[r.employee_code]?.department, r.title, r.detail, r.amount, r.submitted, r.raw.status]))}
              >
                CSV
              </Button>
            </Stack>

            {sel.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mx: 1.5, mb: 1.5, p: 1, pl: 2, borderRadius: 1, background: "#ebf3ec", alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                <Typography sx={{ flex: 1, fontSize: "0.7rem", fontWeight: 700 }}>{sel.length} selected</Typography>
                <Button size="small" variant="contained" startIcon={<DoneAllRounded />} onClick={() => setBulk("approve")}>Approve</Button>
                <Button size="small" variant="contained" color="error" startIcon={<ClearAllRounded />} onClick={() => setBulk("reject")}>Reject</Button>
                <Button size="small" color="inherit" onClick={() => setSel([])}>Clear</Button>
              </Stack>
            )}

            {rows.length === 0 ? (
              <EmptyState icon={<FactCheckRounded />} title={tab === "waiting" ? "Nothing waiting for you" : "Nothing here"} text={tab === "waiting" ? "New requests appear here as soon as they reach your step." : "Try another filter."} />
            ) : (
              <TableWrap>
                <Table size="small" sx={{ minWidth: 960 }}>
                  <TableHead>
                    <TableRow>
                      {tab === "waiting" && !["super", "oversight"].includes(mode) && (
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={allSel} indeterminate={sel.length > 0 && !allSel} onChange={() => setSel(allSel ? [] : selectable.map((r) => r.id))} slotProps={{ input: { "aria-label": "Select all" } }} />
                        </TableCell>
                      )}
                      <TableCell>Request</TableCell>
                      <TableCell>Employee</TableCell>
                      <TableCell>Summary</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Waiting</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => {
                      const e = empBy[r.employee_code];
                      const age = (Date.now() - new Date(r.submitted)) / DAY;
                      const late = tab === "waiting" && age > sla;
                      return (
                        <TableRow key={r.id} hover selected={sel.includes(r.id)} sx={{ cursor: "pointer" }} onClick={() => open(r)}>
                          {tab === "waiting" && !["super", "oversight"].includes(mode) && (
                            <TableCell padding="checkbox" onClick={(ev) => ev.stopPropagation()}>
                              <Checkbox size="small" disabled={!selectable.includes(r)} checked={sel.includes(r.id)} onChange={() => setSel((x) => (x.includes(r.id) ? x.filter((i) => i !== r.id) : [...x, r.id]))} slotProps={{ input: { "aria-label": `Select ${r.id}` } }} />
                            </TableCell>
                          )}
                          <TableCell>
                            <Stack spacing={0.4}>
                              <Tag tone={TYPE_TONE[r.type]} sx={{ alignSelf: "flex-start" }}>{REQUEST_TYPES[r.type].label}</Tag>
                              <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
                                <Mono>{r.id}</Mono>
                                {r.kind === "points" && <FlagIcons s={r.raw} />}
                              </Stack>
                            </Stack>
                          </TableCell>
                          <TableCell><PersonCell name={e?.full_name} sub={`${r.employee_code} · ${e?.department}`} /></TableCell>
                          <TableCell sx={{ maxWidth: 300 }}>
                            <Typography noWrap sx={{ fontSize: "0.7rem", fontWeight: 600 }}>{r.title}</Typography>
                            <Typography noWrap sx={{ fontSize: "0.6rem", color: "#78827b" }}>{r.type === "leave" ? `${leaveTypeBy[r.raw.leave_type]?.name} · ${r.detail}` : r.detail}</Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>{r.amount}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{late ? <Tag tone="bad">{Math.floor(age)} d · over SLA</Tag> : <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{timeAgo(r.submitted)}</Typography>}</TableCell>
                          <TableCell>{r.kind === "points" ? <StatusChip status={r.raw.status} /> : <RequestStatus r={r.raw} />}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </>
        )}
      </SectionCard>

      <RequestDrawer id={openReq} onClose={close} />

      <ConfirmDialog open={!!bulk} title={`${bulk === "approve" ? "Approve" : "Reject"} ${sel.length} item(s)?`} text={bulk === "approve" ? (mode === "manager" ? "Each item moves to the admin for the final decision (or is approved, where the workflow is manager-only)." : "Each item is approved for the amount requested.") : "Every selected item gets the same reason. Employees are notified."} confirmLabel={bulk === "approve" ? "Approve" : "Reject"} tone={bulk === "approve" ? "primary" : "error"} onClose={() => setBulk(null)} onConfirm={runBulk}>
        <TextField label={bulk === "reject" ? "Reason (required)" : "Note (optional)"} value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} multiline minRows={2} />
        {bulk === "approve" && mode === "admin" && sel.some((id) => rows.find((r) => r.id === id)?.type === "expense") && (
          <Alert severity="info" sx={{ mt: 1.5 }}>Expense claims are approved for the full amount claimed. Open a claim to approve less.</Alert>
        )}
      </ConfirmDialog>
    </>
  );
}
