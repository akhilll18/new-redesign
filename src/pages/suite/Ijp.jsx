// v10.4 · IJP — internal job postings and internal moves.
//  • Employees: browse open internal and client-project postings; apply for a move or a position upgrade
//    (or raise an upgrade request without a posting); raise a relocation request to a client site or an internal
//    company location; follow and withdraw their requests.
//  • HR (recruitment / onboarding / accounts modules) and the Super Admin: publish and close postings, shortlist,
//    select or reject applications, approve or reject relocation requests. The manager is told at every step.
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Tab, Table, Tooltip, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { AddRounded, WorkRounded, FlightTakeoffRounded, BusinessRounded, PlaceRounded, TrendingUpRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, TableWrap, EmptyState, Tag, Mono, PersonCell } from "../../components/kit/UI.jsx";
import { fmtDate, isoDate } from "../../lib/utils.js";
import { tabSx } from "../../components/suite/Hub.jsx";

const at = (d) => isoDate(new Date(Date.now() + d * 86400000));
export const IJP_SEED = () => ({
  postings: [
    { id: "IJP-001", title: "Senior Backend Engineer", type: "internal", dept: "Engineering", client_id: null, location: "Hyderabad – HITEC City", grade: "L4", openings: 1, skills: "Node.js, PostgreSQL, AWS", description: "Own the payroll engine services; mentor two engineers.", posted_at: at(-6), closes: at(14), status: "open", posted_by: "ADM01" },
    { id: "IJP-002", title: "Payroll implementation lead – Acme Logistics", type: "project", dept: "Operations", client_id: "CL-1", location: "Client site · Hyderabad", grade: "L3", openings: 1, skills: "Payroll, statutory compliance, client handling", description: "Lead the 850-employee payroll go-live for Acme Logistics (6-month project).", posted_at: at(-3), closes: at(18), status: "open", posted_by: "ADM01" },
    { id: "IJP-003", title: "Go-live support lead – Kalahari Mining", type: "project", dept: "Operations", client_id: "CL-4", location: "Client site · Windhoek, Namibia", grade: "L3", openings: 2, skills: "Support, Namibia PAYE / SSC, travel", description: "On-site hypercare for the Namibia payroll go-live (3 months, relocation supported).", posted_at: at(-2), closes: at(21), status: "open", posted_by: "ADM01" },
    { id: "IJP-004", title: "Team Lead, Customer Support", type: "internal", dept: "Operations", client_id: null, location: "Bengaluru", grade: "M1", openings: 1, skills: "People leadership, SLAs, Zendesk", description: "Lead a team of 8 support associates; first-line manager role.", posted_at: at(-9), closes: at(5), status: "open", posted_by: "ADM01" },
    { id: "IJP-005", title: "Data Analyst II", type: "internal", dept: "Data Migration", client_id: null, location: "Remote · India", grade: "L3", openings: 1, skills: "SQL, Power BI, data quality", description: "Migration reconciliation and dashboards.", posted_at: at(-20), closes: at(-2), status: "closed", posted_by: "ADM01" },
  ],
  applications: [],
  moves: [],
});

const APP_TONE = { submitted: "info", shortlisted: "warn", selected: "good", rejected: "bad", withdrawn: "neutral" };
const MOVE_TONE = { submitted: "info", approved: "good", rejected: "bad", withdrawn: "neutral" };
const label = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

export const ijpOf = (data) => data.suite?.ijp || IJP_SEED();
function useIjp() {
  const { data } = useStore();
  return ijpOf(data);
}
const ensure = (s) => {
  if (!s.ijp) s.ijp = IJP_SEED();
  return s.ijp;
};
function hrAdmins(data) {
  return (data.admins || []).filter((a) => a.status === "active" && (a.modules || []).some((m) => ["recruitment", "onboarding", "accounts"].includes(m))).map((a) => a.admin_code);
}
function destinations(data) {
  const internal = (data.workLocations || []).map((l) => ({ key: `L:${l.location_id}`, type: "internal", label: `${l.name} · ${l.city}, ${l.country}` }));
  const client = (data.clients || []).map((c) => ({ key: `C:${c.id}`, type: "client", label: `${c.company} · ${c.city}` }));
  return { internal, client };
}

// ─────────────────────────── Employee: postings & applications ───────────────────────────
export function MyIjp() {
  const { data, user, suiteDo, notifyToast, nameOf } = useStore();
  const ijp = useIjp();
  const me = data.employees.find((e) => e.employee_code === user.employee_code);
  const [filter, setFilter] = useState("all");
  const [apply, setApply] = useState(null);
  const mine = ijp.applications.filter((a) => a.employee_code === me?.employee_code).sort((a, b) => b.at.localeCompare(a.at));
  const open = ijp.postings.filter((p) => p.status === "open" && (filter === "all" || p.type === filter));
  const clientName = (id) => (data.clients || []).find((c) => c.id === id)?.company;

  function withdraw(id) {
    const r = suiteDo("ijp-self", (s, { me: code, now }) => {
      const a = ensure(s).applications.find((x) => x.id === id && x.employee_code === code);
      if (!a || !["submitted", "shortlisted"].includes(a.status)) return { ok: false, error: "This application can no longer be withdrawn." };
      a.status = "withdrawn";
      a.history.push({ status: "withdrawn", at: now, by: code });
      return { id };
    }, { action: "IJP_WITHDRAW", details: () => id });
    notifyToast(r.ok ? `Application ${id} withdrawn.` : r.error, r.ok ? "info" : "error");
  }

  return (
    <>
      <PageHeader eyebrow="IJP · INTERNAL JOB POSTINGS" title="Internal job postings" subtitle="Apply for an internal role or a client project. Each posting shows its criteria (tenure, relocation, CV, awards & recognition, location); your manager is told, and HR shortlists and decides." />
      <Stack spacing={2.5}>
        <Grid min={160}>
          <StatCard label="Open postings" value={ijp.postings.filter((p) => p.status === "open").length} hint="Internal and project roles" onClick={() => setFilter("all")} />
          <StatCard label="Client projects" value={ijp.postings.filter((p) => p.status === "open" && p.type === "project").length} tone="info" onClick={() => setFilter("project")} />
          <StatCard label="My applications" value={mine.filter((a) => !["withdrawn", "rejected"].includes(a.status)).length} tone="warn" />
          <StatCard label="Selected" value={mine.filter((a) => a.status === "selected").length} tone="good" />
        </Grid>
        <SectionCard title="Open postings" action={
          <ToggleButtonGroup exclusive size="small" value={filter} onChange={(_, v) => v && setFilter(v)}>
            <ToggleButton value="all" sx={{ fontSize: "0.6rem" }}>All</ToggleButton>
            <ToggleButton value="internal" sx={{ fontSize: "0.6rem" }}>Internal</ToggleButton>
            <ToggleButton value="project" sx={{ fontSize: "0.6rem" }}>Client projects</ToggleButton>
          </ToggleButtonGroup>
        } noPad>
          {open.length === 0 ? <Box sx={{ p: 2.5 }}><EmptyState title="No open postings" text="New internal roles and client projects appear here." /></Box> : open.map((p) => {
            const applied = mine.find((a) => a.posting_id === p.id && !["withdrawn", "rejected"].includes(a.status));
            return (
              <Stack key={p.id} direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ px: 2, py: 1.6, borderBottom: "1px solid #f0f2ef", alignItems: { sm: "center" } }}>
                <Box sx={{ width: 38, height: 38, borderRadius: 1.5, display: "grid", placeItems: "center", flexShrink: 0, background: p.type === "project" ? "#fff4e5" : "#e6f7f2", color: p.type === "project" ? "#b26a00" : "#0B8C8C" }}>{p.type === "project" ? <BusinessRounded sx={{ fontSize: 19 }} /> : <WorkRounded sx={{ fontSize: 19 }} />}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                    <Typography sx={{ fontSize: "0.76rem", fontWeight: 700 }}>{p.title}</Typography>
                    <Tag tone={p.type === "project" ? "warn" : "info"}>{p.type === "project" ? `Project · ${clientName(p.client_id) || "client"}` : "Internal"}</Tag>
                    <Tag>{p.grade}</Tag>
                  </Stack>
                  <Typography sx={{ fontSize: "0.62rem", color: "#78827b", mt: 0.3 }}>{p.dept} · {p.location} · {p.openings} opening{p.openings > 1 ? "s" : ""} · closes {fmtDate(p.closes)} · <Mono>{p.id}</Mono></Typography>
                  <Typography sx={{ fontSize: "0.64rem", mt: 0.4 }}>{p.description} <Box component="span" sx={{ color: "#78827b" }}>Skills: {p.skills}</Box></Typography>
                </Box>
                <CriteriaChips p={p} me={me} data={data} />
                {applied ? <Tag tone={APP_TONE[applied.status]}>{label(applied.status)}</Tag> : (
                  <Button size="small" variant="contained" disabled={!criteriaCheck(p, me, data).hardOk} onClick={() => setApply({ posting: p, kind: "move" })}>Apply</Button>
                )}
              </Stack>
            );
          })}
        </SectionCard>
        <SectionCard title="My applications" noPad>
          {mine.length === 0 ? <Box sx={{ p: 2.5 }}><EmptyState title="Nothing yet" text="Apply for an open posting." /></Box> : (
            <TableWrap>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead><TableRow><TableCell>Request</TableCell><TableCell>Role</TableCell><TableCell>Type</TableCell><TableCell>Raised</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>
                  {mine.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell><Mono>{a.id}</Mono></TableCell>
                      <TableCell>{a.posting_id ? ijp.postings.find((p) => p.id === a.posting_id)?.title : a.desired_role}</TableCell>
                      <TableCell>{a.kind === "upgrade" ? "Position upgrade" : "Lateral move"}</TableCell>
                      <TableCell>{fmtDate(a.at.slice(0, 10))}</TableCell>
                      <TableCell><Tag tone={APP_TONE[a.status]}>{label(a.status)}</Tag>{a.decision_note && <Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{a.decision_note}</Typography>}</TableCell>
                      <TableCell align="right">{["submitted", "shortlisted"].includes(a.status) && <Button size="small" color="inherit" onClick={() => withdraw(a.id)}>Withdraw</Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </SectionCard>
      </Stack>
      <ApplyDialog open={!!apply} ctx={apply} me={me} onClose={() => setApply(null)} nameOf={nameOf} />
    </>
  );
}

function ApplyDialog({ open, ctx, me, onClose, nameOf }) {
  const { data, suiteDo, notifyToast } = useStore();
  const [f, setF] = useState({ note: "", desired_role: "", available_from: "" });
  const [err, setErr] = useState("");
  React.useEffect(() => { setF({ note: "", desired_role: "", available_from: at(30), relocate: false, cv_updated: false, cv_name: "", awards: "" }); setErr(""); }, [open]);
  if (!ctx) return null;
  const p = ctx.posting;
  const cr = p ? criteriaOf(p) : null;
  function submit() {
    if (cr?.relocate && !f.relocate) return setErr("This posting needs you to be okay to relocate.");
    if (cr?.cv && !f.cv_updated) return setErr("Confirm you have updated your CV (attach it).");
    if (cr?.awards && !f.awards.trim()) return setErr("List your awards & recognition.");
    if (!p && f.desired_role.trim().length < 3) return setErr("Say which role or position you want to move up to.");
    if (f.note.trim().length < 10) return setErr("Tell HR briefly why you are a fit (10+ characters).");
    const to = [me?.reporting_manager, ...hrAdmins(data)].filter(Boolean);
    const r = suiteDo("ijp-self", (s, { me: code, now }) => {
      const ij = ensure(s);
      if (p && ij.applications.some((a) => a.posting_id === p.id && a.employee_code === code && !["withdrawn", "rejected"].includes(a.status))) return { ok: false, error: "You have already applied for this posting." };
      const id = `IJA-${String(ij.applications.length + 1).padStart(3, "0")}`;
      ij.applications.push({ id, posting_id: p?.id || null, desired_role: p ? "" : f.desired_role.trim(), employee_code: code, kind: ctx.kind, note: f.note.trim(), relocate_ok: !!f.relocate, cv_updated: !!f.cv_updated, cv_name: f.cv_name || "", awards: f.awards || "", available_from: f.available_from, current_role: me?.designation || "", status: "submitted", at: now, history: [{ status: "submitted", at: now, by: code }] });
      return { id };
    }, { action: "IJP_APPLY", details: (x) => `${x.id} · ${p?.id || f.desired_role}`, note: (x) => ({ to, text: `${me?.full_name} raised ${ctx.kind === "upgrade" ? "a position upgrade" : "an internal move"} request ${x.id}${p ? ` for ${p.title}` : ""}.`, link: "/ijp-admin" }) });
    if (!r.ok) return setErr(r.error);
    notifyToast(`Request ${r.id} sent to HR${me?.reporting_manager ? ` and ${nameOf(me.reporting_manager)}` : ""}.`);
    onClose();
  }
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{p ? `Apply · ${p.title}` : "Apply"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <Typography sx={{ fontSize: "0.66rem", color: "#78827b" }}>Current role: <b>{me?.designation}</b> · {me?.department}{me?.reporting_manager ? ` · manager ${nameOf(me.reporting_manager)}` : ""}</Typography>
          {!p && <TextField label="Role or position you want *" value={f.desired_role} onChange={(e) => setF({ ...f, desired_role: e.target.value })} placeholder="e.g. Senior Engineer on the Acme project, Team Lead" />}
          {cr && (
            <Box sx={{ p: 1.5, borderRadius: 2, border: "1px solid #FBD3B3", background: "#FEF1E6" }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, mb: 0.6 }}>Criteria for this posting</Typography>
              <CriteriaChips p={p} me={me} data={data} />
              <Stack spacing={0.4} sx={{ mt: 1 }}>
                <FormControlLabel control={<Checkbox size="small" checked={!!f.relocate} onChange={(e) => setF({ ...f, relocate: e.target.checked })} />} label={<Typography variant="body2">I am okay to relocate{cr.relocate ? " *" : ""}</Typography>} />
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <FormControlLabel control={<Checkbox size="small" checked={!!f.cv_updated} onChange={(e) => setF({ ...f, cv_updated: e.target.checked })} />} label={<Typography variant="body2">My CV is updated{cr.cv ? " *" : ""}</Typography>} />
                  <Button size="small" component="label" variant="outlined">{f.cv_name || "Attach CV"}<input hidden type="file" accept=".pdf,.doc,.docx" onChange={(e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, cv_name: file.name, cv_updated: true }); }} /></Button>
                </Stack>
                <TextField size="small" label={`Awards & recognition${cr.awards ? " *" : ""}`} value={f.awards} onChange={(e) => setF({ ...f, awards: e.target.value })} placeholder="e.g. Star performer Q2 2026, 3 recognitions in People & recognition" />
              </Stack>
            </Box>
          )}
          <TextField label="Why you are a fit *" multiline minRows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <TextField label="Available from" type="date" value={f.available_from} onChange={(e) => setF({ ...f, available_from: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit}>Submit</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────── Employee: relocation requests ───────────────────────────
export function MyIjpRelocation() {
  const { data, user, suiteDo, notifyToast, nameOf } = useStore();
  const ijp = useIjp();
  const me = data.employees.find((e) => e.employee_code === user.employee_code);
  const dest = useMemo(() => destinations(data), [data]);
  const blank = { target_type: "internal", dest: "", from_date: at(30), duration: "permanent", reason: "" };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState("");
  const mine = ijp.moves.filter((m) => m.employee_code === me?.employee_code).sort((a, b) => b.at.localeCompare(a.at));
  const options = f.target_type === "client" ? dest.client : dest.internal;

  function submit() {
    if (!f.dest) return setErr(`Choose the ${f.target_type === "client" ? "client location" : "company location"}.`);
    if (!f.from_date || f.from_date < isoDate()) return setErr("Choose a start date from today onwards.");
    if (f.reason.trim().length < 10) return setErr("Give a short reason (10+ characters).");
    const d = options.find((o) => o.key === f.dest);
    const to = [me?.reporting_manager, ...hrAdmins(data)].filter(Boolean);
    const r = suiteDo("ijp-self", (s, { me: code, now }) => {
      const ij = ensure(s);
      if (ij.moves.some((m) => m.employee_code === code && m.status === "submitted")) return { ok: false, error: "You already have a relocation request waiting. Withdraw it first to raise a new one." };
      const id = `IJR-${String(ij.moves.length + 1).padStart(3, "0")}`;
      ij.moves.push({ id, employee_code: code, target_type: f.target_type, dest: f.dest, dest_label: d?.label || f.dest, from_date: f.from_date, duration: f.duration, reason: f.reason.trim(), status: "submitted", at: now, history: [{ status: "submitted", at: now, by: code }] });
      return { id };
    }, { action: "IJP_RELOCATION", details: (x) => `${x.id} · ${d?.label}`, note: (x) => ({ to, text: `${me?.full_name} requested relocation ${x.id} to ${d?.label}.`, link: "/ijp-admin" }) });
    if (!r.ok) return setErr(r.error);
    setErr("");
    setF(blank);
    notifyToast(`Relocation request ${r.id} sent to HR${me?.reporting_manager ? ` and ${nameOf(me.reporting_manager)}` : ""}.`);
  }
  function withdraw(id) {
    const r = suiteDo("ijp-self", (s, { me: code, now }) => {
      const m = ensure(s).moves.find((x) => x.id === id && x.employee_code === code);
      if (!m || m.status !== "submitted") return { ok: false, error: "This request can no longer be withdrawn." };
      m.status = "withdrawn";
      m.history.push({ status: "withdrawn", at: now, by: code });
      return { id };
    }, { action: "IJP_RELOCATION_WITHDRAW", details: () => id });
    notifyToast(r.ok ? `Relocation request ${id} withdrawn.` : r.error, r.ok ? "info" : "error");
  }

  return (
    <>
      <PageHeader eyebrow="IJP · RELOCATION" title="Relocation requests" subtitle="Ask to move to a client location (project deployment) or to another company office. Your manager is told and HR approves." />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "380px minmax(0,1fr)" }, gap: 2.5, alignItems: "start" }}>
        <SectionCard title="Raise a relocation request">
          <Stack spacing={1.8}>
            {err && <Alert severity="error">{err}</Alert>}
            <ToggleButtonGroup exclusive fullWidth size="small" value={f.target_type} onChange={(_, v) => v && setF({ ...f, target_type: v, dest: "" })}>
              <ToggleButton value="internal" sx={{ fontSize: "0.62rem", gap: 0.6 }}><PlaceRounded sx={{ fontSize: 15 }} /> Company location</ToggleButton>
              <ToggleButton value="client" sx={{ fontSize: "0.62rem", gap: 0.6 }}><BusinessRounded sx={{ fontSize: 15 }} /> Client location</ToggleButton>
            </ToggleButtonGroup>
            <TextField select size="small" label={f.target_type === "client" ? "Client location *" : "Company location *"} value={f.dest} onChange={(e) => setF({ ...f, dest: e.target.value })}>
              {options.map((o) => <MenuItem key={o.key} value={o.key} sx={{ fontSize: "0.72rem" }}>{o.label}</MenuItem>)}
            </TextField>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <TextField size="small" type="date" label="From *" value={f.from_date} onChange={(e) => setF({ ...f, from_date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField select size="small" label="Duration" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })}>
                {[["permanent", "Permanent"], ["3m", "3 months"], ["6m", "6 months"], ["12m", "12 months"], ["project", "Project duration"]].map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
              </TextField>
            </Box>
            <TextField multiline minRows={3} label="Reason *" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Project need, family reasons, career growth…" />
            <Button variant="contained" startIcon={<FlightTakeoffRounded />} onClick={submit}>Submit request</Button>
            <Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>For work visas, shipment and allowances after approval, use Relocation & visa.</Typography>
          </Stack>
        </SectionCard>
        <SectionCard title="My relocation requests" noPad>
          {mine.length === 0 ? <Box sx={{ p: 2.5 }}><EmptyState title="No relocation requests" text="Requests you raise appear here with their status." /></Box> : (
            <TableWrap>
              <Table size="small" sx={{ minWidth: 600 }}>
                <TableHead><TableRow><TableCell>Request</TableCell><TableCell>To</TableCell><TableCell>From</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>
                  {mine.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell><Mono>{m.id}</Mono></TableCell>
                      <TableCell>{m.dest_label}<Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{m.target_type === "client" ? "Client location" : "Company location"} · {m.duration === "permanent" ? "permanent" : m.duration === "project" ? "project duration" : m.duration.replace("m", " months")}</Typography></TableCell>
                      <TableCell>{fmtDate(m.from_date)}</TableCell>
                      <TableCell><Tag tone={MOVE_TONE[m.status]}>{label(m.status)}</Tag>{m.decision_note && <Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{m.decision_note}</Typography>}</TableCell>
                      <TableCell align="right">{m.status === "submitted" && <Button size="small" color="inherit" onClick={() => withdraw(m.id)}>Withdraw</Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </SectionCard>
      </Box>
    </>
  );
}

// ─────────────────────────── HR / Super Admin: IJP & internal moves ───────────────────────────
export function IjpAdmin() {
  const { data, suiteDo, suiteCan, notifyToast, nameOf } = useStore();
  const ijp = useIjp();
  const [tab, setTab] = useState("applications");
  const [post, setPost] = useState(null);
  const [decide, setDecide] = useState(null);
  const can = suiteCan("ijp");
  const empBy = Object.fromEntries(data.employees.map((e) => [e.employee_code, e]));
  const postingBy = Object.fromEntries(ijp.postings.map((p) => [p.id, p]));
  const pendingApps = ijp.applications.filter((a) => ["submitted", "shortlisted"].includes(a.status));
  const pendingMoves = ijp.moves.filter((m) => m.status === "submitted");

  function setPostingStatus(id, status) {
    const r = suiteDo("ijp", (s) => { const p = ensure(s).postings.find((x) => x.id === id); if (!p) return { ok: false, error: "Posting not found." }; p.status = status; return { id }; }, { action: "IJP_POSTING", details: () => `${id} · ${status}` });
    notifyToast(r.ok ? `Posting ${id} ${status === "open" ? "re-opened" : "closed"}.` : r.error, r.ok ? "success" : "error");
  }

  return (
    <>
      <PageHeader eyebrow="HIRE & ONBOARD · IJP" title="IJP & internal moves" subtitle="Publish internal and client-project postings, decide applications and position upgrades, and approve relocation requests to client or company locations." actions={can && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setPost({})}>New posting</Button>} />
      <Stack spacing={2.5}>
        <Grid min={160}>
          <StatCard label="Open postings" value={ijp.postings.filter((p) => p.status === "open").length} onClick={() => setTab("postings")} />
          <StatCard label="Applications to decide" value={pendingApps.length} tone="warn" onClick={() => setTab("applications")} />
          <StatCard label="Relocations to approve" value={pendingMoves.length} tone="info" onClick={() => setTab("moves")} />
          <StatCard label="Selected this year" value={ijp.applications.filter((a) => a.status === "selected").length} tone="good" />
        </Grid>
        {!can && <Alert severity="info">You can view IJP activity. Decisions need the recruitment, onboarding or accounts module.</Alert>}
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={tabSx}>
            <Tab value="applications" label={`Applications & upgrades (${pendingApps.length})`} />
            <Tab value="moves" label={`Relocation requests (${pendingMoves.length})`} />
            <Tab value="postings" label={`Postings (${ijp.postings.length})`} />
          </Tabs>
        </Box>
        {tab === "applications" && (
          <SectionCard noPad>
            {ijp.applications.length === 0 ? <Box sx={{ p: 2.5 }}><EmptyState title="No applications yet" text="Employee applications and upgrade requests land here." /></Box> : (
              <TableWrap>
                <Table size="small" sx={{ minWidth: 760 }}>
                  <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>For</TableCell><TableCell>Type</TableCell><TableCell>Why</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
                  <TableBody>
                    {[...ijp.applications].sort((a, b) => b.at.localeCompare(a.at)).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell><PersonCell name={nameOf(a.employee_code)} sub={`${a.employee_code} · ${a.current_role}`} /></TableCell>
                        <TableCell>{a.posting_id ? postingBy[a.posting_id]?.title : a.desired_role}<Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}><Mono>{a.id}</Mono>{a.posting_id ? ` · ${a.posting_id}` : " · no posting"}</Typography></TableCell>
                        <TableCell>{a.kind === "upgrade" ? "Position upgrade" : "Lateral move"}</TableCell>
                        <TableCell sx={{ maxWidth: 260 }}><Typography sx={{ fontSize: "0.62rem" }}>{a.note}</Typography></TableCell>
                        <TableCell><Tag tone={APP_TONE[a.status]}>{label(a.status)}</Tag></TableCell>
                        <TableCell align="right">{can && ["submitted", "shortlisted"].includes(a.status) && <Button size="small" variant="outlined" onClick={() => setDecide({ kind: "app", rec: a })}>Decide</Button>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </SectionCard>
        )}
        {tab === "moves" && (
          <SectionCard noPad>
            {ijp.moves.length === 0 ? <Box sx={{ p: 2.5 }}><EmptyState title="No relocation requests" text="Requests to move to a client or company location land here." /></Box> : (
              <TableWrap>
                <Table size="small" sx={{ minWidth: 760 }}>
                  <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>To</TableCell><TableCell>From</TableCell><TableCell>Reason</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
                  <TableBody>
                    {[...ijp.moves].sort((a, b) => b.at.localeCompare(a.at)).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell><PersonCell name={nameOf(m.employee_code)} sub={`${m.employee_code} · ${empBy[m.employee_code]?.city || ""}`} /></TableCell>
                        <TableCell>{m.dest_label}<Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{m.target_type === "client" ? "Client location" : "Company location"} · <Mono>{m.id}</Mono></Typography></TableCell>
                        <TableCell>{fmtDate(m.from_date)}</TableCell>
                        <TableCell sx={{ maxWidth: 240 }}><Typography sx={{ fontSize: "0.62rem" }}>{m.reason}</Typography></TableCell>
                        <TableCell><Tag tone={MOVE_TONE[m.status]}>{label(m.status)}</Tag></TableCell>
                        <TableCell align="right">{can && m.status === "submitted" && <Button size="small" variant="outlined" onClick={() => setDecide({ kind: "move", rec: m })}>Decide</Button>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </SectionCard>
        )}
        {tab === "postings" && (
          <SectionCard noPad>
            <TableWrap>
              <Table size="small" sx={{ minWidth: 760 }}>
                <TableHead><TableRow><TableCell>Posting</TableCell><TableCell>Type</TableCell><TableCell>Location</TableCell><TableCell align="right">Applicants</TableCell><TableCell>Closes</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>
                  {ijp.postings.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.title}<Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}><Mono>{p.id}</Mono> · {p.dept} · {p.grade}</Typography></TableCell>
                      <TableCell>{p.type === "project" ? `Project · ${(data.clients || []).find((c) => c.id === p.client_id)?.company || ""}` : "Internal"}</TableCell>
                      <TableCell>{p.location}</TableCell>
                      <TableCell align="right">{ijp.applications.filter((a) => a.posting_id === p.id && a.status !== "withdrawn").length}</TableCell>
                      <TableCell>{fmtDate(p.closes)}</TableCell>
                      <TableCell><Tag tone={p.status === "open" ? "good" : "neutral"}>{label(p.status)}</Tag></TableCell>
                      <TableCell align="right">{can && <Button size="small" color="inherit" onClick={() => setPostingStatus(p.id, p.status === "open" ? "closed" : "open")}>{p.status === "open" ? "Close" : "Re-open"}</Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          </SectionCard>
        )}
      </Stack>
      <PostingDialog open={!!post} onClose={() => setPost(null)} />
      <DecideDialog ctx={decide} onClose={() => setDecide(null)} />
    </>
  );
}

function PostingDialog({ open, onClose }) {
  const { data, suiteDo, notifyToast } = useStore();
  const blank = { title: "", type: "internal", dept: "", client_id: "", location: "", grade: "", openings: 1, skills: "", description: "", closes: at(21), criteria: { tenure_months: 12, relocate: false, cv: true, awards: false, same_location: false } };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState("");
  React.useEffect(() => { setF(blank); setErr(""); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const depts = data.orgUnits.filter((o) => o.parent_unit).map((o) => o.name);
  function save() {
    if (f.title.trim().length < 3) return setErr("Enter the role title.");
    if (!f.dept) return setErr("Choose the department.");
    if (f.type === "project" && !f.client_id) return setErr("Choose the client for a project posting.");
    if (!f.location.trim()) return setErr("Enter the location.");
    const everyone = data.employees.filter((e) => e.status === "active").map((e) => e.employee_code);
    const r = suiteDo("ijp", (s, { code, now }) => {
      const ij = ensure(s);
      const id = `IJP-${String(ij.postings.length + 1).padStart(3, "0")}`;
      ij.postings.unshift({ ...f, id, title: f.title.trim(), openings: Math.max(1, Number(f.openings) || 1), client_id: f.type === "project" ? f.client_id : null, posted_at: now.slice(0, 10), status: "open", posted_by: code });
      return { id };
    }, { action: "IJP_POSTING", details: (x) => `${x.id} · ${f.title}`, note: () => ({ to: everyone, text: `New internal posting: ${f.title} (${f.location}). Apply under IJP.`, link: "/ijp" }) });
    if (!r.ok) return setErr(r.error);
    notifyToast(`Posting ${r.id} published to all employees.`);
    onClose();
  }
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>New internal posting</DialogTitle>
      <DialogContent>
        <Stack spacing={1.8} sx={{ pt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField label="Role title *" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <TextField select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <MenuItem value="internal">Internal role</MenuItem>
              <MenuItem value="project">Client project</MenuItem>
            </TextField>
            <TextField select label="Department *" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })}>{depts.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}</TextField>
          </Box>
          {f.type === "project" && <TextField select label="Client *" value={f.client_id} onChange={(e) => { const c = (data.clients || []).find((x) => x.id === e.target.value); setF({ ...f, client_id: e.target.value, location: f.location || (c ? `Client site · ${c.city}` : "") }); }}>{(data.clients || []).map((c) => <MenuItem key={c.id} value={c.id}>{c.company} · {c.city}</MenuItem>)}</TextField>}
          <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 1.5 }}>
            <TextField label="Location *" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
            <TextField label="Grade" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} />
            <TextField label="Openings" value={f.openings} onChange={(e) => setF({ ...f, openings: e.target.value.replace(/\D/g, "") })} />
          </Box>
          <TextField label="Skills" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} />
          <TextField label="Description" multiline minRows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <TextField label="Closes on" type="date" value={f.closes} onChange={(e) => setF({ ...f, closes: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          {/* v10.6: custom criteria box */}
          <Box sx={{ p: 1.5, borderRadius: 2, border: "1px solid #FBD3B3", background: "#FEF1E6" }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, mb: 1 }}>Criteria</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", alignItems: { sm: "center" } }}>
              <TextField size="small" type="number" label="Minimum tenure (months)" value={f.criteria?.tenure_months ?? 0} onChange={(e) => setF({ ...f, criteria: { ...f.criteria, tenure_months: Number(e.target.value) || 0 } })} sx={{ width: 190 }} />
              {[["relocate", "Okay to relocate"], ["cv", "Updated CV"], ["awards", "Awards & recognition"], ["same_location", "Same location only"]].map(([k, l]) => <FormControlLabel key={k} control={<Checkbox size="small" checked={!!f.criteria?.[k]} onChange={(e) => setF({ ...f, criteria: { ...f.criteria, [k]: e.target.checked } })} />} label={<Typography variant="body2">{l}</Typography>} />)}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>Publish</Button>
      </DialogActions>
    </Dialog>
  );
}

function DecideDialog({ ctx, onClose }) {
  const { data, suiteDo, notifyToast, nameOf } = useStore();
  const [note, setNote] = useState("");
  React.useEffect(() => setNote(""), [ctx]);
  if (!ctx) return null;
  const { kind, rec } = ctx;
  const emp = data.employees.find((e) => e.employee_code === rec.employee_code);
  const choices = kind === "app" ? [["shortlisted", "Shortlist"], ["selected", "Select"], ["rejected", "Reject"]].filter(([k]) => k !== rec.status) : [["approved", "Approve"], ["rejected", "Reject"]];
  function go(status) {
    if (status === "rejected" && note.trim().length < 5) return notifyToast("Add a short reason for the employee.", "error");
    const r = suiteDo("ijp", (s, { code, now }) => {
      const ij = ensure(s);
      const x = (kind === "app" ? ij.applications : ij.moves).find((i) => i.id === rec.id);
      if (!x) return { ok: false, error: "Request not found." };
      x.status = status;
      x.decision_note = note.trim();
      x.decided_by = code;
      x.decided_at = now;
      x.history.push({ status, at: now, by: code, note: note.trim() });
      return { id: x.id };
    }, { action: kind === "app" ? "IJP_DECIDE" : "IJP_RELOCATION_DECIDE", details: () => `${rec.id} · ${status}`, note: () => ({ to: [rec.employee_code, emp?.reporting_manager].filter(Boolean), text: `${rec.id} for ${nameOf(rec.employee_code)}: ${status}${note.trim() ? ` — ${note.trim()}` : ""}.`, link: kind === "app" ? "/ijp" : "/ijp-relocation" }) });
    notifyToast(r.ok ? `${rec.id} ${status}. ${nameOf(rec.employee_code)} and their manager were told.` : r.error, r.ok ? "success" : "error");
    if (r.ok) onClose();
  }
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{rec.id} · {nameOf(rec.employee_code)}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Typography sx={{ fontSize: "0.68rem" }}>{kind === "app" ? `${rec.kind === "upgrade" ? "Position upgrade" : "Lateral move"} · ${rec.note}` : `To ${rec.dest_label} from ${fmtDate(rec.from_date)} · ${rec.reason}`}</Typography>
          <TextField label="Note to the employee" multiline minRows={2} value={note} onChange={(e) => setNote(e.target.value)} helperText="Required when rejecting" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        {choices.map(([k, l]) => <Button key={k} variant={k === "rejected" ? "outlined" : "contained"} color={k === "rejected" ? "error" : "primary"} onClick={() => go(k)}>{l}</Button>)}
      </DialogActions>
    </Dialog>
  );
}

// v10.6 · IJP criteria: tenure, okay to relocate, updated CV, awards & recognition, same location.
const DEFAULT_CRITERIA = { tenure_months: 12, relocate: false, cv: true, awards: false, same_location: false };
export function criteriaOf(p) {
  return { ...DEFAULT_CRITERIA, ...(p.criteria || (p.type === "project" ? { relocate: true } : {})) };
}
export function criteriaCheck(p, me, data) {
  const c = criteriaOf(p);
  const months = me?.date_of_joining ? Math.floor((Date.now() - new Date(me.date_of_joining)) / (30.44 * 86400000)) : 0;
  const loc = (data.workLocations || []).find((l) => l.location_id === me?.location_id);
  const sameLoc = !c.same_location || !p.location || [me?.city, loc?.city, loc?.name].filter(Boolean).some((x) => String(p.location).toLowerCase().includes(String(x).toLowerCase()));
  const recog = (data.suite?.posts || []).filter((x) => x.kind === "recognition" && (x.to || []).includes(me?.employee_code)).length;
  const items = [
    { k: "tenure", label: `Tenure ${c.tenure_months}+ months`, ok: months >= c.tenure_months, hard: true, hint: `You: ${months} months` },
    c.same_location && { k: "loc", label: "Same location", ok: sameLoc, hard: true, hint: loc?.name || me?.city },
    c.relocate && { k: "reloc", label: "Okay to relocate", ok: null, hint: "Confirm when applying" },
    c.cv && { k: "cv", label: "Updated CV", ok: null, hint: "Attach when applying" },
    c.awards && { k: "awards", label: "Awards & recognition", ok: recog > 0 ? true : null, hint: `${recog} recognition(s)` },
  ].filter(Boolean);
  return { items, hardOk: items.filter((i) => i.hard).every((i) => i.ok) };
}
function CriteriaChips({ p, me, data }) {
  const { items } = criteriaCheck(p, me, data);
  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", maxWidth: 360 }}>
      {items.map((i) => <Tooltip key={i.k} title={i.hint || ""}><Chip size="small" label={`${i.ok === true ? "✓ " : i.ok === false ? "✗ " : ""}${i.label}`} sx={{ height: 20, fontSize: "0.58rem", fontWeight: 700, bgcolor: i.ok === true ? "#E6F6EE" : i.ok === false ? "#FDECEE" : "#FFF8DB", color: i.ok === true ? "#1F9D63" : i.ok === false ? "#E53950" : "#9A6400" }} /></Tooltip>)}
    </Stack>
  );
}
