// Talent administration: performance cycle and calibration (Sahayog 03), 9-box and flight risk (09), succession (10).
import { GoalsTable } from "../../pages/talent/MyPerformance.jsx";
import React, { useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { EditRounded, AddRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap } from "../kit/UI.jsx";
import { CycleSteps, STAGE_LABEL } from "../../pages/talent/MyPerformance.jsx";
import { weightedScore, band, perfLevel, flightRisk } from "../../lib/hrcalc.js";
import { fmtNum, fmtDate } from "../../lib/utils.js";

const toINR = (data, e, v) => v * (data.fx[{ IN: "INR", GB: "GBP", US: "USD", AE: "AED", SG: "SGD", NA: "NAD", ZA: "ZAR", KE: "KES", NG: "NGN", BW: "BWP", CA: "CAD", MX: "MXN", BR: "BRL", DE: "EUR", FR: "EUR", IE: "EUR", SA: "SAR", MY: "MYR", PH: "PHP", ID: "IDR", GH: "GHS", ZM: "ZMW" }[e.country_code || "IN"]] || 1);

export function PerformanceAdminView({ employees }) {
  const { data, calibrate, setCycleStage, updateSettings, notifyToast } = useStore();
  const [edit, setEdit] = useState(null);
  const [s, setS] = useState(null);
  const active = employees.filter((e) => e.status === "active");
  const cutoff = data.cycle.cutoff;
  const rows = active.map((e) => {
    const p = data.perf[e.employee_code] || { g: 3, c: 3, v: 3, pot: 2 };
    const sc = weightedScore(p);
    const b = band(sc);
    const elig = e.date_of_joining < cutoff;
    const m = elig ? b[1] : 0;
    return { e, p, sc, b, elig, m, rv: data.reviews[e.employee_code] || {}, cost: toINR(data, e, e.monthly_gross * 12 * (m / 100)) };
  });
  const payroll = active.reduce((x, e) => x + toINR(data, e, e.monthly_gross * 12), 0);
  const budget = (payroll * data.settings.merit_budget_pct) / 100;
  const spend = rows.reduce((x, r) => x + r.cost, 0);
  const dist = ["Outstanding", "Exceeds", "Meets", "Needs improvement", "Unsatisfactory"].map((l) => [l, rows.filter((r) => r.b[0] === l).length]);
  const stages = Object.keys(STAGE_LABEL);
  const next = stages[stages.indexOf(data.cycle.stage) + 1];

  return (
    <Stack spacing={2.5}>
      <SectionCard title={data.cycle.name} subtitle={`Self ${fmtDate(data.cycle.self_due)} · manager ${fmtDate(data.cycle.manager_due)} · calibration ${fmtDate(data.cycle.calibration_due)} · merit eligibility: joined before ${fmtDate(cutoff)}`} action={next && <Button variant="contained" size="small" onClick={() => { const r = setCycleStage(next); notifyToast(r.ok ? `Cycle moved to ${STAGE_LABEL[next]}.` : r.error, r.ok ? "success" : "error"); }}>Move to {STAGE_LABEL[next]}</Button>}>
        <CycleSteps stage={data.cycle.stage} />
        {next === "calibration" && <Alert severity="info" sx={{ mt: 1.5 }}>Moving to calibration copies each manager's scores into the calibration table below.</Alert>}
      </SectionCard>
      <Grid min={160}>
        <StatCard label="Self reviews" value={`${rows.filter((r) => r.rv.self).length}/${rows.length}`} tone="info" />
        <StatCard label="Manager reviews" value={`${rows.filter((r) => r.rv.manager).length}/${rows.length}`} tone="info" />
        <StatCard label="Avg weighted score" value={(rows.reduce((x, r) => x + r.sc, 0) / Math.max(1, rows.length)).toFixed(2)} hint="out of 5" />
        <StatCard label="Merit spend" value={`₹${fmtNum(Math.round(spend))}`} tone={spend > budget ? "bad" : "good"} hint={`Budget ₹${fmtNum(Math.round(budget))} (${data.settings.merit_budget_pct}% of payroll)`} />
        <StatCard label="Budget used" value={`${Math.round((spend / Math.max(1, budget)) * 100)}%`} tone={spend > budget ? "bad" : "good"} hint={spend > budget ? "Over budget" : "Within budget"} />
      </Grid>
      <EmployeeGoalSetter employees={active} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 1fr" }, gap: 2.5 }}>
        <SectionCard title="Calibration" subtitle="Edit scores to calibrate. Bands: ≥4.5 Outstanding 12% · ≥3.75 Exceeds 9% · ≥3 Meets 6% · ≥2 Needs improvement 2%" noPad>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 980 }}>
              <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Reviews</TableCell><TableCell align="right">Goals</TableCell><TableCell align="right">Comp.</TableCell><TableCell align="right">Values</TableCell><TableCell align="right">Weighted</TableCell><TableCell>Band</TableCell><TableCell align="right">Merit</TableCell><TableCell align="right">Annual cost (₹)</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {rows.sort((a, b) => b.sc - a.sc).map((r) => (
                  <TableRow key={r.e.employee_code}>
                    <TableCell><PersonCell name={r.e.full_name} sub={`${r.e.designation} · ${r.e.grade_code}`} /></TableCell>
                    <TableCell><Stack direction="row" spacing={0.4}><Tag tone={r.rv.self ? "good" : "neutral"}>Self</Tag><Tag tone={r.rv.manager ? "good" : "neutral"}>Mgr</Tag></Stack></TableCell>
                    <TableCell align="right">{r.p.g}</TableCell>
                    <TableCell align="right">{r.p.c}</TableCell>
                    <TableCell align="right">{r.p.v}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{r.sc.toFixed(2)}</TableCell>
                    <TableCell><Tag tone={r.b[2]}>{r.b[0]}</Tag></TableCell>
                    <TableCell align="right">{r.elig ? `${r.m}%` : <Tooltip title="Joined after the cut-off"><span><Tag>Not eligible</Tag></span></Tooltip>}</TableCell>
                    <TableCell align="right">{fmtNum(Math.round(r.cost))}</TableCell>
                    <TableCell><IconButton size="small" aria-label={`Calibrate ${r.e.full_name}`} onClick={() => { setEdit(r.e); setS({ ...r.p }); }}><EditRounded fontSize="small" /></IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
        <Stack spacing={2.5}>
          <SectionCard title="Rating distribution">
            <Stack spacing={1}>
              {dist.map(([l, n]) => (
                <Box key={l}>
                  <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontSize: "0.66rem" }}>{l}</Typography><Typography sx={{ fontSize: "0.66rem", fontWeight: 700 }}>{n}</Typography></Stack>
                  <Box sx={{ height: 8, borderRadius: 4, background: "#ebf3ec" }}><Box sx={{ height: "100%", width: `${(n / Math.max(1, rows.length)) * 100}%`, background: "#244d3d", borderRadius: 4 }} /></Box>
                </Box>
              ))}
            </Stack>
          </SectionCard>
          <SectionCard title="Merit budget">
            <TextField label="% of annual payroll" value={data.settings.merit_budget_pct} onChange={(e) => { const v = Number(e.target.value.replace(/[^\d.]/g, "")); if (v >= 0 && v <= 30) updateSettings({ merit_budget_pct: v }); }} helperText="Annual merit cost = gross × 12 × merit %" />
          </SectionCard>
        </Stack>
      </Box>
      <Dialog open={!!edit} onClose={() => setEdit(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Calibrate {edit?.full_name}</DialogTitle>
        <DialogContent>
          {s && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {data.reviews[edit.employee_code]?.manager && <Alert severity="info">Manager: {data.reviews[edit.employee_code].manager.g} / {data.reviews[edit.employee_code].manager.c} / {data.reviews[edit.employee_code].manager.v} · “{data.reviews[edit.employee_code].manager.comments}”</Alert>}
              <Stack direction="row" spacing={1.5}>
                {[["g", "Goals"], ["c", "Competency"], ["v", "Values"]].map(([k, l]) => <TextField key={k} label={l} value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value.replace(/[^\d.]/g, "") })} />)}
              </Stack>
              <FormControl size="small">
                <InputLabel>Potential</InputLabel>
                <Select label="Potential" value={Number(s.pot)} onChange={(e) => setS({ ...s, pot: e.target.value })}>
                  {[[1, "1 · Low"], [2, "2 · Medium"], [3, "3 · High"]].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                </Select>
              </FormControl>
              <Typography sx={{ fontSize: "0.66rem", color: "#78827b" }}>Weighted {weightedScore({ g: +s.g, c: +s.c, v: +s.v }).toFixed(2)} · {band(weightedScore({ g: +s.g, c: +s.c, v: +s.v }))[0]}</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setEdit(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { const r = calibrate(edit.employee_code, s); notifyToast(r.ok ? "Calibrated." : r.error, r.ok ? "success" : "error"); if (r.ok) setEdit(null); }}>Save</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

const NINE = [["Talent risk", "Effective employee", "Trusted professional"], ["Inconsistent player", "Core player", "High performer"], ["Rough diamond", "Future star", "Star"]];

export function TalentView({ employees }) {
  const { data } = useStore();
  const active = employees.filter((e) => e.status === "active");
  const grid = [[[], [], []], [[], [], []], [[], [], []]];
  const rows = active.map((e) => {
    const p = data.perf[e.employee_code] || { g: 3, c: 3, v: 3, pot: 2 };
    const sc = weightedScore(p);
    const pot = Math.min(3, Math.max(1, Number(p.pot || e.potential || 2)));
    grid[pot - 1][perfLevel(sc)].push(e);
    return { e, sc, f: flightRisk(e, sc) };
  }).sort((a, b) => b.f.score - a.f.score);
  return (
    <Stack spacing={2.5}>
      <Grid min={170}>
        <StatCard label="Stars and future stars" value={grid[2][1].length + grid[2][2].length} tone="good" />
        <StatCard label="High flight risk" value={rows.filter((r) => r.f.level[0] === "High").length} tone="bad" />
        <StatCard label="High performers at high risk" value={rows.filter((r) => r.f.level[0] === "High" && r.sc >= 4).length} tone="warn" hint="Act on these first" />
        <StatCard label="Avg engagement" value={(active.reduce((x, e) => x + (e.engagement || 3.5), 0) / Math.max(1, active.length)).toFixed(2)} tone="info" hint="out of 5" />
      </Grid>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.1fr 1fr" }, gap: 2.5 }}>
        <SectionCard title="9-box grid" subtitle="Vertical: potential · horizontal: performance (weighted score)">
          <Box sx={{ display: "grid", gridTemplateColumns: "56px repeat(3, 1fr)", gap: "6px" }}>
            {[2, 1, 0].map((pot) => (
              <React.Fragment key={pot}>
                <Stack sx={{ justifyContent: "center", alignItems: "center" }}><Typography sx={{ fontSize: "0.58rem", color: "#78827b", transform: "rotate(-90deg)", whiteSpace: "nowrap" }}>{["Low", "Medium", "High"][pot]}</Typography></Stack>
                {[0, 1, 2].map((pf) => (
                  <Box key={pf} sx={{ minHeight: 92, p: 1, borderRadius: 1.5, background: pot + pf >= 3 ? "#e3f1e7" : pot + pf === 0 ? "#f8e9e9" : "#f4f7f3", border: "1px solid #e5eae5" }}>
                    <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#46534a", mb: 0.6 }}>{NINE[pot][pf]}</Typography>
                    <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.4 }}>
                      {grid[pot][pf].map((e) => <Box key={e.employee_code} sx={{ px: 0.7, py: 0.2, borderRadius: 99, background: "#fff", border: "1px solid #dfe6df", fontSize: "0.58rem" }}>{e.full_name}</Box>)}
                      {grid[pot][pf].length === 0 && <Typography sx={{ fontSize: "0.58rem", color: "#a1aaa3" }}>—</Typography>}
                    </Stack>
                  </Box>
                ))}
              </React.Fragment>
            ))}
            <Box />
            {["Low (<3.0)", "Medium (3.0–3.99)", "High (≥4.0)"].map((t) => <Typography key={t} sx={{ fontSize: "0.58rem", color: "#78827b", textAlign: "center" }}>{t}</Typography>)}
          </Box>
        </SectionCard>
        <SectionCard title="Flight risk" subtitle="Pay vs band (India), years since promotion, engagement, performance" noPad>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 560 }}>
              <TableHead><TableRow><TableCell>Employee</TableCell><TableCell align="right">Compa</TableCell><TableCell align="right">Since promo</TableCell><TableCell align="right">Engage</TableCell><TableCell>Risk</TableCell><TableCell>Why</TableCell></TableRow></TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.e.employee_code}>
                    <TableCell><PersonCell name={r.e.full_name} sub={`Score ${r.sc.toFixed(2)}`} /></TableCell>
                    <TableCell align="right">{r.f.compa ? r.f.compa.toFixed(2) : "—"}</TableCell>
                    <TableCell align="right">{r.f.since.toFixed(1)} y</TableCell>
                    <TableCell align="right">{(r.e.engagement ?? 3.5).toFixed(1)}</TableCell>
                    <TableCell><Tag tone={r.f.level[1]}>{r.f.level[0]} · {r.f.score}</Tag></TableCell>
                    <TableCell sx={{ maxWidth: 200 }}><Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{r.f.why.join(", ") || "—"}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      </Box>
    </Stack>
  );
}

const READY = { now: ["Ready now", 1, "good"], "1-2": ["Ready in 1–2 yrs", 0.5, "info"], "3+": ["Ready in 3+ yrs", 0.25, "warn"] };

export function SuccessionView() {
  const { data, upsertSuccession, notifyToast } = useStore();
  const [edit, setEdit] = useState(null);
  const emp = (c) => data.employees.find((e) => e.employee_code === c);
  const rows = data.succession.map((s) => {
    const inc = emp(s.incumbent);
    const f = inc ? flightRisk(inc, weightedScore(data.perf[inc.employee_code])) : { level: ["Low", "good"] };
    const bench = s.successors.reduce((x, [, k]) => x + READY[k][1], 0);
    const cov = bench >= 1 ? ["Covered", "good"] : bench >= 0.5 ? ["Partial", "warn"] : ["Gap", "bad"];
    const pri = (f.level[0] === "High" && cov[0] !== "Covered") || cov[0] === "Gap" ? ["Critical", "bad"] : f.level[0] !== "Low" && cov[0] !== "Covered" ? ["Monitor", "warn"] : ["Stable", "good"];
    return { s, inc, f, bench, cov, pri };
  });
  const actives = data.employees.filter((e) => e.status === "active");
  return (
    <Stack spacing={2.5}>
      <Grid min={170}>
        <StatCard label="Critical roles" value={rows.length} />
        <StatCard label="Covered" value={rows.filter((r) => r.cov[0] === "Covered").length} tone="good" hint="Bench strength ≥ 1.0" />
        <StatCard label="Gaps" value={rows.filter((r) => r.cov[0] === "Gap").length} tone="bad" />
        <StatCard label="Critical priority" value={rows.filter((r) => r.pri[0] === "Critical").length} tone="warn" />
      </Grid>
      <SectionCard title="Succession slate" subtitle="Bench = 1.0 × ready now + 0.5 × 1–2 yrs + 0.25 × 3+ yrs" action={<Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setEdit({ role: "", incumbent: "", successors: [] })}>Add role</Button>} noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 860 }}>
            <TableHead><TableRow><TableCell>Role</TableCell><TableCell>Incumbent</TableCell><TableCell>Incumbent risk</TableCell><TableCell>Successors</TableCell><TableCell align="right">Bench</TableCell><TableCell>Coverage</TableCell><TableCell>Priority</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.s.id}>
                  <TableCell sx={{ fontWeight: 700 }}>{r.s.role}</TableCell>
                  <TableCell>{r.inc?.full_name || "—"}</TableCell>
                  <TableCell><Tag tone={r.f.level[1]}>{r.f.level[0]}</Tag></TableCell>
                  <TableCell>{r.s.successors.length ? r.s.successors.map(([c, k]) => <Stack key={c} direction="row" spacing={0.6} sx={{ alignItems: "center", mb: 0.3 }}><Typography sx={{ fontSize: "0.66rem" }}>{emp(c)?.full_name}</Typography><Tag tone={READY[k][2]}>{READY[k][0]}</Tag></Stack>) : <Typography sx={{ fontSize: "0.62rem", color: "#d32f2f" }}>None named</Typography>}</TableCell>
                  <TableCell align="right">{r.bench.toFixed(2)}</TableCell>
                  <TableCell><Tag tone={r.cov[1]}>{r.cov[0]}</Tag></TableCell>
                  <TableCell><Tag tone={r.pri[1]}>{r.pri[0]}</Tag></TableCell>
                  <TableCell><IconButton size="small" aria-label={`Edit ${r.s.role}`} onClick={() => setEdit(JSON.parse(JSON.stringify(r.s)))}><EditRounded fontSize="small" /></IconButton></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <Dialog open={!!edit} onClose={() => setEdit(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{edit?.id ? `Edit ${edit.role}` : "Add critical role"}</DialogTitle>
        <DialogContent>
          {edit && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField label="Role" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} />
              <FormControl size="small" fullWidth>
                <InputLabel>Incumbent</InputLabel>
                <Select label="Incumbent" value={edit.incumbent} onChange={(e) => setEdit({ ...edit, incumbent: e.target.value })}>
                  {actives.map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name}</MenuItem>)}
                </Select>
              </FormControl>
              {edit.successors.map(([c, k], i) => (
                <Stack key={i} direction="row" spacing={1}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Successor</InputLabel>
                    <Select label="Successor" value={c} onChange={(e) => setEdit({ ...edit, successors: edit.successors.map((x, j) => (j === i ? [e.target.value, x[1]] : x)) })}>
                      {actives.filter((e) => e.employee_code !== edit.incumbent).map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Readiness</InputLabel>
                    <Select label="Readiness" value={k} onChange={(e) => setEdit({ ...edit, successors: edit.successors.map((x, j) => (j === i ? [x[0], e.target.value] : x)) })}>
                      {Object.entries(READY).map(([v, [l]]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <IconButton aria-label="Remove successor" onClick={() => setEdit({ ...edit, successors: edit.successors.filter((_, j) => j !== i) })}><DeleteOutlineRounded /></IconButton>
                </Stack>
              ))}
              <Button size="small" startIcon={<AddRounded />} sx={{ alignSelf: "flex-start" }} onClick={() => setEdit({ ...edit, successors: [...edit.successors, ["", "1-2"]] })}>Add successor</Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setEdit(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { const r = upsertSuccession({ ...edit, successors: edit.successors.filter(([c]) => c) }); notifyToast(r.ok ? "Succession plan saved." : r.error, r.ok ? "success" : "error"); if (r.ok) setEdit(null); }}>Save</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default PerformanceAdminView;


// v10.6 · HR sets goals for any employee (the employee and their manager see them in Performance & goals).
function EmployeeGoalSetter({ employees }) {
  const [code, setCode] = useState(employees[0]?.employee_code || "");
  const e = employees.find((x) => x.employee_code === code);
  return (
    <SectionCard title="Set employee goals" subtitle="Pick an employee to add, edit or remove their goals. Weights add up to 100%; the employee and their manager see them in Performance & goals."
      action={<TextField select size="small" label="Employee" value={code} onChange={(ev) => setCode(ev.target.value)} sx={{ minWidth: 260 }}>{employees.map((x) => <MenuItem key={x.employee_code} value={x.employee_code}>{x.full_name} · {x.department}</MenuItem>)}</TextField>}>
      {e ? <GoalsTable owner={e.employee_code} editable /> : null}
    </SectionCard>
  );
}
