// Background verification (BGV): HR case management, access control, employee self-service and status on employee screens.
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Autocomplete, Box, Button, Checkbox, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, FormControl, FormControlLabel, IconButton, InputLabel, LinearProgress, MenuItem, Select, Stack, Step, StepLabel, Stepper, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { AddRounded, CloseRounded, UploadFileRounded, NotificationsActiveRounded, LockRounded, VerifiedUserRounded, AttachFileRounded, DownloadRounded, PauseCircleRounded, PlayCircleRounded, ExpandMoreRounded, ExpandLessRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Tag, TableWrap, Mono, PersonCell, EmptyState, KeyVal, ConfirmDialog } from "../kit/UI.jsx";
import { AiInsight } from "../ai/AiInsight.jsx";
import { AiButton, AiResult, useAiRun } from "./aiKit.jsx";
import { BGV_CHECKS, BGV_CHECK_LABEL, BGV_CHECK_DEF, BGV_PACKAGES, BGV_STATUS, CHECK_STATUS, CHECK_DONE, CASE_STEPS, DOCUMENT_ITEMS, DOC_ITEM_STATUS, bgvStatus, bgvProgress, bgvStep, bgvFor, bgvAccessLevel, bgvChecksFor, canManageBgv, directory, stagesOf, stageLabel, checkStage, stageIndex, fieldsOf, officialEmailCheck } from "../../lib/collab.js";
import { fmtDate, fmtDateTime, isoDate, readFileAsDataUrl, downloadCsv, timeAgo } from "../../lib/utils.js";

export function BgvChip({ c, status, sx }) {
  const s = status || bgvStatus(c);
  const def = BGV_STATUS[s] || BGV_STATUS.not_started;
  return <Tag tone={def.tone} sx={sx}>{def.label}</Tag>;
}
const CheckChip = ({ s }) => <Tag tone={CHECK_STATUS[s]?.tone || "neutral"}>{CHECK_STATUS[s]?.label || s}</Tag>;
const TONE_COLOR = { good: "#2e7d4f", bad: "#b0291f", warn: "#b26a00", info: "#1f5f99", neutral: "#9aa39c" };

/** Overall tracker for a case: Initiated → Consent signed → Started → Verification → HR review → Cleared / closed. */
export function CaseTracker({ c, sx }) {
  const step = bgvStep(c);
  const st = bgvStatus(c);
  const bad = st === "discrepancy";
  const last = c.closed_status ? (c.closed_status === "discrepancy" ? "Closed · discrepancy" : BGV_STATUS[c.closed_status]?.label) : "Cleared / closed";
  return (
    <Box sx={{ py: 1.2, px: 0.5, border: "1px solid #e5eae5", borderRadius: 1.5, bgcolor: "#fbfcfb", ...sx }}>
      <Stepper activeStep={c.closed_status ? 6 : step} alternativeLabel sx={{ "& .MuiStepLabel-label": { fontSize: "0.58rem !important", mt: "4px !important" }, "& .MuiStepIcon-root": { width: 20, height: 20 } }}>
        {CASE_STEPS.map(([k, label], i) => (
          <Step key={k} completed={i < step || !!c.closed_status}>
            <StepLabel error={(bad && i === step) || (i === 5 && c.closed_status === "discrepancy")} optional={i === step && !c.closed_status ? <Typography sx={{ fontSize: "0.52rem", color: TONE_COLOR[BGV_STATUS[st]?.tone] || "#78827b", textAlign: "center" }}>{BGV_STATUS[st]?.label}</Typography> : null}>
              {i === 5 ? last : label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
      {c.on_hold && <Typography sx={{ fontSize: "0.6rem", color: "#b26a00", textAlign: "center", mt: 0.5 }}>On hold since {fmtDate(c.on_hold.at)} · {c.on_hold.reason}</Typography>}
    </Box>
  );
}

/** A check's own steps as dots, with the current one named. */
export function StageDots({ k, showLabel = true }) {
  const st = stagesOf(k.type);
  const idx = stageIndex(k);
  const tone = CHECK_STATUS[k.status]?.tone || "info";
  return (
    <Tooltip title={st.map(([, l], i) => `${i < idx ? "✓" : i === idx ? "●" : "○"} ${l}`).join("  ")}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.4 }}>
        {st.map(([key], i) => <Box key={key} sx={{ width: i === idx ? 10 : 7, height: i === idx ? 10 : 7, borderRadius: "50%", bgcolor: i < idx || (i === idx && CHECK_DONE.includes(k.status)) ? TONE_COLOR[tone === "neutral" ? "good" : tone] : i === idx ? TONE_COLOR[tone] : "#dfe4df", border: i === idx ? "2px solid #fff" : 0, boxShadow: i === idx ? `0 0 0 1px ${TONE_COLOR[tone]}` : "none" }} />)}
        {showLabel && <Typography sx={{ fontSize: "0.58rem", color: "#5c675f", ml: 0.5, whiteSpace: "nowrap" }}>{stageLabel(k.type, checkStage(k))}</Typography>}
      </Stack>
    </Tooltip>
  );
}

const optLabel = (f, v) => (f[3] ? f[3].find(([x]) => x === v)?.[1] : v);
const defaultItems = () => DOCUMENT_ITEMS.map((name) => ({ name, status: "pending" }));

/** What was captured for a check: details, document checklist and its own tracking log. */
function CheckDetails({ k }) {
  const { nameOf } = useStore();
  const [log, setLog] = useState(false);
  const fields = fieldsOf(k.type).filter((f) => k.details?.[f[0]]);
  return (
    <Box sx={{ mt: 0.8 }}>
      {fields.length > 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 0.6, mt: 0.4 }}>
          {fields.map((f) => (
            <Box key={f[0]}>
              <Typography sx={{ fontSize: "0.52rem", color: "#78827b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{f[1]}</Typography>
              <Typography sx={{ fontSize: "0.64rem", fontWeight: 600, wordBreak: "break-word" }}>{f[2] === "date" ? fmtDate(k.details[f[0]]) : optLabel(f, k.details[f[0]])}</Typography>
              {f[2] === "email" && <Typography sx={{ fontSize: "0.52rem", color: officialEmailCheck(k.details[f[0]]).ok ? "#2e7d4f" : "#b0291f" }}>{officialEmailCheck(k.details[f[0]]).text}</Typography>}
            </Box>
          ))}
        </Box>
      )}
      {k.type === "documents" && k.items?.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.8 }}>
          {k.items.map((i) => <Tag key={i.name} tone={DOC_ITEM_STATUS[i.status]?.tone}>{i.name}: {DOC_ITEM_STATUS[i.status]?.label}</Tag>)}
        </Stack>
      )}
      {k.tracking?.length > 0 && (
        <>
          <Button size="small" onClick={() => setLog(!log)} endIcon={log ? <ExpandLessRounded /> : <ExpandMoreRounded />} sx={{ fontSize: "0.56rem", mt: 0.4, p: 0, minWidth: 0 }}>Tracking log ({k.tracking.length})</Button>
          <Collapse in={log}>
            <Stack spacing={0.3} sx={{ mt: 0.4, pl: 1, borderLeft: "2px solid #e5eae5" }}>
              {k.tracking.map((t, i) => <Typography key={i} sx={{ fontSize: "0.58rem" }}><b>{stageLabel(k.type, t.stage)}</b> · {fmtDateTime(t.at)} · {nameOf(t.by)}{t.note ? ` — ${t.note}` : ""}</Typography>)}
            </Stack>
          </Collapse>
        </>
      )}
    </Box>
  );
}

/** HR form to move a check along its steps and record what was found. */
function CheckEditor({ c, k, onDone }) {
  const { updateBgvCheck, notifyToast } = useStore();
  const [f, setF] = useState(() => ({ status: k.status, stage: checkStage(k), details: { ...(k.details || {}) }, items: k.type === "documents" ? (k.items?.length ? k.items.map((i) => ({ ...i })) : defaultItems()) : null, remarks: k.remarks || "", candidate_note: k.candidate_note || "", track_note: "" }));
  const [error, setError] = useState("");
  const setD = (key, v) => setF({ ...f, details: { ...f.details, [key]: v } });
  const save = () => {
    const r = updateBgvCheck(c.id, k.type, { ...f, items: f.items || undefined });
    if (!r.ok) return setError(r.error);
    notifyToast("Check updated.");
    onDone();
  };
  return (
    <Stack spacing={1.2} sx={{ mt: 1.2, p: 1.2, bgcolor: "#f7f9f7", borderRadius: 1.5 }}>
      {error && <Alert severity="error" sx={{ fontSize: "0.62rem", py: 0 }}>{error}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
        <FormControl size="small" fullWidth><InputLabel>Tracking stage</InputLabel><Select label="Tracking stage" value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>{stagesOf(k.type).map(([v, l], i) => <MenuItem key={v} value={v}>{i + 1}. {l}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" fullWidth><InputLabel>Outcome</InputLabel><Select label="Outcome" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, stage: CHECK_DONE.includes(e.target.value) ? "completed" : f.stage === "completed" ? stagesOf(k.type).at(-2)[0] : f.stage })}>{Object.entries(CHECK_STATUS).map(([v, d]) => <MenuItem key={v} value={v}>{d.label}</MenuItem>)}</Select></FormControl>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.2 }}>
        {fieldsOf(k.type).map((fd) => fd[2] === "select" ? (
          <FormControl key={fd[0]} size="small"><InputLabel>{fd[1]}</InputLabel><Select label={fd[1]} value={f.details[fd[0]] || ""} onChange={(e) => setD(fd[0], e.target.value)}><MenuItem value="">—</MenuItem>{fd[3].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</Select></FormControl>
        ) : (
          <TextField key={fd[0]} size="small" label={fd[1]} type={fd[2] === "date" ? "date" : "text"} value={f.details[fd[0]] || ""} onChange={(e) => setD(fd[0], e.target.value)} slotProps={fd[2] === "date" ? { inputLabel: { shrink: true } } : undefined}
            helperText={fd[2] === "email" && f.details[fd[0]] ? officialEmailCheck(f.details[fd[0]]).text : undefined} error={fd[2] === "email" && !!f.details[fd[0]] && !officialEmailCheck(f.details[fd[0]]).ok} />
        ))}
      </Box>
      {f.items && (
        <Box>
          <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, mb: 0.6 }}>Document checklist</Typography>
          <Stack spacing={0.6}>
            {f.items.map((it, i) => (
              <Stack key={it.name} direction="row" sx={{ alignItems: "center", gap: 1 }}>
                <Typography sx={{ fontSize: "0.62rem", flex: 1 }}>{it.name}</Typography>
                <ToggleButtonGroup size="small" exclusive value={it.status} onChange={(_, v) => v && setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, status: v } : x)) })}>
                  {Object.entries(DOC_ITEM_STATUS).map(([v, d]) => <ToggleButton key={v} value={v} sx={{ fontSize: "0.5rem", py: 0.2, px: 0.7, textTransform: "none" }}>{d.label.split(" /")[0]}</ToggleButton>)}
                </ToggleButtonGroup>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
      <TextField size="small" label="Tracking note (optional)" placeholder="e.g. Agent called, visit fixed for Saturday 11 am" value={f.track_note} onChange={(e) => setF({ ...f, track_note: e.target.value })} />
      <TextField size="small" label={f.status === "discrepancy" ? "What was declared vs verified *" : f.status === "unable_to_verify" ? "Why it could not be verified *" : "Internal remarks"} multiline minRows={2} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} />
      {f.status === "insufficient" && <TextField size="small" label="What should the person upload? *" value={f.candidate_note} onChange={(e) => setF({ ...f, candidate_note: e.target.value })} />}
      <Stack direction="row" spacing={1}><Button size="small" variant="contained" onClick={save}>Save</Button><Button size="small" color="inherit" onClick={onDone}>Cancel</Button></Stack>
    </Stack>
  );
}

function overdue(c) {
  const s = bgvStatus(c);
  return !["clear", "cleared_with_remarks", "cancelled"].includes(s) && c.due_date < isoDate();
}
function subjectOf(data, c) {
  if (c.employee_code) {
    const e = data.employees.find((x) => x.employee_code === c.employee_code);
    return { name: c.name, sub: `${c.employee_code} · ${e?.designation || ""}`, dept: e?.department, country: e?.country_code };
  }
  const k = data.candidates.find((x) => x.id === c.candidate_id);
  const r = k && data.reqs.find((q) => q.id === k.req_id);
  return { name: c.name, sub: `Candidate · ${r?.role || ""}`, dept: r?.dept, country: "IN" };
}

// ── Admin / Super Admin: Background verification ───────
export function BgvAdminPage() {
  const { data, user } = useStore();
  const [tab, setTab] = useState("cases");
  const manage = canManageBgv(user);
  return (
    <>
      <PageHeader eyebrow={`HIRE & ONBOARD · BACKGROUND VERIFICATION${manage ? "" : " · READ ONLY"}`} title="Background verification" subtitle="Consent, checks, vendor turnaround and discrepancies for employees and candidates. Every view of a case is written to the audit log; access beyond status needs a grant." />
      <Box sx={{ mb: 2, borderBottom: "1px solid #e5eae4" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
          <Tab value="cases" label="Cases" sx={{ fontSize: "0.7rem" }} />
          <Tab value="tracker" label="Check tracker" sx={{ fontSize: "0.7rem" }} />
          <Tab value="vendors" label="Vendors & packages" sx={{ fontSize: "0.7rem" }} />
          <Tab value="access" label="Access & permissions" sx={{ fontSize: "0.7rem" }} />
        </Tabs>
      </Box>
      {tab === "cases" && <BgvCases />}
      {tab === "tracker" && <BgvTracker />}
      {tab === "vendors" && <BgvVendors />}
      {tab === "access" && <BgvAccessPanel />}
    </>
  );
}

function BgvCases() {
  const { data, user, nameOf } = useStore();
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [start, setStart] = useState(false);
  const manage = canManageBgv(user);
  const visible = data.bgv.filter((c) => !c.cancelled && bgvAccessLevel(data, user, c));
  const rows = visible.filter((c) => (!status || bgvStatus(c) === status || (status === "overdue" && overdue(c))) && (!kind || c.subject_type === kind) && (!q || `${c.name} ${c.id} ${c.employee_code || ""}`.toLowerCase().includes(q.toLowerCase())));
  const count = (s) => visible.filter((c) => bgvStatus(c) === s).length;
  const tat = visible.filter((c) => c.closed_at).map((c) => (new Date(c.closed_at) - new Date(c.initiated_at)) / 86400000);
  const facts = [
    `${visible.length} cases: ${count("clear") + count("cleared_with_remarks")} cleared, ${count("review")} under HR review (all checks done), ${count("started")} started, ${count("on_hold")} on hold, ${count("in_progress")} in verification, ${count("insufficient")} waiting for documents, ${count("discrepancy")} with a discrepancy, ${count("consent_pending")} waiting for consent`,
    `${visible.filter(overdue).length} case(s) past their due date: ${visible.filter(overdue).map((c) => `${c.name} (due ${c.due_date})`).join(", ") || "none"}`,
    ...visible.filter((c) => bgvStatus(c) === "discrepancy").map((c) => `Discrepancy – ${c.name}: ${c.checks.filter((k) => k.status === "discrepancy").map((k) => `${BGV_CHECK_LABEL[k.type]}: ${k.remarks}`).join("; ")}`),
    ...visible.filter((c) => bgvStatus(c) === "insufficient").map((c) => `Insufficient – ${c.name}: ${c.checks.filter((k) => k.status === "insufficient").map((k) => BGV_CHECK_LABEL[k.type]).join(", ")}`),
    tat.length ? `Average turnaround of closed cases: ${Math.round(tat.reduce((a, b) => a + b, 0) / tat.length)} days` : "",
    `Active employees with status pending in the master: ${data.employees.filter((e) => e.status === "active" && e.background_check !== "clear").map((e) => e.full_name).join(", ") || "none"}`,
  ];
  return (
    <Stack spacing={2.5}>
      <Grid min={128}>
        <StatCard label="Open cases" value={visible.filter((c) => !c.closed_status).length} hint={`${count("consent_pending")} awaiting consent`} onClick={() => setStatus("")} />
        <StatCard label="Started" value={count("started")} tone="info" hint="Consent in, work not begun" onClick={() => setStatus("started")} />
        <StatCard label="In verification" value={count("in_progress")} tone="info" onClick={() => setStatus("in_progress")} />
        <StatCard label="Insufficient docs" value={count("insufficient")} tone="warn" onClick={() => setStatus("insufficient")} />
        <StatCard label="On hold" value={count("on_hold")} tone="warn" onClick={() => setStatus("on_hold")} />
        <StatCard label="Discrepancies" value={count("discrepancy")} tone="bad" onClick={() => setStatus("discrepancy")} />
        <StatCard label="Under HR review" value={count("review")} tone="info" hint="All checks done – close" onClick={() => setStatus("review")} />
        <StatCard label="Past due date" value={visible.filter(overdue).length} tone="bad" onClick={() => setStatus("overdue")} />
        <StatCard label="Cleared" value={count("clear") + count("cleared_with_remarks")} tone="good" onClick={() => setStatus("clear")} />
      </Grid>
      <AiInsight title="AI verification brief" audience="the HR background-verification team" facts={facts} />
      <SectionCard
        title="Cases"
        subtitle="Click a case to see checks, documents and the timeline"
        action={
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv("bgv-cases.csv", ["case", "name", "subject", "package", "vendor", "consent", "tracking step", "status", "progress", "initiated", "due", ...BGV_CHECKS.map(([, l]) => l)], rows.map((c) => [c.id, c.name, c.subject_type, BGV_PACKAGES[c.package]?.label, data.bgvVendors.find((v) => v.id === c.vendor_id)?.name, c.consent?.status, CASE_STEPS[Math.max(0, bgvStep(c))][1], BGV_STATUS[bgvStatus(c)].label, `${bgvProgress(c)}%`, c.initiated_at.slice(0, 10), c.due_date, ...BGV_CHECKS.map(([t]) => { const k = c.checks.find((x) => x.type === t); return k ? `${CHECK_STATUS[k.status]?.label} · ${stageLabel(t, checkStage(k))}` : ""; })]))}>Export</Button>
            {manage && <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setStart(true)}>Start verification</Button>}
          </Stack>
        }
        noPad
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ p: 1.5 }}>
          <TextField size="small" placeholder="Search name, code or case" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 220 }} />
          <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><MenuItem value="">All</MenuItem><MenuItem value="overdue">Past due date</MenuItem>{Object.entries(BGV_STATUS).filter(([k]) => k !== "cancelled").map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Subject</InputLabel><Select label="Subject" value={kind} onChange={(e) => setKind(e.target.value)}><MenuItem value="">Employees & candidates</MenuItem><MenuItem value="employee">Employees</MenuItem><MenuItem value="candidate">Candidates</MenuItem></Select></FormControl>
        </Stack>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 980 }}>
            <TableHead><TableRow><TableCell>Case</TableCell><TableCell>Person</TableCell><TableCell>Package · vendor</TableCell><TableCell>Consent</TableCell><TableCell sx={{ minWidth: 150 }}>Tracking</TableCell><TableCell>Due</TableCell><TableCell>Status</TableCell><TableCell>Your access</TableCell></TableRow></TableHead>
            <TableBody>
              {rows.map((c) => {
                const s = subjectOf(data, c);
                const lvl = bgvAccessLevel(data, user, c);
                return (
                  <TableRow key={c.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(c.id)}>
                    <TableCell><Mono>{c.id}</Mono></TableCell>
                    <TableCell><PersonCell name={s.name} sub={s.sub} /></TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.68rem", fontWeight: 600 }}>{BGV_PACKAGES[c.package]?.label}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{data.bgvVendors.find((v) => v.id === c.vendor_id)?.name}</Typography></TableCell>
                    <TableCell>{c.consent?.status === "given" ? <Tag tone="good">Signed</Tag> : <Tag tone="warn">Pending</Tag>}</TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.6rem", fontWeight: 700 }}>{CASE_STEPS[Math.max(0, bgvStep(c))][1]}</Typography><LinearProgress variant="determinate" value={bgvProgress(c)} sx={{ height: 5, borderRadius: 3, my: 0.3 }} /><Typography sx={{ fontSize: "0.54rem", color: "#78827b" }}>{c.checks.filter((k) => CHECK_DONE.includes(k.status)).length}/{c.checks.length} checks done · {bgvProgress(c)}%</Typography></TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", color: overdue(c) ? "error.main" : undefined, fontWeight: overdue(c) ? 700 : 400 }}>{fmtDate(c.due_date)}</TableCell>
                    <TableCell><BgvChip c={c} /></TableCell>
                    <TableCell><Tag tone={lvl === "full" ? "info" : "neutral"}>{lvl}</Tag></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrap>
        {!rows.length && <EmptyState title="No cases match" text="Change the filters or start a new verification." />}
      </SectionCard>
      <BgvCaseDrawer id={open} onClose={() => setOpen(null)} />
      <StartBgvDialog open={start} onClose={() => setStart(false)} onStarted={(id) => { setStart(false); setOpen(id); }} />
    </Stack>
  );
}

export function StartBgvDialog({ open, onClose, onStarted, preset = {} }) {
  const { data, initiateBgv, notifyToast } = useStore();
  const [f, setF] = useState({ subject: "employee", employee_code: "", candidate_id: "", package: "standard", vendor_id: "VND-1", note: "" });
  const [error, setError] = useState("");
  const [multi, setMulti] = useState([]);
  const [bulkText, setBulkText] = useState("");
  useEffect(() => {
    if (open) {
      setMulti(preset.employee_code ? [preset.employee_code] : []);
      setBulkText("");
      setF({ subject: preset.candidate_id ? "candidate" : "employee", employee_code: preset.employee_code || "", candidate_id: preset.candidate_id || "", package: preset.package || "standard", vendor_id: "VND-1", note: "" });
      setError("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const vendor = data.bgvVendors.find((v) => v.id === f.vendor_id);
  const pkg = BGV_PACKAGES[f.package];
  const subjCountry = f.subject === "employee" ? data.employees.find((e) => e.employee_code === f.employee_code)?.country_code || "IN" : "IN";
  const pkgChecks = bgvChecksFor(f.package, subjCountry);
  const offers = (k) => BGV_CHECK_DEF[k]?.inhouse || vendor?.checks.includes(k);
  const openFor = new Set(data.bgv.filter((c) => !c.cancelled && !c.closed_status).flatMap((c) => [c.employee_code, c.candidate_id]));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Start background verification · one or many</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={1}>
            {["employee", "candidate"].map((k) => <Button key={k} size="small" variant={f.subject === k ? "contained" : "outlined"} onClick={() => setF({ ...f, subject: k })}>{k === "employee" ? "Employee" : "Candidate"}</Button>)}
          </Stack>
          {f.subject === "employee" ? (
            <Stack spacing={1}>
              {/* v10.7: pick several employees — search by name, or type names / codes separated by commas */}
              <Autocomplete multiple size="small" options={data.employees.filter((e) => e.status !== "rejected")} getOptionLabel={(e) => `${e.full_name} · ${e.employee_code} · ${e.department}`} value={data.employees.filter((e) => multi.includes(e.employee_code))} onChange={(_, v) => setMulti(v.map((e) => e.employee_code))} renderInput={(p) => <TextField {...p} label="Employees * (search by name)" />} />
              <Stack direction="row" spacing={1}>
                <TextField size="small" fullWidth label="Or add names / codes separated by commas" value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="Akhil Reddy, Kartik, EMP009" />
                <Button size="small" variant="outlined" onClick={() => { const toks = bulkText.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean); const found = []; const miss = []; toks.forEach((t) => { const e = data.employees.find((x) => x.employee_code.toLowerCase() === t || x.full_name.toLowerCase() === t) || data.employees.find((x) => x.full_name.toLowerCase().includes(t)); if (e) found.push(e.employee_code); else miss.push(t); }); setMulti([...new Set([...multi, ...found])]); setBulkText(miss.join(", ")); setError(miss.length ? `Not found: ${miss.join(", ")}` : ""); }}>Add</Button>
              </Stack>
              {multi.some((c) => openFor.has(c)) && <Alert severity="warning" sx={{ fontSize: "0.65rem" }}>Already has an open BGV (skipped): {multi.filter((c) => openFor.has(c)).map((c) => data.employees.find((e) => e.employee_code === c)?.full_name).join(", ")}</Alert>}
            </Stack>
          ) : (
            <FormControl size="small"><InputLabel>Candidate *</InputLabel><Select label="Candidate *" value={f.candidate_id} onChange={(e) => setF({ ...f, candidate_id: e.target.value })}>{data.candidates.filter((c) => ["interview", "offer", "hired"].includes(c.stage)).map((c) => <MenuItem key={c.id} value={c.id} disabled={openFor.has(c.id)}>{c.name} · {data.reqs.find((r) => r.id === c.req_id)?.role} · {c.stage}{openFor.has(c.id) ? " (open case)" : ""}</MenuItem>)}</Select></FormControl>
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl size="small" fullWidth><InputLabel>Package</InputLabel><Select label="Package" value={f.package} onChange={(e) => setF({ ...f, package: e.target.value })}>{Object.entries(BGV_PACKAGES).map(([k, p]) => <MenuItem key={k} value={k}>{p.label} · {bgvChecksFor(k, subjCountry).length} checks · {p.tat} days</MenuItem>)}</Select></FormControl>
            <FormControl size="small" fullWidth><InputLabel>Vendor</InputLabel><Select label="Vendor" value={f.vendor_id} onChange={(e) => setF({ ...f, vendor_id: e.target.value })}>{data.bgvVendors.map((v) => <MenuItem key={v.id} value={v.id}>{v.name} · ₹{v.cost[f.package] ?? "—"}</MenuItem>)}</Select></FormControl>
          </Stack>
          <Box>
            <Typography variant="caption" color="text.secondary">Checks in this package</Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.6, mt: 0.5 }}>{pkgChecks.map((k) => <Tag key={k} tone={offers(k) ? "info" : "bad"}>{BGV_CHECK_LABEL[k]}{BGV_CHECK_DEF[k]?.inhouse ? " · in-house" : offers(k) ? "" : " – not offered"}</Tag>)}</Stack>
          </Box>
          <TextField label="Note for the vendor (optional)" multiline minRows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <Alert severity="info" sx={{ fontSize: "0.65rem" }}>The person is asked to e-sign consent first (DPDP Act 2023 / FCRA / GDPR as applicable). Checks start only after consent.</Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => {
          if (f.subject === "employee") {
            const list = multi.filter((c) => !openFor.has(c));
            if (!list.length) return setError("Pick at least one employee without an open BGV.");
            const res = list.map((c) => initiateBgv({ employee_code: c, candidate_id: null, package: f.package, vendor_id: f.vendor_id, note: f.note }));
            const ok = res.filter((r) => r.ok);
            const bad = res.filter((r) => !r.ok);
            if (bad.length) setError(bad.map((r) => r.error).join(" · "));
            if (ok.length) { notifyToast(`Background verification started for ${ok.length} employee(s).`); onStarted?.(ok[0].id); if (!bad.length) onClose(); }
            return undefined;
          }
          const r = initiateBgv({ employee_code: null, candidate_id: f.subject === "candidate" ? f.candidate_id : null, package: f.package, vendor_id: f.vendor_id, note: f.note }); if (!r.ok) return setError(r.error); notifyToast("Verification started; consent request sent."); onStarted?.(r.id); }}>Start & request consent</Button>
      </DialogActions>
    </Dialog>
  );
}

export function BgvCaseDrawer({ id, onClose }) {
  const store = useStore();
  const { data, user, nameOf, logBgvView, closeBgv, reopenBgv, cancelBgv, remindBgv, giveBgvConsent, holdBgv, notifyToast } = store;
  const [hold, setHold] = useState(null);
  const c = id ? data.bgv.find((x) => x.id === id) : null;
  const lvl = c ? bgvAccessLevel(data, user, c) : null;
  const [edit, setEdit] = useState(null);
  const [close, setClose] = useState(null);
  const [cancelDlg, setCancelDlg] = useState(null);
  const ai = useAiRun();
  useEffect(() => {
    if (id) logBgvView(id);
    setEdit(null);
    ai.clear();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return <Drawer anchor="right" open={false} onClose={onClose} />;
  const manage = lvl === "full" && canManageBgv(user);
  const s = subjectOf(data, c);
  const vendor = data.bgvVendors.find((v) => v.id === c.vendor_id);
  const status = bgvStatus(c);
  const caseFacts = () => [
    `Case ${c.id} for ${c.name} (${c.subject_type}); package ${BGV_PACKAGES[c.package].label}; vendor ${vendor?.name}; initiated ${c.initiated_at.slice(0, 10)}; due ${c.due_date}${overdue(c) ? " (OVERDUE)" : ""}`,
    `Consent: ${c.consent?.status}${c.consent?.at ? ` on ${c.consent.at.slice(0, 10)}` : ""}`,
    ...c.checks.map((k) => `${BGV_CHECK_LABEL[k.type]}: ${CHECK_STATUS[k.status].label}${k.remarks ? ` – ${k.remarks}` : ""}${k.docs?.length ? ` (${k.docs.length} document(s))` : ""}`),
    `Overall status: ${BGV_STATUS[status].label}; tracking step: ${CASE_STEPS[Math.max(0, bgvStep(c))][1]}`,
    ...c.checks.map((k) => `${BGV_CHECK_LABEL[k.type]} is at stage "${stageLabel(k.type, checkStage(k))}"${Object.keys(k.details || {}).length ? ` – ${Object.entries(k.details).filter(([, v]) => v).map(([a, v]) => `${a}: ${v}`).join(", ")}` : ""}`),
  ];
  const offlineSummary = () => {
    const disc = c.checks.filter((k) => k.status === "discrepancy");
    const ins = c.checks.filter((k) => k.status === "insufficient");
    const open = c.checks.filter((k) => ["pending", "in_progress"].includes(k.status));
    return [
      `**${c.name} – ${BGV_STATUS[status].label}.** ${c.checks.filter((k) => k.status === "verified").length} of ${c.checks.length} checks verified${overdue(c) ? `; the case is past its due date (${fmtDate(c.due_date)})` : `; due ${fmtDate(c.due_date)}`}.`,
      disc.length ? `- **Risk:** ${disc.map((k) => `${BGV_CHECK_LABEL[k.type]} – ${k.remarks}`).join("; ")}. Ask the person for an explanation and supporting proof before deciding; a gap or date mismatch alone is usually not disqualifying if it is explained.` : "- No discrepancies found so far.",
      ins.length ? `- **Waiting on the person:** ${ins.map((k) => `${BGV_CHECK_LABEL[k.type]} (${k.candidate_note})`).join("; ")}.` : "",
      open.length ? `- **With the vendor:** ${open.map((k) => BGV_CHECK_LABEL[k.type]).join(", ")}.` : "",
      c.consent?.status !== "given" ? "- Consent is not signed yet – no checks can run. Send a reminder." : "",
      `\n**Suggested next step:** ${disc.length ? "Review the discrepancy with the hiring manager and record a decision (Clear with remarks or Discrepancy)." : ins.length ? "Send a reminder for the missing documents." : open.length ? `Follow up with ${vendor?.name} on the open checks.` : "Close the case as Clear."}`,
    ].filter(Boolean).join("\n");
  };
  const offlineEmail = () => {
    const ins = c.checks.filter((k) => k.status === "insufficient");
    return `Subject: Documents needed for your background verification\n\nDear ${c.name.split(" ")[0]},\n\nThank you for completing your consent. To finish your background verification we need the following:\n\n${ins.length ? ins.map((k) => `- **${BGV_CHECK_LABEL[k.type]}:** ${k.candidate_note}`).join("\n") : "- (no documents are pending right now)"}\n\nYou can upload them under **My background check** in PeopleHub. Please share them by ${fmtDate(isoDate(Date.now() + 3 * 86400000))} so we can complete the check on time.\n\nIf you have any questions, reply to this message or post in #hr-help.\n\nRegards,\nHR – Background verification`;
  };
  return (
    <Drawer anchor="right" open={!!c} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 620 } } }}>
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" color="primary"><Mono>{c.id}</Mono> · {c.subject_type === "employee" ? "Employee" : "Candidate"}</Typography>
            <Typography variant="h2" sx={{ fontSize: "1.1rem" }}>{c.name}</Typography>
            <Typography variant="caption" color="text.secondary">{s.sub}{s.dept ? ` · ${s.dept}` : ""}</Typography>
          </Box>
          <BgvChip c={c} />
          <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
        </Stack>
        <Alert icon={<LockRounded fontSize="small" />} severity="info" sx={{ mt: 1.5, fontSize: "0.62rem", py: 0 }}>Your access: <b>{lvl}</b>. This view was recorded in the audit log.</Alert>
        <CaseTracker c={c} sx={{ mt: 1.5 }} />
        {lvl === "status" ? (
          <Box sx={{ mt: 2 }}>
            <KeyVal items={[["Overall status", BGV_STATUS[status].label], ["Due", fmtDate(c.due_date)], ["Progress", `${bgvProgress(c)}%`], ["Consent", c.consent?.status === "given" ? "Signed" : "Pending"]]} />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>Check-level details need summary or full access. Ask the Super Admin or the BGV team for a grant.</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ mt: 2 }}>
              <KeyVal cols={3} items={[["Package", BGV_PACKAGES[c.package].label], ["Vendor", vendor?.name], ["Initiated", `${fmtDate(c.initiated_at)} by ${nameOf(c.initiated_by)}`], ["Due", <span key="d" style={{ color: overdue(c) ? "#b0291f" : undefined, fontWeight: overdue(c) ? 700 : 400 }}>{fmtDate(c.due_date)}{overdue(c) ? " · overdue" : ""}</span>], ["Consent", c.consent?.status === "given" ? `Signed ${fmtDate(c.consent.at)}${c.consent.method ? ` (${c.consent.method})` : ""}` : "Pending"], ["Progress", `${bgvProgress(c)}%`]]} />
              <LinearProgress variant="determinate" value={bgvProgress(c)} sx={{ mt: 1.5, height: 6, borderRadius: 3 }} />
            </Box>
            {lvl === "full" && (
              <Stack direction="row" sx={{ mt: 2, gap: 1, flexWrap: "wrap" }}>
                <AiButton busy={ai.busy} onClick={() => ai.run({ task: "bgv-summary", instruction: "Summarise this background verification case for HR: overall risk, what is pending and with whom, and one recommended next step. Be fair: explain that gaps can have legitimate reasons. Use short bullets.", input: caseFacts().join("\n"), offline: offlineSummary() })}>AI risk summary</AiButton>
                {c.employee_code && !c.closed_status && c.checks.some((k) => k.status === "insufficient") && <AiButton busy={ai.busy} onClick={() => ai.run({ task: "bgv-email", instruction: "Write a short, friendly email to the employee listing exactly which documents are still needed for background verification and where to upload them (My background check in PeopleHub). Include a subject line.", input: caseFacts().join("\n"), offline: offlineEmail() })}>Draft document request</AiButton>}
              </Stack>
            )}
            <AiResult ai={ai} title="AI · background verification" />
            <Typography variant="h3" sx={{ mt: 2.5, mb: 1 }}>Checks</Typography>
            <Stack spacing={1}>
              {c.checks.map((k) => (
                <Box key={k.type} sx={{ p: 1.3, border: "1px solid #e5eae5", borderRadius: 1.5, borderLeft: `3px solid ${TONE_COLOR[CHECK_STATUS[k.status]?.tone] || "#dfe4df"}` }}>
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Box sx={{ flex: 1, minWidth: 180 }}>
                      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{BGV_CHECK_LABEL[k.type]}{BGV_CHECK_DEF[k.type]?.inhouse ? <Typography component="span" sx={{ fontSize: "0.52rem", color: "#78827b", ml: 0.6 }}>in-house</Typography> : null}</Typography>
                      <Box sx={{ mt: 0.4 }}><StageDots k={k} /></Box>
                    </Box>
                    {k.verified_at && <Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{fmtDate(k.verified_at)}</Typography>}
                    <CheckChip s={k.status} />
                    {manage && !c.closed_status && edit !== k.type && <Button size="small" onClick={() => setEdit(k.type)}>Update</Button>}
                  </Stack>
                  {lvl === "full" && k.remarks && <Typography sx={{ fontSize: "0.62rem", color: ["discrepancy", "unable_to_verify"].includes(k.status) ? "#a54e45" : "#5c675f", mt: 0.5 }}>{k.remarks}</Typography>}
                  {lvl === "full" && k.status === "insufficient" && k.candidate_note && <Typography sx={{ fontSize: "0.6rem", color: "#8A5200", mt: 0.3 }}>Asked the person: {k.candidate_note}</Typography>}
                  {lvl === "full" && <CheckDetails k={k} />}
                  {lvl === "full" && (k.docs || []).map((doc, i) => <Button key={i} size="small" startIcon={<AttachFileRounded sx={{ fontSize: 14 }} />} href={doc.data_url || undefined} download={doc.name} disabled={!doc.data_url} sx={{ fontSize: "0.58rem", mt: 0.3 }}>{doc.name} · {timeAgo(doc.at)}</Button>)}
                  {edit === k.type && <CheckEditor c={c} k={k} onDone={() => setEdit(null)} />}
                </Box>
              ))}
            </Stack>
            {manage && (
              <Stack direction="row" sx={{ mt: 2, gap: 1, flexWrap: "wrap" }}>
                {!c.closed_status && <Button variant="contained" startIcon={<VerifiedUserRounded />} onClick={() => setClose({ decision: c.checks.some((k) => k.status === "discrepancy") ? "cleared_with_remarks" : "clear", remarks: "" })}>Close case</Button>}
                {c.closed_status && <Button variant="outlined" onClick={() => { const r = reopenBgv(c.id); notifyToast(r.ok ? "Case reopened." : r.error, r.ok ? "success" : "error"); }}>Reopen</Button>}
                {!c.closed_status && c.employee_code && <Button variant="outlined" startIcon={<NotificationsActiveRounded />} onClick={() => { const r = remindBgv(c.id); notifyToast(r.ok ? "Reminder sent." : r.error, r.ok ? "success" : "error"); }}>Send reminder</Button>}
                {!c.closed_status && c.consent?.status === "given" && (c.on_hold
                  ? <Button variant="outlined" startIcon={<PlayCircleRounded />} onClick={() => { const r = holdBgv(c.id, false); notifyToast(r.ok ? "Case resumed." : r.error, r.ok ? "success" : "error"); }}>Resume</Button>
                  : <Button variant="outlined" color="warning" startIcon={<PauseCircleRounded />} onClick={() => setHold("")}>Put on hold</Button>)}
                {!c.closed_status && c.consent?.status !== "given" && <Button variant="outlined" onClick={() => { const r = giveBgvConsent(c.id); notifyToast(r.ok ? "Paper consent recorded." : r.error, r.ok ? "success" : "error"); }}>Record paper consent</Button>}
                {!c.closed_status && <Button color="error" onClick={() => setCancelDlg("")}>Cancel case</Button>}
              </Stack>
            )}
            {lvl === "full" && (
              <>
                <Typography variant="h3" sx={{ mt: 2.5, mb: 1 }}>Timeline</Typography>
                <Stack spacing={0.6}>
                  {[...c.history].reverse().map((h, i) => (
                    <Stack key={i} direction="row" spacing={1}>
                      <Typography sx={{ fontSize: "0.58rem", color: "#78827b", minWidth: 120 }}>{fmtDateTime(h.at)}</Typography>
                      <Typography sx={{ fontSize: "0.62rem" }}>{h.action} <span style={{ color: "#78827b" }}>· {h.by === "CANDIDATE" ? "candidate" : nameOf(h.by)}</span></Typography>
                    </Stack>
                  ))}
                </Stack>
                {c.remarks && <Alert severity="info" sx={{ mt: 1.5, fontSize: "0.62rem" }}>{c.remarks}</Alert>}
              </>
            )}
          </>
        )}
      </Box>
      <Dialog open={!!close} onClose={() => setClose(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Close verification</DialogTitle>
        <DialogContent>
          {close && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <FormControl size="small"><InputLabel>Decision</InputLabel><Select label="Decision" value={close.decision} onChange={(e) => setClose({ ...close, decision: e.target.value })}><MenuItem value="clear">Clear</MenuItem><MenuItem value="cleared_with_remarks">Clear with remarks (accepted)</MenuItem><MenuItem value="discrepancy">Discrepancy (not accepted)</MenuItem></Select></FormControl>
              <TextField label="Remarks" multiline minRows={3} value={close.remarks} onChange={(e) => setClose({ ...close, remarks: e.target.value })} helperText="Required unless Clear. Shown to HR and the Super Admin only." />
              <Alert severity="info" sx={{ fontSize: "0.62rem" }}>Closing updates the employee master (Background check = {close.decision === "discrepancy" ? "Flagged" : "Clear"}), ticks the onboarding KYC task and notifies the employee and manager.</Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setClose(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { const r = closeBgv(c.id, close.decision, close.remarks); if (!r.ok) return notifyToast(r.error, "error"); setClose(null); notifyToast("Case closed."); }}>Close case</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog open={hold != null} title="Put verification on hold" text="Tracking pauses and the case shows as On hold until you resume it (for example, the person is on leave or the joining date moved)." confirmLabel="Put on hold" disabled={!String(hold || "").trim()} onClose={() => setHold(null)} onConfirm={() => { const r = holdBgv(c.id, true, hold); notifyToast(r.ok ? "Case on hold." : r.error, r.ok ? "success" : "error"); if (r.ok) setHold(null); }}>
        <TextField fullWidth label="Reason *" value={hold || ""} onChange={(e) => setHold(e.target.value)} />
      </ConfirmDialog>
      <ConfirmDialog open={cancelDlg != null} title="Cancel verification" text="The case is kept for the audit trail but no further checks run." confirmLabel="Cancel case" tone="error" disabled={!String(cancelDlg || "").trim()} onClose={() => setCancelDlg(null)} onConfirm={() => { const r = cancelBgv(c.id, cancelDlg); notifyToast(r.ok ? "Case cancelled." : r.error, r.ok ? "success" : "error"); if (r.ok) { setCancelDlg(null); onClose(); } }}>
        <TextField fullWidth label="Reason *" value={cancelDlg || ""} onChange={(e) => setCancelDlg(e.target.value)} />
      </ConfirmDialog>
    </Drawer>
  );
}

/** Every case against every check: where each check stands, so HR can work one check type across all cases. */
function BgvTracker() {
  const { data, user } = useStore();
  const [type, setType] = useState("");
  const [closed, setClosed] = useState(false);
  const [open, setOpen] = useState(null);
  const cases = data.bgv.filter((c) => !c.cancelled && bgvAccessLevel(data, user, c) && bgvAccessLevel(data, user, c) !== "status" && (closed || !c.closed_status));
  const types = BGV_CHECKS.map(([t]) => t).filter((t) => cases.some((c) => c.checks.some((k) => k.type === t)));
  const cols = type ? [type] : types;
  const summary = types.map((t) => {
    const ks = cases.flatMap((c) => c.checks.filter((k) => k.type === t));
    const by = (s) => ks.filter((k) => k.status === s).length;
    return { t, total: ks.length, done: ks.filter((k) => CHECK_DONE.includes(k.status)).length, insufficient: by("insufficient"), discrepancy: by("discrepancy") + by("unable_to_verify") };
  });
  const stageCounts = type ? stagesOf(type).map(([s, l]) => [l, cases.flatMap((c) => c.checks.filter((k) => k.type === type && checkStage(k) === s)).length]) : [];
  return (
    <Stack spacing={2.5}>
      <Grid min={150}>
        {summary.map((x) => (
          <Box key={x.t} onClick={() => setType(type === x.t ? "" : x.t)} sx={{ p: 1.3, border: `1px solid ${type === x.t ? "#1f5f99" : "#e5eae5"}`, borderRadius: 1.5, cursor: "pointer", bgcolor: type === x.t ? "#f1f6fb" : "#fff" }}>
            <Typography sx={{ fontSize: "0.62rem", fontWeight: 700 }}>{BGV_CHECK_LABEL[x.t].split(" (")[0]}</Typography>
            <Typography sx={{ fontSize: "1rem", fontWeight: 800 }}>{x.done}/{x.total}</Typography>
            <Typography sx={{ fontSize: "0.54rem", color: "#78827b" }}>done{x.insufficient ? ` · ${x.insufficient} insufficient` : ""}{x.discrepancy ? ` · ${x.discrepancy} flagged` : ""}</Typography>
          </Box>
        ))}
      </Grid>
      {type && (
        <SectionCard title={`${BGV_CHECK_LABEL[type]} · by stage`} subtitle="How many open checks sit at each step">
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            {stageCounts.map(([l, n], i) => <Box key={l} sx={{ px: 1.4, py: 0.8, borderRadius: 1.5, bgcolor: n ? "#eef4fa" : "#f5f7f5", minWidth: 110 }}><Typography sx={{ fontSize: "0.54rem", color: "#78827b" }}>{i + 1}. {l}</Typography><Typography sx={{ fontSize: "0.95rem", fontWeight: 800 }}>{n}</Typography></Box>)}
          </Stack>
        </SectionCard>
      )}
      <SectionCard title="Check tracker" subtitle="Each cell shows the check's outcome and the step it is on. Click a row to open the case." action={<FormControlLabel control={<Checkbox size="small" checked={closed} onChange={(e) => setClosed(e.target.checked)} />} label={<Typography sx={{ fontSize: "0.62rem" }}>Include closed cases</Typography>} />} noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 240 + cols.length * 150 }}>
            <TableHead><TableRow><TableCell>Case</TableCell><TableCell>Overall</TableCell>{cols.map((t) => <TableCell key={t}>{BGV_CHECK_LABEL[t].split(" (")[0]}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={c.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(c.id)}>
                  <TableCell><PersonCell name={c.name} sub={`${c.id} · due ${fmtDate(c.due_date)}`} /></TableCell>
                  <TableCell><BgvChip c={c} /><Typography sx={{ fontSize: "0.54rem", color: "#78827b", mt: 0.3 }}>{CASE_STEPS[Math.max(0, bgvStep(c))][1]}</Typography></TableCell>
                  {cols.map((t) => {
                    const k = c.checks.find((x) => x.type === t);
                    return <TableCell key={t}>{k ? <Stack spacing={0.4}><CheckChip s={k.status} /><StageDots k={k} /></Stack> : <Typography sx={{ fontSize: "0.58rem", color: "#b5bcb6" }}>—</Typography>}</TableCell>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
        {!cases.length && <EmptyState title="No open cases" text="Tick “Include closed cases” to see finished ones." />}
      </SectionCard>
      <BgvCaseDrawer id={open} onClose={() => setOpen(null)} />
    </Stack>
  );
}

function BgvVendors() {
  const { data } = useStore();
  return (
    <Stack spacing={2.5}>
      <SectionCard title="Vendors" subtitle="Turnaround, SLA and cost per package (demo values – replace with your contracts)" noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead><TableRow><TableCell>Vendor</TableCell><TableCell>Checks offered</TableCell><TableCell align="right">TAT</TableCell><TableCell align="right">SLA met</TableCell><TableCell align="right">Open cases</TableCell>{Object.values(BGV_PACKAGES).map((p) => <TableCell key={p.label} align="right">{p.label}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {data.bgvVendors.map((v) => (
                <TableRow key={v.id}>
                  <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{v.name}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{v.contact}</Typography></TableCell>
                  <TableCell><Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.4 }}>{v.checks.map((k) => <Tag key={k}>{BGV_CHECK_LABEL[k].split(" (")[0]}</Tag>)}</Stack></TableCell>
                  <TableCell align="right">{v.tat_days} d</TableCell>
                  <TableCell align="right">{v.sla_pct}%</TableCell>
                  <TableCell align="right">{data.bgv.filter((c) => c.vendor_id === v.id && !c.closed_status && !c.cancelled).length}</TableCell>
                  {Object.keys(BGV_PACKAGES).map((k) => <TableCell key={k} align="right">{v.cost[k] ? `₹${v.cost[k].toLocaleString("en-IN")}` : "—"}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <SectionCard title="Packages">
        <Grid min={220}>
          {Object.entries(BGV_PACKAGES).map(([k, p]) => (
            <Box key={k} sx={{ p: 1.5, border: "1px solid #e5eae5", borderRadius: 1.5 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "0.78rem" }}>{p.label}</Typography>
              <Typography sx={{ fontSize: "0.6rem", color: "#78827b", mb: 0.8 }}>{p.tat} working days · {p.checks.length} checks</Typography>
              {p.checks.map((c) => <Typography key={c} sx={{ fontSize: "0.62rem" }}>• {BGV_CHECK_LABEL[c]}{BGV_CHECK_DEF[c]?.inhouse ? " (in-house HR)" : ""}{BGV_CHECK_DEF[c]?.countries ? ` – ${BGV_CHECK_DEF[c].countries.join(", ")} only` : ""}</Typography>)}
            </Box>
          ))}
        </Grid>
      </SectionCard>
    </Stack>
  );
}

const LEVEL_TEXT = { status: "Status only", summary: "Summary (check statuses, no remarks or documents)", full: "Full (remarks, documents, timeline)" };
function BgvAccessPanel() {
  const { data, user, nameOf, grantBgvAccess, revokeBgvAccess, notifyToast } = useStore();
  const [dlg, setDlg] = useState(null);
  const [error, setError] = useState("");
  const canGrant = user.role === "superadmin" || canManageBgv(user);
  const people = directory(data).filter((p) => p.kind !== "super");
  const log = data.audit.filter((a) => a.action.startsWith("BGV_VIEW") || a.action.startsWith("BGV_ACCESS")).slice(0, 40);
  return (
    <Stack spacing={2.5}>
      <SectionCard title="Who can see what" subtitle="Default rules – grants below add to these">
        <Table size="small">
          <TableHead><TableRow><TableCell>Who</TableCell><TableCell>Sees</TableCell></TableRow></TableHead>
          <TableBody>
            {[
              ["Super Admin", "Full access to every case; grants full access to others"],
              ["Admins with the Background verification module", "Full access; start, update and close cases; grant status / summary access"],
              ["Recruitment admins", "Status of candidate checks (to time offers)"],
              ["Onboarding admins", "Status of new joiners' checks"],
              ["Reporting managers", "Status of their direct reports (Team BGV status)"],
              ["Hiring managers", "Status of candidates for their requisitions"],
              ["Employees", "Their own case: consent, checks, what to upload (no internal remarks)"],
              ["Everyone else", "Nothing. BGV is hidden from the directory and profiles"],
            ].map(([a, b]) => <TableRow key={a}><TableCell sx={{ fontWeight: 600 }}>{a}</TableCell><TableCell>{b}</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </SectionCard>
      <SectionCard title="Access grants" subtitle="Time-bound, with a recorded reason" action={canGrant && <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => { setDlg({ code: "", level: "summary", scope: "team", expires_on: isoDate(Date.now() + 90 * 86400000), reason: "" }); setError(""); }}>Grant access</Button>} noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead><TableRow><TableCell>Person</TableCell><TableCell>Level</TableCell><TableCell>Scope</TableCell><TableCell>Reason</TableCell><TableCell>Granted</TableCell><TableCell>Expires</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {data.bgvAccess.map((g) => {
                const expired = g.expires_on && g.expires_on < isoDate();
                return (
                  <TableRow key={g.id} sx={{ opacity: g.revoked || expired ? 0.55 : 1 }}>
                    <TableCell><PersonCell name={nameOf(g.code)} sub={g.code} /></TableCell>
                    <TableCell><Tag tone={g.level === "full" ? "bad" : g.level === "summary" ? "info" : "neutral"}>{g.level}</Tag></TableCell>
                    <TableCell>{g.scope === "all" ? "All cases" : g.scope === "team" ? "Their team" : g.scope}</TableCell>
                    <TableCell sx={{ maxWidth: 260 }}><Typography sx={{ fontSize: "0.62rem" }}>{g.reason}</Typography></TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(g.granted_at)} · {nameOf(g.granted_by)}</TableCell>
                    <TableCell>{g.revoked ? <Tag>Revoked</Tag> : expired ? <Tag tone="warn">Expired</Tag> : g.expires_on ? fmtDate(g.expires_on) : "No expiry"}</TableCell>
                    <TableCell>{canGrant && !g.revoked && <Button size="small" color="error" onClick={() => { const r = revokeBgvAccess(g.id); notifyToast(r.ok ? "Access revoked." : r.error, r.ok ? "success" : "error"); }}>Revoke</Button>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <SectionCard title="Access log" subtitle="Every case view and permission change (latest 40)" noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 700 }}>
            <TableHead><TableRow><TableCell>When</TableCell><TableCell>Who</TableCell><TableCell>Action</TableCell><TableCell>Details</TableCell></TableRow></TableHead>
            <TableBody>{log.map((a) => <TableRow key={a.log_id}><TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDateTime(a.timestamp)}</TableCell><TableCell>{nameOf(a.user_code)}</TableCell><TableCell><Mono>{a.action}</Mono></TableCell><TableCell sx={{ fontSize: "0.62rem" }}>{a.details}</TableCell></TableRow>)}</TableBody>
          </Table>
        </TableWrap>
        {!log.length && <EmptyState title="No access yet" text="Opening a case writes an entry here." />}
      </SectionCard>
      <Dialog open={!!dlg} onClose={() => setDlg(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Grant BGV access</DialogTitle>
        <DialogContent>
          {dlg && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <FormControl size="small"><InputLabel>Person *</InputLabel><Select label="Person *" value={dlg.code} onChange={(e) => setDlg({ ...dlg, code: e.target.value })}>{people.map((p) => <MenuItem key={p.code} value={p.code}>{p.name} · {p.title}</MenuItem>)}</Select></FormControl>
              <FormControl size="small"><InputLabel>Level</InputLabel><Select label="Level" value={dlg.level} onChange={(e) => setDlg({ ...dlg, level: e.target.value })}>{Object.entries(LEVEL_TEXT).map(([k, v]) => <MenuItem key={k} value={k} disabled={k === "full" && user.role !== "superadmin"}>{v}{k === "full" && user.role !== "superadmin" ? " – Super Admin only" : ""}</MenuItem>)}</Select></FormControl>
              <FormControl size="small"><InputLabel>Scope</InputLabel><Select label="Scope" value={dlg.scope} onChange={(e) => setDlg({ ...dlg, scope: e.target.value })}><MenuItem value="team">Their direct reports</MenuItem><MenuItem value="all">All cases</MenuItem>{data.bgv.filter((c) => !c.cancelled).map((c) => <MenuItem key={c.id} value={c.id}>One case · {c.id} · {c.name}</MenuItem>)}</Select></FormControl>
              <TextField size="small" type="date" label="Expires on" value={dlg.expires_on} onChange={(e) => setDlg({ ...dlg, expires_on: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="Reason *" multiline minRows={2} value={dlg.reason} onChange={(e) => setDlg({ ...dlg, reason: e.target.value })} helperText="Recorded in the access register and the audit log." />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setDlg(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { const r = grantBgvAccess(dlg); if (!r.ok) return setError(r.error); setDlg(null); notifyToast("Access granted."); }}>Grant</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

// ── Employee: My background check ─────────────────────
/** Plain-language next step for the person on one check (never shows internal remarks). */
function selfAction(k) {
  const d = k.details || {};
  const stage = checkStage(k);
  if (k.status === "insufficient") return k.candidate_note;
  if (["discrepancy", "unable_to_verify"].includes(k.status)) return "HR will contact you about this check.";
  if (k.status === "verified") return "Nothing – verified.";
  if (k.status === "na") return "Not needed for you.";
  if (k.type === "pf" && !d.uan) return "Share your 12-digit UAN with HR (it is on your payslip or the EPFO member portal).";
  if (k.type === "address" && ["visit_scheduled"].includes(stage) && d.visit_date) return `${d.method === "digital" ? "Complete the geo-tagged address check in the link sent to you" : "A field agent will visit"} on ${fmtDate(d.visit_date)}. Please make sure someone is at home with ID.`;
  if (k.type === "address" && stage === "agent_assigned") return "A field agent has been assigned and will call you to fix a visit time.";
  if (k.type === "company_email" && ["email_sent", "reminder_sent"].includes(stage)) return "We have written to your previous employer's HR. You may nudge them to reply.";
  if (k.type === "documents" && stage === "awaiting_docs") return "Upload your ID, degree, relieving letter and last 3 payslips here.";
  if (k.type === "documents" && stage === "originals_seen") return "Originals seen – thank you.";
  return "Nothing right now.";
}

export function MyBgvPage() {
  const { data, user, giveBgvConsent, uploadBgvDoc, notifyToast } = useStore();
  const c = bgvFor(data, user.employee_code);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  if (!c) return (<><PageHeader eyebrow="ME · BACKGROUND CHECK" title="My background check" /><EmptyState title="No background check" text="HR has not started a background verification for you." /></>);
  const status = bgvStatus(c);
  const upload = async (type, file) => {
    if (!file) return;
    const r = uploadBgvDoc(c.id, type, { name: file.name, size: file.size, type: file.type, data_url: await readFileAsDataUrl(file) });
    notifyToast(r.ok ? `${file.name} uploaded. HR has been notified.` : r.error, r.ok ? "success" : "error");
  };
  return (
    <>
      <PageHeader eyebrow="ME · BACKGROUND CHECK" title="My background check" subtitle="See the status of each check, give consent and upload anything HR asks for. Internal remarks from the verification vendor are not shown here." />
      <Stack spacing={2.5}>
        <Grid min={160}>
          <StatCard label="Status" value={<BgvChip c={c} sx={{ height: 26, fontSize: "0.8rem" }} />} hint={`Case ${c.id}`} />
          <StatCard label="Progress" value={`${bgvProgress(c)}%`} hint={`${c.checks.filter((k) => CHECK_DONE.includes(k.status)).length} of ${c.checks.length} checks done`} tone="info" />
          <StatCard label="Expected by" value={fmtDate(c.due_date)} tone="neutral" hint={`${BGV_PACKAGES[c.package].label} package`} />
          <StatCard label="Action needed" value={c.consent?.status !== "given" ? "Consent" : c.checks.filter((k) => k.status === "insufficient").length || "None"} tone={c.consent?.status !== "given" || c.checks.some((k) => k.status === "insufficient") ? "warn" : "good"} />
        </Grid>
        <CaseTracker c={c} />
        {c.consent?.status !== "given" && (
          <SectionCard title="Consent for background verification" subtitle="Required before any check can start">
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              I authorise {data.settings?.company_name || "the company"} and its verification partner ({data.bgvVendors.find((v) => v.id === c.vendor_id)?.name}) to verify the information I have provided — {c.checks.map((k) => BGV_CHECK_LABEL[k.type].toLowerCase()).join(", ")} — by contacting the relevant institutions, employers, authorities and references. My data will be used only for this purpose, kept for the retention period in the company's privacy notice, and I can ask for a copy of the report.
            </Typography>
            <FormControlLabel control={<Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} />} label={<Typography variant="body2">I have read and agree to the above.</Typography>} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 1, alignItems: { sm: "center" } }}>
              <TextField size="small" label={`Type your full name (${c.name}) to e-sign`} value={name} onChange={(e) => setName(e.target.value)} sx={{ minWidth: 300 }} />
              <Button variant="contained" disabled={!agree || !name} onClick={() => { const r = giveBgvConsent(c.id, name); notifyToast(r.ok ? "Consent signed. Your checks have started." : r.error, r.ok ? "success" : "error"); }}>E-sign consent</Button>
            </Stack>
          </SectionCard>
        )}
        <SectionCard title="Checks" noPad>
          <Table size="small">
            <TableHead><TableRow><TableCell>Check</TableCell><TableCell>Where it is</TableCell><TableCell>Status</TableCell><TableCell>What you need to do</TableCell><TableCell>Your documents</TableCell></TableRow></TableHead>
            <TableBody>
              {c.checks.map((k) => (
                <TableRow key={k.type}>
                  <TableCell sx={{ fontWeight: 600 }}>{BGV_CHECK_LABEL[k.type]}</TableCell>
                  <TableCell><StageDots k={k} /></TableCell>
                  <TableCell><CheckChip s={k.status} /></TableCell>
                  <TableCell sx={{ maxWidth: 320 }}><Typography sx={{ fontSize: "0.65rem", color: k.status === "insufficient" ? "#8A5200" : "#5c675f" }}>{selfAction(k)}</Typography></TableCell>
                  <TableCell>
                    <Stack spacing={0.3}>
                      {(k.docs || []).filter((dd) => dd.by === user.code).map((dd, i) => <Typography key={i} sx={{ fontSize: "0.58rem" }}>📎 {dd.name}</Typography>)}
                      {["insufficient", "pending", "in_progress"].includes(k.status) && c.consent?.status === "given" && (
                        <Button size="small" component="label" startIcon={<UploadFileRounded />} variant={k.status === "insufficient" ? "contained" : "text"} sx={{ alignSelf: "flex-start" }}>
                          Upload
                          <input hidden type="file" accept="application/pdf,image/*" onChange={(e) => upload(k.type, e.target.files?.[0])} />
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
        <Alert severity="info" sx={{ fontSize: "0.65rem" }}>Questions? Post in #hr-help in Chat or raise an HR support ticket. You can ask HR for a copy of your verification report once it is complete.</Alert>
      </Stack>
    </>
  );
}

// ── Manager: Team BGV status ──────────────────────────
export function TeamBgvPage() {
  const { data, user, reportsOf } = useStore();
  const [open, setOpen] = useState(null);
  const team = reportsOf(user.employee_code).filter((e) => e.status !== "rejected");
  const myReqs = data.reqs.filter((r) => r.hiring_manager === user.employee_code).map((r) => r.id);
  const cands = data.bgv.filter((c) => c.candidate_id && !c.cancelled && myReqs.includes(data.candidates.find((k) => k.id === c.candidate_id)?.req_id));
  return (
    <>
      <PageHeader eyebrow="MY TEAM · BACKGROUND VERIFICATION" title="Team BGV status" subtitle="Background verification status for your direct reports and candidates for your open roles. Details beyond status need a grant from HR." />
      <SectionCard title="Direct reports" noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 680 }}>
            <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Joined</TableCell><TableCell>Status</TableCell><TableCell>Progress</TableCell><TableCell>Your access</TableCell></TableRow></TableHead>
            <TableBody>
              {team.map((e) => {
                const c = bgvFor(data, e.employee_code);
                const lvl = c && bgvAccessLevel(data, user, c);
                return (
                  <TableRow key={e.employee_code} hover sx={{ cursor: c ? "pointer" : "default" }} onClick={() => c && setOpen(c.id)}>
                    <TableCell><PersonCell name={e.full_name} sub={`${e.employee_code} · ${e.designation}`} /></TableCell>
                    <TableCell>{fmtDate(e.date_of_joining)}</TableCell>
                    <TableCell>{c ? <BgvChip c={c} /> : <Tag>Not started</Tag>}</TableCell>
                    <TableCell>{c && lvl !== "status" ? `${bgvProgress(c)}%` : c ? "—" : ""}</TableCell>
                    <TableCell>{lvl ? <Tag tone={lvl === "summary" ? "info" : "neutral"}>{lvl}</Tag> : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      {cands.length > 0 && (
        <SectionCard title="Candidates for your roles" sx={{ mt: 2.5 }} noPad>
          <Table size="small">
            <TableBody>{cands.map((c) => <TableRow key={c.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(c.id)}><TableCell><PersonCell name={c.name} sub={subjectOf(data, c).sub} /></TableCell><TableCell><BgvChip c={c} /></TableCell><TableCell>Due {fmtDate(c.due_date)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </SectionCard>
      )}
      <BgvCaseDrawer id={open} onClose={() => setOpen(null)} />
    </>
  );
}

// ── Small pieces used on employee screens ─────────────
/** BGV status for a person, respecting access (returns null when the viewer may not see it). */
export function useBgvLookup() {
  const { data, user } = useStore();
  return useMemo(() => {
    const map = {};
    for (const c of data.bgv || []) {
      if (!c.employee_code || c.cancelled) continue;
      const cur = map[c.employee_code];
      if (!cur || c.initiated_at > cur.initiated_at) map[c.employee_code] = c;
    }
    return (code) => {
      const c = map[code];
      if (!c) return null;
      return bgvAccessLevel(data, user, c) ? c : null;
    };
  }, [data, user]);
}

export function ProfileBgvCard({ onOpen }) {
  const { data, user } = useStore();
  const c = bgvFor(data, user.employee_code);
  if (!c) return null;
  const st = bgvStatus(c);
  const needs = c.consent?.status !== "given" || c.checks.some((k) => k.status === "insufficient");
  return (
    <SectionCard title="Background verification" subtitle={`Case ${c.id} · ${BGV_PACKAGES[c.package].label}`} action={<Button size="small" variant={needs ? "contained" : "outlined"} onClick={onOpen}>{needs ? "Action needed" : "View"}</Button>}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
        <BgvChip c={c} />
        <Box sx={{ flex: 1 }}><LinearProgress variant="determinate" value={bgvProgress(c)} sx={{ height: 6, borderRadius: 3 }} /></Box>
        <Typography variant="caption">{bgvProgress(c)}%</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>{["clear", "cleared_with_remarks"].includes(st) ? `Completed ${fmtDate(c.closed_at)}.` : `Expected by ${fmtDate(c.due_date)}.`}</Typography>
    </SectionCard>
  );
}
