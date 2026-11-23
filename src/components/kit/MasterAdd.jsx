// v10.15 · "+ Add new …" for dropdowns fed by master data (department, company, location, geofence, staffing vendor).
// Opens a small form in place — the half-filled form behind it stays as it is — saves through the same store actions
// the master screens use (validation, audit, permissions), then picks the new record in the dropdown.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from "@mui/material";
import { AddRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import ActionCard from "../ai/ActionCard.jsx";
import { ACTION_BY } from "../../ai/agent/actions.js";
import { withDefaults } from "../../ai/agent/plan.js";

export const MASTER_ADD = {
  department: { label: "department", action: "create_department", ids: (d) => (d.orgUnits || []).map((o) => o.org_unit_id) },
  company_id: { label: "company (legal entity)", action: "create_company", ids: (d) => (d.companies || []).map((c) => c.company_id) },
  location_id: { label: "location / branch", action: "create_location", ids: (d) => (d.workLocations || []).map((l) => l.location_id), prefill: (rec) => ({ company_id: rec?.company_id || "" }) },
  primary_geofence: { label: "geofence", action: "create_geofence", ids: (d) => (d.geofences || []).map((g) => g.id) },
  vendor_id: { label: "staffing vendor", vendor: true, ids: (d) => (d.contractVendors || []).map((v) => v.id) },
};
export const MASTER_ADD_VALUE = "__master_add__";

/** Who may add master data from a form: the Super Admin (the same people the master screens allow). */
export function canMasterAdd(user, key) {
  return !!MASTER_ADD[key] && user?.role === "superadmin";
}

export function masterAddItem(key) {
  return (
    <MenuItem key={MASTER_ADD_VALUE} value={MASTER_ADD_VALUE} data-testid={`master-add-${key}`} sx={{ color: "primary.main", fontWeight: 700, borderTop: "1px solid #EEF1EE" }}>
      <AddRounded sx={{ fontSize: 18, mr: 1 }} />Add new {MASTER_ADD[key].label}…
    </MenuItem>
  );
}

export function MasterAddDialog({ fieldKey, open, rec, onClose, onAdded }) {
  const store = useStore();
  const { data, user } = store;
  const def = MASTER_ADD[fieldKey];
  const before = useRef([]);
  const [msg, setMsg] = useState(null);
  const [vendor, setVendor] = useState({ name: "", markup_pct: "10", gstin: "" });
  const [err, setErr] = useState("");
  const ctx = useMemo(() => ({ store, data, user, leaveTypes: data.leaveTypes || [], navigate: () => {}, nav: [] }), [store, data, user]);

  useEffect(() => {
    if (!open || !def) return;
    before.current = def.ids(data);
    setErr(""); setVendor({ name: "", markup_pct: "10", gstin: "" });
    if (def.action) {
      const a = ACTION_BY[def.action];
      setMsg({ id: `master-${Date.now()}`, kind: "action", plan: { action: def.action, values: withDefaults(a, { ...(def.prefill?.(rec) || {}) }, ctx) } });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a successful save, pick the record that was just created.
  const picked = useRef(false);
  useEffect(() => { picked.current = false; }, [open]);
  useEffect(() => {
    if (!open || picked.current || !(msg?.result?.ok)) return;
    const fresh = def.ids(data).filter((id) => !before.current.includes(id));
    if (fresh.length) { picked.current = true; onAdded(fresh[fresh.length - 1]); setTimeout(onClose, 900); }
  }, [msg, data, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveVendor = () => {
    const r = store.upsertVendor({ name: vendor.name, markup_pct: vendor.markup_pct, gstin: vendor.gstin, status: "active" });
    if (!r?.ok) return setErr(r?.error || "Could not save.");
    store.notifyToast?.(`Vendor ${vendor.name.trim()} added.`);
    setTimeout(() => {
      const fresh = def.ids(store.data).filter((id) => !before.current.includes(id));
      if (fresh.length) onAdded(fresh[fresh.length - 1]);
    }, 0);
    onClose();
  };

  if (!def) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add new {def.label}</DialogTitle>
      <DialogContent data-testid="master-add-dialog">
        {def.action && msg && <ActionCard msg={msg} ctx={ctx} onUpdate={setMsg} onNavigate={() => {}} />}
        {def.vendor && (
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField size="small" autoFocus label="Vendor name *" value={vendor.name} onChange={(e) => setVendor({ ...vendor, name: e.target.value })} />
            <TextField size="small" label="Markup % *" value={vendor.markup_pct} onChange={(e) => setVendor({ ...vendor, markup_pct: e.target.value.replace(/[^\d.]/g, "") })} helperText="0–100. Added on top of the worker's rate on the vendor's invoice." />
            <TextField size="small" label="GSTIN (optional)" value={vendor.gstin} onChange={(e) => setVendor({ ...vendor, gstin: e.target.value })} helperText="15 characters, like 36AACCT7781M1ZQ." />
            {err && <Alert severity="error">{err}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>{msg?.result ? "Close" : "Cancel"}</Button>
        {def.vendor && <Button variant="contained" startIcon={<AddRounded />} onClick={saveVendor} data-testid="master-add-save">Add vendor</Button>}
      </DialogActions>
    </Dialog>
  );
}
