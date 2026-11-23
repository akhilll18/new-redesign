// Companies (legal entities) and their locations, staff per location, moving staff between locations, and which
// companies / locations each admin may see. Super Admin edits; admins with the accounts module can move staff.
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, ListItemText, MenuItem, OutlinedInput, Select, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { AddRounded, BusinessRounded, PlaceRounded, GroupsRounded, AdminPanelSettingsRounded, EditRounded, DownloadRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Mono, TableWrap, Tag, EmptyState } from "../../components/kit/UI.jsx";
import { COUNTRIES } from "../../data/employeeFields.js";
import { LOCATION_TYPES } from "../../data/entities.js";
import { downloadCsv, fmtNum } from "../../lib/utils.js";

const TYPE_LABEL = Object.fromEntries(LOCATION_TYPES);

function CompanyDialog({ rec, onClose }) {
  const { upsertCompany, notifyToast } = useStore();
  const [f, setF] = useState(rec || {});
  const [e, setE] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  if (!rec) return null;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{rec.isNew ? "Add company" : `Edit ${rec.short}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.6} sx={{ pt: 1 }}>
          {e && <Alert severity="error">{e}</Alert>}
          <Stack direction="row" spacing={1.5}>
            <TextField label="Company code *" value={f.company_id || ""} disabled={!rec.isNew} onChange={(ev) => set("company_id", ev.target.value.toUpperCase())} helperText="e.g. ONAS-IN" sx={{ width: 180 }} />
            <TextField label="Short name" value={f.short || ""} onChange={(ev) => set("short", ev.target.value)} fullWidth helperText="Shown in the header picker" />
          </Stack>
          <TextField label="Registered name *" value={f.name || ""} onChange={(ev) => set("name", ev.target.value)} />
          <Stack direction="row" spacing={1.5}>
            <TextField select label="Country *" value={f.country || ""} onChange={(ev) => { set("country", ev.target.value); set("currency", COUNTRIES.find((c) => c.code === ev.target.value)?.currency || f.currency); }} fullWidth>
              {COUNTRIES.map((c) => <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>)}
            </TextField>
            <TextField label="Currency" value={f.currency || ""} onChange={(ev) => set("currency", ev.target.value.toUpperCase())} sx={{ width: 120 }} />
          </Stack>
          <TextField label="Registration number" value={f.registration || ""} onChange={(ev) => set("registration", ev.target.value)} />
          <TextField label="Tax IDs" value={f.tax_id || ""} onChange={(ev) => set("tax_id", ev.target.value)} helperText="PAN / TAN, VAT, EIN …" />
          <TextField label="Registered address" value={f.address || ""} onChange={(ev) => set("address", ev.target.value)} />
          <TextField select label="Status" value={f.status || "active"} onChange={(ev) => set("status", ev.target.value)}>
            <MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive (hidden from new records)</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { const r = upsertCompany(f); if (!r.ok) return setE(r.error); notifyToast(`Company ${r.id} saved.`); onClose(); }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function LocationDialog({ rec, onClose }) {
  const { allData, upsertLocation, notifyToast } = useStore();
  const [f, setF] = useState(rec || {});
  const [e, setE] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  if (!rec) return null;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{rec.isNew ? "Add location" : `Edit ${rec.name}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.6} sx={{ pt: 1 }}>
          {e && <Alert severity="error">{e}</Alert>}
          <Stack direction="row" spacing={1.5}>
            <TextField label="Location code *" value={f.location_id || ""} disabled={!rec.isNew} onChange={(ev) => set("location_id", ev.target.value.toUpperCase())} helperText="e.g. IN-BLR-01" sx={{ width: 180 }} />
            <TextField label="Name *" value={f.name || ""} onChange={(ev) => set("name", ev.target.value)} fullWidth />
          </Stack>
          <TextField select label="Company *" value={f.company_id || ""} onChange={(ev) => set("company_id", ev.target.value)} helperText={!rec.isNew ? "Moving a location to another company moves its staff with it." : " "}>
            {(allData.companies || []).map((c) => <MenuItem key={c.company_id} value={c.company_id}>{c.short} · {c.name}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={1.5}>
            <TextField select label="Country" value={f.country || ""} onChange={(ev) => set("country", ev.target.value)} fullWidth>
              {COUNTRIES.map((c) => <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>)}
            </TextField>
            <TextField label="City" value={f.city || ""} onChange={(ev) => set("city", ev.target.value)} fullWidth />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <TextField select label="Type" value={f.type || "office"} onChange={(ev) => set("type", ev.target.value)} fullWidth>
              {LOCATION_TYPES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </TextField>
            <TextField label="Cost centre" value={f.cost_centre || ""} onChange={(ev) => set("cost_centre", ev.target.value)} fullWidth helperText="Used when expenses are posted" />
          </Stack>
          <TextField select label="Geofence (attendance)" value={f.geofence_id || ""} onChange={(ev) => set("geofence_id", ev.target.value)}>
            <MenuItem value="">None</MenuItem>
            {(allData.geofences || []).map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
          </TextField>
          <TextField select label="Status" value={f.status || "active"} onChange={(ev) => set("status", ev.target.value)}>
            <MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { const r = upsertLocation(f); if (!r.ok) return setE(r.error); notifyToast(`Location ${r.id} saved.`); onClose(); }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function MoveDialog({ open, onClose, codes }) {
  const { allData, assignEmployeesToLocation, notifyToast } = useStore();
  const [loc, setLoc] = useState("");
  const [e, setE] = useState("");
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Move {codes.length} employee(s)</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          {e && <Alert severity="error">{e}</Alert>}
          <TextField select label="New location" value={loc} onChange={(ev) => setLoc(ev.target.value)}>
            {(allData.companies || []).map((c) => [
              <MenuItem key={`h-${c.company_id}`} disabled sx={{ fontSize: "0.6rem", fontWeight: 800, opacity: "1 !important" }}>{c.short}</MenuItem>,
              ...(allData.workLocations || []).filter((l) => l.company_id === c.company_id && l.status !== "inactive").map((l) => <MenuItem key={l.location_id} value={l.location_id} sx={{ pl: 3 }}>{l.name}</MenuItem>),
            ])}
          </TextField>
          <Alert severity="info">The company changes with the location. Payroll entity, approvals scope and expense booking follow from the next transaction.</Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { const r = assignEmployeesToLocation(codes, loc); if (!r.ok) return setE(r.error); notifyToast(`${r.n} employee(s) moved.`); onClose(true); }}>Move</Button>
      </DialogActions>
    </Dialog>
  );
}

function AdminAccess() {
  const { allData, setAdminEntityAccess, notifyToast } = useStore();
  const companies = allData.companies || [];
  const locations = allData.workLocations || [];
  return (
    <TableWrap>
      <Table size="small" sx={{ minWidth: 760 }}>
        <TableHead><TableRow><TableCell>Admin</TableCell><TableCell>Modules</TableCell><TableCell sx={{ width: 260 }}>Companies</TableCell><TableCell sx={{ width: 280 }}>Locations</TableCell></TableRow></TableHead>
        <TableBody>
          {allData.admins.map((a) => {
            const cs = a.entity_companies || [];
            const ls = a.entity_locations || [];
            const lsOptions = locations.filter((l) => !cs.length || cs.includes(l.company_id));
            const save = (nc, nl) => { const r = setAdminEntityAccess(a.admin_code, nc, nl.filter((x) => !nc.length || nc.includes(locations.find((l) => l.location_id === x)?.company_id))); if (r.ok) notifyToast(`${a.full_name}: access updated.`); };
            return (
              <TableRow key={a.admin_code}>
                <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{a.full_name}</Typography><Mono>{a.admin_code}</Mono> {a.status !== "active" && <Tag tone="warn">{a.status}</Tag>}</TableCell>
                <TableCell sx={{ maxWidth: 220 }}><Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{(a.modules || []).join(", ")}</Typography></TableCell>
                <TableCell>
                  <FormControl size="small" fullWidth>
                    <Select multiple displayEmpty value={cs} input={<OutlinedInput />} onChange={(ev) => save(ev.target.value, ls)} renderValue={(v) => (v.length ? v.map((x) => companies.find((c) => c.company_id === x)?.short || x).join(", ") : <em style={{ color: "#78827b" }}>All companies</em>)}>
                      {companies.map((c) => <MenuItem key={c.company_id} value={c.company_id}><Checkbox size="small" checked={cs.includes(c.company_id)} /><ListItemText primary={c.short} secondary={c.name} /></MenuItem>)}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <FormControl size="small" fullWidth>
                    <Select multiple displayEmpty value={ls} input={<OutlinedInput />} onChange={(ev) => save(cs, ev.target.value)} renderValue={(v) => (v.length ? `${v.length} location(s)` : <em style={{ color: "#78827b" }}>All locations{cs.length ? " of those companies" : ""}</em>)}>
                      {lsOptions.map((l) => <MenuItem key={l.location_id} value={l.location_id}><Checkbox size="small" checked={ls.includes(l.location_id)} /><ListItemText primary={l.name} secondary={companies.find((c) => c.company_id === l.company_id)?.short} /></MenuItem>)}
                    </Select>
                  </FormControl>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableWrap>
  );
}

export default function CompaniesLocations() {
  const { user, data, allData } = useStore();
  const isSuper = user.role === "superadmin";
  const canMove = isSuper || user.modules?.includes("accounts");
  const [tab, setTab] = useState("companies");
  const [editC, setEditC] = useState(null);
  const [editL, setEditL] = useState(null);
  const [picked, setPicked] = useState([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [locFilter, setLocFilter] = useState("");
  // The page lists what is in the header scope.
  const inScopeLoc = (l) => !data.scoped || data.scoped.locations.has(l.location_id);
  const companies = (allData.companies || []).filter((c) => !data.scoped || data.scoped.companies.has(c.company_id));
  const locations = (allData.workLocations || []).filter(inScopeLoc);
  const active = data.employees.filter((e) => e.status === "active");
  const headcount = (pred) => active.filter(pred).length;
  const payroll = (pred) => active.filter(pred).reduce((s, e) => s + Number(e.monthly_gross || 0) * ((allData.fx || {})[(COUNTRIES.find((c) => c.code === e.country_code) || {}).currency] ?? 1), 0);
  const unassigned = data.employees.filter((e) => !e.location_id || !(allData.workLocations || []).some((l) => l.location_id === e.location_id));
  const staff = useMemo(() => data.employees.filter((e) => e.status !== "rejected" && (!locFilter || e.location_id === locFilter)), [data.employees, locFilter]);
  const cName = (id) => (allData.companies || []).find((c) => c.company_id === id)?.short || id || "—";
  const lName = (id) => (allData.workLocations || []).find((l) => l.location_id === id)?.name || id || "—";

  return (
    <>
      <PageHeader eyebrow={`CORE HR · ENTITIES${isSuper ? " · SUPER ADMIN" : ""}`} title="Companies & locations" subtitle="Legal entities and their offices, branches and warehouses. Every employee belongs to one company and location; the picker in the header narrows the whole application to them."
        actions={isSuper && <><Button variant="outlined" startIcon={<AddRounded />} onClick={() => setEditL({ isNew: true, company_id: companies[0]?.company_id, type: "office", status: "active" })}>Add location</Button><Button variant="contained" startIcon={<AddRounded />} onClick={() => setEditC({ isNew: true, country: "IN", currency: "INR", status: "active" })}>Add company</Button></>} />
      <Stack spacing={2.5}>
        <Grid min={190}>
          <StatCard label="Companies" value={companies.length} icon={<BusinessRounded />} />
          <StatCard label="Locations" value={locations.length} icon={<PlaceRounded />} tone="info" />
          <StatCard label="Active staff in scope" value={active.length} icon={<GroupsRounded />} tone="good" />
          <StatCard label="Without a location" value={unassigned.length} tone={unassigned.length ? "warn" : "good"} hint={unassigned.length ? "Assign them under Staff" : "Everyone is assigned"} />
        </Grid>
        <SectionCard noPad>
          <Box sx={{ px: 1.5, pt: 1, borderBottom: "1px solid #edf0ec" }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
              <Tab value="companies" label={`Companies (${companies.length})`} sx={{ minHeight: 44, fontSize: "0.7rem" }} />
              <Tab value="locations" label={`Locations (${locations.length})`} sx={{ minHeight: 44, fontSize: "0.7rem" }} />
              <Tab value="staff" label={`Staff by location (${staff.length})`} sx={{ minHeight: 44, fontSize: "0.7rem" }} />
              {isSuper && <Tab value="access" label="Admin access" icon={<AdminPanelSettingsRounded sx={{ fontSize: 16 }} />} iconPosition="start" sx={{ minHeight: 44, fontSize: "0.7rem" }} />}
            </Tabs>
          </Box>
          {tab === "companies" && (
            <TableWrap>
              <Table size="small" sx={{ minWidth: 860 }}>
                <TableHead><TableRow><TableCell>Company</TableCell><TableCell>Country</TableCell><TableCell>Registration · tax</TableCell><TableCell align="right">Locations</TableCell><TableCell align="right">Staff</TableCell><TableCell align="right">Monthly payroll (₹)</TableCell><TableCell>Status</TableCell>{isSuper && <TableCell />}</TableRow></TableHead>
                <TableBody>
                  {companies.map((c) => (
                    <TableRow key={c.company_id} hover>
                      <TableCell><Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{c.short}</Typography><Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{c.name} · <Mono>{c.company_id}</Mono></Typography></TableCell>
                      <TableCell>{COUNTRIES.find((x) => x.code === c.country)?.name || c.country} · {c.currency}</TableCell>
                      <TableCell sx={{ maxWidth: 240 }}><Typography sx={{ fontSize: "0.6rem" }} noWrap>{c.registration}</Typography><Typography sx={{ fontSize: "0.6rem", color: "#78827b" }} noWrap>{c.tax_id}</Typography></TableCell>
                      <TableCell align="right">{locations.filter((l) => l.company_id === c.company_id).length}</TableCell>
                      <TableCell align="right">{headcount((e) => e.company_id === c.company_id)}</TableCell>
                      <TableCell align="right">{fmtNum(Math.round(payroll((e) => e.company_id === c.company_id)))}</TableCell>
                      <TableCell><Tag tone={c.status === "active" ? "good" : "neutral"}>{c.status}</Tag></TableCell>
                      {isSuper && <TableCell><Button size="small" startIcon={<EditRounded />} onClick={() => setEditC({ ...c })}>Edit</Button></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
          {tab === "locations" && (
            <TableWrap>
              <Table size="small" sx={{ minWidth: 860 }}>
                <TableHead><TableRow><TableCell>Location</TableCell><TableCell>Company</TableCell><TableCell>Type</TableCell><TableCell>City</TableCell><TableCell>Cost centre</TableCell><TableCell>Geofence</TableCell><TableCell align="right">Staff</TableCell><TableCell>Status</TableCell>{isSuper && <TableCell />}</TableRow></TableHead>
                <TableBody>
                  {locations.map((l) => (
                    <TableRow key={l.location_id} hover>
                      <TableCell><Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{l.name}</Typography><Mono>{l.location_id}</Mono></TableCell>
                      <TableCell>{cName(l.company_id)}</TableCell>
                      <TableCell>{TYPE_LABEL[l.type] || l.type}</TableCell>
                      <TableCell>{l.city} · {l.country}</TableCell>
                      <TableCell><Mono>{l.cost_centre || "—"}</Mono></TableCell>
                      <TableCell>{(allData.geofences || []).find((g) => g.id === l.geofence_id)?.name || "—"}</TableCell>
                      <TableCell align="right"><Button size="small" onClick={() => { setLocFilter(l.location_id); setTab("staff"); }}>{headcount((e) => e.location_id === l.location_id)}</Button></TableCell>
                      <TableCell><Tag tone={l.status === "active" ? "good" : "neutral"}>{l.status}</Tag></TableCell>
                      {isSuper && <TableCell><Button size="small" startIcon={<EditRounded />} onClick={() => setEditL({ ...l })}>Edit</Button></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
          {tab === "staff" && (
            <>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ p: 1.5, alignItems: { sm: "center" } }}>
                <TextField select size="small" label="Location" value={locFilter} onChange={(ev) => { setLocFilter(ev.target.value); setPicked([]); }} sx={{ minWidth: 260 }}>
                  <MenuItem value="">All locations in scope</MenuItem>
                  {locations.map((l) => <MenuItem key={l.location_id} value={l.location_id}>{l.name} · {cName(l.company_id)}</MenuItem>)}
                </TextField>
                <Box sx={{ flex: 1 }} />
                <Button size="small" startIcon={<DownloadRounded />} onClick={() => downloadCsv("staff-by-location.csv", ["employee_code", "name", "department", "company", "location", "city", "country", "status"], staff.map((e) => [e.employee_code, e.full_name, e.department, cName(e.company_id), lName(e.location_id), e.city, e.country_code, e.status]))}>Export CSV</Button>
                {canMove && <Button size="small" variant="contained" disabled={!picked.length} onClick={() => setMoveOpen(true)}>Move {picked.length || ""} to…</Button>}
              </Stack>
              {staff.length === 0 ? <EmptyState title="No staff here" text="Nobody is assigned to this location yet." /> : (
                <TableWrap>
                  <Table size="small" sx={{ minWidth: 760 }}>
                    <TableHead><TableRow>{canMove && <TableCell padding="checkbox"><Checkbox size="small" checked={picked.length === staff.length} indeterminate={picked.length > 0 && picked.length < staff.length} onChange={(ev) => setPicked(ev.target.checked ? staff.map((e) => e.employee_code) : [])} /></TableCell>}<TableCell>Employee</TableCell><TableCell>Department</TableCell><TableCell>Company</TableCell><TableCell>Location</TableCell><TableCell>Worker type</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                    <TableBody>
                      {staff.map((e) => (
                        <TableRow key={e.employee_code} hover>
                          {canMove && <TableCell padding="checkbox"><Checkbox size="small" checked={picked.includes(e.employee_code)} onChange={(ev) => setPicked((p) => (ev.target.checked ? [...p, e.employee_code] : p.filter((x) => x !== e.employee_code)))} /></TableCell>}
                          <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 600 }}>{e.full_name}</Typography><Mono>{e.employee_code}</Mono></TableCell>
                          <TableCell>{e.department}</TableCell>
                          <TableCell>{cName(e.company_id)}</TableCell>
                          <TableCell>{lName(e.location_id)}</TableCell>
                          <TableCell><Chip size="small" label={e.worker_type || "permanent"} sx={{ fontSize: "0.58rem", height: 20 }} /></TableCell>
                          <TableCell><Tag tone={e.status === "active" ? "good" : "warn"}>{e.status}</Tag></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrap>
              )}
            </>
          )}
          {tab === "access" && isSuper && (
            <Box sx={{ p: 1.5 }}>
              <Alert severity="info" sx={{ mb: 1.5 }}>Limit an admin to some companies or locations. They then see only those people, approvals, attendance, payroll, expenses and reports, and the header picker offers only those. Leave both empty for full access.</Alert>
              <AdminAccess />
            </Box>
          )}
        </SectionCard>
      </Stack>
      <CompanyDialog key={editC ? `c-${editC.company_id || "new"}` : "c"} rec={editC} onClose={() => setEditC(null)} />
      <LocationDialog key={editL ? `l-${editL.location_id || "new"}` : "l"} rec={editL} onClose={() => setEditL(null)} />
      <MoveDialog open={moveOpen} codes={picked} onClose={(done) => { setMoveOpen(false); if (done) setPicked([]); }} />
    </>
  );
}
