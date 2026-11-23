import React, { useState } from "react";
import { Alert, Box, Button, Checkbox, FormControlLabel, FormGroup, InputAdornment, Stack, Switch, TextField, Typography } from "@mui/material";
import { SaveRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard } from "../../components/kit/UI.jsx";
import AiSettingsCard from "../../components/ai/AiSettingsCard.jsx";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { PROVIDERS, PROVIDER_ORDER, redirectUri } from "../../lib/conferencing.js";
import { ProviderMark } from "../../components/collab/ConferencingUI.jsx";

function ConferencingCard({ f, set }) {
  const c = { default_provider: "jitsi", google_client_id: "", ms_client_id: "", ms_tenant: "organizations", ...(f.conferencing || {}) };
  const upd = (k, v) => set("conferencing", { ...c, [k]: v });
  const uri = redirectUri();
  return (
    <SectionCard title="Video conferencing (Teams, Google Meet, Zoom…)">
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Everyone can already use Teams, Google Meet, Zoom, Webex or Jitsi: PeopleHub opens the provider with the meeting pre-filled and the organiser pastes the join link.
          Add a sign-in app below to have PeopleHub create Teams / Meet meetings automatically in the organiser's own calendar, with invitations sent to all attendees and client guests.
        </Typography>
        <FormControl sx={{ maxWidth: 320 }}>
          <InputLabel>Default platform for new meetings</InputLabel>
          <Select label="Default platform for new meetings" value={c.default_provider} onChange={(e) => upd("default_provider", e.target.value)}>
            {PROVIDER_ORDER.filter((id) => id !== "other").map((id) => <MenuItem key={id} value={id}><Stack direction="row" sx={{ alignItems: "center", gap: 1 }}><ProviderMark provider={id} size={16} />{PROVIDERS[id].label}</Stack></MenuItem>)}
          </Select>
        </FormControl>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <Stack spacing={1.2} sx={{ p: 1.5, border: "1px solid #e5eae5", borderRadius: 1.5 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}><ProviderMark provider="teams" /><Typography sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Microsoft Teams (Microsoft 365)</Typography></Stack>
            <TextField size="small" label="Application (client) ID" value={c.ms_client_id} onChange={(e) => upd("ms_client_id", e.target.value.trim())} placeholder="00000000-0000-0000-0000-000000000000" />
            <TextField size="small" label="Tenant" value={c.ms_tenant} onChange={(e) => upd("ms_tenant", e.target.value.trim() || "organizations")} helperText="Your tenant ID or domain (e.g. onasglobal.onmicrosoft.com), or 'organizations'" />
            <Typography variant="caption" color="text.secondary">
              Entra admin centre → App registrations → New: platform <b>Single-page application</b>, redirect URI <b>{uri}</b>, tick <b>Access tokens (implicit)</b>. API permission: Microsoft Graph → delegated <b>Calendars.ReadWrite</b>.
            </Typography>
          </Stack>
          <Stack spacing={1.2} sx={{ p: 1.5, border: "1px solid #e5eae5", borderRadius: 1.5 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}><ProviderMark provider="gmeet" /><Typography sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Google Meet (Google Workspace)</Typography></Stack>
            <TextField size="small" label="OAuth client ID" value={c.google_client_id} onChange={(e) => upd("google_client_id", e.target.value.trim())} placeholder="1234567890-abc.apps.googleusercontent.com" />
            <Typography variant="caption" color="text.secondary">
              Google Cloud console → enable <b>Google Calendar API</b> → Credentials → OAuth client ID, type <b>Web application</b>: authorised JavaScript origin <b>{window.location.origin}</b>, redirect URI <b>{uri}</b>. Consent-screen scope: <b>…/auth/calendar.events</b>.
            </Typography>
          </Stack>
        </Box>
        <Typography variant="caption" color="text.secondary">Client IDs are public identifiers, not secrets. Zoom and Webex need a server-side secret for automatic creation, so they use the paste-a-link flow.</Typography>
      </Stack>
    </SectionCard>
  );
}

const LIMITS = {
  session_timeout_min: [5, 120, "Session timeout"],
  max_failed_attempts: [3, 10, "Failed attempts before lock"],
  password_min_length: [8, 32, "Minimum password length"],
  otp_ttl_sec: [30, 600, "One-time code lifetime"],
  max_file_mb: [1, 25, "Max file size"],
  approval_sla_days: [1, 30, "Approval SLA"],
  point_value_inr: [0.1, 100, "Value of one point"],
  min_redeem_points: [1, 100000, "Minimum redemption"],
  duplicate_window_days: [1, 90, "Duplicate check window"],
  receipt_required_above: [0, 100000, "Receipt required above"],
  expense_claim_window_days: [7, 365, "Expense claim window"],
  max_advance_inr: [1000, 1000000, "Maximum advance"],
  advance_settle_days: [7, 120, "Settle advance within"],
  loan_max_multiple: [1, 12, "Loan limit (× monthly gross)"],
  loan_max_tenure_months: [1, 60, "Maximum loan tenure"],
};

function Num({ k, f, set, unit, help }) {
  const [min, max, label] = LIMITS[k];
  const v = f[k];
  const bad = v === "" || Number(v) < min || Number(v) > max;
  return (
    <TextField
      label={label}
      value={v}
      onChange={(e) => set(k, e.target.value.replace(/[^\d.]/g, ""))}
      error={bad}
      helperText={bad ? `Between ${min} and ${max}` : help}
      slotProps={{ input: { endAdornment: unit && <InputAdornment position="end">{unit}</InputAdornment> }, htmlInput: { inputMode: "decimal" } }}
    />
  );
}

export default function SystemSettings() {
  const { data, updateSettings, notifyToast } = useStore();
  const [f, setF] = useState(data.settings);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const invalid = Object.entries(LIMITS).some(([k, [min, max]]) => f[k] === "" || Number(f[k]) < min || Number(f[k]) > max) || !f.allowed_file_types.length;

  function save() {
    const { ai_connection, ...patch } = f; // eslint-disable-line no-unused-vars
    Object.keys(LIMITS).forEach((k) => (patch[k] = Number(f[k])));
    const r = updateSettings(patch);
    notifyToast(r.changed ? `${r.changed} setting(s) saved and audited.` : "No changes to save.");
  }

  return (
    <>
      <PageHeader
        title="System settings"
        subtitle="Security and workflow policy for every role. Each change is written to the audit log with old and new values."
        actions={
          <Button variant="contained" startIcon={<SaveRounded />} onClick={save} disabled={invalid}>
            Save settings
          </Button>
        }
      />
      <Stack spacing={2.5}>
        <AiSettingsCard onAudit={(cfg) => { updateSettings({ ai_connection: cfg }); notifyToast("Generative AI settings saved and audited."); }} />
        <ConferencingCard f={f} set={set} />
        <SectionCard title="Sign-in and sessions">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
            <Num k="session_timeout_min" f={f} set={set} unit="min idle" help="Users are signed out after this much inactivity" />
            <Num k="max_failed_attempts" f={f} set={set} unit="attempts" help="Account locks; a Super Admin must unlock" />
            <Num k="password_min_length" f={f} set={set} unit="chars" help="Plus upper, lower, number and symbol" />
            <Num k="otp_ttl_sec" f={f} set={set} unit="sec" help="How long an MFA code stays valid" />
          </Box>
          <Stack sx={{ mt: 2 }}>
            <FormControlLabel control={<Switch checked={f.mfa_admin_required} onChange={(e) => set("mfa_admin_required", e.target.checked)} />} label="Require MFA for admins" />
            <FormControlLabel control={<Switch checked disabled />} label="Require MFA and security PIN for super admins (always on)" />
          </Stack>
          {!f.mfa_admin_required && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Admins approve leave, expenses, payroll and contracts. Turning MFA off for them is not recommended.
            </Alert>
          )}
        </SectionCard>

        <SectionCard title="Claims and approvals">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
            <Num k="max_file_mb" f={f} set={set} unit="MB" help="Per supporting document" />
            <Num k="approval_sla_days" f={f} set={set} unit="days" help="Claims older than this show as over SLA" />
            <Num k="duplicate_window_days" f={f} set={set} unit="days" help="Same sub-category within this window is flagged" />
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Accepted file types
            </Typography>
            <FormGroup row>
              {["pdf", "jpg", "jpeg", "png"].map((t) => (
                <FormControlLabel key={t} control={<Checkbox size="small" checked={f.allowed_file_types.includes(t)} onChange={(e) => set("allowed_file_types", e.target.checked ? [...f.allowed_file_types, t] : f.allowed_file_types.filter((x) => x !== t))} />} label={t.toUpperCase()} />
              ))}
            </FormGroup>
          </Box>
          <FormControlLabel control={<Switch checked disabled />} label="Rejection reason is mandatory (always on)" />
        </SectionCard>

        <SectionCard title="Expenses, advances and loans">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
            <Num k="receipt_required_above" f={f} set={set} unit="₹" help="Receipts needed above this amount" />
            <Num k="expense_claim_window_days" f={f} set={set} unit="days" help="Claim within this many days of spending" />
            <Num k="max_advance_inr" f={f} set={set} unit="₹" help="Largest advance an employee can request" />
            <Num k="advance_settle_days" f={f} set={set} unit="days" help="Settle against an expense claim" />
            <Num k="loan_max_multiple" f={f} set={set} unit="×" help="Of monthly gross salary" />
            <Num k="loan_max_tenure_months" f={f} set={set} unit="months" help="Longest repayment period" />
          </Box>
        </SectionCard>

      </Stack>
    </>
  );
}
