// Type-to-search people picker (replaces long checkbox lists): matches any word of the name, the first letters,
// the job title, department or code, and shows the chosen people as chips.
import React from "react";
import { Autocomplete, Box, Chip, TextField, Typography } from "@mui/material";
import { Avatar } from "../PortalUI.jsx";

function matches(p, q) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const name = p.name.toLowerCase();
  const words = name.split(/[\s().-]+/).filter(Boolean);
  const initials = words.map((w) => w[0]).join("");
  return t.split(/\s+/).every((part) =>
    words.some((w) => w.startsWith(part)) || name.includes(part) || initials.startsWith(part) ||
    String(p.title || "").toLowerCase().includes(part) || String(p.dept || "").toLowerCase().includes(part) || String(p.code || "").toLowerCase() === part,
  );
}

/**
 * people: [{ code, name, title, dept, country }]; value: codes (multiple) or a code (single).
 */
export default function PeoplePicker({ people, value, onChange, label = "Invite", placeholder = "Type a name…", multiple = true, size = "small", helperText, autoFocus }) {
  const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name));
  const byCode = new Map(sorted.map((p) => [p.code, p]));
  const selected = multiple ? (value || []).map((c) => byCode.get(c) || { code: c, name: c }) : byCode.get(value) || null;
  return (
    <Autocomplete
      multiple={multiple}
      size={size}
      options={sorted}
      value={selected}
      onChange={(_, v) => onChange(multiple ? v.map((p) => p.code) : v?.code || "")}
      isOptionEqualToValue={(a, b) => a.code === b.code}
      getOptionLabel={(p) => p?.name || ""}
      filterOptions={(opts, { inputValue }) => opts.filter((p) => matches(p, inputValue)).slice(0, 50)}
      groupBy={(p) => p.name[0]?.toUpperCase() || "#"}
      filterSelectedOptions={multiple}
      autoHighlight
      openOnFocus={false}
      noOptionsText="No one matches – try first name, surname or initials"
      renderOption={(props, p) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Avatar name={p.name} size="small" />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 600 }}>{p.name}</Typography>
              <Typography sx={{ fontSize: "0.56rem", color: "#78827b" }} noWrap>{[p.title, p.dept, p.country && p.country !== "IN" ? p.country : null].filter(Boolean).join(" · ")}</Typography>
            </Box>
          </Box>
        );
      }}
      renderValue={multiple ? (vals, getItemProps) => vals.map((p, i) => { const { key, ...rest } = getItemProps({ index: i }); return <Chip key={key} size="small" label={p.name.split(" (")[0]} {...rest} />; }) : undefined}
      renderInput={(params) => <TextField {...params} label={label} placeholder={multiple && (value || []).length ? "" : placeholder} helperText={helperText} autoFocus={autoFocus} />}
    />
  );
}
