// Offer letters for HR admin: prepare manually or by CSV upload, manage fields, preview, print, Word download, issue + email.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem, Select, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { AddRounded, CloseRounded, DownloadRounded, EditRounded, PrintRounded, SendRounded, UploadFileRounded, DeleteOutlineRounded, CheckRounded, BlockRounded, UndoRounded, DescriptionRounded, MailOutlineRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap, Mono, EmptyState, ConfirmDialog } from "../kit/UI.jsx";
import { OFFER_GROUPS, STANDARD_OFFER_FIELDS, offerFieldList, defaultsFor, salaryBreakup, validateOffer, validateOfferUpload, buildOfferLetter, toCsv } from "../../data/offerFields.js";
import { fmtDate, fmtDateTime, saveFile, readFileAsDataUrl } from "../../lib/utils.js";

const STATUS_TONE = { Draft: "neutral", Issued: "info", Accepted: "good", Declined: "bad", Withdrawn: "neutral" };
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const INK = "#123B47";
const PRINT_CSS = `@media print { body * { visibility: hidden !important; } .offer-print, .offer-print * { visibility: visible !important; } .offer-print { position: absolute; left: 0; top: 0; width: 100%; } .offer-page { box-shadow: none !important; border: none !important; break-after: page; margin: 0 !important; } @page { size: A4; margin: 14mm; } }`;

// ─── Letter rendering ───
function Runs({ runs }) {
  return runs.map((r, i) => <Box key={i} component="span" sx={{ fontWeight: r.b ? 700 : undefined, fontStyle: r.i ? "italic" : undefined }}>{r.t}</Box>);
}
function BlockView({ b }) {
  const p = { fontSize: "0.74rem", lineHeight: 1.6, color: "#1F2D31", mb: 1.1, textAlign: "justify" };
  switch (b.kind) {
    case "p": return <Typography sx={p}><Runs runs={b.runs} /></Typography>;
    case "h": return <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: INK, mt: 2, mb: 0.6 }}>{b.text}</Typography>;
    case "addr": return <Box sx={{ mb: 1 }}>{b.lines.map((l, i) => <Typography key={i} sx={{ fontSize: "0.74rem", lineHeight: 1.5 }}>{l}</Typography>)}</Box>;
    case "right": return <Typography sx={{ ...p, textAlign: "right" }}>{b.text}</Typography>;
    case "center": return <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, textAlign: "center", color: INK, mb: 1 }}>{b.text}</Typography>;
    case "gap": return <Box sx={{ height: 10 }} />;
    case "sign": return <Box sx={{ mt: 3, mb: 1.5 }}><Typography sx={{ fontSize: "0.78rem", fontWeight: 800 }}>{b.name}</Typography><Typography sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{b.title}</Typography></Box>;
    case "lines": return <Box sx={{ my: 1 }}>{b.items.map((l) => <Typography key={l} sx={{ fontSize: "0.72rem", py: 0.8 }}>{l}: <Box component="span" sx={{ display: "inline-block", width: 220, borderBottom: "1px solid #8a979b" }} /></Typography>)}</Box>;
    case "kv": return <Box sx={{ mb: 1 }}>{b.items.map(([k, v]) => <Typography key={k} sx={{ fontSize: "0.74rem" }}><b>{k}:</b> {v}</Typography>)}</Box>;
    case "ol": return <Box component="ol" sx={{ pl: 2.5, m: 0, mb: 1.5 }}>{b.items.map((t, i) => <Box component="li" key={i} sx={{ ...p, mb: 0.8 }}>{t}</Box>)}</Box>;
    case "table":
      return (
        <Box sx={{ overflowX: "auto", mb: 1.5 }}>
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: "0.68rem", minWidth: 480 }}>
            <thead><tr>{b.head.map((h, i) => <Box component="th" key={h} sx={{ border: "1px solid #B8C4C8", background: "#E6EEF0", p: 0.7, textAlign: i >= 2 ? "right" : "left" }}>{h}</Box>)}</tr></thead>
            <tbody>{b.rows.map((r, k) => <tr key={k}>{r.cells.map((c, i) => <Box component="td" key={i} sx={{ border: "1px solid #B8C4C8", p: 0.7, textAlign: i >= 2 ? "right" : "left", fontWeight: r.b ? 700 : 400, background: r.section ? "#F3F6F7" : undefined, fontVariantNumeric: "tabular-nums" }}>{c}</Box>)}</tr>)}</tbody>
          </Box>
        </Box>
      );
    default: return null;
  }
}

export function OfferDocument({ values, company, custom }) {
  const pages = buildOfferLetter(values, company, custom);
  return (
    <Box className="offer-print">
      <style>{PRINT_CSS}</style>
      {pages.map((blocks, i) => (
        <Box key={i} className="offer-page" sx={{ background: "#fff", border: "1px solid #dfe5e6", boxShadow: "0 8px 24px -18px rgba(0,0,0,.4)", borderRadius: 1, p: { xs: 2, sm: 4 }, mb: 2.5, maxWidth: 800, mx: "auto" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${INK}`, pb: 1.2, mb: 2 }}>
            {company.logo ? <Box component="img" src={company.logo} alt={company.brand} sx={{ height: 38 }} /> : <Typography sx={{ fontWeight: 800 }}>{company.brand}</Typography>}
            <Typography sx={{ fontSize: "0.58rem", color: "#5d6e73" }}>Page {i + 1} of {pages.length}</Typography>
          </Box>
          {blocks.map((b, k) => <BlockView key={k} b={b} />)}
          <Box sx={{ borderTop: "1px solid #dfe5e6", mt: 3, pt: 1, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.56rem", fontWeight: 700, color: "#3c4e53" }}>{company.legal_name} · CIN: {company.cin}</Typography>
            <Typography sx={{ fontSize: "0.54rem", color: "#5d6e73" }}>{company.office.join(", ")} · T: {company.phone} · {company.website}</Typography>
            <Typography sx={{ fontSize: "0.54rem", color: "#5d6e73", fontStyle: "italic" }}>{company.confidential}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

async function downloadWord(o, company, notifyToast) {
  try {
    const { offerDocxBlob } = await import("../../lib/offerDocx.js");
    const blob = await offerDocxBlob(buildOfferLetter(o.values, company, o.fields), company);
    const r = await saveFile(`Offer_Letter_${o.values.candidate_name.replace(/\s+/g, "_")}_${o.id}.docx`, blob, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    if (r?.declined) notifyToast("Download cancelled.", "info");
  } catch (e) {
    notifyToast(`Could not build the Word file: ${e.message}`, "error");
  }
}

function useCan() {
  const { user, data } = useStore();
  return user.role === "superadmin" || !!data.admins.find((a) => a.admin_code === user.code)?.modules.includes("offers");
}

// ─── Page ───
export function OffersPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "offers";
  return (
    <>
      <Box sx={{ mb: 2, borderBottom: "1px solid #e5eae4" }}>
        <Tabs value={tab} onChange={(_, v) => setParams({ tab: v })} variant="scrollable" allowScrollButtonsMobile>
          <Tab value="offers" label="Offers" sx={{ fontSize: "0.7rem" }} />
          <Tab value="fields" label="Offer fields" sx={{ fontSize: "0.7rem" }} />
          <Tab value="format" label="Upload format" sx={{ fontSize: "0.7rem" }} />
          <Tab value="settings" label="Letterhead & email" sx={{ fontSize: "0.7rem" }} />
        </Tabs>
      </Box>
      {tab === "offers" && <OffersTab />}
      {tab === "fields" && <FieldsTab />}
      {tab === "format" && <FormatTab />}
      {tab === "settings" && <SettingsTab />}
    </>
  );
}

function OffersTab() {
  const { data } = useStore();
  const can = useCan();
  const [form, setForm] = useState(null);
  const [upload, setUpload] = useState(false);
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState("All");
  const list = data.offers.filter((o) => filter === "All" || o.status === filter);
  const c = (s) => data.offers.filter((o) => o.status === s).length;
  return (
    <Stack spacing={2.5}>
      <Grid min={150}>
        <StatCard label="Drafts" value={c("Draft")} tone="neutral" />
        <StatCard label="Issued, awaiting reply" value={c("Issued")} tone="info" />
        <StatCard label="Accepted" value={c("Accepted")} tone="good" />
        <StatCard label="Acceptance rate" value={`${Math.round((c("Accepted") / Math.max(1, c("Accepted") + c("Declined"))) * 100)}%`} tone="accent" />
      </Grid>
      <SectionCard
        title="Offer letters"
        action={
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <FormControl size="small"><Select value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ fontSize: "0.66rem" }}>{["All", "Draft", "Issued", "Accepted", "Declined", "Withdrawn"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</Select></FormControl>
            {can && <Button size="small" variant="outlined" startIcon={<UploadFileRounded />} onClick={() => setUpload(true)}>Upload offers</Button>}
            {can && <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setForm({})}>New offer</Button>}
          </Stack>
        }
        noPad
      >
        {list.length === 0 ? <EmptyState title="No offers here" text="Prepare an offer by hand, or upload several at once from a CSV file." /> : (
          <TableWrap>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead><TableRow><TableCell>Offer</TableCell><TableCell>Candidate</TableCell><TableCell>Designation</TableCell><TableCell align="right">CTC / year</TableCell><TableCell>Joining</TableCell><TableCell>Prepared</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>
                {list.map((o) => (
                  <TableRow key={o.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(o.id)}>
                    <TableCell><Mono>{o.id}</Mono></TableCell>
                    <TableCell><PersonCell name={o.values.candidate_name} sub={o.values.email} /></TableCell>
                    <TableCell>{o.values.designation}</TableCell>
                    <TableCell align="right">{inr(o.ctc_annual)}</TableCell>
                    <TableCell>{fmtDate(o.values.joining_date)}</TableCell>
                    <TableCell><Typography sx={{ fontSize: "0.62rem" }}>{o.created_by} · {o.source === "upload" ? "upload" : "manual"}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{fmtDateTime(o.created_at)}</Typography></TableCell>
                    <TableCell><Tag tone={STATUS_TONE[o.status]}>{o.status}</Tag></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>
      {form && <OfferForm init={form} onClose={() => setForm(null)} onSaved={(id) => { setForm(null); setOpen(id); }} />}
      {upload && <UploadDialog onClose={() => setUpload(false)} />}
      <OfferDrawer id={open} onClose={() => setOpen(null)} onEdit={(o) => { setOpen(null); setForm(o); }} />
    </Stack>
  );
}

function FieldInputBox({ f, value, error, onChange }) {
  const common = { size: "small", fullWidth: true, label: `${f.label}${f.required ? " *" : ""}`, error: !!error, helperText: error || f.help || " " };
  if (f.type === "select") {
    return (
      <FormControl size="small" fullWidth error={!!error}>
        <InputLabel>{common.label}</InputLabel>
        <Select label={common.label} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>{(f.options || []).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</Select>
        <Typography sx={{ fontSize: "0.58rem", color: error ? "error.main" : "#78827b", mt: 0.4, ml: 1.5 }}>{error || f.help || " "}</Typography>
      </FormControl>
    );
  }
  if (f.type === "multiline" || f.type === "clause") return <TextField {...common} multiline minRows={f.type === "clause" ? 3 : 2} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  return <TextField {...common} type={f.type === "date" ? "date" : ["number", "amount"].includes(f.type) ? "number" : f.type === "email" ? "email" : "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />;
}

function OfferForm({ init, onClose, onSaved }) {
  const { data, saveOffer, notifyToast } = useStore();
  const company = data.settings.offer_company;
  const fields = offerFieldList(data.offerFields);
  const [v, setV] = useState(() => (init.values ? { ...defaultsFor(fields, company), ...init.values } : defaultsFor(fields, company)));
  const [candidate, setCandidate] = useState(init.candidate_id || "");
  const [errs, setErrs] = useState({});
  const [preview, setPreview] = useState(false);
  const s = salaryBreakup(v, data.offerFields);
  const cands = data.candidates.filter((c) => ["interview", "offer"].includes(c.stage));
  function pickCandidate(id) {
    setCandidate(id);
    const c = data.candidates.find((x) => x.id === id);
    const q = c && data.reqs.find((r) => r.id === c.req_id);
    if (c) setV((cur) => ({ ...cur, candidate_name: c.name, email: c.email, designation: q?.role || cur.designation, role: q?.dept || cur.role }));
  }
  function save() {
    const e = validateOffer(v, fields, data.offerFields);
    setErrs(e);
    if (Object.keys(e).length) return notifyToast(`Fix ${Object.keys(e).length} field(s) before saving.`, "error");
    const r = saveOffer(v, { id: init.id, candidate_id: candidate || null });
    if (!r.ok) { setErrs(r.fieldErrors || {}); return notifyToast(r.error, "error"); }
    notifyToast(init.id ? "Offer updated." : `Draft offer ${r.id} saved.`);
    onSaved(r.id);
  }
  const groups = ["candidate", "offer", "salary", "salary_earning", "clause"];
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{init.id ? `Edit ${init.id}` : "New offer letter"}</DialogTitle>
      <DialogContent>
        {preview ? <OfferDocument values={v} company={company} custom={data.offerFields} /> : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 300px" }, gap: 3, pt: 1 }}>
            <Box>
              {!init.id && cands.length > 0 && (
                <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Fill from a candidate in the pipeline (optional)</InputLabel>
                  <Select label="Fill from a candidate in the pipeline (optional)" value={candidate} onChange={(e) => pickCandidate(e.target.value)}>
                    <MenuItem value="">None</MenuItem>
                    {cands.map((c) => <MenuItem key={c.id} value={c.id}>{c.name} · {data.reqs.find((r) => r.id === c.req_id)?.role} · {c.stage}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {groups.map((g) => {
                const fs = fields.filter((f) => f.group === g);
                if (!fs.length) return null;
                return (
                  <Box key={g} sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, mb: 1.2, color: INK }}>{OFFER_GROUPS[g]}</Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, columnGap: 2 }}>
                      {fs.map((f) => (
                        <Box key={f.key} sx={{ gridColumn: ["multiline", "clause"].includes(f.type) ? "1 / -1" : undefined }}>
                          <FieldInputBox f={f} value={v[f.key] ?? (f.group === "clause" ? f.default : "")} error={errs[f.key]} onChange={(val) => setV({ ...v, [f.key]: val })} />
                        </Box>
                      ))}
                    </Box>
                    {g === "clause" && <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>Clear a clause's text to leave it out of this letter.</Typography>}
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ position: { md: "sticky" }, top: 0, alignSelf: "start", p: 2, borderRadius: 1.5, background: "#f4f7f5", border: "1px solid #e1e8e3" }}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, mb: 1 }}>Annexure I preview (per month)</Typography>
              {[["CTC", s.ctc], ...s.rows.map(([l, , m]) => [l, m]), ["Gross (A)", s.A], ["PF company", s.pf], ...(s.esiOn ? [["ESI employer (3.25%)", s.esiEr], ["ESI employee (0.75%)", s.esiEe]] : []), ["PF employee", s.pfEmployee], ["Professional tax", s.pt], ["Take home before tax", s.takeHome], ...(s.tds ? [["TDS (estimate)", s.tds], ["Take home after TDS", s.takeHomeAfterTax]] : [])].map(([l, m]) => (
                <Stack key={l} direction="row" sx={{ justifyContent: "space-between", py: 0.35, borderBottom: "1px dashed #dbe2dd" }}>
                  <Typography sx={{ fontSize: "0.64rem", fontWeight: ["CTC", "Gross (A)", "Take home before tax"].includes(l) ? 800 : 400 }}>{l}</Typography>
                  <Typography sx={{ fontSize: "0.64rem", fontVariantNumeric: "tabular-nums", color: m < 0 ? "error.main" : undefined }}>{inr(m)}</Typography>
                </Stack>
              ))}
              <Typography sx={{ fontSize: "0.62rem", mt: 1 }}>Annual CTC <b>{inr(s.ctc * 12)}</b>{s.bonus ? ` · with bonus ${inr(s.totalWithBonus)}` : ""}</Typography>
              {s.special < 0 && <Alert severity="error" sx={{ mt: 1, fontSize: "0.6rem" }}>Special allowance is negative. Lower the percentages or raise the CTC.</Alert>}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button startIcon={<DescriptionRounded />} onClick={() => { if (!preview) { const e = validateOffer(v, fields, data.offerFields); setErrs(e); if (Object.keys(e).length) return notifyToast("Fill the required fields to preview the letter.", "error"); } setPreview(!preview); }}>{preview ? "Back to fields" : "Preview letter"}</Button>
        <Button variant="contained" onClick={save}>Save draft</Button>
      </DialogActions>
    </Dialog>
  );
}

function OfferDrawer({ id, onClose, onEdit }) {
  const { data, issueOffer, respondOffer, deleteOffer, notifyToast } = useStore();
  const can = useCan();
  const [dlg, setDlg] = useState(null);
  const [note, setNote] = useState("");
  const [email, setEmail] = useState(true);
  const o = data.offers.find((x) => x.id === id);
  useEffect(() => { setDlg(null); setNote(""); }, [id]);
  if (!o) return null;
  const company = o.company || data.settings.offer_company;
  const run = (r, ok) => notifyToast(r.ok ? ok : r.error, r.ok ? "success" : "error");
  const mail = data.emails.find((m) => m.kind === "offer" && m.batch_id === o.id);
  return (
    <Drawer anchor="right" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", md: 900 }, background: "#f3f5f3" } } }}>
      <Stack direction="row" sx={{ alignItems: "center", px: 2.5, py: 1.5, borderBottom: "1px solid #e1e6e2", background: "#fff", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h2" noWrap>{o.id} · {o.values.candidate_name}</Typography>
          <Typography sx={{ fontSize: "0.62rem", color: "#78827b" }}>{o.values.designation} · {inr(o.ctc_annual)} a year · joining {fmtDate(o.values.joining_date)}</Typography>
        </Box>
        <Tag tone={STATUS_TONE[o.status]}>{o.status}</Tag>
        <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
      </Stack>
      <Stack spacing={2} sx={{ p: 2.5, overflow: "auto" }}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          {can && o.status === "Draft" && <Button size="small" variant="contained" startIcon={<SendRounded />} onClick={() => setDlg("issue")}>Issue offer</Button>}
          {can && o.status === "Draft" && <Button size="small" variant="outlined" startIcon={<EditRounded />} onClick={() => onEdit(o)}>Edit</Button>}
          {can && o.status === "Issued" && <Button size="small" variant="contained" startIcon={<CheckRounded />} onClick={() => setDlg("accept")}>Candidate accepted</Button>}
          {can && o.status === "Issued" && <Button size="small" variant="outlined" startIcon={<BlockRounded />} onClick={() => setDlg("decline")}>Candidate declined</Button>}
          {can && ["Draft", "Issued"].includes(o.status) && <Button size="small" color="error" variant="outlined" startIcon={<UndoRounded />} onClick={() => setDlg("withdraw")}>Withdraw</Button>}
          {can && o.status === "Draft" && <Button size="small" color="error" startIcon={<DeleteOutlineRounded />} onClick={() => { const r = deleteOffer(o.id); run(r, "Draft deleted."); if (r.ok) onClose(); }}>Delete</Button>}
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="outlined" startIcon={<PrintRounded />} onClick={() => window.print()}>Print / PDF</Button>
          <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadWord(o, company, notifyToast)}>Word (.docx)</Button>
        </Stack>
        {mail && (
          <Alert severity="info" icon={<MailOutlineRounded />} sx={{ fontSize: "0.66rem" }} action={<Button size="small" href={`mailto:${encodeURIComponent(mail.to)}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`} target="_blank" rel="noopener">Open in mail app</Button>}>
            Email to {mail.to} — {mail.status === "Queued" ? "queued in the outbox (sent by the server once connected)" : "sent"} · {fmtDateTime(mail.at)}
          </Alert>
        )}
        {o.status === "Accepted" && <Alert severity="success" sx={{ fontSize: "0.66rem" }}>Accepted. Onboarding has started under Hire & onboard → Onboarding.</Alert>}
        <OfferDocument values={o.values} company={company} custom={o.fields} />
        <SectionCard title="History">{o.history.map((h, i) => <Typography key={i} sx={{ fontSize: "0.64rem", py: 0.3 }}><b>{fmtDateTime(h.at)}</b> · {h.by} · {h.action}</Typography>)}</SectionCard>
      </Stack>
      <ConfirmDialog
        open={!!dlg}
        title={{ issue: `Issue the offer to ${o.values.candidate_name}?`, accept: "Record acceptance?", decline: "Record that the candidate declined?", withdraw: "Withdraw this offer?" }[dlg] || ""}
        text={{ issue: "The letter is locked (no more edits) and marked as issued.", accept: "Onboarding starts and the candidate moves to Hired in recruitment.", decline: "The offer is closed.", withdraw: "The candidate should be told separately." }[dlg]}
        confirmLabel={dlg === "issue" ? "Issue offer" : dlg === "withdraw" ? "Withdraw offer" : "Confirm"}
        tone={dlg === "withdraw" ? "error" : "primary"}
        disabled={dlg === "withdraw" && !note.trim()}
        onClose={() => setDlg(null)}
        onConfirm={() => {
          const r = dlg === "issue" ? issueOffer(o.id, { email }) : respondOffer(o.id, dlg, note);
          run(r, { issue: email ? `Offer issued and emailed to ${o.values.email}.` : "Offer issued.", accept: "Acceptance recorded; onboarding started.", decline: "Recorded as declined.", withdraw: "Offer withdrawn." }[dlg]);
          setDlg(null);
          setNote("");
        }}
      >
        {dlg === "issue" && <FormControlLabel control={<Switch checked={email} onChange={(e) => setEmail(e.target.checked)} />} label={<Typography variant="body2">Email the offer letter to {o.values.email}</Typography>} />}
        {["withdraw", "decline", "accept"].includes(dlg) && <TextField fullWidth size="small" multiline minRows={2} sx={{ mt: 1 }} label={dlg === "withdraw" ? "Reason (required)" : "Note (optional)"} value={note} onChange={(e) => setNote(e.target.value)} />}
      </ConfirmDialog>
    </Drawer>
  );
}

// ─── Upload ───
async function downloadOfferTemplate(data, notifyToast) {
  const fields = offerFieldList(data.offerFields);
  const company = data.settings.offer_company;
  const d = defaultsFor(fields, company);
  const sample = { ...d, salutation: "Ms.", candidate_name: "Priya Sharma", address: "Flat 101, Green Residency | Madhapur, Hyderabad – 500081", phone: "+91 90000 12345", email: "priya.sharma@example.com", designation: "Senior Consultant", role: "Consultant", joining_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), monthly_ctc: 82000 };
  const cols = fields.map((f) => f.key);
  const csv = toCsv(cols, [cols.map((k) => (k === "address" || k === "work_address" ? String(sample[k] ?? "").replace(/\n/g, " | ") : sample[k] ?? ""))]);
  const r = await saveFile("offer-letters-upload.csv", `﻿${csv}`, "text/csv;charset=utf-8");
  if (r?.declined) notifyToast("Download cancelled.", "info");
}

function UploadDialog({ onClose }) {
  const { data, bulkCreateOffers, notifyToast } = useStore();
  const [text, setText] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const ref = useRef(null);
  const fields = offerFieldList(data.offerFields);
  const check = (t) => setRes(validateOfferUpload(t, { fields, custom: data.offerFields, company: data.settings.offer_company }));
  async function onFile(f) {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) return setErr("Upload a .csv file (in Excel: File → Save As → CSV UTF-8).");
    if (f.size > 1024 * 1024) return setErr("The file is larger than 1 MB.");
    setErr("");
    const t = await f.text();
    setText(t);
    check(t);
  }
  function create() {
    const r = bulkCreateOffers(res.rows);
    if (!r.ok) return setErr(r.error);
    notifyToast(`${r.ids.length} draft offer(s) created. Review each, then issue.`);
    onClose();
  }
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Upload offers</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <Typography sx={{ fontSize: "0.66rem", color: "#56655f" }}>One row per candidate. Columns you leave out take the default shown under Offer fields. Use “ | ” to separate address lines.</Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadOfferTemplate(data, notifyToast)}>Download template (.csv)</Button>
            <Button size="small" variant="outlined" startIcon={<UploadFileRounded />} onClick={() => ref.current?.click()}>Choose CSV file</Button>
            <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </Stack>
          <TextField multiline minRows={4} maxRows={10} label="…or paste the CSV here" value={text} onChange={(e) => { setText(e.target.value); setRes(null); }} slotProps={{ htmlInput: { style: {  fontSize: 12 } } }} />
          <Box><Button size="small" variant="contained" disabled={!text.trim()} onClick={() => check(text)}>Check file</Button></Box>
          {res && (res.errors.length ? (
            <Alert severity="error" sx={{ fontSize: "0.66rem" }}>
              {res.errors.length} problem(s) — nothing was imported:
              <Box component="ul" sx={{ m: 0, pl: 2 }}>{res.errors.slice(0, 12).map((x, i) => <li key={i}>Line {x.line}: {x.message}</li>)}</Box>
            </Alert>
          ) : <Alert severity="success" sx={{ fontSize: "0.66rem" }}>{res.rows.length} offer(s) passed every check.</Alert>)}
          {res?.warnings.map((w) => <Alert key={w} severity="warning" sx={{ fontSize: "0.64rem" }}>{w}</Alert>)}
          {res && !res.errors.length && (
            <TableWrap>
              <Table size="small">
                <TableHead><TableRow><TableCell>Candidate</TableCell><TableCell>Designation</TableCell><TableCell>Joining</TableCell><TableCell align="right">CTC / month</TableCell></TableRow></TableHead>
                <TableBody>{res.rows.map((r, i) => <TableRow key={i}><TableCell><PersonCell name={r.candidate_name} sub={r.email} /></TableCell><TableCell>{r.designation}</TableCell><TableCell>{fmtDate(r.joining_date)}</TableCell><TableCell align="right">{inr(r.monthly_ctc)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </TableWrap>
          )}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={!res || res.errors.length > 0 || !res.rows.length} onClick={create}>Create draft offers</Button></DialogActions>
    </Dialog>
  );
}

// ─── Fields ───
const BLANK = { key: "", label: "", group: "offer", type: "text", required: false, default: "", optionsText: "", help: "", isNew: true };

function FieldsTab() {
  const { data, setOfferFieldActive, notifyToast } = useStore();
  const can = useCan();
  const [edit, setEdit] = useState(null);
  const typeLabel = { text: "Text", multiline: "Multi-line text", number: "Number", amount: "Amount (₹)", date: "Date", email: "Email", select: "Dropdown", clause: "Clause text" };
  return (
    <Stack spacing={2.5}>
      <Alert severity="info" sx={{ fontSize: "0.68rem" }}>
        Standard fields cover every variable part of your template. Add your own: an extra detail shown in the letter (Candidate or Offer terms), an extra monthly earning in Annexure I (taken out of special allowance), or a whole extra clause — clause text can use placeholders such as {"{{candidate_name}}"} or {"{{work_city}}"}. Each field's key is also its column in the upload file.
      </Alert>
      <SectionCard title="Your fields" action={can && <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setEdit({ ...BLANK })}>Add field</Button>} noPad>
        {data.offerFields.length === 0 ? <EmptyState title="No custom fields" text="Add a field to include more details in your offer letters." /> : (
          <TableWrap>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead><TableRow><TableCell>Key (upload column)</TableCell><TableCell>Label</TableCell><TableCell>Goes in</TableCell><TableCell>Type</TableCell><TableCell>Required</TableCell><TableCell>Default</TableCell><TableCell>In use</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {data.offerFields.map((f) => (
                  <TableRow key={f.key}>
                    <TableCell><Mono>{f.key}</Mono></TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{f.label}</TableCell>
                    <TableCell>{OFFER_GROUPS[f.group]}</TableCell>
                    <TableCell>{typeLabel[f.type]}</TableCell>
                    <TableCell>{f.required ? <Tag tone="info">Required</Tag> : "Optional"}</TableCell>
                    <TableCell sx={{ maxWidth: 240 }}><Typography noWrap sx={{ fontSize: "0.62rem" }}>{String(f.default ?? "") || "—"}</Typography></TableCell>
                    <TableCell><Switch size="small" checked={f.active !== false} disabled={!can} onChange={(e) => { const r = setOfferFieldActive(f.key, e.target.checked); if (!r.ok) notifyToast(r.error, "error"); }} slotProps={{ input: { "aria-label": `Use ${f.label}` } }} /></TableCell>
                    <TableCell align="right">{can && <IconButton size="small" aria-label={`Edit ${f.label}`} onClick={() => setEdit({ ...f, optionsText: (f.options || []).map(([v]) => v).join(", ") })}><EditRounded fontSize="small" /></IconButton>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>
      <SectionCard title="Standard fields from the template" subtitle="Always in the letter" noPad>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead><TableRow><TableCell>Key</TableCell><TableCell>Label</TableCell><TableCell>Section</TableCell><TableCell>Required</TableCell><TableCell>Default</TableCell></TableRow></TableHead>
            <TableBody>{STANDARD_OFFER_FIELDS.map((f) => <TableRow key={f.key}><TableCell><Mono>{f.key}</Mono></TableCell><TableCell>{f.label}</TableCell><TableCell>{OFFER_GROUPS[f.group]}</TableCell><TableCell>{f.required ? "Yes" : "Optional"}</TableCell><TableCell><Typography sx={{ fontSize: "0.62rem" }}>{f.default === "__today" ? "Today" : f.default === "__office" ? "Company office" : String(f.default ?? "") || "—"}</Typography></TableCell></TableRow>)}</TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      {edit && <FieldDialog init={edit} onClose={() => setEdit(null)} />}
    </Stack>
  );
}

function FieldDialog({ init, onClose }) {
  const { upsertOfferField, notifyToast } = useStore();
  const [f, setF] = useState(init);
  const [err, setErr] = useState("");
  const isClause = f.group === "clause";
  const isEarning = f.group === "salary_earning";
  function save() {
    const options = f.optionsText.split(",").map((s) => s.trim()).filter(Boolean).map((o) => [o, o]);
    const r = upsertOfferField({ ...f, options, default: isEarning ? Number(f.default) || 0 : f.default });
    if (!r.ok) return setErr(r.error);
    notifyToast(`Field ${f.key || ""} saved. It now appears in new offers and in the upload template.`);
    onClose();
  }
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{init.isNew ? "Add an offer field" : `Edit ${init.key}`}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 1.5 }}>{err}</Alert>}
        <Stack spacing={1.8} sx={{ pt: 1 }}>
          <FormControl size="small" fullWidth><InputLabel>Goes in</InputLabel><Select label="Goes in" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>{["candidate", "offer", "salary_earning", "clause"].map((g) => <MenuItem key={g} value={g}>{OFFER_GROUPS[g]}</MenuItem>)}</Select></FormControl>
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Key" value={f.key} disabled={!init.isNew} onChange={(e) => setF({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} helperText="e.g. reporting_to" sx={{ flex: 1 }} />
            <TextField size="small" label={isClause ? "Clause heading" : "Label"} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} sx={{ flex: 2 }} />
          </Stack>
          {!isClause && !isEarning && (
            <FormControl size="small" fullWidth><InputLabel>Type</InputLabel><Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{[["text", "Text"], ["multiline", "Multi-line text"], ["number", "Number"], ["amount", "Amount (₹)"], ["date", "Date"], ["select", "Dropdown"]].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</Select></FormControl>
          )}
          {f.type === "select" && !isClause && !isEarning && <TextField size="small" label="Options (comma separated)" value={f.optionsText} onChange={(e) => setF({ ...f, optionsText: e.target.value })} />}
          <TextField size="small" multiline={isClause} minRows={isClause ? 4 : 1} type={isEarning ? "number" : "text"} label={isClause ? "Clause text (use {{field_key}} placeholders)" : isEarning ? "Default amount per month (₹)" : "Default value (optional)"} value={f.default ?? ""} onChange={(e) => setF({ ...f, default: e.target.value })} />
          {!isClause && <TextField size="small" label="Help text (optional)" value={f.help || ""} onChange={(e) => setF({ ...f, help: e.target.value })} />}
          {!isClause && <FormControlLabel control={<Switch checked={!!f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} />} label={<Typography variant="body2">Required on every offer and upload</Typography>} />}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={save}>Save field</Button></DialogActions>
    </Dialog>
  );
}

// ─── Upload format ───
function FormatTab() {
  const { data, notifyToast } = useStore();
  const fields = offerFieldList(data.offerFields);
  return (
    <SectionCard title="CSV upload format for offers" subtitle="One row per candidate. Required columns without a default must be filled; others fall back to the default." action={<Button size="small" variant="contained" startIcon={<DownloadRounded />} onClick={() => downloadOfferTemplate(data, notifyToast)}>Download template</Button>} noPad>
      <TableWrap>
        <Table size="small" sx={{ minWidth: 700 }}>
          <TableHead><TableRow><TableCell>Column</TableCell><TableCell>What to enter</TableCell><TableCell>Required</TableCell><TableCell>Default</TableCell></TableRow></TableHead>
          <TableBody>
            {fields.map((f) => (
              <TableRow key={f.key}>
                <TableCell><Mono>{f.key}</Mono></TableCell>
                <TableCell>{f.label}{f.type === "date" ? " · YYYY-MM-DD" : ""}{f.options ? ` · one of ${f.options.map(([v]) => v).join(" / ")}` : ""}{f.type === "multiline" ? " · separate lines with |" : ""}{f.group === "clause" ? " · clause text; blank uses the default, a single - leaves it out" : ""}</TableCell>
                <TableCell>{f.required && f.default === "" ? <Tag tone="info">Required</Tag> : "Optional"}</TableCell>
                <TableCell><Typography noWrap sx={{ fontSize: "0.62rem", maxWidth: 220 }}>{f.default === "__today" ? "Today" : f.default === "__office" ? "Company office" : String(f.default ?? "") || "—"}</Typography></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrap>
    </SectionCard>
  );
}

// ─── Settings ───
function SettingsTab() {
  const { data, user, updateOfferSettings, notifyToast } = useStore();
  const isSuper = user.role === "superadmin";
  const can = useCan();
  const st = data.settings;
  const [co, setCo] = useState({ ...st.offer_company, office: st.offer_company.office.join("\n") });
  const [mail, setMail] = useState({ subject: st.offer_email_subject, body: st.offer_email_body });
  const logoRef = useRef(null);
  const run = (r, ok) => notifyToast(r.ok ? ok : r.error, r.ok ? "success" : "error");
  const F = (k, l, extra = {}) => <TextField size="small" label={l} value={co[k]} disabled={!isSuper} onChange={(e) => setCo({ ...co, [k]: e.target.value })} {...extra} />;
  return (
    <Stack spacing={2.5}>
      <SectionCard title="Letterhead, footer and signatory" subtitle={isSuper ? "Used on every new offer. Issued offers keep the details they were issued with." : "Only a Super Admin can change these"} action={isSuper && <Button size="small" variant="contained" onClick={() => run(updateOfferSettings({ offer_company: { ...co, office: co.office.split("\n").map((l) => l.trim()).filter(Boolean) } }), "Letterhead saved.")}>Save</Button>}>
        <Stack spacing={1.6}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            {co.logo && <Box component="img" src={co.logo} alt="Logo" sx={{ height: 36 }} />}
            {isSuper && <Button size="small" variant="outlined" onClick={() => logoRef.current?.click()}>Change logo (PNG)</Button>}
            <input ref={logoRef} type="file" accept="image/png" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; if (f.size > 300 * 1024) return notifyToast("Use a PNG logo under 300 KB.", "error"); setCo({ ...co, logo: await readFileAsDataUrl(f) }); }} />
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.6 }}>
            {F("brand", "Short name (used in the text)")}
            {F("legal_name", "Legal name")}
            {F("cin", "CIN")}
            {F("phone", "Phone")}
            {F("website", "Website(s)")}
            {F("jurisdiction", "Courts (city)")}
            {F("signatory_name", "Signatory name")}
            {F("signatory_title", "Signatory title")}
            {F("intranet", "Where staff read policies (e.g. the company intranet)")}
            {F("confidential", "Confidentiality line")}
          </Box>
          {F("office", "Office address (one line per row)", { multiline: true, minRows: 3 })}
        </Stack>
      </SectionCard>
      <SectionCard title="Email to the candidate" subtitle="Placeholders: {name} {designation} {joining_date} {company}" action={can && <Button size="small" variant="contained" onClick={() => run(updateOfferSettings({ offer_email_subject: mail.subject, offer_email_body: mail.body }), "Email template saved.")}>Save</Button>}>
        <Stack spacing={1.6}>
          <TextField size="small" label="Subject" value={mail.subject} disabled={!can} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />
          <TextField size="small" multiline minRows={6} label="Message" value={mail.body} disabled={!can} onChange={(e) => setMail({ ...mail, body: e.target.value })} />
        </Stack>
      </SectionCard>
    </Stack>
  );
}
