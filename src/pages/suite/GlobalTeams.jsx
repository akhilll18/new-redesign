// Global teams & spend (v10): Employer of Record and Contractor of Record hiring where you have no legal entity,
// contractor payments, an employer-cost calculator built on the country payroll engines, relocation & visa cases,
// and SpendCards — corporate cards for the global team with limits, receipts and accounting export.
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Card, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { Public, Badge, Handshake, PendingActions, FlightTakeoff, CreditCard, AcUnit, Add, DownloadRounded, ReceiptLong, Calculate, Gavel, UploadFile } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, TableWrap, PersonCell, EmptyState } from "../../components/kit/UI.jsx";
import { ModuleHub, Steps, Pill, StatusPill, TwoCol, Hint, money, C, Progress, Kpi, asList } from "../../components/suite/Hub.jsx";
import { COUNTRIES, computePay, periodContext, engineFor } from "../../lib/payroll/index.js";
import { downloadCsv, fmtDate, isoDate } from "../../lib/utils.js";

const EOR_FEE_USD = 399, COR_FEE_USD = 99;
const HIRE_STEPS = [["quote", "Cost quote"], ["contract", "Local contract & e-sign"], ["onboarding", "Onboarding & documents"], ["payroll", "On payroll / paid"]];

// ── Global hiring ───────────────────────────────────────────────────────────────
export function GlobalHiring() {
  const { data, suiteDo, suiteCan, notifyToast } = useStore();
  const navigate = useNavigate();
  const hires = data.suite?.globalHires || [];
  const can = suiteCan("globalHires");
  const fx = data.fx || {};
  const [calc, setCalc] = useState({ country: "DE", monthly: 5000, model: "EOR" });
  const [risk, setRisk] = useState({ hours: false, equipment: false, exclusive: false, integrated: false, longterm: false, supervised: false });
  const [nw, setNw] = useState(null);
  const entities = new Set(["IN"]);
  const quote = useMemo(() => {
    const eng = engineFor(calc.country);
    if (!eng) return null;
    const cur = COUNTRIES[calc.country].currency;
    try {
      const region = eng.REGIONS?.[0]?.[0] || "";
      const p = computePay({ id: "Q", name: "Quote", ctry: calc.country, gross: Number(calc.monthly) || 0, region, g: "M", doj: isoDate(), dob: "1990-01-01", profile: {} }, periodContext(isoDate()));
      const feeLocal = ((calc.model === "EOR" ? EOR_FEE_USD : COR_FEE_USD) * (fx.USD || 88)) / (fx[cur] || 1);
      const employer = calc.model === "EOR" ? p.employerTotal : 0;
      const total = (Number(calc.monthly) || 0) + employer + feeLocal;
      return { cur, p, feeLocal, employer, total, inr: total * (fx[cur] || 1) };
    } catch { return null; }
  }, [calc, fx]);
  const riskScore = Object.values(risk).filter(Boolean).length;
  function advance(id) {
    suiteDo("globalHires", (s) => { const h = s.globalHires.find((x) => x.id === id); const k = HIRE_STEPS.find(([key]) => h.steps[key] !== "done"); if (k) h.steps[k[0]] = "done"; if (HIRE_STEPS.every(([key]) => h.steps[key] === "done")) h.status = "active"; else h.status = "in_progress"; }, { action: "GLOBAL_HIRE_STEP", details: id });
  }
  function create() {
    const r = suiteDo("globalHires", (s) => { s.globalHires = [{ id: `GH-${15 + s.globalHires.length}`, ...nw, monthly: Number(nw.monthly), status: "quote", steps: { quote: "done", contract: "pending", onboarding: "pending", payroll: "pending" } }, ...s.globalHires]; }, { action: "GLOBAL_HIRE_CREATE", details: `${nw.name} · ${nw.country} · ${nw.model}` });
    if (r.ok) { notifyToast(`${nw.model} hire started — the local contract is drafted for e-signature.`); setNw(null); }
  }
  function payContractors() {
    const list = hires.filter((h) => h.status === "active" && h.model !== "EOR");
    downloadCsv(`contractor-payments-${isoDate().slice(0, 7)}.csv`, ["ID", "Name", "Country", "Model", "Currency", "Amount", "Fee (USD)"], list.map((h) => [h.id, h.name, h.country, h.model, COUNTRIES[h.country]?.currency, h.monthly, h.model === "CoR" ? COR_FEE_USD : 0]));
    suiteDo("globalHires", (s, { now }) => { s.globalHires.forEach((h) => { if (h.status === "active" && h.model !== "EOR") h.last_paid = now; }); }, { action: "CONTRACTOR_PAYMENTS", details: `${list.length} contractors paid` });
    notifyToast(`${list.length} contractor payment(s) sent in local currency.`);
  }
  return (
    <ModuleHub eyebrow="GLOBAL · HIRE ANYWHERE" title="Global hiring — EOR, contractors & Contractor of Record" subtitle="Hire employees in countries where you have no legal entity through our Employer of Record, engage contractors compliantly through Contractor of Record, and pay everyone in their local currency."
      actions={<Stack direction="row" spacing={1}><Button variant="outlined" onClick={payContractors} disabled={!can}>Pay contractors</Button><Button variant="contained" startIcon={<Add />} disabled={!can} onClick={() => setNw({ name: "", country: "DE", model: "EOR", role: "", monthly: 5000, start: isoDate(new Date(Date.now() + 21 * 86400000)) })}>Hire someone</Button></Stack>}
      brief={{ text: <>You can hire in <b>{Object.keys(COUNTRIES).length}</b> countries. <b>{hires.filter((h) => h.status !== "active").length}</b> hire(s) in progress; <b>{hires.filter((h) => h.model !== "EOR" && h.status === "active").length}</b> active contractor(s).</> }}
      kpis={[{ label: "Countries", value: Object.keys(COUNTRIES).length, hint: "payroll engines live", icon: <Public />, tone: "navy" }, { label: "EOR employees", value: hires.filter((h) => h.model === "EOR").length, icon: <Badge />, tone: "glob" }, { label: "Contractors", value: hires.filter((h) => h.model !== "EOR").length, hint: "incl. Contractor of Record", icon: <Handshake />, tone: "mint" }, { label: "In progress", value: hires.filter((h) => h.status !== "active").length, icon: <PendingActions />, tone: "purple" }]}>
      <TwoCol right={380}>
        <Stack spacing={2}>
          <SectionCard title="Hires" noPad>
            <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Person</TableCell><TableCell>Country</TableCell><TableCell>Model</TableCell><TableCell align="right">Monthly</TableCell><TableCell sx={{ minWidth: 220 }}>Progress</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>{hires.map((h) => { const done = HIRE_STEPS.filter(([k]) => h.steps?.[k] === "done").length; const next = HIRE_STEPS.find(([k]) => h.steps?.[k] !== "done"); return (
                <TableRow key={h.id}><TableCell><PersonCell name={h.name} sub={h.role} /></TableCell><TableCell>{COUNTRIES[h.country]?.name}</TableCell><TableCell><Pill tone={h.model === "EOR" ? "navy" : h.model === "CoR" ? "glob" : "mint"}>{h.model}</Pill></TableCell><TableCell align="right">{money(h.monthly, COUNTRIES[h.country]?.currency)}</TableCell>
                  <TableCell><Progress value={(done / 4) * 100} right={next ? next[1] : "Done"} color={done === 4 ? C.mintDeep : C.glob} /></TableCell><TableCell><StatusPill status={h.status} /></TableCell>
                  <TableCell>{next && <Button size="small" disabled={!can} onClick={() => advance(h.id)}>Next step</Button>}</TableCell></TableRow>
              ); })}</TableBody></Table></TableWrap>
          </SectionCard>
          <SectionCard title="Which model?" subtitle="EOR employs the person for you; Contractor of Record contracts them compliantly and takes the misclassification risk">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 1.5 }}>
              {[["Own entity", "You already have a company there (India). Use local payroll in this app.", "navy"], ["Employer of Record", `Full employment, benefits and local payroll without an entity. From $${EOR_FEE_USD}/month.`, "glob"], ["Contractor / CoR", `Invoices and payments in local currency; CoR adds compliance cover. From $${COR_FEE_USD}/month.`, "mint"]].map(([t, d, tone]) => <Card key={t} sx={{ p: 1.5 }}><Pill tone={tone}>{t}</Pill><Typography variant="body2" sx={{ mt: 1 }}>{d}</Typography></Card>)}
            </Box>
          </SectionCard>
        </Stack>
        <Stack spacing={2}>
          <SectionCard title="Employer cost calculator" subtitle="Uses the same engine as payroll for that country">
            <Stack spacing={1.2}>
              <TextField select size="small" label="Country" value={calc.country} onChange={(e) => setCalc({ ...calc, country: e.target.value })}>{Object.entries(COUNTRIES).map(([k, v]) => <MenuItem key={k} value={k}>{v.name}{entities.has(k) ? " (own entity)" : ""}</MenuItem>)}</TextField>
              <Stack direction="row" spacing={1}><TextField size="small" type="number" label={`Monthly gross (${COUNTRIES[calc.country]?.currency})`} value={calc.monthly} onChange={(e) => setCalc({ ...calc, monthly: e.target.value })} sx={{ flex: 1 }} /><TextField select size="small" label="Model" value={calc.model} onChange={(e) => setCalc({ ...calc, model: e.target.value })} sx={{ width: 130 }}>{["EOR", "CoR", "Contractor"].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}</TextField></Stack>
              {quote ? (
                <Table size="small"><TableBody>
                  <TableRow><TableCell>Gross salary</TableCell><TableCell align="right">{money(calc.monthly, quote.cur)}</TableCell></TableRow>
                  {calc.model === "EOR" && <TableRow><TableCell>Employer contributions</TableCell><TableCell align="right">{money(quote.employer, quote.cur)}</TableCell></TableRow>}
                  <TableRow><TableCell>{calc.model === "EOR" ? "EOR" : calc.model === "CoR" ? "CoR" : "Platform"} fee</TableCell><TableCell align="right">{calc.model === "Contractor" ? "—" : money(quote.feeLocal, quote.cur)}</TableCell></TableRow>
                  <TableRow><TableCell sx={{ fontWeight: 800 }}>Monthly cost</TableCell><TableCell align="right" sx={{ fontWeight: 800, color: C.navy }}>{money(calc.model === "Contractor" ? Number(calc.monthly) : quote.total, quote.cur)}</TableCell></TableRow>
                  <TableRow><TableCell>In ₹</TableCell><TableCell align="right">{money(calc.model === "Contractor" ? Number(calc.monthly) * (fx[quote.cur] || 1) : quote.inr, "INR")}</TableCell></TableRow>
                  {calc.model === "EOR" && <TableRow><TableCell>Employee take-home</TableCell><TableCell align="right">{money(quote.p.net, quote.cur)}</TableCell></TableRow>}
                </TableBody></Table>
              ) : <Alert severity="info">No engine for this country yet.</Alert>}
            </Stack>
          </SectionCard>
          <SectionCard title="Misclassification check" subtitle="Is this really a contractor?">
            <Stack>
              {[["hours", "Works fixed hours you set"], ["supervised", "Day-to-day supervised by your manager"], ["equipment", "Uses your laptop / tools"], ["exclusive", "Works only for you"], ["integrated", "Part of a core team, same as employees"], ["longterm", "Engagement longer than 12 months"]].map(([k, l]) => <FormControlLabel key={k} control={<Checkbox size="small" checked={risk[k]} onChange={(e) => setRisk({ ...risk, [k]: e.target.checked })} />} label={<Typography variant="body2">{l}</Typography>} />)}
              <Alert severity={riskScore >= 4 ? "error" : riskScore >= 2 ? "warning" : "success"} sx={{ mt: 1 }}>{riskScore >= 4 ? "High risk — hire through EOR as an employee." : riskScore >= 2 ? "Medium risk — use Contractor of Record for compliance cover." : "Low risk — a direct contractor agreement is fine."}</Alert>
              <Button size="small" sx={{ mt: 1 }} onClick={() => navigate("/contracts")}>Open contract management</Button>
            </Stack>
          </SectionCard>
        </Stack>
      </TwoCol>
      <Dialog open={!!nw} onClose={() => setNw(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Hire someone abroad</DialogTitle>
        <DialogContent><Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField label="Full name" value={nw?.name || ""} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
          <TextField label="Role" value={nw?.role || ""} onChange={(e) => setNw({ ...nw, role: e.target.value })} />
          <TextField select label="Country" value={nw?.country || "DE"} onChange={(e) => setNw({ ...nw, country: e.target.value })}>{Object.entries(COUNTRIES).filter(([k]) => k !== "IN").map(([k, v]) => <MenuItem key={k} value={k}>{v.name}</MenuItem>)}</TextField>
          <TextField select label="Model" value={nw?.model || "EOR"} onChange={(e) => setNw({ ...nw, model: e.target.value })}>{["EOR", "CoR", "Contractor"].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}</TextField>
          <TextField type="number" label={`Monthly (${COUNTRIES[nw?.country || "DE"]?.currency})`} value={nw?.monthly || 0} onChange={(e) => setNw({ ...nw, monthly: e.target.value })} />
          <TextField type="date" label="Start date" slotProps={{ inputLabel: { shrink: true } }} value={nw?.start || ""} onChange={(e) => setNw({ ...nw, start: e.target.value })} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setNw(null)}>Cancel</Button><Button variant="contained" disabled={!nw?.name || !nw?.role} onClick={create}>Start hire</Button></DialogActions>
      </Dialog>
    </ModuleHub>
  );
}

// ── Relocation & visas ──────────────────────────────────────────────────────────
const REL_STAGES = ["requested", "documents", "visa_filed", "approved", "travel", "arrived"];
const REL_LABEL = { requested: "Requested", documents: "Documents", visa_filed: "Visa filed", approved: "Visa approved", travel: "Travel booked", arrived: "Arrived" };
const REL_CHECK = [["offer", "Offer / assignment letter"], ["passport", "Passport (6+ months valid)"], ["degree", "Degree attestation"], ["police", "Police clearance"], ["medical", "Medical"], ["fees", "Visa fees paid"], ["appointment", "Biometrics / interview"], ["flights", "Flights booked"], ["housing", "Temporary housing"]];

export function Relocation() {
  const { data, suiteDo, suiteCan, notifyToast, nameOf } = useStore();
  const cases = data.suite?.relocations || [];
  const can = suiteCan("relocation");
  const [sel, setSel] = useState(cases[0]?.id);
  const cur = cases.find((c) => c.id === sel);
  const toggle = (k) => suiteDo("relocation", (s) => { const c = s.relocations.find((x) => x.id === cur.id); c.checklist[k] = !c.checklist[k]; }, { action: "RELOCATION_CHECK", details: `${cur.id} · ${k}` });
  const stage = (st) => suiteDo("relocation", (s) => { const c = s.relocations.find((x) => x.id === cur.id); c.stage = st; return { emp: c.employee_code }; }, { action: "RELOCATION_STAGE", details: `${cur.id} → ${st}`, note: (r) => ({ to: r.emp, text: `Your relocation moved to "${REL_LABEL[st]}".`, link: "/my-relocation" }) });
  return (
    <ModuleHub eyebrow="GLOBAL · RELOCATION" title="Relocation & visas" subtitle="Visa and work-permit support, documents, budgets and travel for people moving between countries — tracked case by case."
      brief={{ text: <><b>{cases.filter((c) => c.stage !== "arrived").length}</b> active relocation(s). Budget used <b>{money(cases.reduce((s, c) => s + c.spent, 0), "INR", { compact: true })}</b> of {money(cases.reduce((s, c) => s + c.budget, 0), "INR", { compact: true })}.</> }}
      kpis={[{ label: "Active cases", value: cases.filter((c) => c.stage !== "arrived").length, icon: <FlightTakeoff />, tone: "navy" }, { label: "Visas approved", value: cases.filter((c) => REL_STAGES.indexOf(c.stage) >= 3).length, icon: <Badge />, tone: "mint" }, { label: "Waiting on documents", value: cases.filter((c) => c.stage === "documents").length, icon: <PendingActions />, tone: "glob" }]}>
      <TwoCol right={420}>
        <SectionCard title="Cases" noPad>
          {cases.length === 0 ? <EmptyState title="No relocations" /> : <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Move</TableCell><TableCell>Visa</TableCell><TableCell>Target</TableCell><TableCell>Stage</TableCell></TableRow></TableHead>
            <TableBody>{cases.map((c) => <TableRow key={c.id} hover selected={c.id === sel} onClick={() => setSel(c.id)} sx={{ cursor: "pointer" }}><TableCell><PersonCell name={nameOf(c.employee_code)} sub={c.id} /></TableCell><TableCell>{c.from} → {c.to}</TableCell><TableCell>{c.visa}</TableCell><TableCell>{fmtDate(c.target)}</TableCell><TableCell><Pill tone={c.stage === "arrived" ? "mint" : "glob"}>{REL_LABEL[c.stage]}</Pill></TableCell></TableRow>)}</TableBody></Table></TableWrap>}
        </SectionCard>
        {cur && (
          <Stack spacing={2}>
            <SectionCard title={nameOf(cur.employee_code)} subtitle={`${cur.from} → ${cur.to} · ${cur.visa}`}>
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mb: 1.5 }}>{REL_STAGES.map((st) => <Button key={st} size="small" variant={st === cur.stage ? "contained" : "outlined"} disabled={!can} onClick={() => stage(st)}>{REL_LABEL[st]}</Button>)}</Stack>
              {REL_CHECK.map(([k, l]) => <FormControlLabel key={k} sx={{ display: "flex" }} control={<Checkbox size="small" checked={!!cur.checklist[k]} disabled={!can} onChange={() => toggle(k)} />} label={<Typography variant="body2">{l}</Typography>} />)}
              <Progress label="Budget used" value={(cur.spent / Math.max(1, cur.budget)) * 100} right={`${money(cur.spent, "INR", { compact: true })} / ${money(cur.budget, "INR", { compact: true })}`} color={C.glob} />
            </SectionCard>
          </Stack>
        )}
      </TwoCol>
    </ModuleHub>
  );
}

export function MyRelocation() {
  const { data, user, suiteDo, notifyToast } = useStore();
  const me = data.employees.find((e) => e.employee_code === user.employee_code);
  const all = (data.suite?.relocations || []).filter((c) => c.employee_code === user.employee_code);
  const mine = all.find((c) => !["arrived", "cancelled", "rejected"].includes(c.stage)) || all[0] || null;
  const [showForm, setShowForm] = useState(false);
  // v10.6: request option — current location, relocate location (from Companies & locations), passport details, reason.
  const locs = data.workLocations || [];
  const cur = locs.find((l) => l.location_id === me?.location_id);
  const [f, setF] = useState({ to_loc: "", to: "", visa: "", reason: "", family: 0, target: isoDate(new Date(Date.now() + 60 * 86400000)), passport_no: "", passport_country: "India", passport_issue: "", passport_expiry: "" });
  const toLoc = locs.find((l) => l.location_id === f.to_loc);
  const dest = toLoc ? `${toLoc.name}${toLoc.city ? `, ${toLoc.city}` : ""}${toLoc.country ? ` (${toLoc.country})` : ""}` : f.to;
  const foreign = toLoc && cur && toLoc.country !== cur.country;
  function request() {
    if (!dest || f.reason.trim().length < 5) return notifyToast("Choose where you want to relocate and give a reason.", "error");
    if (foreign && (!f.passport_no || !f.passport_expiry)) return notifyToast("Enter your passport number and expiry for a move to another country.", "error");
    const r = suiteDo("relocation-self", (s, { me: code }) => { s.relocations = [{ id: `REL-${String(6 + s.relocations.length).padStart(2, "0")}`, employee_code: code, from: cur ? `${cur.name}${cur.city ? `, ${cur.city}` : ""}` : me?.city || "", from_loc: me?.location_id || "", to: dest, to_loc: f.to_loc, visa: f.visa || (foreign ? "To be advised" : "Not needed"), reason: f.reason, family: f.family, passport: { no: f.passport_no, country: f.passport_country, issue: f.passport_issue, expiry: f.passport_expiry }, stage: "requested", started: isoDate(), target: f.target, checklist: {}, budget: 0, spent: 0 }, ...s.relocations]; }, { action: "RELOCATION_REQUEST", details: `${user.employee_code} → ${dest}`, note: { to: ["ADM01", "SA001", me?.reporting_manager].filter(Boolean), text: `Relocation request from ${user.full_name}: ${cur?.name || me?.city || ""} → ${dest}.`, link: "/relocation" } });
    if (r.ok) { notifyToast("Request sent to HR and your manager."); setShowForm(false); }
  }
  const form = (
    <SectionCard title="Request a relocation" subtitle="HR and your manager are told; for another country, our visa partner contacts you.">
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
        <TextField size="small" label="Current location" value={cur ? `${cur.name}${cur.city ? ` · ${cur.city}` : ""}${cur.country ? ` · ${cur.country}` : ""}` : me?.city || "—"} disabled />
        <TextField select size="small" label="Relocate to (company location) *" value={f.to_loc} onChange={(e) => setF({ ...f, to_loc: e.target.value })}>
          <MenuItem value="">Other — type below</MenuItem>
          {locs.filter((l) => l.location_id !== me?.location_id).map((l) => <MenuItem key={l.location_id} value={l.location_id}>{l.name}{l.city ? ` · ${l.city}` : ""}{l.country ? ` · ${l.country}` : ""}</MenuItem>)}
        </TextField>
        {!f.to_loc && <TextField size="small" label="Or another place (city, country)" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} sx={{ gridColumn: { md: "1 / -1" } }} />}
        <TextField size="small" label="Reason to relocate *" multiline minRows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} sx={{ gridColumn: { md: "1 / -1" } }} />
        <TextField size="small" type="number" label="Family members moving" value={f.family} onChange={(e) => setF({ ...f, family: +e.target.value })} />
        <TextField size="small" type="date" label="Target date" slotProps={{ inputLabel: { shrink: true } }} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: "0.76rem", mt: 2, mb: 1 }}>Passport details{foreign ? " *" : " (needed for a move abroad)"}</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0,1fr))" }, gap: 1.5 }}>
        <TextField size="small" label="Passport number" value={f.passport_no} onChange={(e) => setF({ ...f, passport_no: e.target.value.toUpperCase() })} />
        <TextField size="small" label="Issuing country" value={f.passport_country} onChange={(e) => setF({ ...f, passport_country: e.target.value })} />
        <TextField size="small" type="date" label="Issue date" slotProps={{ inputLabel: { shrink: true } }} value={f.passport_issue} onChange={(e) => setF({ ...f, passport_issue: e.target.value })} />
        <TextField size="small" type="date" label="Expiry date" slotProps={{ inputLabel: { shrink: true } }} value={f.passport_expiry} onChange={(e) => setF({ ...f, passport_expiry: e.target.value })} />
      </Box>
      <TextField size="small" label="Visa type (if known)" value={f.visa} onChange={(e) => setF({ ...f, visa: e.target.value })} sx={{ mt: 1.5, width: { xs: "100%", md: "50%" } }} />
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}><Button variant="contained" onClick={request}>Send request</Button>{mine && <Button onClick={() => setShowForm(false)}>Cancel</Button>}</Stack>
    </SectionCard>
  );
  return (
    <ModuleHub eyebrow="ME · RELOCATION" title="Relocation & visa" subtitle="Request a move to another company location, and track your visa, documents and travel." actions={mine && !showForm ? <Button variant="outlined" onClick={() => setShowForm(true)}>New request</Button> : null}>
      {mine && !showForm ? (
        <Stack spacing={2}>
          <Steps steps={REL_STAGES.map((st, i) => ({ label: REL_LABEL[st], status: i < REL_STAGES.indexOf(mine.stage) ? "done" : i === REL_STAGES.indexOf(mine.stage) ? "running" : "todo" }))} compact />
          <SectionCard title={`${mine.from} → ${mine.to}`} subtitle={`${mine.visa} · target ${fmtDate(mine.target)}${mine.passport?.no ? ` · passport ${mine.passport.no} (exp. ${fmtDate(mine.passport.expiry)})` : ""}`}>
            {mine.reason && <Typography variant="body2" sx={{ mb: 1 }}><b>Reason:</b> {mine.reason}</Typography>}
            {REL_CHECK.map(([k, l]) => <Stack key={k} direction="row" sx={{ justifyContent: "space-between", py: 0.5 }}><Typography variant="body2">{l}</Typography><Pill tone={mine.checklist[k] ? "mint" : "glob"}>{mine.checklist[k] ? "done" : "to do"}</Pill></Stack>)}
            <Hint>Upload documents under Documents; HR ticks them off here.</Hint>
          </SectionCard>
        </Stack>
      ) : form}
    </ModuleHub>
  );
}

// ── SpendCards ──────────────────────────────────────────────────────────────────
export function SpendCards() {
  const { data, suiteDo, suiteCan, notifyToast, nameOf } = useStore();
  const s = data.suite || {};
  const can = suiteCan("cards");
  const [issue, setIssue] = useState(null);
  const month = isoDate().slice(0, 7);
  const spent = (id) => (s.cardTxns || []).filter((t) => t.card === id).reduce((a, t) => a + t.amount, 0);
  const missing = (s.cardTxns || []).filter((t) => !t.receipt);
  function act(id, patch, label) { suiteDo("cards", (x) => { Object.assign(x.cards.find((c) => c.id === id), patch); }, { action: "CARD_UPDATE", details: `${id} · ${label}` }); notifyToast(`Card ${label}.`); }
  function doIssue() {
    const r = suiteDo("cards", (x, { now }) => { x.cards = [{ id: `CARD-${x.cards.length + 1}`, employee_code: issue.employee_code, last4: String(1000 + Math.floor(Math.random() * 8999)), type: issue.type, limit: Number(issue.limit), period: "monthly", status: "active", categories: issue.categories, issued_at: now }, ...x.cards]; }, { action: "CARD_ISSUE", details: `${issue.employee_code} · ${issue.type} · ₹${issue.limit}`, note: { to: issue.employee_code, text: `A ${issue.type} spend card with a ₹${Number(issue.limit).toLocaleString("en-IN")} monthly limit was issued to you.`, link: "/my-card" } });
    if (r.ok) { notifyToast("Card issued."); setIssue(null); }
  }
  return (
    <ModuleHub eyebrow="SPEND · SPENDCARDS" title="Corporate cards for your global team" subtitle="Virtual and physical cards with monthly limits and allowed categories. Every swipe asks for a receipt and lands in accounting — no reimbursement wait."
      actions={<Button variant="contained" startIcon={<Add />} disabled={!can} onClick={() => setIssue({ employee_code: "", type: "virtual", limit: 25000, categories: ["Travel", "Meals"] })}>Issue a card</Button>}
      brief={{ text: <><b>{(s.cards || []).filter((c) => c.status === "active").length}</b> active cards · spent <b>{money((s.cardTxns || []).reduce((a, t) => a + t.amount, 0), "INR")}</b> this month · <b>{missing.length}</b> transaction(s) missing a receipt.</>, actions: [["Remind for receipts", () => { suiteDo("cards", () => ({}), { action: "CARD_RECEIPT_REMINDER", details: `${missing.length} reminders`, note: { to: [...new Set(missing.map((t) => s.cards.find((c) => c.id === t.card)?.employee_code).filter(Boolean))], text: "Please upload receipts for your card transactions.", link: "/my-card" } }); notifyToast("Reminders sent."); }]] }}
      kpis={[{ label: "Active cards", value: (s.cards || []).filter((c) => c.status === "active").length, icon: <CreditCard />, tone: "navy" }, { label: "Spent this month", value: money((s.cardTxns || []).reduce((a, t) => a + t.amount, 0), "INR", { compact: true }), icon: <ReceiptLong />, tone: "glob" }, { label: "Missing receipts", value: missing.length, icon: <UploadFile />, tone: missing.length ? "bad" : "mint" }, { label: "Frozen", value: (s.cards || []).filter((c) => c.status === "frozen").length, icon: <AcUnit />, tone: "purple" }]}>
      <Stack spacing={2}>
        <SectionCard title="Cards" noPad>
          <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Holder</TableCell><TableCell>Card</TableCell><TableCell>Allowed</TableCell><TableCell sx={{ minWidth: 200 }}>Limit used</TableCell><TableCell>Status</TableCell><TableCell align="right" /></TableRow></TableHead>
            <TableBody>{(s.cards || []).map((c) => <TableRow key={c.id}><TableCell><PersonCell name={nameOf(c.employee_code)} sub={c.employee_code} /></TableCell><TableCell>•••• {c.last4} · {c.type}</TableCell><TableCell><Typography variant="caption">{c.categories.join(", ")}</Typography></TableCell><TableCell><Progress value={(spent(c.id) / c.limit) * 100} right={`${money(spent(c.id), "INR")} / ${money(c.limit, "INR")}`} color={spent(c.id) / c.limit > 0.8 ? C.glob : C.navy} /></TableCell><TableCell><StatusPill status={c.status} /></TableCell>
              <TableCell align="right"><Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>{c.status === "active" ? <Button size="small" disabled={!can} onClick={() => act(c.id, { status: "frozen" }, "frozen")}>Freeze</Button> : <Button size="small" disabled={!can} onClick={() => act(c.id, { status: "active" }, "unfrozen")}>Unfreeze</Button>}<Button size="small" disabled={!can} onClick={() => act(c.id, { limit: Math.round(c.limit * 1.2) }, "limit raised 20%")}>+20% limit</Button></Stack></TableCell></TableRow>)}</TableBody></Table></TableWrap>
        </SectionCard>
        <SectionCard title={`Transactions · ${month}`} action={<Button size="small" startIcon={<DownloadRounded />} onClick={() => downloadCsv(`card-transactions-${month}.csv`, ["Date", "Card", "Holder", "Merchant", "Category", "Amount", "Receipt", "Status"], (s.cardTxns || []).map((t) => { const c = s.cards.find((x) => x.id === t.card); return [t.date, `•••• ${c?.last4}`, nameOf(c?.employee_code), t.merchant, t.category, t.amount, t.receipt ? "yes" : "no", t.status]; }))}>Export to accounting</Button>} noPad>
          <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Merchant</TableCell><TableCell>Holder</TableCell><TableCell>Category</TableCell><TableCell align="right">Amount</TableCell><TableCell>Receipt</TableCell></TableRow></TableHead>
            <TableBody>{(s.cardTxns || []).map((t) => <TableRow key={t.id}><TableCell>{fmtDate(t.date)}</TableCell><TableCell>{t.merchant}</TableCell><TableCell>{nameOf(s.cards.find((c) => c.id === t.card)?.employee_code)}</TableCell><TableCell>{t.category}</TableCell><TableCell align="right">{money(t.amount, "INR")}</TableCell><TableCell><StatusPill status={t.status} /></TableCell></TableRow>)}</TableBody></Table></TableWrap>
        </SectionCard>
      </Stack>
      <Dialog open={!!issue} onClose={() => setIssue(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Issue a spend card</DialogTitle>
        <DialogContent><Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField select label="Employee" value={issue?.employee_code || ""} onChange={(e) => setIssue({ ...issue, employee_code: e.target.value })}>{data.employees.filter((e) => e.status === "active").map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name}</MenuItem>)}</TextField>
          <TextField select label="Type" value={issue?.type || "virtual"} onChange={(e) => setIssue({ ...issue, type: e.target.value })}><MenuItem value="virtual">Virtual (instant)</MenuItem><MenuItem value="physical">Physical (delivered)</MenuItem></TextField>
          <TextField type="number" label="Monthly limit (₹)" value={issue?.limit || 0} onChange={(e) => setIssue({ ...issue, limit: e.target.value })} />
          <TextField select label="Allowed categories" slotProps={{ select: { multiple: true } }} value={issue?.categories || []} onChange={(e) => setIssue({ ...issue, categories: asList(e.target.value) })}>{["Travel", "Meals", "Client entertainment", "Software", "Learning", "Vendors", "Office supplies"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setIssue(null)}>Cancel</Button><Button variant="contained" disabled={!issue?.employee_code} onClick={doIssue}>Issue</Button></DialogActions>
      </Dialog>
    </ModuleHub>
  );
}

export function MyCard() {
  const { data, user, suiteDo, notifyToast } = useStore();
  const s = data.suite || {};
  const card = (s.cards || []).find((c) => c.employee_code === user.employee_code);
  if (!card) return <ModuleHub eyebrow="ME · SPEND CARD" title="My spend card" subtitle="Company cards for work expenses — no out-of-pocket spending."><SectionCard><EmptyState title="No card yet" text="Ask your manager or Finance if your role needs one. Until then, claim expenses under Expenses & travel." /></SectionCard></ModuleHub>;
  const txns = (s.cardTxns || []).filter((t) => t.card === card.id);
  const used = txns.reduce((a, t) => a + t.amount, 0);
  const upload = (id) => { suiteDo("card-self", (x) => { const t = x.cardTxns.find((y) => y.id === id); t.receipt = true; t.status = "matched"; }, { action: "CARD_RECEIPT", details: id }); notifyToast("Receipt attached and matched."); };
  const freeze = () => { suiteDo("card-self", (x) => { const c = x.cards.find((y) => y.id === card.id); c.status = c.status === "frozen" ? "active" : "frozen"; }, { action: "CARD_SELF_FREEZE", details: card.id }); notifyToast(card.status === "frozen" ? "Card unfrozen." : "Card frozen — no payments will go through."); };
  return (
    <ModuleHub eyebrow="ME · SPEND CARD" title="My spend card" subtitle="Your company card, its limit and the receipts it needs.">
      <TwoCol right={360}>
        <SectionCard title="Transactions" noPad>
          <TableWrap><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Merchant</TableCell><TableCell>Category</TableCell><TableCell align="right">Amount</TableCell><TableCell>Receipt</TableCell></TableRow></TableHead>
            <TableBody>{txns.map((t) => <TableRow key={t.id}><TableCell>{fmtDate(t.date)}</TableCell><TableCell>{t.merchant}</TableCell><TableCell>{t.category}</TableCell><TableCell align="right">{money(t.amount, "INR")}</TableCell><TableCell>{t.receipt ? <Pill tone="mint">matched</Pill> : <Button size="small" variant="outlined" startIcon={<UploadFile />} onClick={() => upload(t.id)}>Add receipt</Button>}</TableCell></TableRow>)}</TableBody></Table></TableWrap>
        </SectionCard>
        <Stack spacing={2}>
          <Box sx={{ p: 2.5, borderRadius: 3, color: "#fff", background: C.navy, minHeight: 170, display: "flex", flexDirection: "column", justifyContent: "space-between", opacity: card.status === "frozen" ? 0.55 : 1 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography sx={{ fontWeight: 800 }}>ONAS · SpendCard</Typography><Typography variant="caption">{card.type.toUpperCase()}</Typography></Stack>
            <Typography sx={{  fontSize: "1.2rem", letterSpacing: 3 }}>•••• •••• •••• {card.last4}</Typography>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography variant="caption">{user.full_name}</Typography><Typography variant="caption">{card.status === "frozen" ? "FROZEN" : "ACTIVE"}</Typography></Stack>
          </Box>
          <Card sx={{ p: 2 }}><Progress label="This month" value={(used / card.limit) * 100} right={`${money(used, "INR")} / ${money(card.limit, "INR")}`} color={C.glob} /><Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>Allowed: {card.categories.join(", ")}</Typography><Button sx={{ mt: 1 }} startIcon={<AcUnit />} onClick={freeze}>{card.status === "frozen" ? "Unfreeze card" : "Freeze card"}</Button></Card>
        </Stack>
      </TwoCol>
    </ModuleHub>
  );
}
