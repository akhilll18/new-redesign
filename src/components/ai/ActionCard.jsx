// v10.10 · EZY HR AI — the preview card for an action: every value the AI read is shown and editable; the user clicks
// Confirm to save. Reports, answers and "open a screen" run straight away (nothing is changed).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Chip, CircularProgress, FormControlLabel, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { CheckCircleRounded, ErrorOutlineRounded, DownloadRounded, OpenInNewRounded, BoltRounded } from "@mui/icons-material";
import { ACTION_BY } from "../../ai/agent/actions.js";
import { withDefaults } from "../../ai/agent/plan.js";
import { AiText } from "./AiText.jsx";

const fs = { "& .MuiInputBase-input": { fontSize: "0.68rem", py: 0.8 }, "& .MuiInputLabel-root": { fontSize: "0.66rem" }, "& .MuiFormHelperText-root": { fontSize: "0.56rem", mx: 0.4 } };
const csvCell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function downloadCsv(name, columns, rows) {
  const body = [columns.map(([, l]) => csvCell(l)).join(","), ...rows.map((r) => columns.map(([k]) => csvCell(r[k])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  a.download = `${name.replace(/[^\w]+/g, "-").toLowerCase()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function ActionCard({ msg, ctx, onUpdate, onNavigate }) {
  const action = ACTION_BY[msg.plan.action];
  const [values, setValues] = useState(() => msg.plan.values || {});
  const [busy, setBusy] = useState(false);
  const [fieldErr, setFieldErr] = useState({});
  const result = msg.result;
  const ran = useRef(false);
  const fields = useMemo(() => { try { return action.fields(values, ctx) || []; } catch { return []; } }, [action, values, ctx]);
  const missing = fields.filter((f) => f.required && f.type !== "info" && (values[f.key] === undefined || values[f.key] === "" || values[f.key] === null));

  async function confirm() {
    setBusy(true);
    let r;
    try { r = await action.run(values, ctx); } catch (e) { r = { ok: false, error: e.message || "Something went wrong." }; }
    setBusy(false);
    if (r?.fieldErrors) setFieldErr(r.fieldErrors);
    onUpdate({ ...msg, plan: { ...msg.plan, values }, result: { ok: !!r?.ok, message: r?.ok ? r.message : r?.error, link: r?.link, table: r?.table ? { ...r.table, rows: r.table.rows.slice(0, 500), total: r.table.rows.length } : null } });
  }
  // reports, answers and navigation run at once
  useEffect(() => {
    if (ran.current || result || action.kind === "write") return;
    ran.current = true;
    if (action.kind === "nav" || !missing.length) confirm();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // a field the user typed in is theirs; fields with a derived default (code from name, currency from country…) follow
  const touched = useRef(new Set());
  const set = (k, v) => {
    touched.current.add(k);
    setFieldErr((e) => ({ ...e, [k]: undefined }));
    setValues((cur) => {
      const next = { ...cur, [k]: v };
      let fl = [];
      try { fl = action.fields(next, ctx) || []; } catch { fl = []; }
      for (const f of fl) if (f.default !== undefined && !touched.current.has(f.key)) next[f.key] = f.default;
      return next;
    });
  };

  if (!action) return null;
  const done = result?.ok;
  const editable = !done && action.kind === "write";
  const rows = result?.table?.rows || [];
  return (
    <Box data-testid="ai-action-card" data-action={action.id} data-state={done ? "done" : result ? "failed" : "open"} sx={{ alignSelf: "stretch", borderRadius: "14px", border: `1px solid ${done ? "#bfe3cf" : result && !result.ok ? "#f2c9bd" : "#cfe0ea"}`, background: "#fff", overflow: "hidden" }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.8, px: 1.4, py: 0.9, background: done ? "#effaf3" : "#f3f8fb", borderBottom: "1px solid #e6eef2" }}>
        <BoltRounded sx={{ fontSize: 16, color: "#1E88E5" }} />
        <Typography sx={{ fontWeight: 800, fontSize: "0.72rem", flex: 1 }}>{action.title}</Typography>
        <Chip size="small" label={msg.plan.by === "Claude" ? "Read by Claude" : "EZY HR AI"} sx={{ height: 18, fontSize: "0.52rem" }} />
      </Stack>
      {(editable || (action.kind === "read" && !result && fields.length > 0)) && fields.length > 0 && (
        <Box sx={{ p: 1.2, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          {fields.map((f) => {
            const full = f.type === "info" || ["full_name", "name", "description", "subject", "value", "who", "report", "role", "label", "note"].includes(f.key);
            const err = fieldErr[f.key] || (f.required && msg.tried && (values[f.key] === undefined || values[f.key] === ""));
            if (f.type === "info") return <Box key={f.key} sx={{ gridColumn: "1 / -1", p: 0.8, borderRadius: 1, background: "#f7f9fa", fontSize: "0.6rem", whiteSpace: "pre-wrap", color: "#4a5a60" }}><b>{f.label}</b>{"\n"}{f.value}</Box>;
            if (f.type === "bool") return <FormControlLabel key={f.key} sx={{ gridColumn: full ? "1 / -1" : "auto", m: 0 }} control={<Switch size="small" checked={!!values[f.key]} onChange={(e) => set(f.key, e.target.checked)} />} label={<Typography sx={{ fontSize: "0.64rem" }}>{f.label}</Typography>} />;
            return (
              <TextField key={f.key} data-field={f.key} data-required={f.required ? "1" : "0"} data-kind={f.type || "text"} data-empty={values[f.key] === undefined || values[f.key] === "" ? "1" : "0"} size="small" sx={{ ...fs, gridColumn: full ? "1 / -1" : "auto" }} label={`${f.label}${f.required ? " *" : ""}`} value={values[f.key] ?? ""}
                select={f.type === "select" && !!f.options?.length} type={f.type === "date" ? "date" : f.type === "number" ? "number" : f.type === "email" ? "email" : "text"}
                onChange={(e) => set(f.key, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                error={!!err} helperText={typeof fieldErr[f.key] === "string" ? fieldErr[f.key] : f.help || (f.more ? "Required by the employee master" : "")}
                slotProps={{ inputLabel: { shrink: true }, select: { MenuProps: { slotProps: { root: { "data-ai-ui": true } } } } }}>
                {f.type === "select" && (f.options || []).map(([k, l]) => <MenuItem key={`${k}`} value={k} sx={{ fontSize: "0.68rem" }}>{l}</MenuItem>)}
              </TextField>
            );
          })}
        </Box>
      )}
      {result && (
        <Box sx={{ px: 1.4, py: 1, display: "flex", gap: 0.8, alignItems: "flex-start", borderTop: editable ? "1px solid #f0f3f4" : "none" }}>
          {result.ok ? <CheckCircleRounded sx={{ fontSize: 17, color: "#1F9D63", mt: 0.1 }} /> : <ErrorOutlineRounded sx={{ fontSize: 17, color: "#E53950", mt: 0.1 }} />}
          <Box data-testid="ai-result" sx={{ flex: 1, fontSize: "0.68rem", minWidth: 0 }}><AiText text={result.message || ""} onNavigate={onNavigate} /></Box>
        </Box>
      )}
      {rows.length > 0 && (
        <Box sx={{ px: 1.2, pb: 1 }}>
          <Box sx={{ overflowX: "auto", border: "1px solid #eef1f2", borderRadius: 1.5 }}>
            <Table size="small" sx={{ "& td, & th": { fontSize: "0.58rem", py: 0.5, px: 0.8, whiteSpace: "nowrap" } }}>
              <TableHead><TableRow>{result.table.columns.map(([k, l]) => <TableCell key={k} sx={{ fontWeight: 800 }}>{l}</TableCell>)}</TableRow></TableHead>
              <TableBody>{rows.slice(0, 8).map((r, i) => <TableRow key={i}>{result.table.columns.map(([k]) => <TableCell key={k}>{r[k] == null ? "" : String(r[k])}</TableCell>)}</TableRow>)}</TableBody>
            </Table>
          </Box>
          <Typography sx={{ fontSize: "0.55rem", color: "#7b878c", mt: 0.4 }}>Showing {Math.min(8, rows.length)} of {result.table.total}.</Typography>
        </Box>
      )}
      <Stack direction="row" sx={{ gap: 0.8, px: 1.2, pb: 1.2, pt: result ? 0 : 0.2, flexWrap: "wrap" }}>
        {editable && <Button data-testid="ai-confirm" size="small" variant="contained" disabled={busy} onClick={() => (missing.length ? onUpdate({ ...msg, tried: true }) : confirm())} startIcon={busy ? <CircularProgress size={12} color="inherit" /> : <CheckCircleRounded sx={{ fontSize: 15 }} />}>{busy ? "Saving…" : missing.length ? `Fill ${missing.length} required field${missing.length > 1 ? "s" : ""}` : "Confirm"}</Button>}
        {editable && !result && <Button size="small" onClick={() => onUpdate({ ...msg, result: { ok: false, message: "Cancelled — nothing was changed." } })}>Cancel</Button>}
        {action.kind === "read" && !result && <Button size="small" variant="contained" disabled={busy || missing.length > 0} onClick={confirm}>Run</Button>}
        {rows.length > 0 && <Button size="small" startIcon={<DownloadRounded sx={{ fontSize: 15 }} />} onClick={() => downloadCsv(result.table.name, result.table.columns, result.table.rows)}>Download CSV</Button>}
        {result?.link && <Button size="small" endIcon={<OpenInNewRounded sx={{ fontSize: 14 }} />} onClick={() => onNavigate(result.link.to)}>{result.link.label}</Button>}
      </Stack>
    </Box>
  );
}
