// Payslip design studio (v8.7): admins (payslips / payroll) and Super Admins build the organisation's payslip format.
// • Start from a built-in layout (classic, modern, SAP-style statement, Oracle-style pay advice, compact, minimal) or
//   upload your own format (HTML, or Word .docx converted to HTML), a picture of it (as a background to trace), or a design file (.json).
// • Brand it: colour presets and every colour, fonts, logo, letterhead, background, watermark, signature, footer and notes.
// • Choose sections, rename every label, pick / reorder / rename employee fields, paper size, density and borders.
// • Live preview with any employee's real payslip; save drafts, publish, keep versions, and assign designs by worker type and country.
import React, { useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, IconButton, InputLabel, List, ListItemButton,
  ListItemText, MenuItem, Select, Slider, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import {
  AddRounded, UploadFileRounded, DownloadRounded, ContentCopyRounded, DeleteOutlineRounded, PublishRounded, SaveRounded, ArrowUpwardRounded, ArrowDownwardRounded,
  RestoreRounded, LockRounded, LockOpenRounded, PrintRounded, CloseRounded, AutoFixHighRounded,
} from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, Tag, EmptyState } from "../kit/UI.jsx";
import DocFrame from "./DocFrame.jsx";
import { AiButton, useAiRun } from "../collab/aiKit.jsx";
import {
  LAYOUTS, FONTS, COLOR_PRESETS, COLOR_KEYS, SECTION_KEYS, DEFAULT_LABELS, ALL_EMP_FIELDS, PLACEHOLDERS, WORKER_RULE_OPTIONS,
  defaultDesign, renderPayslipHtml, samplePayslip, autoMapTemplate, sanitizeTemplate, designFor,
} from "../../data/payslipDesign.js";
import { PAYMENT_MODE_LABEL } from "../../data/payslipFields.js";
import { COUNTRIES } from "../../data/employeeFields.js";
import { payslipYtd } from "./PayslipDocument.jsx";
import { fmtDateTime, readFileAsDataUrl, saveFile } from "../../lib/utils.js";

const LABEL_FIELDS = Object.keys(DEFAULT_LABELS);
const LABEL_NAMES = { title: "Document title", employee: "Employee section", days: "Salary days section", earnings: "Earnings", contributions: "Contributions", deductions: "Taxes & deductions", reimbursements: "Reimbursements", details: "Additional details", totalEarnings: "Total earnings", totalContributions: "Total contributions", totalDeductions: "Total taxes & deductions", totalReimbursements: "Total reimbursements", gross: "Gross earnings", allDeductions: "Total deductions", net: "Net salary line", payable: "Total net payable", words: "Amount in words", ytd: "Year to date", signature: "Signature caption" };
const EDIT_TABS = [["layout", "Layout"], ["brand", "Colours"], ["type", "Typography"], ["header", "Logo & header"], ["sections", "Sections & labels"], ["fields", "Employee fields"], ["extras", "Watermark, signature & notes"], ["page", "Page"], ["custom", "Custom format"], ["versions", "Versions"]];

function usePreviewSlip(empCode) {
  const { data } = useStore();
  return useMemo(() => {
    const e = data.employees.find((x) => x.employee_code === empCode);
    const real = (data.payslipBatches || []).filter((b) => b.status !== "Rejected").flatMap((b) => b.slips.filter((s) => s.employee_code === empCode).map((s) => ({ s, b }))).sort((a, z) => z.b.period.localeCompare(a.b.period))[0];
    if (real) return { slip: real.s, batch: real.b, liveEmp: e, ytd: payslipYtd(data, empCode, real.b.period), real: true };
    const snap = e ? { ...e, payment_mode: PAYMENT_MODE_LABEL[e.payment_mode] || e.payment_mode } : undefined;
    const sp = samplePayslip(data.payslipComponents, snap);
    return { ...sp, liveEmp: e, ytd: { gross: 234880, deductions: 18750, tax: 7875, payable: 216130, lines: { BASIC: 116666, HRA: 46666, SPECIAL: 70000, PF_EE: 7200, PT: 800, TDS: 4500 } }, real: false };
  }, [data, empCode]);
}

export default function PayslipDesigner() {
  const { data, user, saveDesign, duplicateDesign, setDesignStatus, deleteDesign, updateDesignRules, canDesignPayslips, notifyToast } = useStore();
  const designs = data.payslipDesigns || [];
  const rules = data.payslipDesignRules || {};
  const can = canDesignPayslips();
  const [selId, setSelId] = useState(rules.default_id || designs[0]?.id);
  const [draft, setDraft] = useState(null); // working copy of the selected design
  const [newDlg, setNewDlg] = useState(false);
  const sel = designs.find((d) => d.id === selId);
  const cur = draft && draft.id === selId ? draft : sel;
  const dirty = draft && sel && draft.id === sel.id && JSON.stringify({ ...draft, versions: 0, history: 0 }) !== JSON.stringify({ ...sel, versions: 0, history: 0 });
  const edit = (patch) => setDraft((d) => ({ ...(d && d.id === selId ? d : JSON.parse(JSON.stringify(sel))), ...patch }));
  const run = (r, ok) => { notifyToast(r.ok ? ok : r.error, r.ok ? "success" : "error"); return r.ok; };
  const usedBy = (id) => [rules.default_id === id && "Default", ...Object.entries(rules.by_worker || {}).filter(([, v]) => v === id).map(([k]) => WORKER_RULE_OPTIONS.find(([w]) => w === k)?.[1]), ...Object.entries(rules.by_country || {}).filter(([, v]) => v === id).map(([k]) => COUNTRIES.find((c) => c.code === k)?.name), rules.advice_id === id && "Payment advices & contracts"].filter(Boolean);

  return (
    <Stack spacing={2.5}>
      {!can && <Alert severity="info" icon={<LockRounded />}>{rules.locked_to_super ? "A Super Admin has locked payslip designs. You can preview them." : "You can preview designs. HR (payslips), Finance (payroll) and Super Admins can change them."}</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "280px minmax(0,1fr)" }, gap: 2.5, alignItems: "start" }}>
        <Stack spacing={2.5}>
          <SectionCard title="Designs" noPad action={can && <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setNewDlg(true)}>New</Button>}>
            <List dense sx={{ py: 0 }}>
              {designs.map((d) => (
                <ListItemButton key={d.id} selected={d.id === selId} onClick={() => { if (dirty && !window.confirm("Discard unsaved changes?")) return; setSelId(d.id); setDraft(null); }} sx={{ borderBottom: "1px solid #e6ece5", alignItems: "flex-start", py: 1 }}>
                  <Box sx={{ width: 34, height: 44, borderRadius: 0.5, mr: 1.2, mt: 0.3, flexShrink: 0, border: "1px solid #e6ece5", background: d.colors.pageBg, position: "relative", overflow: "hidden" }}>
                    <Box sx={{ position: "absolute", inset: "0 0 auto", height: "22%", background: d.colors.headerBg }} />
                    <Box sx={{ position: "absolute", left: 4, right: 4, top: "30%", height: 3, background: d.colors.primary, borderRadius: 1 }} />
                    <Box sx={{ position: "absolute", left: 4, right: 12, top: "50%", height: 2, background: d.colors.border }} />
                    <Box sx={{ position: "absolute", left: 4, right: 4, bottom: 5, height: 6, background: d.colors.netBg, borderRadius: 0.5 }} />
                  </Box>
                  <ListItemText primary={d.name} secondary={<>{d.kind === "custom_html" ? "Your uploaded format" : LAYOUTS.find((l) => l.id === d.layout)?.name}<br />{usedBy(d.id).join(" · ") || (d.status === "active" ? "Published · not assigned" : "Draft")}</>} slotProps={{ primary: { sx: { fontSize: "0.7rem", fontWeight: 700 } }, secondary: { sx: { fontSize: "0.58rem" } } }} />
                  {d.status !== "active" && <Tag tone="neutral" sx={{ ml: 0.5 }}>Draft</Tag>}
                </ListItemButton>
              ))}
            </List>
          </SectionCard>
          <RulesCard designs={designs} rules={rules} can={can} isSuper={user.role === "superadmin"} onSave={(p) => run(updateDesignRules(p), "Assignment saved.")} />
        </Stack>
        {cur ? (
          <Editor key={cur.id} d={cur} can={can} dirty={!!dirty} edit={edit}
            onSave={(publish) => { if (run(saveDesign(cur, { publish }), publish ? "Published. Payslips now use this design where it is assigned." : "Draft saved.")) setDraft(null); }}
            onDuplicate={() => { const r = duplicateDesign(cur.id); if (run(r, "Copy created.")) { setSelId(r.id); setDraft(null); } }}
            onDelete={() => { if (window.confirm(`Delete “${cur.name}”?`) && run(deleteDesign(cur.id), "Design deleted.")) { setSelId(rules.default_id); setDraft(null); } }}
            onStatus={(st) => run(setDesignStatus(cur.id, st), st === "active" ? "Published." : "Moved to drafts.")}
            onDiscard={() => setDraft(null)}
          />
        ) : <SectionCard><EmptyState title="No design selected" text="Create a design or pick one on the left." /></SectionCard>}
      </Box>
      {newDlg && <NewDesignDialog onClose={() => setNewDlg(false)} onCreated={(id) => { setNewDlg(false); setSelId(id); setDraft(null); }} />}
    </Stack>
  );
}

// ─────────────── Assignment rules ───────────────
function RulesCard({ designs, rules, can, isSuper, onSave }) {
  const [r, setR] = useState(() => ({ default_id: rules.default_id, advice_id: rules.advice_id, by_worker: { ...(rules.by_worker || {}) }, by_country: { ...(rules.by_country || {}) } }));
  const active = designs.filter((d) => d.status === "active");
  const pick = (value, onChange, label, allowNone = true) => (
    <FormControl size="small" fullWidth disabled={!can}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value || ""} onChange={(e) => onChange(e.target.value)}>
        {allowNone && <MenuItem value=""><em>Use default</em></MenuItem>}
        {active.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
      </Select>
    </FormControl>
  );
  const countries = [...new Set([...Object.keys(r.by_country), "GB", "US", "AE"])];
  return (
    <SectionCard title="Who gets which design" subtitle="Country beats worker type beats default" action={can && <Button size="small" variant="contained" onClick={() => onSave({ ...r, by_worker: Object.fromEntries(Object.entries(r.by_worker).filter(([, v]) => v)), by_country: Object.fromEntries(Object.entries(r.by_country).filter(([, v]) => v)) })}>Save</Button>}>
      <Stack spacing={1.4}>
        {pick(r.default_id, (v) => setR({ ...r, default_id: v }), "Default (everyone)", false)}
        {pick(r.advice_id, (v) => setR({ ...r, advice_id: v }), "Payment advices, invoices & contracts")}
        <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, pt: 0.5 }}>By worker type</Typography>
        {WORKER_RULE_OPTIONS.filter(([k]) => !["freelance", "consultant", "agency"].includes(k)).map(([k, l]) => <Box key={k}>{pick(r.by_worker[k], (v) => setR({ ...r, by_worker: { ...r.by_worker, [k]: v } }), l)}</Box>)}
        <Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>Freelancers, consultants and agency workers get payment advices, not payslips.</Typography>
        <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, pt: 0.5 }}>By country</Typography>
        {countries.map((k) => <Box key={k}>{pick(r.by_country[k], (v) => setR({ ...r, by_country: { ...r.by_country, [k]: v } }), COUNTRIES.find((c) => c.code === k)?.name || k)}</Box>)}
        <FormControl size="small" disabled={!can}><InputLabel>Add a country rule</InputLabel><Select label="Add a country rule" value="" onChange={(e) => setR({ ...r, by_country: { ...r.by_country, [e.target.value]: r.default_id } })}>{COUNTRIES.filter((c) => !countries.includes(c.code)).map((c) => <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>)}</Select></FormControl>
        {isSuper && <><Divider /><FormControlLabel control={<Switch checked={!!rules.locked_to_super} onChange={(e) => onSave({ locked_to_super: e.target.checked })} />} label={<Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>{rules.locked_to_super ? <LockRounded sx={{ fontSize: 16 }} /> : <LockOpenRounded sx={{ fontSize: 16 }} />}<Typography variant="body2">Only Super Admins can change designs</Typography></Stack>} /></>}
      </Stack>
    </SectionCard>
  );
}

// ─────────────── New design ───────────────
function NewDesignDialog({ onClose, onCreated }) {
  const { data, saveDesign, notifyToast } = useStore();
  const [layout, setLayout] = useState("modern");
  const [preset, setPreset] = useState("onas");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);
  const sample = useMemo(() => samplePayslip(data.payslipComponents), [data.payslipComponents]);
  const base = data.payslipDesigns?.find((d) => d.id === data.payslipDesignRules?.default_id);
  const company = data.settings.payslip_company;
  const create = (design) => {
    const r = saveDesign({ ...design, id: undefined, status: "draft" });
    notifyToast(r.ok ? "Design created as a draft. Adjust it, then publish." : r.error, r.ok ? "success" : "error");
    if (r.ok) onCreated(r.id);
  };
  async function onFile(f) {
    setMsg("");
    if (!f) return;
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    const common = { name: name.trim() || f.name.replace(/\.[^.]+$/, ""), colors: { ...(COLOR_PRESETS.find((p) => p.id === preset) || COLOR_PRESETS[0]).colors }, preset, header: { ...defaultDesign().header, logo: base?.header?.logo || null }, source: { name: f.name, size: f.size, uploaded_at: new Date().toISOString() } };
    try {
      setBusy(true);
      if (ext === "json") {
        if (f.size > 2 * 1048576) return setMsg("Design files must be under 2 MB.");
        const j = JSON.parse(await f.text());
        if (!j || typeof j !== "object" || !j.colors) return setMsg("That is not an EZY HR payslip design file.");
        delete j.id; delete j.versions; delete j.history;
        return create({ ...defaultDesign(), ...j, name: j.name ? `${j.name} (imported)` : common.name, source: common.source });
      }
      if (["html", "htm"].includes(ext) || ext === "docx") {
        if (f.size > 2 * 1048576) return setMsg("Upload a file under 2 MB.");
        let html;
        if (ext === "docx") {
          const mammoth = await import("mammoth/mammoth.browser.js");
          const out = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() });
          html = `<div class="docx">${out.value}</div>`;
        } else html = await f.text();
        const mapped = autoMapTemplate(sanitizeTemplate(html));
        return create({ ...defaultDesign(), ...common, kind: "custom_html", layout: "classic", html: mapped.html, css: ext === "docx" ? ".docx table{width:100%;border-collapse:collapse}.docx td,.docx th{border:1px solid var(--b);padding:5px 7px;vertical-align:top}.docx p{margin:2px 0}.docx h1,.docx h2,.docx h3{color:var(--p)}" : "", mapping: mapped.mapped });
      }
      if (["png", "jpg", "jpeg", "svg"].includes(ext)) {
        if (f.size > 600 * 1024) return setMsg("Use an image under 600 KB.");
        const url = await readFileAsDataUrl(f);
        return create({ ...defaultDesign(), ...common, layout, header: { ...common.header, background: url, backgroundOpacity: 0.18 }, description: `Built on a picture of ${f.name}: trace it with the closest layout, then remove the background.` });
      }
      setMsg("Upload .html, .docx, .json or an image (.png / .jpg / .svg). For a PDF, save a page as an image or open it in Word and save as .docx.");
    } catch (e) {
      setMsg(`Could not read that file: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center" }}><Box sx={{ flex: 1 }}>New payslip design</Box><IconButton onClick={onClose}><CloseRounded /></IconButton></DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
            <TextField size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Group payslip 2027" sx={{ minWidth: 260 }} />
            <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap" }}>{COLOR_PRESETS.map((p) => <Chip key={p.id} label={p.name} onClick={() => setPreset(p.id)} variant={preset === p.id ? "filled" : "outlined"} color={preset === p.id ? "primary" : "default"} size="small" avatar={<Box sx={{ width: 14, height: 14, borderRadius: "50%", background: p.colors.primary, ml: "6px !important" }} />} />)}</Stack>
          </Stack>
          <Typography variant="h3">1 · Start from a layout</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
            {LAYOUTS.map((l) => {
              const d = { ...defaultDesign(), layout: l.id, colors: { ...(COLOR_PRESETS.find((p) => p.id === preset) || COLOR_PRESETS[0]).colors }, header: { ...defaultDesign().header, logo: base?.header?.logo || null } };
              return (
                <Box key={l.id} onClick={() => setLayout(l.id)} sx={{ cursor: "pointer", border: layout === l.id ? "2px solid #244d3d" : "1px solid #e6ece5", borderRadius: 1.5, overflow: "hidden", background: "#fff" }}>
                  <Box sx={{ height: 210, overflow: "hidden", pointerEvents: "none", background: "#f4f6f3" }}><DocFrame html={renderPayslipHtml({ ...sample, company, design: d })} scale={0.42} minHeight={480} sx={{ border: 0, boxShadow: "none" }} /></Box>
                  <Box sx={{ p: 1 }}><Typography sx={{ fontSize: "0.7rem", fontWeight: 800 }}>{l.name}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#66716a" }}>{l.desc}</Typography></Box>
                </Box>
              );
            })}
          </Box>
          <Stack direction="row" spacing={1}><Button variant="contained" onClick={() => create({ ...defaultDesign(), name: name.trim() || `${LAYOUTS.find((l) => l.id === layout).name} design`, description: "", layout, preset, colors: { ...(COLOR_PRESETS.find((p) => p.id === preset) || COLOR_PRESETS[0]).colors }, header: { ...defaultDesign().header, logo: base?.header?.logo || null }, history: [], versions: [] })}>Create from “{LAYOUTS.find((l) => l.id === layout).name}”</Button></Stack>
          <Divider />
          <Typography variant="h3">2 · …or upload your organisation's own payslip format</Typography>
          <Typography variant="body2" color="text.secondary">
            <b>Word (.docx)</b> or <b>HTML</b>: your layout is kept and we replace the sample values next to labels we recognise (Employee name, Basic, HRA, PF, TDS, Net pay …) with live fields — you can add or adjust {"{{placeholders}}"} afterwards. <b>Image</b> (.png / .jpg): used as a background so you can match it with a layout. <b>.json</b>: a design exported from PeopleHub.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button variant="outlined" startIcon={<UploadFileRounded />} disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Reading…" : "Upload format"}</Button>
            <input ref={fileRef} hidden type="file" accept=".html,.htm,.docx,.json,.png,.jpg,.jpeg,.svg" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </Stack>
          {msg && <Alert severity="error" sx={{ fontSize: "0.66rem" }}>{msg}</Alert>}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────── Editor ───────────────
function Editor({ d, can, dirty, edit, onSave, onDuplicate, onDelete, onStatus, onDiscard }) {
  const { data, restoreDesignVersion, notifyToast } = useStore();
  const [tab, setTab] = useState(d.kind === "custom_html" ? "custom" : "layout");
  const [emp, setEmp] = useState("EMP001");
  const [audience, setAudience] = useState("employee");
  const frame = useRef(null);
  const pv = usePreviewSlip(emp);
  const html = useMemo(() => renderPayslipHtml({ slip: pv.slip, batch: pv.batch, company: data.settings.payslip_company, design: d, audience, liveEmp: pv.liveEmp, ytd: pv.ytd }), [pv, d, audience, data.settings.payslip_company]);
  const assignedNow = designFor(data, pv.liveEmp || {});
  const set = (k, v) => edit({ [k]: v });
  const setIn = (k, sub, v) => edit({ [k]: { ...d[k], [sub]: v } });
  const dis = !can;
  const img = async (file, max, apply) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/.test(file.type)) return notifyToast("Use a PNG, JPG, SVG or WebP image.", "error");
    if (file.size > max * 1024) return notifyToast(`Use an image under ${max} KB.`, "error");
    apply(await readFileAsDataUrl(file));
  };
  const ImgField = ({ label, value, max, onChange, help }) => {
    const ref = useRef(null);
    return (
      <Box>
        <Typography sx={{ fontSize: "0.64rem", fontWeight: 700, mb: 0.5 }}>{label}</Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Box sx={{ width: 120, height: 48, border: "1px dashed #cfd8d1", borderRadius: 1, display: "grid", placeItems: "center", background: "#fafbf9", overflow: "hidden" }}>{value ? <Box component="img" src={value} alt="" sx={{ maxWidth: "100%", maxHeight: "100%" }} /> : <Typography variant="caption" color="text.secondary">None</Typography>}</Box>
          <Button size="small" variant="outlined" disabled={dis} onClick={() => ref.current?.click()}>Upload</Button>
          {value && <Button size="small" color="error" disabled={dis} onClick={() => onChange(null)}>Remove</Button>}
          <input ref={ref} hidden type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => { img(e.target.files?.[0], max, onChange); e.target.value = ""; }} />
        </Stack>
        {help && <Typography sx={{ fontSize: "0.56rem", color: "#78827b", mt: 0.3 }}>{help}</Typography>}
      </Box>
    );
  };
  const exportJson = async () => {
    const o = JSON.parse(JSON.stringify(d));
    delete o.versions; delete o.history;
    await saveFile(`payslip-design-${d.name.replace(/[^\w-]+/g, "-")}.json`, JSON.stringify(o, null, 2), "application/json");
  };
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "400px minmax(0,1fr)" }, gap: 2.5, alignItems: "start" }}>
      <SectionCard noPad title={d.name || "Untitled design"} subtitle={`${d.id} · ${d.status === "active" ? "Published" : "Draft"} · updated ${fmtDateTime(d.updated_at)}`}>
        <Box sx={{ px: 1.5, pt: 1.5 }}><TextField size="small" fullWidth label="Design name" value={d.name} disabled={dis} onChange={(e) => set("name", e.target.value)} /></Box>
        <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: "wrap", p: 1.5, borderBottom: "1px solid #e6ece5" }}>
          <Button size="small" variant="contained" startIcon={<PublishRounded />} disabled={dis || (!dirty && d.status === "active")} onClick={() => onSave(true)}>{d.status === "active" ? "Publish changes" : "Publish"}</Button>
          <Button size="small" variant="outlined" startIcon={<SaveRounded />} disabled={dis || !dirty} onClick={() => onSave(false)}>Save draft</Button>
          {dirty && <Button size="small" color="inherit" onClick={onDiscard}>Discard</Button>}
          <Tooltip title="Duplicate"><span><IconButton size="small" disabled={dis} onClick={onDuplicate}><ContentCopyRounded fontSize="small" /></IconButton></span></Tooltip>
          <Tooltip title="Export design (.json)"><IconButton size="small" onClick={exportJson}><DownloadRounded fontSize="small" /></IconButton></Tooltip>
          {d.status === "active" && <Button size="small" color="inherit" disabled={dis} onClick={() => onStatus("draft")}>Unpublish</Button>}
          <Tooltip title="Delete"><span><IconButton size="small" color="error" disabled={dis} onClick={onDelete}><DeleteOutlineRounded fontSize="small" /></IconButton></span></Tooltip>
        </Stack>
        {dirty && <Alert severity="warning" sx={{ borderRadius: 0, fontSize: "0.64rem", py: 0 }}>Unsaved changes — the preview shows them; payslips change only when you publish.</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: "130px minmax(0,1fr)" }}>
          <Tabs orientation="vertical" value={tab} onChange={(_, v) => setTab(v)} sx={{ borderRight: "1px solid #e6ece5", "& .MuiTab-root": { alignItems: "flex-start", textAlign: "left", minHeight: 36, fontSize: "0.64rem", px: 1.5 } }}>
            {EDIT_TABS.map(([k, l]) => <Tab key={k} value={k} label={l} />)}
          </Tabs>
          <Box sx={{ p: 1.8, minWidth: 0 }}>
            <fieldset disabled={dis} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
              {tab === "layout" && (
                <Stack spacing={1.2}>
                  <FormControl size="small"><InputLabel>Type</InputLabel><Select label="Type" value={d.kind} onChange={(e) => set("kind", e.target.value)}><MenuItem value="layout">Built-in layout</MenuItem><MenuItem value="custom_html" disabled={!d.html}>My uploaded format{!d.html ? " (upload under Custom format)" : ""}</MenuItem></Select></FormControl>
                  {LAYOUTS.map((l) => (
                    <Box key={l.id} onClick={() => !dis && edit({ layout: l.id, kind: "layout" })} sx={{ cursor: dis ? "default" : "pointer", p: 1, borderRadius: 1, border: d.layout === l.id && d.kind === "layout" ? "2px solid #244d3d" : "1px solid #e6ece5" }}>
                      <Typography sx={{ fontSize: "0.68rem", fontWeight: 800 }}>{l.name}</Typography>
                      <Typography sx={{ fontSize: "0.58rem", color: "#66716a" }}>{l.desc}</Typography>
                    </Box>
                  ))}
                  <TextField size="small" multiline minRows={2} label="Description" value={d.description || ""} onChange={(e) => set("description", e.target.value)} />
                </Stack>
              )}
              {tab === "brand" && (
                <Stack spacing={1.4}>
                  <Typography sx={{ fontSize: "0.64rem", fontWeight: 700 }}>Presets</Typography>
                  <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap" }}>{COLOR_PRESETS.map((p) => <Chip key={p.id} size="small" label={p.name} disabled={dis} onClick={() => edit({ colors: { ...p.colors }, preset: p.id })} variant={d.preset === p.id ? "filled" : "outlined"} avatar={<Box sx={{ width: 12, height: 12, borderRadius: "50%", background: p.colors.primary, border: `2px solid ${p.colors.accent}`, ml: "6px !important" }} />} />)}</Stack>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                    {COLOR_KEYS.map(([k, l]) => (
                      <Stack key={k} direction="row" spacing={0.8} sx={{ alignItems: "center" }}>
                        <Box component="input" type="color" value={d.colors[k]} disabled={dis} onChange={(e) => edit({ colors: { ...d.colors, [k]: e.target.value.toUpperCase() }, preset: "custom" })} aria-label={l} sx={{ width: 30, height: 28, p: 0, border: "1px solid #d5ddd6", borderRadius: 0.5, background: "none", cursor: "pointer" }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: "0.58rem", lineHeight: 1.2 }}>{l}</Typography>
                          <TextField variant="standard" value={d.colors[k]} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && edit({ colors: { ...d.colors, [k]: e.target.value.toUpperCase() }, preset: "custom" })} slotProps={{ htmlInput: { style: { fontSize: 11,  padding: 0 } } }} />
                        </Box>
                      </Stack>
                    ))}
                  </Box>
                  <Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>Tip: pick your brand colour as Primary and a light tint of it for the table heading and net-pay box. Monochrome prints best on office printers.</Typography>
                </Stack>
              )}
              {tab === "type" && (
                <Stack spacing={1.6}>
                  <FormControl size="small"><InputLabel>Font</InputLabel><Select label="Font" value={d.font.family} onChange={(e) => setIn("font", "family", e.target.value)}>{FONTS.map(([v, l]) => <MenuItem key={v} value={v} sx={{  }}>{l}</MenuItem>)}</Select></FormControl>
                  <TextField size="small" label="Custom font stack (optional)" value={FONTS.some(([v]) => v === d.font.family) ? "" : d.font.family} onChange={(e) => e.target.value && setIn("font", "family", e.target.value)} helperText="e.g. 'Lato', Arial, sans-serif — must be installed on the viewer's device" />
                  <Box><Typography sx={{ fontSize: "0.64rem" }}>Base size: {d.font.size}px</Typography><Slider size="small" min={9} max={15} step={0.5} value={Number(d.font.size)} onChange={(_, v) => setIn("font", "size", v)} disabled={dis} /></Box>
                  <FormControl size="small"><InputLabel>Heading weight</InputLabel><Select label="Heading weight" value={d.font.headingWeight} onChange={(e) => setIn("font", "headingWeight", e.target.value)}>{[[400, "Regular"], [600, "Semibold"], [700, "Bold"], [800, "Extra bold"]].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</Select></FormControl>
                  <FormControlLabel control={<Switch checked={d.font.uppercaseHeadings !== false} onChange={(e) => setIn("font", "uppercaseHeadings", e.target.checked)} />} label={<Typography variant="body2">UPPERCASE headings and labels</Typography>} />
                </Stack>
              )}
              {tab === "header" && (
                <Stack spacing={1.6}>
                  <ImgField label="Logo" value={d.header.logo} max={300} onChange={(v) => setIn("header", "logo", v)} help={d.header.logo ? "" : "Empty = the company logo from Payslip settings"} />
                  <Box><Typography sx={{ fontSize: "0.64rem" }}>Logo height: {d.header.logoSize}px</Typography><Slider size="small" min={24} max={90} value={Number(d.header.logoSize)} onChange={(_, v) => setIn("header", "logoSize", v)} disabled={dis} /></Box>
                  <FormControl size="small"><InputLabel>Logo position</InputLabel><Select label="Logo position" value={d.header.logoPosition} onChange={(e) => setIn("header", "logoPosition", e.target.value)}><MenuItem value="left">Left, title right</MenuItem><MenuItem value="right">Right, title left</MenuItem><MenuItem value="center">Centred above the title</MenuItem></Select></FormControl>
                  <TextField size="small" label="Company name override" value={d.header.companyNameOverride} onChange={(e) => setIn("header", "companyNameOverride", e.target.value)} helperText="e.g. a subsidiary's legal name. Blank = from Payslip settings." />
                  <FormControlLabel control={<Switch checked={!!d.header.showPeriod} onChange={(e) => setIn("header", "showPeriod", e.target.checked)} />} label={<Typography variant="body2">Show the pay month in the title</Typography>} />
                  <Divider />
                  <ImgField label="Letterhead (full-width banner)" value={d.header.letterhead} max={500} onChange={(v) => setIn("header", "letterhead", v)} help="Your printed letterhead as an image. Sits above the header, or replaces it." />
                  {d.header.letterhead && <><FormControlLabel control={<Switch checked={!!d.header.letterheadReplacesHeader} onChange={(e) => setIn("header", "letterheadReplacesHeader", e.target.checked)} />} label={<Typography variant="body2">Letterhead replaces the logo header</Typography>} /><Box><Typography sx={{ fontSize: "0.64rem" }}>Letterhead max height: {d.header.letterheadHeight}px</Typography><Slider size="small" min={50} max={220} value={Number(d.header.letterheadHeight)} onChange={(_, v) => setIn("header", "letterheadHeight", v)} disabled={dis} /></Box></>}
                  <ImgField label="Page background" value={d.header.background} max={600} onChange={(v) => setIn("header", "background", v)} help="A security pattern, or a picture of your old payslip to trace." />
                  {d.header.background && <Box><Typography sx={{ fontSize: "0.64rem" }}>Background strength: {Math.round(d.header.backgroundOpacity * 100)}%</Typography><Slider size="small" min={0.02} max={0.6} step={0.01} value={Number(d.header.backgroundOpacity)} onChange={(_, v) => setIn("header", "backgroundOpacity", v)} disabled={dis} /></Box>}
                </Stack>
              )}
              {tab === "sections" && (
                <Stack spacing={1.2}>
                  <Typography sx={{ fontSize: "0.64rem", fontWeight: 700 }}>Show</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    {SECTION_KEYS.map(([k, l]) => <FormControlLabel key={k} control={<Checkbox size="small" checked={!!d.sections[k]} onChange={(e) => edit({ sections: { ...d.sections, [k]: e.target.checked } })} />} label={<Typography sx={{ fontSize: "0.62rem" }}>{l}</Typography>} />)}
                  </Box>
                  <FormControlLabel control={<Switch checked={d.currency?.hideZeroLines !== false} onChange={(e) => setIn("currency", "hideZeroLines", e.target.checked)} />} label={<Typography variant="body2">Hide optional lines that are zero</Typography>} />
                  <Divider />
                  <Typography sx={{ fontSize: "0.64rem", fontWeight: 700 }}>Labels</Typography>
                  {LABEL_FIELDS.map((k) => <TextField key={k} size="small" label={LABEL_NAMES[k] || k} value={d.labels[k] ?? ""} onChange={(e) => edit({ labels: { ...d.labels, [k]: e.target.value } })} />)}
                  <Button size="small" onClick={() => edit({ labels: { ...DEFAULT_LABELS } })}>Reset labels</Button>
                </Stack>
              )}
              {tab === "fields" && <EmpFields d={d} edit={edit} dis={dis} />}
              {tab === "extras" && (
                <Stack spacing={1.6}>
                  <TextField size="small" label="Watermark text" value={d.watermark.text} onChange={(e) => setIn("watermark", "text", e.target.value)} placeholder="CONFIDENTIAL" />
                  {d.watermark.text && <Box><Typography sx={{ fontSize: "0.64rem" }}>Watermark strength: {Math.round(d.watermark.opacity * 100)}%</Typography><Slider size="small" min={0.02} max={0.25} step={0.01} value={Number(d.watermark.opacity)} onChange={(_, v) => setIn("watermark", "opacity", v)} disabled={dis} /></Box>}
                  <Divider />
                  <FormControlLabel control={<Switch checked={!!d.sections.signature} onChange={(e) => edit({ sections: { ...d.sections, signature: e.target.checked } })} />} label={<Typography variant="body2">Authorised signature block</Typography>} />
                  {d.sections.signature && <>
                    <ImgField label="Signature image" value={d.signature.image} max={150} onChange={(v) => setIn("signature", "image", v)} help="Transparent PNG works best." />
                    <TextField size="small" label="Signatory name" value={d.signature.name} onChange={(e) => setIn("signature", "name", e.target.value)} />
                    <TextField size="small" label="Signatory title" value={d.signature.title} onChange={(e) => setIn("signature", "title", e.target.value)} />
                  </>}
                  <Divider />
                  <FormControlLabel control={<Switch checked={!!d.sections.notes} onChange={(e) => edit({ sections: { ...d.sections, notes: e.target.checked } })} />} label={<Typography variant="body2">Message on every payslip</Typography>} />
                  {d.sections.notes && <TextField size="small" multiline minRows={2} label="Message" value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Tax declarations for FY 2026-27 close on 15 January." />}
                  <TextField size="small" multiline minRows={2} label="Footer text" value={d.footer.text} onChange={(e) => setIn("footer", "text", e.target.value)} helperText="Blank = footer from Payslip settings" />
                  <FormControlLabel control={<Switch checked={!!d.footer.showGenerated} onChange={(e) => setIn("footer", "showGenerated", e.target.checked)} />} label={<Typography variant="body2">Print “Generated on” date</Typography>} />
                </Stack>
              )}
              {tab === "page" && (
                <Stack spacing={1.6}>
                  <FormControl size="small"><InputLabel>Paper</InputLabel><Select label="Paper" value={d.paper} onChange={(e) => set("paper", e.target.value)}><MenuItem value="A4">A4</MenuItem><MenuItem value="Letter">US Letter</MenuItem></Select></FormControl>
                  <Box><Typography sx={{ fontSize: "0.64rem" }}>Print margins: {d.margins} mm</Typography><Slider size="small" min={5} max={25} value={Number(d.margins)} onChange={(_, v) => set("margins", v)} disabled={dis} /></Box>
                  <FormControl size="small"><InputLabel>Detail grid columns</InputLabel><Select label="Detail grid columns" value={d.columns} onChange={(e) => set("columns", e.target.value)}>{[2, 3, 4].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}</Select></FormControl>
                  <FormControl size="small"><InputLabel>Borders</InputLabel><Select label="Borders" value={d.borders} onChange={(e) => set("borders", e.target.value)}><MenuItem value="full">Boxed</MenuItem><MenuItem value="none">No boxes</MenuItem></Select></FormControl>
                  <FormControl size="small"><InputLabel>Density</InputLabel><Select label="Density" value={d.density} onChange={(e) => set("density", e.target.value)}><MenuItem value="normal">Comfortable</MenuItem><MenuItem value="compact">Compact</MenuItem></Select></FormControl>
                  <Box><Typography sx={{ fontSize: "0.64rem" }}>Corner radius: {d.radius}px</Typography><Slider size="small" min={0} max={16} value={Number(d.radius)} onChange={(_, v) => set("radius", v)} disabled={dis} /></Box>
                  <FormControl size="small"><InputLabel>Amounts</InputLabel><Select label="Amounts" value={d.currency.mode} onChange={(e) => setIn("currency", "mode", e.target.value)}><MenuItem value="code">Number only (12,345.00)</MenuItem><MenuItem value="symbol">With symbol (₹12,345.00)</MenuItem></Select></FormControl>
                  <FormControl size="small"><InputLabel>Decimals</InputLabel><Select label="Decimals" value={d.currency.decimals} onChange={(e) => setIn("currency", "decimals", e.target.value)}><MenuItem value={2}>2</MenuItem><MenuItem value={0}>0 (rounded)</MenuItem></Select></FormControl>
                  <FormControlLabel control={<Switch checked={d.maskAccount !== false} onChange={(e) => set("maskAccount", e.target.checked)} />} label={<Typography variant="body2">Mask bank account (••••1234)</Typography>} />
                </Stack>
              )}
              {tab === "custom" && <CustomFormat d={d} edit={edit} dis={dis} />}
              {tab === "versions" && (
                <Stack spacing={1}>
                  <Typography sx={{ fontSize: "0.64rem", fontWeight: 700 }}>History</Typography>
                  {[...(d.history || [])].reverse().slice(0, 12).map((h, i) => <Typography key={i} sx={{ fontSize: "0.6rem" }}>{fmtDateTime(h.at)} · {h.by} — {h.action}</Typography>)}
                  <Divider />
                  <Typography sx={{ fontSize: "0.64rem", fontWeight: 700 }}>Earlier versions</Typography>
                  {(d.versions || []).length === 0 && <Typography variant="caption" color="text.secondary">Each save keeps the previous version here (last 12).</Typography>}
                  {(d.versions || []).map((v, i) => <Stack key={i} direction="row" sx={{ alignItems: "center" }}><Typography sx={{ fontSize: "0.6rem", flex: 1 }}>{fmtDateTime(v.at)} · {v.by}</Typography><Button size="small" startIcon={<RestoreRounded />} disabled={dis} onClick={() => { const r = restoreDesignVersion(d.id, i); notifyToast(r.ok ? "Version restored." : r.error, r.ok ? "success" : "error"); onDiscard(); }}>Restore</Button></Stack>)}
                </Stack>
              )}
            </fieldset>
          </Box>
        </Box>
      </SectionCard>
      <Box sx={{ position: { xl: "sticky" }, top: { xl: 76 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.2, alignItems: { sm: "center" } }}>
          <FormControl size="small" sx={{ minWidth: 220 }}><InputLabel>Preview for</InputLabel><Select label="Preview for" value={emp} onChange={(e) => setEmp(e.target.value)}>{data.employees.filter((e) => e.status === "active").map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name} · {e.employee_code}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>As seen by</InputLabel><Select label="As seen by" value={audience} onChange={(e) => setAudience(e.target.value)}><MenuItem value="employee">Employee</MenuItem><MenuItem value="admin">HR / Finance</MenuItem></Select></FormControl>
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="outlined" startIcon={<PrintRounded />} onClick={() => frame.current?.print()}>Print test</Button>
          <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => saveFile(`payslip-preview-${d.id}.html`, html, "text/html")}>Download</Button>
        </Stack>
        <Typography sx={{ fontSize: "0.6rem", color: "#78827b", mb: 1 }}>{pv.real ? `Their latest payslip (${pv.batch.period}).` : "Sample figures (no payslip yet for this person)."} {assignedNow.id === d.id ? "This design is the one this person gets." : `This person currently gets “${assignedNow.name}”.`}</Typography>
        <Box sx={{ background: "#eef1ee", p: { xs: 1, sm: 2 }, borderRadius: 1.5 }}><DocFrame ref={frame} html={html} title="Payslip preview" /></Box>
      </Box>
    </Box>
  );
}

function EmpFields({ d, edit, dis }) {
  const list = d.employeeFields || [];
  const missing = ALL_EMP_FIELDS.filter(([k]) => !list.some((f) => f.key === k));
  const move = (i, dir) => { const n = [...list]; const j = i + dir; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; edit({ employeeFields: n }); };
  return (
    <Stack spacing={0.8}>
      <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>Tick to show, rename the label, and order them. Values come from the employee master.</Typography>
      {list.map((f, i) => (
        <Stack key={f.key} direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Checkbox size="small" checked={f.on} disabled={dis} onChange={(e) => edit({ employeeFields: list.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)) })} />
          <TextField size="small" value={f.label} disabled={dis} onChange={(e) => edit({ employeeFields: list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} sx={{ flex: 1 }} slotProps={{ htmlInput: { style: { fontSize: 12 } } }} helperText={f.key} />
          <IconButton size="small" disabled={dis || i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUpwardRounded sx={{ fontSize: 15 }} /></IconButton>
          <IconButton size="small" disabled={dis || i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDownwardRounded sx={{ fontSize: 15 }} /></IconButton>
          <IconButton size="small" disabled={dis} onClick={() => edit({ employeeFields: list.filter((_, j) => j !== i) })} aria-label="Remove"><DeleteOutlineRounded sx={{ fontSize: 15 }} /></IconButton>
        </Stack>
      ))}
      {missing.length > 0 && <FormControl size="small" disabled={dis}><InputLabel>Add a field</InputLabel><Select label="Add a field" value="" onChange={(e) => { const m = ALL_EMP_FIELDS.find(([k]) => k === e.target.value); edit({ employeeFields: [...list, { key: m[0], label: m[1], on: true }] }); }}>{missing.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}</Select></FormControl>}
    </Stack>
  );
}

function CustomFormat({ d, edit, dis }) {
  const { notifyToast } = useStore();
  const ref = useRef(null);
  const ai = useAiRun();
  const [busy, setBusy] = useState(false);
  async function onFile(f) {
    if (!f) return;
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (!["html", "htm", "docx"].includes(ext)) return notifyToast("Upload an .html or .docx file. (Use New → upload for images or .json.)", "error");
    if (f.size > 2 * 1048576) return notifyToast("Upload a file under 2 MB.", "error");
    setBusy(true);
    try {
      let html;
      if (ext === "docx") {
        const mammoth = await import("mammoth/mammoth.browser.js");
        html = `<div class="docx">${(await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() })).value}</div>`;
      } else html = await f.text();
      const m = autoMapTemplate(sanitizeTemplate(html));
      edit({ kind: "custom_html", html: m.html, mapping: m.mapped, source: { name: f.name, size: f.size, uploaded_at: new Date().toISOString() }, css: ext === "docx" && !d.css ? ".docx table{width:100%;border-collapse:collapse}.docx td,.docx th{border:1px solid var(--b);padding:5px 7px;vertical-align:top}.docx p{margin:2px 0}" : d.css });
      notifyToast(`${f.name} loaded. ${m.mapped.length} field(s) mapped automatically.`);
    } catch (e) {
      notifyToast(`Could not read the file: ${e.message || e}`, "error");
    } finally { setBusy(false); }
  }
  const mapNow = () => { const m = autoMapTemplate(d.html); edit({ html: m.html, mapping: [...(d.mapping || []), ...m.mapped] }); notifyToast(m.mapped.length ? `${m.mapped.length} more field(s) mapped.` : "Nothing more to map automatically. Insert placeholders by hand."); };
  const insert = (p) => edit({ html: `${d.html || ""}${p}` });
  return (
    <Stack spacing={1.4}>
      <Typography sx={{ fontSize: "0.62rem", color: "#4f5b53" }}>Use your organisation's exact payslip format. Upload it as <b>Word (.docx)</b> or <b>HTML</b>; the design's colours are available as CSS variables (var(--p), var(--a), var(--t), var(--b) …). Scripts are removed for safety.</Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Button size="small" variant="outlined" startIcon={<UploadFileRounded />} disabled={dis || busy} onClick={() => ref.current?.click()}>{busy ? "Reading…" : d.html ? "Replace format" : "Upload format"}</Button>
        <input ref={ref} hidden type="file" accept=".html,.htm,.docx" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        {d.html && <Button size="small" startIcon={<AutoFixHighRounded />} disabled={dis} onClick={mapNow}>Auto-map fields</Button>}
        {d.html && <AiButton busy={ai.busy} disabled={dis} onClick={async () => {
          const offline = autoMapTemplate(d.html).html;
          const out = await ai.run({ task: "payslip-template-map", maxTokens: 4000, instruction: `You convert a company's payslip HTML into a template. Replace sample values (names, numbers, dates) with these placeholders where they fit, keep all markup and styling, and return ONLY the HTML: ${PLACEHOLDERS.map((p) => p[0]).join(" ")}. Payslip field codes: BASIC HRA SPECIAL OTHER_ALW CONTRACT_PAY PF_EE ESI_EE PT TDS REIMB CW_HOURS CW_RATE.`, input: d.html.slice(0, 30000), offline });
          const clean = String(out || "").replace(/^```(html)?\s*/i, "").replace(/```\s*$/, "");
          if (/\{\{\s*[\w.]+\s*\}\}/.test(clean)) { edit({ html: sanitizeTemplate(clean) }); notifyToast("AI mapped the format. Check the preview."); } else notifyToast("The AI did not return a usable template; try Auto-map.", "error");
        }}>Map with AI</AiButton>}
        {d.kind !== "custom_html" && d.html && <Button size="small" variant="contained" disabled={dis} onClick={() => edit({ kind: "custom_html" })}>Use my format</Button>}
        {d.kind === "custom_html" && <Button size="small" color="inherit" disabled={dis} onClick={() => edit({ kind: "layout" })}>Switch back to a layout</Button>}
      </Stack>
      {d.source && <Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>From {d.source.name} · {fmtDateTime(d.source.uploaded_at)}</Typography>}
      {d.mapping?.length > 0 && <Alert severity="success" sx={{ fontSize: "0.6rem", py: 0 }}>Mapped: {d.mapping.slice(0, 14).map(([l, p]) => `${l} → ${p}`).join(" · ")}{d.mapping.length > 14 ? " …" : ""}</Alert>}
      <TextField size="small" multiline minRows={8} maxRows={18} label="Template HTML" value={d.html || ""} disabled={dis} onChange={(e) => edit({ html: e.target.value })} slotProps={{ htmlInput: { style: {  fontSize: 11 } } }} placeholder={"<h1>{{company.name}}</h1>\n<p>Payslip for {{period}} – {{employee.full_name}}</p>\n<table>{{earnings_rows}}</table>\n<b>Net pay: {{totals.payable}}</b>"} />
      <Typography sx={{ fontSize: "0.62rem", fontWeight: 700 }}>Placeholders (click to append)</Typography>
      <Box sx={{ maxHeight: 200, overflow: "auto", border: "1px solid #e6ece5", borderRadius: 1 }}>
        {PLACEHOLDERS.map(([p, l]) => <Stack key={p} direction="row" spacing={1} sx={{ px: 1, py: 0.4, borderBottom: "1px solid #f2f4f1", cursor: dis ? "default" : "pointer", "&:hover": { background: "#f6f8f5" } }} onClick={() => !dis && !p.includes("<") && !p.includes("…") && insert(p.split(" ")[0])}><Typography sx={{ fontSize: "0.58rem",  minWidth: 150 }}>{p}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#66716a" }}>{l}</Typography></Stack>)}
      </Box>
      <TextField size="small" multiline minRows={3} label="Extra CSS (advanced, applies to every layout)" value={d.css || ""} disabled={dis} onChange={(e) => edit({ css: e.target.value })} slotProps={{ htmlInput: { style: {  fontSize: 11 } } }} />
    </Stack>
  );
}
