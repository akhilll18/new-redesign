// Renders one employee-master field (from data/employeeFields.js) as the right control.
import { useStore } from "../../store/AppStore.jsx";
import { MASTER_ADD_VALUE, MasterAddDialog, canMasterAdd, masterAddItem } from "./MasterAdd.jsx";
import React, { useRef, useState } from "react";
import { FormControl, FormHelperText, IconButton, InputAdornment, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import { CalendarMonthRounded } from "@mui/icons-material";
import { REGIONS, COUNTRIES, isRequired, RATE_UNIT } from "../../data/employeeFields.js";
import { OPTION_LISTS } from "../../lib/optionLists.js";
import ListSelect from "./ListSelect.jsx";

const SYMBOL = { INR: "₹", GBP: "£", USD: "$", EUR: "€", AED: "AED", SGD: "S$" };
export const currencySymbol = (rec) => { const c = COUNTRIES.find((x) => x.code === (rec?.country_code || "IN"))?.currency || "INR"; return SYMBOL[c] || c; };

export function fieldOptions(f, rec, { orgUnits, employees, geofences = [], vendors = [], companies = [], locations = [] }) {
  if (f.options === "companies") return [["", "Choose a company"], ...companies.filter((c) => c.status !== "inactive" || c.company_id === rec.company_id).map((c) => [c.company_id, `${c.short} · ${c.name}`])];
  if (f.options === "locations") return [["", "Choose a location"], ...locations.filter((l) => (!rec.company_id || l.company_id === rec.company_id) && (l.status !== "inactive" || l.location_id === rec.location_id)).map((l) => [l.location_id, `${l.name}${l.city ? ` · ${l.city}` : ""}`])];
  if (f.options === "vendors") return [["", "Choose a vendor"], ...vendors.filter((v) => v.status !== "inactive").map((v) => [v.id, `${v.name} · markup ${v.markup_pct}%`])];
  if (f.options === "geofences") return geofences.map((g) => [g.id, g.name]);
  if (f.options === "departments") return orgUnits.map((o) => [o.org_unit_id, o.name]);
  if (f.options === "managers") return [["", "No manager"], ...employees.filter((e) => e.employee_code !== rec.employee_code && e.status === "active").map((e) => [e.employee_code, `${e.full_name} (${e.employee_code})`])];
  if (f.options === "regions") return REGIONS[rec.country_code || "IN"] || [];
  return f.options || [];
}

// v10.15: dropdowns fed by master data get "+ Add new …" (Super Admin) — the record is created in place and picked.
function PlainSelect({ f, label, value, onChange, disabled, error, ctx, rec }) {
  const { user } = useStore();
  const [adding, setAdding] = useState(false);
  const opts = fieldOptions(f, rec, ctx);
  const v = value == null ? "" : String(value);
  const nativeBloodGroup = f.key === "blood_group";
  const canAdd = canMasterAdd(user, f.key) && !disabled;
  return (
    <>
      <FormControl size="small" fullWidth disabled={disabled} error={!!error}>
        <InputLabel>{label}</InputLabel>
        <Select native={nativeBloodGroup} label={label} value={opts.some(([o]) => String(o) === v) ? v : ""} onChange={(e) => (e.target.value === MASTER_ADD_VALUE ? setAdding(true) : onChange(e.target.value))} data-testid={`field-${f.key}`}>
          {nativeBloodGroup
            ? [<option key="" value="">Choose blood group</option>, ...opts.map(([o, l]) => <option key={o} value={String(o)}>{l}</option>)]
            : opts.map(([o, l]) => <MenuItem key={o} value={String(o)}>{l}</MenuItem>)}
          {canAdd && masterAddItem(f.key)}
        </Select>
        <FormHelperText>{error || " "}</FormHelperText>
      </FormControl>
      {canAdd && <MasterAddDialog fieldKey={f.key} open={adding} rec={rec} onClose={() => setAdding(false)} onAdded={(id) => onChange(id)} />}
    </>
  );
}

export default function FieldInput({ f, value, onChange, disabled, error, ctx, rec }) {
  const label = `${f.label}${isRequired(f, rec || {}) ? " *" : ""}`;
  const datePickerRef = useRef(null);
  // v10.3: country (and with it currency, tax engine and payslip) is frozen to the work location's country.
  const lockLoc = f.key === "country_code" && rec?.location_id ? (ctx?.locations || []).find((l) => l.location_id === rec.location_id) : null;
  if (lockLoc && ctx?.lockCountry !== false) {
    const c = COUNTRIES.find((x) => x.code === lockLoc.country);
    return (
      <TextField label={`${f.label} · locked to location`} value={`${c?.name || lockLoc.country} · ${c?.currency || ""}`} disabled helperText={`Follows ${lockLoc.name}. Change the location to change country & currency.`} />
    );
  }
  // v10.13: lists the Super Admin / owning admin can grow with "+ Add …" (grade, notice period, method of recruitment)
  if (f.type === "select" && (OPTION_LISTS[f.key] || f.custom)) {
    return <ListSelect listKey={f.key} base={fieldOptions(f, rec, ctx)} size="small" label={label} required={false} value={value == null ? "" : String(value)} onChange={onChange} disabled={disabled} error={!!error} helperText={error || " "} />;
  }
  if (f.type === "select") return <PlainSelect f={f} label={label} value={value} onChange={onChange} disabled={disabled} error={error} ctx={ctx} rec={rec} />;
  if (f.key === "date_of_birth") {
    const display = /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
      ? `${String(value).slice(8, 10)}-${String(value).slice(5, 7)}-${String(value).slice(0, 4)}`
      : value || "";
    const isoValue = /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? value : "";
    return (
      <>
        <TextField
          label={label}
          value={display}
          disabled={disabled}
          placeholder="dd-mm-yyyy"
          error={!!error}
          helperText={error || " "}
          onChange={(e) => {
            const typed = e.target.value;
            const match = typed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
            if (!match) return onChange(typed);
            const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
            onChange(date.getUTCFullYear() === Number(match[3]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[1])
              ? `${match[3]}-${match[2]}-${match[1]}`
              : typed);
          }}
          slotProps={{
            input: { endAdornment: <InputAdornment position="end"><IconButton aria-label="Open date picker" size="small" disabled={disabled} onClick={() => datePickerRef.current?.showPicker?.()}><CalendarMonthRounded fontSize="small" /></IconButton></InputAdornment> },
            htmlInput: { maxLength: 10, inputMode: "numeric" },
          }}
        />
        <input ref={datePickerRef} type="date" value={isoValue} onChange={(e) => {
          onChange(e.target.value);
        }} disabled={disabled} aria-label="Date of birth calendar" style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
      </>
    );
  }
  if (f.key === "pan") {
    return (
      <TextField
        label={label}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        error={!!error}
        helperText={error || " "}
        placeholder="ABCDE1234F"
        slotProps={{ htmlInput: { maxLength: 10 } }}
      />
    );
  }
  return (
    <TextField
      label={label}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(f.type === "number" ? e.target.value.replace(/[^\d.]/g, "") : e.target.value)}
      type={f.type === "date" ? "date" : f.type === "email" ? "email" : "text"}
      multiline={f.type === "textarea"}
      minRows={f.type === "textarea" ? 2 : undefined}
      error={!!error}
      helperText={error || " "}
      slotProps={{
        inputLabel: f.type === "date" ? { shrink: true } : undefined,
        input: f.key === "monthly_gross" || f.key === "recruitment_cost" || f.key === "pay_rate"
          ? { startAdornment: <InputAdornment position="start">{f.key === "recruitment_cost" ? "₹" : currencySymbol(rec)}</InputAdornment>, endAdornment: f.key === "pay_rate" && rec?.pay_basis ? <InputAdornment position="end">{RATE_UNIT[rec.pay_basis]}</InputAdornment> : undefined }
          : undefined,
        htmlInput: { maxLength: f.max || undefined, inputMode: f.type === "number" ? "decimal" : f.type === "tel" ? "tel" : undefined },
      }}
    />
  );
}
