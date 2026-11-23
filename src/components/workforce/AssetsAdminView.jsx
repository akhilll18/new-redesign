// Asset management: inventory, assignments, repairs, warranty and book value, requests to fulfil.
import EntitySelect from "../kit/EntitySelect.jsx";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputAdornment, InputLabel, Menu, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, IconButton } from "@mui/material";
import { AddRounded, SearchRounded, MoreVertRounded, DownloadRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap, Mono, HBar } from "../kit/UI.jsx";
import { ASSET_ICON } from "../../pages/workforce/MyAssets.jsx";
import { ASSET_CATEGORIES } from "../../lib/requests.js";
import ListSelect from "../kit/ListSelect.jsx";
import { listOptions } from "../../lib/optionLists.js";
import { bookValue } from "../../lib/hrcalc.js";
import { fmtDate, fmtNum, isoDate, downloadCsv } from "../../lib/utils.js";

const STATUS = { in_stock: ["In stock", "info"], assigned: ["Assigned", "good"], repair: ["In repair", "warn"], retired: ["Retired", "neutral"], lost: ["Lost", "bad"] };

function AssetDialog({ asset, onClose }) {
  const { data, upsertAsset, notifyToast } = useStore();
  const [a, setA] = useState(asset || { category: "Laptop", model: "", serial: "", cost: "", purchase_date: isoDate(), warranty_end: isoDate(Date.now() + 365 * 86400000), location: "GF-HQ" });
  const [error, setError] = useState("");
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{asset ? `Edit ${asset.asset_id}` : "Add asset to stock"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={2}>
            <ListSelect listKey="asset_category" size="small" label="Category" required value={a.category} onChange={(v) => setA({ ...a, category: v })} disabled={!!asset} />
            <FormControl size="small" fullWidth>
              <InputLabel>Location</InputLabel>
              <Select label="Location" value={a.location || ""} onChange={(e) => setA({ ...a, location: e.target.value })}>
                {data.geofences.filter((g) => g.type !== "client").map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <EntitySelect value={a.company_id} onChange={(v) => setA((x) => ({ ...x, company_id: v }))} />
          <TextField label="Make and model *" value={a.model} onChange={(e) => setA({ ...a, model: e.target.value })} />
          <Stack direction="row" spacing={2}>
            <TextField label="Serial / IMEI *" value={a.serial} onChange={(e) => setA({ ...a, serial: e.target.value })} />
            <TextField label="Cost" value={a.cost} onChange={(e) => setA({ ...a, cost: e.target.value.replace(/\D/g, "") })} slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Purchased" type="date" value={a.purchase_date} onChange={(e) => setA({ ...a, purchase_date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Warranty until" type="date" value={a.warranty_end} onChange={(e) => setA({ ...a, warranty_end: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { const r = upsertAsset(a); if (!r.ok) return setError(r.error); notifyToast(asset ? "Asset updated." : "Asset added to stock."); onClose(); }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AssetsAdminView() {
  const { data, assignAsset, returnAsset, setAssetStatus, notifyToast } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [st, setSt] = useState("");
  const [edit, setEdit] = useState(null);
  const [menu, setMenu] = useState(null);
  const [assign, setAssign] = useState(null);
  const [assignTo, setAssignTo] = useState("");
  const [ret, setRet] = useState(null);
  const [cond, setCond] = useState("Good");
  const years = data.settings.asset_depreciation_years;
  const name = (c) => data.employees.find((e) => e.employee_code === c)?.full_name;
  const list = data.assets.filter((a) => (!cat || a.category === cat) && (!st || a.status === st) && (!q || [a.asset_id, a.model, a.serial, name(a.assigned_to)].join(" ").toLowerCase().includes(q.toLowerCase())));
  const toFulfil = data.requests.filter((r) => r.type === "asset" && r.status === "Approved");
  const warranty = data.assets.filter((a) => a.status !== "retired" && a.warranty_end && a.warranty_end <= isoDate(Date.now() + 60 * 86400000));
  const issues = data.assets.filter((a) => a.issue);
  const totalCost = data.assets.reduce((s, a) => s + a.cost, 0);
  const totalBook = data.assets.filter((a) => a.status !== "retired").reduce((s, a) => s + bookValue(a.cost, a.purchase_date, years), 0);
  const byCat = listOptions(data, "asset_category").map(([c]) => c).map((c) => ({ c, n: data.assets.filter((a) => a.category === c).length, used: data.assets.filter((a) => a.category === c && a.status === "assigned").length })).filter((x) => x.n);
  const actives = data.employees.filter((e) => e.status === "active");

  return (
    <Stack spacing={2.5}>
      <Grid min={160}>
        <StatCard label="Assets" value={data.assets.length} hint={`${data.assets.filter((a) => a.status === "assigned").length} assigned`} />
        <StatCard label="In stock" value={data.assets.filter((a) => a.status === "in_stock").length} tone="info" />
        <StatCard label="To assign" value={toFulfil.length} tone="warn" hint="Approved requests" onClick={() => navigate("/approvals?tab=payouts")} />
        <StatCard label="In repair / issues" value={`${data.assets.filter((a) => a.status === "repair").length} / ${issues.length}`} tone="bad" />
        <StatCard label="Book value" value={`₹${fmtNum(totalBook)}`} tone="good" hint={`Cost ₹${fmtNum(totalCost)} · ${years}-year straight line`} />
      </Grid>
      {(toFulfil.length > 0 || issues.length > 0 || warranty.length > 0) && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr 1fr" }, gap: 2.5 }}>
          <SectionCard title="Requests to fulfil" noPad>
            {toFulfil.length === 0 ? <Typography sx={{ p: 2, fontSize: "0.65rem", color: "#78827b" }}>None.</Typography> : toFulfil.map((r) => (
              <Stack key={r.request_id} direction="row" spacing={1} sx={{ px: 2, py: 1.1, borderBottom: "1px solid #f0f2ef", alignItems: "center" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{r.category} for {name(r.employee_code)}</Typography><Typography noWrap sx={{ fontSize: "0.6rem", color: "#78827b" }}><Mono>{r.request_id}</Mono> · by {fmtDate(r.needed_by)}</Typography></Box>
                <Button size="small" variant="contained" onClick={() => navigate(`/approvals?tab=payouts&req=${r.request_id}`)}>Assign</Button>
              </Stack>
            ))}
          </SectionCard>
          <SectionCard title="Problems reported" noPad>
            {issues.length === 0 ? <Typography sx={{ p: 2, fontSize: "0.65rem", color: "#78827b" }}>None.</Typography> : issues.map((a) => (
              <Box key={a.asset_id} sx={{ px: 2, py: 1.1, borderBottom: "1px solid #f0f2ef" }}><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{a.asset_id} · {name(a.assigned_to)}</Typography><Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{a.issue.text}</Typography></Box>
            ))}
          </SectionCard>
          <SectionCard title="Warranty ending in 60 days" noPad>
            {warranty.length === 0 ? <Typography sx={{ p: 2, fontSize: "0.65rem", color: "#78827b" }}>None.</Typography> : warranty.map((a) => (
              <Stack key={a.asset_id} direction="row" sx={{ px: 2, py: 1.1, borderBottom: "1px solid #f0f2ef", justifyContent: "space-between" }}><Typography sx={{ fontSize: "0.68rem" }}>{a.asset_id} · {a.model}</Typography><Tag tone={a.warranty_end < isoDate() ? "bad" : "warn"}>{fmtDate(a.warranty_end)}</Tag></Stack>
            ))}
          </SectionCard>
        </Box>
      )}
      <SectionCard
        title="Inventory"
        action={<Stack direction="row" spacing={1}><Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv("assets.csv", ["Asset", "Category", "Model", "Serial", "Status", "Assigned to", "Assigned on", "Cost", "Book value", "Purchased", "Warranty"], data.assets.map((a) => [a.asset_id, a.category, a.model, a.serial, a.status, name(a.assigned_to) || "", a.assigned_on || "", a.cost, bookValue(a.cost, a.purchase_date, years), a.purchase_date, a.warranty_end]))}>CSV</Button><Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setEdit({})}>Add asset</Button></Stack>}
        noPad
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ p: 1.5 }}>
          <TextField placeholder="Search ID, model, serial, person" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: { md: 280 } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
          <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
            <Chip size="small" label="All types" color={!cat ? "primary" : "default"} onClick={() => setCat("")} />
            {byCat.map((x) => <Chip key={x.c} size="small" label={`${x.c} (${x.n})`} color={cat === x.c ? "primary" : "default"} variant={cat === x.c ? "filled" : "outlined"} onClick={() => setCat(x.c)} />)}
          </Stack>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={st} onChange={(e) => setSt(e.target.value)}>
              <MenuItem value="">Any status</MenuItem>
              {Object.entries(STATUS).map(([k, [l]]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 980 }}>
            <TableHead><TableRow><TableCell>Asset</TableCell><TableCell>Status</TableCell><TableCell>Assigned to</TableCell><TableCell align="right">Cost</TableCell><TableCell align="right">Book value</TableCell><TableCell>Warranty</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {list.map((a) => (
                <TableRow key={a.asset_id}>
                  <TableCell>
                    <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
                      <Box sx={{ color: "#2e7d32", "& svg": { fontSize: 20 } }}>{ASSET_ICON[a.category] || ASSET_ICON.Other}</Box>
                      <Box><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{a.model}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}><Mono>{a.asset_id}</Mono> · {a.serial}</Typography></Box>
                    </Stack>
                  </TableCell>
                  <TableCell><Stack direction="row" spacing={0.5}><Tag tone={STATUS[a.status]?.[1]}>{STATUS[a.status]?.[0]}</Tag>{a.status === "assigned" && !a.acknowledged && <Tag tone="warn">Not confirmed</Tag>}{a.issue && <Tag tone="bad">Issue</Tag>}</Stack></TableCell>
                  <TableCell>{a.assigned_to ? <PersonCell name={name(a.assigned_to)} sub={`since ${fmtDate(a.assigned_on)}`} /> : "—"}</TableCell>
                  <TableCell align="right">₹{fmtNum(a.cost)}</TableCell>
                  <TableCell align="right">₹{fmtNum(bookValue(a.cost, a.purchase_date, years))}</TableCell>
                  <TableCell>{fmtDate(a.warranty_end)}</TableCell>
                  <TableCell align="right"><IconButton size="small" aria-label={`Actions for ${a.asset_id}`} onClick={(e) => setMenu({ el: e.currentTarget, a })}><MoreVertRounded fontSize="small" /></IconButton></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <SectionCard title="Utilisation by type">
        <Stack spacing={1.2}>{byCat.map((x) => <HBar key={x.c} label={x.c} value={x.used} max={x.n} right={`${x.used} of ${x.n} assigned`} />)}</Stack>
      </SectionCard>

      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        {menu?.a.status === "in_stock" && <MenuItem onClick={() => { setAssign(menu.a); setAssignTo(""); setMenu(null); }}>Assign to employee</MenuItem>}
        {menu?.a.status === "assigned" && <MenuItem onClick={() => { setRet(menu.a); setCond("Good"); setMenu(null); }}>Take back</MenuItem>}
        {menu?.a.status === "repair" && <MenuItem onClick={() => { const r = setAssetStatus(menu.a.asset_id, "in_stock"); notifyToast(r.ok ? "Back in stock." : r.error, r.ok ? "success" : "error"); setMenu(null); }}>Repaired, back to stock</MenuItem>}
        {menu?.a.status === "in_stock" && <MenuItem onClick={() => { setAssetStatus(menu.a.asset_id, "repair"); setMenu(null); }}>Send for repair</MenuItem>}
        {menu && !["assigned", "retired"].includes(menu.a.status) && <MenuItem onClick={() => { const r = setAssetStatus(menu.a.asset_id, "retired"); notifyToast(r.ok ? "Asset retired." : r.error, r.ok ? "success" : "error"); setMenu(null); }}>Retire</MenuItem>}
        <MenuItem onClick={() => { setEdit(menu.a); setMenu(null); }}>Edit details</MenuItem>
      </Menu>
      {edit && <AssetDialog asset={edit.asset_id ? edit : null} onClose={() => setEdit(null)} />}
      <Dialog open={!!assign} onClose={() => setAssign(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Assign {assign?.asset_id}</DialogTitle>
        <DialogContent>
          <FormControl size="small" fullWidth sx={{ mt: 1 }}>
            <InputLabel>Employee</InputLabel>
            <Select label="Employee" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              {actives.map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name} · {e.department}</MenuItem>)}
            </Select>
          </FormControl>
          <Typography sx={{ fontSize: "0.6rem", color: "#78827b", mt: 1 }}>The employee is asked to confirm receipt.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setAssign(null)}>Cancel</Button>
          <Button variant="contained" disabled={!assignTo} onClick={() => { const r = assignAsset(assign.asset_id, assignTo); notifyToast(r.ok ? `${assign.asset_id} assigned.` : r.error, r.ok ? "success" : "error"); setAssign(null); }}>Assign</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!ret} onClose={() => setRet(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Take back {ret?.asset_id}</DialogTitle>
        <DialogContent>
          <ListSelect listKey="asset_condition" size="small" blank={false} label="Condition" value={cond} onChange={(v) => setCond(v)} sx={{ mt: 1 }} />
          <Typography sx={{ fontSize: "0.6rem", color: "#78827b", mt: 1 }}>Good goes back to stock; anything else goes to repair.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setRet(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { const r = returnAsset(ret.asset_id, cond); notifyToast(r.ok ? `${ret.asset_id} returned.` : r.error, r.ok ? "success" : "error"); setRet(null); }}>Take back</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
