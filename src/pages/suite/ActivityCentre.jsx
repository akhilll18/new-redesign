// v10.3 — All activities (/activity): HR and the Super Admin see everything that happens in the workspace, across every
// module — including Finance's payroll, payslip and expense actions — as one filterable timeline with an AI digest.
// Read-only. Sources: the audit trail (every sign-in, submission, decision and configuration change), requests,
// punches, payslip runs and AI automation runs.
import React, { useMemo, useState } from "react";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputAdornment, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TablePagination, TextField, Typography } from "@mui/material";
import { SearchRounded, DownloadRounded, TodayRounded, BoltRounded, PaymentsRounded, PeopleAltRounded } from "@mui/icons-material";
import { useStore, ROLE_LABEL } from "../../store/AppStore.jsx";
import { ModuleHub, useWho } from "../../components/suite/Hub.jsx";
import { SectionCard, Tag, TableWrap, Mono } from "../../components/kit/UI.jsx";
import { AiInsight } from "../../components/ai/AiInsight.jsx";
import { fmtDateTime, downloadCsv, isoDate } from "../../lib/utils.js";
import { REQUEST_TYPES } from "../../lib/requests.js";

export const ACTIVITY_CATEGORIES = [
  ["security", "Sign-in & security", /LOGIN|LOGOUT|MFA|PIN|PASSWORD|LOCK|SESSION|RESET|DEVICE/],
  ["pay", "Payroll, payslips & finance", /PAY|SLIP|SALARY|EXPENSE|ADVANCE|LOAN|PAYOUT|BANK|FILING|TDS|TAX|CARD|INVOICE|STATUTORY|FX|JOURNAL|F&F|SETTLE/],
  ["time", "Attendance, leave & time", /PUNCH|ATTEND|LEAVE|SHIFT|TIMESHEET|REGULAR|HOLIDAY|GEOFENCE|LOCATION_PING|SCREEN/],
  ["people", "People & org", /EMPLOYEE|ACCOUNT|COMPANY|LOCATION|ORG|PROFILE|EXIT|TRANSFER|ADMIN/],
  ["hire", "Hiring, BGV & onboarding", /CANDIDATE|OFFER|BGV|ONBOARD|INTERVIEW|REQ|JOB|ATS/],
  ["talent", "Performance & learning", /GOAL|REVIEW|FEEDBACK|PERF|COURSE|LEARN|SUCCESSION|RECOGN|KUDOS/],
  ["compliance", "Compliance & audit", /COMPLIANCE|AUDIT|POLICY|PRIVACY|CONSENT|DSAR/],
  ["ai", "AI automation", /AI_|AUTOMATION|AGENT/],
  ["config", "Settings & configuration", /CONFIG|SETTING|RULE|CATEGORY|MASTER|DESIGN|COMPONENT/],
];
export const categoryOf = (action) => ACTIVITY_CATEGORIES.find(([, , re]) => re.test(action || ""))?.[0] || "other";
const CAT_LABEL = Object.fromEntries([...ACTIVITY_CATEGORIES.map(([k, l]) => [k, l]), ["other", "Other"]]);
// v10.5: readable rows — "LEAVE_APPROVE" → "Leave approve", employee / admin codes in details shown with names.
const SPECIAL = { MFA: "MFA", OTP: "OTP", PIN: "PIN", AI: "AI", BGV: "BGV", IT: "IT", TDS: "TDS", FX: "FX", ATS: "ATS", DSAR: "DSAR", IJP: "IJP", "F&F": "F&F", HR: "HR", CSV: "CSV" };
export function humanAction(a) {
  const words = String(a || "").split(/[_\s]+/).filter(Boolean);
  return words.map((w, i) => SPECIAL[w.toUpperCase()] || (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join(" ");
}
function humanDetails(text, nameOf) {
  return String(text || "")
    .replace(/\b(EMP\d{3,}|ADM\d{2,}|SA\d{3,})\b/g, (c) => { const n = nameOf(c); return n && n !== c ? `${n} (${c})` : c; })
    .replace(/\b(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2}(\.\d+)?Z?)?/g, "$1 $2")
    .replace(/[{}"]/g, "")
    .replace(/\s*·\s*/g, " · ");
}
const TONE = { security: "warn", pay: "info", time: "good", people: "accent", hire: "accent", talent: "good", compliance: "warn", ai: "info", config: "neutral", other: "neutral" };

export default function ActivityCentre() {
  const { data, nameOf } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [role, setRole] = useState("");
  const [from, setFrom] = useState(isoDate(Date.now() - 30 * 86400000));
  const [to, setTo] = useState(isoDate());
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);
  const [who, setWho] = useState("");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const tableRef = React.useRef(null);
  const jump = () => setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

  // Audit trail + requests + punches, one shape: { at, who, role, cat, action, details, ref }.
  const feed = useMemo(() => {
    const out = (data.audit || []).map((a) => ({ at: a.timestamp, who: a.user_code, role: a.role, cat: categoryOf(a.action), action: a.action, details: a.details, ref: a.log_id }));
    const seen = new Set(out.map((x) => x.details));
    (data.requests || []).forEach((r) => {
      const label = REQUEST_TYPES[r.type]?.label || r.type;
      if (!seen.has(r.request_id)) out.push({ at: r.created_at, who: r.employee_code, role: "emp", cat: ["leave", "regularize", "screenoff"].includes(r.type) ? "time" : ["expense", "advance", "loan"].includes(r.type) ? "pay" : "people", action: `${label.toUpperCase()}_SUBMITTED`, details: `${r.request_id} · ${r.status}`, ref: r.request_id });
    });
    (data.punches || []).slice(-400).forEach((p) => out.push({ at: p.ts, who: p.employee_code, role: "emp", cat: "time", action: p.type === "in" ? "PUNCH_IN" : "PUNCH_OUT", details: `${p.source || "web"}${p.inside === false ? " · outside geofence" : ""}`, ref: p.id || "" }));
    (data.automation?.log || []).forEach((l) => out.push({ at: l.at, who: "AI", role: "system", cat: "ai", action: `AI_${l.rule}`, details: l.text, ref: l.id }));
    return out.filter((x) => x.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }, [data.audit, data.requests, data.punches, data.automation]);

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return feed.filter((x) => {
      const d = String(x.at).slice(0, 10);
      return (!who || x.who === who) && (!cat || x.cat === cat) && (!role || x.role === role) && (!from || d >= from) && (!to || d <= to) && (!qq || [x.who, nameOf(x.who), x.action, x.details, x.ref].join(" ").toLowerCase().includes(qq));
    });
  }, [feed, q, cat, role, from, to, nameOf, who]);

  const today = isoDate();
  const todayN = feed.filter((x) => String(x.at).startsWith(today)).length;
  const byCat = Object.fromEntries(Object.keys(CAT_LABEL).map((k) => [k, list.filter((x) => x.cat === k).length]));
  const peopleCounts = Object.entries(list.reduce((m, x) => ({ ...m, [x.who]: (m[x.who] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const people = peopleCounts.length;
  const facts = [
    `${list.length} activities between ${from} and ${to} by ${people} people`,
    ...Object.entries(byCat).filter(([, n]) => n).map(([k, n]) => `${CAT_LABEL[k]}: ${n}`),
    `Failed sign-ins: ${list.filter((x) => /FAILED|LOCKED/.test(x.action)).length}`,
    `Overrides / escalations: ${list.filter((x) => /OVERRIDE|ESCALATE/.test(x.action)).length}`,
    ...list.slice(0, 12).map((x) => `${String(x.at).slice(0, 16)} ${nameOf(x.who) || x.who}: ${x.action} ${x.details || ""}`),
  ];

  return (
    <ModuleHub
      eyebrow=""
      title="All activities"
      subtitle="Everything that happens in the workspace across every module — people, time, pay & finance, hiring, compliance, settings and AI automations — in one timeline. Read-only; exports for audits."
      actions={<Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv(`all-activities-${from}-to-${to}.csv`, ["Time", "Code", "Person", "Role", "Category", "Action", "Details", "Ref"], list.map((x) => [x.at, x.who, nameOf(x.who), x.role, CAT_LABEL[x.cat], x.action, x.details, x.ref]))}>Export {list.length}</Button>}
      kpis={[
        { label: "Today", value: todayN, hint: "Show today's activity", icon: <TodayRounded />, onClick: () => { setFrom(today); setTo(today); setCat(""); setWho(""); setPage(0); jump(); } },
        { label: "In range", value: list.length, hint: `${from} → ${to}`, icon: <BoltRounded />, tone: "mint", onClick: () => { setCat(""); setWho(""); setQ(""); setPage(0); jump(); } },
        { label: "Pay & finance", value: byCat.pay || 0, hint: "Payroll, payslips, expenses", icon: <PaymentsRounded />, tone: "glob", onClick: () => { setCat("pay"); setPage(0); jump(); } },
        { label: "People involved", value: people, hint: "See who did what", icon: <PeopleAltRounded />, tone: "purple", onClick: () => setPeopleOpen(true) },
      ]}
    >
      <AiInsight title="AI digest of all activity" facts={facts} audience="HR leadership who oversee every module; point out anything unusual (security, overrides, payroll changes) first" sx={{ mb: 2 }} />
      <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: "wrap", mb: 1.5 }}>
        <Chip label={`All (${feed.length})`} color={!cat ? "primary" : "default"} onClick={() => setCat("")} size="small" />
        {Object.entries(CAT_LABEL).filter(([k]) => feed.some((x) => x.cat === k)).map(([k, l]) => <Chip key={k} label={l} color={cat === k ? "primary" : "default"} onClick={() => { setCat(k); setPage(0); }} size="small" />)}
      </Stack>
      {(who || cat) && (
        <Stack direction="row" spacing={1} sx={{ mb: 1.2, alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>Showing:</Typography>
          {cat && <Chip size="small" label={CAT_LABEL[cat]} onDelete={() => setCat("")} />}
          {who && <Chip size="small" label={who === "AI" ? "AI automation" : `${nameOf(who) || who} (${who})`} onDelete={() => setWho("")} />}
        </Stack>
      )}
      <Dialog open={peopleOpen} onClose={() => setPeopleOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>People involved · {from} → {to}</DialogTitle>
        <DialogContent sx={{ px: 0 }}>
          {peopleCounts.map(([c, n]) => (
            <Stack key={c} direction="row" role="button" onClick={() => { setWho(c); setPage(0); setPeopleOpen(false); jump(); }} sx={{ px: 3, py: 1, borderTop: "1px solid #f0f2ef", cursor: "pointer", alignItems: "center", "&:hover": { background: "#fbfdfb" } }}>
              <Box sx={{ flex: 1 }}><Typography sx={{ fontSize: "0.72rem", fontWeight: 600 }}>{c === "AI" ? "AI automation" : nameOf(c) || c}</Typography><Typography sx={{ fontSize: "0.58rem", color: "text.secondary" }}>{c}</Typography></Box>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{n} activit{n === 1 ? "y" : "ies"}</Typography>
            </Stack>
          ))}
        </DialogContent>
        <DialogActions><Button onClick={() => setPeopleOpen(false)}>Close</Button></DialogActions>
      </Dialog>
      <SectionCard noPad>
        <Box ref={tableRef} sx={{ scrollMarginTop: 80 }} />
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} useFlexGap sx={{ flexWrap: "wrap", p: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <TextField size="small" placeholder="Search person, action, details…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} sx={{ maxWidth: 300 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 16 }} /></InputAdornment> } }} />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Role</InputLabel>
            <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
              <MenuItem value="">All roles</MenuItem>
              {["emp", "admin", "superadmin", "system"].map((r) => <MenuItem key={r} value={r}>{ROLE_LABEL[r]}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} sx={{ width: 160 }} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} sx={{ width: 160 }} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead><TableRow><TableCell>When</TableCell><TableCell>Who</TableCell><TableCell>Category</TableCell><TableCell>Action</TableCell><TableCell>Details</TableCell></TableRow></TableHead>
            <TableBody>
              {list.slice(page * rpp, page * rpp + rpp).map((x, i) => (
                <TableRow key={`${x.ref}-${i}`} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDateTime(x.at)}</TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.66rem", fontWeight: 600 }}>{x.who === "AI" ? "AI automation" : nameOf(x.who) || x.who}</Typography><Mono>{x.who}</Mono> <Typography component="span" sx={{ fontSize: "0.56rem", color: "text.secondary" }}>{ROLE_LABEL[x.role] || x.role}</Typography></TableCell>
                  <TableCell><Tag tone={TONE[x.cat]}>{CAT_LABEL[x.cat]}</Tag></TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.66rem", fontWeight: 600 }}>{humanAction(x.action)}</Typography></TableCell>
                  <TableCell sx={{ maxWidth: 380 }}><Typography sx={{ fontSize: "0.62rem", wordBreak: "break-word" }}>{humanDetails(x.details, nameOf)}</Typography></TableCell>
                </TableRow>
              ))}
              {!list.length && <TableRow><TableCell colSpan={5}><Box sx={{ p: 2, textAlign: "center", fontSize: "0.7rem", color: "text.secondary" }}>No activity matches these filters.</Box></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableWrap>
        <TablePagination component="div" count={list.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rpp} onRowsPerPageChange={(e) => { setRpp(+e.target.value); setPage(0); }} rowsPerPageOptions={[25, 50, 100]} />
      </SectionCard>
    </ModuleHub>
  );
}
