// v10.13 · A dropdown whose list can grow. The last item, "+ Add …", is shown to the Super Admin (every list) and to the
// admin who looks after the list (their modules). The new value is saved for the whole account, audited, and selected here.
import React, { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from "@mui/material";
import { AddRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { OPTION_LISTS, canEditList, listDef, listOptions } from "../../lib/optionLists.js";

const ADD = "__add_option__";

/** Hook: [[value, label]] for a list, plus whether this user may add to it. */
export function useListOptions(key, base) {
  const { data, user } = useStore();
  return { options: listOptions(data, key, base), canAdd: canEditList(user, data, key) };
}

/** Dialog to add one value to a list. onAdded(value) is called after it is saved. */
export function AddOptionDialog({ listKey, base, open, onClose, onAdded }) {
  const { addListOption, notifyToast, data } = useStore();
  const def = listDef(listKey, data);
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  React.useEffect(() => { if (open) { setV(""); setErr(""); } }, [open]);
  const save = () => {
    const r = addListOption(listKey, v, base);
    if (!r.ok) return setErr(r.error);
    notifyToast(`“${r.value}” added to ${def.label}. It now appears wherever this list is used.`);
    onAdded?.(r.value);
    onClose();
  };
  if (!def) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add to {def.label.toLowerCase()}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: "0.74rem" }}>Used in: {def.used}. Everyone will see the new value; the change is written to the audit log.</Typography>
        <TextField autoFocus fullWidth size="small" label={def.numeric === true ? "Number of days" : def.numeric ? `New value (${def.numeric.hint})` : "New value"} value={v} onChange={(e) => { setV(e.target.value); setErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} error={!!err} helperText={err || " "} slotProps={{ htmlInput: { "data-testid": "add-option-input", maxLength: 60 } }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" startIcon={<AddRounded />} onClick={save} data-testid="add-option-save">Add</Button>
      </DialogActions>
    </Dialog>
  );
}

/** The menu items to put inside any existing <Select>/<TextField select>: the options, then "+ Add …" when allowed.
 *  Pair with onChange: (e) => isAddValue(e.target.value) ? openDialog() : set(e.target.value). */
export const isAddValue = (v) => v === ADD;
export function addMenuItem(listKey, data) {
  const def = OPTION_LISTS[listKey] || (data ? listDef(listKey, data) : null) || { label: "list" };
  return <MenuItem key={ADD} value={ADD} data-testid={`add-option-${listKey}`} sx={{ color: "primary.main", fontWeight: 700, borderTop: "1px solid #EEF1EE" }}><AddRounded sx={{ fontSize: 18, mr: 1 }} />Add to {def?.label.toLowerCase() || "list"}…</MenuItem>;
}

/** A complete TextField select bound to a growable list. */
export default function ListSelect({ listKey, base, value, onChange, label, required, blank, error, helperText, size, fullWidth = true, disabled, sx, ...rest }) {
  const { options, canAdd } = useListOptions(listKey, base);
  const { data } = useStore();
  const [adding, setAdding] = useState(false);
  const known = options.some(([o]) => o === String(value ?? ""));
  return (
    <>
      <TextField
        select fullWidth={fullWidth} size={size} sx={sx} disabled={disabled} label={label} required={required} error={error} helperText={helperText}
        value={value ?? ""}
        onChange={(e) => (isAddValue(e.target.value) ? setAdding(true) : onChange(e.target.value))}
        slotProps={{ select: { "data-testid": `list-${listKey}` } }}
        {...rest}
      >
        {!required && blank !== false && <MenuItem value=""><em>—</em></MenuItem>}
        {value && !known && <MenuItem value={value}>{value}</MenuItem>}
        {options.map(([o, l]) => <MenuItem key={o} value={o}>{l}</MenuItem>)}
        {canAdd && addMenuItem(listKey, data)}
      </TextField>
      <AddOptionDialog listKey={listKey} base={base} open={adding} onClose={() => setAdding(false)} onAdded={(v) => onChange(v)} />
    </>
  );
}
