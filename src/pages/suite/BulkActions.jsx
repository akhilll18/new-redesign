// v10.5 · Bulk actions (Core HR → Bulk uploads) — HR admins (accounts module) and the Super Admin.
import React, { useMemo, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { ExpandMoreRounded, ArrowBackRounded, DownloadRounded, UploadFileRounded, FactCheckRounded, FilterAltRounded, PlaylistAddCheckRounded, TableChartRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, TableWrap, EmptyState, Tag, Mono } from "../../components/kit/UI.jsx";
import { LOADERS, LOADER_GROUPS, LOADER_BY, columnsOf, prefillRows, filterEmployees, validateRows, writeTemplate, readUpload } from "../../lib/bulkLoad.js";
import { WORKER_TYPES, ALL_FIELDS } from "../../data/employeeFields.js";
import { fmtDateTime, downloadCsv } from "../../lib/utils.js";
import { tabSx } from "../../components/suite/Hub.jsx";

const FIELD = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, f]));

export default function BulkActions() {
  const { data, user, canBulkLoad, nameOf } = useStore();
  const [open, setOpen] = useState(null);
  const [expanded, setExpanded] = useState("data");
  if (!canBulkLoad()) return <Alert severity="info">Bulk uploads are for HR admins with the accounts module and the Super Admin.</Alert>;
  if (open) return <Loader loader={LOADER_BY[open]} onBack={() => setOpen(null)} />;
  const history = data.bulkLoads || [];
  return (
    <>
      <PageHeader title="Bulk actions" subtitle="Select the type of action, then follow the steps to load or update many employee records at once from Excel or CSV: download the prefilled template, edit, upload, validate and load." />
      <Stack spacing={1.2} sx={{ mb: 3 }}>
        {LOADER_GROUPS.map(([g, label, sub]) => (
          <Accordion key={g} expanded={expanded === g} onChange={() => setExpanded(expanded === g ? "" : g)} disableGutters sx={{ border: "1px solid #dfe6e8", borderRadius: "10px !important", "&:before": { display: "none" }, overflow: "hidden" }}>
            <AccordionSummary expandIcon={<ExpandMoreRounded sx={{ color: expanded === g ? "#fff" : undefined }} />} sx={{ bgcolor: expanded === g ? "primary.main" : "background.default", color: expanded === g ? "#fff" : "text.primary", minHeight: 48 }}>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, minWidth: 220 }}>{label}</Typography>
              <Typography sx={{ fontSize: "0.66rem", opacity: 0.85 }}>{sub}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Table size="small">
                <TableHead><TableRow><TableCell sx={{ width: 320 }}>Action</TableCell><TableCell>Description</TableCell><TableCell sx={{ width: 120 }} /></TableRow></TableHead>
                <TableBody>
                  {/* v10.7: "Bulk employee data upload" (every field at once) is removed for HR admins */}
                  {LOADERS.filter((l) => l.group === g && !(l.id === "employee-all" && user?.role === "admin")).map((l) => (
                    <TableRow key={l.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(l.id)}>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem" }}>{l.label}</TableCell>
                      <TableCell sx={{ fontSize: "0.66rem", color: "#5c675f" }}>{l.desc}</TableCell>
                      <TableCell align="right"><Button size="small">Open</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>
      <SectionCard title="Load history" subtitle="Every bulk load with who ran it, the mode and the result" noPad>
        {history.length === 0 ? <Box sx={{ p: 2.5 }}><EmptyState title="No bulk loads yet" text="Loads you run appear here." /></Box> : (
          <TableWrap>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead><TableRow><TableCell>Load</TableCell><TableCell>Loader</TableCell><TableCell>Mode</TableCell><TableCell>File</TableCell><TableCell align="right">Created</TableCell><TableCell align="right">Updated</TableCell><TableCell align="right">Unchanged</TableCell><TableCell align="right">Rejected</TableCell><TableCell>By</TableCell></TableRow></TableHead>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell><Mono>{h.id}</Mono><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{fmtDateTime(h.at)}</Typography></TableCell>
                    <TableCell>{h.label}</TableCell>
                    <TableCell><Tag tone={h.mode === "onetime" ? "warn" : "info"}>{h.mode === "onetime" ? "One-time" : "Frequent"}</Tag></TableCell>
                    <TableCell sx={{ fontSize: "0.62rem" }}>{h.file}</TableCell>
                    <TableCell align="right">{h.created}</TableCell>
                    <TableCell align="right">{h.updated}</TableCell>
                    <TableCell align="right">{h.skipped}</TableCell>
                    <TableCell align="right">{h.errors}</TableCell>
                    <TableCell>{nameOf(h.by)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>
    </>
  );
}

function Loader({ loader, onBack }) {
  const { data, user, bulkApply, notifyToast } = useStore();
  const [mode, setMode] = useState("frequent");
  const [filters, setFilters] = useState({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("existing");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(false);
  const cols = columnsOf(loader);
  const scope = useMemo(() => filterEmployees(data, filters), [data, filters]);
  const existing = useMemo(() => prefillRows(loader, data, scope), [loader, data, scope]);
  const filterCount = Object.values(filters).filter((v) => v?.length).length;

  async function download(format, prefilled) {
    setBusy("download");
    try { await writeTemplate(loader, data, prefilled ? existing : [], { format, name: prefilled ? "Prefilled" : "Template" }); notifyToast(prefilled ? `Prefilled template downloaded (${existing.length} rows).` : "Blank template downloaded."); }
    catch (e) { notifyToast(`Download failed: ${e.message}`, "error"); }
    setBusy("");
  }
  async function validate() {
    if (!file) return notifyToast("Choose the Excel or CSV file first.", "error");
    setBusy("validate");
    try {
      const parsed = await readUpload(file);
      if (!parsed.length) { notifyToast("The file has no data rows.", "error"); setBusy(""); return; }
      setRows(parsed);
      const r = validateRows(loader, parsed, data, { mode, role: user.role });
      setResult(r);
      setTab(r.errors.length ? "error" : "valid");
    } catch (e) { notifyToast(`Couldn't read the file: ${e.message}`, "error"); }
    setBusy("");
  }
  function load() {
    const r = bulkApply({ loaderId: loader.id, mode, fileName: file?.name, rows: result.valid, totals: { errors: result.errors.length, warnings: result.warnings.length } });
    setConfirm(false);
    if (!r.ok) return notifyToast(r.error, "error");
    notifyToast(`Load ${r.id} done: ${r.created} created, ${r.updated} updated, ${r.skipped} unchanged.${r.created ? " New accounts wait for approval." : ""}`, "success");
    setResult(null); setRows(null); setFile(null);
  }
  const errorReport = () => downloadCsv(`${loader.id}-errors.csv`, ["Line", "Employee", "Name", "Status", "Messages"], [...result.errors, ...result.warnings].map((r) => [r.line, r.code, r.name, r.status, r.messages.join(" | ")]));

  const view = tab === "existing" ? null : tab === "consolidated" ? result?.consolidated : tab === "valid" ? result?.valid : tab === "error" ? result?.errors : result?.warnings;
  return (
    <>
      <Button size="small" startIcon={<ArrowBackRounded />} onClick={onBack} sx={{ mb: 1 }}>Bulk actions</Button>
      <PageHeader title={loader.label} subtitle={loader.desc} actions={
        <Stack direction="row" spacing={1}>
          <Button variant="contained" color="success" startIcon={<DownloadRounded />} disabled={!!busy} onClick={() => download("xlsx", true)}>Prefilled Excel</Button>
          <Button variant="outlined" startIcon={<DownloadRounded />} disabled={!!busy} onClick={() => download("xlsx", false)}>Blank template</Button>
        </Stack>
      } />
      <SectionCard>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
            <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => { if (v) { setMode(v); setResult(null); } }}>
              <ToggleButton value="frequent" sx={{ fontSize: "0.64rem", px: 2 }}>Frequent load · update existing</ToggleButton>
              <ToggleButton value="onetime" sx={{ fontSize: "0.64rem", px: 2 }}>One-time load · initial / migration</ToggleButton>
            </ToggleButtonGroup>
            <Typography sx={{ fontSize: "0.62rem", color: "#5c675f", flex: 1 }}>{mode === "frequent" ? "Updates employees that already exist. Blank cells keep the current value." : loader.allowNew ? "Initial load: rows without a known employee code create new employees (they wait for account approval). Blank cells clear the value." : "Initial load: blank cells clear the current value. New employees can only be created with the Core HR or full employee loader."}</Typography>
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" } }}>
            <Button variant="outlined" startIcon={<FilterAltRounded />} onClick={() => setFilterOpen(true)}>Filters for employees{filterCount ? ` (${filterCount})` : ""}</Button>
            <Typography sx={{ fontSize: "0.62rem", color: "#78827b" }}>{scope.length} employees in the prefilled template</Typography>
            <Box sx={{ flex: 1 }} />
            <Button size="small" startIcon={<TableChartRounded />} onClick={() => download("csv", true)}>Prefilled CSV</Button>
            <Button size="small" startIcon={<TableChartRounded />} onClick={() => download("csv", false)}>Blank CSV</Button>
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" }, p: 1.5, borderRadius: 1.5, background: "#f4f7f8" }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, minWidth: 110 }}>Upload Excel file</Typography>
            <TextField size="small" value={file?.name || ""} placeholder="select" sx={{ flex: 1, maxWidth: 420, background: "#fff" }} slotProps={{ input: { readOnly: true } }} />
            <Button component="label" variant="contained" startIcon={<UploadFileRounded />}>Browse<input hidden type="file" accept=".xlsx,.csv" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setFile(f); setResult(null); } }} /></Button>
            <Button variant="contained" color="secondary" startIcon={<FactCheckRounded />} disabled={!file || !!busy} onClick={validate}>Validate Excel</Button>
          </Stack>
          {busy && <LinearProgress />}
        </Stack>
      </SectionCard>

      <Box sx={{ mt: 2.5, borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={tabSx}>
          <Tab value="existing" label={`Existing records (${existing.length})`} />
          <Tab value="consolidated" disabled={!result} label={`Excel – consolidated (${result?.consolidated.length ?? 0})`} />
          <Tab value="valid" disabled={!result} label={`Excel – valid (${result?.valid.length ?? 0})`} />
          <Tab value="error" disabled={!result} label={`Excel – error (${result?.errors.length ?? 0})`} sx={{ color: result?.errors.length ? "error.main !important" : undefined }} />
          <Tab value="warning" disabled={!result} label={`Excel – warning (${result?.warnings.length ?? 0})`} />
        </Tabs>
      </Box>
      {result && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ my: 1.5, alignItems: { sm: "center" } }}>
          {result.unknown.length > 0 && <Alert severity="warning" sx={{ flex: 1, py: 0 }}>Ignored columns not in this loader: {result.unknown.join(", ")}</Alert>}
          <Box sx={{ flex: 1 }} />
          {(result.errors.length > 0 || result.warnings.length > 0) && <Button size="small" startIcon={<DownloadRounded />} onClick={errorReport}>Error & warning report</Button>}
          <Button variant="contained" startIcon={<PlaylistAddCheckRounded />} disabled={!result.valid.length} onClick={() => setConfirm(true)}>Load {result.valid.length} valid row{result.valid.length === 1 ? "" : "s"}</Button>
        </Stack>
      )}
      <SectionCard noPad sx={{ mt: result ? 0 : 1.5 }}>
        {tab === "existing" ? (
          <TableWrap>
            <Table size="small" stickyHeader sx={{ minWidth: Math.max(700, cols.length * 140) }}>
              <TableHead><TableRow>{cols.map((c) => <TableCell key={c.header} sx={{ background: c.reference ? "#7f8c8d" : c.required ? "#e53935" : "#1e9bd7", color: "#fff !important", fontWeight: 700, whiteSpace: "nowrap" }}>{c.header}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {existing.slice(0, 100).map((r, i) => <TableRow key={i} hover>{cols.map((c) => <TableCell key={c.header} sx={{ whiteSpace: "nowrap", fontSize: "0.64rem" }}>{String(r[c.header] ?? "")}</TableCell>)}</TableRow>)}
              </TableBody>
            </Table>
            {existing.length > 100 && <Typography sx={{ p: 1.5, fontSize: "0.6rem", color: "#78827b" }}>Showing 100 of {existing.length}. The prefilled download has them all.</Typography>}
          </TableWrap>
        ) : !view?.length ? <Box sx={{ p: 2.5 }}><EmptyState title="Nothing here" text={tab === "error" ? "No errors — every row passed validation." : "No rows in this list."} /></Box> : (
          <TableWrap>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead><TableRow><TableCell>Line</TableCell><TableCell>Employee</TableCell><TableCell>Status</TableCell><TableCell>{loader.kind === "leave" ? "Leave & balances" : "Changes"}</TableCell><TableCell>Messages</TableCell></TableRow></TableHead>
              <TableBody>
                {view.map((r) => (
                  <TableRow key={`${r.line}-${r.code}`} hover>
                    <TableCell>{r.line}</TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.68rem", fontWeight: 700 }}>{r.name || "—"}</Typography><Mono>{r.code}</Mono>{r.isNew && <Chip size="small" label="New" sx={{ ml: 0.6, height: 16, fontSize: "0.52rem" }} />}</TableCell>
                    <TableCell><Tag tone={r.status === "error" ? "bad" : r.status === "warning" ? "warn" : "good"}>{r.status === "error" ? "Error" : r.status === "warning" ? "Warning" : "Valid"}</Tag></TableCell>
                    <TableCell sx={{ maxWidth: 380 }}>
                      <Typography sx={{ fontSize: "0.6rem", wordBreak: "break-word" }}>
                        {loader.kind === "leave" ? (r.changes?.leave_type ? `${r.leave}: entitlement ${r.changes.entitled}, remaining ${r.changes.remaining}${r.changes.next_entitled != null ? ` · next year ${r.changes.next_entitled}/${r.changes.next_remaining ?? "—"}` : ""}` : r.leave)
                          : Object.entries(r.changes || {}).map(([k, v]) => `${FIELD[k]?.label || k}: ${v === "" ? "(cleared)" : v}`).join(" · ") || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 360 }}>{r.messages.map((m, i) => <Typography key={i} sx={{ fontSize: "0.6rem", color: r.status === "error" ? "error.main" : "warning.main" }}>• {m}</Typography>)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>
      <FiltersDialog open={filterOpen} value={filters} onClose={() => setFilterOpen(false)} onApply={(f) => { setFilters(f); setFilterOpen(false); }} />
      <Dialog open={confirm} onClose={() => setConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Load {result?.valid.length} row(s)?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "0.72rem" }}>{mode === "onetime" ? "One-time load" : "Frequent load"} · {loader.label}. {result?.valid.filter((r) => r.isNew).length || 0} new employee(s), {result?.valid.filter((r) => !r.isNew).length || 0} update(s). {result?.errors.length || 0} row(s) with errors are skipped. This is recorded in the audit log.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button color="inherit" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="contained" onClick={load}>Load</Button></DialogActions>
      </Dialog>
    </>
  );
}

function FiltersDialog({ open, value, onClose, onApply }) {
  const { data } = useStore();
  const [f, setF] = useState(value);
  React.useEffect(() => { if (open) setF(value); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const emps = data.employees.filter((e) => e.status !== "rejected");
  const multi = (key, label, options, getLabel = (o) => o[1]) => (
    <Autocomplete multiple size="small" options={options} getOptionLabel={getLabel} value={options.filter((o) => (f[key] || []).includes(o[0]))} onChange={(_, v) => setF({ ...f, [key]: v.map((o) => o[0]) })} renderInput={(p) => <TextField {...p} label={label} placeholder={(f[key] || []).length ? "" : "All"} />} />
  );
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Filters for employees<Typography sx={{ fontSize: "0.65rem", color: "#78827b" }}>Choose who goes into the prefilled template</Typography></DialogTitle>
      <DialogContent>
        <Stack spacing={1.6} sx={{ pt: 1 }}>
          {multi("companies", "Companies", (data.companies || []).map((c) => [c.company_id, `${c.short} · ${c.name}`]))}
          {multi("locations", "Locations", (data.workLocations || []).map((l) => [l.location_id, `${l.name} · ${l.city}`]))}
          {multi("departments", "Departments", data.orgUnits.map((o) => [o.org_unit_id, o.name]))}
          {multi("roles", "Job role", [...new Set(emps.map((e) => e.designation))].sort().map((d) => [d, d]))}
          {multi("grades", "Grade", [...new Set(emps.map((e) => e.grade_code).filter(Boolean))].sort().map((g) => [g, g]))}
          {multi("types", "Employment type", WORKER_TYPES.map((w) => [w.id, w.label]))}
          {multi("specific", "Specific employee(s)", emps.map((e) => [e.employee_code, `${e.full_name} (${e.employee_code})`]))}
          {multi("exclude", "Exclude employee(s)", emps.map((e) => [e.employee_code, `${e.full_name} (${e.employee_code})`]))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={() => setF({})}>Clear</Button>
        <Box sx={{ flex: 1 }} />
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onApply(f)}>Apply</Button>
      </DialogActions>
    </Dialog>
  );
}
