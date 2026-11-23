import { TodayMeetingsDialog, useMeetingsBox } from "../../components/collab/TodayMeetings.jsx";
import { GroupsRounded } from "@mui/icons-material";
import HrDashboardWidgets from "../../components/dashboard/HrDashboardWidgets.jsx";
import { adminKind } from "../../lib/statutory.js";
import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, ListItemButton, Stack, Typography } from "@mui/material";
import { PendingActionsRounded, TimerOffRounded, PaymentsRounded, PersonAddAlt1Rounded, BeachAccessRounded, ReceiptLongRounded, ArrowForwardRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, StatCard, Grid, SectionCard, HBar, EmptyState, PersonCell, Tag } from "../../components/kit/UI.jsx";
import { REQUEST_TYPES, requestSummary, expenseTotal } from "../../lib/requests.js";
import { fmtNum, timeAgo, DAY, isoDate, monthKey } from "../../lib/utils.js";
import { designTokens } from "../../theme/muiTheme.js";

const { color } = designTokens;

export default function AdminDashboard() {
  const { data, user, empBy, ruleBy, pendingForAdmin, scopeUnits, nameOf } = useStore();
  const navigate = useNavigate();
  const mtg = useMeetingsBox();
  const [mtgOpen, setMtgOpen] = React.useState(false);
  const p = pendingForAdmin(user);
  const scope = scopeUnits(user);
  const sla = data.settings.approval_sla_days;
  const waiting = [
    ...p.requests.map((r) => ({ id: r.request_id, type: r.type, emp: r.employee_code, at: r.created_at, ...requestSummary(r, { leaveTypes: data.leaveTypes, fmt: fmtNum }), link: `/approvals?req=${r.request_id}` })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
  const overdue = waiting.filter((w) => (Date.now() - new Date(w.at)) / DAY > sla);
  const today = isoDate();
  const inScope = (c) => scope.has(empBy[c]?.department);
  const onLeave = data.requests.filter((r) => r.type === "leave" && r.status === "Approved" && r.from_date <= today && r.to_date >= today && inScope(r.employee_code));
  const mk = monthKey(new Date());
  const claimedMonth = data.requests.filter((r) => r.type === "expense" && inScope(r.employee_code) && monthKey(r.created_at) === mk && r.status !== "Cancelled").reduce((s, r) => s + expenseTotal(r.items), 0);
  const byType = Object.keys(REQUEST_TYPES).map((t) => ({ t, n: waiting.filter((w) => w.type === t).length })).filter((x) => user.modules.includes(REQUEST_TYPES[x.t].module));
  const maxType = Math.max(1, ...byType.map((x) => x.n));
  const recent = data.audit.filter((a) => a.user_code === user.admin_code && /APPROVE|REJECT|PAID|DISBURSED|ACCOUNT_/.test(a.action)).slice(0, 6);

  return (
    <>
      <PageHeader eyebrow={["hr", "hr_finance"].includes(adminKind(user)) ? "HR ADMIN · DASHBOARD" : adminKind(user) === "finance" ? "FINANCE ADMIN · DASHBOARD" : "ADMIN · DASHBOARD"} title={`Hello, ${user.full_name.split(" ")[0]}`} subtitle={`Final approver for ${[...scope].length} org unit(s). Managers approve first; you decide after them.`} actions={<Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={() => navigate("/approvals")}>All approvals</Button>} />
      <Stack spacing={2.5}>
        <Grid min={170}>
          <StatCard label="Approvals pending" hint="Open All approvals" value={waiting.length} icon={<PendingActionsRounded />} tone="info" onClick={() => navigate("/approvals")} />
          <StatCard label="Over SLA" value={overdue.length} icon={<TimerOffRounded />} tone={overdue.length ? "bad" : "good"} hint={`Older than ${sla} days`} />
          {user.modules.some((m) => ["expense", "advance", "loan"].includes(m)) && <StatCard label="To pay / disburse" value={p.payouts.length} icon={<PaymentsRounded />} tone="warn" hint={`₹${fmtNum(p.payouts.reduce((s, r) => s + (r.approved_amount ?? (r.type === "expense" ? expenseTotal(r.items) : r.request_amount ?? r.amount)), 0))}`} onClick={() => navigate("/approvals?tab=payouts")} />}
          {user.modules.includes("accounts") && <StatCard label="New accounts" value={p.accounts.length} icon={<PersonAddAlt1Rounded />} tone="accent" onClick={() => navigate("/approvals?tab=accounts")} />}
          <StatCard label="Expenses claimed this month" value={`₹${fmtNum(claimedMonth)}`} icon={<ReceiptLongRounded />} tone="warn" />
          <StatCard label="Meetings today" value={mtg.count} hint={mtg.note} icon={<GroupsRounded />} tone="info" onClick={() => setMtgOpen(true)} />
        </Grid>
        <TodayMeetingsDialog open={mtgOpen} onClose={() => setMtgOpen(false)} />
        {["hr", "hr_finance"].includes(adminKind(user)) && <HrDashboardWidgets />}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 2.5 }}>
          <SectionCard title="Oldest waiting" subtitle="Already approved by the manager" noPad>
            {waiting.length === 0 ? <EmptyState title="Nothing waiting" text="Your queue is clear." /> : waiting.slice(0, 7).map((w) => (
              <ListItemButton key={w.id} divider onClick={() => navigate(w.link)} sx={{ gap: 1.5 }}>
                <Tag tone="accent">{REQUEST_TYPES[w.type].label}</Tag>
                <Box sx={{ flex: 1, minWidth: 0 }}><PersonCell name={empBy[w.emp]?.full_name} sub={`${w.id} · ${w.title}`} /></Box>
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" }}>{w.amount}</Typography>
                <Typography sx={{ fontSize: 11, color: color.secondaryText, whiteSpace: "nowrap", display: { xs: "none", sm: "block" } }}>{timeAgo(w.at)}</Typography>
              </ListItemButton>
            ))}
          </SectionCard>
          <Stack spacing={2.5}>
            <SectionCard title="Waiting by type">
              <Stack spacing={1.4}>{byType.map((x) => <HBar key={x.t} label={REQUEST_TYPES[x.t].label} value={x.n} max={maxType} />)}</Stack>
            </SectionCard>
          </Stack>
        </Box>
        {/* v10.6: "My recent decisions" removed from the dashboard (the full trail is in Inbox → Approved / all). */}
        <Typography sx={{ fontSize: 11, color: color.mutedText }}>Signed in as {nameOf(user.admin_code)} · {user.login_id}</Typography>
      </Stack>
    </>
  );
}
