// v10.14 · Legal entity dropdown for forms. Lists the companies (legal entities) the signed-in user may see and
// starts on the one picked in the header, so new records land in the entity being worked on — and show up under
// that entity in reports and exports.
import React, { useEffect } from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { useStore } from "../../store/AppStore.jsx";
import { ALL } from "../../data/entities.js";

/** The header's company when one is picked, else the only company the user can see, else "". */
export function useDefaultEntity() {
  const { entityScope, entityAccess } = useStore();
  const cs = entityAccess?.companies || [];
  if (entityScope?.company && entityScope.company !== ALL && cs.some((c) => c.company_id === entityScope.company)) return entityScope.company;
  return cs.length === 1 ? cs[0].company_id : "";
}

export default function EntitySelect({ value, onChange, label = "Legal entity", required = false, allowAll = false, size = "small", fullWidth = true, disabled, autoDefault = true, ...rest }) {
  const { entityAccess } = useStore();
  const cs = entityAccess?.companies || [];
  const def = useDefaultEntity();
  // Fill the header's entity in once, for a new record that has none yet.
  useEffect(() => { if (autoDefault && !value && def) onChange(def); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cs.length) return null;
  return (
    <FormControl size={size} fullWidth={fullWidth} disabled={disabled} required={required}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value || ""} onChange={(e) => onChange(e.target.value)} data-testid="entity-select" {...rest}>
        {allowAll && <MenuItem value="">All legal entities</MenuItem>}
        {!allowAll && !required && <MenuItem value=""><em>Not tied to one entity</em></MenuItem>}
        {cs.map((c) => <MenuItem key={c.company_id} value={c.company_id}>{c.short} · {c.name}</MenuItem>)}
      </Select>
    </FormControl>
  );
}
