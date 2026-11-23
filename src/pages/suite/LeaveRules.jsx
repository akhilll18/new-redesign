// Leave rule-sets (v10): any leave policy you can write down, bundled into rule-sets assigned per team.
// 50+ controls — accrual schedules, probation and joiners, carry-forward caps and expiry, encashment, sandwich rule,
// counting of weekends and holidays, notice, documents, comp-off, approvals and payroll sync — plus a simulator.
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Card, Chip, Divider, FormControlLabel, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableRow, TextField, Typography } from "@mui/material";
import { Rule, Groups, Tune, Science, Add } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard } from "../../components/kit/UI.jsx";
import { ModuleHub, Pill, TwoCol, Hint, C, asList } from "../../components/suite/Hub.jsx";
import { isoDate, fmtDate } from "../../lib/utils.js";

// [key, label, type, options|unit, default]
export const CONTROL_GROUPS = [
  ["Accrual", [
    ["accrual", "Accrual schedule", "select", ["monthly", "quarterly", "yearly upfront", "per days worked"], "monthly"],
    ["accrual_day", "Credit on", "select", ["1st of month", "last day of month", "joining date anniversary"], "1st of month"],
    ["accrual_start", "Start accruing from", "select", ["joining", "confirmation", "after 90 days"], "joining"],
    ["prorate_joiners", "Pro-rate for joiners mid-year", "bool", null, true],
    ["round_accrual", "Round accruals to", "select", ["0.5 day", "1 day", "no rounding"], "0.5 day"],
    ["max_balance", "Maximum balance (days)", "number", "days", 45],
    ["exclude_lop_from_accrual", "No accrual for LOP days", "bool", null, true],
  ]],
  ["Probation & joiners", [
    ["probation_can_apply", "During probation can apply", "select", ["all", "casual_only", "none"], "casual_only"],
    ["probation_accrue", "Accrue during probation", "bool", null, true],
    ["min_service_days_for_el", "Earned leave usable after (days of service)", "number", "days", 90],
  ]],
  ["Carry forward & expiry", [
    ["carry_forward_cap", "Carry forward cap (days)", "number", "days", 30],
    ["carry_forward_expiry_months", "Carried days expire after", "number", "months", 12],
    ["lapse_on_exit", "Lapse un-encashable balance on exit", "bool", null, true],
  ]],
  ["Encashment", [
    ["encashment", "Allow encashment", "bool", null, true],
    ["encash_basis", "Encashment rate", "select", ["basic_div_26", "basic_div_30", "gross_div_30", "ctc_div_365"], "basic_div_26"],
    ["encash_max", "Max days per year", "number", "days", 15],
    ["encash_on_exit", "Encash balance in full & final", "bool", null, true],
  ]],
  ["Sandwich & counting", [
    ["sandwich", "Sandwich rule (weekend between leave days counts)", "bool", null, false],
    ["sandwich_holidays", "Sandwich holidays too", "bool", null, false],
    ["weekend_count", "Count weekends inside leave", "bool", null, false],
    ["holiday_count", "Count public holidays inside leave", "bool", null, false],
  ]],
  ["Applying", [
    ["min_notice_days", "Minimum notice (days)", "number", "days", 2],
    ["max_continuous", "Max continuous days", "number", "days", 15],
    ["backdated_days", "Allow back-dated up to (days)", "number", "days", 7],
    ["half_day", "Half-day leave", "bool", null, true],
    ["hourly_leave", "Hourly leave / short leave", "bool", null, false],
    ["negative_balance", "Negative balance allowed (days)", "number", "days", 0],
    ["club_with_others", "Can club with other leave types", "bool", null, true],
    ["allow_cancel_after_approval", "Employee can cancel after approval", "bool", null, true],
    ["manager_apply_on_behalf", "Manager can apply on behalf", "bool", null, true],
    ["blackout_dates", "Blackout dates", "text", null, ""],
  ]],
  ["Documents", [
    ["doc_after_days", "Medical certificate after (days)", "number", "days", 2],
    ["attachment_types", "Accepted documents", "select", ["PDF or image", "PDF only", "Any"], "PDF or image"],
  ]],
  ["Comp-off", [
    ["comp_off", "Comp-off for working on off days", "bool", null, true],
    ["comp_off_expiry_days", "Comp-off expires after", "number", "days", 60],
    ["comp_off_min_hours", "Minimum hours worked for a full comp-off", "number", "hours", 8],
  ]],
  ["Approvals & automation", [
    ["approvals", "Approval chain", "select", ["manager", "manager_then_hr", "hr_only", "auto"], "manager_then_hr"],
    ["auto_approve_after_hours", "Auto-approve if no action (hours, 0 = never)", "number", "hours", 0],
    ["notify_team", "Notify team calendar", "bool", null, true],
    ["show_team_calendar", "Show who's away when applying", "bool", null, true],
    ["max_team_away_pct", "Warn when team away exceeds (%)", "number", "%", 30],
  ]],
  ["Statutory & special", [
    ["maternity_weeks", "Maternity (weeks)", "number", "weeks", 26],
    ["paternity_days", "Paternity (days)", "number", "days", 5],
    ["bereavement_days", "Bereavement (days)", "number", "days", 3],
    ["marriage_days", "Marriage (days)", "number", "days", 3],
    ["adoption_weeks", "Adoption (weeks)", "number", "weeks", 12],
  ]],
  ["Calendar", [
    ["year_start", "Leave year starts", "select", ["january", "april"], "january"],
    ["restricted_holidays", "Restricted holidays per year", "number", "days", 2],
    ["optional_floater", "Floater holidays per year", "number", "days", 2],
  ]],
  ["Payroll", [
    ["lop_auto", "Unapproved absence becomes LOP", "bool", null, true],
    ["payroll_sync", "Sync balances & LOP to payroll", "bool", null, true],
    ["lop_cutoff_day", "LOP cut-off day of month", "number", "day", 25],
  ]],
];
export const CONTROL_COUNT = CONTROL_GROUPS.reduce((s, [, l]) => s + l.length, 0);
const DEFAULTS = Object.fromEntries(CONTROL_GROUPS.flatMap(([, l]) => l.map(([k, , , , d]) => [k, d])));

/** Days a leave request is charged under a rule-set (weekends/holidays/sandwich). */
export function chargedDays(from, to, c, holidays = []) {
  const out = [];
  const d = new Date(`${from}T12:00:00`), end = new Date(`${to}T12:00:00`);
  while (d <= end) { out.push(isoDate(d)); d.setDate(d.getDate() + 1); }
  const isWe = (x) => [0, 6].includes(new Date(`${x}T12:00:00`).getDay());
  const isHol = (x) => holidays.includes(x);
  return out.map((x, i) => {
    const inside = i > 0 && i < out.length - 1;
    const counted = !(isWe(x) || isHol(x)) || (isWe(x) && (c.weekend_count || (c.sandwich && inside))) || (isHol(x) && (c.holiday_count || (c.sandwich_holidays && inside)));
    return { day: x, we: isWe(x), hol: isHol(x), counted };
  });
}

export default function LeaveRules() {
  const { data, suiteDo, suiteCan, notifyToast } = useStore();
  const sets = data.suite?.leaveRuleSets || [];
  const [sel, setSel] = useState(sets[0]?.id);
  const cur = sets.find((s) => s.id === sel) || sets[0];
  const [draft, setDraft] = useState(null);
  const f = draft || { ...cur, controls: { ...DEFAULTS, ...(cur?.controls || {}) } };
  const can = suiteCan("leaveRules");
  const depts = [...new Set(data.employees.map((e) => e.department))];
  const assigned = new Set(sets.flatMap((s) => s.teams));
  const set = (k, v) => setDraft({ ...f, controls: { ...f.controls, [k]: v } });
  const [sim, setSim] = useState({ from: isoDate(new Date(Date.now() + 4 * 86400000)), to: isoDate(new Date(Date.now() + 10 * 86400000)) });
  const hol = (data.holidays || []).map((h) => h.date);
  const simDays = useMemo(() => (sim.from <= sim.to ? chargedDays(sim.from, sim.to, f.controls, hol) : []), [sim, f.controls]); // eslint-disable-line react-hooks/exhaustive-deps
  const avgBasic = 45000;
  const rate = { basic_div_26: avgBasic / 26, basic_div_30: avgBasic / 30, gross_div_30: (avgBasic * 2) / 30, ctc_div_365: (avgBasic * 2 * 12 * 1.1) / 365 }[f.controls.encash_basis] || 0;

  function save() {
    const r = suiteDo("leaveRules", (s) => { s.leaveRuleSets = s.leaveRuleSets.map((x) => (x.id === f.id ? { ...f } : { ...x, teams: x.teams.filter((t) => !f.teams.includes(t)) })); }, { action: "LEAVE_RULESET_SAVE", details: `${f.id} · ${f.name} · teams ${f.teams.join(", ")}` });
    if (r.ok) { setDraft(null); notifyToast(`"${f.name}" saved — applies from the next request.`); }
  }
  function add() {
    const id = `LRS-${Date.now().toString(36).toUpperCase()}`;
    suiteDo("leaveRules", (s) => { s.leaveRuleSets = [...s.leaveRuleSets, { id, name: "New rule-set", teams: [], default: false, controls: { ...DEFAULTS } }]; }, { action: "LEAVE_RULESET_ADD", details: id });
    setSel(id); setDraft(null);
  }
  const unassigned = depts.filter((d) => !assigned.has(d));
  return (
    <ModuleHub eyebrow="LEAVE · POLICIES" title="Leave rule-sets" subtitle={`Any leave policy you can write down — ${CONTROL_COUNT} controls bundled into rule-sets you assign per team. Employees apply in a tap; balances, approvals and loss-of-pay flow into payroll on their own.`}
      actions={<Button variant="outlined" startIcon={<Add />} onClick={add} disabled={!can}>New rule-set</Button>}
      brief={{ text: <><b>{sets.length}</b> rule-sets cover <b>{assigned.size}</b> of {depts.length} departments.{unassigned.length ? <> Not yet assigned: <b>{unassigned.join(", ")}</b> (they use the default set).</> : " Every department is covered."}</> }}
      kpis={[{ label: "Rule-sets", value: sets.length, icon: <Rule />, tone: "navy" }, { label: "Controls", value: CONTROL_COUNT, icon: <Tune />, tone: "glob" }, { label: "Teams covered", value: `${assigned.size}/${depts.length}`, icon: <Groups />, tone: "mint" }, { label: "Leave types", value: (data.leaveTypes || []).filter((t) => t.active).length, icon: <Science />, tone: "purple" }]}>
      <ApprovalFallback can={can} />
      <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: "wrap" }}>{sets.map((s) => <Chip key={s.id} label={`${s.name}${s.default ? " · default" : ""}`} color={s.id === cur?.id ? "primary" : "default"} onClick={() => { setSel(s.id); setDraft(null); }} />)}</Stack>
      {cur && (
        <TwoCol right={380}>
          <Stack spacing={2}>
            <SectionCard title="Rule-set" action={<Button variant="contained" onClick={save} disabled={!can || !draft}>Save rule-set</Button>}>
              <Stack spacing={1.5}>
                <TextField size="small" label="Name" value={f.name} onChange={(e) => setDraft({ ...f, name: e.target.value })} disabled={!can} />
                <TextField select size="small" label="Assigned teams" slotProps={{ select: { multiple: true } }} value={f.teams} onChange={(e) => setDraft({ ...f, teams: asList(e.target.value) })} disabled={!can}>{depts.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}</TextField>
              </Stack>
            </SectionCard>
            {CONTROL_GROUPS.map(([g, list]) => (
              <SectionCard key={g} title={g} subtitle={`${list.length} controls`}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                  {list.map(([k, label, type, opts]) => {
                    const v = f.controls[k];
                    if (type === "bool") return <FormControlLabel key={k} control={<Switch checked={!!v} onChange={(e) => set(k, e.target.checked)} disabled={!can} />} label={<Typography variant="body2">{label}</Typography>} />;
                    if (type === "select") return <TextField key={k} select size="small" label={label} value={v} onChange={(e) => set(k, e.target.value)} disabled={!can}>{opts.map((o) => <MenuItem key={o} value={o}>{String(o).replace(/_/g, " ")}</MenuItem>)}</TextField>;
                    if (type === "number") return <TextField key={k} type="number" size="small" label={`${label}`} value={v} onChange={(e) => set(k, Number(e.target.value))} disabled={!can} slotProps={{ input: { endAdornment: <Typography variant="caption" color="text.secondary">{opts}</Typography> } }} />;
                    return <TextField key={k} size="small" label={label} value={v} onChange={(e) => set(k, e.target.value)} disabled={!can} />;
                  })}
                </Box>
              </SectionCard>
            ))}
          </Stack>
          <Stack spacing={2} sx={{ position: { lg: "sticky" }, top: { lg: 80 } }}>
            <SectionCard title="Simulator" subtitle="How a request is charged under this rule-set">
              <Stack spacing={1.2}>
                <Stack direction="row" spacing={1}><TextField type="date" size="small" label="From" slotProps={{ inputLabel: { shrink: true } }} value={sim.from} onChange={(e) => setSim({ ...sim, from: e.target.value })} /><TextField type="date" size="small" label="To" slotProps={{ inputLabel: { shrink: true } }} value={sim.to} onChange={(e) => setSim({ ...sim, to: e.target.value })} /></Stack>
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>{simDays.map((d) => <Chip key={d.day} size="small" label={`${new Date(`${d.day}T12:00:00`).toLocaleDateString("en", { weekday: "short", day: "2-digit" })}${d.hol ? " · hol" : ""}`} sx={{ bgcolor: d.counted ? C.navy : "rgba(0,74,119,0.08)", color: d.counted ? "#fff" : "text.secondary" }} />)}</Stack>
                <Typography variant="body2"><b>{simDays.filter((d) => d.counted).length}</b> day(s) charged of {simDays.length} calendar days{f.controls.sandwich ? " — sandwich rule on" : ""}.</Typography>
                {simDays.filter((d) => d.counted).length > f.controls.max_continuous && <Alert severity="warning">Longer than the {f.controls.max_continuous}-day continuous limit.</Alert>}
                {Math.round((new Date(sim.from) - new Date(isoDate())) / 86400000) < f.controls.min_notice_days && <Alert severity="info">Less than {f.controls.min_notice_days} days' notice.</Alert>}
                <Divider />
                <Typography variant="body2">Encashment value per day (₹45,000 basic): <b>₹{Math.round(rate).toLocaleString("en-IN")}</b> · max {f.controls.encash_max} days = <b>₹{Math.round(rate * f.controls.encash_max).toLocaleString("en-IN")}</b></Typography>
                <Typography variant="body2">Carry forward: up to <b>{f.controls.carry_forward_cap}</b> days, expiring after {f.controls.carry_forward_expiry_months} months.</Typography>
              </Stack>
            </SectionCard>
            <SectionCard title="Leave types in this set"><Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap" }}>{(data.leaveTypes || []).filter((t) => t.active).map((t) => <Pill key={t.code}>{t.name}{t.annual ? ` · ${t.annual}` : ""}</Pill>)}</Stack><Hint>Leave types and holidays are managed in Policies & rules.</Hint></SectionCard>
          </Stack>
        </TwoCol>
      )}
    </ModuleHub>
  );
}

// v10.6 · Who approves leave (and every other request) when the reporting manager is absent or there is none.
function ApprovalFallback({ can }) {
  const { data, updateSettings, notifyToast } = useStore();
  const v = data.settings.leave_fallback || "skip_level";
  const OPTS = [["skip_level", "Next manager up the hierarchy", "Manager's manager approves; continues up to 4 levels"], ["department_head", "Department head", "The head of the employee's department approves"], ["hr", "HR directly", "Goes straight to the HR admin for the department"]];
  return (
    <Card sx={{ p: 1.8, mb: 2, borderLeft: "3px solid", borderColor: "warning.main", bgcolor: "warning.light" }}>
      <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }}>When the reporting manager is away or missing</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.2 }}>Requests never get stuck: if the manager is on approved leave, inactive or not set, approval follows your organisation's hierarchy.</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0,1fr))" }, gap: 1 }}>
        {OPTS.map(([k, l, h]) => (
          <Card key={k} onClick={() => { if (!can) return; updateSettings({ leave_fallback: k }); notifyToast(`Approvals now go to: ${l}.`); }} sx={{ p: 1.2, cursor: can ? "pointer" : "default", outline: v === k ? "2px solid #D99A00" : "none", background: v === k ? "#FFF8DB" : "#fff" }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800 }}>{v === k ? "● " : "○ "}{l}</Typography>
            <Typography sx={{ fontSize: "0.62rem", color: "#6b777c" }}>{h}</Typography>
          </Card>
        ))}
      </Box>
    </Card>
  );
}
