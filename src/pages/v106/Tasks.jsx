// v10.6 · Task & project management: admins and managers assign tasks under projects with due dates and priority;
// employees update status from My tasks. A board (To do · In progress · Done) and an overdue list.
import React, { useMemo, useState } from "react";
import { Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { AddTaskRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, StatCard, Grid, EmptyState } from "../../components/kit/UI.jsx";
import { fmtDate, isoDate } from "../../lib/utils.js";

const COLS = [["todo", "To do", "#1E88E5", "#E7F2FD"], ["doing", "In progress", "#F27C22", "#FEF1E6"], ["done", "Done", "#1F9D63", "#E6F6EE"]];
const PRI = { high: ["High", "#E53950"], normal: ["Normal", "#1E88E5"], low: ["Low", "#66767E"] };

export default function Tasks({ mine: mineOnly }) {
  const { data, user, nameOf, suiteDo, notifyToast, reportsOf } = useStore();
  const me = user.employee_code || user.code;
  const isMgr = user.role === "emp" && reportsOf(user.employee_code).length > 0;
  const canAssign = user.role !== "emp" || isMgr;
  const all = data.suite?.tasks || [];
  const [project, setProject] = useState("all");
  const [scope, setScope] = useState(mineOnly && !isMgr ? "mine" : "all");
  const [open, setOpen] = useState(false);
  const people = user.role === "emp" ? [data.employees.find((e) => e.employee_code === me), ...reportsOf(me)].filter(Boolean) : data.employees.filter((e) => e.status === "active");
  const visible = all.filter((t) => (user.role !== "emp" || t.assignee === me || t.by === me || reportsOf(me).some((r) => r.employee_code === t.assignee)) && (scope !== "mine" || t.assignee === me) && (project === "all" || t.project === project));
  const projects = [...new Set(all.map((t) => t.project).filter(Boolean))];
  const today = isoDate();
  const overdue = visible.filter((t) => t.status !== "done" && t.due && t.due < today);
  const [f, setF] = useState({ title: "", project: "", assignee: people[0]?.employee_code || "", due: isoDate(new Date(Date.now() + 7 * 86400000)), priority: "normal", note: "" });

  function create() {
    if (!f.title.trim() || !f.assignee) return notifyToast("Enter the task and pick who does it.", "error");
    const r = suiteDo(user.role === "emp" ? "self106" : "admin106", (s, { now, code }) => { s.tasks = [{ id: `TSK-${String((s.tasks || []).length + 1).padStart(4, "0")}`, ...f, title: f.title.trim(), project: f.project.trim() || "General", status: "todo", by: code, at: now }, ...(s.tasks || [])]; }, { action: "TASK_CREATE", details: f.title, note: { to: f.assignee, text: `New task for you: ${f.title}${f.due ? ` (due ${fmtDate(f.due)})` : ""}.`, link: user.role === "emp" ? "/my-tasks" : "/my-tasks" } });
    if (r.ok) { notifyToast("Task assigned."); setOpen(false); setF({ ...f, title: "", note: "" }); }
  }
  const move = (t, status) => suiteDo(user.role === "emp" ? "self106" : "admin106", (s, { now }) => { const x = s.tasks.find((y) => y.id === t.id); if (x) { x.status = status; x.updated_at = now; } }, { action: "TASK_STATUS", details: `${t.id} → ${status}`, note: t.by !== me ? { to: t.by, text: `${nameOf(me)} moved "${t.title}" to ${COLS.find((c) => c[0] === status)[1]}.`, link: "/tasks" } : undefined });

  return (
    <>
      <PageHeader title={mineOnly ? "My tasks" : "Tasks & projects"} subtitle={mineOnly ? "Tasks assigned to you (and, for managers, your team). Move a card as you work on it." : "Assign tasks under projects, track progress and catch overdue work."} actions={canAssign ? <Button variant="contained" startIcon={<AddTaskRounded />} onClick={() => setOpen(true)}>New task</Button> : null} />
      <Grid min={160} sx={{ mb: 2 }}>
        {COLS.map(([k, l]) => <StatCard key={k} label={l} value={visible.filter((t) => t.status === k).length} tone={k === "done" ? "good" : k === "doing" ? "warn" : "info"} />)}
        <StatCard label="Overdue" value={overdue.length} tone={overdue.length ? "bad" : "good"} />
      </Grid>
      <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 1.5, flexWrap: "wrap" }}>
        {isMgr && <TextField select size="small" value={scope} onChange={(e) => setScope(e.target.value)} sx={{ minWidth: 160 }}><MenuItem value="mine">Assigned to me</MenuItem><MenuItem value="all">Me and my team</MenuItem></TextField>}
        <TextField select size="small" value={project} onChange={(e) => setProject(e.target.value)} sx={{ minWidth: 200 }}><MenuItem value="all">All projects</MenuItem>{projects.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}</TextField>
      </Stack>
      {visible.length === 0 ? <Card><EmptyState title="No tasks" text={canAssign ? "Create a task and assign it." : "Tasks assigned to you appear here."} /></Card> : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0,1fr))" }, gap: 1.5 }}>
          {COLS.map(([k, l, c, bg]) => (
            <Box key={k} sx={{ p: 1, borderRadius: 3, background: bg, minHeight: 200 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "0.76rem", color: c, px: 0.5, mb: 1 }}>{l} · {visible.filter((t) => t.status === k).length}</Typography>
              <Stack spacing={1}>
                {visible.filter((t) => t.status === k).map((t) => (
                  <Card key={t.id} sx={{ p: 1.2, borderLeft: `4px solid ${PRI[t.priority]?.[1] || c}` }}>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.74rem" }}>{t.title}</Typography>
                    <Typography sx={{ fontSize: "0.6rem", color: "#6b777c" }}>{t.project} · {nameOf(t.assignee)}{t.due ? ` · due ${fmtDate(t.due)}` : ""}</Typography>
                    {t.note && <Typography sx={{ fontSize: "0.62rem", mt: 0.4 }}>{t.note}</Typography>}
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.8, alignItems: "center" }}>
                      <Chip size="small" label={PRI[t.priority]?.[0]} sx={{ height: 18, fontSize: "0.55rem", bgcolor: `${PRI[t.priority]?.[1]}1a`, color: PRI[t.priority]?.[1], fontWeight: 700 }} />
                      {t.status !== "done" && t.due && t.due < today && <Chip size="small" label="Overdue" sx={{ height: 18, fontSize: "0.55rem", bgcolor: "#FDECEE", color: "#E53950", fontWeight: 700 }} />}
                      <Box sx={{ flex: 1 }} />
                      {COLS.filter(([k2]) => k2 !== k).map(([k2, l2]) => <Button key={k2} size="small" sx={{ minWidth: 0, fontSize: "0.58rem", px: 0.6 }} onClick={() => move(t, k2)}>{l2}</Button>)}
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>New task</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField label="Task *" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <TextField label="Project" value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} placeholder="e.g. Payroll go-live, Q4 hiring" helperText={projects.length ? `Existing: ${projects.join(", ")}` : " "} />
            <Stack direction="row" spacing={1.5}>
              <TextField select label="Assign to *" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })} sx={{ flex: 1 }}>{people.map((p) => <MenuItem key={p.employee_code} value={p.employee_code}>{p.full_name}</MenuItem>)}</TextField>
              <TextField select label="Priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} sx={{ width: 130 }}>{Object.entries(PRI).map(([k, [l]]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}</TextField>
              <TextField type="date" label="Due" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            <TextField label="Notes" multiline minRows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={create}>Assign</Button></DialogActions>
      </Dialog>
    </>
  );
}
