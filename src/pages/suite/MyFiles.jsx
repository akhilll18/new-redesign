// v10.5 · My files (My profile → Documents) and document requests (Talent & recognition → Document requests).
import React, { useMemo, useState } from "react";
import { listOptions } from "../../lib/optionLists.js";
import ListSelect from "../../components/kit/ListSelect.jsx";
import { useNavigate } from "react-router-dom";
import { Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { UploadFileRounded, DownloadRounded, FolderOpenRounded, AddRounded, NotificationsActiveRounded, DeleteOutlineRounded, MarkEmailUnreadRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, TableWrap, EmptyState, Tag, Mono, PersonCell } from "../../components/kit/UI.jsx";
import { FILE_CATEGORIES, resolveTargets } from "../../store/fileActions.js";
import { WORKER_TYPES } from "../../data/employeeFields.js";
import { fmtDate, timeAgo, readFileAsDataUrl } from "../../lib/utils.js";
import { tabSx } from "../../components/suite/Hub.jsx";

const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const SOURCE = { hr: ["Uploaded by HR", "info"], request: ["Sent on request", "accent"], self: ["Uploaded by me", "neutral"] };

async function pick(e) {
  const f = e.target.files?.[0];
  e.target.value = "";
  if (!f) return null;
  return { name: f.name, size: f.size, type: f.type, data_url: await readFileAsDataUrl(f) };
}

function FileButton({ label, onFile, variant = "outlined" }) {
  return (
    <Button size="small" component="label" variant={variant} startIcon={<UploadFileRounded />} sx={{ whiteSpace: "nowrap" }}>
      {label}
      <input hidden type="file" onChange={async (e) => { const f = await pick(e); if (f) onFile(f); }} />
    </Button>
  );
}

/** Group / individual picker shared by HR uploads and document requests. */
export function TargetPicker({ value, onChange, allowAll }) {
  const { data, user } = useStore();
  const active = data.employees.filter((e) => !["exited", "rejected"].includes(e.status));
  const depts = [...new Set(active.map((e) => e.department))].sort();
  const cities = [...new Set(active.map((e) => e.city).filter(Boolean))].sort();
  const isMgr = user.role === "emp" && active.some((e) => e.reporting_manager === user.employee_code);
  const kinds = [["individual", "Individuals"], ...(isMgr ? [["team", "My team"]] : []), ["department", "Department"], ["location", "Location"], ["worker_type", "Worker type"], ...(allowAll ? [["all", "Everyone"]] : [])];
  const count = resolveTargets(data, value).filter((c) => c !== user.employee_code).length;
  return (
    <Stack spacing={1.5}>
      <TextField select size="small" label="Send to" value={value.kind} onChange={(e) => onChange({ kind: e.target.value, value: e.target.value === "team" ? user.employee_code : "", codes: [] })}>
        {kinds.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
      </TextField>
      {value.kind === "individual" && (
        <Autocomplete multiple size="small" options={active.filter((e) => e.employee_code !== user.employee_code)} getOptionLabel={(e) => `${e.full_name} · ${e.employee_code}`} value={active.filter((e) => (value.codes || []).includes(e.employee_code))} onChange={(_, v) => onChange({ ...value, codes: v.map((e) => e.employee_code) })} renderInput={(p) => <TextField {...p} label="People" placeholder="Type a name" />} />
      )}
      {value.kind === "department" && <TextField select size="small" label="Department" value={value.value || ""} onChange={(e) => onChange({ ...value, value: e.target.value })}>{depts.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}</TextField>}
      {value.kind === "location" && <TextField select size="small" label="Location" value={value.value || ""} onChange={(e) => onChange({ ...value, value: e.target.value })}>{cities.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}</TextField>}
      {value.kind === "worker_type" && <TextField select size="small" label="Worker type" value={value.value || ""} onChange={(e) => onChange({ ...value, value: e.target.value })}>{WORKER_TYPES.map((w) => <MenuItem key={w.id} value={w.id}>{w.label}</MenuItem>)}</TextField>}
      <Typography sx={{ fontSize: "0.62rem", color: "#78827b" }}>{count} {count === 1 ? "person" : "people"} selected</Typography>
    </Stack>
  );
}
const targetText = (t, data) => (t.kind === "individual" ? `${(t.codes || []).length} individual(s)` : t.kind === "team" ? "My team" : t.kind === "all" ? "Everyone" : t.kind === "worker_type" ? WORKER_TYPES.find((w) => w.id === t.value)?.label || t.value : t.value);

// ─────────────────────────── Employee: My files ───────────────────────────
export function MyFiles() {
  const { data, user } = useStore();
  const navigate = useNavigate();
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const mine = (data.empFiles || []).filter((f) => f.employee_code === user.employee_code);
  const cats = [...new Set(mine.map((f) => f.category))];
  const list = mine.filter((f) => (cat === "all" || f.category === cat) && (!q || `${f.title} ${f.file.name}`.toLowerCase().includes(q.toLowerCase())));
  const waiting = (data.docRequests || []).filter((r) => r.status === "open" && r.recipients.some((p) => p.code === user.employee_code && p.status === "pending"));
  return (
    <Box sx={{ mb: 2.5 }}>
      <SectionCard title="My files" subtitle="Letters, contracts, policies and other documents HR has added for you, plus documents you sent on request. Available for every worker type." action={
        <Stack direction="row" spacing={1}>
          <TextField size="small" placeholder="Search files" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 160 }} />
          <TextField select size="small" value={cat} onChange={(e) => setCat(e.target.value)} sx={{ width: 170 }}>
            <MenuItem value="all">All categories</MenuItem>
            {cats.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
        </Stack>
      } noPad>
        {waiting.length > 0 && <Alert severity="warning" sx={{ m: 2, mb: 0 }} action={<Button size="small" onClick={() => navigate("/doc-requests")}>Upload</Button>}>{waiting.length} document request{waiting.length > 1 ? "s" : ""} waiting for you: {waiting.map((r) => r.title).join(", ")}</Alert>}
        {list.length === 0 ? <Box sx={{ p: 2.5 }}><EmptyState icon={<FolderOpenRounded />} title="No files yet" text="Documents HR uploads for you appear here." /></Box> : (
          <TableWrap>
            <Table size="small" sx={{ minWidth: 620 }}>
              <TableHead><TableRow><TableCell>Document</TableCell><TableCell>Category</TableCell><TableCell>From</TableCell><TableCell>Added</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {list.map((f) => (
                  <TableRow key={f.id} hover>
                    <TableCell><Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{f.title}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{f.file.name} · {kb(f.file.size)}</Typography></TableCell>
                    <TableCell>{f.category}</TableCell>
                    <TableCell><Tag tone={SOURCE[f.source]?.[1] || "neutral"}>{SOURCE[f.source]?.[0] || f.source}</Tag></TableCell>
                    <TableCell>{fmtDate(f.at.slice(0, 10))}</TableCell>
                    <TableCell align="right"><Button size="small" startIcon={<DownloadRounded />} component="a" href={f.file.data_url} download={f.file.name}>Download</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>
    </Box>
  );
}

// ─────────────────────────── HR / Super Admin: employee files ───────────────────────────
export function EmployeeFilesAdmin() {
  const { data, hrUploadFiles, removeEmpFile, notifyToast, nameOf, canUploadEmpFiles } = useStore();
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState(null);
  const [cat, setCat] = useState("all");
  const fileCats = listOptions(data, "file_category").map(([c]) => c); // v10.13: includes values added with +
  if (!canUploadEmpFiles()) return null;
  const all = (data.empFiles || []).filter((f) => (!who || f.employee_code === who.employee_code) && (cat === "all" || f.category === cat));
  const active = data.employees.filter((e) => !["exited", "rejected"].includes(e.status));
  return (
    <Box sx={{ mb: 2.5 }}>
      <SectionCard title="Employee files" subtitle="Upload documents for one employee or a group. They appear in each employee's My profile → Documents → My files." action={<Button variant="contained" startIcon={<UploadFileRounded />} onClick={() => setOpen(true)}>Upload to employees</Button>} noPad>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ p: 2, pb: 1 }}>
          <Autocomplete size="small" sx={{ minWidth: 260 }} options={active} value={who} onChange={(_, v) => setWho(v)} getOptionLabel={(e) => `${e.full_name} · ${e.employee_code}`} renderInput={(p) => <TextField {...p} label="Employee" placeholder="All employees" />} />
          <TextField select size="small" label="Category" value={cat} onChange={(e) => setCat(e.target.value)} sx={{ minWidth: 190 }}>
            <MenuItem value="all">All categories</MenuItem>
            {fileCats.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <Typography sx={{ alignSelf: "center", fontSize: "0.62rem", color: "#78827b" }}>{all.length} file(s)</Typography>
        </Stack>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Document</TableCell><TableCell>Category</TableCell><TableCell>Added</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {all.slice(0, 60).map((f) => (
                <TableRow key={f.id} hover>
                  <TableCell><PersonCell name={nameOf(f.employee_code)} sub={f.employee_code} /></TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{f.title}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{f.file.name} · {SOURCE[f.source]?.[0]}</Typography></TableCell>
                  <TableCell>{f.category}</TableCell>
                  <TableCell>{fmtDate(f.at.slice(0, 10))}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Button size="small" component="a" href={f.file.data_url} download={f.file.name}>Download</Button>
                    {f.source === "hr" && <Button size="small" color="inherit" startIcon={<DeleteOutlineRounded />} onClick={() => { const r = removeEmpFile(f.id); notifyToast(r.ok ? "File removed." : r.error, r.ok ? "info" : "error"); }}>Remove</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
        {all.length > 60 && <Typography sx={{ p: 1.5, fontSize: "0.6rem", color: "#78827b" }}>Showing 60 of {all.length}. Pick an employee to see all of theirs.</Typography>}
      </SectionCard>
      <UploadDialog open={open} onClose={() => setOpen(false)} onSave={(v) => { const r = hrUploadFiles(v); if (r.ok) { notifyToast(`"${v.title}" added to ${r.count} employee(s)' My files.`); setOpen(false); } return r; }} />
    </Box>
  );
}

function UploadDialog({ open, onClose, onSave }) {
  const blank = { title: "", category: "Letters", note: "", file: null, target: { kind: "individual", codes: [] } };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState("");
  React.useEffect(() => { setF(blank); setErr(""); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Upload to employees' My files</DialogTitle>
      <DialogContent>
        <Stack spacing={1.8} sx={{ pt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <TargetPicker value={f.target} onChange={(target) => setF({ ...f, target })} allowAll />
          <TextField size="small" label="Document title *" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Increment letter 2026" />
          <ListSelect listKey="file_category" size="small" blank={false} label="Category" value={f.category} onChange={(v) => setF({ ...f, category: v })} />
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <FileButton label={f.file ? "Change file" : "Choose file *"} onFile={(file) => setF({ ...f, file, title: f.title || file.name.replace(/\.[^.]+$/, "") })} />
            <Typography sx={{ fontSize: "0.65rem", color: "#5c675f" }}>{f.file ? `${f.file.name} · ${kb(f.file.size)}` : "PDF, image or any document, up to 1.5 MB"}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { const r = onSave(f); if (!r.ok) setErr(r.error); }}>Upload</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────── Document requests (Talent & recognition) ───────────────────────────
export function DocRequestsPage({ embedded }) {
  const { data, user, createDocRequest, respondDocRequest, remindDocRequest, closeDocRequest, notifyToast, nameOf } = useStore();
  const isEmp = user.role === "emp";
  const askedOfMe = isEmp ? (data.docRequests || []).filter((r) => r.recipients.some((p) => p.code === user.employee_code)) : [];
  const sent = (data.docRequests || []).filter((r) => r.by === user.code);
  const pendingMine = askedOfMe.filter((r) => r.status === "open" && r.recipients.find((p) => p.code === user.employee_code)?.status === "pending");
  const [tab, setTab] = useState(isEmp ? "mine" : "sent");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const [decline, setDecline] = useState(null);
  const fileBy = useMemo(() => Object.fromEntries((data.empFiles || []).map((f) => [f.id, f])), [data.empFiles]);
  const reply = (id, payload) => { const r = respondDocRequest(id, payload); notifyToast(r.ok ? (payload.decline ? "Reply sent." : "Uploaded. It's saved in My files too.") : r.error, r.ok ? "success" : "error"); return r; };

  return (
    <>
      {!embedded && <PageHeader title="Document requests" subtitle="Ask colleagues for a document — one person, your team, a department, a location or a worker type — and track who has sent it. Replies are saved in each person's My files." actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setOpen(true)}>Request a document</Button>} />}
      <Stack spacing={2.5}>
        <Grid min={170}>
          {isEmp && <StatCard label="Waiting for me" value={pendingMine.length} tone={pendingMine.length ? "warn" : "good"} icon={<MarkEmailUnreadRounded />} onClick={() => setTab("mine")} />}
          <StatCard label="Requests I sent" value={sent.length} onClick={() => setTab("sent")} />
          <StatCard label="Replies received" value={sent.reduce((t, r) => t + r.recipients.filter((p) => p.status === "submitted").length, 0)} tone="good" onClick={() => setTab("sent")} />
          <StatCard label="Still pending" value={sent.reduce((t, r) => t + (r.status === "open" ? r.recipients.filter((p) => p.status === "pending").length : 0), 0)} tone="info" onClick={() => setTab("sent")} />
        </Grid>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={tabSx}>
            {isEmp && <Tab value="mine" label={`Asked of me (${pendingMine.length})`} />}
            <Tab value="sent" label={`Sent by me (${sent.length})`} />
          </Tabs>
        </Box>
        {tab === "mine" && (
          <SectionCard noPad>
            {askedOfMe.length === 0 ? <Box sx={{ p: 2.5 }}><EmptyState title="Nothing asked of you" text="When someone requests a document from you it shows here." /></Box> : (
              <TableWrap>
                <Table size="small" sx={{ minWidth: 680 }}>
                  <TableHead><TableRow><TableCell>Document</TableCell><TableCell>Asked by</TableCell><TableCell>Due</TableCell><TableCell>My status</TableCell><TableCell /></TableRow></TableHead>
                  <TableBody>
                    {askedOfMe.map((r) => {
                      const me = r.recipients.find((p) => p.code === user.employee_code);
                      const late = me.status === "pending" && r.due < new Date().toISOString().slice(0, 10);
                      return (
                        <TableRow key={r.id} hover>
                          <TableCell><Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{r.title}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}><Mono>{r.id}</Mono>{r.note ? ` · ${r.note}` : ""}</Typography></TableCell>
                          <TableCell>{nameOf(r.by)}</TableCell>
                          <TableCell sx={{ color: late ? "#b3261e" : undefined }}>{fmtDate(r.due)}</TableCell>
                          <TableCell><Tag tone={me.status === "submitted" ? "good" : me.status === "declined" ? "bad" : late ? "bad" : "warn"}>{me.status === "pending" ? (late ? "Overdue" : "To upload") : me.status === "submitted" ? "Sent" : "Can't provide"}</Tag></TableCell>
                          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                            {r.status !== "closed" && me.status !== "submitted" && <FileButton variant="contained" label="Upload" onFile={(file) => reply(r.id, { file })} />}
                            {r.status !== "closed" && me.status === "pending" && <Button size="small" color="inherit" onClick={() => setDecline(r)}>Can't provide</Button>}
                            {me.file_id && fileBy[me.file_id] && <Button size="small" component="a" href={fileBy[me.file_id].file.data_url} download={fileBy[me.file_id].file.name}>My copy</Button>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </SectionCard>
        )}
        {tab === "sent" && (
          <SectionCard noPad>
            {sent.length === 0 ? <Box sx={{ p: 2.5 }}><EmptyState title="No requests yet" text="Use “Request a document” to ask colleagues for something." /></Box> : (
              <TableWrap>
                <Table size="small" sx={{ minWidth: 720 }}>
                  <TableHead><TableRow><TableCell>Document</TableCell><TableCell>Sent to</TableCell><TableCell>Due</TableCell><TableCell>Replies</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
                  <TableBody>
                    {sent.map((r) => {
                      const done = r.recipients.filter((p) => p.status !== "pending").length;
                      return (
                        <TableRow key={r.id} hover>
                          <TableCell><Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{r.title}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}><Mono>{r.id}</Mono> · {timeAgo(r.at)}</Typography></TableCell>
                          <TableCell>{targetText(r.target, data)}</TableCell>
                          <TableCell>{fmtDate(r.due)}</TableCell>
                          <TableCell>{done} / {r.recipients.length}</TableCell>
                          <TableCell><Tag tone={r.status === "complete" ? "good" : r.status === "closed" ? "neutral" : "warn"}>{r.status === "open" ? "Open" : r.status === "complete" ? "Complete" : "Closed"}</Tag></TableCell>
                          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                            <Button size="small" onClick={() => setView(r.id)}>Replies</Button>
                            {r.status === "open" && <Button size="small" startIcon={<NotificationsActiveRounded />} onClick={() => { const x = remindDocRequest(r.id); notifyToast(x.ok ? `Reminder sent to ${x.count} person(s).` : x.error, x.ok ? "info" : "error"); }}>Remind</Button>}
                            {r.status !== "closed" && <Button size="small" color="inherit" onClick={() => closeDocRequest(r.id)}>Close</Button>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </SectionCard>
        )}
      </Stack>
      <NewRequestDialog open={open} onClose={() => setOpen(false)} onSave={(v) => { const r = createDocRequest(v); if (r.ok) { notifyToast(`Request ${r.id} sent to ${r.count} person(s).`); setOpen(false); setTab("sent"); } return r; }} allowAll={!isEmp} />
      <RepliesDialog id={view} onClose={() => setView(null)} fileBy={fileBy} />
      <DeclineDialog req={decline} onClose={() => setDecline(null)} onSend={(note) => { const r = reply(decline.id, { decline: true, note }); if (r.ok) setDecline(null); }} />
    </>
  );
}

function NewRequestDialog({ open, onClose, onSave, allowAll }) {
  const blank = { title: "", note: "", due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), target: { kind: "individual", codes: [] } };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState("");
  React.useEffect(() => { setF(blank); setErr(""); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Request a document</DialogTitle>
      <DialogContent>
        <Stack spacing={1.8} sx={{ pt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          {/* v10.6: one-tap templates — Finance asks for income-tax proofs, HR for KYC and letters. */}
          <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap" }}>
            {[["Income-tax investment proofs (Form 12BB)", "80C / 80D receipts, HRA rent receipts and home-loan interest certificate for the current financial year."], ["Rent receipts for HRA", "Monthly rent receipts with landlord PAN if annual rent is above ₹1 lakh."], ["Form 16 from previous employer", "Needed to compute TDS correctly for joiners in this financial year."], ["PAN card copy", "Self-attested copy."], ["Aadhaar card copy", "Masked Aadhaar is accepted."], ["Cancelled cheque / bank proof", "For salary account verification."]].map(([t, n]) => (
              <Chip key={t} size="small" variant="outlined" label={t} onClick={() => setF({ ...f, title: t, note: f.note || n })} />
            ))}
          </Stack>
          <TextField size="small" label="Document needed *" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Project completion certificate" />
          <TextField size="small" label="Details" multiline minRows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <TextField size="small" type="date" label="Due by *" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          <TargetPicker value={f.target} onChange={(target) => setF({ ...f, target })} allowAll={allowAll} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { const r = onSave(f); if (!r.ok) setErr(r.error); }}>Send request</Button>
      </DialogActions>
    </Dialog>
  );
}

function RepliesDialog({ id, onClose, fileBy }) {
  const { data, nameOf } = useStore();
  const r = (data.docRequests || []).find((q) => q.id === id);
  if (!r) return null;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{r.title} · replies</DialogTitle>
      <DialogContent sx={{ px: 0 }}>
        {r.recipients.map((p) => {
          const f = p.file_id && fileBy[p.file_id];
          return (
            <Stack key={p.code} direction="row" spacing={1.5} sx={{ px: 3, py: 1.1, borderTop: "1px solid #f0f2ef", alignItems: "center" }}>
              <Box sx={{ flex: 1 }}><PersonCell name={nameOf(p.code)} sub={p.at ? `${p.code} · ${timeAgo(p.at)}${p.note ? ` · ${p.note}` : ""}` : p.code} /></Box>
              <Tag tone={p.status === "submitted" ? "good" : p.status === "declined" ? "bad" : "warn"}>{p.status === "submitted" ? "Sent" : p.status === "declined" ? "Can't provide" : "Pending"}</Tag>
              {f && <Button size="small" startIcon={<DownloadRounded />} component="a" href={f.file.data_url} download={f.file.name}>Open</Button>}
            </Stack>
          );
        })}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

function DeclineDialog({ req, onClose, onSend }) {
  const [note, setNote] = useState("");
  React.useEffect(() => setNote(""), [req]);
  if (!req) return null;
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Can't provide “{req.title}”</DialogTitle>
      <DialogContent><TextField fullWidth multiline minRows={2} sx={{ mt: 1 }} label="Reason *" value={note} onChange={(e) => setNote(e.target.value)} /></DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button color="inherit" onClick={onClose}>Cancel</Button><Button variant="contained" onClick={() => onSend(note)}>Send</Button></DialogActions>
    </Dialog>
  );
}
