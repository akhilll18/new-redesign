// v10.13 · Dropdown lists — every dropdown in the app and where its choices come from.
// Super Admin: every list. Admins: the lists that belong to their work (their modules).
// "+ Add value" saves to the account; the value appears in every dropdown that uses the list (all roles), and is audited.
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormGroup, InputAdornment, MenuItem, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import { AddRounded, PlaylistAddRounded, SearchRounded, ListAltRounded, StorageRounded, PeopleAltRounded, LockRounded, OpenInNewRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, TableWrap } from "../../components/kit/UI.jsx";
import { AddOptionDialog } from "../../components/kit/ListSelect.jsx";
import { OPTION_LISTS, canEditList, listDef, listOptions } from "../../lib/optionLists.js";
import { customFieldsAll, whoLabel } from "../../lib/customFields.js";
import { EMPLOYEE_SECTIONS } from "../../data/employeeFields.js";
import INVENTORY from "../../data/dropdownInventory.json";

const MODULE_OWNER = { accounts: "HR admin", expense: "Finance admin", payroll: "Payroll / Finance admin", payslips: "HR (payslips) admin", assets: "Asset admin", it: "IT admin", recruitment: "Recruitment admin", learning: "Learning admin", attendance: "Attendance admin" };
const SOURCE = {
  list: { label: "Add with +", color: "success", icon: <AddRounded sx={{ fontSize: 14 }} />, help: "A list you can grow here — new values appear in this dropdown everywhere." },
  master: { label: "Master data", color: "info", icon: <StorageRounded sx={{ fontSize: 14 }} />, help: "Comes from records kept on their own screen (add a department, location, leave type … there)." },
  people: { label: "People records", color: "default", icon: <PeopleAltRounded sx={{ fontSize: 14 }} />, help: "Employees, managers or admins — they appear as people are added." },
  fixed: { label: "Fixed (rules)", color: "default", icon: <LockRounded sx={{ fontSize: 14 }} />, help: "Values the rules engine depends on (status, worker type, tax section …). Kept fixed so pay, leave and access keep working." },
};

function Stat({ icon, value, label, tone }) {
  return (
    <Card sx={{ p: 1.8, display: "flex", gap: 1.2, alignItems: "center" }}>
      <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", background: `${tone}1a`, color: tone }}>{icon}</Box>
      <Box><Typography sx={{ fontWeight: 800, fontSize: "1.15rem", lineHeight: 1.1 }}>{value}</Typography><Typography sx={{ fontSize: "0.66rem", color: "text.secondary" }}>{label}</Typography></Box>
    </Card>
  );
}

export default function DropdownLists() {
  const { data, user, removeListOption, notifyToast, setCustomFieldActive } = useStore();
  const [creating, setCreating] = useState(false);
  const customAll = customFieldsAll(data);
  const navigate = useNavigate();
  const isSuper = user?.role === "superadmin";
  const [tab, setTab] = useState(0);
  const [adding, setAdding] = useState(null);
  const [q, setQ] = useState("");
  const [src, setSrc] = useState("all");
  const [area, setArea] = useState("all");

  // v10.15: + the dropdowns the Super Admin created (active ones; switched-off ones are listed for the Super Admin)
  const myLists = [...Object.keys(OPTION_LISTS), ...customAll.filter((c) => c.active !== false || isSuper).map((c) => c.key)].filter((k) => canEditList(user, data, k));
  const usedBy = useMemo(() => INVENTORY.items.reduce((a, x) => { if (x.source.startsWith("list:")) { const k = x.source.slice(5); (a[k] = a[k] || []).push(x); } return a; }, {}), []);
  const masterUse = useMemo(() => INVENTORY.items.reduce((a, x) => { if (x.source.startsWith("master:")) { const k = x.source.slice(7); a[k] = (a[k] || 0) + 1; } return a; }, {}), []);
  const counts = INVENTORY.items.reduce((a, x) => { const k = x.source.split(":")[0]; a[k] = (a[k] || 0) + 1; return a; }, {});
  const areas = [...new Set(INVENTORY.items.map((x) => x.area))].sort();
  // Admins see the dropdowns linked to their lists; the Super Admin sees all of them.
  const visible = INVENTORY.items.filter((x) => isSuper || (x.source.startsWith("list:") && myLists.includes(x.source.slice(5))));
  const rows = visible.filter((x) => (src === "all" || x.source.split(":")[0] === src) && (area === "all" || x.area === area) && (!q || `${x.area} ${x.label} ${x.source}`.toLowerCase().includes(q.toLowerCase())));
  const ownersOf = (module) => (data.admins || []).filter((a) => a.status === "active" && a.modules.includes(module)).map((a) => a.full_name);

  return (
    <>
      <PageHeader eyebrow={isSuper ? "SUPER ADMIN · DROPDOWN LISTS" : "ADMIN · DROPDOWN LISTS"} title="Dropdown lists" subtitle={isSuper ? "Every dropdown in the app and where its choices come from. Add a value with + and it appears wherever that list is used — for every role." : "The lists that belong to your work. Add a value with + and it appears wherever that list is used."} />
      {isSuper && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, minmax(0,1fr))" }, gap: 1.5, mb: 2 }} data-testid="dropdown-stats">
          <Stat icon={<ListAltRounded />} value={INVENTORY.total} label="dropdowns in the app" tone="#1F4E5A" />
          <Stat icon={<AddRounded />} value={`${Object.keys(OPTION_LISTS).length + customAll.length} · ${counts.list || 0}`} label="lists you can grow · dropdowns they feed" tone="#1F9D63" />
          <Stat icon={<StorageRounded />} value={counts.master || 0} label="fed by master data" tone="#2F6FDE" />
          <Stat icon={<PeopleAltRounded />} value={counts.people || 0} label="fed by people records" tone="#7E57C2" />
          <Stat icon={<LockRounded />} value={counts.fixed || 0} label="fixed rule values" tone="#78827B" />
        </Box>
      )}
      {isSuper && (
        <Alert severity="success" icon={<PlaylistAddRounded />} sx={{ mb: 2, alignItems: "center" }} action={<Button variant="contained" size="small" startIcon={<AddRounded />} onClick={() => setCreating(true)} data-testid="create-dropdown">Create a dropdown</Button>}>
          Need a choice the employee form doesn't have yet (T-shirt size, cost centre type, transport route…)? Create a dropdown — it is added to the employee form, profile, Field reference and export, and its values grow with +.
        </Alert>
      )}
      <CreateDropdownDialog open={creating} onClose={() => setCreating(false)} onCreated={() => setTab(0)} />
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Lists you can add to (${myLists.length})`} data-testid="tab-lists" />
        {isSuper && <Tab label="Master data" data-testid="tab-masters" />}
        <Tab label={`All dropdowns (${visible.length})`} value={isSuper ? 2 : 1} data-testid="tab-all" />
      </Tabs>

      {tab === 0 && (
        myLists.length === 0 ? <Alert severity="info">None of the growable lists belong to your modules. Ask the Super Admin if you need a value added.</Alert> : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 1.5 }}>
            {myLists.map((k) => {
              const def = listDef(k, data);
              const cf = customAll.find((c) => c.key === k);
              const custom = data.settings?.custom_options?.[k] || [];
              const vals = listOptions(data, k);
              const where = usedBy[k] || [];
              return (
                <Card key={k} sx={{ p: 2 }} data-testid={`list-card-${k}`}>
                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>{def.label}{cf && <Chip size="small" label={cf.active === false ? "Custom · off" : "Custom"} color={cf.active === false ? "default" : "secondary"} sx={{ ml: 0.8, height: 18, fontSize: "0.55rem" }} />}</Typography>
                      {cf && <Typography sx={{ fontSize: "0.62rem", color: "text.secondary" }}>Field <code>employee.{cf.key}</code>{cf.required ? " · required" : " · optional"} · edited by {whoLabel(cf.editableBy)}</Typography>}
                      <Typography sx={{ fontSize: "0.66rem", color: "text.secondary" }}>Looked after by: {MODULE_OWNER[def.module] || def.module}{ownersOf(def.module).length ? ` (${ownersOf(def.module).join(", ")})` : ""} · and the Super Admin</Typography>
                    </Box>
                    <Stack spacing={0.5} sx={{ flexShrink: 0, alignItems: "flex-end" }}>
                      <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setAdding(k)} data-testid={`add-${k}`} disabled={cf?.active === false}>Add value</Button>
                      {cf && isSuper && <FormControlLabel sx={{ mr: 0 }} control={<Switch size="small" checked={cf.active !== false} onChange={(e) => { const r = setCustomFieldActive(k, e.target.checked); notifyToast(r.ok ? (e.target.checked ? `${cf.label} is back on the employee form.` : `${cf.label} is hidden from the employee form. Saved values are kept.`) : r.error, r.ok ? "success" : "error"); }} />} label={<Typography sx={{ fontSize: "0.6rem" }}>On the form</Typography>} />}
                    </Stack>
                  </Stack>
                  <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.6, mt: 1.2 }}>
                    {vals.map(([v, l]) => {
                      const mine = custom.includes(v);
                      return <Chip key={v} size="small" label={l} color={mine ? "success" : "default"} variant={mine ? "filled" : "outlined"} onDelete={mine ? () => { const r = removeListOption(k, v); notifyToast(r.ok ? `“${l}” removed from ${def.label}. Records that already use it keep it.` : r.error, r.ok ? "success" : "error"); } : undefined} />;
                    })}
                  </Stack>
                  <Typography sx={{ fontSize: "0.62rem", color: "text.secondary", mt: 1.2 }}>
                    <b>Used in:</b> {def.used}{where.length ? ` · ${where.length} dropdown${where.length > 1 ? "s" : ""}` : ""}{custom.length ? ` · ${custom.length} added on this account (green)` : ""}
                  </Typography>
                </Card>
              );
            })}
          </Box>
        )
      )}

      {isSuper && tab === 1 && (
        <SectionCard title="Lists kept as master data" subtitle="These dropdowns list records you create on their own screen. Add a department, location, leave type, holiday … there and it appears in every dropdown that lists them.">
          <TableWrap>
            <Table size="small">
              <TableHead><TableRow><TableCell>List</TableCell><TableCell align="right">Dropdowns using it</TableCell><TableCell align="right">Records now</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {Object.entries(INVENTORY.masters).filter(([id]) => masterUse[id]).map(([id, m]) => {
                  const n = { departments: data.orgUnits, companies: data.companies, locations: data.workLocations, geofences: data.geofences, leave_types: data.leaveTypes, expense_categories: data.expenseCategories, holidays: data.holidays, shifts: data.shifts?.list || data.shifts, vendors: data.vendors }[id];
                  return (
                    <TableRow key={id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{m.label}</TableCell>
                      <TableCell align="right">{masterUse[id]}</TableCell>
                      <TableCell align="right">{Array.isArray(n) ? n.length : "—"}</TableCell>
                      <TableCell align="right"><Button size="small" endIcon={<OpenInNewRounded sx={{ fontSize: 14 }} />} onClick={() => navigate(m.route)}>Open to add</Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      )}

      {tab === (isSuper ? 2 : 1) && (
        <SectionCard title="Every dropdown" subtitle="Find any dropdown, see where its choices come from, and add to it when it is a growable list." action={null}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ mb: 1.5 }}>
            <TextField size="small" placeholder="Search a screen or field…" value={q} onChange={(e) => setQ(e.target.value)} sx={{ flex: 1 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }, htmlInput: { "data-testid": "dd-search" } }} />
            <TextField select size="small" label="Choices come from" value={src} onChange={(e) => setSrc(e.target.value)} sx={{ minWidth: 190 }}>
              <MenuItem value="all">Anywhere</MenuItem>
              {Object.entries(SOURCE).map(([k, s]) => <MenuItem key={k} value={k}>{s.label}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Area" value={area} onChange={(e) => setArea(e.target.value)} sx={{ minWidth: 200 }}>
              <MenuItem value="all">All areas</MenuItem>
              {areas.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </TextField>
          </Stack>
          <Typography sx={{ fontSize: "0.66rem", color: "text.secondary", mb: 1 }}>{rows.length} of {visible.length} dropdowns</Typography>
          <TableWrap>
            <Table size="small" data-testid="dd-table">
              <TableHead><TableRow><TableCell>Area</TableCell><TableCell>Dropdown</TableCell><TableCell>Choices come from</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {rows.slice(0, 400).map((x, i) => {
                  const kind = x.source.split(":")[0];
                  const key = x.source.split(":")[1];
                  const s = SOURCE[kind] || SOURCE.fixed;
                  const name = kind === "list" ? OPTION_LISTS[key]?.label : kind === "master" ? INVENTORY.masters[key]?.label : null;
                  return (
                    <TableRow key={`${x.file}:${x.line}:${i}`} hover>
                      <TableCell sx={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>{x.area}</TableCell>
                      <TableCell sx={{ fontSize: "0.74rem", fontWeight: 600 }}>{x.label}{x.kind === "search" ? <Typography component="span" sx={{ fontSize: "0.6rem", color: "text.secondary" }}> · search box</Typography> : null}</TableCell>
                      <TableCell><Tooltip title={s.help}><Chip size="small" icon={s.icon} color={s.color} variant={kind === "list" ? "filled" : "outlined"} label={name ? `${s.label} · ${name}` : s.label} sx={{ fontSize: "0.62rem" }} /></Tooltip></TableCell>
                      <TableCell align="right">
                        {kind === "list" && OPTION_LISTS[key] && canEditList(user, data, key) && <Button size="small" startIcon={<AddRounded />} onClick={() => setAdding(key)}>Add value</Button>}
                        {kind === "master" && isSuper && INVENTORY.masters[key] && <Button size="small" endIcon={<OpenInNewRounded sx={{ fontSize: 14 }} />} onClick={() => navigate(INVENTORY.masters[key].route)}>Open</Button>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      )}
      {adding && <AddOptionDialog listKey={adding} open={!!adding} onClose={() => setAdding(null)} />}
    </>
  );
}

// v10.15: create a new dropdown (a custom employee field with its own list of values).
function CreateDropdownDialog({ open, onClose, onCreated }) {
  const { createCustomField, notifyToast } = useStore();
  const blank = { label: "", section: "core", options: "", required: false, editableBy: ["admin"], help: "" };
  const [d, setD] = useState(blank);
  const [err, setErr] = useState("");
  React.useEffect(() => { if (open) { setD(blank); setErr(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const who = (w) => (e) => setD({ ...d, editableBy: e.target.checked ? [...d.editableBy, w] : d.editableBy.filter((x) => x !== w) });
  const save = () => {
    const r = createCustomField(d);
    if (!r.ok) return setErr(r.error);
    notifyToast(`Dropdown “${r.label}” created. It is now on the employee form (${EMPLOYEE_SECTIONS.find((x) => x.id === d.section)?.title}).`);
    onCreated?.(); onClose();
  };
  const values = d.options.split(/\n|,/).map((v) => v.trim()).filter(Boolean);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Create a dropdown</DialogTitle>
      <DialogContent>
        <Stack spacing={1.6} sx={{ pt: 1 }} data-testid="create-dropdown-form">
          <TextField size="small" autoFocus label="Dropdown name *" placeholder="e.g. T-shirt size" value={d.label} onChange={(e) => { setD({ ...d, label: e.target.value }); setErr(""); }} slotProps={{ htmlInput: { "data-testid": "cd-label" } }} />
          <TextField select size="small" label="Show it in this part of the employee form *" value={d.section} onChange={(e) => setD({ ...d, section: e.target.value })}>
            {EMPLOYEE_SECTIONS.map((x) => <MenuItem key={x.id} value={x.id}>{x.title}</MenuItem>)}
          </TextField>
          <TextField size="small" multiline minRows={3} label="Values * (one per line, or separated by commas)" placeholder={"S\nM\nL\nXL"} value={d.options} onChange={(e) => { setD({ ...d, options: e.target.value }); setErr(""); }} slotProps={{ htmlInput: { "data-testid": "cd-values" } }} helperText={`${values.length} value${values.length === 1 ? "" : "s"} — you can add more later with +.`} />
          <TextField size="small" label="Help text (optional)" value={d.help} onChange={(e) => setD({ ...d, help: e.target.value })} helperText="Shown in the Field reference." />
          <Box>
            <Typography sx={{ fontSize: "0.66rem", fontWeight: 700 }}>Who can fill it in</Typography>
            <FormGroup row>
              <FormControlLabel control={<Checkbox size="small" checked disabled />} label={<Typography sx={{ fontSize: "0.7rem" }}>Super Admin</Typography>} />
              <FormControlLabel control={<Checkbox size="small" checked={d.editableBy.includes("admin")} onChange={who("admin")} />} label={<Typography sx={{ fontSize: "0.7rem" }}>HR admin</Typography>} />
              <FormControlLabel control={<Checkbox size="small" checked={d.editableBy.includes("self")} onChange={who("self")} data-testid="cd-self" />} label={<Typography sx={{ fontSize: "0.7rem" }}>The employee (on My profile)</Typography>} />
            </FormGroup>
            <FormControlLabel control={<Checkbox size="small" checked={d.required} onChange={(e) => setD({ ...d, required: e.target.checked })} data-testid="cd-required" />} label={<Typography sx={{ fontSize: "0.7rem" }}>Required — the employee form can't be saved without it</Typography>} />
          </Box>
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" startIcon={<AddRounded />} onClick={save} data-testid="cd-save">Create dropdown</Button>
      </DialogActions>
    </Dialog>
  );
}
