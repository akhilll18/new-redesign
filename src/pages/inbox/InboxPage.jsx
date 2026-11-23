// Inbox (Keka) / Authorizations (PeopleHR): approvals waiting on a manager, plus the employee's own requests.
import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, Typography } from "@mui/material";
import { useStore } from "../../store/AppStore.jsx";
import { designTokens } from "../../theme/muiTheme.js";
import { PageHeader, SectionCard, Mono, TableWrap, EmptyState, Tag, StatusChip } from "../../components/kit/UI.jsx";
import { RequestDrawer, RequestStatus } from "../../components/kit/Requests.jsx";
import ApprovalsPage from "../requests/ApprovalsPage.jsx";
import { REQUEST_TYPES, requestSummary } from "../../lib/requests.js";
import { fmtNum, timeAgo } from "../../lib/utils.js";

const { color } = designTokens;

export default function InboxPage({ embedded = false }) {
  const { data, user, reportsOf, pendingForManager, nameOf, ruleBy } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isManager = reportsOf(user.employee_code).length > 0;
  const [view, setView] = useState(isManager ? "approvals" : "mine");
  const p = pendingForManager(user.employee_code);
  const myReqs = data.requests.filter((r) => r.employee_code === user.employee_code);
  const myPts = [];
  const rows = [
    ...myReqs.map((r) => ({ kind: "req", id: r.request_id, type: r.type, ...requestSummary(r, { leaveTypes: data.leaveTypes, fmt: fmtNum }), at: r.created_at, raw: r, with: r.status === "Pending" ? r.steps.find((s) => s.status === "pending")?.approver : null })),
    ...myPts.map((s) => ({ kind: "pts", id: s.submission_id, type: "points", title: ruleBy[s.rule_id]?.sub_category, amount: `${s.points_requested} pts`, at: s.submitted_at, raw: s, with: s.stage === "manager" ? s.manager_code : s.stage === "admin" ? s.assigned_admin : null })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <>
      {!embedded && <PageHeader eyebrow="INBOX" title="Inbox" subtitle={isManager ? `${p.requests.length + p.points.length} item(s) from your team need your approval.` : "Track every request you have made and who it is waiting with."} />}
      <Box sx={{ mb: 2, borderBottom: `1px solid ${color.border}` }}>
        <Tabs value={view} onChange={(_, v) => setView(v)}>
          {isManager && <Tab value="approvals" label={`Team approvals (${p.requests.length + p.points.length})`} />}
          <Tab value="mine" label={`My requests (${rows.filter((r) => ["Pending", "Submitted", "Manager Approved", "Under Review", "On Hold", "Escalated", "Approved"].includes(r.raw.status)).length} open)`} />
        </Tabs>
      </Box>
      {view === "approvals" && isManager && <ApprovalsPage mode="manager" />}
      {view === "mine" && (
        <SectionCard noPad>
          {rows.length === 0 ? <EmptyState title="Good job!" text="You have no requests yet." /> : (
            <TableWrap>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead><TableRow><TableCell>Request</TableCell><TableCell>Summary</TableCell><TableCell align="right">Amount</TableCell><TableCell>Waiting with</TableCell><TableCell>Sent</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} hover sx={{ cursor: "pointer" }} onClick={() => (r.kind === "req" ? setParams({ req: r.id }) : navigate(`/points/claims?open=${r.id}`))}>
                      <TableCell><Stack spacing={0.3}><Tag tone="accent" sx={{ alignSelf: "flex-start" }}>{REQUEST_TYPES[r.type].label}</Tag><Mono>{r.id}</Mono></Stack></TableCell>
                      <TableCell sx={{ maxWidth: 280 }}><Typography noWrap sx={{ fontSize: 13, fontWeight: 500 }}>{r.title}</Typography><Typography noWrap sx={{ fontSize: 11, color: color.secondaryText }}>{r.detail}</Typography></TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{r.amount}</TableCell>
                      <TableCell>{r.with ? nameOf(r.with) : "—"}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}><Typography sx={{ fontSize: 11, color: color.secondaryText }}>{timeAgo(r.at)}</Typography></TableCell>
                      <TableCell>{r.kind === "req" ? <RequestStatus r={r.raw} /> : <StatusChip status={r.raw.status} />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </SectionCard>
      )}
      {view === "mine" && <RequestDrawer id={params.get("req")} onClose={() => setParams({})} />}
    </>
  );
}
