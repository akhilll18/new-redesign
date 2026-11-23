import { TodayMeetingsDialog, useMeetingsBox } from "../../components/collab/TodayMeetings.jsx";
import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, ListItemButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { GroupsRounded, StarsRounded, PendingActionsRounded, NorthEastRounded, LockRounded, FlagRounded, CancelRounded, BadgeRounded, CheckCircleRounded, WarningRounded, SyncRounded } from "@mui/icons-material";
import { useStore, ROLE_LABEL } from "../../store/AppStore.jsx";
import { PageHeader, StatCard, Grid, SectionCard, BarChart, Mono, TableWrap, Tag } from "../../components/kit/UI.jsx";
import { fmtNum, timeAgo, lastMonths, monthKey, monthLabel, DAY, fmtDateTime } from "../../lib/utils.js";
import { OPEN_STATUSES } from "../../lib/validation.js";
import { APP_CONFIG } from "../../data/seed.js";

function storageUsed() {
  try {
    return (localStorage.getItem(APP_CONFIG.storageKey) || "").length * 2;
  } catch {
    return 0;
  }
}

export default function SuperDashboard() {
  const { data, nameOf, hrSync, notifyToast } = useStore();
  const navigate = useNavigate();
  const mtg = useMeetingsBox();
  const [mtgOpen, setMtgOpen] = React.useState(false);
  // Requests (leave, expenses, advances, loans, corrections, assets) replace the removed Sahayog points figures.
  const subs = data.requests.map((r) => ({ ...r, submitted_at: r.created_at, assigned_admin: r.steps?.find((st) => st.status === "pending")?.approver }));
  const open = subs.filter((s) => s.status === "Pending");
  const escalated = open.filter((s) => !s.assigned_admin);
  const locked = [...data.employees, ...data.admins].filter((u) => u.status === "locked");
  const day = Date.now() - DAY;
  const failed24 = data.audit.filter((a) => ["LOGIN_FAILED", "MFA_FAILED", "PIN_FAILED"].includes(a.action) && new Date(a.timestamp) > day).length;
  const events24 = data.audit.filter((a) => new Date(a.timestamp) > day).length;
  const lastSync = data.audit.find((a) => a.action === "HR_SYNC");
  const sla = data.settings.approval_sla_days;
  const months = lastMonths(6).map((k) => ({
    label: monthLabel(k),
    issued: data.requests.filter((r) => monthKey(r.created_at) === k).length,
    redeemed: data.requests.filter((r) => r.status === "Approved" && monthKey(r.created_at) === k).length,
  }));
  const workload = data.admins.map((a) => {
    const mine = open.filter((s) => s.assigned_admin === a.admin_code);
    return { a, open: mine.length, late: mine.filter((s) => (Date.now() - new Date(s.submitted_at)) / DAY > sla).length };
  });
  const usedKb = Math.round(storageUsed() / 1024);
  const health = [
    { label: "Claims API", ok: true, text: "Operational (browser store)" },
    { label: "Open requests (leave, expense, advance, loan)", ok: data.requests.filter((r) => r.status === "Pending").length < 20, text: `${data.requests.filter((r) => r.status === "Pending").length} pending` },
    { label: "HR master sync", ok: lastSync && Date.now() - new Date(lastSync.timestamp) < 3 * DAY, text: lastSync ? `Last run ${timeAgo(lastSync.timestamp)}` : "Never run" },
    { label: "Failed sign-ins (24 h)", ok: failed24 < 5, text: `${failed24} failed attempt(s)` },
    { label: "Locked accounts", ok: locked.length === 0, text: `${locked.length} locked` },
    { label: "Admin MFA coverage", ok: data.admins.filter((a) => a.status === "active").every((a) => a.mfa_status === "enabled"), text: `${data.admins.filter((a) => a.mfa_status === "enabled").length} of ${data.admins.length} enrolled` },
    { label: "Storage", ok: usedKb < 4000, text: `${fmtNum(usedKb)} KB of ~5 MB used` },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Global"
        title="System overview"
        subtitle={`${events24} audit events in the last 24 hours.`}
        actions={
          <Button
            variant="outlined"
            startIcon={<SyncRounded />}
            onClick={() => {
              const r = hrSync();
              notifyToast(r.added ? `HR sync added ${r.added} new employee(s) as pending approval.` : "HR sync complete. No new employees.");
            }}
          >
            Sync with HR
          </Button>
        }
      />
      <Stack spacing={2.5}>
        <Grid min={210}>
          <StatCard label="Employees" value={data.employees.filter((e) => e.status === "active").length} hint={`${data.employees.length} total · ${data.employees.filter((e) => e.status === "pending_approval").length} pending`} icon={<GroupsRounded />} onClick={() => navigate("/users")} />
          <StatCard label="Admins" value={data.admins.filter((a) => a.status === "active").length} hint={`${data.admins.length} total`} icon={<BadgeRounded />} tone="info" onClick={() => navigate("/users?tab=admins")} />
          <StatCard label="Approvals pending" value={open.length} hint="Leave, expenses, advances, loans, corrections, assets" icon={<PendingActionsRounded />} tone="info" onClick={() => navigate("/requests?tab=all")} />
          <StatCard label="Needs you" value={escalated.length} hint="No available approver" icon={<NorthEastRounded />} tone="warn" onClick={() => navigate("/requests")} />
          <StatCard label="Rejected" value={subs.filter((s) => s.status === "Rejected").length} icon={<CancelRounded />} tone="bad" />
          <StatCard label="Live contracts" value={(data.contracts || []).filter((c) => c.status === "active").length} hint="Contingent workers" icon={<FlagRounded />} tone="good" onClick={() => navigate("/contracts")} />
          <StatCard label="Locked accounts" value={locked.length} icon={<LockRounded />} tone={locked.length ? "bad" : "good"} onClick={() => navigate("/users")} />
          <StatCard label="Meetings today" value={mtg.count} hint={mtg.note} icon={<GroupsRounded />} tone="info" onClick={() => setMtgOpen(true)} />
        </Grid>
        <TodayMeetingsDialog open={mtgOpen} onClose={() => setMtgOpen(false)} />

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 2.5 }}>
          <SectionCard title="Requests raised and approved" subtitle="Last 6 months">
            <BarChart
              data={months}
              series={[
                { key: "issued", label: "Raised", color: "primary.main" },
                { key: "redeemed", label: "Approved", color: "secondary.main" },
              ]}
              format={fmtNum}
            />
          </SectionCard>
          <SectionCard title="System health">
            <Stack spacing={1.3}>
              {health.map((h) => (
                <Stack key={h.label} direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
                  {h.ok ? <CheckCircleRounded color="success" fontSize="small" /> : <WarningRounded color="warning" fontSize="small" />}
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {h.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: "right" }}>
                    {h.text}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </SectionCard>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 3fr" }, gap: 2.5 }}>
          <SectionCard title="Admin workload" subtitle={`SLA ${sla} days`} noPad>
            <TableWrap>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Admin</TableCell>
                    <TableCell align="right">Open</TableCell>
                    <TableCell align="right">Over SLA</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workload.map(({ a, open: o, late }) => (
                    <TableRow key={a.admin_code}>
                      <TableCell>
                        {a.full_name} <Mono sx={{ color: "text.secondary" }}>{a.admin_code}</Mono>
                      </TableCell>
                      <TableCell align="right">{o}</TableCell>
                      <TableCell align="right">{late ? <Tag tone="bad">{late}</Tag> : 0}</TableCell>
                      <TableCell>{a.status === "active" ? "Active" : <Tag tone="warn">{a.status}</Tag>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          </SectionCard>
          <SectionCard
            title="Recent activity"
            action={
              <Button size="small" onClick={() => navigate("/audit")}>
                Audit log
              </Button>
            }
            noPad
          >
            {data.audit.slice(0, 7).map((a) => (
              <ListItemButton key={a.log_id} divider onClick={() => navigate("/audit")} sx={{ gap: 1.5, py: 1 }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" noWrap>
                    <Mono sx={{ fontWeight: 600 }}>{a.action}</Mono> · {nameOf(a.user_code)} <Typography component="span" variant="caption" color="text.secondary">({ROLE_LABEL[a.role] || a.role})</Typography>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {a.details}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }} title={fmtDateTime(a.timestamp)}>
                  {timeAgo(a.timestamp)}
                </Typography>
              </ListItemButton>
            ))}
          </SectionCard>
        </Box>
      </Stack>
    </>
  );
}
