// Report centre (v8.8): granular, row-level reports for HR admins, Finance admins and the Super Admin.
// Pick a report, set the period and filters (department, location, country, worker type, status, free text), group by any
// dimension with counts and subtotals, drill into a group, choose and sort columns, and export or print exactly what is shown.
// Admins only see employees in their org-unit scope and only the reports their modules allow.
import React, { useMemo, useState } from "react";
import { COUNTRIES } from "../../data/employeeFields.js";
import { useCountry, useCountryFilter } from "../../country/CountryContext.jsx";
import { useSearchParams } from "react-router-dom";
import {
  Box, Button, Checkbox, Chip, FormControl, FormControlLabel, InputAdornment, InputLabel, List, ListItemButton, ListItemText, ListSubheader, MenuItem, Popover, Select, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, TextField, Tooltip, Typography,
} from "@mui/material";
import { DownloadRounded, PrintRounded, SearchRounded, ViewColumnRounded, CloseRounded, FilterAltOffRounded, EventAvailableRounded, BeachAccessRounded, GroupsRounded, PaymentsRounded, QueryStatsRounded, BuildRounded, GridViewRounded, ViewListRounded, WorkRounded, EmojiEventsRounded, ReceiptLongRounded, AssignmentTurnedInRounded, ShieldRounded, BadgeRounded, AccessTimeRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, TableWrap, EmptyState } from "../kit/UI.jsx";
import { REPORT_GROUPS, reportsFor, runReport, adminKind } from "../../lib/reports.js";
import { downloadCsv, fmtDate, fmtDateTime, isoDate } from "../../lib/utils.js";
import { fmtHrs } from "../../lib/hrcalc.js";

const MAX_ROWS = 400;
const NUMERIC = ["num", "money", "hours"];
const DIMS = [["legal_entity", "Legal entity"], ["department", "Department"], ["location", "Location"], ["country", "Country"], ["worker_type", "Worker type"], ["_month", "Month"], ["_status", "Status"], ["employee", "Employee"]];

function periodPreset(id) {
  const t = new Date();
  const y = t.getFullYear();
  const m = t.getMonth();
  const d = (yy, mm, dd) => isoDate(new Date(yy, mm, dd, 12));
  const fyStart = m >= 3 ? y : y - 1;
  const q = Math.floor(m / 3);
  return {
    month: [d(y, m, 1), isoDate()],
    last_month: [d(y, m - 1, 1), d(y, m, 0)],
    quarter: [d(y, q * 3, 1), isoDate()],
    last30: [isoDate(Date.now() - 29 * 86400000), isoDate()],
    fy: [d(fyStart, 3, 1), isoDate()],
    last_fy: [d(fyStart - 1, 3, 1), d(fyStart, 2, 31)],
    year: [d(y, 0, 1), isoDate()],
  }[id];
}
const PERIODS = [["month", "This month"], ["last_month", "Last month"], ["last30", "Last 30 days"], ["quarter", "This quarter"], ["fy", "This financial year"], ["last_fy", "Last financial year"], ["year", "Calendar year to date"], ["custom", "Custom"]];

const fmtCell = (v, t) => {
  if (v === null || v === undefined || v === "") return "—";
  if (t === "money") return (Number(v) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (t === "hours") return fmtHrs(v);
  if (t === "num") return Number.isInteger(Number(v)) ? String(v) : (Number(v) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (t === "date") return fmtDate(v);
  if (t === "datetime") return fmtDateTime(v);
  return String(v);
};
const csvCell = (v, t) => (v === null || v === undefined ? "" : t === "hours" ? (Number(v) || 0).toFixed(2) : t === "date" ? String(v).slice(0, 10) : v);

const TILE = {
  "Workforce": [GroupsRounded, "#E3F2FD", "#1565C0"],
  "Time & attendance": [EventAvailableRounded, "#E0F7F4", "#0B8C8C"],
  "Leave": [BeachAccessRounded, "#FFF3E0", "#E65100"],
  "Hiring & onboarding": [WorkRounded, "#EDE7F6", "#5E35B1"],
  "Talent": [EmojiEventsRounded, "#FFF8E1", "#F9A825"],
  "Contract workforce": [AssignmentTurnedInRounded, "#E8EAF6", "#3949AB"],
  "Payroll & payslips": [PaymentsRounded, "#E8F5E9", "#2E7D32"],
  "Expenses & loans": [ReceiptLongRounded, "#FCE4EC", "#C2185B"],
  "Benefits & assets": [BadgeRounded, "#F3E5F5", "#8E24AA"],
  "System & audit": [ShieldRounded, "#ECEFF1", "#455A64"],
  build: [BuildRounded, "#17404D", "#2EE6B5"],
};
const GALLERY_ICON = { calendar: AccessTimeRounded, leave: BeachAccessRounded, beach: BeachAccessRounded, people: GroupsRounded, money: PaymentsRounded };
function ReportTile({ r, onClick }) {
  const [Icon0, bg, fg] = TILE[r.group] || [QueryStatsRounded, "#EEF2F3", "#17404D"];
  const Icon = (r.gallery && GALLERY_ICON[r.gallery]) || Icon0;
  return (
    <Box role="button" onClick={onClick} sx={{ cursor: "pointer", borderRadius: 2, overflow: "hidden", border: "1px solid #e1e7ea", background: "#fff", transition: "transform .12s, box-shadow .12s", "&:hover": { transform: "translateY(-2px)", boxShadow: "0 8px 20px rgba(23,64,77,.12)" } }}>
      <Box sx={{ height: 92, display: "grid", placeItems: "center", background: bg, position: "relative" }}>
        <Box sx={{ width: 56, height: 56, borderRadius: "50%", display: "grid", placeItems: "center", background: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,.08)" }}><Icon sx={{ fontSize: 30, color: fg }} /></Box>
        {r.gallery && <Box sx={{ position: "absolute", top: 8, right: 8, px: 0.8, py: 0.1, borderRadius: 1, background: fg, color: "#fff", fontSize: "0.5rem", fontWeight: 800 }}>NEW</Box>}
      </Box>
      <Box sx={{ p: 1.4 }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#17404D", lineHeight: 1.25 }}>{r.name}</Typography>
        <Typography sx={{ fontSize: "0.6rem", color: "#6c7a7f", mt: 0.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.desc}</Typography>
      </Box>
    </Box>
  );
}

export default function ReportCentre() {
  const { data, user, scopeUnits, nameOf } = useStore();
  const [sp, setSp] = useSearchParams();
  const available = useMemo(() => reportsFor(user), [user]);
  const [q, setQ] = useState("");
  const def = available.find((r) => r.id === sp.get("r")) || available[0];
  const kind = adminKind(user);
  // Reports follow the country (or region) chosen in the header.
  const inCountry = useCountryFilter();
  const { country: hdrCountry, region: hdrRegion } = useCountry();
  const scoped = useMemo(() => {
    if (user.role === "superadmin") return data.employees.filter(inCountry);
    const units = scopeUnits(user);
    return data.employees.filter((e) => units.has(e.department) && inCountry(e));
  }, [data.employees, user, scopeUnits, inCountry]);
  const title = kind === "super" ? "Reports" : kind === "finance" ? "Finance reports" : kind === "hr" ? "HR reports" : "HR & Finance reports";
  const where = hdrCountry ? ` · ${(COUNTRIES.find((c) => c.code === hdrCountry)?.name || hdrCountry).toUpperCase()}` : hdrRegion ? ` · REGION ${hdrRegion}` : "";
  const eyebrow = kind === "super" ? `SUPER ADMIN · ALL REPORTS${where || " · ALL COUNTRIES"}` : `${kind === "finance" ? "FINANCE" : "HR"} ADMIN · REPORTS · SCOPE ${(user.org_units || []).join(", ").toUpperCase()}${where}`;
  const list = available.filter((r) => !q || `${r.name} ${r.desc} ${r.group}`.toLowerCase().includes(q.toLowerCase()));
  // v10.5: report gallery (tiles) — the default view until a report is opened.
  const view = sp.get("view") || (sp.get("r") ? "list" : "gallery");
  const open = (id) => setSp(id ? { r: id } : { view: "list" }, { replace: true });
  if (view === "gallery") return (
    <>
      <PageHeader title={title} subtitle={`${available.length} reports for your role. Pick a tile to open it; every report can be filtered, grouped, drilled into and exported.`} actions={<Button variant="outlined" startIcon={<ViewListRounded />} onClick={() => open(null)}>List view</Button>} />
      <TextField size="small" placeholder="Find a report" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 2, width: 320, background: "#fff" }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 16 }} /></InputAdornment> } }} />
      {REPORT_GROUPS.filter((g) => list.some((r) => r.group === g)).map((g) => (
        <Box key={g} sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", color: "#78827b", mb: 1 }}>{g.toUpperCase()}</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 1.6 }}>
            {list.filter((r) => r.group === g).map((r) => <ReportTile key={r.id} r={r} onClick={() => open(r.id)} />)}
          </Box>
        </Box>
      ))}
      {!q && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 1.6 }}>
          <ReportTile r={{ id: "build", name: "Build your own report", desc: "Open any report, pick columns, filter, group and drill down — then export to CSV.", group: "build" }} onClick={() => open(available[0]?.id)} />
        </Box>
      )}
    </>
  );
  return (
    <>
      <Button size="small" startIcon={<GridViewRounded />} onClick={() => setSp({ view: "gallery" }, { replace: true })} sx={{ mb: 1 }}>Report gallery</Button>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={`${available.length} granular reports for your role. Every report is row-level: filter by period, department, location, country, worker type and status; group with subtotals and drill down; choose columns; export to Excel (CSV) or print.`} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "260px minmax(0,1fr)" }, gap: 2.5, alignItems: "start" }}>
        <SectionCard noPad sx={{ position: { lg: "sticky" }, top: { lg: 76 } }}>
          <Box sx={{ p: 1.2 }}><TextField size="small" fullWidth placeholder="Find a report" value={q} onChange={(e) => setQ(e.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} /></Box>
          <List dense sx={{ maxHeight: { lg: "calc(100vh - 200px)" }, overflow: "auto", py: 0 }}>
            {REPORT_GROUPS.filter((g) => list.some((r) => r.group === g)).map((g) => [
              <ListSubheader key={g} sx={{ fontSize: "0.56rem", fontWeight: 800, letterSpacing: "0.08em", lineHeight: "28px", color: "#78827b", background: "#fafbf9" }}>{g.toUpperCase()}</ListSubheader>,
              ...list.filter((r) => r.group === g).map((r) => (
                <ListItemButton key={r.id} selected={r.id === def?.id} onClick={() => setSp({ r: r.id }, { replace: true })} sx={{ py: 0.4 }}>
                  <ListItemText primary={r.name} slotProps={{ primary: { sx: { fontSize: "0.68rem", fontWeight: r.id === def?.id ? 700 : 500 } } }} />
                </ListItemButton>
              )),
            ])}
          </List>
        </SectionCard>
        {def ? <ReportView key={def.id} def={def} emps={scoped} data={data} nameOf={nameOf} /> : <SectionCard><EmptyState title="No reports for your role" text="Ask the Super Admin to assign HR or Finance modules." /></SectionCard>}
      </Box>
    </>
  );
}

function ReportView({ def, emps, data, nameOf }) {
  const hdrCountryFixed = !!useCountry().country;
  const [period, setPeriod] = useState("fy");
  const [range, setRange] = useState(() => periodPreset("fy"));
  const [f, setF] = useState({ legal_entity: "", department: "", location: "", country: "", worker_type: "", _status: "", text: "" });
  const [drill, setDrill] = useState([]); // [[key, value, label]]
  const [groupBy, setGroupBy] = useState("");
  const [sort, setSort] = useState({ k: null, dir: "asc" });
  const [hidden, setHidden] = useState(() => new Set());
  const [colAnchor, setColAnchor] = useState(null);
  const [from, to] = range;
  const empBy = useMemo(() => Object.fromEntries(data.employees.map((e) => [e.employee_code, e])), [data.employees]);
  const scopeBy = useMemo(() => Object.fromEntries(emps.map((e) => [e.employee_code, e])), [emps]);
  const base = useMemo(() => {
    const rows = runReport(def, { data, emps, empBy: scopeBy, nameOf, from, to });
    // Rows tied to an employee outside the admin's scope are left out.
    return rows.filter((r) => !r._emp || scopeBy[r._emp.employee_code] || !empBy[r._emp.employee_code]);
  }, [def, data, emps, scopeBy, empBy, nameOf, from, to]);
  // v10.14: a "Legal entity" column on every report whose rows belong to an entity
  const columns = useMemo(() => {
    if (def.columns.some((c) => c.k === "legal_entity") || !base.some((r) => r.legal_entity)) return def.columns;
    const at = def.columns.findIndex((c) => c.k === "employee");
    const le = { k: "legal_entity", l: "Legal entity", t: "text" };
    return at >= 0 ? [...def.columns.slice(0, at + 1), le, ...def.columns.slice(at + 1)] : [le, ...def.columns];
  }, [def.columns, base]);
  const cols = columns.filter((c) => !hidden.has(c.k));
  const opts = (k) => [...new Set(base.map((r) => r[k]).filter((v) => v !== "" && v != null))].sort();
  const rows = useMemo(() => {
    let out = base.filter((r) => ["legal_entity", "department", "location", "country", "worker_type", "_status"].every((k) => !f[k] || String(r[k]) === f[k]) && drill.every(([k, v]) => String(r[k] ?? "") === v));
    if (f.text) { const t = f.text.toLowerCase(); out = out.filter((r) => columns.some((c) => String(r[c.k] ?? "").toLowerCase().includes(t))); }
    if (sort.k) {
      const c = columns.find((x) => x.k === sort.k);
      const num = NUMERIC.includes(c?.t);
      out = [...out].sort((a, b) => { const x = a[sort.k]; const y = b[sort.k]; const cmp = num ? (Number(x) || 0) - (Number(y) || 0) : String(x ?? "").localeCompare(String(y ?? "")); return sort.dir === "asc" ? cmp : -cmp; });
    }
    return out;
  }, [base, f, drill, sort, columns]);
  // v10.6: count people, not rows — "Employees" when every row is a person, otherwise "Records".
  const empCount = rows.length && rows.every((r) => r._emp) ? new Set(rows.map((r) => r._emp.employee_code)).size : null;
  const numCols = cols.filter((c) => NUMERIC.includes(c.t) && !/rating|pct|%|tenure|avg|weight|progress|goals|competencies|values|weighted|potential|rate/i.test(`${c.k} ${c.l}`));
  const sums = Object.fromEntries(numCols.map((c) => [c.k, rows.reduce((s, r) => s + (Number(r[c.k]) || 0), 0)]));
  const groupOptions = [...DIMS.filter(([k]) => base.some((r) => r[k])), ...columns.filter((c) => c.t === "text" && !DIMS.some(([k]) => k === c.k) && !["employee_code", "id"].includes(c.k)).map((c) => [c.k, c.l])];
  const groups = useMemo(() => {
    if (!groupBy) return null;
    const m = new Map();
    rows.forEach((r) => { const v = String(r[groupBy] ?? "") || "(blank)"; if (!m.has(v)) m.set(v, []); m.get(v).push(r); });
    return [...m.entries()].map(([v, rs]) => ({ v, n: rs.length, sums: Object.fromEntries(numCols.map((c) => [c.k, rs.reduce((s, r) => s + (Number(r[c.k]) || 0), 0)])) })).sort((a, b) => b.n - a.n);
  }, [rows, groupBy, numCols]);
  const gLabel = groupOptions.find(([k]) => k === groupBy)?.[1] || "";
  const anyFilter = Object.values(f).some(Boolean) || drill.length;
  // v10.14: name the legal entity on every export and print-out
  const entityNames = [...new Set(rows.map((r) => r.legal_entity).filter(Boolean))];
  const entityLabel = f.legal_entity || (entityNames.length === 1 ? entityNames[0] : "All legal entities");
  const entitySlug = entityLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const exportCsv = () => {
    const stamp = `${entitySlug}-${from}_to_${to}`;
    if (groups) return downloadCsv(`${def.id}-by-${groupBy}-${stamp}.csv`, [gLabel, "Rows", ...numCols.map((c) => c.l)], groups.map((g) => [g.v, g.n, ...numCols.map((c) => csvCell(g.sums[c.k], c.t))]));
    return downloadCsv(`${def.id}-${stamp}.csv`, cols.map((c) => c.l), rows.map((r) => cols.map((c) => csvCell(r[c.k], c.t))));
  };
  const print = () => {
    const esc = (v) => String(v ?? "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]);
    const head = groups ? [gLabel, "Rows", ...numCols.map((c) => c.l)] : cols.map((c) => c.l);
    const body = groups ? groups.map((g) => [g.v, g.n, ...numCols.map((c) => fmtCell(g.sums[c.k], c.t))]) : rows.map((r) => cols.map((c) => fmtCell(r[c.k], c.t)));
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${esc(def.name)} · ${esc(entityLabel)}</title><style>body{font-family:Arial,sans-serif;font-size:11px;color:#202922;margin:18px}h1{font-size:16px;margin:0}p{color:#66716a;margin:4px 0 12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd5ce;padding:4px 6px;text-align:left}th{background:#eef3ef}@page{size:A4 landscape;margin:10mm}</style></head><body><h1>${esc(def.name)}</h1><p><b>Legal entity: ${esc(entityLabel)}</b></p><p>${esc(fmtDate(from))} – ${esc(fmtDate(to))} · ${rows.length} rows${anyFilter ? " · filtered" : ""}${groups ? ` · grouped by ${esc(gLabel)}` : ""} · printed ${esc(fmtDateTime(new Date().toISOString()))}</p><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };
  const sel = (k, label) => {
    const o = opts(k);
    if (o.length < 2 && !f[k]) return null;
    return (
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>{label}</InputLabel>
        <Select label={label} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
          <MenuItem value="">All</MenuItem>
          {o.map((v) => <MenuItem key={v} value={String(v)}>{k === "_status" ? String(v).replace(/_/g, " ") : v}</MenuItem>)}
        </Select>
      </FormControl>
    );
  };
  return (
    <Stack spacing={2}>
      <SectionCard title={def.name} subtitle={def.desc}>
        <Stack spacing={1.5}>
          {!def.noDate && (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ alignItems: { md: "center" } }}>
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                {PERIODS.map(([id, l]) => <Chip key={id} size="small" label={l} color={period === id ? "primary" : "default"} variant={period === id ? "filled" : "outlined"} onClick={() => { setPeriod(id); if (id !== "custom") setRange(periodPreset(id)); }} sx={{ height: 24, fontSize: "0.6rem" }} />)}
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField size="small" type="date" label="From" value={from} onChange={(e) => { setPeriod("custom"); setRange([e.target.value, to < e.target.value ? e.target.value : to]); }} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField size="small" type="date" label="To" value={to} onChange={(e) => { setPeriod("custom"); setRange([from > e.target.value ? e.target.value : from, e.target.value]); }} slotProps={{ inputLabel: { shrink: true } }} />
              </Stack>
            </Stack>
          )}
          {def.noDate && <Typography variant="caption" color="text.secondary">Point-in-time report (as of today).</Typography>}
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
            {/* v10.14: Legal entity filter — always shown when rows belong to an entity (the header choice narrows it further) */}
            {opts("legal_entity").length > 0 && (
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel>Legal entity</InputLabel>
                <Select label="Legal entity" value={f.legal_entity} onChange={(e) => setF({ ...f, legal_entity: e.target.value })} data-testid="report-entity">
                  <MenuItem value="">{opts("legal_entity").length === 1 ? opts("legal_entity")[0] : "All legal entities"}</MenuItem>
                  {opts("legal_entity").length > 1 && opts("legal_entity").map((v) => <MenuItem key={v} value={String(v)}>{v}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            {sel("department", "Department")}
            {sel("location", "Location")}
            {!hdrCountryFixed && sel("country", "Country")}
            {sel("worker_type", "Worker type")}
            {sel("_status", "Status")}
            <TextField size="small" placeholder="Search in any column" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} sx={{ minWidth: 200 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Group by</InputLabel>
              <Select label="Group by" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                <MenuItem value="">No grouping (row level)</MenuItem>
                {groupOptions.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
              </Select>
            </FormControl>
            {anyFilter ? <Button size="small" startIcon={<FilterAltOffRounded />} onClick={() => { setF({ legal_entity: "", department: "", location: "", country: "", worker_type: "", _status: "", text: "" }); setDrill([]); }}>Clear filters</Button> : null}
          </Stack>
          {drill.length > 0 && (
            <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
              <Typography variant="caption" color="text.secondary">Drilled into:</Typography>
              {drill.map(([k, v, l], i) => <Chip key={k} size="small" label={`${l}: ${v}`} onDelete={() => setDrill(drill.filter((_, j) => j !== i))} deleteIcon={<CloseRounded />} />)}
            </Stack>
          )}
        </Stack>
      </SectionCard>
      <Grid min={150}>
        <StatCard label={groups ? `${gLabel} groups` : empCount != null ? "Employees" : "Records"} value={(groups ? groups.length : empCount ?? rows.length).toLocaleString("en-IN")} hint={groups ? `${empCount ?? rows.length} ${empCount != null ? "employees" : "records"}` : empCount != null && empCount !== rows.length ? `${rows.length} records` : base.length !== rows.length ? `of ${base.length}` : def.noDate ? "as of today" : `${fmtDate(from)} – ${fmtDate(to)}`} tone="accent" />
        {numCols.slice(0, 4).map((c) => <StatCard key={c.k} label={/^total/i.test(c.l) ? c.l : `Total ${c.l.toLowerCase()}`} value={fmtCell(sums[c.k], c.t)} tone={c.t === "money" ? "info" : c.t === "hours" ? "good" : "neutral"} />)}
      </Grid>
      <SectionCard noPad title={groups ? `By ${gLabel.toLowerCase()} — click a row to drill in` : empCount != null ? `${empCount.toLocaleString("en-IN")} employee(s)${empCount !== rows.length ? ` · ${rows.length.toLocaleString("en-IN")} records` : ""}` : `${rows.length.toLocaleString("en-IN")} record(s)`} action={
        <Stack direction="row" spacing={1}>
          {!groups && <Button size="small" variant="outlined" startIcon={<ViewColumnRounded />} onClick={(e) => setColAnchor(e.currentTarget)}>Columns ({cols.length})</Button>}
          <Button size="small" variant="outlined" startIcon={<PrintRounded />} onClick={print} disabled={!rows.length}>Print</Button>
          <Button size="small" variant="contained" startIcon={<DownloadRounded />} onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
        </Stack>
      }>
        <TableWrap>
          {groups ? (
            <Table size="small" sx={{ minWidth: 520 }}>
              <TableHead><TableRow><TableCell>{gLabel}</TableCell><TableCell align="right">Rows</TableCell>{numCols.map((c) => <TableCell key={c.k} align="right">{c.l}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.v} hover sx={{ cursor: "pointer" }} onClick={() => { setDrill([...drill.filter(([k]) => k !== groupBy), [groupBy, g.v === "(blank)" ? "" : g.v, gLabel]]); setGroupBy(""); }}>
                    <TableCell sx={{ fontWeight: 700 }}>{groupBy === "_status" ? g.v.replace(/_/g, " ") : groupBy === "_month" && g.v !== "(blank)" ? new Date(`${g.v}-15T12:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : g.v}</TableCell>
                    <TableCell align="right">{g.n}</TableCell>
                    {numCols.map((c) => <TableCell key={c.k} align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{fmtCell(g.sums[c.k], c.t)}</TableCell>)}
                  </TableRow>
                ))}
                <TableRow sx={{ "& td": { fontWeight: 800, background: "#f5f8f5" } }}><TableCell>Total</TableCell><TableCell align="right">{rows.length}</TableCell>{numCols.map((c) => <TableCell key={c.k} align="right">{fmtCell(sums[c.k], c.t)}</TableCell>)}</TableRow>
              </TableBody>
            </Table>
          ) : (
            <Table size="small" stickyHeader sx={{ minWidth: Math.max(700, cols.length * 110) }}>
              <TableHead>
                <TableRow>
                  {cols.map((c) => (
                    <TableCell key={c.k} align={NUMERIC.includes(c.t) ? "right" : "left"} sx={{ whiteSpace: "nowrap" }}>
                      <TableSortLabel active={sort.k === c.k} direction={sort.k === c.k ? sort.dir : "asc"} onClick={() => setSort({ k: c.k, dir: sort.k === c.k && sort.dir === "asc" ? "desc" : "asc" })}>{c.l}</TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(0, MAX_ROWS).map((r, i) => (
                  <TableRow key={i} hover>
                    {cols.map((c) => <TableCell key={c.k} align={NUMERIC.includes(c.t) ? "right" : "left"} sx={{ whiteSpace: ["date", "datetime", "money", "hours"].includes(c.t) ? "nowrap" : undefined, fontVariantNumeric: NUMERIC.includes(c.t) ? "tabular-nums" : undefined, maxWidth: 280 }}>{c.k === "status" || c.k === "_status" ? String(r[c.k] ?? "—").replace(/_/g, " ") : fmtCell(r[c.k], c.t)}</TableCell>)}
                  </TableRow>
                ))}
                {rows.length > 0 && numCols.length > 0 && (
                  <TableRow sx={{ "& td": { fontWeight: 800, background: "#f5f8f5" } }}>
                    {cols.map((c, i) => <TableCell key={c.k} align={NUMERIC.includes(c.t) ? "right" : "left"}>{i === 0 ? "Total" : numCols.some((n) => n.k === c.k) ? fmtCell(sums[c.k], c.t) : ""}</TableCell>)}
                  </TableRow>
                )}
                {rows.length === 0 && <TableRow><TableCell colSpan={cols.length}><EmptyState title="No rows" text="Widen the period or clear filters." /></TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </TableWrap>
        {!groups && rows.length > MAX_ROWS && <Typography variant="caption" color="text.secondary" sx={{ display: "block", p: 1.5 }}>Showing the first {MAX_ROWS} of {rows.length} records. Totals and the CSV include all records.</Typography>}
      </SectionCard>
      <Popover open={!!colAnchor} anchorEl={colAnchor} onClose={() => setColAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <Box sx={{ p: 1.5, maxHeight: 420, overflow: "auto", minWidth: 220 }}>
          <Stack direction="row" sx={{ mb: 0.5 }}><Button size="small" onClick={() => setHidden(new Set())}>Show all</Button><Tooltip title="Keep only the employee and figures"><Button size="small" onClick={() => setHidden(new Set(def.columns.filter((c) => !NUMERIC.includes(c.t) && !["employee", "id"].includes(c.k)).map((c) => c.k)))}>Figures only</Button></Tooltip></Stack>
          {columns.map((c) => <FormControlLabel key={c.k} sx={{ display: "flex", m: 0 }} control={<Checkbox size="small" checked={!hidden.has(c.k)} onChange={(e) => { const n = new Set(hidden); if (e.target.checked) n.delete(c.k); else if (cols.length > 1) n.add(c.k); setHidden(n); }} />} label={<Typography sx={{ fontSize: "0.66rem" }}>{c.l}</Typography>} />)}
        </Box>
      </Popover>
    </Stack>
  );
}
