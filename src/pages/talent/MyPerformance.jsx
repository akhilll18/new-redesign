// Performance for employees (goals, review, feedback) and managers (team reviews).
import React, { useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, Dialog, FormControlLabel, Rating, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, LinearProgress, MenuItem, Select, Slider, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { AddRounded, EditRounded, DeleteOutlineRounded, ThumbUpAltRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Tag, TableWrap, PersonCell, EmptyState, KeyVal } from "../../components/kit/UI.jsx";
import { weightedScore, band } from "../../lib/hrcalc.js";
import { fmtDate, timeAgo } from "../../lib/utils.js";

export const STAGE_LABEL = { goal_setting: "Goal setting", self_review: "Self review", manager_review: "Manager review", calibration: "Calibration", closed: "Closed" };
const STAGES = Object.keys(STAGE_LABEL);

export function CycleSteps({ stage }) {
  const idx = STAGES.indexOf(stage);
  return (
    <Stack direction="row" sx={{ gap: 0.6, flexWrap: "wrap" }}>
      {STAGES.map((s, i) => (
        <Box key={s} sx={{ px: 1.2, py: 0.5, borderRadius: 99, fontSize: "0.6rem", fontWeight: 700, background: i < idx ? "#e8f2ec" : i === idx ? "#244d3d" : "#f8faf7", color: i < idx ? "#244d3d" : i === idx ? "#fff" : "#8a948d" }}>
          {i + 1}. {STAGE_LABEL[s]}
        </Box>
      ))}
    </Stack>
  );
}

export const GOAL_CATEGORY = { business: "Business / KPI", customer: "Customer", process: "Process improvement", development: "Learning & development", behaviour: "Behaviour & values" };

function GoalDialog({ goal, owner, onClose }) {
  const { data, upsertGoal, notifyToast } = useStore();
  const others = data.goals.filter((x) => x.employee_code === owner && x.id !== goal?.id).reduce((t, x) => t + x.weight, 0);
  const [g, setG] = useState(goal || { title: "", description: "", category: "business", target: "", weight: Math.max(5, Math.min(30, 100 - others || 20)), progress: 0, start: new Date().toISOString().slice(0, 10), due: "" });
  const [rebalance, setRebalance] = useState(true);
  const [error, setError] = useState("");
  const over = others + Number(g.weight || 0) > 100;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{goal ? "Update goal" : "Create a goal"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Goal *" value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} placeholder="e.g. Reduce ticket resolution time" autoFocus={!goal} />
          <FormControl size="small">
            <InputLabel>Category</InputLabel>
            <Select label="Category" value={g.category || "business"} onChange={(e) => setG({ ...g, category: e.target.value })}>
              {Object.entries(GOAL_CATEGORY).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Description" multiline minRows={2} value={g.description || ""} onChange={(e) => setG({ ...g, description: e.target.value })} helperText="Why it matters and how you plan to get there" />
          <TextField label="Measure of success (key result)" value={g.target} onChange={(e) => setG({ ...g, target: e.target.value })} helperText="Specific and measurable, e.g. “Average resolution under 8 hours by 31 Dec”" />
          <Stack direction="row" spacing={2}>
            <TextField label="Weight %" value={g.weight} onChange={(e) => setG({ ...g, weight: e.target.value.replace(/\D/g, "") })} sx={{ maxWidth: 110 }} />
            <TextField label="Start" type="date" value={g.start || ""} onChange={(e) => setG({ ...g, start: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Due" type="date" value={g.due} onChange={(e) => setG({ ...g, due: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
          {over && (
            <FormControlLabel control={<Checkbox size="small" checked={rebalance} onChange={(e) => setRebalance(e.target.checked)} />} label={<Typography sx={{ fontSize: "0.64rem" }}>Your other goals total {others}%. Rebalance them so all goals add up to 100%.</Typography>} />
          )}
          <Box>
            <Typography sx={{ fontSize: "0.62rem", color: "#78827b" }}>Progress {g.progress}%</Typography>
            <Slider value={Number(g.progress)} onChange={(_, v) => setG({ ...g, progress: v })} step={5} min={0} max={100} />
          </Box>
          <FormControl size="small">
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={g.status || "on_track"} onChange={(e) => setG({ ...g, status: e.target.value })}>
              <MenuItem value="on_track">On track</MenuItem>
              <MenuItem value="at_risk">At risk</MenuItem>
              <MenuItem value="done">Done</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { const r = upsertGoal({ ...g, employee_code: owner, rebalance: over && rebalance }); if (!r.ok) return setError(r.error); notifyToast(goal ? "Goal updated." : over && rebalance ? "Goal created; your other goal weights were rebalanced to 100%." : "Goal created."); onClose(); }}>{goal ? "Save goal" : "Create goal"}</Button>
      </DialogActions>
    </Dialog>
  );
}

export function GoalsTable({ owner, editable = true }) {
  const { data, removeGoal, notifyToast } = useStore();
  const [edit, setEdit] = useState(null);
  const goals = data.goals.filter((g) => g.employee_code === owner);
  const total = goals.reduce((s, g) => s + g.weight, 0);
  const score = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress * g.weight, 0) / Math.max(1, total)) : 0;
  return (
    <SectionCard title={editable ? "Goal setting" : "Goals"} subtitle={`${goals.length} goals · weights total ${total}% · weighted progress ${score}%`} action={editable && <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setEdit({})}>Create goal</Button>} noPad>
      {goals.length === 0 ? <EmptyState title="No goals yet" text="Create goals that add up to 100%." /> : (
        <TableWrap>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead><TableRow><TableCell>Goal</TableCell><TableCell align="right">Weight</TableCell><TableCell sx={{ width: 180 }}>Progress</TableCell><TableCell>Due</TableCell><TableCell>Status</TableCell>{editable && <TableCell />}</TableRow></TableHead>
            <TableBody>
              {goals.map((g) => (
                <TableRow key={g.id}>
                  <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{g.title}</Typography><Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{[g.category && GOAL_CATEGORY[g.category], g.target].filter(Boolean).join(" · ")}</Typography>{g.description && <Typography sx={{ fontSize: "0.58rem", color: "#9aa39c" }}>{g.description}</Typography>}</TableCell>
                  <TableCell align="right">{g.weight}%</TableCell>
                  <TableCell><LinearProgress variant="determinate" value={g.progress} color={g.status === "at_risk" ? "warning" : "primary"} sx={{ height: 6, borderRadius: 3 }} /><Typography sx={{ fontSize: "0.55rem", color: "#78827b" }}>{g.progress}% · updated {timeAgo(g.updated_at)}</Typography></TableCell>
                  <TableCell>{fmtDate(g.due)}</TableCell>
                  <TableCell><Tag tone={g.status === "done" ? "good" : g.status === "at_risk" ? "warn" : "info"}>{{ done: "Done", at_risk: "At risk", on_track: "On track" }[g.status]}</Tag></TableCell>
                  {editable && <TableCell align="right" sx={{ whiteSpace: "nowrap" }}><Button size="small" startIcon={<EditRounded sx={{ fontSize: 14 }} />} onClick={() => setEdit(g)}>Update</Button><Button size="small" color="error" aria-label="Remove goal" onClick={() => { const r = removeGoal(g.id); notifyToast(r.ok ? "Goal removed." : r.error, r.ok ? "success" : "error"); }}><DeleteOutlineRounded sx={{ fontSize: 16 }} /></Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      )}
      {edit && <GoalDialog goal={edit.id ? edit : null} owner={owner} onClose={() => setEdit(null)} />}
    </SectionCard>
  );
}

function ScoreInputs({ value, onChange, withPotential }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: withPotential ? "repeat(4, 1fr)" : "repeat(3, 1fr)" }, gap: 2 }}>
      {[["g", "Goals (50%)"], ["c", "Competencies (30%)"], ["v", "Values (20%)"]].map(([k, l]) => (
        <Box key={k}>
          <Typography sx={{ fontSize: "0.62rem", color: "#78827b" }}>{l}: <b>{value[k]}</b></Typography>
          <Slider value={Number(value[k])} onChange={(_, v) => onChange({ ...value, [k]: v })} step={0.1} min={1} max={5} />
        </Box>
      ))}
      {withPotential && (
        <Box>
          <Typography sx={{ fontSize: "0.62rem", color: "#78827b" }}>Potential</Typography>
          <ToggleButtonGroup exclusive size="small" value={Number(value.pot)} onChange={(_, v) => v && onChange({ ...value, pot: v })}>
            {[[1, "Low"], [2, "Med"], [3, "High"]].map(([v, l]) => <ToggleButton key={v} value={v} sx={{ fontSize: "0.6rem" }}>{l}</ToggleButton>)}
          </ToggleButtonGroup>
        </Box>
      )}
    </Box>
  );
}

function SelfReview({ e, rv }) {
  const { data, submitSelfReview, notifyToast } = useStore();
  const goals = data.goals.filter((g) => g.employee_code === e.employee_code);
  const start = rv.self_draft || rv.self || { g: 3.5, c: 3.5, v: 3.5, comments: "", strengths: "", improve: "", goals: {} };
  const [f, setF] = useState({ goals: {}, strengths: "", improve: "", ...start });
  const [editing, setEditing] = useState(!rv.self);
  const locked = !!rv.manager || ["calibration", "closed"].includes(data.cycle.stage);
  const setGoal = (id, patch) => {
    const goalsR = { ...f.goals, [id]: { ...(f.goals[id] || {}), ...patch } };
    const rated = goals.map((g) => [g, goalsR[g.id]?.rating]).filter(([, r]) => r);
    const tw = rated.reduce((t, [g]) => t + g.weight, 0);
    const gScore = tw ? Math.round((rated.reduce((t, [g, r]) => t + r * g.weight, 0) / tw) * 10) / 10 : f.g;
    setF({ ...f, goals: goalsR, g: gScore });
  };
  const submit = (draft) => {
    const r = submitSelfReview(f, { draft });
    notifyToast(r.ok ? (draft ? "Draft saved. Only you can see it." : rv.self ? "Self review updated; your manager was notified." : "Self review submitted to your manager.") : r.error, r.ok ? "success" : "error");
    if (r.ok && !draft) setEditing(false);
  };
  const subtitle = rv.self ? `Submitted ${timeAgo(rv.self.submitted_at)}${locked ? " · locked" : " · you can edit until your manager reviews"}` : rv.self_draft ? `Draft saved ${timeAgo(rv.self_draft.saved_at)}` : `Due ${fmtDate(data.cycle.self_due)}`;
  if (rv.self && !editing) {
    return (
      <SectionCard title="Self review" subtitle={subtitle} action={!locked && <Button size="small" startIcon={<EditRounded />} onClick={() => setEditing(true)}>Edit</Button>}>
        <KeyVal cols={4} items={[["Goals", rv.self.g], ["Competencies", rv.self.c], ["Values", rv.self.v], ["Weighted", weightedScore(rv.self).toFixed(2)], ["Achievements", rv.self.comments, { full: true }], rv.self.strengths ? ["Strengths", rv.self.strengths, { full: true }] : null, rv.self.improve ? ["Areas to develop", rv.self.improve, { full: true }] : null]} />
        {goals.some((g) => rv.self.goals?.[g.id]) && (
          <Box sx={{ mt: 2 }}>
            {goals.filter((g) => rv.self.goals?.[g.id]).map((g) => <Typography key={g.id} sx={{ fontSize: "0.64rem", py: 0.3 }}><b>{g.title}</b> · {rv.self.goals[g.id].rating || "—"}/5{rv.self.goals[g.id].comment ? ` · ${rv.self.goals[g.id].comment}` : ""}</Typography>)}
          </Box>
        )}
      </SectionCard>
    );
  }
  if (locked) return <SectionCard title="Self review" subtitle="Closed"><Typography sx={{ fontSize: "0.66rem", color: "#78827b" }}>Self reviews are closed for this cycle.</Typography></SectionCard>;
  return (
    <SectionCard title="Self review" subtitle={subtitle}>
      <Stack spacing={2}>
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700 }}>1. Rate each goal</Typography>
        {goals.length === 0 && <Typography sx={{ fontSize: "0.64rem", color: "#78827b" }}>You have no goals yet. Create them on the Goals tab first.</Typography>}
        {goals.map((g) => (
          <Box key={g.id} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1.3fr) 150px minmax(0,1.5fr)" }, gap: 1.2, alignItems: "center", p: 1.2, border: "1px solid #e8ece8", borderRadius: 1.5 }}>
            <Box><Typography sx={{ fontSize: "0.68rem", fontWeight: 700 }}>{g.title}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{g.weight}% · {g.progress}% done{g.target ? ` · ${g.target}` : ""}</Typography></Box>
            <Rating value={f.goals[g.id]?.rating || 0} onChange={(_, v) => setGoal(g.id, { rating: v || 0 })} aria-label={`Rate ${g.title}`} />
            <TextField size="small" placeholder="What you delivered / evidence" value={f.goals[g.id]?.comment || ""} onChange={(ev) => setGoal(g.id, { comment: ev.target.value })} />
          </Box>
        ))}
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700 }}>2. Overall ratings</Typography>
        <ScoreInputs value={f} onChange={(v) => setF({ ...f, ...v })} />
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700 }}>3. In your words</Typography>
        <TextField label="Key achievements *" multiline minRows={3} value={f.comments} onChange={(ev) => setF({ ...f, comments: ev.target.value })} helperText={`${f.comments.length} characters · at least 20`} />
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField fullWidth label="Strengths" multiline minRows={2} value={f.strengths} onChange={(ev) => setF({ ...f, strengths: ev.target.value })} />
          <TextField fullWidth label="Areas to develop" multiline minRows={2} value={f.improve} onChange={(ev) => setF({ ...f, improve: ev.target.value })} />
        </Stack>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Typography sx={{ fontSize: "0.65rem", color: "#78827b" }}>Weighted {weightedScore(f).toFixed(2)} · {band(weightedScore(f))[0]}</Typography>
          <Stack direction="row" spacing={1}>
            {rv.self && <Button color="inherit" onClick={() => setEditing(false)}>Cancel</Button>}
            <Button variant="outlined" onClick={() => submit(true)}>Save draft</Button>
            <Button variant="contained" onClick={() => submit(false)}>{rv.self ? "Resubmit self review" : "Submit self review"}</Button>
          </Stack>
        </Stack>
      </Stack>
    </SectionCard>
  );
}

export default function MyPerformance() {
  const { data, user, giveFeedback, notifyToast, nameOf } = useStore();
  const [tab, setTab] = useState("goals");
  const e = data.employees.find((x) => x.employee_code === user.employee_code);
  const rv = data.reviews[e.employee_code] || {};
  const [fb, setFb] = useState({ to: "", type: "praise", text: "", visibility: "public" });
  const perf = data.perf[e.employee_code];
  const final = data.cycle.stage === "closed" ? perf : null;
  const received = data.feedback.filter((f) => f.to === e.employee_code);
  const given = data.feedback.filter((f) => f.from === e.employee_code);
  const colleagues = data.employees.filter((x) => x.status === "active" && x.employee_code !== e.employee_code);
  return (
    <>
      <PageHeader eyebrow="ME · PERFORMANCE" title="Performance" subtitle={`${data.cycle.name}. Self reviews due ${fmtDate(data.cycle.self_due)}, manager reviews ${fmtDate(data.cycle.manager_due)}.`} />
      <Stack spacing={2.5}>
        <SectionCard><CycleSteps stage={data.cycle.stage} /></SectionCard>
        {/* v10.6: no upper tab bar — goals, review and feedback are on one page; the links jump to each section. */}
        <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: "wrap" }}>
          {[["perf-goals", "Goals"], ["perf-review", rv.self ? "Review" : "Review · self review due"], ["perf-feedback", `Feedback (${received.length})`]].map(([id, l]) => <Chip key={id} label={l} clickable onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })} sx={{ fontWeight: 700, bgcolor: "#F1ECFA", color: "#7E57C2" }} />)}
        </Stack>
        <Box id="perf-goals" sx={{ scrollMarginTop: 80 }}><GoalsTable owner={e.employee_code} editable /></Box>
        {(
          <Stack id="perf-review" spacing={2.5} sx={{ scrollMarginTop: 80 }}>
            {final && (
              <Grid min={170}>
                <StatCard label="Final weighted score" value={weightedScore(final).toFixed(2)} tone="good" hint="0.5 goals + 0.3 competencies + 0.2 values" />
                <StatCard label="Rating band" value={band(weightedScore(final))[0]} tone="info" hint={`Merit ${band(weightedScore(final))[1]}%`} />
              </Grid>
            )}
            <SelfReview e={e} rv={rv} />
            <SectionCard title="Manager review" subtitle={rv.manager ? `${nameOf(rv.manager.by)} · ${timeAgo(rv.manager.submitted_at)}` : `Waiting for ${e.reporting_manager ? nameOf(e.reporting_manager) : "your manager"}`}>
              {rv.manager ? <KeyVal cols={4} items={[["Goals", rv.manager.g], ["Competencies", rv.manager.c], ["Values", rv.manager.v], ["Weighted", weightedScore(rv.manager).toFixed(2)], ["Summary", rv.manager.comments, { full: true }]]} /> : <Typography sx={{ fontSize: "0.66rem", color: "#78827b" }}>Your manager's review appears here once submitted. Final ratings are confirmed after HR calibration.</Typography>}
            </SectionCard>
          </Stack>
        )}
        {(
          <Box id="perf-feedback" sx={{ scrollMarginTop: 80, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2.5 }}>
            <SectionCard title="Give feedback">
              <Stack spacing={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Colleague</InputLabel>
                  <Select label="Colleague" value={fb.to} onChange={(ev) => setFb({ ...fb, to: ev.target.value })}>
                    {colleagues.map((c) => <MenuItem key={c.employee_code} value={c.employee_code}>{c.full_name} · {c.department}</MenuItem>)}
                  </Select>
                </FormControl>
                <ToggleButtonGroup exclusive size="small" value={fb.type} onChange={(_, v) => v && setFb({ ...fb, type: v })}>
                  <ToggleButton value="praise" sx={{ fontSize: "0.62rem" }}>Praise</ToggleButton>
                  <ToggleButton value="suggestion" sx={{ fontSize: "0.62rem" }}>Suggestion</ToggleButton>
                </ToggleButtonGroup>
                <TextField label="Your feedback" multiline minRows={3} value={fb.text} onChange={(ev) => setFb({ ...fb, text: ev.target.value })} />
                <FormControl size="small">
                  <InputLabel>Who can see it</InputLabel>
                  <Select label="Who can see it" value={fb.visibility} onChange={(ev) => setFb({ ...fb, visibility: ev.target.value })}>
                    <MenuItem value="public">Everyone (praise wall)</MenuItem>
                    <MenuItem value="private">Only them and their manager</MenuItem>
                  </Select>
                </FormControl>
                <Button variant="contained" startIcon={<ThumbUpAltRounded />} onClick={() => { const r = giveFeedback(fb); if (!r.ok) return notifyToast(r.error, "error"); notifyToast("Feedback sent."); setFb({ to: "", type: "praise", text: "", visibility: "public" }); }}>Send feedback</Button>
              </Stack>
            </SectionCard>
            <SectionCard title="Received" noPad>
              {received.length === 0 ? <Typography sx={{ p: 2, fontSize: "0.66rem", color: "#78827b" }}>No feedback yet.</Typography> : received.map((f) => (
                <Box key={f.id} sx={{ px: 2, py: 1.3, borderBottom: "1px solid #f0f2ef" }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.4 }}>
                    <Tag tone={f.type === "praise" ? "good" : "info"}>{f.type === "praise" ? "Praise" : "Suggestion"}</Tag>
                    <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{nameOf(f.from)} · {timeAgo(f.at)}</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: "0.7rem" }}>{f.text}</Typography>
                </Box>
              ))}
              {given.length > 0 && <Typography sx={{ p: 1.5, fontSize: "0.6rem", color: "#9aa39c" }}>You have given {given.length} piece{given.length > 1 ? "s" : ""} of feedback.</Typography>}
            </SectionCard>
          </Box>
        )}
      </Stack>
    </>
  );
}

export function TeamReviews() {
  const { data, user, reportsOf, submitManagerReview, notifyToast } = useStore();
  const team = reportsOf(user.employee_code).filter((e) => e.status === "active");
  const [open, setOpen] = useState(null);
  const [s, setS] = useState(null);
  const [goalsOf, setGoalsOf] = useState(null);
  return (
    <>
      <PageHeader eyebrow="MY TEAM · PERFORMANCE" title="Team reviews" subtitle={`${data.cycle.name}. Manager reviews due ${fmtDate(data.cycle.manager_due)}.`} />
      <Stack spacing={2.5}>
        <SectionCard><CycleSteps stage={data.cycle.stage} /></SectionCard>
        <SectionCard title="Direct reports" noPad>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead><TableRow><TableCell>Employee</TableCell><TableCell align="right">Goal progress</TableCell><TableCell>Self review</TableCell><TableCell>Your review</TableCell><TableCell align="right">Weighted</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {team.map((e) => {
                  const rv = data.reviews[e.employee_code] || {};
                  const goals = data.goals.filter((g) => g.employee_code === e.employee_code);
                  const gp = goals.length ? Math.round(goals.reduce((x, g) => x + g.progress * g.weight, 0) / Math.max(1, goals.reduce((x, g) => x + g.weight, 0))) : 0;
                  return (
                    <TableRow key={e.employee_code}>
                      <TableCell><PersonCell name={e.full_name} sub={e.designation} /></TableCell>
                      <TableCell align="right"><Button size="small" onClick={() => setGoalsOf(e.employee_code)}>{gp}%</Button></TableCell>
                      <TableCell>{rv.self ? <Tag tone="good">Submitted · {weightedScore(rv.self).toFixed(2)}</Tag> : <Tag>Not yet</Tag>}</TableCell>
                      <TableCell>{rv.manager ? <Tag tone="good">Done · {weightedScore(rv.manager).toFixed(2)}</Tag> : <Tag tone="warn">To do</Tag>}</TableCell>
                      <TableCell align="right">{rv.manager ? `${weightedScore(rv.manager).toFixed(2)} · ${band(weightedScore(rv.manager))[0]}` : "—"}</TableCell>
                      <TableCell align="right"><Button size="small" variant={rv.manager ? "text" : "contained"} disabled={!["self_review", "manager_review"].includes(data.cycle.stage)} onClick={() => { setOpen(e); setS(rv.manager || { g: rv.self?.g || 3.5, c: rv.self?.c || 3.5, v: rv.self?.v || 3.5, pot: e.potential || 2, comments: "" }); }}>{rv.manager ? "Edit" : "Review"}</Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
        {goalsOf && <GoalsTable owner={goalsOf} />}
      </Stack>
      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Review {open?.full_name}</DialogTitle>
        <DialogContent>
          {open && s && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {data.reviews[open.employee_code]?.self && <Alert severity="info">Self review: {data.reviews[open.employee_code].self.g} / {data.reviews[open.employee_code].self.c} / {data.reviews[open.employee_code].self.v} — “{data.reviews[open.employee_code].self.comments}”</Alert>}
              <ScoreInputs value={s} onChange={setS} withPotential />
              <TextField label="Summary for the employee *" multiline minRows={3} value={s.comments} onChange={(ev) => setS({ ...s, comments: ev.target.value })} />
              <Typography sx={{ fontSize: "0.65rem", color: "#78827b" }}>Weighted {weightedScore(s).toFixed(2)} · {band(weightedScore(s))[0]} · merit {band(weightedScore(s))[1]}% (confirmed at calibration)</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setOpen(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { const r = submitManagerReview(open.employee_code, s); if (!r.ok) return notifyToast(r.error, "error"); notifyToast(`Review for ${open.full_name} submitted to HR.`); setOpen(null); }}>Submit review</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
