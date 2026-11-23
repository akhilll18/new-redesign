// v10.8 · Enterprise data — screens that work on the whole company in the database (10,000 to 10,00,000+ people),
// shown only when the app runs against an EZY HR server. Everything here pages, searches and totals on the server;
// nothing loads the full company into the browser.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, LinearProgress, MenuItem, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { SearchRounded, DownloadRounded, UploadFileRounded, PlayArrowRounded, RefreshRounded, CheckRounded, CloseRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Tag, TableWrap, EmptyState } from "../../components/kit/UI.jsx";
import { apiGet, apiPost, apiDownload, api } from "../../lib/server/api.js";
import { fmtDate } from "../../lib/utils.js";

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const num = (n) => Math.round(Number(n) || 0).toLocaleString("en-IN");
const ms = (t0) => `${Math.round(performance.now() - t0)} ms`;

function useServerCall(path, deps = []) {
  const [state, setState] = useState({ data: null, error: "", loading: true, took: "" });
  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    const t0 = performance.now();
    try { const d = await apiGet(path); setState({ data: d, error: "", loading: false, took: ms(t0) }); }
    catch (e) { setState({ data: null, error: e.message, loading: false, took: "" }); }
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: load };
}

// ── Dashboard card: the true company-wide figures ─────────────────────
export function EnterpriseHeadcount() {
  const { server, entityScope } = useStore();
  const qs = new URLSearchParams();
  if (entityScope?.company && entityScope.company !== "ALL") qs.set("company_id", entityScope.company);
  const { data, error, took } = useServerCall(server ? `/stats/headcount?${qs}` : null, [entityScope?.company]);
  if (!server) return null;
  const meta = server.meta;
  return (
    <SectionCard sx={{ mb: 2 }} title="Whole company · live from the database" subtitle={`Figures cover everyone in the database${meta?.partial ? ` — this screen keeps ${num(meta.employees_loaded)} people at hand for speed; lists and search under Enterprise data reach all ${num(meta.employees_total)}` : ""}${took ? ` · answered in ${took}` : ""}.`}>
      {error && <Alert severity="error">{error}</Alert>}
      {!data ? <LinearProgress /> : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(5, minmax(0,1fr))" }, gap: 1.5 }}>
            <StatCard label="Active employees" value={num(data.active)} tone="accent" hint={`${num(data.all_records)} records in total`} />
            <StatCard label="Joined this month" value={num(data.joined)} tone="good" />
            <StatCard label="Left this month" value={num(data.left)} tone="warn" />
            <StatCard label="Punched in today" value={num(data.punched_in_today)} tone="info" hint={data.active ? `${Math.round((100 * data.punched_in_today) / data.active)} % of active` : ""} />
            <StatCard label="Monthly gross payroll" value={inr(data.monthly_gross)} tone="neutral" />
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.3fr 1fr 1fr" }, gap: 2, mt: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: "0.72rem", mb: 0.8 }}>Headcount by department</Typography>
              {(data.by_department || []).slice(0, 8).map((d) => (
                <Stack key={d.department} direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                  <Typography sx={{ width: 130, fontSize: "0.66rem" }} noWrap>{d.department || "—"}</Typography>
                  <Box sx={{ flex: 1, height: 8, borderRadius: 4, background: "#eef2f3" }}><Box sx={{ width: `${(100 * d.n) / (data.by_department[0]?.n || 1)}%`, height: 8, borderRadius: 4, background: "#1E88E5" }} /></Box>
                  <Typography sx={{ width: 70, textAlign: "right", fontSize: "0.66rem", fontWeight: 700 }}>{num(d.n)}</Typography>
                </Stack>
              ))}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: "0.72rem", mb: 0.8 }}>By company</Typography>
              {(data.by_company || []).map((c) => <Stack key={c.company_id} direction="row" sx={{ justifyContent: "space-between", fontSize: "0.66rem", mb: 0.4 }}><span>{c.company_id || "—"}</span><b>{num(c.n)}</b></Stack>)}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: "0.72rem", mb: 0.8 }}>Waiting for approval</Typography>
              {(data.pending_by_type || []).length === 0 ? <Typography variant="body2" color="text.secondary">Nothing waiting.</Typography> : data.pending_by_type.map((p) => <Stack key={p.type} direction="row" sx={{ justifyContent: "space-between", fontSize: "0.66rem", mb: 0.4 }}><span style={{ textTransform: "capitalize" }}>{p.type}</span><b>{num(p.n)}</b></Stack>)}
            </Box>
          </Box>
        </>
      )}
    </SectionCard>
  );
}

// ── Employee directory (all employees, server-paged) ─────────────────
export function EnterpriseDirectory() {
  const { server, data, user } = useStore();
  const [q, setQ] = useState("");
  const [f, setF] = useState({ status: "active", department: "", company_id: "" });
  const [rows, setRows] = useState([]);
  const [next, setNext] = useState(null);
  const [total, setTotal] = useState(null);
  const [took, setTook] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [view, setView] = useState(null);
  const seq = useRef(0);
  const depts = useMemo(() => [...new Set((data.employees || []).map((e) => e.department).filter(Boolean))].sort(), [data.employees]);
  const isAdmin = user.role !== "emp";
  const params = (after) => { const p = new URLSearchParams({ limit: "50", status: f.status }); if (q.trim()) p.set("q", q.trim()); if (f.department) p.set("department", f.department); if (f.company_id) p.set("company_id", f.company_id); if (after) p.set("after", after); return p; };
  async function load(after) {
    const my = ++seq.current;
    setBusy(true); setErr("");
    const t0 = performance.now();
    try {
      const r = await apiGet(`/employees?${params(after)}`);
      if (my !== seq.current) return;
      setRows((cur) => (after ? [...cur, ...r.rows] : r.rows)); setNext(r.next); setTotal(r); setTook(ms(t0));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  useEffect(() => { const t = setTimeout(() => load(null), 250); return () => clearTimeout(t); }, [q, f.status, f.department, f.company_id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function open(code) { try { setView(await apiGet(`/employees/${encodeURIComponent(code)}`)); } catch (e) { setErr(e.message); } }
  if (!server) return null;
  return (
    <>
      <PageHeader eyebrow="Enterprise data" title="Employee directory" subtitle={`Search and page through everyone in the database${server.meta ? ` — ${num(server.meta.employees_total)} employee records` : ""}.`}
        actions={isAdmin && <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => apiDownload(`/employees/export.csv?${params()}`, `employees-${server.tenant}.csv`)}>Export CSV</Button>} />
      <SectionCard noPad>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ p: 1.5 }}>
          <TextField size="small" fullWidth placeholder="Search name, employee code, e-mail or designation" value={q} onChange={(e) => setQ(e.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
          <TextField select size="small" label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} sx={{ minWidth: 130 }}>{["active", "exited", "pending_approval", "locked", "all"].map((s) => <MenuItem key={s} value={s}>{s.replace("_", " ")}</MenuItem>)}</TextField>
          <TextField select size="small" label="Department" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} sx={{ minWidth: 170 }}><MenuItem value="">All departments</MenuItem>{depts.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}</TextField>
          <TextField select size="small" label="Company" value={f.company_id} onChange={(e) => setF({ ...f, company_id: e.target.value })} sx={{ minWidth: 150 }}><MenuItem value="">All companies</MenuItem>{(data.companies || []).map((c) => <MenuItem key={c.company_id} value={c.company_id}>{c.short || c.name}</MenuItem>)}</TextField>
        </Stack>
        <Typography sx={{ px: 1.5, pb: 1, fontSize: "0.64rem", color: "text.secondary" }}>
          {total ? `${total.total_capped ? "10,000+" : num(total.total)} match${total.total === 1 ? "" : "es"} · showing ${num(rows.length)}${took ? ` · page loaded in ${took}` : ""}` : "Searching…"}
        </Typography>
        {err && <Alert severity="error" sx={{ mx: 1.5, mb: 1 }}>{err}</Alert>}
        {busy && <LinearProgress />}
        <TableWrap>
          <Table size="small">
            <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Designation</TableCell><TableCell>Department</TableCell><TableCell>Manager</TableCell><TableCell>Company · location</TableCell><TableCell>Joined</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.employee_code} hover sx={{ cursor: "pointer" }} onClick={() => open(e.employee_code)}>
                  <TableCell><Box sx={{ fontWeight: 700 }}>{e.full_name}</Box><Box sx={{ fontSize: "0.62rem", color: "text.secondary" }}>{e.employee_code} · {e.email}</Box></TableCell>
                  <TableCell>{e.designation}</TableCell><TableCell>{e.department}</TableCell><TableCell>{e.reporting_manager || "—"}</TableCell>
                  <TableCell>{e.company_id} · {e.location_id}</TableCell><TableCell>{fmtDate(e.date_of_joining)}</TableCell>
                  <TableCell><Tag tone={e.status === "active" ? "good" : e.status === "exited" ? "neutral" : "warn"}>{e.status}</Tag></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
        {!busy && rows.length === 0 && <EmptyState title="No one matches" text="Try fewer letters or another filter." />}
        {next && <Box sx={{ p: 1.5, textAlign: "center" }}><Button onClick={() => load(next)} disabled={busy}>Load the next 50</Button></Box>}
      </SectionCard>
      <Dialog open={!!view} onClose={() => setView(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{view?.full_name} · {view?.employee_code}</DialogTitle>
        <DialogContent dividers>
          {view && <Box sx={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 0.6, fontSize: "0.74rem" }}>
            {[["Designation", view.designation], ["Department", view.department], ["Reporting manager", view.reporting_manager], ["E-mail", view.email], ["Company", view.company_id], ["Location", view.location_id], ["Employment", view.employment_type], ["Joined", fmtDate(view.date_of_joining)], ["Status", view.status], ...(isAdmin ? [["Monthly gross", inr(view.monthly_gross)], ["Bank", `${view.bank_name || ""} ${view.bank_account ? `· ${String(view.bank_account).slice(-4).padStart(8, "•")}` : ""}`], ["PAN", view.pan]] : [])].map(([k, v]) => <React.Fragment key={k}><Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>{k}</Typography><Typography sx={{ fontSize: "0.72rem", fontWeight: 600 }}>{v || "—"}</Typography></React.Fragment>)}
          </Box>}
        </DialogContent>
        <DialogActions><Button onClick={() => setView(null)}>Close</Button></DialogActions>
      </Dialog>
    </>
  );
}

// ── Approvals at scale: page through everything waiting, approve / reject in bulk ─────
export function EnterpriseApprovals() {
  const { server, notifyToast } = useStore();
  const [type, setType] = useState("");
  const [rows, setRows] = useState([]);
  const [next, setNext] = useState(null);
  const [total, setTotal] = useState(0);
  const [sel, setSel] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [took, setTook] = useState("");
  async function load(after) {
    setBusy(true);
    const t0 = performance.now();
    try {
      const p = new URLSearchParams({ limit: "100" }); if (type) p.set("type", type); if (after) p.set("after", after);
      const r = await apiGet(`/inbox?${p}`);
      setRows((c) => (after ? [...c, ...r.rows] : r.rows)); setNext(r.next); setTotal(r.total); setTook(ms(t0));
      if (!after) setSel(new Set());
    } catch (e) { notifyToast(e.message, "error"); }
    setBusy(false);
  }
  useEffect(() => { load(null); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps
  async function decide(decision) {
    setBusy(true);
    try {
      const r = await apiPost("/requests/decision", { ids: [...sel], decision, note: decision === "approve" ? "Bulk approved" : "Bulk rejected" });
      notifyToast(`${r.done} request(s) ${decision === "approve" ? "approved" : "rejected"}${r.skipped ? ` · ${r.skipped} already handled by someone else` : ""}.`);
      await load(null);
      server.reload?.();
    } catch (e) { notifyToast(e.message, "error"); setBusy(false); }
  }
  if (!server) return null;
  const all = rows.length > 0 && rows.every((r) => sel.has(r.request_id));
  return (
    <>
      <PageHeader eyebrow="Enterprise data" title="Approvals at scale" subtitle={`Everything waiting for you across the company — ${num(total)} request(s). Tick and approve or reject up to 5,000 at once.${took ? ` Page loaded in ${took}.` : ""}`} />
      <SectionCard noPad>
        <Stack direction="row" spacing={1} sx={{ p: 1.5, alignItems: "center", flexWrap: "wrap" }} useFlexGap>
          <TextField select size="small" label="Type" value={type} onChange={(e) => setType(e.target.value)} sx={{ minWidth: 160 }}><MenuItem value="">All types</MenuItem>{["leave", "expense", "regularize", "advance", "loan", "asset"].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField>
          <Typography sx={{ fontSize: "0.7rem", ml: 1 }}>{sel.size} selected</Typography>
          <Box sx={{ flex: 1 }} />
          <Button startIcon={<RefreshRounded />} onClick={() => load(null)}>Refresh</Button>
          <Button color="error" variant="outlined" startIcon={<CloseRounded />} disabled={!sel.size || busy} onClick={() => decide("reject")}>Reject</Button>
          <Button variant="contained" startIcon={<CheckRounded />} disabled={!sel.size || busy} onClick={() => decide("approve")}>Approve {sel.size || ""}</Button>
        </Stack>
        {busy && <LinearProgress />}
        <TableWrap>
          <Table size="small">
            <TableHead><TableRow><TableCell padding="checkbox"><Checkbox size="small" checked={all} indeterminate={!all && sel.size > 0} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.request_id)))} /></TableCell><TableCell>Request</TableCell><TableCell>Employee</TableCell><TableCell>Details</TableCell><TableCell>Stage</TableCell><TableCell>Raised</TableCell></TableRow></TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.request_id} hover>
                  <TableCell padding="checkbox"><Checkbox size="small" checked={sel.has(r.request_id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.request_id)) n.delete(r.request_id); else n.add(r.request_id); return n; })} /></TableCell>
                  <TableCell><Tag tone="info">{r.type}</Tag><Typography variant="caption" display="block">{r.request_id}</Typography></TableCell>
                  <TableCell>{r.full_name}<Typography variant="caption" display="block" color="text.secondary">{r.employee_code}</Typography></TableCell>
                  <TableCell>{r.type === "leave" ? `${r.leave_type || ""} · ${r.days || ""} day(s) · ${fmtDate(r.from_date)}` : r.title || ""}{r.amount ? ` · ${inr(r.amount)}` : ""}<Typography variant="caption" display="block" color="text.secondary">{r.reason}</Typography></TableCell>
                  <TableCell>{r.stage === "manager" ? "Manager" : "HR / admin"}</TableCell>
                  <TableCell>{fmtDate(r.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
        {!busy && rows.length === 0 && <EmptyState title="Nothing waiting" text="All caught up." />}
        {next && <Box sx={{ p: 1.5, textAlign: "center" }}><Button onClick={() => load(next)} disabled={busy}>Load 100 more</Button></Box>}
      </SectionCard>
    </>
  );
}

// ── Payroll for the whole company (runs on the server) ────────────────
export function EnterprisePayroll() {
  const { server, data, notifyToast } = useStore();
  const prev = new Date(); prev.setMonth(prev.getMonth() - 1);
  const [period, setPeriod] = useState(prev.toISOString().slice(0, 7));
  const [company, setCompany] = useState("");
  const [job, setJob] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [summary, setSummary] = useState(null);
  const refresh = useCallback(async () => { try { setJobs(await apiGet("/jobs")); } catch { /* ignore */ } }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!job || ["done", "failed"].includes(job.status)) return undefined;
    const t = setInterval(async () => { try { const j = await apiGet(`/jobs/${job.job_id}`); setJob(j); if (["done", "failed"].includes(j.status)) refresh(); } catch { /* ignore */ } }, 1500);
    return () => clearInterval(t);
  }, [job, refresh]);
  async function run() {
    try { const j = await apiPost("/payroll/runs", { period, company_id: company || undefined }); setJob({ ...j, status: "queued", progress: 0 }); notifyToast("Payroll run started on the server."); }
    catch (e) { notifyToast(e.message, "error"); }
  }
  async function openBatch(id) { try { setSummary(await apiGet(`/payroll/batches/${encodeURIComponent(id)}`)); } catch (e) { notifyToast(e.message, "error"); } }
  if (!server) return null;
  const runs = jobs.filter((j) => j.kind === "payroll_run");
  return (
    <>
      <PageHeader eyebrow="Enterprise data" title="Payroll for the whole company" subtitle="Computes every active employee's payslip inside the database — pay for days worked (loss of pay from attendance), PF, ESI, professional tax and new-regime TDS. 10 lakh payslips take a few minutes." />
      <SectionCard title="Run payroll">
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
          <TextField type="month" size="small" label="Pay month" value={period} onChange={(e) => setPeriod(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select size="small" label="Company" value={company} onChange={(e) => setCompany(e.target.value)} sx={{ minWidth: 200 }}><MenuItem value="">All companies</MenuItem>{(data.companies || []).map((c) => <MenuItem key={c.company_id} value={c.company_id}>{c.short || c.name}</MenuItem>)}</TextField>
          <Button variant="contained" startIcon={<PlayArrowRounded />} onClick={run} disabled={job && !["done", "failed"].includes(job.status)}>Run payroll</Button>
        </Stack>
        {job && (
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontSize: "0.72rem", mb: 0.5 }}>Job {job.job_id} · {job.status}{job.status === "running" ? ` · ${job.progress}%` : ""}</Typography>
            <LinearProgress variant="determinate" value={job.status === "done" ? 100 : Number(job.progress) || 0} />
            {job.status === "done" && job.result && <Alert severity="success" sx={{ mt: 1 }}>{num(job.result.payslips)} payslips · gross {inr(job.result.gross)} · net {inr(job.result.net)} · {job.result.seconds} s. Batch {job.result.batch_id}.</Alert>}
            {job.status === "failed" && <Alert severity="error" sx={{ mt: 1 }}>{job.error}</Alert>}
          </Box>
        )}
      </SectionCard>
      <SectionCard title="Payroll runs" subtitle="Open a run for totals by department and the bank advice file." noPad sx={{ mt: 2 }}>
        {runs.length === 0 ? <EmptyState title="No runs yet" text="Run payroll for a month above." /> : (
          <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Job</TableCell><TableCell>Month</TableCell><TableCell>Status</TableCell><TableCell align="right">Payslips</TableCell><TableCell align="right">Net pay</TableCell><TableCell align="right">Time</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>{runs.map((j) => <TableRow key={j.job_id}><TableCell>{j.job_id}</TableCell><TableCell>{j.params?.period}{j.params?.company_id ? ` · ${j.params.company_id}` : ""}</TableCell><TableCell><Tag tone={j.status === "done" ? "good" : j.status === "failed" ? "bad" : "warn"}>{j.status}</Tag></TableCell><TableCell align="right">{num(j.result?.payslips)}</TableCell><TableCell align="right">{j.result ? inr(j.result.net) : "—"}</TableCell><TableCell align="right">{j.result?.seconds ? `${j.result.seconds} s` : "—"}</TableCell>
              <TableCell align="right">{j.result?.batch_id && <><Button size="small" onClick={() => openBatch(j.result.batch_id)}>Summary</Button><Button size="small" startIcon={<DownloadRounded />} onClick={() => apiDownload(`/payroll/batches/${j.result.batch_id}/bank-file.csv`, `bank-advice-${j.result.batch_id}.csv`)}>Bank file</Button></>}</TableCell></TableRow>)}</TableBody></Table></TableWrap>
        )}
      </SectionCard>
      <Dialog open={!!summary} onClose={() => setSummary(null)} maxWidth="md" fullWidth>
        <DialogTitle>{summary?.batch_id} · {summary?.period} · {num(summary?.employees)} payslips</DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}><Chip label={`Gross ${inr(summary?.gross_total)}`} /><Chip color="success" label={`Net ${inr(summary?.net_total)}`} /></Stack>
          <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Department</TableCell><TableCell align="right">People</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right">Net</TableCell><TableCell align="right">LOP days</TableCell></TableRow></TableHead>
            <TableBody>{(summary?.by_department || []).map((d) => <TableRow key={d.department}><TableCell>{d.department}</TableCell><TableCell align="right">{num(d.n)}</TableCell><TableCell align="right">{inr(d.gross)}</TableCell><TableCell align="right">{inr(d.net)}</TableCell><TableCell align="right">{num(d.lop_days)}</TableCell></TableRow>)}</TableBody></Table></TableWrap>
        </DialogContent>
        <DialogActions><Button onClick={() => setSummary(null)}>Close</Button></DialogActions>
      </Dialog>
    </>
  );
}

// ── Bulk employee import (CSV → database) ─────────────────────────────
export function EnterpriseImport() {
  const { server, notifyToast } = useStore();
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  async function upload(file) {
    if (!file) return;
    if (file.size > 150 * 1024 * 1024) return notifyToast("Split files over 150 MB.", "error");
    setBusy(true); setRes(null);
    try {
      const text = await file.text();
      const r = await api("/employees/import", { method: "POST", body: text, headers: { "content-type": "text/csv" } });
      setRes(r); notifyToast(`${num(r.inserted)} added, ${num(r.updated)} updated.`);
      server.reload?.();
    } catch (e) { notifyToast(e.message, "error"); }
    setBusy(false);
  }
  const sample = "employee_code,full_name,email,designation,department,reporting_manager,company_id,location_id,employment_type,date_of_joining,date_of_birth,monthly_gross\nEMP2001,Anita Rao,anita.rao@company.com,Analyst,Finance,EMP001,,,full_time,2026-11-01,1994-05-12,65000\n";
  if (!server) return null;
  return (
    <>
      <PageHeader eyebrow="Enterprise data" title="Bulk employee import" subtitle="Load thousands to lakhs of employees from a CSV file straight into the database. Existing codes are updated, new codes are added; new people must set their own password at first sign-in." />
      <SectionCard>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button variant="contained" component="label" startIcon={<UploadFileRounded />} disabled={busy}>{busy ? "Importing…" : "Upload CSV"}<input hidden type="file" accept=".csv,text/csv" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} /></Button>
          <Button startIcon={<DownloadRounded />} onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([sample], { type: "text/csv" })); a.download = "employee-import-template.csv"; a.click(); }}>Download template</Button>
        </Stack>
        {busy && <LinearProgress sx={{ mt: 2 }} />}
        {res && <Alert severity="success" sx={{ mt: 2 }}>{num(res.inserted)} added · {num(res.updated)} updated · {num(res.skipped)} skipped (no code or name) · {(res.ms / 1000).toFixed(1)} s.</Alert>}
        <Typography sx={{ fontSize: "0.66rem", color: "text.secondary", mt: 2 }}>Columns: employee_code and full_name are required; email, login_id, designation, department, reporting_manager, company_id, location_id, employment_type, status, date_of_joining (YYYY-MM-DD), date_of_birth and monthly_gross are optional. First-time password: Welcome@123.</Typography>
      </SectionCard>
    </>
  );
}

// ── Database & performance (Super Admin) ──────────────────────────────
export function DatabaseHealth() {
  const { server } = useStore();
  const { data, error, reload, took } = useServerCall(server ? "/admin/database" : null);
  if (!server) return null;
  const gb = (b) => `${(Number(b) / 1024 ** 3).toFixed(2)} GB`;
  return (
    <>
      <PageHeader eyebrow="Enterprise data" title="Database & performance" subtitle={`PostgreSQL size, table rows, cache and the API's own response times${took ? ` · answered in ${took}` : ""}.`} actions={<Button startIcon={<RefreshRounded />} onClick={reload}>Refresh</Button>} />
      {error && <Alert severity="error">{error}</Alert>}
      {!data ? <LinearProgress /> : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(5, minmax(0,1fr))" }, gap: 1.5, mb: 2 }}>
            <StatCard label="Database size" value={gb(data.database_bytes)} tone="accent" />
            <StatCard label="Cache hit rate" value={`${data.cache_hit_pct ?? "—"} %`} tone="good" hint="Aim for 99 %+" />
            <StatCard label="Connections" value={`${data.connections.active} / ${data.connections.total}`} tone="info" hint="active / open" />
            <StatCard label="Monthly partitions" value={num(data.partitions)} tone="neutral" />
            <StatCard label="API pool" value={`${data.pool.total - data.pool.idle} busy`} tone="neutral" hint={`${data.pool.waiting} waiting`} />
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.3fr" }, gap: 2 }}>
            <SectionCard title="Tables" noPad>
              <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Table</TableCell><TableCell align="right">Rows</TableCell><TableCell align="right">Size</TableCell></TableRow></TableHead>
                <TableBody>{data.tables.map((t) => <TableRow key={t.table}><TableCell>{t.table}</TableCell><TableCell align="right">{num(t.rows)}</TableCell><TableCell align="right">{gb(t.bytes)}</TableCell></TableRow>)}</TableBody></Table></TableWrap>
            </SectionCard>
            <SectionCard title="API response times (this server, recent calls)" noPad>
              {data.api.length === 0 ? <EmptyState title="No calls yet" /> : (
                <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Endpoint</TableCell><TableCell align="right">Calls</TableCell><TableCell align="right">p50</TableCell><TableCell align="right">p95</TableCell><TableCell align="right">p99</TableCell></TableRow></TableHead>
                  <TableBody>{data.api.slice(0, 20).map((m) => <TableRow key={m.route}><TableCell sx={{  fontSize: "0.62rem" }}>{m.route}</TableCell><TableCell align="right">{num(m.calls)}</TableCell><TableCell align="right">{m.p50_ms} ms</TableCell><TableCell align="right">{m.p95_ms} ms</TableCell><TableCell align="right">{m.p99_ms} ms</TableCell></TableRow>)}</TableBody></Table></TableWrap>
              )}
            </SectionCard>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>{data.version}</Typography>
        </>
      )}
    </>
  );
}

// Shown on lists that work on the loaded working set (classic employee database, team lists) in a large company.
export function PartialDataNote({ what = "employees" }) {
  const { data } = useStore();
  const s = data?.__server;
  if (!s?.partial) return null;
  return (
    <Box sx={{ mb: 1.5, p: 1.2, px: 1.6, borderRadius: 2, border: "1px solid #cfe3f3", background: "#f3f8fd", display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.72rem", flex: 1, minWidth: 240 }}>
        Showing the <b>{s.employees_loaded.toLocaleString("en-IN")}</b> {what} loaded for you out of <b>{s.employees_total.toLocaleString("en-IN")}</b>. Search and page through everyone in the Employee directory.
      </Typography>
      <Button size="small" variant="outlined" href="#/ent-directory">Open Employee directory</Button>
    </Box>
  );
}
