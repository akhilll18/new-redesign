// Documents page additions:
//  • Employees: "My documents" – joining / statutory documents for their country and the documents their background
//    verification needs, with status and upload. BGV uploads go to the same BGV case as "My background check".
//  • HR (onboarding / BGV / accounts modules, Super Admin): verify uploaded documents and chase missing ones.
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { UploadFileRounded, VisibilityRounded, TaskAltRounded, ReplayRounded, NotificationsActiveRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, Tag, TableWrap, PersonCell, EmptyState, Grid, StatCard } from "../kit/UI.jsx";
import { BgvChip } from "./BgvViews.jsx";
import { docChecklist, DOC_STATUS, BGV_DOC_STATUS } from "../../lib/empdocs.js";
import { packFor, countryOf } from "../../country/countryPacks.js";
import { readFileAsDataUrl, fmtDate, timeAgo } from "../../lib/utils.js";

function FileLinks({ files = [] }) {
  if (!files.length) return <Typography sx={{ fontSize: "0.6rem", color: "#9aa39c" }}>—</Typography>;
  return (
    <Stack spacing={0.2}>
      {files.slice(-2).map((f, i) => (f.data_url
        ? <Box key={i} component="a" href={f.data_url} download={f.name} target="_blank" rel="noreferrer" sx={{ fontSize: "0.6rem", color: "#2C4B8F" }}>📎 {f.name}</Box>
        : <Typography key={i} sx={{ fontSize: "0.6rem", color: "#5c675f" }}>📎 {f.name}</Typography>))}
      {files.length > 2 && <Typography sx={{ fontSize: "0.55rem", color: "#9aa39c" }}>+{files.length - 2} earlier</Typography>}
    </Stack>
  );
}

function UploadBtn({ label = "Upload", variant = "contained", onFile }) {
  return (
    <Button size="small" component="label" variant={variant} startIcon={<UploadFileRounded />} sx={{ whiteSpace: "nowrap" }}>
      {label}
      <input hidden type="file" accept="application/pdf,image/*" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile({ name: f.name, size: f.size, type: f.type, data_url: await readFileAsDataUrl(f) }); }} />
    </Button>
  );
}

export function MyDocumentChecklist() {
  const { data, user, submitEmpDoc, uploadBgvDoc, notifyToast } = useStore();
  const navigate = useNavigate();
  const [onlyMissing, setOnlyMissing] = useState(false);
  const emp = data.employees.find((e) => e.employee_code === user.employee_code);
  const ck = useMemo(() => docChecklist(data, emp), [data, emp]);
  if (!emp) return null;
  const pack = packFor(countryOf(emp));
  const stat = ck.statutory.filter((s) => !onlyMissing || ["missing", "rejected"].includes(s.status));
  const bgvRows = ck.bgv.filter((b) => !onlyMissing || b.status === "needed");
  const c = ck.bgvCase;
  const pct = ck.total ? Math.round((ck.done / ck.total) * 100) : 100;
  return (
    <Box sx={{ mb: 2.5 }}>
      <SectionCard
        title="My documents"
        subtitle={`Joining & statutory documents for ${pack?.name || "your country"} and your background verification. Upload what is missing – HR is notified and verifies it.`}
        action={<FormControlLabel control={<Switch size="small" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />} label={<Typography sx={{ fontSize: "0.62rem" }}>Only missing</Typography>} />}
      >
        <Stack spacing={2}>
          <Grid min={170} gap={1.5}>
            <Box sx={{ p: 1.4, borderRadius: 1.5, border: "1px solid #e5eae5" }}>
              <Typography sx={{ fontSize: "0.58rem", color: "#78827b", fontWeight: 700 }}>JOINING DOCUMENTS VERIFIED</Typography>
              <Typography sx={{ fontSize: "1.1rem", fontWeight: 800 }}>{ck.done} / {ck.total}</Typography>
              <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3, mt: 0.5 }} />
            </Box>
            <Box sx={{ p: 1.4, borderRadius: 1.5, border: "1px solid #e5eae5" }}>
              <Typography sx={{ fontSize: "0.58rem", color: "#78827b", fontWeight: 700 }}>NEED YOUR ACTION</Typography>
              <Typography sx={{ fontSize: "1.1rem", fontWeight: 800, color: ck.missing ? "#B0291F" : "#1D7A42" }}>{ck.missing || "None"}</Typography>
              <Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{ck.missingStat} joining · {ck.missingBgv} background check</Typography>
            </Box>
            <Box sx={{ p: 1.4, borderRadius: 1.5, border: "1px solid #e5eae5" }}>
              <Typography sx={{ fontSize: "0.58rem", color: "#78827b", fontWeight: 700 }}>BACKGROUND VERIFICATION</Typography>
              <Box sx={{ mt: 0.6 }}>{c ? <BgvChip c={c} /> : <Tag>Not started</Tag>}</Box>
              {c && <Button size="small" sx={{ mt: 0.4, px: 0, fontSize: "0.58rem" }} onClick={() => navigate("/bgv-me")}>Open my background check →</Button>}
            </Box>
          </Grid>
          {ck.missing > 0 && <Alert severity="warning" sx={{ fontSize: "0.65rem" }}>{ck.missing} document{ck.missing === 1 ? "" : "s"} still need{ck.missing === 1 ? "s" : ""} your action. Upload a clear PDF or photo (max 1.5 MB). Never upload passwords or OTPs.</Alert>}

          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: "0.72rem", mb: 0.8 }}>Joining & statutory documents {pack?.flag || ""}</Typography>
            <TableWrap>
              <Table size="small" sx={{ minWidth: 700 }}>
                <TableHead><TableRow><TableCell>Document</TableCell><TableCell>Status</TableCell><TableCell>Your file</TableCell><TableCell>Note from HR</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
                <TableBody>
                  {stat.map((s) => (
                    <TableRow key={s.key}>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.66rem" }}>{s.name}</TableCell>
                      <TableCell><Tag tone={DOC_STATUS[s.status].tone}>{DOC_STATUS[s.status].label}</Tag>{s.rec?.reviewed_at && s.status === "verified" && <Typography sx={{ fontSize: "0.52rem", color: "#9aa39c" }}>{fmtDate(s.rec.reviewed_at)}</Typography>}</TableCell>
                      <TableCell><FileLinks files={s.rec?.files} /></TableCell>
                      <TableCell sx={{ maxWidth: 260 }}><Typography sx={{ fontSize: "0.6rem", color: s.status === "rejected" ? "#8A5200" : "#78827b" }}>{s.rec?.note || "—"}</Typography></TableCell>
                      <TableCell align="right">
                        {s.status === "verified" ? <TaskAltRounded sx={{ fontSize: 18, color: "#1D7A42" }} /> : <UploadBtn label={s.status === "missing" ? "Upload" : s.status === "rejected" ? "Re-upload" : "Replace"} variant={s.status === "submitted" ? "text" : "contained"} onFile={(f) => { const r = submitEmpDoc(s.key, s.name, f); notifyToast(r.ok ? `${s.name} uploaded – HR will verify it.` : r.error, r.ok ? "success" : "error"); }} />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
            {!stat.length && <Typography sx={{ fontSize: "0.62rem", color: "#78827b", p: 1 }}>Nothing missing here.</Typography>}
          </Box>

          {false && c && ( /* v10.7: BGV documents are only under My profile → BGV */
            <Box>
              <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.8 }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.72rem", flex: 1 }}>Background verification documents · {c.id}</Typography>
                {c.closed_status && <Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>Completed {fmtDate(c.closed_at)}</Typography>}
              </Stack>
              {!c.closed_status && c.consent?.status !== "given" && <Alert severity="warning" sx={{ mb: 1, fontSize: "0.65rem" }} action={<Button size="small" onClick={() => navigate("/bgv-me")}>Give consent</Button>}>Your consent is needed before the background checks and uploads can start.</Alert>}
              <TableWrap>
                <Table size="small" sx={{ minWidth: 700 }}>
                  <TableHead><TableRow><TableCell>Check</TableCell><TableCell>Status</TableCell><TableCell>What is needed</TableCell><TableCell>Your uploads</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
                  <TableBody>
                    {bgvRows.map((b) => (
                      <TableRow key={b.type}>
                        <TableCell sx={{ fontWeight: 600, fontSize: "0.66rem" }}>{b.name}</TableCell>
                        <TableCell><Tag tone={BGV_DOC_STATUS[b.status].tone}>{BGV_DOC_STATUS[b.status].label}</Tag></TableCell>
                        <TableCell sx={{ maxWidth: 280 }}><Typography sx={{ fontSize: "0.6rem", color: b.status === "needed" ? "#8A5200" : "#78827b" }}>{b.status === "needed" ? b.ask : b.status === "verified" ? (b.docs.length ? "Verified" : "Verified by the vendor – nothing needed") : b.status === "discrepancy" ? "HR will contact you about this check" : "Nothing right now"}</Typography></TableCell>
                        <TableCell><FileLinks files={b.docs} /></TableCell>
                        <TableCell align="right">{!c.closed_status && c.consent?.status === "given" && ["needed", "pending", "uploaded"].includes(b.status) ? <UploadBtn label={b.status === "needed" ? "Upload" : "Add file"} variant={b.status === "needed" ? "contained" : "text"} onFile={(f) => { const r = uploadBgvDoc(c.id, b.type, f); notifyToast(r.ok ? `${f.name} added to your background check – HR has been notified.` : r.error, r.ok ? "success" : "error"); }} /> : b.status === "verified" ? <TaskAltRounded sx={{ fontSize: 18, color: "#1D7A42" }} /> : null}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
              {!bgvRows.length && <Typography sx={{ fontSize: "0.62rem", color: "#78827b", p: 1 }}>Nothing missing for your background check.</Typography>}
            </Box>
          )}
        </Stack>
      </SectionCard>
    </Box>
  );
}

export function canReviewDocs(user) {
  return user?.role === "superadmin" || (user?.role === "admin" && (user.modules || []).some((m) => ["onboarding", "bgv", "accounts"].includes(m)));
}

export function EmployeeDocReview() {
  const { data, user, nameOf, reviewEmpDoc, remindEmpDocs, notifyToast, scopeUnits } = useStore();
  const [reject, setReject] = useState(null);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(null);
  const units = user.role === "superadmin" ? null : scopeUnits(user);
  const emps = data.employees.filter((e) => ["active", "pending_approval"].includes(e.status) && (!units || units.has(e.department)));
  const lists = useMemo(() => emps.map((e) => ({ e, ck: docChecklist(data, e) })), [data, emps.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const queue = (data.empDocs || []).filter((d) => d.status === "submitted" && emps.some((e) => e.employee_code === d.employee_code)).sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)));
  const incomplete = lists.filter((l) => l.ck.missing > 0).sort((a, b) => b.ck.missing - a.ck.missing);
  return (
    <Box sx={{ mb: 2.5 }}>
      <SectionCard title="Employee documents" subtitle="Verify what employees uploaded and chase what is missing. Verifying every joining document ticks the onboarding task “Documents & KYC verified”.">
        <Stack spacing={2}>
          <Grid min={160} gap={1.5}>
            <StatCard label="Waiting to verify" value={queue.length} tone="info" />
            <StatCard label="Employees with gaps" value={incomplete.length} tone="warn" />
            <StatCard label="Missing documents" value={incomplete.reduce((s, l) => s + l.ck.missing, 0)} tone="bad" />
            <StatCard label="Fully documented" value={lists.filter((l) => l.ck.done === l.ck.total && !l.ck.missing).length} tone="good" />
          </Grid>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: "0.72rem", mb: 0.8 }}>Waiting for verification</Typography>
            <TableWrap>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Document</TableCell><TableCell>File</TableCell><TableCell>Uploaded</TableCell><TableCell align="right">Decision</TableCell></TableRow></TableHead>
                <TableBody>
                  {queue.map((d) => {
                    const f = d.files[d.files.length - 1];
                    const e = data.employees.find((x) => x.employee_code === d.employee_code);
                    return (
                      <TableRow key={d.id}>
                        <TableCell><PersonCell name={nameOf(d.employee_code)} sub={`${d.employee_code} · ${e?.department || ""} · ${countryOf(e)}`} /></TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: "0.66rem" }}>{d.doc_name}</TableCell>
                        <TableCell>{f?.data_url ? <Button size="small" startIcon={<VisibilityRounded />} onClick={() => setPreview(f)} sx={{ textTransform: "none", fontSize: "0.6rem" }}>{f.name}</Button> : <Typography sx={{ fontSize: "0.6rem" }}>📎 {f?.name}</Typography>}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{timeAgo(d.updated_at)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          <Button size="small" color="warning" startIcon={<ReplayRounded />} onClick={() => { setReject(d); setNote(""); }}>Re-upload</Button>
                          <Button size="small" variant="contained" startIcon={<TaskAltRounded />} onClick={() => { const r = reviewEmpDoc(d.id, "verified"); notifyToast(r.ok ? `${d.doc_name} verified.` : r.error, r.ok ? "success" : "error"); }}>Verify</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrap>
            {!queue.length && <EmptyState title="Nothing to verify" text="New uploads appear here." />}
          </Box>
          {incomplete.length > 0 && (
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: "0.72rem", mb: 0.8 }}>Missing documents</Typography>
              <TableWrap>
                <Table size="small" sx={{ minWidth: 720 }}>
                  <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Joining docs</TableCell><TableCell>Missing</TableCell><TableCell>BGV</TableCell><TableCell align="right" /></TableRow></TableHead>
                  <TableBody>
                    {incomplete.slice(0, 25).map(({ e, ck }) => {
                      const miss = [...ck.statutory.filter((s) => ["missing", "rejected"].includes(s.status)).map((s) => s.name), ...ck.bgv.filter((b) => b.status === "needed").map((b) => `BGV: ${b.name}`), ...(ck.bgvCase && !ck.bgvCase.closed_status && ck.bgvCase.consent?.status !== "given" ? ["BGV consent"] : [])];
                      return (
                        <TableRow key={e.employee_code}>
                          <TableCell><PersonCell name={e.full_name} sub={`${e.employee_code} · joined ${fmtDate(e.date_of_joining)}`} /></TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{ck.done}/{ck.total} verified</TableCell>
                          <TableCell sx={{ maxWidth: 360 }}><Typography sx={{ fontSize: "0.6rem" }}>{miss.join(" · ")}</Typography></TableCell>
                          <TableCell>{ck.bgvCase ? <BgvChip c={ck.bgvCase} /> : "—"}</TableCell>
                          <TableCell align="right"><Button size="small" startIcon={<NotificationsActiveRounded />} onClick={() => { const r = remindEmpDocs(e.employee_code, miss); notifyToast(r.ok ? `Reminder sent to ${e.full_name}.` : r.error, r.ok ? "success" : "error"); }}>Remind</Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrap>
            </Box>
          )}
        </Stack>
      </SectionCard>
      <Dialog open={!!reject} onClose={() => setReject(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Ask for a re-upload</DialogTitle>
        <DialogContent><TextField sx={{ mt: 1 }} fullWidth multiline minRows={2} label="What is wrong? *" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The image is blurred – the number is not readable." /></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setReject(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { const r = reviewEmpDoc(reject.id, "rejected", note); if (!r.ok) return notifyToast(r.error, "error"); notifyToast("Employee asked to re-upload."); setReject(null); }}>Send</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{preview?.name}</DialogTitle>
        <DialogContent>{preview?.type?.startsWith("image/") ? <Box component="img" src={preview.data_url} alt={preview.name} sx={{ maxWidth: "100%" }} /> : <Box component="iframe" title={preview?.name} src={preview?.data_url} sx={{ width: "100%", height: 520, border: 0 }} />}</DialogContent>
        <DialogActions><Button onClick={() => setPreview(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
