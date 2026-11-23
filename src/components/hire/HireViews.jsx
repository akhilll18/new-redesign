// Hiring: recruitment requisitions and pipeline (Sahayog 01), onboarding checklists (02).
import EntitySelect from "../kit/EntitySelect.jsx";
import React, { useState } from "react";
import ListSelect from "../kit/ListSelect.jsx";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputAdornment, InputLabel, MenuItem, Rating, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AddRounded, PersonAddAlt1Rounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, Tag, TableWrap, Mono, HBar } from "../kit/UI.jsx";
import { dueDate } from "../../pages/workforce/MyOnboarding.jsx";
import { isoDate, fmtDate, fmtNum, DAY } from "../../lib/utils.js";

const STAGES = [["applied", "Applied"], ["screen", "Screened"], ["interview", "Interview"], ["offer", "Offer"], ["hired", "Hired"]];

export function RecruitmentView() {
  const { data, upsertReq, addCandidate, moveCandidate, notifyToast } = useStore();
  const [reqDlg, setReqDlg] = useState(null);
  const [candDlg, setCandDlg] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const today = new Date();
  const rq = data.reqs.map((r) => {
    const end = r.closed ? new Date(`${r.closed}T12:00:00`) : today;
    const days = Math.round((end - new Date(`${r.open}T12:00:00`)) / DAY);
    return { ...r, days, acr: r.off ? (r.acc / r.off) * 100 : null, cph: r.acc ? r.cost / r.acc : null };
  });
  const closed = rq.filter((r) => r.closed);
  const open = rq.filter((r) => !r.closed);
  const sum = (k) => data.reqs.reduce((s, r) => s + r[k], 0);
  const funnel = [["Applied", sum("app")], ["Screened", sum("scr")], ["Interviewed", sum("int")], ["Offered", sum("off")], ["Accepted", sum("acc")]];
  const cands = data.candidates.filter((c) => !filter || c.req_id === filter);
  const roleOf = (id) => data.reqs.find((r) => r.id === id)?.role;
  return (
    <Stack spacing={2.5}>
      <Grid min={160}>
        <StatCard label="Open requisitions" value={open.length} hint={`${open.reduce((s, r) => s + (r.n - r.acc), 0)} seats unfilled`} />
        <StatCard label="Avg time to fill" value={closed.length ? `${Math.round(closed.reduce((s, r) => s + r.days, 0) / closed.length)} days` : "—"} tone="info" hint="Closed requisitions" />
        <StatCard label="Cost per hire" value={`₹${fmtNum(Math.round(rq.reduce((s, r) => s + r.cost, 0) / Math.max(1, sum("acc"))))}`} tone="neutral" />
        <StatCard label="Offer acceptance" value={`${Math.round((sum("acc") / Math.max(1, sum("off"))) * 100)}%`} tone="good" />
        <StatCard label="Applicant to hire" value={`${((sum("acc") / Math.max(1, sum("app"))) * 100).toFixed(2)}%`} tone="info" />
      </Grid>
      <SectionCard title="Requisitions" action={<Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => { setReqDlg({ role: "", dept: "Engineering", n: 1, cost: 0, hiring_manager: "" }); setError(""); }}>Open requisition</Button>} noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 1000 }}>
            <TableHead><TableRow><TableCell>Req</TableCell><TableCell>Role</TableCell><TableCell>Opened</TableCell><TableCell align="right">Seats</TableCell><TableCell align="right">Applied</TableCell><TableCell align="right">Screened</TableCell><TableCell align="right">Interviewed</TableCell><TableCell align="right">Offers</TableCell><TableCell align="right">Hired</TableCell><TableCell align="right">Days</TableCell><TableCell align="right">Cost / hire</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
            <TableBody>
              {rq.map((r) => (
                <TableRow key={r.id} hover sx={{ cursor: "pointer" }} onClick={() => setFilter(r.id === filter ? "" : r.id)} selected={filter === r.id}>
                  <TableCell><Mono>{r.id}</Mono></TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{r.role}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{r.dept}</Typography></TableCell>
                  <TableCell>{fmtDate(r.open)}</TableCell>
                  <TableCell align="right">{r.n}</TableCell>
                  <TableCell align="right">{r.app}</TableCell>
                  <TableCell align="right">{r.scr}</TableCell>
                  <TableCell align="right">{r.int}</TableCell>
                  <TableCell align="right">{r.off}</TableCell>
                  <TableCell align="right">{r.acc}</TableCell>
                  <TableCell align="right">{r.days}</TableCell>
                  <TableCell align="right">{r.cph ? `₹${fmtNum(Math.round(r.cph))}` : "—"}</TableCell>
                  <TableCell>{r.closed ? <Tag tone="good">Filled</Tag> : r.days > 60 ? <Tag tone="bad">Aging</Tag> : r.days > 30 ? <Tag tone="warn">Watch</Tag> : <Tag tone="info">Open</Tag>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2.5 }}>
        <SectionCard title={`Pipeline${filter ? ` · ${roleOf(filter)}` : ""}`} subtitle="Move candidates through the stages; hiring someone starts their onboarding checklist" action={<Button size="small" variant="outlined" startIcon={<PersonAddAlt1Rounded />} onClick={() => { setCandDlg({ name: "", email: "", req_id: filter || open[0]?.id || "", source: "Careers page" }); setError(""); }}>Add candidate</Button>}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(5, 1fr)" }, gap: 1 }}>
            {STAGES.map(([k, l]) => (
              <Box key={k} sx={{ p: 1, borderRadius: 1.5, background: "#f4f7f3", minHeight: 120 }}>
                <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, color: "#46534a", mb: 0.8 }}>{l} · {cands.filter((c) => c.stage === k).length}</Typography>
                <Stack spacing={0.8}>
                  {cands.filter((c) => c.stage === k).map((c) => (
                    <Box key={c.id} sx={{ p: 1, borderRadius: 1, background: "#fff", border: "1px solid #e5eae5" }}>
                      <Typography sx={{ fontSize: "0.66rem", fontWeight: 700 }}>{c.name}</Typography>
                      <Typography sx={{ fontSize: "0.55rem", color: "#78827b" }}>{roleOf(c.req_id)} · {c.source}</Typography>
                      <Rating size="small" value={c.rating} onChange={(_, v) => moveCandidate(c.id, c.stage, v || 0)} sx={{ fontSize: "0.85rem" }} />
                      {k !== "hired" && (
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.4 }}>
                          <Button size="small" sx={{ fontSize: "0.55rem", p: 0, minWidth: 0 }} onClick={() => { const nxt = STAGES[STAGES.findIndex((s) => s[0] === k) + 1][0]; const r = moveCandidate(c.id, nxt); notifyToast(r.ok ? (nxt === "hired" ? `${c.name} hired; onboarding checklist created.` : `${c.name} moved to ${STAGES.find((s) => s[0] === nxt)[1]}.`) : r.error, r.ok ? "success" : "error"); }}>Advance</Button>
                          <Button size="small" color="error" sx={{ fontSize: "0.55rem", p: 0, minWidth: 0 }} onClick={() => moveCandidate(c.id, "rejected")}>Reject</Button>
                        </Stack>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
          {cands.some((c) => c.stage === "rejected") && <Typography sx={{ fontSize: "0.6rem", color: "#78827b", mt: 1 }}>{cands.filter((c) => c.stage === "rejected").length} rejected candidate(s) hidden.</Typography>}
        </SectionCard>
        <SectionCard title="Hiring funnel" subtitle="All requisitions">
          <Stack spacing={1.2}>{funnel.map(([l, v], i) => <HBar key={l} label={l} value={v} max={funnel[0][1]} right={i ? `${v} · ${Math.round((v / Math.max(1, funnel[i - 1][1])) * 100)}% of previous` : v} />)}</Stack>
        </SectionCard>
      </Box>
      <Dialog open={!!reqDlg} onClose={() => setReqDlg(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Open requisition</DialogTitle>
        <DialogContent>
          {reqDlg && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField label="Role *" value={reqDlg.role} onChange={(e) => setReqDlg({ ...reqDlg, role: e.target.value })} />
              <EntitySelect value={reqDlg.company_id} onChange={(v) => setReqDlg((d) => ({ ...d, company_id: v }))} />
              <FormControl size="small"><InputLabel>Department *</InputLabel><Select label="Department *" value={reqDlg.dept} onChange={(e) => setReqDlg({ ...reqDlg, dept: e.target.value })}>{data.orgUnits.filter((o) => o.parent_unit).map((o) => <MenuItem key={o.org_unit_id} value={o.org_unit_id}>{o.name}</MenuItem>)}</Select></FormControl>
              <Stack direction="row" spacing={2}>
                <TextField label="Seats *" value={reqDlg.n} onChange={(e) => setReqDlg({ ...reqDlg, n: e.target.value.replace(/\D/g, "") })} />
                <TextField label="Budget" value={reqDlg.cost} onChange={(e) => setReqDlg({ ...reqDlg, cost: e.target.value.replace(/\D/g, "") })} slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }} />
              </Stack>
              <FormControl size="small"><InputLabel>Hiring manager</InputLabel><Select label="Hiring manager" value={reqDlg.hiring_manager} onChange={(e) => setReqDlg({ ...reqDlg, hiring_manager: e.target.value })}>{data.employees.filter((e) => e.status === "active").map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name}</MenuItem>)}</Select></FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setReqDlg(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { const r = upsertReq(reqDlg); if (!r.ok) return setError(r.error); notifyToast("Requisition opened."); setReqDlg(null); }}>Open requisition</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!candDlg} onClose={() => setCandDlg(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add candidate</DialogTitle>
        <DialogContent>
          {candDlg && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField label="Name *" value={candDlg.name} onChange={(e) => setCandDlg({ ...candDlg, name: e.target.value })} />
              <TextField label="Email" value={candDlg.email} onChange={(e) => setCandDlg({ ...candDlg, email: e.target.value })} />
              <FormControl size="small"><InputLabel>Requisition *</InputLabel><Select label="Requisition *" value={candDlg.req_id} onChange={(e) => setCandDlg({ ...candDlg, req_id: e.target.value })}>{open.map((r) => <MenuItem key={r.id} value={r.id}>{r.id} · {r.role}</MenuItem>)}</Select></FormControl>
              <ListSelect listKey="candidate_source" size="small" blank={false} label="Source" value={candDlg.source} onChange={(v) => setCandDlg({ ...candDlg, source: v })} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setCandDlg(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { const r = addCandidate(candDlg); if (!r.ok) return setError(r.error); notifyToast("Candidate added."); setCandDlg(null); }}>Add candidate</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export function OnboardingView() {
  const { data, toggleOnbTask, setBuddy, notifyToast } = useStore();
  const T = data.onbTasks;
  const today = isoDate();
  const rows = data.onboarding.map((o) => {
    const day = Math.round((new Date(`${today}T12:00:00`) - new Date(`${o.doj}T12:00:00`)) / DAY);
    const overdue = T.filter((t, j) => !o.done[j] && day > t[1]).length;
    return { o, day, pct: Math.round((o.done.filter(Boolean).length / T.length) * 100), overdue };
  });
  return (
    <Stack spacing={2.5}>
      <Grid min={160}>
        <StatCard label="In onboarding" value={rows.length} />
        <StatCard label="Avg completion" value={`${Math.round(rows.reduce((s, r) => s + r.pct, 0) / Math.max(1, rows.length))}%`} tone="good" />
        <StatCard label="Overdue tasks" value={rows.reduce((s, r) => s + r.overdue, 0)} tone="bad" />
        <StatCard label="Starting in 30 days" value={rows.filter((r) => r.day < 0 && r.day >= -30).length} tone="info" />
      </Grid>
      <SectionCard title="Onboarding checklist" subtitle="Each task is due relative to the start date; overdue = not done and past its day" noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 1100 }}>
            <TableHead>
              <TableRow>
                <TableCell>New hire</TableCell>
                {T.map(([t, d]) => <TableCell key={t} align="center" sx={{ minWidth: 80 }}><Typography sx={{ fontSize: "0.55rem", fontWeight: 700, textTransform: "none" }}>{t}</Typography><Typography sx={{ fontSize: "0.5rem", color: "#8a948d" }}>Day {d < 0 ? d : `+${d}`}</Typography></TableCell>)}
                <TableCell>Buddy</TableCell><TableCell align="right">Done</TableCell><TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(({ o, day, pct, overdue }) => (
                <TableRow key={o.id}>
                  <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{o.name}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{o.role} · starts {fmtDate(o.doj)}</Typography></TableCell>
                  {T.map(([t, d], j) => (
                    <TableCell key={t} align="center">
                      <Checkbox size="small" checked={!!o.done[j]} onChange={() => { const r = toggleOnbTask(o.id, j); if (!r.ok) notifyToast(r.error, "error"); }} slotProps={{ input: { "aria-label": `${t} for ${o.name}` } }} sx={{ color: !o.done[j] && dueDate(o.doj, d) < today ? "#d32f2f" : undefined }} />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Select size="small" value={o.buddy || ""} displayEmpty onChange={(e) => setBuddy(o.id, e.target.value || null)} sx={{ fontSize: "0.62rem", minWidth: 130 }}>
                      <MenuItem value=""><em>None</em></MenuItem>
                      {data.employees.filter((e) => e.status === "active" && e.department === o.dept).map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name}</MenuItem>)}
                    </Select>
                  </TableCell>
                  <TableCell align="right">{pct}%</TableCell>
                  <TableCell>{overdue ? <Tag tone="bad">{overdue} overdue</Tag> : day < 0 ? <Tag tone="info">Pre-boarding</Tag> : pct === 100 ? <Tag tone="good">Complete</Tag> : <Tag tone="good">On track</Tag>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
    </Stack>
  );
}
