// Super Admin: geofences & biometric devices, monitoring policy, workforce policies, territory, compliance, HR analytics.
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem, Select, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AddRounded, DeleteOutlineRounded, EditRounded, SaveRounded, DeleteSweepRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Tag, TableWrap, Mono, PersonCell, BarChart, HBar, KeyVal } from "../../components/kit/UI.jsx";
import LiveMap from "../../components/glass/LiveMap.jsx";
import { DevicesTable } from "../../components/workforce/AttendanceAdminView.jsx";
import { COUNTRIES, complianceChecks, filingCalendar, periodContext, toEngineEmp } from "../../lib/payroll/index.js";
import { isoDate, fmtDate, lastMonths, monthLabel } from "../../lib/utils.js";
import { yearsSince } from "../../lib/hrcalc.js";
import { useCountry, preferCountry, useCountryChoice } from "../../country/CountryContext.jsx";

const COUNTRY_NAME = { IN: "India", GB: "United Kingdom", US: "United States", AE: "UAE", SG: "Singapore", NA: "Namibia", ZA: "South Africa", KE: "Kenya", NG: "Nigeria", BW: "Botswana", CA: "Canada", MX: "Mexico", BR: "Brazil", DE: "Germany", FR: "France", IE: "Ireland", SA: "Saudi Arabia", MY: "Malaysia", PH: "Philippines", ID: "Indonesia", GH: "Ghana", ZM: "Zambia" };

// ─── Settings form used by the policy pages ───
export function SettingsForm({ title, subtitle, fields }) {
  const { data, updateSettings, notifyToast } = useStore();
  const [f, setF] = useState(() => Object.fromEntries(fields.map((x) => [x.key, data.settings[x.key]])));
  const [err, setErr] = useState("");
  const dirty = fields.some((x) => JSON.stringify(f[x.key]) !== JSON.stringify(data.settings[x.key]));
  function save() {
    for (const x of fields) {
      if (x.type === "number" && !(Number(f[x.key]) >= (x.min ?? 0) && Number(f[x.key]) <= (x.max ?? 1e9))) return setErr(`${x.label} must be between ${x.min ?? 0} and ${x.max}.`);
      if (x.type === "time" && !/^\d{2}:\d{2}$/.test(f[x.key] || "")) return setErr(`${x.label} must be a time like 09:30.`);
    }
    setErr("");
    const patch = Object.fromEntries(fields.map((x) => [x.key, x.type === "number" ? Number(f[x.key]) : f[x.key]]));
    const r = updateSettings(patch);
    notifyToast(r.changed ? `${title} saved (${r.changed} change${r.changed > 1 ? "s" : ""}).` : "No changes to save.");
  }
  return (
    <SectionCard title={title} subtitle={subtitle} action={<Button size="small" variant="contained" startIcon={<SaveRounded />} disabled={!dirty} onClick={save}>Save</Button>}>
      {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" }, gap: 2 }}>
        {fields.map((x) => (
          <Box key={x.key}>
            {x.type === "bool" ? (
              <FormControlLabel control={<Switch checked={!!f[x.key]} onChange={(e) => setF({ ...f, [x.key]: e.target.checked })} />} label={<Typography variant="body2">{x.label}</Typography>} />
            ) : x.type === "select" ? (
              <FormControl size="small" fullWidth>
                <InputLabel>{x.label}</InputLabel>
                <Select label={x.label} value={f[x.key] ?? ""} onChange={(e) => setF({ ...f, [x.key]: e.target.value })}>
                  {x.options.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                </Select>
              </FormControl>
            ) : (
              <TextField size="small" fullWidth label={x.label} type={x.type === "number" ? "number" : x.type === "time" ? "time" : "text"} value={f[x.key] ?? ""} onChange={(e) => setF({ ...f, [x.key]: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            )}
            {x.help && <Typography sx={{ fontSize: "0.58rem", color: "#78827b", mt: 0.4 }}>{x.help}</Typography>}
          </Box>
        ))}
      </Box>
    </SectionCard>
  );
}

// ─── Geofences & devices ───
const BLANK_FENCE = { name: "", lat: "", lng: "", radius_m: 200, type: "office", country: "IN", active: true };
const BLANK_DEV = { name: "", type: "fingerprint", geofence_id: "", serial: "", ip: "", firmware: "", status: "online" };

export function GeofencesDevices() {
  const { data, upsertGeofence, removeGeofence, upsertDevice, removeDevice, notifyToast } = useStore();
  const [draft, setDraft] = useState(null);
  const [dev, setDev] = useState(null);
  const [err, setErr] = useState("");
  const countries = [...new Set(data.geofences.map((g) => g.country || "IN"))];
  const geoChoice = useCountryChoice(countries, "IN");
  const country = geoChoice.value;
  const setCountry = geoChoice.setValue;
  const fences = data.geofences.filter((g) => (g.country || "IN") === country);
  const shown = draft && draft.lat !== "" && draft.lng !== "" ? [...fences.filter((f) => f.id !== draft.id), { ...draft, id: draft.id || "DRAFT", lat: Number(draft.lat), lng: Number(draft.lng), radius_m: Number(draft.radius_m) || 100, name: draft.name || "New geofence" }] : fences;
  const usage = (id) => data.employees.filter((e) => e.primary_geofence === id).length;
  function saveFence() {
    const r = upsertGeofence(draft);
    if (!r.ok) return setErr(r.error);
    notifyToast(`Geofence “${draft.name}” saved.`);
    setDraft(null);
    setErr("");
  }
  function saveDev() {
    const r = upsertDevice(dev);
    if (!r.ok) return setErr(r.error);
    notifyToast(`Device “${dev.name}” saved.`);
    setDev(null);
    setErr("");
  }
  return (
    <>
      <PageHeader eyebrow="SUPER ADMIN · ATTENDANCE" title="Geofences & biometric devices" subtitle="Where people may punch in, and the fingerprint and face terminals at each site. Click the map while editing to place a geofence." actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => { setErr(""); setDraft({ ...BLANK_FENCE, country }); }}>New geofence</Button>} />
      <Stack spacing={2.5}>
        <Grid min={160}>
          <StatCard label="Geofences" value={data.geofences.length} hint={`${data.geofences.filter((g) => g.active !== false).length} active`} />
          <StatCard label="Countries" value={countries.length} tone="info" />
          <StatCard label="Devices" value={data.devices.length} hint={`${data.devices.filter((d) => d.status === "online").length} online`} tone="good" />
          <StatCard label="Enforcement" value={data.settings.geofence_enforcement} tone="warn" hint="Change under Policies → Workforce" />
        </Grid>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" }, gap: 2.5 }}>
          <SectionCard title="Map" subtitle={draft ? "Click to move the new geofence's centre." : "Drag to pan, scroll or use + / − to zoom."} action={geoChoice.showChips && <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>{geoChoice.options.map((c) => <Chip key={c} size="small" label={COUNTRY_NAME[c] || c} color={country === c ? "primary" : "default"} variant={country === c ? "filled" : "outlined"} onClick={() => setCountry(c)} />)}</Stack>}>
            <LiveMap fences={shown} people={[]} height={400} editing={!!draft} focusFence={draft?.id || (draft ? "DRAFT" : undefined)} onMapClick={draft ? (p) => setDraft({ ...draft, lat: p.lat.toFixed(5), lng: p.lng.toFixed(5) }) : undefined} />
          </SectionCard>
          {draft ? (
            <SectionCard title={draft.id ? `Edit ${draft.name}` : "New geofence"} subtitle="Radius 30–5,000 m. GPS accuracy up to 50 m is allowed on top of the radius.">
              {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}
              <Stack spacing={1.6}>
                <TextField size="small" label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="Latitude" value={draft.lat} onChange={(e) => setDraft({ ...draft, lat: e.target.value })} />
                  <TextField size="small" label="Longitude" value={draft.lng} onChange={(e) => setDraft({ ...draft, lng: e.target.value })} />
                </Stack>
                <TextField size="small" label="Radius (metres)" type="number" value={draft.radius_m} onChange={(e) => setDraft({ ...draft, radius_m: e.target.value })} />
                <Stack direction="row" spacing={1}>
                  <FormControl size="small" fullWidth><InputLabel>Type</InputLabel><Select label="Type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>{[["office", "Office"], ["site", "Site / warehouse"], ["client", "Client location"]].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</Select></FormControl>
                  <FormControl size="small" fullWidth><InputLabel>Country</InputLabel><Select label="Country" value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })}>{Object.entries(COUNTRY_NAME).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</Select></FormControl>
                </Stack>
                <FormControlLabel control={<Switch checked={draft.active !== false} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />} label={<Typography variant="body2">Active (accepts punches)</Typography>} />
                <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                  <Button onClick={() => { setDraft(null); setErr(""); }}>Cancel</Button>
                  <Button variant="contained" onClick={saveFence}>Save geofence</Button>
                </Stack>
              </Stack>
            </SectionCard>
          ) : (
            <SectionCard title={`${COUNTRY_NAME[country] || country} geofences`} noPad>
              <TableWrap>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Name</TableCell><TableCell align="right">Radius</TableCell><TableCell align="right">People</TableCell><TableCell /></TableRow></TableHead>
                  <TableBody>
                    {fences.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell><Typography sx={{ fontSize: "0.68rem", fontWeight: 700 }}>{g.name}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}><Mono>{g.id}</Mono> · {g.type}{g.active === false ? " · off" : ""}</Typography></TableCell>
                        <TableCell align="right">{g.radius_m} m</TableCell>
                        <TableCell align="right">{usage(g.id)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          <IconButton size="small" aria-label={`Edit ${g.name}`} onClick={() => { setErr(""); setDraft({ ...g }); }}><EditRounded fontSize="small" /></IconButton>
                          <IconButton size="small" aria-label={`Delete ${g.name}`} onClick={() => { const r = removeGeofence(g.id); notifyToast(r.ok ? "Geofence deleted." : r.error, r.ok ? "success" : "error"); }}><DeleteOutlineRounded fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            </SectionCard>
          )}
        </Box>
        <SectionCard title="Biometric terminals" subtitle="Fingerprint and face devices sync punches to the register. Staff enrol with a biometric ID set on their employee record." action={<Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => { setErr(""); setDev({ ...BLANK_DEV, geofence_id: data.geofences[0]?.id }); }}>Register device</Button>} noPad>
          <DevicesTable canSync />
          <Box sx={{ p: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
            {data.devices.map((d) => (
              <Chip key={d.device_id} size="small" label={`${d.device_id} · ${d.name}`} onClick={() => { setErr(""); setDev({ ...d }); }} onDelete={() => { removeDevice(d.device_id); notifyToast(`${d.name} removed.`); }} />
            ))}
          </Box>
        </SectionCard>
      </Stack>
      <Dialog open={!!dev} onClose={() => setDev(null)} fullWidth maxWidth="sm">
        <DialogTitle>{dev?.device_id ? `Edit ${dev.device_id}` : "Register a biometric device"}</DialogTitle>
        {dev && (
          <DialogContent>
            {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}
            <Stack spacing={1.6} sx={{ pt: 1 }}>
              <TextField size="small" label="Name" value={dev.name} onChange={(e) => setDev({ ...dev, name: e.target.value })} />
              <Stack direction="row" spacing={1}>
                <FormControl size="small" fullWidth><InputLabel>Type</InputLabel><Select label="Type" value={dev.type} onChange={(e) => setDev({ ...dev, type: e.target.value })}><MenuItem value="fingerprint">Fingerprint</MenuItem><MenuItem value="face">Face recognition</MenuItem><MenuItem value="card">RFID card</MenuItem></Select></FormControl>
                <FormControl size="small" fullWidth><InputLabel>Location</InputLabel><Select label="Location" value={dev.geofence_id} onChange={(e) => setDev({ ...dev, geofence_id: e.target.value })}>{data.geofences.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}</Select></FormControl>
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField size="small" fullWidth label="Serial number" value={dev.serial} onChange={(e) => setDev({ ...dev, serial: e.target.value })} />
                <TextField size="small" fullWidth label="IP address" value={dev.ip} onChange={(e) => setDev({ ...dev, ip: e.target.value })} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField size="small" fullWidth label="Firmware" value={dev.firmware} onChange={(e) => setDev({ ...dev, firmware: e.target.value })} />
                <FormControl size="small" fullWidth><InputLabel>Status</InputLabel><Select label="Status" value={dev.status} onChange={(e) => setDev({ ...dev, status: e.target.value })}><MenuItem value="online">Online</MenuItem><MenuItem value="offline">Offline</MenuItem></Select></FormControl>
              </Stack>
            </Stack>
          </DialogContent>
        )}
        <DialogActions><Button onClick={() => setDev(null)}>Cancel</Button><Button variant="contained" onClick={saveDev}>Save device</Button></DialogActions>
      </Dialog>
    </>
  );
}

// ─── Monitoring policy ───
export function MonitoringPolicy() {
  const { data, purgeMonitoring, notifyToast } = useStore();
  const active = data.employees.filter((e) => e.status === "active");
  // v10.6: employee consent removed from the monitoring policy — the company policy applies to everyone during work hours.
  return (
    <>
      <PageHeader eyebrow="SUPER ADMIN · PRIVACY" title="Employee monitoring policy" subtitle="What is collected, when, who can see it and how long it is kept. The company policy applies to every employee during work hours; employees always see their own data." />
      <Stack spacing={2.5}>
        <Grid min={160}>
          <StatCard label="Employees covered" value={active.length} tone="good" hint="Company policy, during work hours" />
          <StatCard label="Live location" value={{ off: "Off", clocked_in: "While clocked in", field_staff: "Field staff" }[data.settings.location_tracking] || "—"} tone="info" hint={`Every ${data.settings.location_ping_min} min`} />
          <StatCard label="Activity tracking" value={data.settings.activity_tracking ? "On" : "Off"} tone="neutral" hint="App categories, never content" />
          <StatCard label="Activity records" value={data.activity.length} tone="neutral" hint={`Kept ${data.settings.monitoring_retention_days} days`} />
        </Grid>
        <Alert severity="info">Collected: punch location, live position while clocked in (every {data.settings.location_ping_min} min), and active/idle minutes by app category during work hours. Never collected: keystrokes, message or email content, browsing history, microphone or camera.</Alert>
        <SettingsForm
          title="Collection rules"
          subtitle="Changes apply to every employee from their next sign-in"
          fields={[
            { key: "location_tracking", label: "Live location", type: "select", options: [["off", "Off"], ["clocked_in", "Only while clocked in"], ["field_staff", "Field staff only, while clocked in"]] },
            { key: "location_ping_min", label: "Location update every (min)", type: "number", min: 1, max: 60 },
            { key: "activity_tracking", label: "Work activity tracking", type: "bool" },
            { key: "activity_detail", label: "Activity detail", type: "select", options: [["categories", "Categories only (productive / neutral / unproductive)"], ["apps", "App names (no content)"]] },
            { key: "screenshots", label: "Screenshots", type: "select", options: [["off", "Off"]], help: "Disabled in this build. Screenshots capture personal data and need a separate legal review." },
            { key: "managers_see_team_activity", label: "Managers see their team's activity", type: "bool" },
            { key: "work_hours_start", label: "Collect from", type: "time" },
            { key: "work_hours_end", label: "Collect until", type: "time" },
            { key: "monitoring_retention_days", label: "Keep data for (days)", type: "number", min: 7, max: 365 },
          ]}
        />
        <SectionCard title="Data retention" subtitle={`Records older than ${data.settings.monitoring_retention_days} days are removed`} action={<Button size="small" color="error" variant="outlined" startIcon={<DeleteSweepRounded />} onClick={() => { const r = purgeMonitoring(); notifyToast(r.ok ? `Purged ${r.removed} record(s) past retention; positions of people not sharing were deleted.` : r.error, r.ok ? "success" : "error"); }}>Purge past retention</Button>}>
          <Typography variant="body2" color="text.secondary">{data.activity.length} activity record(s) and {Object.keys(data.locations || {}).length} live position(s) are held now.</Typography>
        </SectionCard>
      </Stack>
    </>
  );
}

// ─── Workforce policies (attendance, calls, assets, performance) ───
export function WorkforcePolicies() {
  return (
    <Stack spacing={2.5}>
      <SettingsForm
        title="Attendance & geofencing"
        subtitle="Shift timing, lateness, and how punches outside a geofence are handled"
        fields={[
          { key: "shift_start", label: "Shift starts", type: "time" },
          { key: "late_after", label: "Late after", type: "time" },
          { key: "shift_hours", label: "Shift hours (overtime above)", type: "number", min: 4, max: 12 },
          { key: "geofence_enforcement", label: "Outside a geofence", type: "select", options: [["block", "Block the punch"], ["flag", "Allow and flag for the manager"], ["allow", "Allow silently"]] },
          { key: "selfie_required_geo", label: "Selfie with web/mobile punches", type: "bool" },
          { key: "biometric_device_verification", label: "Device biometric (fingerprint / face) on mobile", type: "bool" },
          { key: "regularize_window_days", label: "Corrections allowed for (days)", type: "number", min: 1, max: 31 },
        ]}
      />
      <SettingsForm
        title="Team call tracker"
        subtitle="Targets for sales and support staff with call tracking switched on"
        fields={[
          { key: "call_daily_target", label: "Calls a day", type: "number", min: 1, max: 300 },
          { key: "call_talk_target_min", label: "Talk time a day (min)", type: "number", min: 1, max: 480 },
          { key: "call_source", label: "Call source", type: "select", options: [["mobile_app", "Mobile app call log"], ["telephony", "Cloud telephony"], ["manual", "Manual entry"]] },
        ]}
      />
      <SettingsForm
        title="Assets, performance & benefits"
        fields={[
          { key: "asset_depreciation_years", label: "Depreciate assets over (years)", type: "number", min: 1, max: 10 },
          { key: "merit_budget_pct", label: "Merit budget (% of payroll)", type: "number", min: 0, max: 30 },
          { key: "benefits_window_open", label: "Benefits enrolment window open", type: "bool" },
        ]}
      />
    </Stack>
  );
}

// ─── Territory ───
export function Territory() {
  const { data, setFx, notifyToast } = useStore();
  const active = data.employees.filter((e) => e.status === "active");
  const [fx, setFxDraft] = useState(data.fx);
  const rows = Object.entries(COUNTRIES).map(([cc, C]) => {
    const list = active.filter((e) => (e.country_code || "IN") === cc);
    const local = list.reduce((s, e) => s + e.monthly_gross, 0);
    return { cc, C, list, local, inr: local * (data.fx[C.currency] || 1), fences: data.geofences.filter((g) => (g.country || "IN") === cc).length };
  });
  const total = rows.reduce((s, r) => s + r.inr, 0);
  return (
    <>
      <PageHeader eyebrow="SUPER ADMIN · GLOBAL" title="Multi-territory workforce" subtitle="Headcount and cost by country, converted to rupees at the rates below. Each country runs its own payroll engine and rules." />
      <Stack spacing={2.5}>
        <Grid min={160}>
          <StatCard label="Countries" value={rows.filter((r) => r.list.length).length} />
          <StatCard label="People" value={active.length} tone="info" />
          <StatCard label="Monthly payroll (₹)" value={`₹${(total / 100000).toFixed(1)} L`} tone="good" />
          <StatCard label="Outside India" value={`${Math.round(((total - (rows.find((r) => r.cc === "IN")?.inr || 0)) / Math.max(1, total)) * 100)}%`} tone="warn" hint="Share of cost" />
        </Grid>
        <SectionCard title="By country" noPad>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead><TableRow><TableCell>Country</TableCell><TableCell align="right">People</TableCell><TableCell align="right">Monthly gross (local)</TableCell><TableCell align="right">In ₹</TableCell><TableCell align="right">Share</TableCell><TableCell align="right">Geofences</TableCell><TableCell>Rules version</TableCell></TableRow></TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.cc}>
                    <TableCell sx={{ fontWeight: 700 }}>{r.C.name}</TableCell>
                    <TableCell align="right">{r.list.length}</TableCell>
                    <TableCell align="right">{r.C.currency} {Math.round(r.local).toLocaleString("en-IN")}</TableCell>
                    <TableCell align="right">₹{Math.round(r.inr).toLocaleString("en-IN")}</TableCell>
                    <TableCell align="right" sx={{ minWidth: 120 }}><HBar label="" value={r.inr} max={total} right={`${Math.round((r.inr / Math.max(1, total)) * 100)}%`} /></TableCell>
                    <TableCell align="right">{r.fences}</TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.6rem", color: "#56655f" }}>{r.C.engine.RATES.effective}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
        <SectionCard title="Exchange rates" subtitle="Rupees per unit of currency. Used for reporting only; staff are paid in their local currency." action={<Button size="small" variant="contained" startIcon={<SaveRounded />} onClick={() => { for (const [k, v] of Object.entries(fx)) { if (k === "INR") continue; const r = setFx(k, v); if (!r.ok) return notifyToast(`${k}: ${r.error}`, "error"); } notifyToast("Exchange rates saved."); }}>Save rates</Button>}>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
            {Object.keys(fx).filter((k) => k !== "INR").map((k) => <TextField key={k} size="small" type="number" label={`1 ${k} = ₹`} value={fx[k]} onChange={(e) => setFxDraft({ ...fx, [k]: e.target.value })} sx={{ width: 140 }} />)}
          </Stack>
        </SectionCard>
      </Stack>
    </>
  );
}

// ─── Local policies & compliance ───
export function Compliance() {
  const { data } = useStore();
  const active = data.employees.filter((e) => e.status === "active");
  const present = Object.keys(COUNTRIES).filter((cc) => active.some((e) => (e.country_code || "IN") === cc));
  const choice = useCountryChoice(present, "IN");
  const cc = COUNTRIES[choice.value] ? choice.value : present[0] || "IN";
  const setCc = choice.setValue;
  const C = COUNTRIES[cc];
  const today = isoDate();
  const ctx = periodContext(today, { weeklyHours: 45 });
  const results = active.filter((e) => (e.country_code || "IN") === cc).map((e) => ({ e, checks: complianceChecks(toEngineEmp(e), ctx) }));
  const flat = results.flatMap((r) => r.checks.map((c) => ({ ...c, e: r.e })));
  const fails = flat.filter((c) => c.status === "fail");
  const warns = flat.filter((c) => c.status === "warn");
  const cal = filingCalendar(cc, today);
  return (
    <>
      <PageHeader eyebrow={`SUPER ADMIN · ${choice.fixedTo ? C.name.toUpperCase() : "GLOBAL"}`} title="Local policies & compliance" subtitle="Statutory checks run by each country's payroll engine, the filing calendar and the local employment policy." />
      {choice.showChips && <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
        {choice.options.map((c) => <Chip key={c} label={COUNTRIES[c].name} color={cc === c ? "primary" : "default"} variant={cc === c ? "filled" : "outlined"} onClick={() => setCc(c)} />)}
      </Stack>}
      <Stack spacing={2.5}>
        <Grid min={160}>
          <StatCard label="People checked" value={results.length} />
          <StatCard label="Failures" value={fails.length} tone={fails.length ? "bad" : "good"} hint={`${fails.filter((f) => f.block).length} block payroll`} />
          <StatCard label="Warnings" value={warns.length} tone="warn" />
          <StatCard label="Next filing" value={cal.filter((f) => f.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft)[0]?.daysLeft ?? "—"} hint="days" tone="info" />
        </Grid>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.3fr 1fr" }, gap: 2.5 }}>
          <SectionCard title="Issues to fix" subtitle="Failures and warnings by person" noPad>
            {fails.length + warns.length === 0 ? <Typography sx={{ p: 2, fontSize: "0.65rem", color: "#78827b" }}>No issues.</Typography> : (
              <TableWrap>
                <Table size="small" sx={{ minWidth: 560 }}>
                  <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Check</TableCell><TableCell>Detail</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                  <TableBody>{[...fails, ...warns].map((c, i) => <TableRow key={i}><TableCell><PersonCell name={c.e.full_name} sub={c.e.employee_code} /></TableCell><TableCell sx={{ fontWeight: 600 }}>{c.rule}</TableCell><TableCell><Typography sx={{ fontSize: "0.6rem" }}>{c.detail}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{c.law}</Typography></TableCell><TableCell><Tag tone={c.status === "fail" ? "bad" : "warn"}>{c.block ? "Blocks payroll" : c.status}</Tag></TableCell></TableRow>)}</TableBody>
                </Table>
              </TableWrap>
            )}
          </SectionCard>
          <SectionCard title="Filing calendar" noPad>
            <TableWrap>
              <Table size="small">
                <TableHead><TableRow><TableCell>Filing</TableCell><TableCell>Due</TableCell><TableCell align="right">Days</TableCell></TableRow></TableHead>
                <TableBody>{cal.map((f) => <TableRow key={f.name}><TableCell><Typography sx={{ fontSize: "0.66rem", fontWeight: 600 }}>{f.name}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{f.authority} · {f.freq}</Typography></TableCell><TableCell>{fmtDate(f.due)}</TableCell><TableCell align="right"><Tag tone={f.daysLeft < 0 ? "neutral" : f.daysLeft <= 5 ? "bad" : f.daysLeft <= 14 ? "warn" : "good"}>{f.daysLeft < 0 ? "Past" : f.daysLeft}</Tag></TableCell></TableRow>)}</TableBody>
              </Table>
            </TableWrap>
          </SectionCard>
        </Box>
        <SectionCard title={`${C.name} employment policy`} subtitle={C.engine.RATES.effective}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            {Object.entries(C.engine.policy).map(([head, list]) => (
              <Box key={head} sx={{ p: 1.5, border: "1px solid #e7ebe6", borderRadius: 1.5 }}>
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, mb: 0.8 }}>{head}</Typography>
                <KeyVal cols={1} items={list} />
              </Box>
            ))}
          </Box>
        </SectionCard>
      </Stack>
    </>
  );
}

// ─── HR analytics ───
export function HRAnalytics() {
  const { data } = useStore();
  const active = data.employees.filter((e) => e.status === "active");
  const n = active.length;
  const exits12 = data.exits.filter((x) => x.d >= isoDate(Date.now() - 365 * 86400000));
  const vol = exits12.filter((x) => x.type === "Voluntary").length;
  const avgHc = data.hcTrend.reduce((s, v) => s + v, 0) / data.hcTrend.length;
  const attrition = (exits12.length / avgHc) * 100;
  const tenure = active.reduce((s, e) => s + yearsSince(e.date_of_joining), 0) / Math.max(1, n);
  const firstYear = active.filter((e) => yearsSince(e.date_of_joining) < 1).length;
  // Absenteeism: approved leave days (excluding EL planned leave) in last 90 days ÷ (people × 64 workdays)
  const since = isoDate(Date.now() - 90 * 86400000);
  const unplanned = data.requests.filter((r) => r.type === "leave" && r.status === "Approved" && ["SL", "LOP"].includes(r.leave_type) && r.from_date >= since).reduce((s, r) => s + r.days, 0);
  const absentee = (unplanned / Math.max(1, n * 64)) * 100;
  const women = active.filter((e) => ["F", "Female"].includes(e.gender)).length;
  const months = lastMonths(12);
  const hcData = months.map((m, i) => ({ label: monthLabel(m).split(" ")[0], hc: data.hcTrend[i] ?? n }));
  const byDept = {};
  active.forEach((e) => { byDept[e.department] = byDept[e.department] || { n: 0, f: 0 }; byDept[e.department].n += 1; if (["F", "Female"].includes(e.gender)) byDept[e.department].f += 1; });
  const reasons = {};
  exits12.forEach((x) => { reasons[x.r] = (reasons[x.r] || 0) + 1; });
  const grades = {};
  active.forEach((e) => { grades[e.grade_code] = (grades[e.grade_code] || 0) + 1; });
  return (
    <>
      <PageHeader eyebrow="SUPER ADMIN · INSIGHT" title="HR analytics" subtitle="Headcount, attrition, retention, absenteeism and diversity across the company." />
      <Stack spacing={2.5}>
        <Grid min={160}>
          <StatCard label="Headcount" value={n} hint={`${data.hcTrend[0]} a year ago`} />
          <StatCard label="Attrition (12 mo)" value={`${attrition.toFixed(1)}%`} tone={attrition > 15 ? "bad" : "warn"} hint={`${exits12.length} exits ÷ avg headcount ${avgHc.toFixed(1)}`} />
          <StatCard label="Voluntary share" value={`${Math.round((vol / Math.max(1, exits12.length)) * 100)}%`} tone="neutral" />
          <StatCard label="Average tenure" value={`${tenure.toFixed(1)} yrs`} tone="info" hint={`${firstYear} in their first year`} />
          <StatCard label="Absenteeism (90 d)" value={`${absentee.toFixed(1)}%`} tone="neutral" hint="Sick + unpaid days ÷ workdays" />
          <StatCard label="Revenue per employee" value={`₹${(data.revenue / Math.max(1, n) / 100000).toFixed(1)} L`} tone="good" hint="Annual revenue ÷ headcount" />
          <StatCard label="Women" value={`${Math.round((women / Math.max(1, n)) * 100)}%`} tone="accent" hint={`${women} of ${n}`} />
        </Grid>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" }, gap: 2.5 }}>
          <SectionCard title="Headcount, last 12 months">
            <BarChart data={hcData} series={[{ key: "hc", label: "Headcount", color: "#2A7DC9" }]} height={200} />
          </SectionCard>
          <SectionCard title="Why people left" subtitle="Last 12 months">
            {Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([r, v]) => <HBar key={r} label={r} value={v} max={exits12.length} right={`${v}`} color="#D07A1F" />)}
          </SectionCard>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2.5 }}>
          <SectionCard title="Gender balance by department" noPad>
            <TableWrap>
              <Table size="small">
                <TableHead><TableRow><TableCell>Department</TableCell><TableCell align="right">People</TableCell><TableCell align="right">Women</TableCell><TableCell sx={{ width: "40%" }} /></TableRow></TableHead>
                <TableBody>{Object.entries(byDept).map(([d, v]) => <TableRow key={d}><TableCell>{d}</TableCell><TableCell align="right">{v.n}</TableCell><TableCell align="right">{v.f}</TableCell><TableCell><HBar label="" value={v.f} max={v.n} right={`${Math.round((v.f / v.n) * 100)}%`} color="#B84E8E" /></TableCell></TableRow>)}</TableBody>
              </Table>
            </TableWrap>
          </SectionCard>
          <SectionCard title="Grade mix">
            {Object.entries(grades).sort().map(([g, v]) => <HBar key={g} label={g} value={v} max={n} right={`${v}`} color="#1A9A72" />)}
          </SectionCard>
        </Box>
        <SectionCard title="Exit log" noPad>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 520 }}>
              <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Department</TableCell><TableCell>Country</TableCell><TableCell>Type</TableCell><TableCell>Reason</TableCell></TableRow></TableHead>
              <TableBody>{data.exits.map((x, i) => <TableRow key={i}><TableCell>{fmtDate(x.d)}</TableCell><TableCell>{x.dept}</TableCell><TableCell>{COUNTRY_NAME[x.ctry]}</TableCell><TableCell><Tag tone={x.type === "Voluntary" ? "warn" : "neutral"}>{x.type}</Tag></TableCell><TableCell>{x.r}</TableCell></TableRow>)}</TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      </Stack>
    </>
  );
}
