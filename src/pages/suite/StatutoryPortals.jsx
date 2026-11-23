// v10.5 · PF & income-tax portals — for HR, Finance and the Super Admin.
//  • Connections: the company's EPFO establishment and its TRACES (income-tax) deductor account.
//  • Form 16 from TRACES: request Part A for a financial year, combine it with Part B from payroll, download, and
//    publish each employee's certificate straight into their My profile → Documents → My files.
//  • EPFO ECR: build the monthly ECR from salary data, download it, record the upload and the TRRN.
// This build runs a sandbox connector in the browser; a live connection goes through the integration server with the
// company's TRACES deductor login and EPFO establishment DSC (no passwords are stored here).
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { LinkRounded, LinkOffRounded, CloudDownloadRounded, PublishRounded, DownloadRounded, SyncRounded, CloudUploadRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, TableWrap, Tag, Mono, PersonCell, EmptyState } from "../../components/kit/UI.jsx";
import { tabSx } from "../../components/suite/Hub.jsx";
import { isoDate, fmtDateTime } from "../../lib/utils.js";
import { fyOptions, certName, taxCertificate, ctryOf } from "../../lib/payrollSuite.js";
import { certHtml } from "../../components/pay/suite/ReportsForm16.jsx";

const P0 = { epfo: { connected: false }, traces: { connected: false }, jobs: [], ecr: [] };
const portalsOf = (data) => ({ ...P0, ...(data.suite?.portals || {}) });
const ensure = (s) => (s.portals = { ...P0, ...(s.portals || {}) });
const toDataUrl = (html) => `data:text/html;base64,${btoa(unescape(encodeURIComponent(html)))}`;
const inr = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const lastMonths = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1 - i); return d.toISOString().slice(0, 7); });

function ecrRows(employees) {
  return employees.map((e) => {
    const basic = Math.round(Number(e.basic_monthly) || (Number(e.monthly_gross) || 0) * 0.5);
    const epfWage = Math.min(basic, 15000);
    const ee = Math.round(epfWage * 0.12), eps = Math.round(epfWage * 0.0833);
    return { e, uan: e.uan || "", gross: Number(e.monthly_gross) || 0, epfWage, epsWage: epfWage, edliWage: epfWage, ee, eps, er: ee - eps };
  });
}

export default function StatutoryPortals() {
  const { data, suiteDo, suiteCan, notifyToast, nameOf } = useStore();
  const can = suiteCan("portals");
  const P = portalsOf(data);
  const [tab, setTab] = useState("form16");
  const [connect, setConnect] = useState(null);
  const india = useMemo(() => data.employees.filter((e) => e.status === "active" && ctryOf(e) === "IN"), [data.employees]);
  const opts = fyOptions(isoDate()).slice(0, 3);
  const [fy, setFy] = useState(opts[0]);
  const [sel, setSel] = useState([]);
  const [month, setMonth] = useState(lastMonths(1)[0]);
  const job = P.jobs.filter((j) => j.fy === fy).sort((a, b) => b.requested_at.localeCompare(a.requested_at))[0];
  const pulled = job?.status === "available" ? job.codes : [];
  const published = new Set(P.jobs.filter((j) => j.fy === fy).flatMap((j) => j.published || []));
  const ecr = useMemo(() => ecrRows(india), [india]);
  const filed = P.ecr.find((r) => r.month === month);

  const run = (fn, opts2) => { const r = suiteDo("portals", fn, opts2); if (!r.ok) notifyToast(r.error, "error"); return r; };

  function disconnect(k) {
    run((s, { now }) => { ensure(s)[k] = { connected: false, disconnected_at: now }; return {}; }, { action: "PORTAL_DISCONNECT", details: k.toUpperCase() });
    notifyToast(`${k === "epfo" ? "EPFO" : "TRACES"} disconnected.`, "info");
  }
  function sync(k) {
    run((s, { now }) => { ensure(s)[k].last_sync = now; return {}; }, { action: "PORTAL_SYNC", details: k.toUpperCase() });
    notifyToast(`${k === "epfo" ? "EPFO" : "TRACES"} status refreshed.`, "success");
  }
  function requestForm16() {
    if (!P.traces.connected) return notifyToast("Connect TRACES first.", "error");
    const codes = sel.length ? sel : india.map((e) => e.employee_code);
    const r = run((s, { now, code }) => {
      const p = ensure(s);
      const id = `TR-${String(p.jobs.length + 1).padStart(4, "0")}`;
      p.jobs.push({ id, fy, codes, status: "processing", requested_at: now, requested_by: code, published: [] });
      return { id };
    }, { action: "TRACES_FORM16_REQUEST", details: (x) => `${x.id} · FY ${fy} · ${codes.length} PAN(s)` });
    if (!r.ok) return;
    notifyToast(`Request ${r.id} sent to TRACES for ${codes.length} employee(s). Part A is usually ready in minutes.`, "info");
    // Sandbox: TRACES makes the files available shortly after the request.
    setTimeout(() => {
      suiteDo("portals", (s, { now }) => { const j = ensure(s).jobs.find((x) => x.id === r.id); if (j) { j.status = "available"; j.ready_at = now; } return {}; }, { action: "TRACES_FORM16_READY", details: r.id });
      notifyToast(`TRACES: Form 16 Part A for ${codes.length} employee(s) is ready to download.`, "success");
    }, 2500);
  }
  const certFor = (e) => taxCertificate(e, fy, { revisions: data.salaryRevisions, perks: data.perks, perkRules: data.paySettings.perkRules, today: isoDate() });
  const html = (e) => certHtml(certFor(e), "Issued · Part A from TRACES");
  function download(e) {
    const a = document.createElement("a");
    a.href = toDataUrl(html(e));
    a.download = `${certName(fy).replace(/\s+/g, "")}_${fy}_${e.employee_code}.html`;
    a.click();
  }
  function publish(codes) {
    const list = codes.filter((c) => pulled.includes(c));
    if (!list.length) return notifyToast("Download Part A from TRACES first.", "error");
    const files = Object.fromEntries(list.map((c) => { const e = india.find((x) => x.employee_code === c); const h = html(e); return [c, { name: `${certName(fy)} ${fy} ${c}.html`, size: h.length, type: "text/html", data_url: toDataUrl(h) }]; }));
    const r = run((s, { x, now, code }) => {
      x.empFiles = x.empFiles || [];
      list.forEach((c) => {
        x.empFiles.unshift({ id: `EF-T${Date.now().toString(36)}${c}`, employee_code: c, title: `${certName(fy)} · FY ${fy}`, category: "Payroll & tax", note: "Part A from TRACES, Part B from payroll", file: files[c], uploaded_by: code, at: now, source: "TRACES" });
      });
      const j = ensure(s).jobs.find((y) => y.id === job.id);
      j.published = [...new Set([...(j.published || []), ...list])];
      return { n: list.length };
    }, { action: "TRACES_FORM16_PUBLISH", details: (x) => `FY ${fy} · ${x.n} employee(s)`, note: () => ({ to: list, text: `Your ${certName(fy)} for FY ${fy} is in My profile → Documents → My files.`, link: "/documents" }) });
    if (r.ok) { notifyToast(`${r.n} certificate(s) published to employees' My files.`); setSel([]); }
  }
  function downloadEcr() {
    const lines = ecr.filter((r) => r.uan).map((r) => [r.uan, r.e.full_name.toUpperCase(), r.gross, r.epfWage, r.epsWage, r.edliWage, r.ee, r.eps, r.er, 0, 0].join("#~#"));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
    a.download = `ECR_${month}.txt`;
    a.click();
  }
  function uploadEcr() {
    if (!P.epfo.connected) return notifyToast("Connect EPFO first.", "error");
    const withUan = ecr.filter((r) => r.uan);
    const r = run((s, { now, code }) => {
      const p = ensure(s);
      const trrn = `${Date.now()}`.slice(-13);
      p.ecr = p.ecr.filter((y) => y.month !== month);
      p.ecr.push({ month, trrn, at: now, by: code, members: withUan.length, ee: withUan.reduce((t, y) => t + y.ee, 0), er: withUan.reduce((t, y) => t + y.er + y.eps, 0), status: "uploaded" });
      return { trrn };
    }, { action: "EPFO_ECR_UPLOAD", details: (x) => `${month} · TRRN ${x.trrn}` });
    if (r.ok) notifyToast(`ECR for ${month} uploaded to EPFO. TRRN ${r.trrn} — pay the challan to close it.`, "success");
  }

  const allSel = sel.length === india.length && india.length > 0;
  return (
    <>
      <PageHeader eyebrow="PAY & BENEFITS · STATUTORY PORTALS" title="PF & income-tax portals" subtitle="Connect the EPFO establishment and the TRACES deductor account, pull employees' Form 16 from TRACES into their My files, and file the monthly PF ECR." />
      <Stack spacing={2.5}>
        <Grid min={170}>
          <StatCard label="TRACES (income tax)" value={P.traces.connected ? "Connected" : "Not connected"} hint={P.traces.connected ? `TAN ${P.traces.tan}` : "Needed for Form 16"} tone={P.traces.connected ? "good" : "warn"} onClick={() => setTab("connections")} />
          <StatCard label="EPFO (PF)" value={P.epfo.connected ? "Connected" : "Not connected"} hint={P.epfo.connected ? `Est. ${P.epfo.establishment}` : "Needed for ECR"} tone={P.epfo.connected ? "good" : "warn"} onClick={() => setTab("connections")} />
          <StatCard label={`${certName(fy)} published`} value={`${published.size}/${india.length}`} hint={`FY ${fy}`} onClick={() => setTab("form16")} />
          <StatCard label="ECR filed" value={filed ? "Yes" : "No"} hint={filed ? `TRRN ${filed.trrn}` : month} tone={filed ? "good" : "info"} onClick={() => setTab("ecr")} />
        </Grid>
        {!can && <Alert severity="info">You can view portal status. Changes need the payroll, payslips or accounts module.</Alert>}
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={tabSx}>
            <Tab value="form16" label="Form 16 · TRACES" />
            <Tab value="ecr" label="PF ECR · EPFO" />
            <Tab value="connections" label="Connections" />
          </Tabs>
        </Box>

        {tab === "connections" && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5 }}>
            {[["traces", "Income tax · TRACES", "Deductor account for Form 16 Part A, Form 26Q/24Q status and PAN verification.", P.traces, P.traces.connected ? `TAN ${P.traces.tan} · user ${P.traces.user}` : ""], ["epfo", "Provident fund · EPFO", "Unified employer portal for ECR upload, challan (TRRN) and UAN checks.", P.epfo, P.epfo.connected ? `Establishment ${P.epfo.establishment} · user ${P.epfo.user}` : ""]].map(([k, t, sub, st, line]) => (
              <SectionCard key={k} title={t} subtitle={sub} action={<Tag tone={st.connected ? "good" : "neutral"}>{st.connected ? "Connected" : "Not connected"}</Tag>}>
                <Stack spacing={1.2}>
                  {st.connected && <Typography sx={{ fontSize: "0.68rem" }}>{line}<br /><span style={{ color: "#78827b" }}>Connected {fmtDateTime(st.connected_at)}{st.last_sync ? ` · last checked ${fmtDateTime(st.last_sync)}` : ""}</span></Typography>}
                  <Stack direction="row" spacing={1}>
                    {st.connected ? (
                      <>
                        <Button size="small" variant="outlined" startIcon={<SyncRounded />} disabled={!can} onClick={() => sync(k)}>Check status</Button>
                        <Button size="small" color="inherit" startIcon={<LinkOffRounded />} disabled={!can} onClick={() => disconnect(k)}>Disconnect</Button>
                      </>
                    ) : <Button size="small" variant="contained" startIcon={<LinkRounded />} disabled={!can} onClick={() => setConnect(k)}>Connect</Button>}
                  </Stack>
                </Stack>
              </SectionCard>
            ))}
            <Alert severity="info" sx={{ gridColumn: "1 / -1", fontSize: "0.68rem" }}>This build uses a sandbox connector. For live filing, the integration server signs in with your TRACES deductor login and EPFO establishment DSC. Passwords are never stored in EZY HR.</Alert>
          </Box>
        )}

        {tab === "form16" && (
          <SectionCard
            title={`${certName(fy)} from TRACES`}
            subtitle={job ? `Last request ${job.id} · ${job.status === "available" ? `ready ${fmtDateTime(job.ready_at)}` : "processing at TRACES…"}` : "No request yet for this year"}
            action={
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: "flex-end", "& .MuiButton-root": { whiteSpace: "nowrap" } }} useFlexGap>
                <TextField select size="small" value={fy} onChange={(e) => { setFy(e.target.value); setSel([]); }} sx={{ minWidth: 130 }}>{opts.map((o) => <MenuItem key={o} value={o}>FY {o}</MenuItem>)}</TextField>
                <Button size="small" variant="contained" startIcon={<CloudDownloadRounded />} disabled={!can || job?.status === "processing"} onClick={requestForm16}>{sel.length ? `Request ${sel.length} from TRACES` : "Request all from TRACES"}</Button>
                <Button size="small" variant="outlined" startIcon={<PublishRounded />} disabled={!can || !pulled.length} onClick={() => publish(sel.length ? sel : pulled)}>Publish to My files</Button>
              </Stack>
            }
            noPad
          >
            {!P.traces.connected && <Alert severity="warning" sx={{ m: 2 }}>Connect TRACES under Connections to pull Part A.</Alert>}
            <TableWrap>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead><TableRow><TableCell padding="checkbox"><Checkbox size="small" checked={allSel} indeterminate={!!sel.length && !allSel} onChange={() => setSel(allSel ? [] : india.map((e) => e.employee_code))} /></TableCell><TableCell>Employee</TableCell><TableCell>PAN</TableCell><TableCell>TRACES Part A</TableCell><TableCell>Employee's My files</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>
                  {india.map((e) => {
                    const on = pulled.includes(e.employee_code);
                    return (
                      <TableRow key={e.employee_code} hover>
                        <TableCell padding="checkbox"><Checkbox size="small" checked={sel.includes(e.employee_code)} onChange={() => setSel(sel.includes(e.employee_code) ? sel.filter((c) => c !== e.employee_code) : [...sel, e.employee_code])} /></TableCell>
                        <TableCell><PersonCell name={e.full_name} sub={`${e.employee_code} · ${e.designation}`} /></TableCell>
                        <TableCell><Mono>{e.pan || "—"}</Mono></TableCell>
                        <TableCell><Tag tone={on ? "good" : job?.status === "processing" && job.codes.includes(e.employee_code) ? "info" : "neutral"}>{on ? "Downloaded" : job?.status === "processing" && job.codes.includes(e.employee_code) ? "Processing" : "Not requested"}</Tag></TableCell>
                        <TableCell><Tag tone={published.has(e.employee_code) ? "good" : "neutral"}>{published.has(e.employee_code) ? "Published" : "Not yet"}</Tag></TableCell>
                        <TableCell align="right">{on && <Button size="small" startIcon={<DownloadRounded />} onClick={() => download(e)}>Download</Button>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrap>
          </SectionCard>
        )}

        {tab === "ecr" && (
          <SectionCard
            title="Electronic challan-cum-return (ECR)"
            subtitle={filed ? `Uploaded ${fmtDateTime(filed.at)} by ${nameOf(filed.by)} · TRRN ${filed.trrn}` : "Built from current salary data; payroll's final run values apply when they exist"}
            action={
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: "flex-end", "& .MuiButton-root": { whiteSpace: "nowrap" } }} useFlexGap>
                <TextField select size="small" value={month} onChange={(e) => setMonth(e.target.value)}>{lastMonths(6).map((m) => <MenuItem key={m} value={m}>{new Date(`${m}-01T12:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</MenuItem>)}</TextField>
                <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={downloadEcr}>Download ECR</Button>
                <Button size="small" variant="contained" startIcon={<CloudUploadRounded />} disabled={!can} onClick={uploadEcr}>{filed ? "Re-upload to EPFO" : "Upload to EPFO"}</Button>
              </Stack>
            }
            noPad
          >
            {!P.epfo.connected && <Alert severity="warning" sx={{ m: 2 }}>Connect EPFO under Connections to upload.</Alert>}
            {ecr.length === 0 ? <Box sx={{ p: 2.5 }}><EmptyState title="No India employees" text="ECR applies to employees on India payroll." /></Box> : (
              <TableWrap>
                <Table size="small" sx={{ minWidth: 760 }}>
                  <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>UAN</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right">EPF wages</TableCell><TableCell align="right">EE 12%</TableCell><TableCell align="right">EPS 8.33%</TableCell><TableCell align="right">ER EPF 3.67%</TableCell></TableRow></TableHead>
                  <TableBody>
                    {ecr.map((r) => (
                      <TableRow key={r.e.employee_code}>
                        <TableCell><PersonCell name={r.e.full_name} sub={r.e.employee_code} /></TableCell>
                        <TableCell>{r.uan ? <Mono>{r.uan}</Mono> : <Tag tone="warn">UAN missing</Tag>}</TableCell>
                        <TableCell align="right">{inr(r.gross)}</TableCell>
                        <TableCell align="right">{inr(r.epfWage)}</TableCell>
                        <TableCell align="right">{inr(r.ee)}</TableCell>
                        <TableCell align="right">{inr(r.eps)}</TableCell>
                        <TableCell align="right">{inr(r.er)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            )}
          </SectionCard>
        )}
      </Stack>
      <ConnectDialog k={connect} onClose={() => setConnect(null)} />
    </>
  );
}

function ConnectDialog({ k, onClose }) {
  const { suiteDo, notifyToast } = useStore();
  const [f, setF] = useState({});
  const [err, setErr] = useState("");
  React.useEffect(() => { setF({}); setErr(""); }, [k]);
  if (!k) return null;
  const tr = k === "traces";
  function save() {
    if (tr && !/^[A-Z]{4}\d{5}[A-Z]$/.test((f.tan || "").toUpperCase())) return setErr("Enter a valid TAN (e.g. HYDO12345A).");
    if (!tr && !/^[A-Z]{5}\d{7}$/.test((f.establishment || "").toUpperCase())) return setErr("Enter the EPFO establishment ID (e.g. APHYD1234567).");
    if (!(f.user || "").trim()) return setErr("Enter the portal user ID.");
    if (!(f.secret || "").trim()) return setErr("Enter the password or DSC PIN to verify the connection.");
    const r = suiteDo("portals", (s, { now, code }) => {
      const p = ensure(s);
      p[k] = tr ? { connected: true, tan: f.tan.toUpperCase(), user: f.user.trim(), connected_at: now, by: code } : { connected: true, establishment: f.establishment.toUpperCase(), user: f.user.trim(), connected_at: now, by: code };
      return {};
    }, { action: "PORTAL_CONNECT", details: tr ? `TRACES · ${f.tan.toUpperCase()}` : `EPFO · ${f.establishment.toUpperCase()}` });
    if (!r.ok) return setErr(r.error);
    notifyToast(`${tr ? "TRACES" : "EPFO"} connected. The password was used only to verify and is not stored.`, "success");
    onClose();
  }
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Connect {tr ? "TRACES (income tax)" : "EPFO (PF)"}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.8} sx={{ pt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          {tr ? <TextField label="TAN *" value={f.tan || ""} onChange={(e) => setF({ ...f, tan: e.target.value })} /> : <TextField label="Establishment ID *" value={f.establishment || ""} onChange={(e) => setF({ ...f, establishment: e.target.value })} />}
          <TextField label="Portal user ID *" value={f.user || ""} onChange={(e) => setF({ ...f, user: e.target.value })} />
          <TextField label={tr ? "Password *" : "Password / DSC PIN *"} type="password" value={f.secret || ""} onChange={(e) => setF({ ...f, secret: e.target.value })} helperText="Used once to verify; never saved" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>Connect</Button>
      </DialogActions>
    </Dialog>
  );
}
