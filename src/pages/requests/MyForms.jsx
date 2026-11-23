// v10.13 · Requests & forms for employees: work from home, travel, overtime, letters and grievance / speak-up.
// Each form runs on the approval engine — the chain set by the Super Admin (Policies → Approval workflow), the same
// inbox for the reporting manager, the same approvals screen for admins and the Super Admin, notifications and audit.
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { HomeWorkRounded, FlightTakeoffRounded, MoreTimeRounded, DescriptionRounded, RecordVoiceOverRounded, AddRounded, AccountTreeRounded, LockRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, TableWrap, Mono, EmptyState } from "../../components/kit/UI.jsx";
import { RequestStatus, RequestDrawer } from "../../components/kit/Requests.jsx";
import ListSelect from "../../components/kit/ListSelect.jsx";
import { FORM_TYPES, validateForm } from "../../lib/forms.js";
import { chainLabel, defaultChain, requestSummary } from "../../lib/requests.js";

const ICONS = { wfh: HomeWorkRounded, travel: FlightTakeoffRounded, overtime: MoreTimeRounded, letter: DescriptionRounded, grievance: RecordVoiceOverRounded };
const COLOURS = { wfh: "#1F9D63", travel: "#2F6FDE", overtime: "#B7791F", letter: "#7E57C2", grievance: "#C2410C" };

export function chainTextFor(data, type) {
  const c = data.settings?.workflow?.[type] || defaultChain(type);
  return FORM_TYPES[type]?.confidential ? `${chainLabel(c, type).replace(/^Reporting manager → /, "").replace(/^Reporting manager only$/, "HR admin only")} · your manager is not told` : chainLabel(c, type);
}

function FormField({ fl, value, onChange, error }) {
  const common = { size: "small", fullWidth: true, label: `${fl.label}${fl.required ? " *" : ""}`, error: !!error, helperText: error || " ", value: value ?? "" };
  if (fl.type === "list") return <ListSelect listKey={fl.list} size="small" label={`${fl.label}${fl.required ? " *" : ""}`} required value={value || ""} onChange={onChange} error={!!error} helperText={error || " "} />;
  if (fl.type === "select") return <TextField select {...common} onChange={(e) => onChange(e.target.value)} slotProps={{ select: { "data-testid": `form-${fl.key}` } }}>{fl.options.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField>;
  if (fl.type === "textarea") return <TextField {...common} multiline minRows={3} onChange={(e) => onChange(e.target.value)} slotProps={{ htmlInput: { "data-testid": `form-${fl.key}` } }} />;
  return <TextField {...common} type={fl.type === "date" ? "date" : fl.type === "number" ? "number" : "text"} onChange={(e) => onChange(e.target.value)} slotProps={{ inputLabel: fl.type === "date" ? { shrink: true } : undefined, htmlInput: { "data-testid": `form-${fl.key}` } }} />;
}

export function FormDialog({ type, open, onClose }) {
  const { data, createRequest, notifyToast, empBy, user } = useStore();
  const def = FORM_TYPES[type];
  const [f, setF] = useState({});
  const [errors, setErrors] = useState({});
  React.useEffect(() => { if (open) { setF(type === "letter" ? { delivery: "email" } : type === "travel" ? { advance_needed: "no" } : {}); setErrors({}); } }, [open, type]);
  if (!def) return null;
  const me = empBy[user?.employee_code];
  const submit = () => {
    const v = validateForm(type, f, { emp: me, requests: data.requests });
    if (Object.keys(v.errors).length) return setErrors(v.errors);
    const r = createRequest(type, f);
    if (!r.ok) return setErrors(r.errors || { _: r.error || "Couldn't send the request." });
    notifyToast(`${def.label} ${r.id || ""} sent · ${chainTextFor(data, type)}.`);
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{def.label}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }} data-testid={`form-${type}`}>
          <Typography variant="body2" color="text.secondary">{def.blurb}</Typography>
          <Alert icon={def.confidential ? <LockRounded fontSize="small" /> : <AccountTreeRounded fontSize="small" />} severity={def.confidential ? "warning" : "info"} sx={{ py: 0.2, fontSize: "0.74rem" }}>Approval: {chainTextFor(data, type)}</Alert>
          {errors._ && <Alert severity="error">{errors._}</Alert>}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, columnGap: 1.5 }}>
            {def.fields.map((fl) => (
              <Box key={fl.key} sx={{ gridColumn: fl.full || fl.type === "textarea" ? "1 / -1" : undefined }}>
                <FormField fl={fl} value={f[fl.key]} error={errors[fl.key]} onChange={(v) => { setF({ ...f, [fl.key]: v }); if (errors[fl.key]) setErrors({ ...errors, [fl.key]: undefined }); }} />
              </Box>
            ))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} data-testid="form-submit">Send for approval</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function MyForms() {
  const { data, user, cancelRequest, notifyToast } = useStore();
  const [open, setOpen] = useState(null);
  const [view, setView] = useState(null);
  const mine = useMemo(() => data.requests.filter((r) => FORM_TYPES[r.type] && r.employee_code === user?.employee_code), [data.requests, user]);
  const fmt = (n) => Number(n || 0).toLocaleString("en-IN");
  return (
    <>
      <PageHeader eyebrow="ME · REQUESTS & FORMS" title="Requests & forms" subtitle="Work from home, travel, overtime, letters and confidential concerns — each goes to the right approver automatically." />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(5, minmax(0,1fr))" }, gap: 1.5, mb: 2.5 }}>
        {Object.entries(FORM_TYPES).map(([k, d]) => {
          const Icon = ICONS[k] || DescriptionRounded;
          return (
            <Card key={k} sx={{ p: 2, display: "flex", flexDirection: "column", borderTop: `3px solid ${COLOURS[k]}` }}>
              <Icon sx={{ color: COLOURS[k] }} />
              <Typography sx={{ fontWeight: 800, fontSize: "0.86rem", mt: 0.6 }}>{d.label}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.72rem", flex: 1, mt: 0.3 }}>{d.blurb}</Typography>
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", mt: 1 }}>{chainTextFor(data, k)}</Typography>
              <Button size="small" variant="outlined" startIcon={<AddRounded />} sx={{ mt: 1, alignSelf: "flex-start" }} onClick={() => setOpen(k)} data-testid={`start-${k}`}>Start</Button>
            </Card>
          );
        })}
      </Box>
      <SectionCard title="My requests" subtitle="Track who has each request now. You can cancel a request until it is decided.">
        {mine.length === 0 ? <EmptyState title="Nothing sent yet" text="Start a form above — it goes to the right approver automatically." /> : (
          <TableWrap>
            <Table size="small">
              <TableHead><TableRow><TableCell>Request</TableCell><TableCell>Form</TableCell><TableCell>Details</TableCell><TableCell>Sent</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {mine.map((r) => { const s = requestSummary(r, { fmt }); return (
                  <TableRow key={r.request_id} hover sx={{ cursor: "pointer" }} onClick={() => setView(r.request_id)}>
                    <TableCell><Mono>{r.request_id}</Mono></TableCell>
                    <TableCell>{FORM_TYPES[r.type].label}</TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.76rem", fontWeight: 600 }}>{s.title}</Typography><Typography sx={{ fontSize: "0.66rem", color: "text.secondary" }}>{s.detail} · {s.amount}</Typography></TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{String(r.created_at).slice(0, 10)}</TableCell>
                    <TableCell><RequestStatus r={r} /></TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>{r.status === "Pending" && <Button size="small" color="inherit" onClick={() => { const x = cancelRequest(r.request_id); notifyToast(x?.ok === false ? x.error : `${r.request_id} cancelled.`, x?.ok === false ? "error" : undefined); }}>Cancel</Button>}</TableCell>
                  </TableRow>
                ); })}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>
      <FormDialog type={open} open={!!open} onClose={() => setOpen(null)} />
      {view && <RequestDrawer id={view} onClose={() => setView(null)} />}
    </>
  );
}
