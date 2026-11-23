import React, { useMemo, useState } from "react";
import { Button, FormControl, InputAdornment, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TablePagination, TextField, Typography } from "@mui/material";
import { DownloadRounded, SearchRounded } from "@mui/icons-material";
import { useStore, ROLE_LABEL } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, Mono, TableWrap, Tag } from "../../components/kit/UI.jsx";
import { fmtDateTime, downloadCsv, isoDate } from "../../lib/utils.js";

const TONE = { LOGIN_FAILED: "bad", ACCOUNT_LOCKED: "bad", MFA_FAILED: "bad", PIN_FAILED: "bad", LOGIN_BLOCKED: "warn", REJECT: "bad", BULK_REJECT: "bad", APPROVE: "good", BULK_APPROVE: "good", LOGIN_SUCCESS: "good", OVERRIDE: "warn", ESCALATE: "warn", FLAG: "bad", CONFIG_CHANGE: "info", SESSION_TIMEOUT: "neutral" };

export default function AuditLog() {
  const { data, nameOf } = useStore();
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [role, setRole] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);
  const actions = [...new Set(data.audit.map((a) => a.action))].sort();
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return data.audit.filter((a) => {
      const d = isoDate(a.timestamp);
      return (!action || a.action === action) && (!role || a.role === role) && (!from || d >= from) && (!to || d <= to) && (!qq || [a.log_id, a.user_code, nameOf(a.user_code), a.details, a.ip, a.device].join(" ").toLowerCase().includes(qq));
    });
  }, [data.audit, q, action, role, from, to, nameOf]);

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every sign-in, submission, decision and configuration change. Entries cannot be edited or deleted."
        actions={
          <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv("audit-log.csv", ["Log ID", "Timestamp", "User code", "User", "Role", "Action", "IP", "Device", "Fingerprint", "Details"], list.map((a) => [a.log_id, a.timestamp, a.user_code, nameOf(a.user_code), a.role, a.action, a.ip, a.device, a.fingerprint || "", a.details]))}>
            Export {list.length}
          </Button>
        }
      />
      <SectionCard noPad>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ flexWrap: "wrap", p: 1.5, borderBottom: 1, borderColor: "divider" }} useFlexGap>
          <TextField placeholder="Search user, details, IP" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} sx={{ maxWidth: { md: 280 } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Action</InputLabel>
            <Select label="Action" value={action} onChange={(e) => (setAction(e.target.value), setPage(0))}>
              <MenuItem value="">All actions</MenuItem>
              {actions.map((a) => (
                <MenuItem key={a} value={a}>
                  {a}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Role</InputLabel>
            <Select label="Role" value={role} onChange={(e) => (setRole(e.target.value), setPage(0))}>
              <MenuItem value="">All roles</MenuItem>
              {Object.entries(ROLE_LABEL).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} sx={{ width: { md: 160 } }} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} sx={{ width: { md: 160 } }} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 1020 }}>
            <TableHead>
              <TableRow>
                <TableCell>Log ID</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>IP</TableCell>
                <TableCell>Device</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.slice(page * rpp, page * rpp + rpp).map((a) => (
                <TableRow key={a.log_id}>
                  <TableCell>
                    <Mono>{a.log_id}</Mono>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDateTime(a.timestamp)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap>
                      {nameOf(a.user_code)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {a.user_code} · {ROLE_LABEL[a.role] || a.role}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tag tone={TONE[a.action] || "neutral"}>{a.action}</Tag>
                  </TableCell>
                  <TableCell>
                    <Mono>{a.ip}</Mono>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Typography variant="body2">{a.device}</Typography>
                    {a.fingerprint && (
                      <Typography variant="caption" color="text.secondary">
                        <Mono sx={{ fontSize: "0.68rem" }}>{a.fingerprint}</Mono>
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                      {a.details}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
        <TablePagination component="div" count={list.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={rpp} onRowsPerPageChange={(e) => (setRpp(+e.target.value), setPage(0))} rowsPerPageOptions={[25, 50, 100]} />
      </SectionCard>
    </>
  );
}
