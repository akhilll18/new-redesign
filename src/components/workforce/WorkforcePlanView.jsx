// Workforce management (plan vs budget, span of control, shift roster) and Learning courses / training hours.
import React, { useState } from "react";
import { Box, FormControl, IconButton, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, Button } from "@mui/material";
import { EditRounded, CheckRounded, AddRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap, HBar } from "../kit/UI.jsx";
import { COUNTRIES } from "../../lib/payroll/index.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHIFT_TONE = { G: "#e8f2ec", M: "#fff3dd", N: "#e4ecf7", O: "#f1f2f0" };

export function WorkforcePlanView({ employees }) {
  const { data, setBudget, setRoster, addToRoster, notifyToast } = useStore();
  const active = employees.filter((e) => e.status === "active");
  const depts = [...new Set(active.map((e) => e.department))];
  const [edit, setEdit] = useState(null);
  const inr = (e) => e.monthly_gross * (data.fx[COUNTRIES[e.country_code || "IN"]?.currency] || 1);
  const rows = depts.map((d) => {
    const list = active.filter((e) => e.department === d);
    const b = data.budget[d] || { hc: 0, cost: 0 };
    const cost = list.reduce((s, e) => s + inr(e), 0);
    const openN = data.reqs.filter((r) => r.dept === d && !r.closed).reduce((s, r) => s + r.n, 0);
    return { d, list, b, cost, openN };
  });
  const managers = active.filter((m) => active.some((e) => e.reporting_manager === m.employee_code)).map((m) => ({ m, n: active.filter((e) => e.reporting_manager === m.employee_code).length }));
  const rostered = Object.keys(data.roster).map((c) => active.find((e) => e.employee_code === c)).filter(Boolean);
  const notRostered = active.filter((e) => !data.roster[e.employee_code]);
  const coverage = DAYS.map((_, i) => ["M", "G", "N"].map((s) => rostered.filter((e) => data.roster[e.employee_code][i] === s).length));
  const totalB = rows.reduce((s, r) => s + r.b.cost, 0);
  const totalC = rows.reduce((s, r) => s + r.cost, 0);
  const save = () => {
    const r = setBudget(edit.d, { hc: Number(edit.hc), cost: Number(edit.cost) });
    notifyToast(r.ok ? `${edit.d} plan saved.` : r.error, r.ok ? "success" : "error");
    setEdit(null);
  };
  return (
    <Stack spacing={2.5}>
      <Grid min={160}>
        <StatCard label="Headcount vs plan" value={`${active.length} / ${rows.reduce((s, r) => s + r.b.hc, 0)}`} />
        <StatCard label="Monthly cost vs budget" value={`${Math.round((totalC / Math.max(1, totalB)) * 100)}%`} tone={totalC > totalB ? "bad" : "good"} hint={`₹${(totalC / 100000).toFixed(1)} L of ₹${(totalB / 100000).toFixed(1)} L`} />
        <StatCard label="Open positions" value={rows.reduce((s, r) => s + r.openN, 0)} tone="info" />
      </Grid>
      <SectionCard title="Department plan" subtitle="Monthly cost in ₹ at today's exchange rates" noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead><TableRow><TableCell>Department</TableCell><TableCell align="right">Actual</TableCell><TableCell align="right">Plan</TableCell><TableCell align="right">Open</TableCell><TableCell align="right">Cost / month</TableCell><TableCell align="right">Budget / month</TableCell><TableCell sx={{ width: 180 }}>Use of budget</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {rows.map((r) => {
                const pct = r.b.cost ? (r.cost / r.b.cost) * 100 : 0;
                const editing = edit?.d === r.d;
                return (
                  <TableRow key={r.d}>
                    <TableCell sx={{ fontWeight: 700 }}>{r.d}</TableCell>
                    <TableCell align="right">{r.list.length}</TableCell>
                    <TableCell align="right">{editing ? <TextField size="small" type="number" value={edit.hc} onChange={(e) => setEdit({ ...edit, hc: e.target.value })} sx={{ width: 70 }} slotProps={{ htmlInput: { "aria-label": "Planned headcount" } }} /> : r.b.hc}</TableCell>
                    <TableCell align="right">{r.openN || "—"}</TableCell>
                    <TableCell align="right">₹{Math.round(r.cost).toLocaleString("en-IN")}</TableCell>
                    <TableCell align="right">{editing ? <TextField size="small" type="number" value={edit.cost} onChange={(e) => setEdit({ ...edit, cost: e.target.value })} sx={{ width: 120 }} slotProps={{ htmlInput: { "aria-label": "Monthly budget" } }} /> : `₹${r.b.cost.toLocaleString("en-IN")}`}</TableCell>
                    <TableCell><HBar label="" value={Math.min(r.cost, r.b.cost || r.cost)} max={r.b.cost || r.cost || 1} right={`${Math.round(pct)}%`} color={pct > 100 ? "#C2452D" : pct > 90 ? "#D07A1F" : "#1A9A72"} /></TableCell>
                    <TableCell align="right">{editing ? <IconButton size="small" aria-label="Save plan" onClick={save}><CheckRounded fontSize="small" /></IconButton> : <IconButton size="small" aria-label={`Edit ${r.d} plan`} onClick={() => setEdit({ d: r.d, hc: r.b.hc, cost: r.b.cost })}><EditRounded fontSize="small" /></IconButton>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
        <SectionCard title={`Shift roster · week of ${new Date(`${data.rosterWeek}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`} subtitle="Choose a shift to change it. Coverage counts morning / general / night." action={notRostered.length > 0 && (
          <FormControl size="small"><Select displayEmpty value="" onChange={(e) => addToRoster(e.target.value)} renderValue={() => <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}><AddRounded sx={{ fontSize: 16 }} /><span>Add person</span></Stack>} sx={{ fontSize: "0.65rem" }}>{notRostered.map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name}</MenuItem>)}</Select></FormControl>
        )} noPad>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead><TableRow><TableCell>Employee</TableCell>{DAYS.map((d) => <TableCell key={d} align="center">{d}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {rostered.map((e) => (
                  <TableRow key={e.employee_code}>
                    <TableCell><PersonCell name={e.full_name} sub={e.designation} /></TableCell>
                    {DAYS.map((d, i) => {
                      const s = data.roster[e.employee_code][i];
                      return (
                        <TableCell key={d} align="center" sx={{ p: 0.5 }}>
                          <Select size="small" value={s} onChange={(ev) => setRoster(e.employee_code, i, ev.target.value)} sx={{ fontSize: "0.62rem", background: SHIFT_TONE[s], minWidth: 54, "& .MuiSelect-select": { py: 0.5 } }}>
                            {Object.entries(data.shifts).map(([k, [l]]) => <MenuItem key={k} value={k}>{k} · {l}</MenuItem>)}
                          </Select>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Coverage M / G / N</TableCell>
                  {coverage.map((c, i) => <TableCell key={i} align="center"><Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: c[2] === 0 && i < 5 ? "#C2452D" : "inherit" }}>{c.join(" / ")}</Typography></TableCell>)}
                </TableRow>
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
        {/* v10.6: span of control removed from Workforce management. */}
      </Box>
    </Stack>
  );
}

export function CoursesView({ employees }) {
  const { data } = useStore();
  const active = employees.filter((e) => e.status === "active");
  const hrs = active.map((e) => ({ e, h: data.trainH[e.employee_code] || 0 }));
  const avg = hrs.reduce((s, r) => s + r.h, 0) / Math.max(1, hrs.length);
  const spend = data.courses.reduce((s, c) => s + c.cost * c.en, 0);
  return (
    <Stack spacing={2.5}>
      <Grid min={160}>
        <StatCard label="Courses" value={data.courses.length} />
        <StatCard label="Avg training hours" value={avg.toFixed(1)} hint="This year, per person" tone="info" />
        <StatCard label="Below 8 hours" value={hrs.filter((r) => r.h < 8).length} tone="warn" />
        <StatCard label="External spend" value={`₹${spend.toLocaleString("en-IN")}`} tone="neutral" />
      </Grid>
      <SectionCard title="Courses" subtitle="Completion and the change in assessment score" noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead><TableRow><TableCell>Course</TableCell><TableCell>Provider</TableCell><TableCell align="right">Hours</TableCell><TableCell align="right">Enrolled</TableCell><TableCell align="right">Completed</TableCell><TableCell align="right">Score before → after</TableCell><TableCell align="right">Cost per completion</TableCell></TableRow></TableHead>
            <TableBody>
              {data.courses.map((c) => (
                <TableRow key={c.t}>
                  <TableCell sx={{ fontWeight: 700 }}>{c.t}</TableCell>
                  <TableCell><Tag tone={c.p === "Internal" ? "good" : "info"}>{c.p}</Tag></TableCell>
                  <TableCell align="right">{c.h}</TableCell>
                  <TableCell align="right">{c.en}</TableCell>
                  <TableCell align="right">{c.co} ({Math.round((c.co / c.en) * 100)}%)</TableCell>
                  <TableCell align="right">{c.pre} → {c.post} <Typography component="span" sx={{ fontSize: "0.6rem", color: "#1A9A72", fontWeight: 700 }}>+{c.post - c.pre}</Typography></TableCell>
                  <TableCell align="right">{c.cost ? `₹${Math.round((c.cost * c.en) / Math.max(1, c.co)).toLocaleString("en-IN")}` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <ManualMarks employees={active} />
      <SectionCard title="Training hours by person" subtitle="Target 16 hours a year">
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, columnGap: 3, rowGap: 1 }}>
          {hrs.sort((a, b) => b.h - a.h).map((r) => <HBar key={r.e.employee_code} label={r.e.full_name} value={r.h} max={30} right={`${r.h} h`} color={r.h < 8 ? "#D07A1F" : "#1A9A72"} />)}
        </Box>
      </SectionCard>
    </Stack>
  );
}

// v10.6 · Manual marks: HR / L&D enters assessment marks per person per course (classroom tests, practicals, etc.).
function ManualMarks({ employees }) {
  const { data, suiteDo, notifyToast, nameOf } = useStore();
  const list = data.suite?.learningMarks || [];
  const [f, setF] = useState({ course: data.courses[0]?.t || "", emp: employees[0]?.employee_code || "", pre: "", post: "", max: 100, hours: "", status: "completed" });
  function save() {
    if (!f.course || !f.emp || f.post === "" || Number(f.post) > Number(f.max)) return notifyToast("Pick the course and person and enter marks (not above the maximum).", "error");
    const r = suiteDo("admin106", (s, { now, code }) => {
      s.learningMarks = (s.learningMarks || []).filter((m) => !(m.course === f.course && m.emp === f.emp));
      s.learningMarks.unshift({ ...f, pre: f.pre === "" ? null : Number(f.pre), post: Number(f.post), max: Number(f.max) || 100, hours: Number(f.hours) || 0, by: code, at: now });
    }, { action: "LEARNING_MARKS", details: `${f.course} · ${f.emp} · ${f.post}/${f.max}`, note: { to: f.emp, text: `Your marks for "${f.course}" were recorded: ${f.post}/${f.max}.`, link: "/learning" } });
    if (r.ok) { notifyToast("Marks saved."); setF({ ...f, pre: "", post: "", hours: "" }); }
  }
  return (
    <SectionCard title="Manual marks update" subtitle="Record assessment marks and training hours by hand — for classroom sessions, practical tests and external courses." noPad>
      <Stack direction={{ xs: "column", lg: "row" }} spacing={1.2} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <TextField select size="small" label="Course" value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })} sx={{ minWidth: 220 }}>{data.courses.map((c) => <MenuItem key={c.t} value={c.t}>{c.t}</MenuItem>)}</TextField>
        <TextField select size="small" label="Employee" value={f.emp} onChange={(e) => setF({ ...f, emp: e.target.value })} sx={{ minWidth: 200 }}>{employees.map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name}</MenuItem>)}</TextField>
        <TextField size="small" type="number" label="Pre-test" value={f.pre} onChange={(e) => setF({ ...f, pre: e.target.value })} sx={{ width: 100 }} />
        <TextField size="small" type="number" label="Marks *" value={f.post} onChange={(e) => setF({ ...f, post: e.target.value })} sx={{ width: 100 }} />
        <TextField size="small" type="number" label="Out of" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} sx={{ width: 90 }} />
        <TextField size="small" type="number" label="Hours" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} sx={{ width: 90 }} />
        <TextField select size="small" label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} sx={{ width: 140 }}>{["completed", "passed", "failed", "in progress"].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>
        <Button variant="contained" onClick={save}>Save marks</Button>
      </Stack>
      <TableWrap>
        <Table size="small" sx={{ minWidth: 760 }}>
          <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Course</TableCell><TableCell align="right">Pre</TableCell><TableCell align="right">Marks</TableCell><TableCell align="right">%</TableCell><TableCell align="right">Hours</TableCell><TableCell>Status</TableCell><TableCell>Entered by</TableCell></TableRow></TableHead>
          <TableBody>
            {list.map((m, i) => <TableRow key={i}><TableCell>{nameOf(m.emp)}</TableCell><TableCell>{m.course}</TableCell><TableCell align="right">{m.pre ?? "—"}</TableCell><TableCell align="right">{m.post}/{m.max}</TableCell><TableCell align="right">{Math.round((m.post / m.max) * 100)}%</TableCell><TableCell align="right">{m.hours || "—"}</TableCell><TableCell><Tag tone={m.status === "failed" ? "bad" : m.status === "in progress" ? "warn" : "good"}>{m.status}</Tag></TableCell><TableCell>{nameOf(m.by)}</TableCell></TableRow>)}
            {list.length === 0 && <TableRow><TableCell colSpan={8}><Typography variant="body2" color="text.secondary">No marks entered yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableWrap>
    </SectionCard>
  );
}
