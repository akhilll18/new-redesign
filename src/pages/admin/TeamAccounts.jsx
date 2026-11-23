import React, { useState } from "react";
import { Alert, Box, Button, InputAdornment, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { SearchRounded, HowToRegRounded, PersonOffRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatusChip, PersonCell, Mono, TableWrap, EmptyState, ConfirmDialog, KeyVal } from "../../components/kit/UI.jsx";
import { fmtDate, fmtDateTime, fmtNum } from "../../lib/utils.js";
import { OPEN_STATUSES } from "../../lib/validation.js";

export default function TeamAccounts({ embedded }) {
  const { data, user, orgBy, nameOf, scopeUnits, balanceOf, decideAccount, notifyToast } = useStore();
  const scope = scopeUnits(user);
  const team = data.employees.filter((e) => scope.has(e.department));
  const pending = team.filter((e) => e.status === "pending_approval");
  const [tab, setTab] = useState(embedded || pending.length ? "accounts" : "team");
  const [q, setQ] = useState("");
  const [act, setAct] = useState(null);
  const [note, setNote] = useState("");
  const list = team.filter((e) => !q || [e.full_name, e.employee_code, e.designation].join(" ").toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      {!embedded && <PageHeader title="Team & accounts" subtitle="Approve new employee logins from the HR sync and see your team's open requests." />}
      <SectionCard noPad sx={embedded ? { border: 0, boxShadow: "none" } : undefined}>
        <Box sx={{ px: 1.5, pt: 1, borderBottom: 1, borderColor: "divider", display: embedded ? "none" : "block" }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab value="accounts" label={`Account approvals (${pending.length})`} sx={{ minHeight: 44, fontSize: 13 }} />
            <Tab value="team" label={`Team members (${team.length})`} sx={{ minHeight: 44, fontSize: 13 }} />
          </Tabs>
        </Box>

        {tab === "accounts" &&
          (pending.length === 0 ? (
            <EmptyState icon={<HowToRegRounded />} title="No accounts waiting" text="New joiners from the HR sync appear here before they can sign in." />
          ) : (
            <Stack spacing={0}>
              <Alert severity="info" sx={{ m: 2 }}>
                Check that each record matches the HR master before you activate it. Activated employees sign in with a temporary password and must set their own on first login.
              </Alert>
              {pending.map((e) => (
                <Stack key={e.employee_code} direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" }, px: 2, py: 1.8, borderTop: 1, borderColor: "divider" }}>
                  <Box sx={{ minWidth: 220 }}>
                    <PersonCell name={e.full_name} sub={`${e.employee_code} · ${e.login_id}`} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <KeyVal
                      cols={4}
                      items={[
                        ["Department", orgBy[e.department]?.name],
                        ["Designation", e.designation],
                        ["Manager", e.reporting_manager ? nameOf(e.reporting_manager) : "—"],
                        ["Joined", fmtDate(e.date_of_joining)],
                      ]}
                    />
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button color="error" startIcon={<PersonOffRounded />} onClick={() => setAct({ e, approve: false })}>
                      Decline
                    </Button>
                    <Button variant="contained" startIcon={<HowToRegRounded />} onClick={() => setAct({ e, approve: true })}>
                      Activate
                    </Button>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          ))}

        {tab === "team" && (
          <>
            <Box sx={{ p: 1.5 }}>
              <TextField placeholder="Search name, code, designation" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: 360 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
            </Box>
            <TableWrap>
              <Table size="small" sx={{ minWidth: 880 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Worker type</TableCell>
                    <TableCell align="right">Open requests</TableCell>
                    <TableCell>Last sign-in</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.map((e) => {
                    return (
                      <TableRow key={e.employee_code}>
                        <TableCell>
                          <PersonCell name={e.full_name} sub={`${e.employee_code} · ${e.designation}`} src={e.profile_photo} />
                        </TableCell>
                        <TableCell>{orgBy[e.department]?.name}</TableCell>
                        <TableCell>
                          <StatusChip status={e.status} />
                        </TableCell>
                        <TableCell>{e.worker_type || "permanent"}</TableCell>
                        <TableCell align="right">{data.requests.filter((r) => r.employee_code === e.employee_code && r.status === "Pending").length}</TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {fmtDateTime(e.last_login)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrap>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", p: 1.5 }}>
              Locked or suspended accounts are handled by a Super Admin. <Mono>{user.admin_code}</Mono> can activate new joiners only.
            </Typography>
          </>
        )}
      </SectionCard>

      <ConfirmDialog
        open={!!act}
        title={act?.approve ? `Activate ${act?.e.full_name}?` : `Decline ${act?.e.full_name}?`}
        text={act?.approve ? "They can sign in straight away and will be asked to set a new password." : "They will not be able to sign in. HR is told to check the record."}
        confirmLabel={act?.approve ? "Activate" : "Decline"}
        tone={act?.approve ? "primary" : "error"}
        onClose={() => setAct(null)}
        onConfirm={() => {
          const r = decideAccount(act.e.employee_code, act.approve, note.trim());
          notifyToast(r.ok ? `${act.e.full_name} ${act.approve ? "activated" : "declined"}.` : r.error, r.ok ? "success" : "error");
          setAct(null);
          setNote("");
        }}
      >
        <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </ConfirmDialog>
    </>
  );
}
