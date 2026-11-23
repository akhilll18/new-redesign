// Employee master (Super Admin; HR admins can add). Every field from the Sahayog field reference
// plus PeopleHR contacts/employment and Keka pay/policy fields, validated per data/employeeFields.js.
import React, { useMemo, useState } from "react";
import { useCountryFilter } from "../../country/CountryContext.jsx";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputAdornment, InputLabel, MenuItem, Select, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { PersonAddRounded, SearchRounded, DownloadRounded } from "@mui/icons-material";
import { PartialDataNote } from "../v108/Enterprise.jsx";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, PersonCell, StatusChip, Mono, TableWrap, Tag } from "../../components/kit/UI.jsx";
import FieldInput, { currencySymbol } from "../../components/kit/FieldInput.jsx";
import { BgvChip, useBgvLookup } from "../../components/collab/BgvViews.jsx";
import { EMPLOYEE_SECTIONS, ALL_FIELDS, COUNTRIES, WORKER_TYPES, WORKER_TYPE_BY, ON_PAYROLL, workerTypeOf, workerDefaults, isContingent, monthlyEquivalent, fieldApplies, sectionApplies, workerLabel } from "../../data/employeeFields.js";
import { fmtDate, fmtNum, downloadCsv, isoDate } from "../../lib/utils.js";
import { sectionsWithCustom, customFieldList } from "../../lib/customFields.js";

const FX = { INR: 1, GBP: 112, USD: 88, AED: 24, SGD: 68 };
const newRecord = () => ({ worker_type: "permanent", country_code: "IN", region: "TG", city: "Hyderabad", employment_type: "full_time", fte: "1", pay_cycle: "monthly", tax_regime: "new", leave_policy: "standard", expense_policy: "standard", shift: "general", probation_status: "in_probation", background_check: "pending", right_to_work: "pending", notice_period: "60", date_of_joining: isoDate(), bank_name: "", grade_code: "P1" });

export function EmployeeFormDialog({ open, rec, onClose }) {
  const { data, user, upsertEmployee, createContractFromEmployee, notifyToast, entityAccess } = useStore();
  const isNew = !rec?.employee_code;
  const [form, setForm] = useState(() => rec || newRecord());
  const [tab, setTab] = useState("core");
  const [errors, setErrors] = useState({});
  const [mkContract, setMkContract] = useState(true);
  React.useEffect(() => {
    if (open) {
      setForm(rec ? { ...rec, worker_type: workerTypeOf(rec) } : newRecord());
      setErrors({});
      setTab("core");
      setMkContract(true);
    }
  }, [open, rec]);
  const role = user.role === "superadmin" ? "super" : "admin";
  const ctx = { orgUnits: data.orgUnits, employees: data.employees, geofences: data.geofences || [], vendors: data.contractVendors || [], companies: entityAccess?.companies || data.companies || [], locations: entityAccess?.locations || data.workLocations || [], lockCountry: data.settings.lock_country_to_location };
  const sections = sectionsWithCustom(data).filter((s) => sectionApplies(s, form)); // v10.15: + dropdowns the Super Admin created
  const sec = sections.find((s) => s.id === tab) || sections[0];
  const errCount = (s) => s.fields.filter((f) => errors[f.key]).length;
  const wt = WORKER_TYPE_BY[workerTypeOf(form)];
  const contingent = isContingent(form);
  const monthly = contingent ? monthlyEquivalent(form) : Number(form.monthly_gross) || 0;
  const hasContract = !isNew && (data.contracts || []).some((c) => c.employee_code === rec.employee_code && !["terminated", "renewed", "rejected"].includes(c.status));

  function pickType(id) {
    if (id === workerTypeOf(form)) return;
    setForm((x) => ({ ...x, ...workerDefaults(id), grade_code: ON_PAYROLL.includes(id) ? x.grade_code || "P1" : "", probation_status: ["permanent", "contract", "apprentice"].includes(id) ? x.probation_status || "in_probation" : "", notice_period: id === "permanent" ? x.notice_period || "60" : "15", fixed_term_end_date: id === "permanent" ? "" : x.fixed_term_end_date || isoDate(new Date(x.date_of_joining || isoDate()).getTime() + 182 * 86400000), pay_rate: x.pay_rate || "" }));
    setErrors({});
  }

  function save() {
    const payload = { ...form };
    delete payload.annual_ctc;
    if (!payload.login_id) payload.login_id = payload.email;
    if (payload.employment_type === "part_time" && payload.fte === "1") payload.fte = "0.5";
    if (payload.probation_end_date === undefined && payload.date_of_joining && ["permanent", "contract", "apprentice"].includes(workerTypeOf(payload))) payload.probation_end_date = isoDate(new Date(payload.date_of_joining).getTime() + 183 * 86400000);
    // Drop values of fields that do not apply to this worker type (e.g. PF for a freelancer).
    ALL_FIELDS.forEach((f) => { if (!fieldApplies(f, payload) && f.workers && payload[f.key] !== undefined && f.key !== "monthly_gross") payload[f.key] = ""; });
    const r = upsertEmployee(payload);
    if (!r.ok) {
      setErrors(r.errors);
      const first = sections.find((s) => s.fields.some((f) => r.errors[f.key]));
      if (first) setTab(first.id);
      return notifyToast(`${Object.keys(r.errors).length} field(s) need attention.`, "error");
    }
    let extra = "";
    if (isContingent(payload) && mkContract && !hasContract) {
      const c = createContractFromEmployee(r.code, { submit: false });
      extra = c.ok ? ` Draft contract ${c.id} created under Contract management.` : ` Contract not created: ${c.error}`;
    }
    notifyToast(isNew ? `${r.code} created. HR approves the account before first sign-in (temporary password Welcome@123).${extra}` : `${r.code} saved.${extra}`);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ flex: 1 }}>{isNew ? "Add employee / worker" : `Edit ${rec.full_name} (${rec.employee_code})`}</Box>
        <Tag tone={wt?.tone}>{wt?.short}</Tag>
      </DialogTitle>
      <Box sx={{ px: 3, borderBottom: "1px solid #edf0ec" }}>
        <Tabs value={sec.id} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
          {sections.map((s) => <Tab key={s.id} value={s.id} label={`${s.title}${errCount(s) ? ` (${errCount(s)})` : ""}`} sx={{ fontSize: "0.7rem", color: errCount(s) ? "#d32f2f" : s.id === "engagement" ? "#315f49" : undefined, fontWeight: s.id === "engagement" ? 700 : undefined }} />)}
        </Tabs>
      </Box>
      <DialogContent>
        {sec.id === "core" && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, mb: 1 }}>Worker type *</Typography>
            <Box role="radiogroup" aria-label="Worker type" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 1 }}>
              {WORKER_TYPES.map((w) => {
                const on = workerTypeOf(form) === w.id;
                const locked = !isNew && role !== "super" && !on && false;
                return (
                  <Box key={w.id} component="button" type="button" role="radio" aria-checked={on} disabled={locked} onClick={() => pickType(w.id)}
                    sx={{ all: "unset", cursor: "pointer", p: 1.1, borderRadius: 1.5, border: on ? "2px solid #244d3d" : "1px solid #e6ece5", background: on ? "#eef6f1" : "#fff", boxSizing: "border-box", minHeight: 64, "&:hover": { borderColor: "#244d3d" }, "&:focus-visible": { outline: "2px solid #244d3d", outlineOffset: 2 } }}>
                    <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: on ? "#244d3d" : "#202922" }}>{w.short}</Typography>
                    <Typography sx={{ fontSize: "0.56rem", color: "#66716a", mt: 0.3, lineHeight: 1.35 }}>{w.route === "payroll" ? "Payroll · payslip" : w.route === "invoice" ? "Invoice · TDS " + w.tds : "Vendor invoice"} · {w.basis === "milestone" ? "milestones" : w.basis}</Typography>
                  </Box>
                );
              })}
            </Box>
            <Alert severity={contingent ? "info" : "success"} sx={{ mt: 1.2, fontSize: "0.64rem", py: 0 }}>
              <b>{wt?.label}.</b> {wt?.desc} {contingent ? "The Contract & engagement tab and the worker's My contract page appear; statutory fields that do not apply are hidden." : ""}
            </Alert>
          </Box>
        )}
        {sec.id === "engagement" && (
          <Alert severity="success" sx={{ mb: 1.5, fontSize: "0.64rem", py: 0 }}>
            Monthly-equivalent cost <b>{currencySymbol(form)}{fmtNum(monthly)}</b> (used for CTC, budgets and analytics){form.pay_basis === "hourly" ? ` = rate × ${form.std_hours_week || 40} h × 52 ÷ 12` : form.pay_basis === "daily" ? " = day rate × days a week × 52 ÷ 12" : form.pay_basis === "milestone" ? " = total fee ÷ months of the engagement" : ""}. {hasContract ? "This worker already has a contract; change live terms there (Amend)." : ""}
          </Alert>
        )}
        <Typography sx={{ fontSize: "0.6rem", color: "#78827b", mb: 1.5 }}>Source: {sec.source}. Fields marked * are required{contingent ? ` for a ${wt?.short.toLowerCase()} worker` : ""}.</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, columnGap: 2, rowGap: 1.5 }}>
          {sec.fields.filter((f) => f.key !== "worker_type" && fieldApplies(f, form)).map((f) => {
            if (f.type === "calc") {
              const cur = COUNTRIES.find((c) => c.code === form.country_code)?.currency || "INR";
              return <TextField key={f.key} label={f.label} value={`₹${fmtNum(Math.round(monthly * 12 * (FX[cur] || 1)))}`} disabled helperText={contingent ? "12 × monthly-equivalent contract cost" : f.rule} />;
            }
            if (f.key === "employee_code") return <TextField key={f.key} label={f.label} value={form.employee_code || "Assigned on save"} disabled helperText=" " />;
            if (f.key === "status") return <TextField key={f.key} label={f.label} value={form.status || "pending_approval (new)"} disabled helperText="Change it from Users & access" />;
            const editable = isNew ? true : f.editableBy.includes(role) || (role === "super" && f.editableBy.length > 0);
            return (
              <Box key={f.key} sx={{ gridColumn: f.type === "textarea" ? "1 / -1" : undefined }}>
                <FieldInput f={f} rec={form} ctx={ctx} value={form[f.key]} disabled={!editable} error={errors[f.key]} onChange={(v) => setForm((x) => ({ ...x, [f.key]: v, ...(f.key === "country_code" ? { region: "" } : {}), ...(f.key === "company_id" ? { location_id: "" } : {}), ...(f.key === "location_id" ? (() => { const l = ctx.locations.find((y) => y.location_id === v) || {}; return { company_id: l.company_id || x.company_id, ...(l.country && l.country !== x.country_code && data.settings.lock_country_to_location !== false ? { country_code: l.country, region: "" } : {}) }; })() : {}), ...(f.key === "gst_registered" && v === "no" ? { gstin: "" } : {}) }))} />
              </Box>
            );
          })}
        </Box>
        {!isNew && role === "admin" && <Alert severity="info">Some fields are locked for HR admins and can only be changed by a Super Admin.</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {contingent && !hasContract && <FormControlLabel sx={{ mr: "auto" }} control={<Checkbox size="small" checked={mkContract} onChange={(e) => setMkContract(e.target.checked)} />} label={<Typography sx={{ fontSize: "0.66rem" }}>Create a draft contract from these terms</Typography>} />}
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>{isNew ? (contingent ? `Create ${wt?.short.toLowerCase()} worker` : "Create employee") : "Save"}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function EmployeeMaster() {
  const { data, nameOf, hrSync, notifyToast } = useStore();
  const bgvOf = useBgvLookup();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [wtype, setWtype] = useState("");
  const [edit, setEdit] = useState(null);
  const inCountry = useCountryFilter();
  const list = useMemo(() => data.employees.filter((e) => inCountry(e) && (!dept || e.department === dept) && (!status || e.status === status) && (!wtype || (wtype === "contingent" ? isContingent(e) : workerTypeOf(e) === wtype)) && (!q || [e.full_name, e.employee_code, e.designation, e.city, e.email, e.location_id, e.company_id].join(" ").toLowerCase().includes(q.toLowerCase()))), [data.employees, q, dept, status, wtype, inCountry]);
  const tenure = (d) => ((Date.now() - new Date(d)) / (365.25 * 86400000)).toFixed(1);
  const probation = (e) => (Date.now() - new Date(e.date_of_joining)) / 86400000 < 183;

  return (
    <>
      <PageHeader
        eyebrow="SUPER ADMIN · CORE HR"
        title="Employee master"
        subtitle="The HR master every module reads from: login, manager approvals, leave and expense policies, payroll fields."
        actions={
          <>
            <Button variant="outlined" onClick={() => { const r = hrSync(); notifyToast(r.added ? `HR sync added ${r.added} employee(s) as pending approval.` : "HR sync complete. No new employees."); }}>Sync with HR</Button>
            <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => { const fs = [...ALL_FIELDS, ...customFieldList(data)].filter((f) => f.key !== "annual_ctc"); downloadCsv("employee-master.csv", fs.map((f) => f.key), list.map((e) => fs.map((f) => (f.key === "bank_account" ? `****${String(e[f.key] || "").slice(-4)}` : e[f.key] ?? "")))); }}>Export</Button>
            <Button variant="contained" startIcon={<PersonAddRounded />} onClick={() => setEdit({})}>Add employee</Button>
          </>
        }
      />
      <PartialDataNote />
      <SectionCard noPad>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ p: 1.5 }}>
          <TextField placeholder="Search name, ID, title, city" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: { md: 320 } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Department</InputLabel>
            <Select label="Department" value={dept} onChange={(e) => setDept(e.target.value)}>
              <MenuItem value="">All departments</MenuItem>
              {data.orgUnits.map((o) => <MenuItem key={o.org_unit_id} value={o.org_unit_id}>{o.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="">Any status</MenuItem>
              {["active", "pending_approval", "locked", "suspended"].map((s) => <MenuItem key={s} value={s}>{s.replace("_", " ")}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Worker type</InputLabel>
            <Select label="Worker type" value={wtype} onChange={(e) => setWtype(e.target.value)}>
              <MenuItem value="">All worker types</MenuItem>
              <MenuItem value="contingent">All contingent (non-permanent)</MenuItem>
              {WORKER_TYPES.map((w) => <MenuItem key={w.id} value={w.id}>{w.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Typography sx={{ alignSelf: "center", fontSize: "0.65rem", color: "#78827b" }}>{list.length} of {data.employees.length}</Typography>
        </Stack>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 1180 }}>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell><TableCell>Department</TableCell><TableCell>Manager</TableCell><TableCell>Location</TableCell><TableCell>Grade</TableCell><TableCell>Joined</TableCell><TableCell align="right">Tenure</TableCell><TableCell align="right">Monthly gross</TableCell><TableCell align="right">Annual CTC</TableCell><TableCell>Worker type</TableCell><TableCell>BGV</TableCell><TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((e) => (
                <TableRow key={e.employee_code} hover sx={{ cursor: "pointer" }} onClick={() => setEdit(e)}>
                  <TableCell><PersonCell name={e.full_name} sub={`${e.employee_code} · ${e.designation}`} /></TableCell>
                  <TableCell>{e.department}</TableCell>
                  <TableCell>{e.reporting_manager ? nameOf(e.reporting_manager) : "—"}</TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.68rem", fontWeight: 600 }}>{(data.workLocations || []).find((l) => l.location_id === e.location_id)?.name || e.city}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{(data.companies || []).find((c) => c.company_id === e.company_id)?.short || "—"} · {e.country_code}</Typography></TableCell>
                  <TableCell><Mono>{e.grade_code || "—"}</Mono></TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(e.date_of_joining)}</TableCell>
                  <TableCell align="right">{tenure(e.date_of_joining)}</TableCell>
                  <TableCell align="right">₹{fmtNum(e.monthly_gross)}</TableCell>
                  <TableCell align="right">₹{fmtNum(e.monthly_gross * 12)}</TableCell>
                  <TableCell><Stack direction="row" spacing={0.4}><Tag tone={WORKER_TYPE_BY[workerTypeOf(e)]?.tone}>{workerLabel(e)}</Tag>{!isContingent(e) && probation(e) ? <Tag tone="warn">Probation</Tag> : e.fte === "0.5" ? <Tag tone="info">Part-time</Tag> : null}</Stack>{isContingent(e) && e.fixed_term_end_date && <Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>to {fmtDate(e.fixed_term_end_date)}</Typography>}</TableCell>
                  <TableCell>{bgvOf(e.employee_code) ? <BgvChip c={bgvOf(e.employee_code)} /> : <Typography variant="caption" color="text.secondary">—</Typography>}</TableCell>
                  <TableCell><StatusChip status={e.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      <EmployeeFormDialog open={!!edit} rec={edit?.employee_code ? edit : null} onClose={() => setEdit(null)} />
    </>
  );
}
