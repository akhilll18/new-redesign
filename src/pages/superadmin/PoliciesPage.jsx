// Super Admin: approval workflow per module, leave policy, expense policy, holidays, and the points masters.
import React, { useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormGroup, FormControlLabel, IconButton, InputLabel, MenuItem, Select, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { AddRounded, DeleteOutlineRounded, SaveRounded, ArrowForwardRounded, AccountTreeRounded } from "@mui/icons-material";
import { WorkforcePolicies } from "./OpsSuper.jsx";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, TableWrap, Mono } from "../../components/kit/UI.jsx";
import { FORM_TYPES } from "../../lib/forms.js";
import { REQUEST_TYPES, CHAIN_TOKENS, STANDARD_CHAINS, chainOptions, chainLabel, chainProblem, chainSteps, defaultChain } from "../../lib/requests.js";

function Workflow() {
  const { data, updateSettings, notifyToast } = useStore();
  // v10.11: who fills each admin step today. Steps are wired automatically when the Super Admin creates an admin.
  const approversFor = (module) => { const a = (data.admins || []).filter((x) => x.status === "active" && x.modules.includes(module) && x.permissions_scope.includes("approve")); return a.length ? a.map((x) => `${x.full_name} (${x.admin_code})`).join(", ") : "no admin yet — the Super Admin approves until one is created"; };
  // v10.11: every request type is listed (new ones start on their default chain), including asset purchase and IT support.
  const [wf, setWf] = useState(() => ({ ...Object.fromEntries(Object.keys(REQUEST_TYPES).map((m) => [m, defaultChain(m)])), ...data.settings.workflow }));
  // v10.12: the Super Admin's own chains, offered on every request type next to the standard ones
  const custom = data.settings.custom_chains || [];
  const [builder, setBuilder] = useState(false);
  const opts = (m) => chainOptions(m, { custom, keep: wf[m] });
  const removeCustom = (c) => {
    const used = Object.keys(REQUEST_TYPES).filter((m) => (data.settings.workflow?.[m] || defaultChain(m)) === c || wf[m] === c);
    if (used.length) return notifyToast(`In use for ${used.map((m) => REQUEST_TYPES[m].label).join(", ")}. Choose another chain there first.`, "error");
    updateSettings({ custom_chains: custom.filter((x) => x !== c) });
    notifyToast("Approval chain removed.");
  };
  return (
    <SectionCard title="Approval workflow" subtitle="Who approves each kind of request. Employees without an active manager go straight to the admin." action={<Stack direction="row" spacing={1}><Button size="small" variant="outlined" startIcon={<AddRounded />} onClick={() => setBuilder(true)} data-testid="chain-add">Add approval chain</Button><Button size="small" variant="contained" startIcon={<SaveRounded />} onClick={() => { const r = updateSettings({ workflow: wf }); notifyToast(r.changed ? "Workflow saved and audited." : "No changes."); }}>Save</Button></Stack>}>
      <Stack spacing={2}>
        {Object.keys(REQUEST_TYPES).map((m) => (
          <Stack key={m} direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
            <Typography sx={{ width: 160, flexShrink: 0, fontSize: "0.75rem", fontWeight: 700 }}>{REQUEST_TYPES[m].label}</Typography>
            <FormControl size="small" sx={{ minWidth: 280, width: { sm: 400 }, flexShrink: 0 }}>
              <InputLabel>Approval chain</InputLabel>
              <Select label="Approval chain" value={opts(m).includes(wf[m]) ? wf[m] : opts(m)[0]} onChange={(e) => (e.target.value === "__add" ? setBuilder(m) : setWf({ ...wf, [m]: e.target.value }))} data-testid={`chain-${m}`}>
                {opts(m).map((c) => <MenuItem key={c} value={c}>{chainLabel(c, m)}{!STANDARD_CHAINS.includes(c) && custom.includes(c) ? <Chip size="small" label="Custom" sx={{ ml: 1, height: 18, fontSize: "0.55rem" }} /> : null}</MenuItem>)}
                <MenuItem value="__add" sx={{ color: "primary.main", fontWeight: 700, borderTop: "1px solid #eef0ee" }}><AddRounded sx={{ fontSize: 18, mr: 1 }} />Add another approval chain…</MenuItem>
              </Select>
            </FormControl>
            <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>
              {FORM_TYPES[m]?.confidential
                ? "Confidential: never goes to the employee's reporting manager, whatever chain is chosen — the admin steps decide it."
                : m === "itsupport"
                ? "Tickets wait for every approver in the chain, then join the IT queue (admins with the “it” module). Critical issues and security incidents always go straight to IT."
                : !chainSteps(wf[m], m).some((st) => st.level === "admin")
                  ? "Only the reporting manager approves. If the employee has no active manager, it goes to the module's admin."
                  : `Each admin step goes to an active admin holding that module for the employee's org unit. Now: ${[...new Map(chainSteps(wf[m], m).filter((st) => st.level === "admin").map((st) => [st.label, approversFor(st.module)])).entries()].map(([l, who]) => `${l} → ${who}`).join(" · ") || "—"}.`}
            </Typography>
          </Stack>
        ))}
        {custom.length > 0 && (
          <Box sx={{ border: "1px solid #eef0ee", borderRadius: 2, p: 1.5 }} data-testid="custom-chains">
            <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, mb: 1 }}>Your approval chains</Typography>
            <Stack spacing={0.6}>
              {custom.map((c) => (
                <Stack key={c} direction="row" sx={{ alignItems: "center", gap: 1 }}>
                  <AccountTreeRounded sx={{ fontSize: 16, color: "#2e7d32" }} />
                  <Typography sx={{ fontSize: "0.66rem", flex: 1 }}>{c.split("_").map((k) => CHAIN_TOKENS.find(([x]) => x === k)?.[1] || k).join(" → ")}{c.split("_").length === 1 ? " only" : ""}</Typography>
                  <Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{Object.keys(REQUEST_TYPES).filter((m) => wf[m] === c).map((m) => REQUEST_TYPES[m].label).join(", ") || "Not used yet"}</Typography>
                  <IconButton size="small" aria-label="Remove chain" onClick={() => removeCustom(c)}><DeleteOutlineRounded sx={{ fontSize: 16 }} /></IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
        <Alert severity="info">Changes apply to new requests. Requests already in progress keep their steps.</Alert>
      </Stack>
      <ChainBuilder
        open={!!builder}
        forType={typeof builder === "string" ? builder : null}
        onClose={() => setBuilder(false)}
        onAdd={(chain, types) => {
          const nextWf = { ...wf, ...Object.fromEntries(types.map((m) => [m, chain])) };
          setWf(nextWf);
          const isNew = !STANDARD_CHAINS.includes(chain) && !custom.includes(chain);
          updateSettings({ ...(isNew ? { custom_chains: [...custom, chain] } : {}), ...(types.length ? { workflow: nextWf } : {}) });
          notifyToast(`Approval chain ${isNew ? "added" : "already exists"}${types.length ? ` and used for ${types.map((m) => REQUEST_TYPES[m].label).join(", ")}` : " — choose it for any request type"}. Saved and audited.`);
          setBuilder(false);
        }}
      />
    </SectionCard>
  );
}

// v10.12: build a new approval chain step by step and choose which request types use it.
function ChainBuilder({ open, forType, onClose, onAdd }) {
  const [steps, setSteps] = useState([]);
  const [types, setTypes] = useState([]);
  React.useEffect(() => { if (open) { setSteps(["manager"]); setTypes(forType ? [forType] : []); } }, [open, forType]);
  const chain = steps.join("_");
  const problem = chainProblem(chain);
  const canAdd = (k) => !steps.includes(k) && (k !== "manager" || steps.length === 0);
  const name = (k) => CHAIN_TOKENS.find(([x]) => x === k)?.[1] || k;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add an approval chain</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }} data-testid="chain-builder">
          <Typography sx={{ fontSize: "0.68rem", color: "#5c675f" }}>Add approvers in the order they should approve. A request moves to the next approver only after the one before approves; a rejection at any step ends it.</Typography>
          <Box>
            <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, mb: 0.8 }}>Steps</Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", alignItems: "center", gap: 0.6, minHeight: 34, p: 1, border: "1px dashed #cfd6d0", borderRadius: 2 }} data-testid="chain-steps">
              {steps.length === 0 && <Typography sx={{ fontSize: "0.62rem", color: "#9aa39c" }}>No approvers yet — add one below.</Typography>}
              {steps.map((k, i) => (
                <React.Fragment key={k}>
                  {i > 0 && <ArrowForwardRounded sx={{ fontSize: 16, color: "#9aa39c" }} />}
                  <Chip size="small" color="primary" variant="outlined" label={`${i + 1}. ${name(k)}`} onDelete={() => setSteps(steps.filter((x) => x !== k))} />
                </React.Fragment>
              ))}
            </Stack>
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, mb: 0.8 }}>Add a step</Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.8 }}>
              {CHAIN_TOKENS.map(([k, label, help]) => (
                <Button key={k} size="small" variant="outlined" startIcon={<AddRounded />} disabled={!canAdd(k)} title={help} onClick={() => setSteps([...steps, k])} data-testid={`chain-step-${k}`}>{label}</Button>
              ))}
            </Stack>
            <Typography sx={{ fontSize: "0.58rem", color: "#78827b", mt: 0.8 }}>Module admin = HR admin for leave and attendance, Finance admin for expenses, advances and loans, Asset admin for assets, IT admin for IT support.</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.62rem", fontWeight: 700 }}>Use it for (optional)</Typography>
            <FormGroup row>
              {Object.keys(REQUEST_TYPES).map((m) => (
                <FormControlLabel key={m} sx={{ width: { sm: "48%" }, mr: 0, "& .MuiFormControlLabel-label": { fontSize: "0.66rem" } }} control={<Checkbox size="small" checked={types.includes(m)} onChange={(e) => setTypes(e.target.checked ? [...types, m] : types.filter((x) => x !== m))} />} label={REQUEST_TYPES[m].label} />
              ))}
            </FormGroup>
          </Box>
          {chain && !problem && <Alert severity="success" sx={{ fontSize: "0.66rem" }}>Preview: {steps.map(name).join(" → ")}{steps.length === 1 ? " only" : ""}. It will also be offered in every request type's list.</Alert>}
          {problem && <Alert severity="warning" sx={{ fontSize: "0.66rem" }}>{problem}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!!problem} onClick={() => onAdd(chain, types)} data-testid="chain-save">Add chain</Button>
      </DialogActions>
    </Dialog>
  );
}

function EditableTable({ title, subtitle, rows: initial, columns, onSave, newRow, keyField }) {
  const [rows, setRows] = useState(initial);
  const [err, setErr] = useState("");
  const set = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <SectionCard title={title} subtitle={subtitle} action={<Stack direction="row" spacing={1}><Button size="small" startIcon={<AddRounded />} onClick={() => setRows([...rows, newRow()])}>Add</Button><Button size="small" variant="contained" startIcon={<SaveRounded />} onClick={() => { const e = onSave(rows); setErr(e || ""); }}>Save</Button></Stack>} noPad>
      {err && <Alert severity="error" sx={{ m: 1.5 }}>{err}</Alert>}
      <TableWrap>
        <Table size="small" sx={{ minWidth: 760 }}>
          <TableHead><TableRow>{columns.map((c) => <TableCell key={c.key} align={c.type === "number" ? "right" : "left"}>{c.label}</TableCell>)}<TableCell /></TableRow></TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={`${r[keyField]}-${i}`}>
                {columns.map((c) => (
                  <TableCell key={c.key} sx={{ minWidth: c.width || 90 }}>
                    {c.type === "bool" ? (
                      <Switch size="small" checked={!!r[c.key]} onChange={(e) => set(i, c.key, e.target.checked)} />
                    ) : c.type === "select" ? (
                      <Select size="small" value={r[c.key] ?? ""} onChange={(e) => set(i, c.key, e.target.value)} sx={{ fontSize: "0.65rem", minWidth: 110 }}>{c.options.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</Select>
                    ) : c.readOnlyExisting && i < initial.length ? (
                      <Mono>{r[c.key]}</Mono>
                    ) : (
                      <TextField size="small" type={c.type === "date" ? "date" : "text"} value={r[c.key] ?? ""} onChange={(e) => set(i, c.key, c.type === "number" ? (e.target.value === "" ? "" : e.target.value.replace(/[^\d]/g, "")) : e.target.value)} slotProps={{ htmlInput: { style: { fontSize: "0.65rem", textAlign: c.type === "number" ? "right" : "left" } } }} />
                    )}
                  </TableCell>
                ))}
                <TableCell><IconButton size="small" aria-label="Remove row" onClick={() => setRows(rows.filter((_, j) => j !== i))}><DeleteOutlineRounded fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrap>
    </SectionCard>
  );
}

export default function PoliciesPage() {
  const { data, updateMaster, notifyToast } = useStore();
  const [tab, setTab] = useState("workflow");
  return (
    <>
      <PageHeader eyebrow="SUPER ADMIN · CONFIGURATION" title="Policies & rules" subtitle="Approval chains, leave and expense policies and holidays. Every save is written to the audit log." />
      <Box sx={{ mb: 2, borderBottom: "1px solid #e5eae4" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
          <Tab value="workflow" label="Approval workflow" sx={{ fontSize: "0.7rem" }} />
          <Tab value="leave" label="Leave policy" sx={{ fontSize: "0.7rem" }} />
          <Tab value="expense" label="Expense policy" sx={{ fontSize: "0.7rem" }} />
          <Tab value="holidays" label="Holidays" sx={{ fontSize: "0.7rem" }} />
          <Tab value="workforce" label="Attendance, calls & assets" sx={{ fontSize: "0.7rem" }} />
        </Tabs>
      </Box>
      {tab === "workflow" && <Workflow />}
      {tab === "workforce" && <WorkforcePolicies />}
      {tab === "leave" && (
        <EditableTable
          title="Leave types"
          subtitle="Annual entitlement is pro-rated for joiners. Blank “Per year” means unpaid (Loss of pay)."
          keyField="code"
          rows={data.leaveTypes}
          newRow={() => ({ code: "", name: "", annual: 0, carry_forward: 0, min_notice_days: 1, doc_after_days: "", active: true })}
          columns={[
            { key: "code", label: "Code", readOnlyExisting: true, width: 70 },
            { key: "name", label: "Name", width: 160 },
            { key: "annual", label: "Per year", type: "number" },
            { key: "carry_forward", label: "Carry forward", type: "number" },
            { key: "min_notice_days", label: "Notice (days)", type: "number" },
            { key: "doc_after_days", label: "Certificate after (days)", type: "number" },
            { key: "floater_only", label: "Floater only", type: "bool" },
            { key: "active", label: "Active", type: "bool" },
          ]}
          onSave={(rows) => {
            if (rows.some((r) => !r.code || !r.name)) return "Every leave type needs a code and a name.";
            if (new Set(rows.map((r) => r.code)).size !== rows.length) return "Leave codes must be unique.";
            updateMaster("leaveTypes", rows.map((r) => ({ ...r, code: r.code.toUpperCase(), annual: r.annual === "" || r.annual == null ? null : Number(r.annual), carry_forward: Number(r.carry_forward || 0), min_notice_days: Number(r.min_notice_days || 0), doc_after_days: r.doc_after_days === "" || r.doc_after_days == null ? null : Number(r.doc_after_days) })));
            notifyToast("Leave policy saved.");
            return "";
          }}
        />
      )}
      {tab === "expense" && (
        <EditableTable
          title="Expense categories"
          subtitle="Limit applies per expense line. Receipts are always needed where marked, otherwise above the receipt threshold in System settings."
          keyField="code"
          rows={data.expenseCategories}
          newRow={() => ({ code: "", name: "", limit: 1000, receipt_always: true })}
          columns={[
            { key: "code", label: "Code", readOnlyExisting: true, width: 80 },
            { key: "name", label: "Category", width: 220 },
            { key: "limit", label: "Limit (₹)", type: "number" },
            { key: "receipt_always", label: "Receipt always", type: "bool" },
          ]}
          onSave={(rows) => {
            if (rows.some((r) => !r.code || !r.name || !(Number(r.limit) > 0))) return "Each category needs a code, a name and a limit above 0.";
            updateMaster("expenseCategories", rows.map((r) => ({ ...r, code: r.code.toUpperCase(), limit: Number(r.limit) })));
            notifyToast("Expense policy saved.");
            return "";
          }}
        />
      )}
      {tab === "holidays" && (
        <EditableTable
          title="Holiday calendar"
          subtitle="Holidays are excluded from leave days. Floater holidays can be taken with Floater leave."
          keyField="date"
          rows={data.holidays}
          newRow={() => ({ date: "", name: "", type: "holiday" })}
          columns={[
            { key: "date", label: "Date", type: "date", width: 150 },
            { key: "name", label: "Name", width: 200 },
            { key: "type", label: "Type", type: "select", options: [["holiday", "Holiday"], ["floater", "Floater"]] },
          ]}
          onSave={(rows) => {
            if (rows.some((r) => !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !r.name)) return "Each holiday needs a date and a name.";
            updateMaster("holidays", [...rows].sort((a, b) => a.date.localeCompare(b.date)));
            notifyToast("Holiday calendar saved.");
            return "";
          }}
        />
      )}
      <FormControlLabel sx={{ display: "none" }} control={<Switch />} label="" />
    </>
  );
}
