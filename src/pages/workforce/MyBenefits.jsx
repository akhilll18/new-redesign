// Benefits enrolment and the anonymous monthly wellness pulse.
import React, { useState } from "react";
import { Alert, Box, Button, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Slider, Stack, Typography } from "@mui/material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, KeyVal, Tag } from "../../components/kit/UI.jsx";
import { fmtNum, isoDate } from "../../lib/utils.js";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { computePay, periodContext, toEngineEmp } from "../../lib/payroll/index.js";
import { packFor, fmtMoney } from "../../country/countryPacks.js";

/** Statutory deductions (employee) and contributions (employer) for this employee, from their country's payroll rules. */
function StatutoryBlock({ e, c, india }) {
  const cc = e.country_code || "IN";
  const p = packFor(cc);
  let pay = null;
  try { pay = computePay(toEngineEmp(e), periodContext(isoDate())); } catch { /* engine not configured */ }
  if (!pay || !p) return <Alert severity="warning" sx={{ mt: 2 }}>Your statutory deductions can't be calculated yet. HR needs to finish your payroll settings.</Alert>;
  const gross = pay.earned || pay.gross || e.monthly_gross || 0;
  const pct = (v) => (gross ? `${((v / gross) * 100).toFixed(2)}%` : "—");
  const rateIn = (label) => (label.match(/\(([^)]*%[^)]*)\)/) || label.match(/(\d+(?:\.\d+)?%)/) || [])[1] || "";
  const clean = (label) => label.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const isHealth = (label) => /esi|health|medic|nhi|nhif|shif|bpjs|philhealth|sus|nhima|insur/i.test(label);
  const rows = [
    ...pay.deductions.filter(([, v]) => Number(v)).map(([l, v]) => ({ item: clean(l), who: "You", rate: rateIn(l), v, health: isHealth(l), tax: /tax|tds|paye|ir|income|withhold|usc|pit/i.test(l) })),
    ...(india && c ? [{ item: "Group health insurance – your share", who: "You", rate: "dependant top-up", v: Math.round(c.ee / 12), health: true }] : []),
    ...pay.employer.filter(([, v]) => Number(v)).map(([l, v]) => ({ item: clean(l), who: "Employer", rate: rateIn(l), v, health: isHealth(l) })),
    ...(india && c ? [{ item: "Group health insurance – company share", who: "Employer", rate: "self premium + 50% top-up", v: Math.round(c.er / 12), health: true }, ...(c.nps ? [{ item: "Employer NPS", who: "Employer", rate: "of basic", v: Math.round(c.nps / 12) }] : [])] : []),
  ];
  const yours = rows.filter((r) => r.who === "You").reduce((t, r) => t + r.v, 0);
  const er = rows.filter((r) => r.who === "Employer").reduce((t, r) => t + r.v, 0);
  const health = rows.filter((r) => r.health).reduce((t, r) => t + r.v, 0);
  const social = (p.engine.policy?.["Social security"] || []);
  return (
    <Box sx={{ mt: 2.5 }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, mb: 0.4 }}>Deductions & contributions ({p.flag} {p.name} rules)</Typography>
      <Typography sx={{ fontSize: "0.6rem", color: "#78827b", mb: 1.2 }}>This month, on a monthly gross of {fmtMoney(gross, cc)}. Your payslip is the official record.</Typography>
      <Grid min={150}>
        <StatCard label="You pay / month" value={fmtMoney(yours, cc)} tone="warn" hint={`${pct(yours)} of gross`} />
        <StatCard label="Employer pays / month" value={fmtMoney(er, cc)} tone="good" hint={`${pct(er)} of gross, on top of salary`} />
        <StatCard label="Health & insurance" value={fmtMoney(health, cc)} tone="info" hint="You + employer, per month" />
        <StatCard label="Estimated net pay" value={fmtMoney(pay.net - (india && c ? Math.round(c.ee / 12) : 0), cc)} hint="After the deductions below" />
      </Grid>
      <Box sx={{ overflowX: "auto", mt: 1.5 }}>
        <Table size="small" sx={{ minWidth: 560 }}>
          <TableHead><TableRow><TableCell>Deduction / contribution</TableCell><TableCell>Paid by</TableCell><TableCell>Rate</TableCell><TableCell align="right">Per month</TableCell><TableCell align="right">% of gross</TableCell></TableRow></TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.who}-${r.item}`}>
                <TableCell sx={{ fontSize: "0.64rem" }}>{r.item}{r.health && <Tag tone="info" sx={{ ml: 0.6 }}>Health</Tag>}</TableCell>
                <TableCell sx={{ fontSize: "0.64rem" }}>{r.who === "You" ? <Tag tone="warn">You</Tag> : <Tag tone="good">Employer</Tag>}</TableCell>
                <TableCell sx={{ fontSize: "0.62rem", color: "#5c675f" }}>{r.rate || (r.tax ? "slab / band" : "—")}</TableCell>
                <TableCell align="right" sx={{ fontSize: "0.64rem" }}>{fmtMoney(r.v, cc)}</TableCell>
                <TableCell align="right" sx={{ fontSize: "0.62rem", color: "#5c675f" }}>{pct(r.v)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {social.length > 0 && (
        <Box sx={{ mt: 1.5, p: 1.2, borderRadius: 1.5, background: "#f6f9f6" }}>
          <Typography sx={{ fontSize: "0.62rem", fontWeight: 800, color: "#244d3d", mb: 0.4 }}>GOVERNMENT RULES THAT APPLY TO YOU</Typography>
          {social.map(([k, v]) => <Typography key={k} sx={{ fontSize: "0.62rem", py: 0.2 }}><b>{k}:</b> {v}</Typography>)}
          {(p.engine.policy?.["Pay & tax"] || []).filter(([k]) => /tax/i.test(k)).map(([k, v]) => <Typography key={k} sx={{ fontSize: "0.62rem", py: 0.2 }}><b>{k}:</b> {v}</Typography>)}
          <Typography sx={{ fontSize: "0.56rem", color: "#8a948d", mt: 0.5 }}>Rates: {p.engine.RATES?.effective}. Your tax depends on your full-year income and declarations.</Typography>
        </Box>
      )}
    </Box>
  );
}

// Employer cost per Sahayog module 04: employer pays the self premium + 50% of the dependant top-up.
export function benefitCost(e, b, tiers) {
  // v10.10: a new company may not have health tiers yet
  const prem = tiers?.[b.tier]?.p || 0;
  const self = tiers?.S?.p || 0;
  const er = self + (prem - self) * 0.5;
  const ee = prem - er;
  const annual = (e.monthly_gross || 0) * 12;
  const cover = annual * 3;
  const life = Math.round((cover / 1000) * 0.9);
  const meal = 0; // v10.6: meal card removed
  const nps = Math.round((e.monthly_gross || 0) * 0.5 * (b.nps / 100) * 12);
  return { prem, er, ee, cover, life, meal, nps, total: Math.round(er + life + meal + nps) };
}

const Q = [
  ["stress", "How stressed have you felt at work this month?", ["Not at all", "Extremely"]],
  ["sleep", "How well have you been sleeping?", ["Poorly", "Very well"]],
  ["activity", "How physically active have you been?", ["Not at all", "Very"]],
  ["energy", "How is your energy during the work day?", ["Very low", "Very high"]],
];

export default function MyBenefits() {
  const { data, user, updateBenefits, submitPulse, notifyToast } = useStore();
  const e = data.employees.find((x) => x.employee_code === user.employee_code);
  const b = data.benefits[e.employee_code] || { tier: "S", nps: 0, meal: false };
  const [form, setForm] = useState(b);
  const [pulse, setPulse] = useState({ stress: 3, sleep: 3, activity: 3, energy: 3, in_programme: false });
  const c = benefitCost(e, form, data.healthTiers);
  const month = isoDate().slice(0, 7);
  const answered = (data.pulseSubmitted[month] || []).includes(e.employee_code);
  const india = (e.country_code || "IN") === "IN";
  return (
    <>
      <PageHeader eyebrow="ME · BENEFITS & WELLNESS" title="Benefits & wellness" subtitle={india ? `Enrolment is ${data.settings.benefits_window_open ? "open" : "closed"}. Changes apply from next month.` : "Statutory benefits for your country are handled in payroll."} />
      <Stack spacing={2.5}>
        {india ? (
          <>
            <Grid min={170}>
              <StatCard label="Health cover premium" value={`₹${fmtNum(c.prem)}`} hint={`${data.healthTiers?.[form.tier]?.l || "No plan set up"} · per year`} />
              <StatCard label="You pay" value={`₹${fmtNum(Math.round(c.ee / 12))}/mo`} tone="warn" hint="Your share of the dependant top-up" />
              <StatCard label="Life cover" value={`₹${fmtNum(c.cover)}`} tone="info" hint="3 × annual gross, paid by the company" />
              <StatCard label="Company spends on you" value={`₹${fmtNum(c.total)}`} tone="good" hint="Per year, on these benefits" />
            </Grid>
            <SectionCard title="My enrolment" action={<Tag tone={data.settings.benefits_window_open ? "good" : "neutral"}>{data.settings.benefits_window_open ? "Window open" : "Window closed"}</Tag>}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 2, alignItems: "center" }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Group health cover</InputLabel>
                  <Select label="Group health cover" value={form.tier} onChange={(ev) => setForm({ ...form, tier: ev.target.value })}>
                    {Object.entries(data.healthTiers || {}).map(([k, v]) => <MenuItem key={k} value={k}>{v.l} · ₹{fmtNum(v.p)}/yr</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Employer NPS</InputLabel>
                  <Select label="Employer NPS" value={form.nps} onChange={(ev) => setForm({ ...form, nps: ev.target.value })}>
                    {[0, 5, 10, 14].map((v) => <MenuItem key={v} value={v}>{v ? `${v}% of basic` : "Not enrolled"}</MenuItem>)}
                  </Select>
                </FormControl>
                {/* v10.6: meal card removed from Benefits & wellness */}
              </Box>
              <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
                <Button color="inherit" onClick={() => setForm(b)}>Reset</Button>
                <Button variant="contained" disabled={JSON.stringify(form) === JSON.stringify(b)} onClick={() => { const r = updateBenefits(e.employee_code, form); notifyToast(r.ok ? "Enrolment saved; it applies from next month." : r.error, r.ok ? "success" : "error"); }}>Save enrolment</Button>
              </Stack>
              <Box sx={{ mt: 2 }}>
                <KeyVal cols={3} items={[["Employer pays (health)", `₹${fmtNum(c.er)}`], ["Life premium", `₹${fmtNum(c.life)}`], ["Employer NPS / yr", `₹${fmtNum(c.nps)}`]]} />
              </Box>
              <Typography sx={{ fontSize: "0.6rem", color: "#78827b", mt: 1.5 }}>The company pays the self premium plus half of any dependant top-up. Employer NPS up to 14% of basic is tax-free under 80CCD(2) in the new regime.</Typography>
              <StatutoryBlock e={e} c={c} india />
            </SectionCard>
          </>
        ) : (
          <SectionCard title="My enrolment" subtitle="Statutory benefits and social security for your country are handled through payroll.">
            <StatutoryBlock e={e} />
          </SectionCard>
        )}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.2fr 1fr" }, gap: 2.5 }}>
          <SectionCard title="Monthly wellness pulse" subtitle="Anonymous. Your answers are stored with your department only and shown as team averages of 3 or more people.">
            {answered ? (
              <Alert severity="success">Thanks, you've answered this month's pulse. It reopens next month.</Alert>
            ) : (
              <Stack spacing={1.6}>
                {Q.map(([k, q, [lo, hi]]) => (
                  <Box key={k}>
                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 600 }}>{q}</Typography>
                    <Slider value={pulse[k]} min={1} max={5} step={1} marks onChange={(_, v) => setPulse({ ...pulse, [k]: v })} />
                    <Stack direction="row" sx={{ justifyContent: "space-between", mt: -1 }}><Typography sx={{ fontSize: "0.55rem", color: "#8a948d" }}>{lo}</Typography><Typography sx={{ fontSize: "0.55rem", color: "#8a948d" }}>{hi}</Typography></Stack>
                  </Box>
                ))}
                <FormControlLabel control={<Checkbox checked={pulse.in_programme} onChange={(ev) => setPulse({ ...pulse, in_programme: ev.target.checked })} />} label={<Typography sx={{ fontSize: "0.68rem" }}>I joined a wellness programme this month</Typography>} />
                <Button variant="contained" sx={{ alignSelf: "flex-end" }} onClick={() => { const r = submitPulse(pulse); notifyToast(r.ok ? "Thanks for answering." : r.error, r.ok ? "success" : "error"); }}>Send anonymously</Button>
              </Stack>
            )}
          </SectionCard>
          <SectionCard title="Programmes you can join">
            <Stack spacing={1.2}>
              {data.programs.map((p) => (
                <Stack key={p.n} direction="row" sx={{ justifyContent: "space-between", alignItems: "center", py: 0.5, borderBottom: "1px solid #f0f2ef" }}>
                  <Typography sx={{ fontSize: "0.7rem", fontWeight: 600 }}>{p.n}</Typography>
                  <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{p.p} {p.u}</Typography>
                </Stack>
              ))}
              <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>Employee assistance (EAP) is confidential: HR sees only the number of sessions, never who used them.</Typography>
            </Stack>
          </SectionCard>
        </Box>
      </Stack>
    </>
  );
}
