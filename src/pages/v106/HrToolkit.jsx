// v10.6 · HR toolkit — every template from the HR Management Toolkit reference, ready to download as Excel or Word.
import React, { useMemo, useState } from "react";
import { Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { DownloadRounded, SearchRounded, TableChartRounded, DescriptionRounded, AutoAwesomeRounded, VisibilityRounded, UploadFileRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { SectionCard, Tag, TableWrap } from "../../components/kit/UI.jsx";
import { fmtDate } from "../../lib/utils.js";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader } from "../../components/kit/UI.jsx";
import { TOOLKIT, TOOLKIT_CATEGORIES, downloadTemplate } from "../../lib/toolkitTemplates.js";
import { TONES } from "../../theme/tones.js";
import { APP_CONFIG } from "../../data/seed.js";

// v10.7: files are kept in the browser — keep each under 700 KB.
function readAsDataUrl(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); }); }
function downloadDataUrl(url, name) { const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

export default function HrToolkit() {
  const { data, notifyToast, suiteDo, nameOf } = useStore();
  const subs = data.suite?.toolkitSubmissions || [];
  const orgTpls = data.suite?.orgTemplates || [];
  async function uploadFilled(t, file) {
    if (!file) return;
    if (file.size > 700 * 1024) return notifyToast("Keep the file under 700 KB.", "error");
    const url = await readAsDataUrl(file);
    const r = suiteDo("admin106", (st, { now, code }) => { st.toolkitSubmissions = [{ id: `TKS-${Date.now()}`, template: t.id, template_name: t.name, file: file.name, data: url, by: code, at: now, status: "review" }, ...(st.toolkitSubmissions || [])].slice(0, 60); }, { action: "TOOLKIT_UPLOAD", details: `${t.name} · ${file.name}` });
    notifyToast(r.ok ? `${file.name} uploaded for review.` : r.error, r.ok ? "success" : "error");
  }
  async function uploadOrg(file, cat) {
    if (!file) return;
    if (file.size > 700 * 1024) return notifyToast("Keep the file under 700 KB.", "error");
    const url = await readAsDataUrl(file);
    const r = suiteDo("admin106", (st, { now, code }) => { st.orgTemplates = [{ id: `OT-${Date.now()}`, name: file.name, cat, data: url, size: file.size, by: code, at: now }, ...(st.orgTemplates || [])]; }, { action: "ORG_TEMPLATE_UPLOAD", details: file.name });
    notifyToast(r.ok ? `${file.name} saved to your organisation's templates.` : r.error, r.ok ? "success" : "error");
  }
  const review = (id, status) => suiteDo("admin106", (st, { now, code }) => { const x = st.toolkitSubmissions.find((y) => y.id === id); if (x) { x.status = status; x.reviewed_by = code; x.reviewed_at = now; } }, { action: "TOOLKIT_REVIEW", details: `${id} → ${status}` });
  const [orgCat, setOrgCat] = useState("policies");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [peek, setPeek] = useState(null);
  const [busy, setBusy] = useState("");
  const list = useMemo(() => TOOLKIT.filter((t) => (cat === "all" || t.cat === cat) && (!q.trim() || `${t.name} ${t.desc}`.toLowerCase().includes(q.trim().toLowerCase()))), [cat, q]);
  const catBy = Object.fromEntries(TOOLKIT_CATEGORIES.map(([id, l, tone]) => [id, { l, tone: TONES[tone] }]));
  async function get(t, fill) {
    setBusy(t.id + fill);
    try { await downloadTemplate(t, data, { fill, company: APP_CONFIG.companyName }); notifyToast(`${t.name} downloaded${fill ? " with your data" : ""}.`); } catch (e) { notifyToast(`Could not build the file: ${e.message}`, "error"); }
    setBusy("");
  }
  return (
    <>
      <PageHeader title="HR toolkit · ready-to-use templates" subtitle={`${TOOLKIT.length} policies, templates, forms, SOPs, checklists, letters, reports and HR Excel tools. Excel tools have working formulas; many can be filled with your company's data in one click.`} />
      <Card sx={{ p: 1.5, mb: 2, bgcolor: "primary.light" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" } }}>
          <Stack direction="row" spacing={0.7} useFlexGap sx={{ flexWrap: "wrap", flex: 1 }}>
            <Chip label={`All (${TOOLKIT.length})`} onClick={() => setCat("all")} sx={{ fontWeight: 700, bgcolor: cat === "all" ? "#15414F" : "#fff", color: cat === "all" ? "#fff" : "#15414F", border: "1px solid #cfdadf" }} />
            {TOOLKIT_CATEGORIES.map(([id, l, tone]) => {
              const n = TOOLKIT.filter((t) => t.cat === id).length;
              const on = cat === id;
              return <Chip key={id} label={`${l} (${n})`} onClick={() => setCat(id)} sx={{ fontWeight: 700, bgcolor: on ? TONES[tone].main : TONES[tone].light, color: on ? "#fff" : TONES[tone].main, border: `1px solid ${TONES[tone].mid}` }} />;
            })}
          </Stack>
          <TextField size="small" placeholder="Search templates" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: { md: 240 }, background: "#fff" }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
        </Stack>
      </Card>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(3, minmax(0,1fr))", xl: "repeat(4, minmax(0,1fr))" }, gap: 1.6 }}>
        {list.map((t) => {
          const c = catBy[t.cat];
          return (
            <Card key={t.id} sx={{ p: 1.8, display: "flex", flexDirection: "column", gap: 0.8, borderTop: `4px solid ${c.tone.main}` }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                <Box sx={{ width: 34, height: 34, borderRadius: 2, display: "grid", placeItems: "center", background: c.tone.light, color: c.tone.main, flexShrink: 0 }}>{t.kind === "xlsx" ? <TableChartRounded fontSize="small" /> : <DescriptionRounded fontSize="small" />}</Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: "0.78rem", lineHeight: 1.25 }}>{t.name}</Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.4 }}><Chip size="small" label={c.l} sx={{ height: 17, fontSize: "0.55rem", bgcolor: c.tone.light, color: c.tone.main, fontWeight: 700 }} /><Chip size="small" label={t.kind === "xlsx" ? "Excel" : "Word"} sx={{ height: 17, fontSize: "0.55rem" }} />{t.live && <Chip size="small" label="Live data" sx={{ height: 17, fontSize: "0.55rem", bgcolor: "#E6F6EE", color: "#1F9D63", fontWeight: 700 }} />}</Stack>
                </Box>
              </Stack>
              <Typography sx={{ fontSize: "0.66rem", color: "#5d6b70", flex: 1 }}>{t.desc}</Typography>
              <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Button size="small" variant="contained" startIcon={<DownloadRounded />} disabled={!!busy} onClick={() => get(t, false)} sx={{ background: c.tone.main, "&:hover": { background: c.tone.main, filter: "brightness(0.92)" } }}>{busy === `${t.id}false` ? "Building…" : "Download"}</Button>
                {t.live && <Button size="small" variant="outlined" startIcon={<AutoAwesomeRounded />} disabled={!!busy} onClick={() => get(t, true)}>{busy === `${t.id}true` ? "Filling…" : "Fill with my data"}</Button>}
                <Button size="small" startIcon={<VisibilityRounded />} onClick={() => setPeek(t)}>Preview</Button>
                <Button size="small" component="label" startIcon={<UploadFileRounded />}>Upload filled<input hidden type="file" accept={t.kind === "xlsx" ? ".xlsx,.xls,.csv" : ".docx,.doc,.pdf"} onChange={(e) => { uploadFilled(t, e.target.files?.[0]); e.target.value = ""; }} /></Button>
              </Stack>
            </Card>
          );
        })}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0,1fr))" }, gap: 2, mt: 2.5 }}>
        <SectionCard title="Filled files for review" subtitle="Download a template (with your live data), fill it, upload it back — HR reviews it here." noPad>
          {subs.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Nothing uploaded yet — use "Upload filled" on any template.</Typography> : (
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Template</TableCell><TableCell>File</TableCell><TableCell>By</TableCell><TableCell>Status</TableCell><TableCell align="right" /></TableRow></TableHead>
              <TableBody>{subs.map((x) => <TableRow key={x.id}><TableCell>{x.template_name}<Typography variant="caption" display="block" color="text.secondary">{fmtDate(x.at)}</Typography></TableCell><TableCell><Button size="small" onClick={() => downloadDataUrl(x.data, x.file)}>{x.file}</Button></TableCell><TableCell>{nameOf(x.by)}</TableCell><TableCell><Tag tone={x.status === "approved" ? "good" : x.status === "changes" ? "bad" : "warn"}>{x.status === "review" ? "In review" : x.status === "changes" ? "Changes needed" : "Approved"}</Tag></TableCell><TableCell align="right">{x.status === "review" && <><Button size="small" onClick={() => review(x.id, "approved")}>Approve</Button><Button size="small" color="error" onClick={() => review(x.id, "changes")}>Send back</Button></>}</TableCell></TableRow>)}</TableBody></Table></TableWrap>
          )}
        </SectionCard>
        <SectionCard title="Your organisation's templates" subtitle="Upload and store your own formats (policies, letters, forms, Excel tools) for everyone in HR to reuse."
          action={<Stack direction="row" spacing={1}><TextField select size="small" value={orgCat} onChange={(e) => setOrgCat(e.target.value)} sx={{ minWidth: 140 }}>{TOOLKIT_CATEGORIES.map(([id, l]) => <MenuItem key={id} value={id}>{l}</MenuItem>)}</TextField><Button size="small" variant="contained" component="label" startIcon={<UploadFileRounded />}>Upload<input hidden type="file" onChange={(e) => { uploadOrg(e.target.files?.[0], orgCat); e.target.value = ""; }} /></Button></Stack>} noPad>
          {orgTpls.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No organisation templates yet.</Typography> : (
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Template</TableCell><TableCell>Category</TableCell><TableCell>Added</TableCell><TableCell align="right" /></TableRow></TableHead>
              <TableBody>{orgTpls.map((x) => <TableRow key={x.id}><TableCell>{x.name}</TableCell><TableCell>{catBy[x.cat]?.l || x.cat}</TableCell><TableCell>{fmtDate(x.at)} · {nameOf(x.by)}</TableCell><TableCell align="right"><Button size="small" startIcon={<DownloadRounded />} onClick={() => downloadDataUrl(x.data, x.name)}>Download</Button><Button size="small" color="error" startIcon={<DeleteOutlineRounded />} onClick={() => suiteDo("admin106", (st) => { st.orgTemplates = (st.orgTemplates || []).filter((y) => y.id !== x.id); }, { action: "ORG_TEMPLATE_REMOVE", details: x.name })}>Remove</Button></TableCell></TableRow>)}</TableBody></Table></TableWrap>
          )}
        </SectionCard>
      </Box>
      <Dialog open={!!peek} onClose={() => setPeek(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{peek?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{peek?.desc}</Typography>
          {peek?.kind === "xlsx" ? (
            <Box sx={{ overflowX: "auto" }}>
              <Box component="table" sx={{ borderCollapse: "collapse", fontSize: "0.66rem", "& th": { background: "#15414F", color: "#fff", px: 1, py: 0.6, whiteSpace: "nowrap", textAlign: "left" }, "& td": { border: "1px solid #e3e9ec", px: 1, py: 0.4, whiteSpace: "nowrap" } }}>
                <thead><tr>{peek.cols.map(([h]) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{(peek.example || peek.rows || [[]]).slice(0, 6).map((r, i) => <tr key={i}>{peek.cols.map(([h, , type], ci) => <td key={h}>{r[ci] != null && !String(r[ci]).startsWith("formula:") ? String(r[ci]) : type && String(type).startsWith("formula:") ? <i style={{ color: "#1F9D63" }}>formula</i> : ""}</td>)}</tr>)}</tbody>
              </Box>
            </Box>
          ) : (
            <Stack spacing={1.2}>{(peek?.sections || []).map(([h, ps], i) => <Box key={i}>{h && <Typography sx={{ fontWeight: 800, fontSize: "0.78rem", color: "#15414F" }}>{h}</Typography>}{ps.map((p, j) => <Typography key={j} sx={{ fontSize: "0.7rem", mt: 0.3 }}>{p.replace(/\{Company\}/g, APP_CONFIG.companyName)}</Typography>)}</Box>)}</Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setPeek(null)}>Close</Button>{peek && <Button variant="contained" startIcon={<DownloadRounded />} onClick={() => get(peek, false)}>Download</Button>}</DialogActions>
      </Dialog>
    </>
  );
}
