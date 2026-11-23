// Country workspace: one page that switches every country-specific operation — payroll and statutory deductions,
// leave floors and public holidays, compliance checks and filing deadlines, onboarding documents, exit terms,
// automated workflows and AI — to the selected country's rules.
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Divider, FormControl, InputLabel, MenuItem, Select, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { PlayArrowRounded, ForumRounded, OpenInNewRounded, EventRounded, GavelRounded, BoltRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Tag, KeyVal, TableWrap, PersonCell } from "../components/kit/UI.jsx";
import { AiInsight } from "../components/ai/AiInsight.jsx";
import { openCopilot, Sparkle } from "../components/ai/AiText.jsx";
import { computePay, complianceChecks, filingCalendar, periodContext, toEngineEmp } from "../lib/payroll/index.js";
import { payContext } from "../components/pay/PayViews.jsx";
import { isoDate, fmtDate } from "../lib/utils.js";
import { useCountry } from "./CountryContext.jsx";
import { PACKS, COUNTRY_CODES, packFor, countryOf, countryHolidays, countryLeaveTypes, fmtMoney, REGION_INFO, REGION_ORDER, countriesIn } from "./countryPacks.js";
import { ONAS } from "./brand.js";

const STATUS_TONE = { pass: "good", warn: "warn", fail: "bad", info: "info" };
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 864e5);

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage disabled */
  }
}

// ─────────────────────────── data for one country ───────────────────────────
function useCountryData(cc) {
  const store = useStore();
  const { data, user, scopeUnits } = store;
  return useMemo(() => {
    if (!cc) return null;
    const p = packFor(cc);
    const today = isoDate();
    const units = user.role === "admin" ? scopeUnits(user) : null;
    const staff = data.employees.filter((e) => e.status === "active" && countryOf(e) === cc && (!units || units.has(e.department)) && (user.role !== "emp" || e.employee_code === user.employee_code));
    const rows = staff.map((e) => {
      const ctx = payContext(data, e);
      let pay = null;
      try {
        pay = computePay(toEngineEmp(e), ctx);
      } catch {
        pay = null;
      }
      return { e, pay, checks: complianceChecks(toEngineEmp(e), ctx) };
    });
    const sum = (k) => rows.reduce((s, r) => s + (r.pay?.[k] || 0), 0);
    const flat = rows.flatMap((r) => r.checks.map((c) => ({ ...c, e: r.e })));
    const cal = filingCalendar(cc, today);
    const holidays = countryHolidays(data.holidays, cc);
    const upcoming = holidays.filter((h) => h.date >= today);
    const types = countryLeaveTypes(data.leaveTypes, cc);
    const lifted = types.filter((t) => t.statutory_floor);
    const added = types.filter((t) => t.country === cc);
    return { p, today, staff, rows, flat, cal, holidays, upcoming, types, lifted, added, totals: { gross: sum("earned"), net: sum("net"), employer: sum("employerTotal"), cost: sum("cost"), ded: sum("totalDeductions") } };
  }, [cc, data, user, scopeUnits]);
}

// ─────────────────────────── global / region overview ───────────────────────────
function CountryCard({ c, onPick }) {
  return (
    <Box onClick={() => onPick(c.cc)} sx={{ cursor: "pointer", p: 2, borderRadius: 2, border: `1px solid ${ONAS.line}`, background: "#fff", transition: "all .15s", "&:hover": { borderColor: ONAS.teal, boxShadow: "0 6px 20px rgba(0,74,119,0.10)", transform: "translateY(-1px)" } }}>
      <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
        <Box sx={{ fontSize: "1.6rem" }}>{c.p.flag}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "0.85rem", color: ONAS.navy }}>{c.p.name}</Typography>
          <Typography sx={{ fontSize: "0.6rem", color: ONAS.muted }}>{c.p.currency} · {c.p.engine.RATES.effective}</Typography>
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: "1.1rem", color: ONAS.navy }}>{c.n}</Typography>
      </Stack>
      <Stack direction="row" spacing={0.6} useFlexGap sx={{ mt: 1.4, flexWrap: "wrap" }}>
        {c.n === 0 ? <Tag tone="neutral">Rules ready · no staff yet</Tag> : c.fails ? <Tag tone="bad">{`${c.fails} blocking`}</Tag> : <Tag tone="good">No blocking issues</Tag>}
        {c.warns > 0 && <Tag tone="warn">{`${c.warns} warning${c.warns === 1 ? "" : "s"}`}</Tag>}
      </Stack>
      {c.next && <Typography sx={{ fontSize: "0.6rem", color: c.next.daysLeft <= 7 ? "#bf7955" : ONAS.muted, mt: 0.8 }}>Next filing: {c.next.name} · {c.next.daysLeft === 0 ? "today" : `${c.next.daysLeft} day${c.next.daysLeft === 1 ? "" : "s"}`}</Typography>}
    </Box>
  );
}

function GlobalGrid({ region, onPick, onRegion }) {
  const { data, user, scopeUnits } = useStore();
  const units = user.role === "admin" ? scopeUnits(user) : null;
  const seesPay = user.role === "superadmin" || user.modules?.some((m) => ["payroll", "payslips"].includes(m));
  const today = isoDate();
  const ctx = periodContext(today, { weeklyHours: 45 });
  const all = useMemo(() => COUNTRY_CODES.map((cc) => {
    const staff = data.employees.filter((e) => e.status === "active" && countryOf(e) === cc && (!units || units.has(e.department)));
    const checks = staff.flatMap((e) => complianceChecks(toEngineEmp(e), ctx));
    const cal = filingCalendar(cc, today).sort((a, b) => a.daysLeft - b.daysLeft);
    const p = packFor(cc);
    let costLocal = 0;
    staff.forEach((e) => { try { costLocal += computePay(toEngineEmp(e), payContext(data, e)).cost; } catch { /* engine error shows on the country page */ } });
    return { cc, p, n: staff.length, fails: checks.filter((c) => c.status === "fail").length, warns: checks.filter((c) => c.status === "warn").length, next: cal[0], cal, costInr: costLocal * (data.fx[p.currency] || 1) };
  }), [data, units]); // eslint-disable-line react-hooks/exhaustive-deps
  const cards = region ? all.filter((c) => c.p.region === region) : all;
  const staffN = cards.reduce((s, c) => s + c.n, 0), cost = cards.reduce((s, c) => s + c.costInr, 0);
  const fails = cards.reduce((s, c) => s + c.fails, 0), warns = cards.reduce((s, c) => s + c.warns, 0);
  const due = cards.flatMap((c) => c.cal.filter((f) => f.daysLeft <= 14).map((f) => ({ ...f, c }))).sort((a, b) => a.daysLeft - b.daysLeft);
  const title = region ? `${region} · ${REGION_INFO[region].name}` : "All regions";
  const facts = [
    `${title}: ${cards.length} countries, ${staffN} active staff in scope`,
    seesPay ? `Monthly employment cost ≈ ₹${Math.round(cost).toLocaleString("en-IN")} at the saved exchange rates` : null,
    `${fails} blocking and ${warns} warning compliance checks${fails ? ` (${cards.filter((c) => c.fails).map((c) => c.p.name).join(", ")})` : ""}`,
    due.length ? `${due.length} statutory filing(s) due in the next 14 days, first: ${due[0].name} (${due[0].c.p.name}) in ${due[0].daysLeft} days` : "No statutory filings due in the next 14 days",
    ...(!region ? REGION_ORDER.map((r) => `${r}: ${all.filter((c) => c.p.region === r).reduce((s, c) => s + c.n, 0)} staff in ${countriesIn(r).length} countries`) : []),
  ];
  const groups = region ? [region] : REGION_ORDER;
  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Chip label={`🌐 All (${all.reduce((s, c) => s + c.n, 0)})`} color={!region ? "primary" : "default"} variant={!region ? "filled" : "outlined"} onClick={() => onRegion("ALL")} />
        {REGION_ORDER.map((r) => <Chip key={r} label={`${REGION_INFO[r].emoji} ${r} · ${REGION_INFO[r].name} (${all.filter((c) => c.p.region === r).reduce((s, c) => s + c.n, 0)})`} color={region === r ? "primary" : "default"} variant={region === r ? "filled" : "outlined"} onClick={() => onRegion(`REGION:${r}`)} />)}
      </Stack>
      <Grid min={170}>
        <StatCard label="Countries" value={cards.length} hint={title} />
        <StatCard label="Staff in scope" value={staffN} tone="info" />
        {seesPay && <StatCard label="Monthly cost (₹)" value={`₹${Math.round(cost).toLocaleString("en-IN")}`} tone="neutral" hint="Local cost × saved exchange rates" />}
        <StatCard label="Compliance" value={fails ? `${fails} blocking` : "No blocking issues"} tone={fails ? "bad" : "good"} hint={`${warns} warning(s)`} />
        <StatCard label="Filings in 14 days" value={due.length} tone={due.some((d) => d.daysLeft <= 3) ? "warn" : "accent"} hint={due[0] ? `${due[0].c.p.flag} ${due[0].name}` : "—"} />
      </Grid>
      <AiInsight title={`${title} — compliance and cost`} facts={facts} audience={user.role === "superadmin" ? "the Super Admin" : "an HR admin"} />
      {groups.map((r) => (
        <Box key={r}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 1.2 }}>
            <Typography sx={{  fontWeight: 800, fontSize: "0.95rem", color: ONAS.navy }}>{REGION_INFO[r].emoji} {r}</Typography>
            <Typography sx={{ fontSize: "0.65rem", color: ONAS.muted }}>{REGION_INFO[r].name} · {countriesIn(r).length} countries</Typography>
            {!region && <Button size="small" onClick={() => onRegion(`REGION:${r}`)} sx={{ ml: "auto" }}>Open region</Button>}
          </Stack>
          <Grid min={240}>{cards.filter((c) => c.p.region === r).map((c) => <CountryCard key={c.cc} c={c} onPick={onPick} />)}</Grid>
        </Box>
      ))}
      {due.length > 0 && (
        <SectionCard title="Statutory filings due in the next 14 days" subtitle={title} noPad>
          <TableWrap>
            <Table size="small">
              <TableHead><TableRow><TableCell>COUNTRY</TableCell><TableCell>RETURN</TableCell><TableCell>AUTHORITY</TableCell><TableCell>DUE</TableCell><TableCell align="right">LEFT</TableCell></TableRow></TableHead>
              <TableBody>
                {due.map((f) => <TableRow key={f.c.cc + f.name} hover sx={{ cursor: "pointer" }} onClick={() => onPick(f.c.cc)}><TableCell>{f.c.p.flag} {f.c.p.name}</TableCell><TableCell>{f.name}</TableCell><TableCell>{f.authority}</TableCell><TableCell>{fmtDate(f.due)}</TableCell><TableCell align="right"><Tag tone={f.daysLeft <= 3 ? "bad" : f.daysLeft <= 7 ? "warn" : "neutral"}>{`${f.daysLeft} d`}</Tag></TableCell></TableRow>)}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      )}
    </Stack>
  );
}

// ─────────────────────────── payroll calculator ───────────────────────────
function Calculator({ cc, initial }) {
  const p = packFor(cc);
  const E = p.engine;
  const [gross, setGross] = useState(initial?.gross || ({ IN: 80000, GB: 4500, US: 8000, AE: 20000, SG: 7000, NA: 30000, ZA: 40000, KE: 150000, NG: 600000, BW: 20000, CA: 7000, MX: 40000, BR: 8000, DE: 5000, FR: 3500, IE: 4500, SA: 20000, MY: 7000, PH: 40000, ID: 15000000, GH: 8000, ZM: 12000 }[cc] ?? 5000));
  const [region, setRegion] = useState(initial?.region || E.REGIONS[0]?.[0] || "");
  const [prof, setProf] = useState(() => Object.fromEntries((E.PROFILE || []).map((f) => [f.key, initial?.profile?.[f.key] ?? f.default])));
  const ctx = periodContext(isoDate(), { weeklyHours: 45 });
  const emp = { id: "CALC", name: "Calculator", ctry: cc, gross: Number(gross) || 0, region, g: "F", doj: "2022-01-01", dob: "1990-06-15", profile: prof };
  let pay = null;
  let err = "";
  try {
    pay = computePay(emp, ctx);
  } catch (e) {
    err = e.message;
  }
  const L = ({ list }) => list.filter(([, v]) => v !== 0).map(([k, v]) => (
    <Stack key={k} direction="row" sx={{ justifyContent: "space-between", py: 0.35, borderBottom: `1px dashed ${ONAS.line}` }}>
      <Typography sx={{ fontSize: "0.66rem", color: "#4a5f6d" }}>{k}</Typography>
      <Typography sx={{ fontSize: "0.66rem" }}>{typeof v === "number" ? fmtMoney(v, cc) : v}</Typography>
    </Stack>
  ));
  return (
    <SectionCard title={`${p.name} pay calculator`} subtitle={`${E.RATES.effective} · statutory deductions and employer cost, live`}>
      <Grid min={150} gap={1.2} sx={{ mb: 2 }}>
        <TextField label={`Monthly gross (${p.currency})`} type="number" value={gross} onChange={(e) => setGross(e.target.value)} />
        {E.REGIONS?.length > 0 && (
          <FormControl size="small"><InputLabel>Region</InputLabel><Select label="Region" value={region} onChange={(e) => setRegion(e.target.value)}>{E.REGIONS.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</Select></FormControl>
        )}
        {(E.PROFILE || []).map((f) => f.options ? (
          <FormControl key={f.key} size="small"><InputLabel>{f.label}</InputLabel><Select label={f.label} value={prof[f.key] ?? ""} onChange={(e) => setProf({ ...prof, [f.key]: e.target.value })}>{f.options.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</Select></FormControl>
        ) : (
          <TextField key={f.key} label={f.label} type={f.type === "number" ? "number" : "text"} value={prof[f.key] ?? ""} onChange={(e) => setProf({ ...prof, [f.key]: f.type === "number" ? e.target.value : e.target.value })} />
        ))}
      </Grid>
      {err && <Alert severity="error">{err}</Alert>}
      {pay && (
        <Grid min={260}>
          <Box>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, mb: 0.5 }}>Earnings</Typography>
            <L list={pay.earnings} />
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, mt: 1.5, mb: 0.5 }}>Employee deductions</Typography>
            <L list={pay.deductions} />
            <Box sx={{ mt: 1.5, p: 1.4, borderRadius: 1.5, background: ONAS.gradient, color: "#fff" }}>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontWeight: 800 }}>Net pay</Typography><Typography sx={{ fontWeight: 800 }}>{fmtMoney(pay.net, cc)}</Typography></Stack>
              <Stack direction="row" sx={{ justifyContent: "space-between", opacity: 0.85 }}><Typography sx={{ fontSize: "0.62rem" }}>Cost to company</Typography><Typography sx={{ fontSize: "0.62rem" }}>{fmtMoney(pay.cost, cc)}</Typography></Stack>
            </Box>
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, mb: 0.5 }}>Employer contributions</Typography>
            <L list={pay.employer} />
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, mt: 1.5, mb: 0.5 }}>How it was calculated</Typography>
            <L list={pay.steps} />
            {pay.notes?.map((n) => <Typography key={n} sx={{ fontSize: "0.6rem", color: ONAS.muted, mt: 0.5 }}>• {n}</Typography>)}
            <Button size="small" startIcon={<Sparkle size={14} />} sx={{ mt: 1 }} onClick={() => openCopilot(`Explain this ${p.name} payslip calculation in plain words for an employee: monthly gross ${fmtMoney(Number(gross), cc)}; deductions ${pay.deductions.map(([k, v]) => `${k} ${fmtMoney(v, cc)}`).join(", ")}; net ${fmtMoney(pay.net, cc)}; employer cost ${fmtMoney(pay.cost, cc)}. Steps: ${pay.steps.map(([k, v]) => `${k}: ${typeof v === "number" ? fmtMoney(v, cc) : v}`).join("; ")}.`)}>Explain with AI</Button>
          </Box>
        </Grid>
      )}
    </SectionCard>
  );
}

// ─────────────────────────── automations ───────────────────────────
function buildAutomations(cd, data, nameOf) {
  const { p, today, staff, flat, cal, upcoming, lifted, added } = cd;
  const soon = cal.filter((c) => c.daysLeft <= 14);
  const nextHol = upcoming.find((h) => daysBetween(today, h.date) <= 21);
  const probation = staff.filter((e) => e.probation_status === "in_probation" && e.probation_end_date && daysBetween(today, e.probation_end_date) <= 30 && daysBetween(today, e.probation_end_date) >= -7);
  const blocking = flat.filter((c) => c.status === "fail");
  const missingIds = flat.filter((c) => c.status !== "pass" && c.status !== "info" && /registration|number|PIN|TIN|Tax ID|Omang|administrator/i.test(c.rule));
  const joiners = staff.filter((e) => daysBetween(e.date_of_joining, today) <= 45);
  const lang = p.languages?.[0];
  return [
    { id: "filing", icon: <GavelRounded />, title: "Statutory filing reminders", what: `Reminds the payroll team 14, 7 and 1 day(s) before each ${p.name} filing deadline.`, actions: soon.map((c) => `Remind payroll: ${c.name} (${c.authority}) due ${fmtDate(c.due)} — ${c.daysLeft} day(s) left`), ai: `Draft a short reminder to the payroll team listing these ${p.name} statutory deadlines and what to prepare for each: ${soon.map((c) => `${c.name} to ${c.authority}, due ${c.due}`).join("; ") || "none in the next 14 days"}.` },
    { id: "precheck", icon: <BoltRounded />, title: "Payroll pre-check before cut-off", what: `Runs the ${p.name} compliance engine on every employee before payroll and blocks the run on failures.`, actions: blocking.map((c) => `Block payroll for ${c.e.full_name}: ${c.rule} — ${c.detail}`), ai: `Explain how to fix these ${p.name} payroll compliance failures: ${blocking.map((c) => `${c.e.full_name}: ${c.rule} (${c.detail})`).join("; ") || "none"}.` },
    { id: "ids", icon: <BoltRounded />, title: "Missing statutory registrations", what: "Asks employees (and HR) for missing tax and social-security numbers.", actions: missingIds.map((c) => `Ask ${c.e.full_name} for: ${c.rule}`), ai: `Write a friendly message asking an employee in ${p.name} to send their missing statutory registration details (${[...new Set(missingIds.map((c) => c.rule))].join(", ") || "tax and social-security numbers"}), explaining why each is needed.` },
    { id: "holidays", icon: <EventRounded />, title: "Public-holiday announcements", what: `Announces each ${p.name} public holiday to local staff two weeks ahead${lang ? `, in English and ${lang}` : ""}.`, actions: nextHol ? [`Announce ${nextHol.name} (${fmtDate(nextHol.date)}) to ${staff.length} staff in ${p.name}${nextHol.approx ? " — date subject to moon sighting" : ""}`] : [], ai: nextHol ? `Write a short staff announcement for ${p.name} about the public holiday "${nextHol.name}" on ${nextHol.date}${lang ? `, then the same message in ${lang}` : ""}.` : `List the next public holidays in ${p.name}.` },
    { id: "probation", icon: <BoltRounded />, title: "Probation confirmations", what: `Asks managers to confirm or extend probation (${p.probationMonths} months is usual in ${p.name}).`, actions: probation.map((e) => `Ask ${e.reporting_manager ? nameOf(e.reporting_manager) : "HR"} to confirm ${e.full_name} — probation ends ${fmtDate(e.probation_end_date)}`), ai: `Draft a probation confirmation letter for an employee in ${p.name}, compliant with local labour law.` },
    { id: "leave", icon: <BoltRounded />, title: "Statutory leave floor", what: "Lifts leave entitlements to the legal minimum and adds country-specific leave types automatically.", actions: [...lifted.map((t) => `Applied: ${t.name} ${t.company_annual} → ${t.annual} days a year (statutory minimum) for ${staff.length} staff`), ...added.map((t) => `Applied: added ${t.name} (${t.annual} days a year)`)], applied: true, ai: `Summarise the statutory leave rules in ${p.name} and how our company policy (earned leave ${data.leaveTypes.find((t) => t.code === "EL")?.annual} days, sick leave ${data.leaveTypes.find((t) => t.code === "SL")?.annual} days) compares.` },
    { id: "onboarding", icon: <BoltRounded />, title: "Country onboarding pack", what: `Sends new joiners the ${p.name} document checklist on day one.`, actions: joiners.map((e) => `Send ${p.name} document checklist to ${e.full_name} (joined ${fmtDate(e.date_of_joining)})`), ai: `Write a welcome email for a new joiner in ${p.name} listing the documents they must bring: ${p.documents.join(", ")}.` },
  ];
}

function Automations({ cd }) {
  const { data, nameOf, notifyToast, user } = useStore();
  const [on, setOn] = useState(() => load("onas-automations", {}));
  const [log, setLog] = useState(() => load("onas-automation-log", []));
  const list = buildAutomations(cd, data, nameOf);
  const cc = cd.p.code;
  const isOn = (id) => on[`${cc}:${id}`] !== false;
  const toggle = (id) => {
    const next = { ...on, [`${cc}:${id}`]: !isOn(id) };
    setOn(next);
    save("onas-automations", next);
  };
  const run = (a) => {
    const entries = (a.actions.length ? a.actions : ["Nothing to do right now."]).map((t) => ({ at: new Date().toISOString(), cc, flow: a.title, text: t, by: user.full_name }));
    const next = [...entries, ...log].slice(0, 200);
    setLog(next);
    save("onas-automation-log", next);
    notifyToast(`${a.title}: ${a.actions.length} action(s) queued for ${cd.p.name}.`);
  };
  return (
    <Stack spacing={2}>
      <Alert severity="info" icon={<BoltRounded />}>Automations run on the {cd.p.name} rules shown on this page. Each one lists what it would do now; “Run now” queues the actions in the log below, and the AI button drafts the message to send.</Alert>
      <Grid min={320}>
        {list.map((a) => (
          <SectionCard key={a.id} title={a.title} subtitle={a.what} action={<Switch size="small" checked={isOn(a.id)} onChange={() => toggle(a.id)} inputProps={{ "aria-label": `Turn ${a.title} on or off` }} />}>
            {a.actions.length === 0 ? <Typography sx={{ fontSize: "0.65rem", color: ONAS.muted }}>Nothing due right now.</Typography> : a.actions.slice(0, 5).map((t) => <Typography key={t} sx={{ fontSize: "0.65rem", py: 0.3 }}>• {t}</Typography>)}
            {a.actions.length > 5 && <Typography sx={{ fontSize: "0.6rem", color: ONAS.muted }}>+ {a.actions.length - 5} more</Typography>}
            <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
              {!a.applied && <Button size="small" variant="contained" disabled={!isOn(a.id)} startIcon={<PlayArrowRounded />} onClick={() => run(a)}>Run now</Button>}
              {a.applied && <Tag tone={isOn(a.id) ? "good" : "neutral"}>{isOn(a.id) ? "Applied automatically" : "Off"}</Tag>}
              <Button size="small" startIcon={<Sparkle size={14} />} onClick={() => openCopilot(a.ai)}>Draft with AI</Button>
            </Stack>
          </SectionCard>
        ))}
      </Grid>
      <SectionCard title="Automation log" subtitle="Most recent first · kept in this browser" noPad>
        <TableWrap>
          <Table size="small">
            <TableHead><TableRow><TableCell>WHEN</TableCell><TableCell>COUNTRY</TableCell><TableCell>WORKFLOW</TableCell><TableCell>ACTION</TableCell></TableRow></TableHead>
            <TableBody>
              {log.length === 0 && <TableRow><TableCell colSpan={4}>No runs yet.</TableCell></TableRow>}
              {log.slice(0, 25).map((l, i) => <TableRow key={i}><TableCell>{new Date(l.at).toLocaleString()}</TableCell><TableCell>{PACKS[l.cc]?.flag} {l.cc}</TableCell><TableCell>{l.flow}</TableCell><TableCell>{l.text}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
    </Stack>
  );
}

// ─────────────────────────── one country ───────────────────────────
function CountryView({ cc }) {
  const { user, data, nameOf } = useStore();
  const navigate = useNavigate();
  const cd = useCountryData(cc);
  const isEmp = user.role === "emp";
  const seesPay = user.role === "superadmin" || user.modules?.some((m) => ["payroll", "payslips"].includes(m));
  const tabs = isEmp ? ["overview", "pay", "leave", "documents"] : ["overview", "payroll", "leave", "compliance", "people", "automations"];
  const LABEL = { overview: "Overview", pay: "My pay", payroll: "Payroll", leave: "Leave & holidays", compliance: "Compliance & filing", documents: "Documents & terms", people: "Onboarding & exit", automations: "Automations" };
  const [tab, setTab] = useState("overview");
  const { p, staff, rows, flat, cal, holidays, upcoming, types, lifted, totals, today } = cd;
  const fails = flat.filter((c) => c.status === "fail"), warns = flat.filter((c) => c.status === "warn");
  const nextFiling = [...cal].sort((a, b) => a.daysLeft - b.daysLeft)[0];
  const facts = [
    isEmp ? `Country: ${p.name} (${p.currency}); working week ${p.workWeek}` : `${p.name}: ${staff.length} active employee(s) in scope`,
    seesPay && rows.length ? `Monthly payroll: gross ${fmtMoney(totals.gross, cc)}, net ${fmtMoney(totals.net, cc)}, employer cost ${fmtMoney(totals.cost, cc)}` : null,
    !isEmp ? `${fails.length} blocking and ${warns.length} warning compliance check(s)${fails[0] ? `, e.g. ${fails[0].e.full_name}: ${fails[0].rule}` : ""}` : null,
    !isEmp && nextFiling ? `Next filing: ${nextFiling.name} to ${nextFiling.authority} on ${nextFiling.due} (${nextFiling.daysLeft} days)` : null,
    upcoming[0] ? `Next public holiday: ${upcoming[0].name} on ${upcoming[0].date}` : null,
    lifted.length ? `Leave lifted to the statutory floor: ${lifted.map((t) => `${t.name} ${t.company_annual}→${t.annual}`).join(", ")}` : null,
    isEmp && rows[0]?.pay ? `My estimated net pay this month: ${fmtMoney(rows[0].pay.net, cc)} after ${fmtMoney(rows[0].pay.totalDeductions, cc)} statutory and other deductions` : null,
  ];
  const me = isEmp ? rows[0] : null;

  return (
    <Stack spacing={2.5}>
      <Box sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5, background: ONAS.gradient, color: "#fff", position: "relative", overflow: "hidden" }}>
        <Box sx={{ position: "absolute", right: -30, top: -40, fontSize: "9rem", opacity: 0.12, lineHeight: 1 }}>{p.flag}</Box>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" }, position: "relative" }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.12em", opacity: 0.85 }}>"COUNTRY SPACE" · {p.region.toUpperCase()}</Typography>
            <Typography sx={{  fontWeight: 800, fontSize: "1.6rem" }}>{p.flag} {p.name}</Typography>
            <Typography sx={{ fontSize: "0.7rem", opacity: 0.9 }}>{p.currency} ({p.symbol}) · tax year {p.taxYear} · {p.workWeek} · {p.engine.RATES.effective}</Typography>
          </Box>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button variant="contained" startIcon={<ForumRounded />} onClick={() => openCopilot(`Give me an overview of ${p.name}: employment policies, statutory compliance, taxes and the market${isEmp ? ", as an employee working there" : ", for HR"}.`)} sx={{ background: "#fff", color: ONAS.navy, "&:hover": { background: ONAS.mintSoft } }}>Ask AI about {p.name}</Button>
            {!isEmp && seesPay && <Button variant="outlined" startIcon={<OpenInNewRounded />} onClick={() => navigate("/payroll")} sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.6)" }}>Open payroll</Button>}
          </Stack>
        </Stack>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: `1px solid ${ONAS.line}`, "& .MuiTab-root": { fontSize: "0.72rem", minHeight: 40 } }}>
        {tabs.map((t) => <Tab key={t} value={t} label={LABEL[t]} />)}
      </Tabs>

      {tab === "overview" && (
        <Stack spacing={2.5}>
          <Grid min={170}>
            <StatCard label={isEmp ? "Country" : "Staff in scope"} value={isEmp ? p.name : staff.length} hint={p.region} />
            {seesPay && !isEmp && <StatCard label="Monthly cost to company" value={fmtMoney(totals.cost, cc)} tone="info" hint={cc !== "IN" ? `≈ ₹${Math.round(totals.cost * (data.fx[p.currency] || 1)).toLocaleString("en-IN")}` : undefined} />}
            {isEmp && me?.pay && <StatCard label="Estimated net pay" value={fmtMoney(me.pay.net, cc)} tone="good" hint="This month, before any one-off items" />}
            {!isEmp && <StatCard label="Compliance" value={fails.length ? `${fails.length} blocking` : "No blocking issues"} tone={fails.length ? "bad" : "good"} hint={`${warns.length} warning(s)`} />}
            {!isEmp && nextFiling && <StatCard label="Next filing" value={`${nextFiling.daysLeft} days`} tone={nextFiling.daysLeft <= 7 ? "warn" : "neutral"} hint={nextFiling.name} />}
            <StatCard label="Next public holiday" value={upcoming[0] ? fmtDate(upcoming[0].date) : "—"} tone="accent" hint={upcoming[0]?.name} />
          </Grid>
          <AiInsight title={`${p.name} ${isEmp ? "rules for me" : "operations"}`} facts={facts} audience={isEmp ? "an employee" : user.role === "superadmin" ? "the Super Admin" : "an HR admin"} />
          <Grid min={300}>
            <SectionCard title="Profile">
              <KeyVal items={[["Currency", `${p.currency} (${p.symbol})`], ["Date format", p.dateFormat], ["Tax year", p.taxYear], ["Pay cycle", p.payCycle], ["Working week", p.workWeek], ["Data protection", p.dataLaw], ["Authorities", p.authorities.join(" · "), { full: true }], ["Local languages (AI translation)", p.languages.join(", "), { full: true }]]} />
            </SectionCard>
            <SectionCard title={`${p.name} employment policy`} subtitle={p.engine.RATES.effective}>
              {Object.entries(p.engine.policy).slice(0, 3).map(([head, list]) => (
                <Box key={head} sx={{ mb: 1.2 }}>
                  <Typography sx={{ fontSize: "0.62rem", fontWeight: 800, color: ONAS.teal, letterSpacing: "0.06em" }}>{head.toUpperCase()}</Typography>
                  {list.map(([k, v]) => <Typography key={k} sx={{ fontSize: "0.65rem", py: 0.2 }}><b>{k}:</b> {v}</Typography>)}
                </Box>
              ))}
            </SectionCard>
          </Grid>
        </Stack>
      )}

      {tab === "pay" && me && (
        <Stack spacing={2.5}>
          {me.pay ? <Calculator cc={cc} initial={{ gross: me.e.monthly_gross, region: me.e.region, profile: me.e.payroll_profile }} /> : <Alert severity="warning">Your pay could not be calculated yet. HR needs to finish your local payroll settings.</Alert>}
          <Alert severity="info">This estimate uses the {p.name} statutory rules and your monthly gross. Your released payslip under “My pay & payslips” is the official record.</Alert>
        </Stack>
      )}

      {tab === "payroll" && (
        <Stack spacing={2.5}>
          {seesPay && (
            <SectionCard title={`${p.name} payroll register · ${today.slice(0, 7)}`} subtitle={`${rows.length} employee(s) · computed by the ${cc} engine`} noPad>
              <TableWrap>
                <Table size="small">
                  <TableHead><TableRow><TableCell>EMPLOYEE</TableCell><TableCell align="right">GROSS</TableCell><TableCell align="right">DEDUCTIONS</TableCell><TableCell align="right">NET</TableCell><TableCell align="right">EMPLOYER</TableCell><TableCell>CHECKS</TableCell></TableRow></TableHead>
                  <TableBody>
                    {rows.length === 0 && <TableRow><TableCell colSpan={6}>No active employees in {p.name} yet. The rules are ready — add an employee with country {p.name} in the employee database.</TableCell></TableRow>}
                    {rows.map((r) => {
                      const f = r.checks.filter((c) => c.status === "fail").length, w = r.checks.filter((c) => c.status === "warn").length;
                      return (
                        <TableRow key={r.e.employee_code} hover>
                          <TableCell><PersonCell name={r.e.full_name} sub={`${r.e.employee_code} · ${r.e.designation}`} /></TableCell>
                          <TableCell align="right">{fmtMoney(r.pay?.earned, cc)}</TableCell>
                          <TableCell align="right">{fmtMoney(r.pay?.totalDeductions, cc)}</TableCell>
                          <TableCell align="right"><b>{fmtMoney(r.pay?.net, cc)}</b></TableCell>
                          <TableCell align="right">{fmtMoney(r.pay?.employerTotal, cc)}</TableCell>
                          <TableCell>{f ? <Tag tone="bad">{f} blocking</Tag> : w ? <Tag tone="warn">{w} warning</Tag> : <Tag tone="good">OK</Tag>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrap>
            </SectionCard>
          )}
          <Calculator cc={cc} key={cc} />
        </Stack>
      )}

      {tab === "leave" && (
        <Grid min={320}>
          <SectionCard title="Leave entitlements" subtitle={cc === "IN" ? "Company leave policy" : `Company policy, lifted to ${p.name}'s statutory minimum`} noPad>
            <TableWrap>
              <Table size="small">
                <TableHead><TableRow><TableCell>TYPE</TableCell><TableCell align="right">DAYS / YEAR</TableCell><TableCell>RULE</TableCell></TableRow></TableHead>
                <TableBody>
                  {types.filter((t) => t.active).map((t) => (
                    <TableRow key={t.code}>
                      <TableCell>{t.name}</TableCell>
                      <TableCell align="right">{t.annual ?? "—"}</TableCell>
                      <TableCell>{t.statutory_floor ? <Tag tone="warn">{`Lifted from ${t.company_annual} (statutory)`}</Tag> : t.country ? <Tag tone="info">{`${p.name} statutory`}</Tag> : <Tag tone="neutral">Company</Tag>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
            <Box sx={{ p: 2 }}>
              {p.leaveNotes.map(([k, v]) => <Typography key={k} sx={{ fontSize: "0.65rem", py: 0.25 }}><b>{k}:</b> {v}</Typography>)}
              <Typography sx={{ fontSize: "0.6rem", color: ONAS.muted, mt: 1 }}>Leave requests and balances for {p.name} staff use this table automatically.</Typography>
            </Box>
          </SectionCard>
          <SectionCard title={`Public holidays ${today.slice(0, 4)}`} subtitle={cc === "IN" ? "Company holiday calendar" : `${p.name} gazetted holidays`} noPad>
            <TableWrap>
              <Table size="small">
                <TableBody>
                  {holidays.map((h) => {
                    const past = h.date < today;
                    return (
                      <TableRow key={h.date + h.name} sx={{ opacity: past ? 0.5 : 1 }}>
                        <TableCell sx={{ width: 110 }}>{fmtDate(h.date)}</TableCell>
                        <TableCell>{h.name}{h.approx && <Typography component="span" sx={{ fontSize: "0.58rem", color: ONAS.muted }}> · date may move</Typography>}</TableCell>
                        <TableCell align="right">{!past && h === upcoming[0] && <Tag tone="accent">Next</Tag>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrap>
          </SectionCard>
        </Grid>
      )}

      {tab === "compliance" && (
        <Stack spacing={2.5}>
          {fails.length > 0 && <Alert severity="error">{fails.length} blocking issue(s) will stop the {p.name} payroll run until fixed.</Alert>}
          <Grid min={340}>
            <SectionCard title="Filing calendar" subtitle="Next due date for each statutory return" noPad>
              <TableWrap>
                <Table size="small">
                  <TableHead><TableRow><TableCell>RETURN</TableCell><TableCell>AUTHORITY</TableCell><TableCell>DUE</TableCell><TableCell align="right">LEFT</TableCell></TableRow></TableHead>
                  <TableBody>
                    {[...cal].sort((a, b) => a.daysLeft - b.daysLeft).map((c) => (
                      <TableRow key={c.name}><TableCell>{c.name}<Typography sx={{ fontSize: "0.58rem", color: ONAS.muted }}>{c.freq}</Typography></TableCell><TableCell>{c.authority}</TableCell><TableCell>{fmtDate(c.due)}</TableCell><TableCell align="right"><Tag tone={c.daysLeft <= 3 ? "bad" : c.daysLeft <= 10 ? "warn" : "neutral"}>{`${c.daysLeft} d`}</Tag></TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            </SectionCard>
            <SectionCard title="Compliance checks by employee" subtitle={`${flat.length} checks · ${fails.length} blocking · ${warns.length} warnings`} noPad>
              <Box sx={{ maxHeight: 420, overflow: "auto" }}>
                {flat.length === 0 && <Typography sx={{ p: 2, fontSize: "0.65rem" }}>No employees in {p.name} yet.</Typography>}
                {[...flat].sort((a, b) => ["fail", "warn", "info", "pass"].indexOf(a.status) - ["fail", "warn", "info", "pass"].indexOf(b.status)).map((c, i) => (
                  <Stack key={i} direction="row" spacing={1} sx={{ px: 2, py: 0.8, borderBottom: `1px solid ${ONAS.line}` }}>
                    <Tag tone={STATUS_TONE[c.status]}>{c.block ? "Blocking" : c.status}</Tag>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.65rem", fontWeight: 700 }}>{c.e.full_name} · {c.rule}</Typography>
                      <Typography sx={{ fontSize: "0.6rem", color: ONAS.muted }}>{c.detail}{c.law && ` · ${c.law}`}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Box>
            </SectionCard>
          </Grid>
          <SectionCard title={`${p.name} employment policy`} subtitle={p.engine.RATES.effective}>
            <Grid min={240}>
              {Object.entries(p.engine.policy).map(([head, list]) => (
                <Box key={head}>
                  <Typography sx={{ fontSize: "0.62rem", fontWeight: 800, color: ONAS.teal, letterSpacing: "0.06em", mb: 0.5 }}>{head.toUpperCase()}</Typography>
                  {list.map(([k, v]) => <Typography key={k} sx={{ fontSize: "0.65rem", py: 0.2 }}><b>{k}:</b> {v}</Typography>)}
                </Box>
              ))}
            </Grid>
          </SectionCard>
        </Stack>
      )}

      {(tab === "documents" || tab === "people") && (
        <Grid min={320}>
          <SectionCard title="Onboarding documents" subtitle={`What a new joiner in ${p.name} must provide`}>
            {p.documents.map((d, i) => <Typography key={d} sx={{ fontSize: "0.68rem", py: 0.4, borderBottom: `1px dashed ${ONAS.line}` }}>{i + 1}. {d}</Typography>)}
            <Button size="small" startIcon={<Sparkle size={14} />} sx={{ mt: 1 }} onClick={() => openCopilot(`Write a welcome email for a new joiner in ${p.name} listing these documents: ${p.documents.join(", ")}.`)}>Draft welcome email with AI</Button>
          </SectionCard>
          <SectionCard title="Contract & exit terms" subtitle={`${p.name} · probation usually ${p.probationMonths} months`}>
            {(p.engine.policy["Employment terms"] || []).map(([k, v]) => <Typography key={k} sx={{ fontSize: "0.68rem", py: 0.4 }}><b>{k}:</b> {v}</Typography>)}
            {!isEmp && (
              <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: "wrap" }}>
                <Button size="small" startIcon={<Sparkle size={14} />} onClick={() => openCopilot(`Draft an offer-letter clause set (probation, notice, leave, working hours, statutory deductions) that complies with ${p.name} law.`)}>Offer clauses</Button>
                <Button size="small" startIcon={<Sparkle size={14} />} onClick={() => openCopilot(`Draft a resignation-acceptance letter for ${p.name}, including notice period, final pay and any severance under local law.`)}>Exit letter</Button>
              </Stack>
            )}
          </SectionCard>
          {!isEmp && (
            <SectionCard title="New joiners and probation" subtitle={p.name} noPad>
              <TableWrap>
                <Table size="small">
                  <TableHead><TableRow><TableCell>EMPLOYEE</TableCell><TableCell>JOINED</TableCell><TableCell>PROBATION</TableCell></TableRow></TableHead>
                  <TableBody>
                    {staff.length === 0 && <TableRow><TableCell colSpan={3}>No staff in {p.name} yet.</TableCell></TableRow>}
                    {staff.map((e) => <TableRow key={e.employee_code}><TableCell><PersonCell name={e.full_name} sub={e.reporting_manager ? `Manager: ${nameOf(e.reporting_manager)}` : e.designation} /></TableCell><TableCell>{fmtDate(e.date_of_joining)}</TableCell><TableCell>{e.probation_status === "confirmed" ? <Tag tone="good">Confirmed</Tag> : <Tag tone="warn">{`Ends ${fmtDate(e.probation_end_date)}`}</Tag>}</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </TableWrap>
            </SectionCard>
          )}
        </Grid>
      )}

      {tab === "automations" && <Automations cd={cd} />}
    </Stack>
  );
}

export default function CountryWorkspace() {
  const { user } = useStore();
  const { country, region, setScope, locked } = useCountry();
  const regionName = region ? `${region} · ${REGION_INFO[region].name}` : null;
  return (
    <>
      <PageHeader
        eyebrow={locked ? "ME · COUNTRY SPACE" : region ? `REGION SPACE · ${region}` : "GLOBAL · COUNTRY SPACE"}
        title={country ? "Country space" : region ? `Region space · ${regionName}` : "Country space · all regions"}
        subtitle={country ? `Payroll, statutory deductions, leave, public holidays, compliance, documents, automations and AI — all following ${packFor(country).name}'s rules.` : region ? `Every ${region} country side by side: staff, cost, compliance and the statutory filings due. Open a country to run its payroll and rules; AI answers for the whole region.` : "AMER, EMEA, ASIA and AFRICA in one view. Pick a region or a country to switch payroll, leave, holidays, compliance and AI to its rules — or use the selector at the top of every page."}
        actions={!locked && (country || region) ? (
          <Stack direction="row" spacing={1}>
            {country && <Button size="small" variant="outlined" onClick={() => setScope(`REGION:${packFor(country).region}`)}>{`${packFor(country).region} region`}</Button>}
            <Button size="small" variant="outlined" onClick={() => setScope("ALL")}>All regions</Button>
          </Stack>
        ) : null}
      />
      {country ? <CountryView key={country} cc={country} /> : user.role === "emp" ? <Alert severity="info">Your country is not set yet. Ask HR to complete your profile.</Alert> : <GlobalGrid region={region} onPick={setScope} onRegion={setScope} />}
      <Divider sx={{ mt: 3, mb: 1 }} />
      <Typography sx={{ fontSize: "0.58rem", color: ONAS.muted }}>Statutory rates are built into each country engine with the effective period shown. Laws change; confirm with a local adviser before filing.</Typography>
    </>
  );
}
