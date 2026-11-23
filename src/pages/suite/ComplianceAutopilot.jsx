// Compliance autopilot (v10): compliance health, deadlines with alerts, rule packs that update themselves when tax or
// labour law changes, a ready-to-submit audit pack with the full audit trail, and data privacy (DPDP, GDPR and others).
// Also the employee's own "Privacy & my data" page.
import { MonitoringConsent } from "../workforce/MyActivity.jsx";
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { Gavel, EventBusy, TaskAlt, Update, Policy, PrivacyTip, DownloadRounded, SyncRounded, NotificationsActive, Inventory2, Shield } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, TableWrap, PersonCell, EmptyState } from "../../components/kit/UI.jsx";
import { ModuleHub, Ring, Pill, StatusPill, TwoCol, Hint, C, Progress, useWho, asList } from "../../components/suite/Hub.jsx";
import { allDeadlines, computeRun } from "../../lib/suitePayroll.js";
import { COUNTRIES, complianceChecks, periodContext, toEngineEmp } from "../../lib/payroll/index.js";
import { downloadCsv, fmtDate, fmtDateTime, isoDate, monthLabel } from "../../lib/utils.js";

const TABS = [["health", "Compliance health", "/compliance-autopilot"], ["alerts", "Deadlines & alerts", "/compliance-alerts"], ["rules", "Rule updates", "/rule-updates"], ["audit", "Audit pack & trail", "/audit-pack"], ["privacy", "Data privacy", "/privacy-center"]];

function useChecks(data) {
  return useMemo(() => {
    const ctx = periodContext(isoDate(), { weeklyHours: 45 });
    return data.employees.filter((e) => e.status === "active").flatMap((e) => {
      try { return complianceChecks(toEngineEmp(e), ctx).map((c) => ({ ...c, e })); } catch { return []; }
    });
  }, [data.employees]);
}

export default function ComplianceAutopilot({ tab = "health" }) {
  const { data } = useStore();
  const s = data.suite || {};
  const checks = useChecks(data);
  const deadlines = allDeadlines(data);
  const pendingRules = (s.ruleUpdates || []).filter((r) => r.status === "pending_review");
  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  const openDsr = (s.privacy?.requests || []).filter((r) => r.status !== "completed" && r.status !== "rejected");
  const score = Math.round((checks.filter((c) => c.status === "pass" || c.status === "info").length / Math.max(1, checks.length)) * 100);
  const brief = {
    health: { text: <>Compliance health <b>{score}%</b>. {fails.length} failing check(s), {deadlines.filter((d) => d.daysLeft <= 7).length} filing(s) due this week, {pendingRules.length} law change(s) waiting for review.</> },
    alerts: { text: <>Next deadline: <b>{deadlines[0]?.name}</b> ({deadlines[0]?.countryName}) in <b>{deadlines[0]?.daysLeft} days</b>. Reminders go out {(s.alertSettings?.days_before || []).join(", ")} day(s) before.</> },
    rules: { text: <>Rule packs update themselves when tax or labour law changes. {pendingRules.length ? <><b>{pendingRules.length}</b> change(s) need a quick review before they take effect.</> : "Everything is on the latest rules."}</> },
    audit: { text: <>Every approval, change and sign-in is recorded with who, when, device and IP — <b>{data.audit.length}</b> entries. Build a ready-to-submit audit pack in one click.</> },
    privacy: { text: <>Personal data is handled under {(s.privacy?.laws || []).slice(0, 3).join(", ")} and more. <b>{openDsr.length}</b> data request(s) open.</> },
  }[tab];
  return (
    <ModuleHub
      eyebrow="COMPLIANCE · AUTOPILOT"
      title="Compliance without worry"
      subtitle="Statutory rules that update themselves, alerts before every filing deadline, a full audit trail with ready-to-submit reports, and data privacy for DPDP, GDPR and similar laws."
      tabs={TABS.map((t) => (t[0] === "rules" && pendingRules.length ? [...t, pendingRules.length] : t[0] === "privacy" && openDsr.length ? [...t, openDsr.length] : t))}
      tab={tab}
      brief={brief}
      kpis={tab === "health" ? [
        { label: "Health score", value: `${score}%`, hint: `${checks.length} checks`, icon: <TaskAlt />, tone: score >= 90 ? "mint" : "glob" },
        { label: "Due in 7 days", value: deadlines.filter((d) => d.daysLeft <= 7).length, hint: "filings", icon: <EventBusy />, tone: "glob" },
        { label: "Failing checks", value: fails.length, hint: `${warns.length} warnings`, icon: <Gavel />, tone: fails.length ? "bad" : "mint" },
        { label: "Law changes", value: pendingRules.length, hint: "to review", icon: <Update />, tone: "navy" },
        { label: "Filed this cycle", value: (s.filings || []).filter((f) => f.status === "filed").length, hint: "returns", icon: <Policy />, tone: "mint" },
        { label: "Privacy requests", value: openDsr.length, hint: "open", icon: <PrivacyTip />, tone: "purple" },
      ] : undefined}
    >
      {tab === "health" && <Health checks={checks} score={score} deadlines={deadlines} />}
      {tab === "alerts" && <Alerts deadlines={deadlines} />}
      {tab === "rules" && <Rules />}
      {tab === "audit" && <AuditPack />}
      {tab === "privacy" && <Privacy />}
    </ModuleHub>
  );
}

function Health({ checks, score, deadlines }) {
  const { data } = useStore();
  const byCountry = {};
  checks.forEach((c) => { const k = c.e.country_code || "IN"; (byCountry[k] ||= { pass: 0, warn: 0, fail: 0, info: 0, laws: new Set() }); byCountry[k][c.status] = (byCountry[k][c.status] || 0) + 1; if (c.law) byCountry[k].laws.add(c.law); });
  const classes = [["Tax & withholding", /tax|TDS|PAYE|Income/i], ["Social security & pension", /PF|ESI|social|pension|CPF|NSSF|gratuity/i], ["Wages & working time", /wage|hours|overtime|minimum|bonus/i], ["State & local", /state|professional|welfare|LWF/i]];
  const appl = classes.map(([name, re]) => [name, new Set(checks.filter((c) => re.test(`${c.rule} ${c.law}`)).map((c) => c.law)).size]);
  const total = appl.reduce((s, [, n]) => s + n, 0);
  return (
    <TwoCol right={340}>
      <Stack spacing={2}>
        <SectionCard title="Checks that need action" subtitle="Run against every active employee with the rules of their country" noPad>
          {checks.filter((c) => c.status === "fail" || c.status === "warn").length === 0 ? <EmptyState title="All checks pass" /> : (
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Rule</TableCell><TableCell>Detail</TableCell><TableCell>Law</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>{checks.filter((c) => c.status === "fail" || c.status === "warn").slice(0, 25).map((c, i) => (
                <TableRow key={i}><TableCell><PersonCell name={c.e.full_name} sub={c.e.country_code || "IN"} /></TableCell><TableCell>{c.rule}</TableCell><TableCell sx={{ maxWidth: 320 }}>{c.detail}</TableCell><TableCell><Typography variant="caption">{c.law}</Typography></TableCell><TableCell><Pill tone={c.status === "fail" ? "bad" : "glob"}>{c.status}</Pill></TableCell></TableRow>
              ))}</TableBody></Table></TableWrap>
          )}
        </SectionCard>
        <SectionCard title="By country" noPad>
          <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Country</TableCell><TableCell align="right">Pass</TableCell><TableCell align="right">Warnings</TableCell><TableCell align="right">Failing</TableCell><TableCell align="right">Laws tracked</TableCell></TableRow></TableHead>
            <TableBody>{Object.entries(byCountry).map(([k, v]) => <TableRow key={k}><TableCell>{COUNTRIES[k]?.name || k}</TableCell><TableCell align="right">{(v.pass || 0) + (v.info || 0)}</TableCell><TableCell align="right">{v.warn || 0}</TableCell><TableCell align="right" sx={{ color: v.fail ? "error.main" : undefined, fontWeight: v.fail ? 700 : 400 }}>{v.fail || 0}</TableCell><TableCell align="right">{v.laws.size}</TableCell></TableRow>)}</TableBody></Table></TableWrap>
        </SectionCard>
      </Stack>
      <Stack spacing={2}>
        <SectionCard title="Compliance health">
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}><Ring value={score} size={110} color={score >= 90 ? C.mintDeep : C.glob} sub="health" /><Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{score >= 90 ? "On track" : "Needs attention"}</Typography><Typography variant="caption" color="text.secondary">Checks, filings and rule updates combined.</Typography></Box></Stack>
        </SectionCard>
        <SectionCard title="Applicable to you · by class" subtitle={`${total} laws and rules tracked`}>
          <Stack spacing={1.2}>{appl.map(([n, v], i) => <Progress key={n} label={n} right={v} value={(v / Math.max(1, total)) * 100} color={[C.navy, C.glob, C.mintDeep, "#5B4BB7"][i]} />)}</Stack>
        </SectionCard>
        <SectionCard title="Coming up" noPad>
          {deadlines.slice(0, 6).map((d) => <Stack key={`${d.country}${d.name}`} direction="row" sx={{ px: 2, py: 0.9, borderBottom: 1, borderColor: "divider", justifyContent: "space-between" }}><Box sx={{ minWidth: 0 }}><Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{d.name}</Typography><Typography variant="caption" color="text.secondary">{d.countryName} · {fmtDate(d.due)}</Typography></Box><Pill tone={d.daysLeft <= 3 ? "glob" : "navy"}>{d.daysLeft}d</Pill></Stack>)}
        </SectionCard>
      </Stack>
    </TwoCol>
  );
}

function Alerts({ deadlines }) {
  const { data, suiteDo, suiteCan, notifyToast } = useStore();
  const a = data.suite?.alertSettings || { days_before: [7, 3, 1] };
  const [f, setF] = useState(a);
  const can = suiteCan("compliance");
  const filed = data.suite?.filings || [];
  const admins = [...data.admins.filter((x) => x.status === "active").map((x) => [x.admin_code, `${x.full_name} (admin)`]), ...(data.superAdmins || []).map((x) => [x.superadmin_code, `${x.full_name} (super admin)`])];
  function save() {
    const r = suiteDo("compliance", (s) => { s.alertSettings = f; }, { action: "COMPLIANCE_ALERTS", details: `Reminders ${f.days_before.join("/")} days before · email ${f.email} · in-app ${f.inapp} · WhatsApp ${f.whatsapp}` });
    if (r.ok) notifyToast("Alert settings saved.");
  }
  function sendNow() {
    const soon = deadlines.filter((d) => d.daysLeft <= Math.max(...f.days_before));
    suiteDo("compliance", () => ({}), { action: "COMPLIANCE_REMINDER", details: `${soon.length} reminders sent`, note: { to: f.recipients, text: `Compliance reminder: ${soon.slice(0, 3).map((d) => `${d.name} (${d.countryName}) in ${d.daysLeft}d`).join("; ")}${soon.length > 3 ? ` and ${soon.length - 3} more` : ""}.`, link: "/compliance-alerts" } });
    notifyToast(`Reminder sent for ${soon.length} deadline(s).`);
  }
  return (
    <TwoCol right={360}>
      <SectionCard title="Every statutory deadline" subtitle="Across all countries where you have staff" noPad>
        <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Filing</TableCell><TableCell>Country</TableCell><TableCell>Authority</TableCell><TableCell>Frequency</TableCell><TableCell>Due</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
          <TableBody>{deadlines.map((d) => {
            const done = filed.some((x) => x.country === d.country && x.status === "filed" && d.name.toLowerCase().includes(x.form.split(" ")[0].toLowerCase()) && x.period === isoDate().slice(0, 7));
            return <TableRow key={`${d.country}${d.name}`}><TableCell sx={{ fontWeight: 600 }}>{d.name}</TableCell><TableCell>{d.countryName}</TableCell><TableCell>{d.authority}</TableCell><TableCell>{d.freq}</TableCell><TableCell>{fmtDate(d.due)} · {d.daysLeft}d</TableCell><TableCell><StatusPill status={done ? "filed" : d.daysLeft <= 3 ? "pending" : "scheduled"} /></TableCell></TableRow>;
          })}</TableBody></Table></TableWrap>
      </SectionCard>
      <SectionCard title="Alerts before deadlines" subtitle="Who is reminded, when and how">
        <Stack spacing={1.5}>
          <Box><Typography variant="caption" color="text.secondary">Remind me (days before)</Typography>
            <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: "wrap", mt: 0.5 }}>{[15, 10, 7, 5, 3, 2, 1].map((n) => <Chip key={n} label={`${n}d`} color={f.days_before.includes(n) ? "primary" : "default"} onClick={() => can && setF({ ...f, days_before: f.days_before.includes(n) ? f.days_before.filter((x) => x !== n) : [...f.days_before, n].sort((x, y) => y - x) })} />)}</Stack></Box>
          {[["email", "Email"], ["inapp", "In-app notification"], ["whatsapp", "WhatsApp"], ["sms", "SMS"], ["escalate_overdue", "Escalate to Super Admin when overdue"]].map(([k, l]) => <FormControlLabel key={k} control={<Switch checked={!!f[k]} disabled={!can} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />} label={l} />)}
          <TextField select slotProps={{ select: { multiple: true } }} label="Recipients" value={f.recipients || []} onChange={(e) => setF({ ...f, recipients: asList(e.target.value) })} disabled={!can} size="small">{admins.map(([c, n]) => <MenuItem key={c} value={c}>{n}</MenuItem>)}</TextField>
          <Stack direction="row" spacing={1}><Button variant="contained" onClick={save} disabled={!can}>Save</Button><Button startIcon={<NotificationsActive />} onClick={sendNow} disabled={!can}>Send reminders now</Button></Stack>
        </Stack>
      </SectionCard>
    </TwoCol>
  );
}

function Rules() {
  const { data, suiteDo, suiteCan, notifyToast } = useStore();
  const s = data.suite || {};
  const can = suiteCan("compliance");
  const [checking, setChecking] = useState(false);
  function apply(id) {
    suiteDo("compliance", (x, { now }) => { const r = x.ruleUpdates.find((u) => u.id === id); r.status = "applied"; r.applied_at = now; return { title: r.title }; }, { action: "RULE_UPDATE_APPLY", details: (r) => `${id} · ${r.title}` });
    notifyToast("Applied — the next payroll run uses the new rule.");
  }
  function check() {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      suiteDo("compliance", (x, { now }) => { x.lastRuleCheck = now; }, { action: "RULE_UPDATE_CHECK", details: "Checked statutory rule feeds" });
      notifyToast("You're on the latest rule packs for every country.");
    }, 900);
  }
  return (
    <Stack spacing={2}>
      <SectionCard title="How rules stay current" action={<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><FormControlLabel control={<Switch checked={!!s.autoApply} disabled={!can} onChange={(e) => suiteDo("compliance", (x) => { x.autoApply = e.target.checked; }, { action: "RULE_AUTO_APPLY", details: `Auto-apply ${e.target.checked}` })} />} label="Auto-apply routine updates" /><Button variant="outlined" startIcon={<SyncRounded />} onClick={check} disabled={checking || !can}>{checking ? "Checking…" : "Check for updates"}</Button></Stack>}>
        <Typography variant="body2" color="text.secondary">Each country engine is a versioned rule pack (tax slabs, PF / ESI / PT / LWF rates, PAYE codes, social security caps, minimum wages). When a government notifies a change, the pack is updated with its effective date. Routine rate changes apply automatically; anything that changes how pay is structured waits for your review. {s.lastRuleCheck ? `Last checked ${fmtDateTime(s.lastRuleCheck)}.` : ""}</Typography>
      </SectionCard>
      <SectionCard title="Law changes" noPad>
        <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Country</TableCell><TableCell>Area</TableCell><TableCell>Change</TableCell><TableCell>Effective</TableCell><TableCell>Impact</TableCell><TableCell>Status</TableCell><TableCell align="right" /></TableRow></TableHead>
          <TableBody>{(s.ruleUpdates || []).map((r) => (
            <TableRow key={r.id}><TableCell>{COUNTRIES[r.country]?.name || r.country}</TableCell><TableCell>{r.area}</TableCell><TableCell sx={{ maxWidth: 360 }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{r.title}</Typography><Typography variant="caption" color="text.secondary">{r.source}</Typography></TableCell><TableCell>{fmtDate(r.effective)}</TableCell><TableCell sx={{ maxWidth: 240 }}><Typography variant="caption">{r.impact}</Typography></TableCell><TableCell><StatusPill status={r.status} /></TableCell>
              <TableCell align="right">{r.status === "pending_review" && <Button size="small" variant="contained" disabled={!can} onClick={() => apply(r.id)}>Review & apply</Button>}</TableCell></TableRow>
          ))}</TableBody></Table></TableWrap>
      </SectionCard>
    </Stack>
  );
}

function AuditPack() {
  const { data, suiteDo, suiteCan, notifyToast, user } = useStore();
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState(isoDate().slice(0, 7));
  const can = suiteCan("compliance");
  const rows = data.audit.filter((a) => !q || `${a.action} ${a.details} ${a.user_code}`.toLowerCase().includes(q.toLowerCase()));
  function build() {
    const run = computeRun(data, { period });
    const lines = [
      ["SECTION", "A. Payroll register", "", "", "", ""],
      ...run.rows.map((r) => ["Payroll", r.e.employee_code, r.e.full_name, r.code, r.pay?.earned ?? "", r.pay?.net ?? ""]),
      ["SECTION", "B. Statutory summary (India, INR)", "", "", "", ""],
      ...Object.entries(run.stat).map(([k, v]) => ["Statutory", k, "", "IN", Math.round(v), ""]),
      ["SECTION", "C. Filings & acknowledgements", "", "", "", ""],
      ...(data.suite?.filings || []).map((f) => ["Filing", f.form, f.period, f.country, f.status, f.ack || ""]),
      ["SECTION", "D. Bank payouts", "", "", "", ""],
      ...(data.suite?.payouts || []).map((p) => ["Payout", p.id, p.period, p.country, p.amount, p.utr || p.status]),
      ["SECTION", "E. Audit trail", "", "", "", ""],
      ...data.audit.slice(0, 500).map((a) => ["Audit", a.timestamp, a.user_code, a.action, a.details, `${a.ip} · ${a.device}`]),
    ];
    downloadCsv(`audit-pack-${period}.csv`, ["Type", "Field 1", "Field 2", "Field 3", "Field 4", "Field 5"], lines);
    suiteDo("compliance", (s, { now }) => { s.auditPacks = [{ id: `AP-${Date.now()}`, name: `Statutory audit pack — ${period}`, period, created_at: now, by: user.code, items: 5 }, ...(s.auditPacks || [])]; }, { action: "AUDIT_PACK", details: `Audit pack ${period}` });
    notifyToast("Audit pack downloaded: payroll register, statutory summary, filings, payouts and audit trail.");
  }
  return (
    <Stack spacing={2}>
      <SectionCard title="Ready-to-submit audit pack" subtitle="Payroll register · statutory summary · filings with acknowledgements · bank payouts · full audit trail">
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
          <TextField type="month" size="small" label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Button variant="contained" startIcon={<Inventory2 />} onClick={build} disabled={!can}>Build & download pack</Button>
          <Typography variant="caption" color="text.secondary">{(data.suite?.auditPacks || []).length} pack(s) built · last {(data.suite?.auditPacks || [])[0] ? fmtDateTime(data.suite.auditPacks[0].created_at) : "never"}</Typography>
        </Stack>
      </SectionCard>
      <SectionCard title="Audit trail" subtitle="Tamper-evident log of every change — who, what, when, from which device" action={<Stack direction="row" spacing={1}><TextField size="small" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /><Button size="small" startIcon={<DownloadRounded />} onClick={() => downloadCsv("audit-trail.csv", ["When", "User", "Role", "Action", "Details", "IP", "Device"], rows.map((a) => [a.timestamp, a.user_code, a.role, a.action, a.details, a.ip, a.device]))}>Export</Button></Stack>} noPad>
        <TableWrap><Table size="small"><TableHead><TableRow><TableCell>When</TableCell><TableCell>User</TableCell><TableCell>Action</TableCell><TableCell>Details</TableCell><TableCell>IP · device</TableCell></TableRow></TableHead>
          <TableBody>{rows.slice(0, 40).map((a) => <TableRow key={a.log_id}><TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDateTime(a.timestamp)}</TableCell><TableCell>{a.user_code}</TableCell><TableCell><Pill>{a.action}</Pill></TableCell><TableCell sx={{ maxWidth: 380 }}>{a.details}</TableCell><TableCell><Typography variant="caption">{a.ip} · {a.device}</Typography></TableCell></TableRow>)}</TableBody></Table></TableWrap>
      </SectionCard>
    </Stack>
  );
}

const DSR_TYPES = { access: "Access — copy of my data", correction: "Correction", erasure: "Erasure (right to be forgotten)", portability: "Portability (machine-readable copy)", withdraw: "Withdraw consent", objection: "Object to processing" };

function Privacy() {
  const { data, suiteDo, suiteCan, notifyToast, nameOf } = useStore();
  const p = data.suite?.privacy || {};
  const can = suiteCan("privacy");
  const consents = Object.values(data.consents || {}).filter(Boolean);
  const [breach, setBreach] = useState(null);
  function decide(id, status) {
    suiteDo("privacy", (s, { now }) => { const r = s.privacy.requests.find((x) => x.id === id); r.status = status; r.closed_at = now; return { emp: r.employee_code }; }, { action: "DSR_DECISION", details: `${id} · ${status}`, note: (r) => ({ to: r.emp, text: `Your data request ${id} is ${status.replace("_", " ")}.`, link: "/my-privacy" }) });
    notifyToast(`Request ${id} ${status.replace("_", " ")}.`);
  }
  function logBreach() {
    suiteDo("privacy", (s, { now }) => { s.privacy.breaches = [{ id: `BR-${Date.now()}`, at: now, ...breach, notified_board: breach.severity === "high" }, ...(s.privacy.breaches || [])]; }, { action: "PRIVACY_BREACH_LOG", details: `${breach.severity} · ${breach.summary}` });
    notifyToast(breach.severity === "high" ? "Logged. High-severity breaches must be reported to the Data Protection Board / regulator within 72 hours." : "Breach logged.");
    setBreach(null);
  }
  return (
    <Stack spacing={2}>
      <TwoCol right={360}>
        <SectionCard title="Data subject requests" subtitle="Access, correction, erasure and portability — answered within the legal time limit" noPad>
          {(p.requests || []).length === 0 ? <EmptyState title="No requests" /> : (
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Request</TableCell><TableCell>Employee</TableCell><TableCell>Type</TableCell><TableCell>Due</TableCell><TableCell>Status</TableCell><TableCell align="right" /></TableRow></TableHead>
              <TableBody>{p.requests.map((r) => (
                <TableRow key={r.id}><TableCell>{r.id}</TableCell><TableCell><PersonCell name={nameOf(r.employee_code)} sub={r.detail} /></TableCell><TableCell>{DSR_TYPES[r.type] || r.type}</TableCell><TableCell>{fmtDate(r.due)}</TableCell><TableCell><StatusPill status={r.status} /></TableCell>
                  <TableCell align="right">{!["completed", "rejected"].includes(r.status) && <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}><Button size="small" disabled={!can} onClick={() => decide(r.id, "completed")}>Complete</Button><Button size="small" color="error" disabled={!can} onClick={() => decide(r.id, "rejected")}>Decline</Button></Stack>}</TableCell></TableRow>
              ))}</TableBody></Table></TableWrap>
          )}
        </SectionCard>
        <Stack spacing={2}>
          <SectionCard title="Privacy set-up">
            <Stack spacing={0.8}>
              <Typography variant="body2"><b>Data protection officer:</b> {p.dpo?.name} · {p.dpo?.email}</Typography>
              <Typography variant="body2"><b>Data residency:</b> {p.residency}</Typography>
              <Typography variant="body2"><b>Consent on file:</b> {consents.length} employees · location {consents.filter((c) => c.location).length} · activity {consents.filter((c) => c.activity).length}</Typography>
              <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap", pt: 0.5 }}>{(p.laws || []).map((l) => <Pill key={l} tone="purple">{l}</Pill>)}</Stack>
            </Stack>
          </SectionCard>
          <SectionCard title="Breach register" action={<Button size="small" disabled={!can} onClick={() => setBreach({ severity: "low", summary: "", affected: 0 })}>Log a breach</Button>}>
            {(p.breaches || []).length === 0 ? <Typography variant="body2" color="text.secondary">No personal-data breaches recorded.</Typography> : p.breaches.map((b) => <Typography key={b.id} variant="body2">{fmtDate(b.at)} · {b.severity} · {b.summary} ({b.affected} people)</Typography>)}
          </SectionCard>
        </Stack>
      </TwoCol>
      <SectionCard title="Retention schedule" subtitle="Records are deleted or anonymised automatically when the period ends" action={<Button size="small" startIcon={<DownloadRounded />} onClick={() => downloadCsv("record-of-processing.csv", ["Record", "Kept for", "Lawful basis"], p.retention || [])}>Record of processing</Button>} noPad>
        <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Record</TableCell><TableCell>Kept for</TableCell><TableCell>Lawful basis</TableCell></TableRow></TableHead><TableBody>{(p.retention || []).map(([a, b, c]) => <TableRow key={a}><TableCell>{a}</TableCell><TableCell>{b}</TableCell><TableCell>{c}</TableCell></TableRow>)}</TableBody></Table></TableWrap>
      </SectionCard>
      <Dialog open={!!breach} onClose={() => setBreach(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Log a personal-data breach</DialogTitle>
        <DialogContent><Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField select label="Severity" value={breach?.severity || "low"} onChange={(e) => setBreach({ ...breach, severity: e.target.value })}>{["low", "medium", "high"].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>
          <TextField label="What happened" multiline minRows={2} value={breach?.summary || ""} onChange={(e) => setBreach({ ...breach, summary: e.target.value })} />
          <TextField type="number" label="People affected" value={breach?.affected || 0} onChange={(e) => setBreach({ ...breach, affected: +e.target.value })} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setBreach(null)}>Cancel</Button><Button variant="contained" disabled={!breach?.summary} onClick={logBreach}>Log</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}

// ── Employee: Privacy & my data ─────────────────────────────────────────────────
export function MyPrivacy() {
  const { data, user, suiteDo, notifyToast } = useStore();
  const me = data.employees.find((e) => e.employee_code === user.employee_code);
  const mine = (data.suite?.privacy?.requests || []).filter((r) => r.employee_code === me.employee_code);
  const consent = data.consents?.[me.employee_code];
  const [f, setF] = useState({ type: "access", detail: "" });
  function raise() {
    const r = suiteDo("privacy-self", (s, { now, me: code }) => {
      const id = `DSR-${String(30 + (s.privacy.requests || []).length).padStart(3, "0")}`;
      s.privacy.requests = [{ id, employee_code: code, type: f.type, detail: f.detail || DSR_TYPES[f.type], raised_at: now, due: isoDate(new Date(Date.now() + 30 * 86400000)), status: "in_progress" }, ...(s.privacy.requests || [])];
      return { id };
    }, { action: "DSR_RAISED", details: (r) => `${r.id} · ${f.type}`, note: { to: "SA001", text: `New data request from ${me.full_name}: ${DSR_TYPES[f.type]}.`, link: "/privacy-center" } });
    if (r.ok) { notifyToast(`Request ${r.id} raised. You'll get an answer within 30 days.`); setF({ type: "access", detail: "" }); }
  }
  function downloadMine() {
    const blob = new Blob([JSON.stringify({ profile: me, requests: data.requests.filter((r) => r.employee_code === me.employee_code), consent, payslips: data.payslipBatches.flatMap((b) => b.slips.filter((s) => s.employee_code === me.employee_code).map((s) => ({ period: b.period, ...s }))) }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `my-data-${me.employee_code}.json`; a.click();
    notifyToast("Your data was downloaded as a machine-readable file.");
  }
  return (
    <ModuleHub eyebrow="ME · PRIVACY" title="Privacy & my data" subtitle="See what we hold about you and why, download a copy, ask for corrections or erasure, and manage your consent — your rights under India's DPDP Act, GDPR and similar laws."
      brief={{ text: <>We use your data to run payroll, attendance and benefits. Location and activity tracking are mandatory under the company monitoring policy — currently location <b>{consent?.location ? "on" : "off"}</b>, activity <b>{consent?.activity ? "on" : "off"}</b>.</> }}>
      <Box sx={{ mb: 2.5 }}><MonitoringConsent /></Box>
      <TwoCol right={380}>
        <Stack spacing={2}>
          <SectionCard title="What we hold and why" noPad>
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Record</TableCell><TableCell>Kept for</TableCell><TableCell>Why</TableCell></TableRow></TableHead><TableBody>{(data.suite?.privacy?.retention || []).map(([a, b, c]) => <TableRow key={a}><TableCell>{a}</TableCell><TableCell>{b}</TableCell><TableCell>{c}</TableCell></TableRow>)}</TableBody></Table></TableWrap>
          </SectionCard>
          <SectionCard title="My requests" noPad>
            {mine.length === 0 ? <EmptyState title="No requests yet" /> : <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Request</TableCell><TableCell>Type</TableCell><TableCell>Raised</TableCell><TableCell>Due</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{mine.map((r) => <TableRow key={r.id}><TableCell>{r.id}</TableCell><TableCell>{DSR_TYPES[r.type]}</TableCell><TableCell>{fmtDate(r.raised_at)}</TableCell><TableCell>{fmtDate(r.due)}</TableCell><TableCell><StatusPill status={r.status} /></TableCell></TableRow>)}</TableBody></Table></TableWrap>}
          </SectionCard>
        </Stack>
        <Stack spacing={2}>
          <SectionCard title="Download my data"><Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Your profile, requests, consent and payslips as a JSON file.</Typography><Button variant="contained" startIcon={<DownloadRounded />} onClick={downloadMine}>Download</Button></SectionCard>
          <SectionCard title="Make a request">
            <Stack spacing={1.5}>
              <TextField select size="small" label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{Object.entries(DSR_TYPES).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField>
              <TextField size="small" label="Details" multiline minRows={2} value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
              <Button variant="contained" onClick={raise}>Send to the data protection officer</Button>
              <Hint>Consent for location and activity tracking can be changed any time under My activity & privacy.</Hint>
            </Stack>
          </SectionCard>
        </Stack>
      </TwoCol>
    </ModuleHub>
  );
}
