// v10.6/v10.7 · Auto-generated letters & documents (People & organisation → Documents & letters).
//  • Pick one person, a group (department / ticked people) or everyone; search by name or code.
//  • Use the built-in letter or upload your own format (.docx with {placeholders}, or .txt / .html) and generate from it.
//  • One person → one Word file; several → a .zip of Word files. Every run is logged in the audit trail.
//  • Finance admins see payslips only.
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Card, Checkbox, Chip, FormControlLabel, InputAdornment, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { DescriptionRounded, DownloadRounded, SearchRounded, UploadFileRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard } from "../../components/kit/UI.jsx";
import { APP_CONFIG } from "../../data/seed.js";
import { fmtDate, fmtNum, isoDate } from "../../lib/utils.js";
import { computeFnf } from "../suite/Exits.jsx";
import { adminKind } from "../../lib/statutory.js";

const LETTERS = [
  ["offer", "Offer letter", "#F27C22"],
  ["designation", "Designation change letter", "#7E57C2"],
  ["resignation", "Resignation acceptance letter", "#66767E"],
  ["relieving", "Relieving letter", "#9C6B45"],
  ["experience", "Experience letter", "#1E88E5"],
  ["fnf", "Full & final settlement statement", "#E53950"],
  ["payslip", "Payslip", "#1F9D63"],
];
export const PLACEHOLDERS = ["Employee name", "Employee code", "Designation", "Department", "Manager", "Date of joining", "Last working day", "Resignation date", "Monthly gross", "Annual CTC", "New designation", "Effective date", "Payslip month", "Gross pay", "Net pay", "F&F net", "Company", "Date"];

const save = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
const b64ToBuf = (b64) => Uint8Array.from(atob(b64.split(",").pop()), (c) => c.charCodeAt(0));

export default function AutoLetters() {
  const { data, user, nameOf, suiteDo, notifyToast } = useStore();
  const financeOnly = user.role === "admin" && adminKind(user) === "finance";
  const letters = financeOnly ? LETTERS.filter((l) => l[0] === "payslip") : LETTERS;
  const people = data.employees.filter((e) => e.status !== "rejected");
  const [kind, setKind] = useState(letters[0][0]);
  const [picked, setPicked] = useState(() => new Set(people[0] ? [people[0].employee_code] : []));
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [extra, setExtra] = useState({ new_designation: "", effective: isoDate(), period: "" });
  const [tplId, setTplId] = useState("builtin");
  const [busy, setBusy] = useState(false);
  const templates = (data.suite?.letterTemplates || []).filter((t) => t.kind === kind);
  const tpl = templates.find((t) => t.id === tplId);
  const company = data.settings.payslip_company?.legal_name || APP_CONFIG.companyName;
  const depts = [...new Set(people.map((e) => e.department))].sort();
  const shown = people.filter((e) => (dept === "all" || e.department === dept) && (!q.trim() || `${e.full_name} ${e.employee_code} ${e.designation}`.toLowerCase().includes(q.trim().toLowerCase())));
  const periods = useMemo(() => [...new Set(data.payslipBatches.map((b) => b.period))].sort().reverse(), [data.payslipBatches]);
  const period = extra.period || periods[0] || "";
  const first = people.find((e) => picked.has(e.employee_code));

  function vars(e) {
    const exit = (data.suite?.exits || []).find((x) => x.employee_code === e.employee_code && x.status !== "withdrawn");
    let fnf = null; try { fnf = exit ? computeFnf(data, exit) : null; } catch { fnf = null; }
    const batch = data.payslipBatches.find((b) => b.period === period);
    const slip = batch?.slips.find((s) => s.employee_code === e.employee_code);
    const v = slip?.values || {};
    return {
      "Employee name": e.full_name, "Employee code": e.employee_code, Designation: e.designation, Department: e.department, Manager: nameOf(e.reporting_manager) || "",
      "Date of joining": fmtDate(e.date_of_joining), "Last working day": exit?.last_day ? fmtDate(exit.last_day) : "{Last working day}", "Resignation date": exit?.resigned_on ? fmtDate(exit.resigned_on) : "{Resignation date}",
      "Monthly gross": `₹${fmtNum(e.monthly_gross)}`, "Annual CTC": `₹${fmtNum(e.annual_ctc || e.monthly_gross * 12)}`, "New designation": extra.new_designation || "{New designation}", "Effective date": fmtDate(extra.effective),
      "Payslip month": period ? new Date(`${period}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "", "Gross pay": v.GROSS || v.GROSS_EARNINGS ? `₹${fmtNum(v.GROSS || v.GROSS_EARNINGS)}` : "", "Net pay": v.NET_PAY ? `₹${fmtNum(v.NET_PAY)}` : "",
      "F&F net": fnf ? `₹${fmtNum(Math.round(fnf.net))}` : "", Company: company, Date: fmtDate(isoDate()),
      _exit: exit, _fnf: fnf, _slip: slip, ...Object.fromEntries(Object.entries(e).filter(([, x]) => typeof x !== "object").map(([k, x]) => [k, String(x ?? "")])),
    };
  }
  const fill = (text, V) => text.replace(/\{([^{}]+)\}/g, (m, k) => (V[k.trim()] !== undefined && !k.startsWith("_") ? V[k.trim()] : m));

  function builtinBody(e, V) {
    const n = e.full_name;
    switch (kind) {
      case "offer": return [`Dear ${n},`, `We are pleased to offer you the position of ${e.designation} in our ${e.department} team at ${company}, reporting to ${V.Manager || "your manager"}.`, `Your date of joining is ${V["Date of joining"]} and your monthly gross salary is ${V["Monthly gross"]} (annual ${V["Annual CTC"]}), with PF, ESI (where applicable), professional tax and income tax deducted as per law.`, "Please sign and return a copy of this letter as your acceptance."];
      case "designation": return [`Dear ${n},`, `With effect from ${V["Effective date"]}, your designation changes from ${e.designation} to ${V["New designation"]}.`, "All other terms and conditions of your employment remain unchanged. Congratulations and best wishes."];
      case "resignation": return [`Dear ${n},`, `We acknowledge your resignation dated ${V["Resignation date"]}. Your last working day will be ${V["Last working day"]}.`, "Please complete the exit steps in EZY HR: clearance → notice → exit interview → full & final settlement."];
      case "relieving": return ["To whom it may concern,", `This is to confirm that ${n} (${e.employee_code}), ${e.designation}, has been relieved from the services of ${company} at the close of business on ${V["Last working day"]}, after completing the exit formalities.`, "We wish them success in the future."];
      case "experience": return ["To whom it may concern,", `This is to certify that ${n} worked with ${company} as ${e.designation} in ${e.department} from ${V["Date of joining"]} to ${V["Last working day"]}.`, "During this period we found them sincere, hard-working and a good team member."];
      case "fnf": return [`Full & final settlement — ${n} (${e.employee_code})`, `Last working day: ${V["Last working day"]} · status: ${V._exit?.fnf_status || "not started"}.`, ...(V._fnf ? [...V._fnf.earnings.map(([k, v]) => `${k}: ₹${fmtNum(Math.round(v))}`), ...V._fnf.deductions.map(([k, v]) => `Less ${k}: ₹${fmtNum(Math.round(v))}`), `Net payable: ${V["F&F net"]}`] : ["No exit is recorded — start one in Exits & F&F to compute the settlement."]), "Paid within 2 working days of the last working day as per the Code on Wages."];
      case "payslip": {
        if (!V._slip) return [`No payslip for ${n} in ${V["Payslip month"] || "this month"}.`];
        const lines = Object.entries(V._slip.values || {}).filter(([, v]) => typeof v === "number" && v);
        return [`Payslip — ${V["Payslip month"]}`, `${n} · ${e.employee_code} · ${e.designation} · ${e.department}`, ...lines.map(([k, v]) => `${k}: ₹${fmtNum(v)}`)];
      }
      default: return [];
    }
  }

  async function buildDocx(e) {
    const V = vars(e);
    const title = LETTERS.find((l) => l[0] === kind)[1];
    if (tpl?.format === "docx") {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(b64ToBuf(tpl.data));
      const files = Object.keys(zip.files).filter((f) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(f));
      for (const f of files) {
        let xml = await zip.file(f).async("string");
        // placeholders split across Word runs: drop the XML tags inside {…} before replacing
        xml = xml.replace(/\{(?:[^{}<]|<[^>]+>)*\}/g, (m) => m.replace(/<[^>]+>/g, ""));
        xml = xml.replace(/\{([^{}<]+)\}/g, (m, k) => (V[k.trim()] !== undefined && !k.startsWith("_") ? String(V[k.trim()]).replace(/&/g, "&amp;").replace(/</g, "&lt;") : m));
        zip.file(f, xml);
      }
      return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    }
    const d = await import("docx");
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = d;
    const body = tpl?.format === "text" ? fill(tpl.data, V).split(/\r?\n/) : builtinBody(e, V);
    const doc = new Document({ creator: "EZY HR", title, sections: [{ children: [
      ...(tpl ? [] : [new Paragraph({ children: [new TextRun({ text: company, bold: true, size: 28, color: "15414F" })] }), new Paragraph({ children: [new TextRun({ text: `Date: ${V.Date}`, size: 20 })] }), new Paragraph({ text: "" }), new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: title, bold: true })] })]),
      ...body.map((t) => new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: t, size: 22 })] })),
      ...(tpl ? [] : [new Paragraph({ text: "" }), new Paragraph({ children: [new TextRun({ text: `For ${company}`, size: 22 })] }), new Paragraph({ children: [new TextRun({ text: "Authorised signatory · HR", size: 22 })] })]),
    ] }] });
    return Packer.toBlob(doc);
  }

  async function generate() {
    const list = people.filter((e) => picked.has(e.employee_code));
    if (!list.length) return notifyToast("Pick at least one person.", "error");
    setBusy(true);
    try {
      const title = LETTERS.find((l) => l[0] === kind)[1].replace(/[^\w]+/g, "_");
      if (list.length === 1) save(await buildDocx(list[0]), `${title}_${list[0].employee_code}.docx`);
      else {
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        for (const e of list) zip.file(`${title}_${e.employee_code}_${e.full_name.replace(/[^\w]+/g, "_")}.docx`, await buildDocx(e));
        save(await zip.generateAsync({ type: "blob" }), `${title}_${list.length}_people.zip`);
      }
      suiteDo("admin106", (s, { now, code: by }) => { s.generatedLetters = [...list.map((e) => ({ kind, template: tpl?.name || "built-in", employee_code: e.employee_code, by, at: now })), ...(s.generatedLetters || [])].slice(0, 300); }, { action: "LETTER_GENERATED", details: `${title} · ${list.length} people · ${tpl?.name || "built-in format"}` });
      notifyToast(`${list.length} document(s) generated.`);
    } catch (err) { notifyToast(`Could not generate: ${err.message}`, "error"); }
    setBusy(false);
  }

  function upload(file) {
    if (!file) return;
    if (file.size > 700 * 1024) return notifyToast("Keep the format file under 700 KB.", "error");
    const isDocx = /\.docx$/i.test(file.name);
    const r = new FileReader();
    r.onload = () => {
      let text = String(r.result);
      if (!isDocx && /\.html?$/i.test(file.name)) { const div = document.createElement("div"); div.innerHTML = text.replace(/<\/(p|div|h\d|li|br)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n"); text = div.textContent || ""; }
      const id = `LT-${Date.now()}`;
      const res = suiteDo("admin106", (s, { now, code }) => { s.letterTemplates = [{ id, kind, name: file.name, format: isDocx ? "docx" : "text", data: text, by: code, at: now }, ...(s.letterTemplates || [])]; }, { action: "LETTER_TEMPLATE_UPLOAD", details: `${kind} · ${file.name}` });
      if (res.ok) { setTplId(id); notifyToast(`Format "${file.name}" saved for ${LETTERS.find((l) => l[0] === kind)[1]}.`); } else notifyToast(res.error, "error");
    };
    if (isDocx) r.readAsDataURL(file); else r.readAsText(file);
  }
  const removeTpl = (id) => { suiteDo("admin106", (s) => { s.letterTemplates = (s.letterTemplates || []).filter((t) => t.id !== id); }, { action: "LETTER_TEMPLATE_REMOVE", details: id }); setTplId("builtin"); };

  if (user.role === "emp") return null;
  const allShown = shown.length > 0 && shown.every((e) => picked.has(e.employee_code));
  const toggle = (c) => setPicked((p) => { const n = new Set(p); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const preview = first ? (tpl?.format === "text" ? fill(tpl.data, vars(first)).split(/\r?\n/) : tpl?.format === "docx" ? [`Your Word format "${tpl.name}" will be filled for each person — placeholders like {Employee name} are replaced.`] : builtinBody(first, vars(first))) : [];
  return (
    <SectionCard title={financeOnly ? "Auto-generated payslips" : "Auto-generated letters & documents"} subtitle={financeOnly ? "Generate payslips as Word in the built-in or your own format, for one person, a group or everyone." : "Offer, designation change, resignation acceptance, relieving, experience, F&F statement and payslip — in the built-in or your own uploaded format, for one person, a group or everyone."}>
      {letters.length > 1 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", sm: "repeat(4, minmax(0,1fr))", lg: "repeat(7, minmax(0,1fr))" }, gap: 1, mb: 2 }}>
          {letters.map(([k, l, c]) => (
            <Card key={k} onClick={() => { setKind(k); setTplId("builtin"); }} sx={{ p: 1.2, cursor: "pointer", borderTop: `3px solid ${c}`, background: kind === k ? `${c}14` : "#fff", outline: kind === k ? `2px solid ${c}` : "none" }}>
              <DescriptionRounded sx={{ color: c, fontSize: 20 }} />
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, mt: 0.3 }}>{l}</Typography>
            </Card>
          ))}
        </Box>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1.2fr)" }, gap: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: "0.74rem", mb: 1 }}>1 · Who · {picked.size} selected</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <TextField size="small" fullWidth placeholder="Search name, code or designation" value={q} onChange={(e) => setQ(e.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
            <TextField select size="small" value={dept} onChange={(e) => setDept(e.target.value)} sx={{ minWidth: 150 }}><MenuItem value="all">All departments</MenuItem>{depts.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}</TextField>
          </Stack>
          <Box sx={{ border: "1px solid #e3e9ec", borderRadius: 2, maxHeight: 260, overflowY: "auto" }}>
            <FormControlLabel sx={{ px: 1, m: 0, width: "100%", borderBottom: "1px solid #eef1f2", background: "#f6f8f9" }} control={<Checkbox size="small" checked={allShown} indeterminate={!allShown && shown.some((e) => picked.has(e.employee_code))} onChange={() => setPicked((p) => { const n = new Set(p); shown.forEach((e) => (allShown ? n.delete(e.employee_code) : n.add(e.employee_code))); return n; })} />} label={<Typography sx={{ fontSize: "0.7rem", fontWeight: 800 }}>All{dept !== "all" ? ` in ${dept}` : ""}{q ? " matching" : ""} ({shown.length})</Typography>} />
            {shown.map((e) => <FormControlLabel key={e.employee_code} sx={{ px: 1, m: 0, width: "100%" }} control={<Checkbox size="small" checked={picked.has(e.employee_code)} onChange={() => toggle(e.employee_code)} />} label={<Typography sx={{ fontSize: "0.68rem" }}>{e.full_name} <span style={{ color: "#7b878c" }}>· {e.employee_code} · {e.department}</span></Typography>} />)}
          </Box>
          {picked.size > 0 && <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>{[...picked].slice(0, 8).map((c) => <Chip key={c} size="small" label={nameOf(c)} onDelete={() => toggle(c)} />)}{picked.size > 8 && <Chip size="small" label={`+${picked.size - 8} more`} />}<Chip size="small" variant="outlined" label="Clear" onClick={() => setPicked(new Set())} /></Stack>}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: "0.74rem", mb: 1 }}>2 · Format</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: "center" }} useFlexGap flexWrap="wrap">
            <TextField select size="small" value={tplId} onChange={(e) => setTplId(e.target.value)} sx={{ minWidth: 240 }}><MenuItem value="builtin">Built-in EZY HR format</MenuItem>{templates.map((t) => <MenuItem key={t.id} value={t.id}>Your format · {t.name}</MenuItem>)}</TextField>
            <Button size="small" variant="outlined" component="label" startIcon={<UploadFileRounded />}>Upload your format<input hidden type="file" accept=".docx,.txt,.html,.htm" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} /></Button>
            {tpl && <Button size="small" color="error" startIcon={<DeleteOutlineRounded />} onClick={() => removeTpl(tpl.id)}>Remove</Button>}
          </Stack>
          <Typography sx={{ fontSize: "0.6rem", color: "#7b878c", mb: 1 }}>Use these placeholders in your Word (.docx), text or HTML format: {PLACEHOLDERS.map((p) => `{${p}}`).join(" ")} — or any employee field such as {"{pan}"} or {"{uan}"}.</Typography>
          {kind === "designation" && <Stack direction="row" spacing={1} sx={{ mb: 1 }}><TextField size="small" label="New designation" value={extra.new_designation} onChange={(ev) => setExtra({ ...extra, new_designation: ev.target.value })} /><TextField size="small" type="date" label="Effective from" value={extra.effective} onChange={(ev) => setExtra({ ...extra, effective: ev.target.value })} slotProps={{ inputLabel: { shrink: true } }} /></Stack>}
          {kind === "payslip" && <TextField select size="small" label="Month" value={period} onChange={(ev) => setExtra({ ...extra, period: ev.target.value })} sx={{ minWidth: 160, mb: 1 }}>{periods.map((p) => <MenuItem key={p} value={p}>{new Date(`${p}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</MenuItem>)}</TextField>}
          <Typography sx={{ fontWeight: 800, fontSize: "0.74rem", mb: 0.6 }}>3 · Preview{first ? ` · ${first.full_name}` : ""}</Typography>
          <Box sx={{ p: 1.5, borderRadius: 2, background: "#fafbfb", border: "1px solid #e3e9ec", mb: 1.5, maxHeight: 220, overflowY: "auto" }}>{preview.length ? preview.map((t, i) => <Typography key={i} sx={{ fontSize: "0.68rem", mb: 0.5 }}>{t || " "}</Typography>) : <Typography variant="body2" color="text.secondary">Pick someone to see a preview.</Typography>}</Box>
          {["relieving", "experience", "fnf", "resignation"].includes(kind) && first && !vars(first)._exit && <Alert severity="info" sx={{ mb: 1.5, fontSize: "0.66rem" }}>No exit is recorded for {first.full_name} — the last working day stays as a placeholder.</Alert>}
          <Button variant="contained" startIcon={<DownloadRounded />} onClick={generate} disabled={busy || !picked.size}>{busy ? "Generating…" : picked.size > 1 ? `Generate ${picked.size} Word documents (.zip)` : "Generate Word document"}</Button>
        </Box>
      </Box>
    </SectionCard>
  );
}
