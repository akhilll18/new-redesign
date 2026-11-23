// Field reference (data dictionary) for the employee master, in the shape of the Sahayog field reference.
import React, { useState } from "react";
import { Box, Button, Chip, InputAdornment, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { DownloadRounded, SearchRounded } from "@mui/icons-material";
import { PageHeader, SectionCard, Mono, TableWrap, Tag, Grid, StatCard } from "../../components/kit/UI.jsx";
import { EMPLOYEE_SECTIONS, ALL_FIELDS, WORKER_TYPES, WORKER_TYPE_BY } from "../../data/employeeFields.js";

const appliesTo = (f, s) => { const w = f.workers || s?.workers; return !w ? "All worker types" : w.length === WORKER_TYPES.length - 1 && !w.includes("permanent") ? "All contingent workers" : w.map((x) => WORKER_TYPE_BY[x]?.short).join(", "); };
const requiredFor = (f) => (f.requiredFor ? f.requiredFor.map((x) => WORKER_TYPE_BY[x]?.short).join(", ") : f.required ? "Yes" : "");
import { downloadCsv } from "../../lib/utils.js";
import { useStore } from "../../store/AppStore.jsx";
import { OPTION_LISTS, listOptions } from "../../lib/optionLists.js";
import { MASTER_ADD } from "../../components/kit/MasterAdd.jsx";
import { sectionsWithCustom } from "../../lib/customFields.js";

// v10.15: how each dropdown on the employee form can (or can't) be extended — matches Super Admin → Dropdown lists.
const FIXED_WHY = {
  worker_type: "decides the form sections, how the person is paid and the contract", gender: "used by leave eligibility and statutory reports",
  country_code: "drives payroll rules and currency", region: "drives professional / state tax", leave_policy: "sets leave entitlements (edit in Policies & rules)",
  expense_policy: "sets expense limits (edit in Policies & rules)", attendance_mode: "decides which punch-in checks apply", field_staff: "Yes / No switch",
  call_tracking: "Yes / No switch", potential: "places the person on the 9-box grid", pay_basis: "decides how pay is calculated", payment_route: "payroll, invoice or vendor billing",
  gst_registered: "Yes / No switch", tds_section: "sets tax withholding rates", nda_signed: "Yes / No switch", pay_cycle: "payroll runs monthly", tax_regime: "sets income-tax slabs",
};
const PEOPLE = ["reporting_manager", "timesheet_approver"];
export function dropdownStatus(f, data) {
  if (f.type !== "select") return null;
  const n = (k) => listOptions(data, k).length;
  if (f.custom) return { tone: "good", short: "Custom · grow with +", long: `Custom dropdown (${n(f.key)} values) — add values with + here or in Dropdown lists.` };
  if (OPTION_LISTS[f.key]) return { tone: "good", short: "Grow with +", long: `List “${OPTION_LISTS[f.key].label}” (${n(f.key)} values) — add with + in the form or in Dropdown lists.` };
  if (MASTER_ADD[f.key]) return { tone: "info", short: "Master data · + Add new", long: `Choices are ${MASTER_ADD[f.key].label} records — the Super Admin can add one in place with “+ Add new ${MASTER_ADD[f.key].label}…”.` };
  if (PEOPLE.includes(f.key)) return { tone: "neutral", short: "People records", long: "Choices are current employees." };
  return { tone: "neutral", short: "Fixed rule values", long: `Fixed: ${FIXED_WHY[f.key] || "drives a rule"}.` };
}

const WHO = { super: "Super Admin", admin: "HR admin", self: "Employee" };

export default function FieldReference() {
  const { data } = useStore();
  const SECTIONS = sectionsWithCustom(data);
  const FIELDS = SECTIONS.flatMap((x) => x.fields.map((f) => ({ ...f, section: x.title, source: f.source || x.source })));
  const [q, setQ] = useState("");
  const [sec, setSec] = useState("all");
  const [selfOnly, setSelfOnly] = useState(false);
  const match = (f) => (!selfOnly || f.editableBy.includes("self")) && (!q || [f.key, f.label, f.rule, f.control].join(" ").toLowerCase().includes(q.toLowerCase()));
  const [ddOnly, setDdOnly] = useState(false);
  const match2 = (f) => match(f) && (!ddOnly || f.type === "select");
  const sections = SECTIONS.filter((s) => sec === "all" || s.id === sec).map((s) => ({ ...s, fields: s.fields.filter(match2) })).filter((s) => s.fields.length);
  return (
    <>
      <PageHeader
        eyebrow="SUPER ADMIN · DATA DICTIONARY"
        title="Field reference"
        subtitle="Every employee-master field: API name, label, type, control, validation, which worker types it applies to and who may edit it. The employee form and profile are built from this list — the worker type (permanent, contract, freelance …) decides which fields appear."
        actions={<Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv("employee-field-reference.csv", ["Section", "Source", "Field name", "UI label", "Data type", "Input control", "Required", "Applies to", "Validation", "Editable by", "Dropdown list"], FIELDS.map((f) => [f.section, f.source, `employee.${f.key}`, f.label, f.type, f.control, requiredFor(f), appliesTo(f, SECTIONS.find((x) => x.title === f.section)), f.rule, f.editableBy.map((w) => WHO[w]).join(", ") || "System", dropdownStatus(f, data)?.long || ""]))}>Export for Excel</Button>}
      />
      <Stack spacing={2.5}>
        <Grid min={160}>
          <StatCard label="Sections" value={EMPLOYEE_SECTIONS.length} />
          <StatCard label="Fields" value={FIELDS.length} tone="info" />
          <StatCard label="Dropdowns" value={FIELDS.filter((f) => f.type === "select").length} tone="info" />
          <StatCard label="Dropdowns you can grow" value={FIELDS.filter((f) => ["good", "info"].includes(dropdownStatus(f, data)?.tone)).length} tone="good" />
          <StatCard label="Required" value={FIELDS.filter((f) => f.required).length} tone="bad" />
          <StatCard label="Employee-editable" value={FIELDS.filter((f) => f.editableBy.includes("self")).length} tone="good" />
        </Grid>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ alignItems: { md: "center" } }}>
          <TextField placeholder="Search fields, labels or rules (e.g. date, PAN, IFSC)" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: { md: 360 }, background: "#fff" }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
          <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Chip size="small" label="All" color={sec === "all" ? "primary" : "default"} onClick={() => setSec("all")} />
            {SECTIONS.map((s) => <Chip key={s.id} size="small" label={s.title} color={sec === s.id ? "primary" : "default"} variant={sec === s.id ? "filled" : "outlined"} onClick={() => setSec(s.id)} />)}
            <Chip size="small" label="Dropdowns only" color={ddOnly ? "secondary" : "default"} variant={ddOnly ? "filled" : "outlined"} onClick={() => setDdOnly((v) => !v)} data-testid="fr-dropdowns" />
            <Chip size="small" label="Employee-editable only" color={selfOnly ? "secondary" : "default"} variant={selfOnly ? "filled" : "outlined"} onClick={() => setSelfOnly((v) => !v)} />
          </Stack>
        </Stack>
        {sections.map((s) => (
          <SectionCard key={s.id} title={s.title} subtitle={s.source} noPad>
            <TableWrap>
              <Table size="small" sx={{ minWidth: 1180, tableLayout: "fixed" }}>
                <TableHead><TableRow><TableCell sx={{ width: "15%" }}>Field name</TableCell><TableCell sx={{ width: "12%" }}>UI label</TableCell><TableCell sx={{ width: "7%" }}>Data type</TableCell><TableCell sx={{ width: "10%" }}>Input control</TableCell><TableCell sx={{ width: "20%" }}>Validation</TableCell><TableCell sx={{ width: "11%" }}>Applies to</TableCell><TableCell sx={{ width: "11%" }}>Editable by</TableCell><TableCell sx={{ width: "14%" }}>Dropdown list</TableCell></TableRow></TableHead>
                <TableBody>
                  {s.fields.map((f) => (
                    <TableRow key={f.key}>
                      <TableCell><Mono sx={{ overflowWrap: "anywhere" }}>employee.{f.key}</Mono></TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{f.label}{f.custom && <Tag tone="accent" sx={{ ml: 0.5 }}>Custom</Tag>}</TableCell>
                      <TableCell>{f.type}</TableCell>
                      <TableCell><Tag tone={f.editableBy.length ? "info" : "neutral"}>{f.control}</Tag></TableCell>
                      <TableCell>{(f.required || f.requiredFor) && <Box component="span" sx={{ color: "#d32f2f", fontWeight: 700, mr: 0.5 }}>{f.requiredFor ? `Required for ${requiredFor(f)}.` : "Required."}</Box>}{f.rule}</TableCell>
                      <TableCell><Tag tone={f.workers || s.workers ? "accent" : "neutral"}>{appliesTo(f, s)}</Tag></TableCell>
                      <TableCell>{f.editableBy.length ? f.editableBy.map((w) => WHO[w]).join(", ") : <Typography component="span" sx={{ fontSize: "0.6rem", color: "#78827b" }}>System</Typography>}</TableCell>
                      <TableCell data-testid={`fr-dd-${f.key}`}>{(() => { const d = dropdownStatus(f, data); return d ? <Box><Tag tone={d.tone}>{d.short}</Tag><Typography sx={{ fontSize: "0.56rem", color: "#78827b", mt: 0.3, lineHeight: 1.3 }}>{d.long}</Typography></Box> : <Typography component="span" sx={{ fontSize: "0.6rem", color: "#B8C0BA" }}>—</Typography>; })()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          </SectionCard>
        ))}
      </Stack>
    </>
  );
}
