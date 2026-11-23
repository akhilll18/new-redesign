// Expense hub (Finance · Super Admin): one register of every employee claim, advance, travel-desk booking,
// corporate-card spend and third-party expense — raised in PeopleHub or brought in from other apps — split by
// company and location. Respects the company / location picker in the header.
import React, { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { SyncRounded, UploadFileRounded, DownloadRounded, LinkRounded, LinkOffRounded, ReceiptLongRounded, PaymentsRounded, BusinessRounded, ErrorOutlineRounded, AddRounded, CloudDownloadRounded, CreditCardRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Mono, TableWrap, Tag, EmptyState, HBar } from "../../components/kit/UI.jsx";
import { RequestDrawer, RequestStatus } from "../../components/kit/Requests.jsx";
import { EXPENSE_APPS, APP_BY, SOURCE_LABEL, KIND_LABEL, PAID_BY_LABEL, registerRows, rollup, parseCsv, recordsFromCsv, CSV_TEMPLATE, CSV_COLUMNS, mapCategory } from "../../lib/expenseHub.js";
import { downloadCsv, fmtDate, fmtDateTime, fmtNum, isoDate } from "../../lib/utils.js";

const inr = (n) => `₹${fmtNum(Math.round(n || 0))}`;
const KIND_TONE = { expense: "accent", advance: "info", travel: "neutral", card: "neutral", third_party: "warn" };
const TP_STATUS = ["Pending", "Booked", "Paid", "Rejected"];

function Breakdown({ rows, by, name }) {
  const list = rollup(rows, by);
  const max = Math.max(1, ...list.map((r) => r.total));
  if (!list.length) return <EmptyState title="Nothing in scope" text="No expenses or advances for this company and location yet." />;
  return (
    <TableWrap>
      <Table size="small" sx={{ minWidth: 900 }}>
        <TableHead>
          <TableRow>
            <TableCell>{by === "company_id" ? "Company" : by === "location_id" ? "Location" : by === "source" ? "Source" : "Group"}</TableCell>
            <TableCell sx={{ width: 180 }}>Share</TableCell>
            <TableCell align="right">Employee claims</TableCell><TableCell align="right">Company-paid</TableCell><TableCell align="right">Miscellaneous</TableCell><TableCell align="right">Advances</TableCell><TableCell align="right">Advance to settle</TableCell><TableCell align="right">Awaiting</TableCell><TableCell align="right">Total</TableCell><TableCell align="right">Items</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.map((r) => (
            <TableRow key={r.key} hover>
              <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{name(r.key)}</Typography>{r.imported > 0 && <Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{r.imported} from other apps</Typography>}</TableCell>
              <TableCell><HBar value={r.total} max={max} right={`${Math.round((r.total / Math.max(1, list.reduce((a, x) => a + x.total, 0))) * 100)}%`} /></TableCell>
              <TableCell align="right">{inr(r.claims)}</TableCell><TableCell align="right">{inr(r.company_paid)}</TableCell><TableCell align="right">{inr(r.third_party)}</TableCell><TableCell align="right">{inr(r.advances)}</TableCell>
              <TableCell align="right" sx={{ color: r.open_advance ? "#a15c00" : undefined }}>{inr(r.open_advance)}</TableCell>
              <TableCell align="right">{inr(r.pending)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>{inr(r.total)}</TableCell>
              <TableCell align="right">{r.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableWrap>
  );
}

function ConnectDialog({ app, onClose }) {
  const { connectExpenseApp, syncExpenseApp, notifyToast } = useStore();
  const [landing, setLanding] = useState("trust");
  const [auto, setAuto] = useState(true);
  const [account, setAccount] = useState("");
  if (!app) return null;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Connect {app.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography sx={{ fontSize: "0.7rem" }}>{app.what}. PeopleHub matches each record to an employee by employee code, then work email, then name, and books it to that employee's company and location.</Typography>
          <TextField size="small" label="Account / tenant" placeholder={`${app.name} company ID`} value={account} onChange={(e) => setAccount(e.target.value)} helperText="Your administrator signs in to authorise read access (OAuth) in a real deployment." />
          <Box>
            <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, mb: 0.6 }}>When records arrive</Typography>
            <ToggleButtonGroup exclusive size="small" value={landing} onChange={(_, v) => v && setLanding(v)}>
              <ToggleButton value="trust" sx={{ fontSize: "0.62rem" }}>Keep the decision made in {app.name}</ToggleButton>
              <ToggleButton value="review" sx={{ fontSize: "0.62rem" }}>Send to Finance for review</ToggleButton>
            </ToggleButtonGroup>
            <Typography sx={{ fontSize: "0.58rem", color: "#78827b", mt: 0.6 }}>{landing === "trust" ? "Approved and reimbursed items arrive as Approved / Paid; submitted ones go through the usual manager → Finance approval." : "Everything waits in All approvals for Finance; items still waiting for a manager go to the manager first."}</Typography>
          </Box>
          <FormControlLabel control={<Switch checked={auto} onChange={(e) => setAuto(e.target.checked)} />} label={<Typography sx={{ fontSize: "0.68rem" }}>Sync automatically every hour</Typography>} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { const r = connectExpenseApp(app.id, { landing, auto_sync: auto, account }); if (!r.ok) return notifyToast(r.error, "error"); const s = syncExpenseApp(app.id); notifyToast(`${app.name} connected · ${s.stats?.created || 0} new item(s) brought in.`); onClose(); }}>Connect & sync</Button>
      </DialogActions>
    </Dialog>
  );
}

function ThirdPartyDialog({ rec, onClose }) {
  const { entityAccess, expenseCategories, saveThirdPartyExpense, notifyToast, data } = useStore();
  const [f, setF] = useState(rec || {});
  const [e, setE] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  if (!rec) return null;
  const cats = data.expenseCategories || expenseCategories || [];
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{rec.id ? `Edit ${rec.id}` : "Book a miscellaneous expense"}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.6} sx={{ pt: 1 }}>
          {e && <Alert severity="error">{e}</Alert>}
          <Typography sx={{ fontSize: "0.65rem", color: "#5a655e" }}>For spends by or for people who are not on the employee master — agency staff paid by their vendor, consultants' firms, facility partners, visitors.</Typography>
          <TextField label="Paid to (vendor / person) *" value={f.payee || ""} onChange={(ev) => set("payee", ev.target.value)} helperText="Vendor, agency or person" />
          <TextField label="What was it for? *" value={f.title || ""} onChange={(ev) => set("title", ev.target.value)} />
          <Stack direction="row" spacing={1.5}>
            <TextField type="date" label="Date *" value={f.date || ""} onChange={(ev) => set("date", ev.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
            <TextField select label="Category" value={f.category || mapCategory(f.title)} onChange={(ev) => set("category", ev.target.value)} fullWidth>
              {cats.map((c) => <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <TextField label="Amount *" value={f.amount ?? ""} onChange={(ev) => set("amount", ev.target.value.replace(/[^\d.]/g, ""))} fullWidth />
            <TextField select label="Currency" value={f.currency || "INR"} onChange={(ev) => set("currency", ev.target.value)} sx={{ width: 130 }}>
              {Object.keys(data.fx || { INR: 1 }).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField select label="Book against location *" value={f.location_id || ""} onChange={(ev) => set("location_id", ev.target.value)} helperText="The company follows the location">
            {entityAccess.locations.map((l) => <MenuItem key={l.location_id} value={l.location_id}>{l.name} · {entityAccess.companies.find((c) => c.company_id === l.company_id)?.short}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={1.5}>
            <TextField label="Invoice / reference" value={f.reference || ""} onChange={(ev) => set("reference", ev.target.value)} fullWidth />
            <TextField select label="Status" value={f.status || "Pending"} onChange={(ev) => set("status", ev.target.value)} sx={{ width: 150 }}>
              {TP_STATUS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { const r = saveThirdPartyExpense(f); if (!r.ok) return setE(r.error); notifyToast(`Miscellaneous expense ${r.id} saved.`); onClose(); }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function ExceptionRow({ x }) {
  const { allData, entityAccess, resolveExpenseException, notifyToast } = useStore();
  const [emp, setEmp] = useState("");
  const [loc, setLoc] = useState("");
  const r = x.record;
  const go = (action, extra = {}) => { const res = resolveExpenseException(x.id, { action, ...extra }); if (!res.ok) return notifyToast(res.error, "error"); notifyToast(action === "dismiss" ? `${x.id} dismissed.` : `${x.id} booked as ${res.ref}.`); };
  return (
    <TableRow>
      <TableCell><Mono>{x.id}</Mono><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{SOURCE_LABEL(x.app)} · {r.external_id}</Typography></TableCell>
      <TableCell sx={{ maxWidth: 240 }}><Typography sx={{ fontSize: "0.68rem", fontWeight: 600 }}>{r.title}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{r.employee_name || "—"} · {r.employee_email || r.employee_code || "no id"}</Typography></TableCell>
      <TableCell align="right">{fmtNum(r.amount)} {r.currency}</TableCell>
      <TableCell sx={{ minWidth: 380 }}>
        {x.resolved ? <Tag tone="good">{x.resolved.action === "dismiss" ? "Dismissed" : `Booked as ${x.resolved.ref}`}</Tag> : (
          <Stack spacing={0.8}>
            <Stack direction="row" spacing={0.8}>
              <TextField select size="small" label="Map to employee" value={emp} onChange={(e) => setEmp(e.target.value)} sx={{ minWidth: 210 }}>
                {allData.employees.filter((e) => e.status === "active" && entityAccess.locations.some((l) => l.location_id === e.location_id)).map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name} ({e.employee_code})</MenuItem>)}
              </TextField>
              <Button size="small" variant="outlined" disabled={!emp} onClick={() => go("map", { employee_code: emp })}>Book as claim</Button>
            </Stack>
            <Stack direction="row" spacing={0.8}>
              <TextField select size="small" label="Or miscellaneous at" value={loc} onChange={(e) => setLoc(e.target.value)} sx={{ minWidth: 210 }}>
                {entityAccess.locations.map((l) => <MenuItem key={l.location_id} value={l.location_id}>{l.name}</MenuItem>)}
              </TextField>
              <Button size="small" variant="outlined" disabled={!loc} onClick={() => go("third_party", { location_id: loc, payee: r.vendor || r.employee_name })}>Book miscellaneous</Button>
              <Button size="small" color="inherit" onClick={() => go("dismiss")}>Dismiss</Button>
            </Stack>
          </Stack>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function ExpenseHub() {
  const store = useStore();
  const { data, allData, user, syncExpenseApp, syncAllExpenseApps, updateExpenseApp, disconnectExpenseApp, importExpenseRecords, setThirdPartyStatus, setExpenseCategoryMap, notifyToast, entityAccess, canExpenseHub } = store;
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || "overview");
  const [split, setSplit] = useState("company_id");
  const [connect, setConnect] = useState(null);
  const [tpEdit, setTpEdit] = useState(null);
  const [f, setF] = useState({ kind: "", source: "", status: "", worker: "", q: "", from: "", to: "", dup: false });
  const [csv, setCsv] = useState(null);
  const fileRef = useRef(null);
  const can = canExpenseHub();
  const hub = allData.expenseHub || { connections: {}, runs: [], exceptions: [], categoryMaps: {} };
  const companies = allData.companies || [];
  const locations = allData.workLocations || [];
  const cName = (id) => companies.find((c) => c.company_id === id)?.short || id || "—";
  const lName = (id) => locations.find((l) => l.location_id === id)?.name || id || "—";
  const sName = (id) => (id === "peoplehub" ? "PeopleHub" : id === "manual" ? "Entered here" : SOURCE_LABEL(id));

  const rows = useMemo(() => registerRows(data), [data]);
  const filtered = rows.filter((r) => (!f.dup || r.dup) && (!f.kind || r.kind === f.kind) && (!f.source || r.source === f.source) && (!f.status || r.status === f.status) && (!f.worker || r.worker === f.worker) && (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) && (!f.q || [r.ref, r.title, r.person, r.vendor, r.external_id].join(" ").toLowerCase().includes(f.q.toLowerCase())));
  const live = rows.filter((r) => !["Cancelled", "Rejected"].includes(r.status));
  const sum = (pred) => live.filter(pred).reduce((s, r) => s + r.amount, 0);
  const connected = EXPENSE_APPS.filter((a) => hub.connections[a.id]?.connected);
  const exceptionsOpen = (hub.exceptions || []).filter((x) => !x.resolved);
  const tps = (data.thirdPartyExpenses || []);
  const extCats = useMemo(() => {
    const m = {};
    allData.requests.forEach((r) => (r.items || []).forEach((i) => { if (r.source?.app && i.ext_category) (m[r.source.app] ||= new Set()).add(i.ext_category); }));
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]]));
  }, [allData.requests]);

  function exportRegister() {
    downloadCsv(`expense-register-${isoDate()}.csv`, ["ref", "kind", "date", "title", "person", "worker_group", "company", "location", "cost_centre", "paid_by", "vendor", "source", "external_id", "currency", "amount_inr", "status"],
      filtered.map((r) => [r.ref, KIND_LABEL[r.kind], r.date, r.title, r.person, r.worker, cName(r.company_id), lName(r.location_id), locations.find((l) => l.location_id === r.location_id)?.cost_centre || "", PAID_BY_LABEL[r.paid_by] || r.paid_by, r.vendor, sName(r.source), r.external_id, r.currency, Math.round(r.amount), r.status]));
  }
  async function readCsv(file) {
    if (!file) return;
    const text = await file.text();
    const lines = parseCsv(text);
    const res = recordsFromCsv(lines, { employees: allData.employees, companies, locations });
    setCsv({ name: file.name, lines: lines.length, ...res });
  }
  const goTab = (v) => { setTab(v); setParams((p) => { const n = new URLSearchParams(p); n.set("tab", v); n.delete("req"); return n; }); };

  return (
    <>
      <PageHeader eyebrow={`PAY & BENEFITS · EXPENSE HUB${user.role === "superadmin" ? " · SUPER ADMIN" : " · FINANCE"}`} title="Expense hub" subtitle="Every employee claim, advance, travel-desk booking, corporate-card spend and third-party expense — raised here or brought in from your other apps — in one register, split by company and location."
        actions={can && <><Button variant="outlined" startIcon={<UploadFileRounded />} onClick={() => goTab("import")}>Import file</Button><Button variant="contained" startIcon={<SyncRounded />} disabled={!connected.length} onClick={() => { const r = syncAllExpenseApps(); notifyToast(`Synced ${r.stats.apps} app(s): ${r.stats.created} new, ${r.stats.updated} updated${r.stats.exceptions ? `, ${r.stats.exceptions} need a match` : ""}.`); }}>Sync all apps</Button></>} />
      {data.scoped && <Alert severity="info" icon={<BusinessRounded />} sx={{ mb: 2 }}>Showing {data.scoped.companies.size === 1 ? cName([...data.scoped.companies][0]) : `${data.scoped.companies.size} companies`}{data.scoped.locations.size === 1 ? ` · ${lName([...data.scoped.locations][0])}` : ` · ${data.scoped.locations.size} locations`}. Change it with the company picker in the header.</Alert>}
      <Stack spacing={2.5}>
        <Grid min={180}>
          <StatCard label="Employee claims" value={inr(sum((r) => r.kind === "expense"))} icon={<ReceiptLongRounded />} />
          <StatCard label="Company-paid (travel desk & cards)" value={inr(sum((r) => ["travel", "card"].includes(r.kind)))} icon={<CreditCardRounded />} tone="info" />
          <StatCard label="Miscellaneous expenses" value={inr(sum((r) => r.kind === "third_party"))} tone="warn" />
          <StatCard label="Advances to settle" value={inr(live.reduce((s, r) => s + r.open_advance, 0))} icon={<PaymentsRounded />} tone="info" hint={`${live.filter((r) => r.open_advance).length} open advance(s)`} />
          <StatCard label="From other apps" value={live.filter((r) => !["peoplehub", "manual"].includes(r.source)).length} icon={<CloudDownloadRounded />} tone="good" hint={`${connected.length} app(s) connected`} onClick={() => goTab("apps")} />
          <StatCard label="Need a match" value={exceptionsOpen.length} icon={<ErrorOutlineRounded />} tone={exceptionsOpen.length ? "warn" : "good"} hint={data.scoped ? "Not yet tied to any company" : "No employee found"} onClick={() => goTab("exceptions")} />
          <StatCard label="Possible duplicates" value={data.requests.filter((r) => r.status === "Pending" && (r.flags || []).some((x) => x.code === "DUP_SOURCE")).length} tone="warn" hint="Held for Finance" onClick={() => { setF({ kind: "", source: "", status: "", worker: "", q: "", from: "", to: "", dup: true }); goTab("register"); }} />
        </Grid>
        <SectionCard noPad>
          <Box sx={{ px: 1.5, pt: 1, borderBottom: "1px solid #edf0ec" }}>
            <Tabs value={tab} onChange={(_, v) => goTab(v)} variant="scrollable">
              <Tab value="overview" label="By company & location" sx={{ minHeight: 44, fontSize: "0.7rem" }} />
              <Tab value="register" label={`Register (${rows.length})`} sx={{ minHeight: 44, fontSize: "0.7rem" }} />
              <Tab value="apps" label={`Connected apps (${connected.length})`} sx={{ minHeight: 44, fontSize: "0.7rem" }} />
              <Tab value="import" label="Import file" sx={{ minHeight: 44, fontSize: "0.7rem" }} />
              <Tab value="third" label={`Miscellaneous (${tps.length})`} sx={{ minHeight: 44, fontSize: "0.7rem" }} />
              <Tab value="exceptions" label={`Exceptions (${exceptionsOpen.length})`} sx={{ minHeight: 44, fontSize: "0.7rem" }} />
              <Tab value="log" label="Sync log" sx={{ minHeight: 44, fontSize: "0.7rem" }} />
            </Tabs>
          </Box>

          {tab === "overview" && (
            <Box sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                <Typography sx={{ fontSize: "0.65rem", fontWeight: 700 }}>Split by</Typography>
                <ToggleButtonGroup exclusive size="small" value={split} onChange={(_, v) => v && setSplit(v)}>
                  <ToggleButton value="company_id" sx={{ fontSize: "0.62rem" }}>Company</ToggleButton>
                  <ToggleButton value="location_id" sx={{ fontSize: "0.62rem" }}>Location</ToggleButton>
                  <ToggleButton value="source" sx={{ fontSize: "0.62rem" }}>Source app</ToggleButton>
                  <ToggleButton value="worker" sx={{ fontSize: "0.62rem" }}>Employees vs miscellaneous</ToggleButton>
                </ToggleButtonGroup>
                <Box sx={{ flex: 1 }} />
                <Button size="small" startIcon={<DownloadRounded />} onClick={() => { const list = rollup(rows, split); downloadCsv(`expenses-by-${split}-${isoDate()}.csv`, ["group", "employee_claims", "company_paid", "third_party", "advances", "advance_to_settle", "awaiting", "total", "items"], list.map((r) => [split === "company_id" ? cName(r.key) : split === "location_id" ? lName(r.key) : split === "source" ? sName(r.key) : r.key, r.claims, r.company_paid, r.third_party, r.advances, r.open_advance, r.pending, r.total, r.count])); }}>Export</Button>
              </Stack>
              <Breakdown rows={rows} by={split} name={split === "company_id" ? cName : split === "location_id" ? lName : split === "source" ? sName : (k) => k} />
              {split === "company_id" && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="h3" sx={{ mb: 1 }}>Locations within each company</Typography>
                  <Grid min={320}>
                    {rollup(rows, "company_id").map((c) => (
                      <Card key={c.key} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction="row" sx={{ justifyContent: "space-between", mb: 1 }}><Typography sx={{ fontSize: "0.72rem", fontWeight: 800 }}>{cName(c.key)}</Typography><Typography sx={{ fontSize: "0.72rem", fontWeight: 800 }}>{inr(c.total)}</Typography></Stack>
                        {rollup(rows.filter((r) => r.company_id === c.key), "location_id").map((l) => <HBar key={l.key} label={lName(l.key)} value={l.total} max={c.total} right={inr(l.total)} />)}
                      </Card>
                    ))}
                  </Grid>
                </Box>
              )}
            </Box>
          )}

          {tab === "register" && (
            <>
              <Stack direction="row" spacing={1} sx={{ p: 1.5, flexWrap: "wrap" }} useFlexGap>
                <TextField size="small" label="Search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} sx={{ width: 200 }} />
                <TextField select size="small" label="Kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} sx={{ width: 190 }}><MenuItem value="">All kinds</MenuItem>{Object.entries(KIND_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField>
                <TextField select size="small" label="Source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} sx={{ width: 170 }}><MenuItem value="">All sources</MenuItem>{[...new Set(rows.map((r) => r.source))].map((s) => <MenuItem key={s} value={s}>{sName(s)}</MenuItem>)}</TextField>
                <TextField select size="small" label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} sx={{ width: 140 }}><MenuItem value="">Any status</MenuItem>{[...new Set(rows.map((r) => r.status))].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
                <TextField select size="small" label="People" value={f.worker} onChange={(e) => setF({ ...f, worker: e.target.value })} sx={{ width: 200 }}><MenuItem value="">Everyone</MenuItem>{["Employees", "Contingent workers", "Miscellaneous"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
                <TextField size="small" type="date" label="From" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 160 }} />
                <TextField size="small" type="date" label="To" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 160 }} />
                {f.dup && <Chip label="Possible duplicates only" onDelete={() => setF({ ...f, dup: false })} sx={{ alignSelf: "center" }} />}
                <Box sx={{ flex: 1 }} />
                <Button size="small" startIcon={<DownloadRounded />} onClick={exportRegister}>Export {filtered.length}</Button>
              </Stack>
              {filtered.length === 0 ? <EmptyState title="Nothing matches" text="Change the filters or the company picker." /> : (
                <TableWrap>
                  <Table size="small" sx={{ minWidth: 1100 }}>
                    <TableHead><TableRow><TableCell>Ref</TableCell><TableCell>Kind</TableCell><TableCell>Date</TableCell><TableCell>Title</TableCell><TableCell>Person / payee</TableCell><TableCell>Company · location</TableCell><TableCell>Paid by</TableCell><TableCell>Source</TableCell><TableCell align="right">Amount (₹)</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                    <TableBody>
                      {filtered.slice(0, 400).map((r) => (
                        <TableRow key={r.ref} hover sx={{ cursor: r.drawer ? "pointer" : "default" }} onClick={() => (r.drawer ? setParams((p) => { const n = new URLSearchParams(p); n.set("req", r.ref); return n; }) : goTab("third"))}>
                          <TableCell><Mono>{r.ref}</Mono></TableCell>
                          <TableCell><Tag tone={KIND_TONE[r.kind]}>{KIND_LABEL[r.kind]}</Tag>{r.dup && <Box sx={{ mt: 0.4 }}><Tag tone="warn">Possible duplicate</Tag></Box>}</TableCell>
                          <TableCell>{fmtDate(r.date)}</TableCell>
                          <TableCell sx={{ maxWidth: 220 }}><Typography noWrap sx={{ fontSize: "0.68rem", fontWeight: 600 }}>{r.title}</Typography></TableCell>
                          <TableCell><Typography sx={{ fontSize: "0.68rem" }}>{r.person}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{r.worker}</Typography></TableCell>
                          <TableCell><Typography sx={{ fontSize: "0.66rem" }}>{cName(r.company_id)}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{lName(r.location_id)}</Typography></TableCell>
                          <TableCell><Typography sx={{ fontSize: "0.62rem" }}>{PAID_BY_LABEL[r.paid_by] || r.paid_by}</Typography>{r.vendor && <Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{r.vendor}</Typography>}</TableCell>
                          <TableCell><Typography sx={{ fontSize: "0.62rem" }}>{sName(r.source)}</Typography>{r.external_id && <Mono sx={{ fontSize: "0.56rem" }}>{r.external_id}</Mono>}</TableCell>
                          <TableCell align="right">{fmtNum(Math.round(r.amount))}{r.currency !== "INR" && <Typography sx={{ fontSize: "0.54rem", color: "#78827b" }}>from {r.currency}</Typography>}</TableCell>
                          <TableCell>{r.drawer ? <RequestStatus r={allData.requests.find((x) => x.request_id === r.ref) || { status: r.status }} /> : <Tag tone={r.status === "Pending" ? "warn" : r.status === "Rejected" ? "neutral" : "good"}>{r.status}</Tag>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrap>
              )}
            </>
          )}

          {tab === "apps" && (
            <Box sx={{ p: 1.5 }}>
              {!can && <Alert severity="info" sx={{ mb: 1.5 }}>Finance (expense module) or a Super Admin connects and syncs apps.</Alert>}
              {[...new Set(EXPENSE_APPS.map((a) => a.group))].map((g) => (
                <Box key={g} sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: "0.58rem", fontWeight: 800, letterSpacing: "0.1em", color: "#78827b", mb: 1 }}>{g.toUpperCase()}</Typography>
                  <Grid min={300}>
                    {EXPENSE_APPS.filter((a) => a.group === g).map((a) => {
                      const c = hub.connections[a.id] || {};
                      return (
                        <Card key={a.id} variant="outlined" sx={{ p: 1.5, borderColor: c.connected ? "#9fd3bf" : undefined }}>
                          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                            <Box><Typography sx={{ fontSize: "0.75rem", fontWeight: 800 }}>{a.name}</Typography><Typography sx={{ fontSize: "0.6rem", color: "#5a655e" }}>{a.what}</Typography></Box>
                            {c.connected ? <Tag tone="good">Connected</Tag> : <Tag>Off</Tag>}
                          </Stack>
                          <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: "wrap" }} useFlexGap>{a.kinds.map((k) => <Chip key={k} size="small" label={KIND_LABEL[k]} sx={{ fontSize: "0.55rem", height: 19 }} />)}</Stack>
                          {c.connected && (
                            <Box sx={{ mt: 1 }}>
                              <Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>Last sync {c.last_sync ? fmtDateTime(c.last_sync) : "never"}{c.last_result ? ` · ${c.last_result.created} new, ${c.last_result.updated} updated${c.last_result.exceptions ? `, ${c.last_result.exceptions} to match` : ""}` : ""}</Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 0.6, alignItems: "center" }}>
                                <TextField select size="small" label="On arrival" value={c.landing || "trust"} disabled={!can} onChange={(e) => updateExpenseApp(a.id, { landing: e.target.value })} sx={{ minWidth: 170 }}>
                                  <MenuItem value="trust">Keep source decision</MenuItem><MenuItem value="review">Finance reviews all</MenuItem>
                                </TextField>
                                <FormControlLabel control={<Switch size="small" checked={!!c.auto_sync} disabled={!can} onChange={(e) => updateExpenseApp(a.id, { auto_sync: e.target.checked })} />} label={<Typography sx={{ fontSize: "0.6rem" }}>Hourly</Typography>} />
                              </Stack>
                            </Box>
                          )}
                          <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
                            {c.connected ? <>
                              <Button size="small" variant="contained" startIcon={<SyncRounded />} disabled={!can} onClick={() => { const r = syncExpenseApp(a.id); if (!r.ok) return notifyToast(r.error, "error"); notifyToast(`${a.name}: ${r.stats.created} new, ${r.stats.updated} updated, ${r.stats.skipped} unchanged${r.stats.exceptions ? `, ${r.stats.exceptions} need a match` : ""}${r.stats.duplicates ? `, ${r.stats.duplicates} possible duplicate(s) held` : ""}.`); }}>Sync now</Button>
                              <Button size="small" color="inherit" startIcon={<LinkOffRounded />} disabled={!can} onClick={() => { disconnectExpenseApp(a.id); notifyToast(`${a.name} disconnected. Items already brought in stay.`); }}>Disconnect</Button>
                            </> : <Button size="small" variant="outlined" startIcon={<LinkRounded />} disabled={!can} onClick={() => setConnect(a)}>Connect</Button>}
                          </Stack>
                          {c.connected && extCats[a.id]?.length > 0 && (
                            <Box sx={{ mt: 1.2, pt: 1, borderTop: "1px dashed #e1e6e1" }}>
                              <Typography sx={{ fontSize: "0.58rem", fontWeight: 700, mb: 0.6 }}>Category mapping</Typography>
                              {extCats[a.id].map((ext) => (
                                <Stack key={ext} direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                                  <Typography sx={{ fontSize: "0.6rem", flex: 1 }} noWrap>{ext}</Typography>
                                  <TextField select size="small" value={hub.categoryMaps?.[a.id]?.[ext] || mapCategory(ext)} disabled={!can} onChange={(e) => setExpenseCategoryMap(a.id, ext, e.target.value)} sx={{ width: 170, "& .MuiInputBase-input": { fontSize: "0.6rem", py: 0.5 } }}>
                                    {data.expenseCategories.map((x) => <MenuItem key={x.code} value={x.code} sx={{ fontSize: "0.65rem" }}>{x.name}</MenuItem>)}
                                  </TextField>
                                </Stack>
                              ))}
                              <Typography sx={{ fontSize: "0.54rem", color: "#78827b" }}>Applies to items brought in from now on.</Typography>
                            </Box>
                          )}
                        </Card>
                      );
                    })}
                  </Grid>
                </Box>
              ))}
              <Alert severity="info">Any other app can post to <Mono>POST /api/v1/expenses/import</Mono> with the same columns as the CSV file (Integrations & API → keys). Re-sent records are matched by app and external ID, so nothing is counted twice.</Alert>
            </Box>
          )}

          {tab === "import" && (
            <Box sx={{ p: 1.5 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ mb: 1.5 }}>
                <Button variant="contained" startIcon={<UploadFileRounded />} disabled={!can} onClick={() => fileRef.current?.click()}>Choose CSV file</Button>
                <input ref={fileRef} type="file" hidden accept=".csv,text/csv" onChange={(e) => { readCsv(e.target.files?.[0]); e.target.value = ""; }} />
                <Button startIcon={<DownloadRounded />} onClick={() => { const blob = new Blob([`﻿${CSV_TEMPLATE}`], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "expense-import-template.csv"; a.click(); URL.revokeObjectURL(a.href); }}>Download template</Button>
                <Button onClick={() => { const lines = parseCsv(CSV_TEMPLATE); setCsv({ name: "template sample", lines: lines.length, ...recordsFromCsv(lines, { employees: allData.employees, companies, locations }) }); }}>Try the sample</Button>
              </Stack>
              <Typography sx={{ fontSize: "0.6rem", color: "#5a655e", mb: 1.5 }}>Columns: <Mono>{CSV_COLUMNS.join(", ")}</Mono>. Lines with the same external_id become one claim with several lines. <b>kind</b> is expense, advance, card, travel or third_party; third_party lines need a location_id. Amounts are converted to ₹ at today's rates and the original currency is kept.</Typography>
              {csv && (
                <Stack spacing={1.2}>
                  <Alert severity={csv.errors.length ? "warning" : "success"}>{csv.name}: {csv.lines} line(s) → {csv.records.length} record(s){csv.errors.length ? `, ${csv.errors.length} line(s) with errors (skipped)` : ""}. {csv.records.filter((r) => r.kind !== "third_party" && !r.match).length} record(s) have no matching employee and will go to Exceptions.</Alert>
                  {csv.errors.length > 0 && <Box>{csv.errors.slice(0, 20).map((e) => <Typography key={e.line} sx={{ fontSize: "0.62rem", color: "#a33" }}>Line {e.line}: {e.error}</Typography>)}</Box>}
                  <TableWrap>
                    <Table size="small" sx={{ minWidth: 820 }}>
                      <TableHead><TableRow><TableCell>External ID</TableCell><TableCell>Kind</TableCell><TableCell>Person / payee</TableCell><TableCell>Matched to</TableCell><TableCell>Title</TableCell><TableCell align="right">Lines</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                      <TableBody>
                        {csv.records.map((r) => {
                          const e = r.match && allData.employees.find((x) => x.employee_code === r.match);
                          return (
                            <TableRow key={`${r.kind}-${r.external_id}`}>
                              <TableCell><Mono>{r.external_id}</Mono></TableCell>
                              <TableCell><Tag tone={KIND_TONE[r.kind]}>{KIND_LABEL[r.kind]}</Tag></TableCell>
                              <TableCell>{r.kind === "third_party" ? r.payee : r.employee_code || r.employee_email || r.employee_name}</TableCell>
                              <TableCell>{r.kind === "third_party" ? `${cName(r.company_id)} · ${lName(r.location_id)}` : e ? `${e.full_name} · ${cName(e.company_id)} · ${lName(e.location_id)}` : <Tag tone="warn">No match</Tag>}</TableCell>
                              <TableCell>{r.title}</TableCell>
                              <TableCell align="right">{r.lines.length}</TableCell>
                              <TableCell align="right">{fmtNum(r.amount)} {r.currency}</TableCell>
                              <TableCell>{r.status}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableWrap>
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" disabled={!can || !csv.records.length} onClick={() => { const r = importExpenseRecords(csv.records, "csv"); if (!r.ok) return notifyToast(r.error, "error"); notifyToast(`Imported: ${r.stats.created} new, ${r.stats.updated} updated, ${r.stats.skipped} unchanged${r.stats.exceptions ? `, ${r.stats.exceptions} to Exceptions` : ""}.`); setCsv(null); goTab("register"); }}>Import {csv.records.length} record(s)</Button>
                    <Button color="inherit" onClick={() => setCsv(null)}>Clear</Button>
                  </Stack>
                </Stack>
              )}
            </Box>
          )}

          {tab === "third" && (
            <>
              <Stack direction="row" sx={{ p: 1.5, alignItems: "center" }}>
                <Typography sx={{ fontSize: "0.65rem", color: "#5a655e", flex: 1 }}>Spends for people who are not on the employee master — agency staff paid through their vendor, consultants' firms, facility partners — booked to a company and location.</Typography>
                <Button size="small" variant="contained" startIcon={<AddRounded />} disabled={!can} onClick={() => setTpEdit({ date: isoDate(), currency: "INR", status: "Pending", location_id: entityAccess.locations.find((l) => !data.scoped || data.scoped.locations.has(l.location_id))?.location_id })}>Book expense</Button>
              </Stack>
              {tps.length === 0 ? <EmptyState title="No miscellaneous expenses" text="Book one here, import kind=third_party lines, or resolve an exception as miscellaneous." /> : (
                <TableWrap>
                  <Table size="small" sx={{ minWidth: 920 }}>
                    <TableHead><TableRow><TableCell>Ref</TableCell><TableCell>Date</TableCell><TableCell>Paid to</TableCell><TableCell>For</TableCell><TableCell>Company · location</TableCell><TableCell>Source</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
                    <TableBody>
                      {tps.map((t) => (
                        <TableRow key={t.id} hover>
                          <TableCell><Mono>{t.id}</Mono></TableCell>
                          <TableCell>{fmtDate(t.date)}</TableCell>
                          <TableCell><Typography sx={{ fontSize: "0.68rem", fontWeight: 600 }}>{t.payee}</Typography></TableCell>
                          <TableCell sx={{ maxWidth: 220 }}><Typography noWrap sx={{ fontSize: "0.66rem" }}>{t.title}</Typography></TableCell>
                          <TableCell><Typography sx={{ fontSize: "0.66rem" }}>{cName(t.company_id)}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{lName(t.location_id)}</Typography></TableCell>
                          <TableCell><Typography sx={{ fontSize: "0.62rem" }}>{sName(t.source?.app)}</Typography><Mono sx={{ fontSize: "0.56rem" }}>{t.source?.external_id || t.reference}</Mono></TableCell>
                          <TableCell align="right">{inr(t.amount_inr)}{t.currency !== "INR" && <Typography sx={{ fontSize: "0.54rem", color: "#78827b" }}>{fmtNum(t.amount)} {t.currency}</Typography>}</TableCell>
                          <TableCell>
                            <TextField select size="small" value={t.status} disabled={!can} onChange={(e) => setThirdPartyStatus(t.id, e.target.value)} sx={{ width: 120, "& .MuiInputBase-input": { fontSize: "0.62rem", py: 0.5 } }}>
                              {TP_STATUS.map((s) => <MenuItem key={s} value={s} sx={{ fontSize: "0.65rem" }}>{s}</MenuItem>)}
                            </TextField>
                          </TableCell>
                          <TableCell><Button size="small" disabled={!can} onClick={() => setTpEdit({ ...t })}>Edit</Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrap>
              )}
            </>
          )}

          {tab === "exceptions" && (
            (hub.exceptions || []).length === 0 ? <EmptyState title="Nothing to match" text="Every record brought in matched an employee." /> : (
              <TableWrap>
                <Table size="small" sx={{ minWidth: 980 }}>
                  <TableHead><TableRow><TableCell>Exception</TableCell><TableCell>Record</TableCell><TableCell align="right">Amount</TableCell><TableCell>Resolve</TableCell></TableRow></TableHead>
                  <TableBody>{[...exceptionsOpen, ...(hub.exceptions || []).filter((x) => x.resolved)].map((x) => <ExceptionRow key={x.id} x={x} />)}</TableBody>
                </Table>
              </TableWrap>
            )
          )}

          {tab === "log" && (
            (hub.runs || []).length === 0 ? <EmptyState title="No syncs yet" text="Connect an app or import a file." /> : (
              <TableWrap>
                <Table size="small" sx={{ minWidth: 760 }}>
                  <TableHead><TableRow><TableCell>Run</TableCell><TableCell>Source</TableCell><TableCell>When</TableCell><TableCell>By</TableCell><TableCell align="right">Fetched</TableCell><TableCell align="right">New</TableCell><TableCell align="right">Updated</TableCell><TableCell align="right">Unchanged</TableCell><TableCell align="right">To match</TableCell></TableRow></TableHead>
                  <TableBody>
                    {hub.runs.slice(0, 100).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell><Mono>{r.id}</Mono></TableCell><TableCell>{sName(r.app)}</TableCell><TableCell>{fmtDateTime(r.at)}</TableCell><TableCell>{store.nameOf(r.by)}</TableCell>
                        <TableCell align="right">{r.fetched}</TableCell><TableCell align="right">{r.created}</TableCell><TableCell align="right">{r.updated}</TableCell><TableCell align="right">{r.skipped}</TableCell><TableCell align="right">{r.exceptions}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            )
          )}
        </SectionCard>
      </Stack>
      <ConnectDialog app={connect} onClose={() => setConnect(null)} />
      <ThirdPartyDialog key={tpEdit?.id || "tp"} rec={tpEdit} onClose={() => setTpEdit(null)} />
      <RequestDrawer id={params.get("req")} onClose={() => setParams((p) => { const n = new URLSearchParams(p); n.delete("req"); return n; })} />
    </>
  );
}
