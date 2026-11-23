// Payroll admin, Component claims, Loans and Perks.
import React, { useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, Drawer, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem, Select, Stack, Switch, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AddRounded, CloseRounded, DownloadRounded, SaveRounded } from "@mui/icons-material";
import { useStore } from "../../../store/AppStore.jsx";
import { SectionCard, StatCard, Grid, PersonCell, Tag, TableWrap, Mono, ConfirmDialog, HBar } from "../../kit/UI.jsx";
import { isoDate, fmtDate, downloadCsv } from "../../../lib/utils.js";
import { fmtMoney, compactInr, monthOf, monthName, loanSchedule, PERK_TYPES, perkTaxable, ctryOf } from "../../../lib/payrollSuite.js";
import { COUNTRIES } from "../../../lib/payroll/index.js";
import { canRunPayroll, Note, ReadOnlyHint } from "./shared.jsx";

const num = (v) => (v === "" ? "" : Number(v));

// ── Payroll admin ──────────────────────────────────────
export function PayrollAdmin() {
  const { data, user, updatePaySettings, notifyToast } = useStore();
  const S = data.paySettings;
  const editable = canRunPayroll(user);
  const [sub, setSub] = useState("groups");
  const [groups, setGroups] = useState(S.payGroups);
  const [comps, setComps] = useState(S.components);
  const psByCode = Object.fromEntries((data.payslipComponents || []).map((k) => [k.code, k]));
  const psOnly = (data.payslipComponents || []).filter((k) => !(S.components || []).some((c) => c.code === k.code));
  const [bands, setBands] = useState(S.bands);
  const [cities, setCities] = useState(S.cityIndex);
  const [rules, setRules] = useState(S.perkRules);
  const [opts, setOpts] = useState(S.options);
  const [newComp, setNewComp] = useState(null);
  const admins = data.admins.filter((a) => a.status === "active" && a.modules.includes("payroll"));
  const save = (patch, label) => { const r = updatePaySettings(patch, label); notifyToast(r.ok ? `${label[0].toUpperCase()}${label.slice(1)} saved.` : r.error, r.ok ? "success" : "error"); };
  const SaveBtn = ({ onClick }) => (editable ? <Button size="small" variant="contained" startIcon={<SaveRounded />} onClick={onClick}>Save</Button> : <ReadOnlyHint />);
  const setRow = (list, setList, i, patch) => setList(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Stack spacing={2}>
      <Tabs value={sub} onChange={(_, v) => setSub(v)} variant="scrollable" allowScrollButtonsMobile sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, fontSize: "0.7rem" } }}>
        <Tab value="groups" label="Pay groups" />
        <Tab value="components" label="Salary components" />
        <Tab value="bands" label="Pay bands & market" />
        <Tab value="cities" label="Locations" />
        <Tab value="perks" label="Perquisite rules" />
        <Tab value="options" label="Settings" />
      </Tabs>

      {sub === "groups" && (
        <SectionCard title="Pay groups" subtitle="One pay group per country payroll engine. Approver = who locks the run." noPad action={<SaveBtn onClick={() => save({ payGroups: groups }, "pay groups")} />}>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 960 }}>
              <TableHead><TableRow><TableCell>Pay group</TableCell><TableCell>Country · currency</TableCell><TableCell>Frequency</TableCell><TableCell align="right">Attendance cut-off</TableCell><TableCell align="right">Pay day</TableCell><TableCell>Approver</TableCell><TableCell>Active</TableCell></TableRow></TableHead>
              <TableBody>
                {groups.map((g, i) => (
                  <TableRow key={g.id}>
                    <TableCell><TextField size="small" value={g.name} disabled={!editable} onChange={(e) => setRow(groups, setGroups, i, { name: e.target.value })} sx={{ minWidth: 220 }} /></TableCell>
                    <TableCell>{COUNTRIES[g.country]?.name} · {g.currency}</TableCell>
                    <TableCell>{g.frequency}</TableCell>
                    <TableCell align="right"><TextField size="small" type="number" value={g.cutoff_day} disabled={!editable} onChange={(e) => setRow(groups, setGroups, i, { cutoff_day: num(e.target.value) })} sx={{ width: 72 }} slotProps={{ htmlInput: { min: 1, max: 31 } }} /></TableCell>
                    <TableCell align="right"><TextField size="small" type="number" value={g.pay_day} disabled={!editable} onChange={(e) => setRow(groups, setGroups, i, { pay_day: num(e.target.value) })} sx={{ width: 72 }} slotProps={{ htmlInput: { min: 1, max: 31 } }} /></TableCell>
                    <TableCell><FormControl size="small"><Select value={g.approver} disabled={!editable} onChange={(e) => setRow(groups, setGroups, i, { approver: e.target.value })} sx={{ fontSize: "0.7rem" }}>{admins.map((a) => <MenuItem key={a.admin_code} value={a.admin_code}>{a.full_name}</MenuItem>)}<MenuItem value="SA001">Super Admin</MenuItem></Select></FormControl></TableCell>
                    <TableCell><Switch size="small" checked={g.status === "active"} disabled={!editable} onChange={(e) => setRow(groups, setGroups, i, { status: e.target.checked ? "active" : "inactive" })} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      )}

      {sub === "components" && (
        <SectionCard title="Salary components" subtitle="Earnings, flexible-benefit (claimable) components and deductions shown on payslips" noPad
          action={<Stack direction="row" spacing={1}>{editable && <Button size="small" startIcon={<AddRounded />} onClick={() => setNewComp({ code: "", name: "", type: "earning", calc: "", taxable: true, kind: "fixed", on_payslip: true, active: true })}>Add component</Button>}<SaveBtn onClick={() => save({ components: comps }, "salary components")} /></Stack>}>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHead><TableRow><TableCell>Code</TableCell><TableCell>Name</TableCell><TableCell>Type</TableCell><TableCell>Calculation</TableCell><TableCell>Taxable</TableCell><TableCell>On payslip</TableCell><TableCell>Payslip field</TableCell><TableCell>Active</TableCell></TableRow></TableHead>
              <TableBody>
                {comps.map((c, i) => (
                  <TableRow key={c.code}>
                    <TableCell><Mono>{c.code}</Mono></TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell><Tag tone={{ earning: "good", fbp: "info", deduction: "warn" }[c.type]}>{{ earning: "Earning", fbp: "Flexible benefit", deduction: "Deduction" }[c.type]}</Tag></TableCell>
                    <TableCell sx={{ maxWidth: 320 }}><Typography variant="body2" color="text.secondary">{c.calc}</Typography></TableCell>
                    <TableCell><Checkbox size="small" checked={!!c.taxable} disabled={!editable || c.kind === "statutory"} onChange={(e) => setRow(comps, setComps, i, { taxable: e.target.checked })} /></TableCell>
                    <TableCell><Checkbox size="small" checked={!!c.on_payslip} disabled={!editable} onChange={(e) => setRow(comps, setComps, i, { on_payslip: e.target.checked })} /></TableCell>
                    <TableCell>{psByCode[c.code] ? <Tag tone="good">same · {psByCode[c.code].name}</Tag> : <Tag tone="neutral">payroll only</Tag>}</TableCell>
                    <TableCell><Switch size="small" checked={!!c.active} disabled={!editable || c.kind === "statutory"} onChange={(e) => setRow(comps, setComps, i, { active: e.target.checked })} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
          {/* v10.6: one list — payslip fields that are not a salary component are shown here too, so nothing is kept twice. */}
          {psOnly.length > 0 && (
            <Box sx={{ px: 2, py: 1.2, borderTop: 1, borderColor: "divider", background: "#FFF8DB" }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Payslip-only fields ({psOnly.length}) — from Payslips → Payslip fields & upload format</Typography>
              <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap", mt: 0.8 }}>{psOnly.map((k) => <Chip key={k.code} size="small" label={`${k.code} · ${k.name}`} variant="outlined" />)}</Stack>
            </Box>
          )}
          <Note>Statutory deductions come from the country engines and cannot be switched off here. Components and payslip fields are matched by code: one code = one component in payroll and on the payslip.</Note>
        </SectionCard>
      )}

      {sub === "bands" && (
        <SectionCard title="Pay bands & market data (India, monthly gross ₹)" subtitle="Used by Employee competitiveness and Compensation planning. Bands are scaled by the location index." noPad action={<SaveBtn onClick={() => save({ bands }, "pay bands")} />}>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead><TableRow><TableCell>Grade</TableCell>{["min", "mid", "max", "p25", "p50", "p75"].map((k) => <TableCell key={k} align="right">{{ min: "Band min", mid: "Mid-point", max: "Band max", p25: "Market P25", p50: "Market P50", p75: "Market P75" }[k]}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {Object.entries(bands).map(([g, b]) => (
                  <TableRow key={g}>
                    <TableCell sx={{ fontWeight: 700 }}>{g}</TableCell>
                    {["min", "mid", "max", "p25", "p50", "p75"].map((k) => <TableCell key={k} align="right"><TextField size="small" type="number" value={b[k]} disabled={!editable} onChange={(e) => setBands({ ...bands, [g]: { ...b, [k]: num(e.target.value) } })} sx={{ width: 110 }} /></TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      )}

      {sub === "cities" && (
        <SectionCard title="Locations & cost-of-living index" subtitle="Hyderabad = 100" noPad action={<Stack direction="row" spacing={1}>{editable && <Button size="small" startIcon={<AddRounded />} onClick={() => setCities([...cities, { city: "", country: "IN", index: 100 }])}>Add location</Button>}<SaveBtn onClick={() => save({ cityIndex: cities.filter((c) => c.city.trim()) }, "locations")} /></Stack>}>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 560 }}>
              <TableHead><TableRow><TableCell>City</TableCell><TableCell>Country</TableCell><TableCell align="right">Index</TableCell></TableRow></TableHead>
              <TableBody>
                {cities.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell><TextField size="small" value={c.city} disabled={!editable} onChange={(e) => setRow(cities, setCities, i, { city: e.target.value })} /></TableCell>
                    <TableCell><FormControl size="small"><Select value={c.country} disabled={!editable} onChange={(e) => setRow(cities, setCities, i, { country: e.target.value })} sx={{ fontSize: "0.7rem" }}>{Object.entries(COUNTRIES).map(([k, v]) => <MenuItem key={k} value={k}>{v.name}</MenuItem>)}</Select></FormControl></TableCell>
                    <TableCell align="right"><TextField size="small" type="number" value={c.index} disabled={!editable} onChange={(e) => setRow(cities, setCities, i, { index: num(e.target.value) })} sx={{ width: 90 }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      )}

      {sub === "perks" && (
        <SectionCard title="Perquisite valuation rules (India)" subtitle="Company defaults for taxable value per month. Check them against the current Income-tax Rules with your tax adviser." action={<SaveBtn onClick={() => save({ perkRules: rules }, "perquisite rules")} />}>
          <Grid min={220}>
            {[["car_small", "Car ≤ 1.6 L, mixed use (₹/month)"], ["car_large", "Car > 1.6 L, mixed use (₹/month)"], ["driver", "Driver (₹/month)"], ["accommodation_pct", "Leased accommodation (% of salary, cap)"], ["loan_exempt_upto", "Loans exempt up to (₹ aggregate)"], ["loan_benchmark_rate", "Benchmark loan rate (%)"], ["gift_exempt", "Gifts exempt up to (₹/year)"]].map(([k, l]) => (
              <TextField key={k} size="small" type="number" label={l} value={rules[k]} disabled={!editable} onChange={(e) => setRules({ ...rules, [k]: num(e.target.value) })} />
            ))}
          </Grid>
        </SectionCard>
      )}

      {sub === "options" && (
        <SectionCard title="Payroll settings" action={<SaveBtn onClick={() => save({ options: opts }, "payroll settings")} />}>
          <Stack spacing={1.5}>
            <FormControlLabel control={<Switch checked={!!opts.arrears} disabled={!editable} onChange={(e) => setOpts({ ...opts, arrears: e.target.checked })} />} label={<Typography variant="body2">Pay arrears automatically when a back-dated revision is applied</Typography>} />
            <FormControlLabel control={<Switch checked={!!opts.release_payslips_on_lock} disabled={!editable} onChange={(e) => setOpts({ ...opts, release_payslips_on_lock: e.target.checked })} />} label={<Typography variant="body2">Notify employees when a run is locked</Typography>} />
            <FormControlLabel control={<Switch checked={!!opts.fbp_carry_forward} disabled={!editable} onChange={(e) => setOpts({ ...opts, fbp_carry_forward: e.target.checked })} />} label={<Typography variant="body2">Carry unclaimed flexible-benefit balance into the next year</Typography>} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <FormControl size="small" sx={{ minWidth: 220 }}><InputLabel>LOP day basis</InputLabel><Select label="LOP day basis" value={opts.lop_basis} disabled={!editable} onChange={(e) => setOpts({ ...opts, lop_basis: e.target.value })}><MenuItem value="calendar">Calendar days in the month</MenuItem><MenuItem value="working">Working days</MenuItem><MenuItem value="fixed30">Fixed 30 days</MenuItem></Select></FormControl>
              <TextField size="small" type="number" label="Lock payroll by (day)" value={opts.lock_day} disabled={!editable} onChange={(e) => setOpts({ ...opts, lock_day: num(e.target.value) })} />
              <TextField size="small" type="number" label="Claims cut-off (day)" value={opts.claims_cutoff_day} disabled={!editable} onChange={(e) => setOpts({ ...opts, claims_cutoff_day: num(e.target.value) })} />
            </Stack>
          </Stack>
        </SectionCard>
      )}

      <ConfirmDialog open={!!newComp} title="Add salary component" confirmLabel="Add" onClose={() => setNewComp(null)} onConfirm={() => {
        const code = (newComp.code || "").trim().toUpperCase();
        if (!code || !newComp.name.trim()) return notifyToast("Enter a code and a name.", "error");
        if (comps.some((c) => c.code === code)) return notifyToast("That code is already used.", "error");
        setComps([...comps, { ...newComp, code, name: newComp.name.trim(), kind: newComp.type === "fbp" ? "claim" : newComp.type === "deduction" ? "recovery" : "fixed" }]);
        setNewComp(null);
      }}>
        {newComp && (
          <Stack spacing={1.5}>
            <TextField size="small" label="Code" value={newComp.code} onChange={(e) => setNewComp({ ...newComp, code: e.target.value })} placeholder="e.g. CHILDEDU" />
            <TextField size="small" label="Name" value={newComp.name} onChange={(e) => setNewComp({ ...newComp, name: e.target.value })} />
            <FormControl size="small"><InputLabel>Type</InputLabel><Select label="Type" value={newComp.type} onChange={(e) => setNewComp({ ...newComp, type: e.target.value, taxable: e.target.value === "earning" })}><MenuItem value="earning">Earning</MenuItem><MenuItem value="fbp">Flexible benefit (claimable)</MenuItem><MenuItem value="deduction">Deduction</MenuItem></Select></FormControl>
            <TextField size="small" label="How it is calculated" value={newComp.calc} onChange={(e) => setNewComp({ ...newComp, calc: e.target.value })} />
            <Typography variant="caption" color="text.secondary">Click Save on the table afterwards to keep it.</Typography>
          </Stack>
        )}
      </ConfirmDialog>
    </Stack>
  );
}

// ── Component claims ───────────────────────────────────
export function ComponentClaims({ employees }) {
  const { data, user, decideComponentClaims, createComponentClaim, markClaimsPaid, setFbp, notifyToast } = useStore();
  const editable = canRunPayroll(user);
  const fbpComps = data.paySettings.components.filter((c) => c.type === "fbp" && c.active);
  const compName = (c) => data.paySettings.components.find((k) => k.code === c)?.name || c;
  const codes = new Set(employees.map((e) => e.employee_code));
  const claims = data.componentClaims.filter((c) => codes.has(c.employee_code));
  const [view, setView] = useState("Pending");
  const [sel, setSel] = useState([]);
  const [reject, setReject] = useState(null);
  const [note, setNote] = useState("");
  const [add, setAdd] = useState(null);
  const [sub, setSub] = useState("claims");
  const month = monthOf();
  const emp = (c) => data.employees.find((e) => e.employee_code === c);
  const usedOf = (code, comp) => data.componentClaims.filter((x) => x.employee_code === code && x.component === comp && ["Pending", "Approved", "Paid"].includes(x.status)).reduce((s, x) => s + x.amount, 0);
  const list = claims.filter((c) => view === "All" || c.status === view);
  const sum = (st) => claims.filter((c) => st.includes(c.status)).reduce((s, c) => s + c.amount, 0);
  const india = employees.filter((e) => e.status === "active" && ctryOf(e) === "IN");
  const entitled = india.reduce((s, e) => s + fbpComps.reduce((t, k) => t + (data.fbp[e.employee_code]?.[k.code] || 0), 0), 0);
  const decide = (ids, d, n = "") => { const r = decideComponentClaims(ids, d, n); notifyToast(r.ok ? `${r.count} claim(s) ${d.toLowerCase()}.` : r.error, r.ok ? "success" : "error"); if (r.ok) setSel([]); return r; };

  return (
    <Stack spacing={2.5}>
      <Grid min={180}>
        <StatCard label="Pending approval" value={claims.filter((c) => c.status === "Pending").length} hint={compactInr(sum(["Pending"]))} tone="warn" onClick={() => setView("Pending")} />
        <StatCard label={`To pay with ${monthName(month, "long")}`} value={claims.filter((c) => c.status === "Approved").length} hint={compactInr(sum(["Approved"]))} tone="info" onClick={() => setView("Approved")} />
        <StatCard label="Paid this year" value={compactInr(sum(["Paid"]))} tone="good" onClick={() => setView("Paid")} />
        <StatCard label="Unclaimed entitlement" value={compactInr(entitled - sum(["Pending", "Approved", "Paid"]))} hint={`of ${compactInr(entitled)} declared`} tone="neutral" onClick={() => setSub("plans")} />
      </Grid>
      <Tabs value={sub} onChange={(_, v) => setSub(v)} sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, fontSize: "0.7rem" } }}>
        <Tab value="claims" label="Claims" />
        <Tab value="plans" label="Flexible benefit plans" />
      </Tabs>
      {sub === "claims" && (
        <SectionCard title="Component claims" subtitle="Bills against flexible-benefit components. Approved claims are paid tax-free with the next salary." noPad
          action={
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
              {["Pending", "Approved", "Paid", "Rejected", "All"].map((v) => <Chip key={v} size="small" label={v} color={view === v ? "primary" : "default"} onClick={() => { setView(v); setSel([]); }} />)}
              {editable && sel.length > 0 && view === "Pending" && <><Button size="small" variant="contained" onClick={() => decide(sel, "Approved")}>Approve {sel.length}</Button><Button size="small" color="error" onClick={() => setReject(sel)}>Reject</Button></>}
              {editable && view === "Approved" && claims.some((c) => c.status === "Approved") && <Button size="small" variant="outlined" onClick={() => { const r = markClaimsPaid(month); notifyToast(r.ok ? `${r.count} claim(s) marked paid with ${month} payroll.` : r.error, r.ok ? "success" : "error"); }}>Mark paid with {monthName(month)}</Button>}
              {editable && <Button size="small" startIcon={<AddRounded />} onClick={() => setAdd({ employee_code: "", component: fbpComps[0]?.code || "", amount: "", bill_date: isoDate(), description: "", bill: null })}>New claim</Button>}
            </Stack>
          }>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 980 }}>
              <TableHead><TableRow>{view === "Pending" && editable && <TableCell padding="checkbox"><Checkbox size="small" checked={sel.length > 0 && sel.length === list.length} onChange={(e) => setSel(e.target.checked ? list.map((c) => c.id) : [])} /></TableCell>}<TableCell>Claim</TableCell><TableCell>Employee</TableCell><TableCell>Component</TableCell><TableCell>Bill</TableCell><TableCell align="right">Amount</TableCell><TableCell align="right">Balance after</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {list.length === 0 && <TableRow><TableCell colSpan={9}><Typography variant="body2" color="text.secondary">No {view.toLowerCase()} claims.</Typography></TableCell></TableRow>}
                {list.map((c) => {
                  const ent = data.fbp[c.employee_code]?.[c.component] || 0;
                  return (
                    <TableRow key={c.id} hover>
                      {view === "Pending" && editable && <TableCell padding="checkbox"><Checkbox size="small" checked={sel.includes(c.id)} onChange={(e) => setSel(e.target.checked ? [...sel, c.id] : sel.filter((x) => x !== c.id))} /></TableCell>}
                      <TableCell><Mono>{c.id}</Mono><Typography variant="caption" component="div" color="text.secondary">{fmtDate(c.submitted_at)}</Typography></TableCell>
                      <TableCell><PersonCell name={emp(c.employee_code)?.full_name || c.employee_code} sub={c.employee_code} /></TableCell>
                      <TableCell>{compName(c.component)}<Typography variant="caption" component="div" color="text.secondary">{c.description}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{c.bill?.name}</Typography><Typography variant="caption" color="text.secondary">{fmtDate(c.bill_date)}</Typography></TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtMoney(c.amount)}</TableCell>
                      <TableCell align="right">{fmtMoney(ent - usedOf(c.employee_code, c.component))}<Typography variant="caption" component="div" color="text.secondary">of {fmtMoney(ent)}</Typography></TableCell>
                      <TableCell><Tag tone={{ Pending: "warn", Approved: "info", Paid: "good", Rejected: "bad" }[c.status]}>{c.status}</Tag>{c.payroll_month && c.status !== "Rejected" && <Typography variant="caption" component="div" color="text.secondary">{monthName(c.payroll_month)} payroll</Typography>}{c.note && <Typography variant="caption" component="div" color="text.secondary">{c.note}</Typography>}</TableCell>
                      <TableCell>{editable && c.status === "Pending" && <Stack direction="row" spacing={0.5}><Button size="small" onClick={() => decide([c.id], "Approved")}>Approve</Button><Button size="small" color="error" onClick={() => setReject([c.id])}>Reject</Button></Stack>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      )}
      {sub === "plans" && (
        <SectionCard title="Flexible benefit plans (India)" subtitle="Annual entitlement per component, claimed and balance. Edit an amount to change the declaration." noPad
          action={<Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv("flexible-benefit-plans.csv", ["Employee code", "Name", ...fbpComps.flatMap((k) => [`${k.code} entitlement`, `${k.code} claimed`])], india.map((e) => [e.employee_code, e.full_name, ...fbpComps.flatMap((k) => [data.fbp[e.employee_code]?.[k.code] || 0, usedOf(e.employee_code, k.code)])]))}>CSV</Button>}>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 1000 }}>
              <TableHead><TableRow><TableCell>Employee</TableCell>{fbpComps.map((k) => <TableCell key={k.code} align="right">{k.name}</TableCell>)}<TableCell align="right">Total / year</TableCell></TableRow></TableHead>
              <TableBody>
                {india.map((e) => {
                  const p = data.fbp[e.employee_code] || {};
                  return (
                    <TableRow key={e.employee_code}>
                      <TableCell><PersonCell name={e.full_name} sub={`${e.employee_code} · ${e.grade_code}`} /></TableCell>
                      {fbpComps.map((k) => {
                        const used = usedOf(e.employee_code, k.code);
                        return (
                          <TableCell key={k.code} align="right">
                            <TextField size="small" type="number" defaultValue={p[k.code] || 0} disabled={!editable} onBlur={(ev) => { const v = Number(ev.target.value) || 0; if (v !== (p[k.code] || 0)) { if (v < used) { notifyToast(`Already ${used.toLocaleString("en-IN")} claimed; the entitlement cannot be lower.`, "error"); ev.target.value = p[k.code] || 0; return; } setFbp(e.employee_code, { [k.code]: v }); } }} sx={{ width: 96 }} slotProps={{ htmlInput: { min: 0, "aria-label": `${k.name} for ${e.full_name}` } }} />
                            <Typography variant="caption" component="div" color="text.secondary">{used ? `${compactInr(used)} used` : "—"}</Typography>
                          </TableCell>
                        );
                      })}
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtMoney(fbpComps.reduce((s, k) => s + (p[k.code] || 0), 0))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      )}
      <ConfirmDialog open={!!reject} title="Reject claim(s)" confirmLabel="Reject" tone="error" disabled={!note.trim()} onClose={() => { setReject(null); setNote(""); }} onConfirm={() => { const r = decide(reject, "Rejected", note); if (r.ok) { setReject(null); setNote(""); } }}>
        <TextField size="small" fullWidth multiline minRows={2} label="Reason (sent to the employee)" value={note} onChange={(e) => setNote(e.target.value)} />
      </ConfirmDialog>
      <ConfirmDialog open={!!add} title="New component claim" confirmLabel="Submit claim" onClose={() => setAdd(null)} onConfirm={() => { const r = createComponentClaim(add); notifyToast(r.ok ? `Claim ${r.id} submitted.` : r.error, r.ok ? "success" : "error"); if (r.ok) setAdd(null); }}>
        {add && (
          <Stack spacing={1.5}>
            <FormControl size="small"><InputLabel>Employee</InputLabel><Select label="Employee" value={add.employee_code} onChange={(e) => setAdd({ ...add, employee_code: e.target.value })}>{india.map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name} · {e.employee_code}</MenuItem>)}</Select></FormControl>
            <FormControl size="small"><InputLabel>Component</InputLabel><Select label="Component" value={add.component} onChange={(e) => setAdd({ ...add, component: e.target.value })}>{fbpComps.map((k) => <MenuItem key={k.code} value={k.code}>{k.name}</MenuItem>)}</Select></FormControl>
            {add.employee_code && <Typography variant="caption" color="text.secondary">Balance: {fmtMoney((data.fbp[add.employee_code]?.[add.component] || 0) - usedOf(add.employee_code, add.component))}</Typography>}
            <TextField size="small" type="number" label="Amount (₹)" value={add.amount} onChange={(e) => setAdd({ ...add, amount: e.target.value })} />
            <TextField size="small" type="date" label="Bill date" value={add.bill_date} onChange={(e) => setAdd({ ...add, bill_date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" label="Description" value={add.description} onChange={(e) => setAdd({ ...add, description: e.target.value })} />
            <Button component="label" size="small" variant="outlined">{add.bill ? `Bill: ${add.bill.name}` : "Attach bill"}<input hidden type="file" accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) setAdd({ ...add, bill: { name: f.name, size: f.size, type: f.type, data_url: null } }); }} /></Button>
          </Stack>
        )}
      </ConfirmDialog>
    </Stack>
  );
}

// ── Loans ──────────────────────────────────────────────
export function LoansView({ employees }) {
  const { data, user, recordLoanRepayment, toggleLoanPause, notifyToast } = useStore();
  const editable = canRunPayroll(user);
  const codes = new Set(employees.map((e) => e.employee_code));
  const loans = data.requests.filter((r) => r.type === "loan" && codes.has(r.employee_code));
  const active = loans.filter((r) => r.status === "Disbursed").map((r) => ({ r, s: loanSchedule(r, data.loanLedger?.[r.request_id]) }));
  const pipeline = loans.filter((r) => ["Pending", "Approved"].includes(r.status));
  const [open, setOpen] = useState(null);
  const [pay, setPay] = useState(null);
  const month = monthOf();
  const emp = (c) => data.employees.find((e) => e.employee_code === c);
  const running = active.filter((x) => !x.s.closed);
  const outstanding = running.reduce((s, x) => s + x.s.outstanding, 0);
  const thisMonth = running.reduce((s, x) => s + (x.s.rows.find((y) => y.month === month)?.amount || 0), 0);
  const cur = open ? active.find((x) => x.r.request_id === open) : null;
  const perqRisk = running.filter((x) => x.s.outstanding > (data.paySettings.perkRules.loan_exempt_upto ?? 200000));
  return (
    <Stack spacing={2.5}>
      <Grid min={180}>
        <StatCard label="Active loans" value={running.length} tone="accent" />
        <StatCard label="Outstanding" value={compactInr(outstanding)} tone="warn" />
        <StatCard label={`EMIs in ${monthName(month, "long")} payroll`} value={compactInr(thisMonth)} tone="info" />
        <StatCard label="Awaiting approval / disbursal" value={pipeline.length} hint="In Approvals → Requests" tone="neutral" />
      </Grid>
      {perqRisk.length > 0 && <Alert severity="warning">{perqRisk.length} interest-free loan(s) are above the exempt limit; add them under Perks so the perquisite is taxed.</Alert>}
      <SectionCard title="Loan register" subtitle="Salary loans approved through requests. EMIs are recovered through payroll; record prepayments or skip a month here." noPad
        action={<Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadCsv(`loan-register-${month}.csv`, ["Loan", "Employee code", "Name", "Principal", "EMI", "Tenure", "Start", "Recovered", "Outstanding", "Status"], active.map(({ r, s }) => [r.request_id, r.employee_code, emp(r.employee_code)?.full_name, s.amount, s.emi, r.tenure_months, s.start, s.recovered, s.outstanding, s.closed ? "Closed" : "Active"]))}>CSV</Button>}>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 980 }}>
            <TableHead><TableRow><TableCell>Loan</TableCell><TableCell>Employee</TableCell><TableCell align="right">Principal</TableCell><TableCell align="right">EMI</TableCell><TableCell>Progress</TableCell><TableCell align="right">Outstanding</TableCell><TableCell>Next EMI</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
            <TableBody>
              {active.length === 0 && <TableRow><TableCell colSpan={8}><Typography variant="body2" color="text.secondary">No disbursed loans.</Typography></TableCell></TableRow>}
              {active.map(({ r, s }) => (
                <TableRow key={r.request_id} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(r.request_id)}>
                  <TableCell><Mono>{r.request_id}</Mono><Typography variant="caption" component="div" color="text.secondary">{r.reason}</Typography></TableCell>
                  <TableCell><PersonCell name={emp(r.employee_code)?.full_name || r.employee_code} sub={r.employee_code} /></TableCell>
                  <TableCell align="right">{fmtMoney(s.amount)}</TableCell>
                  <TableCell align="right">{fmtMoney(s.emi)}</TableCell>
                  <TableCell sx={{ minWidth: 160 }}><HBar label={`${s.paidCount}/${r.tenure_months} EMIs`} value={s.recovered} max={s.amount} right={`${Math.round((s.recovered / Math.max(1, s.amount)) * 100)}%`} /></TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtMoney(s.outstanding)}</TableCell>
                  <TableCell>{s.closed ? "—" : s.next ? `${monthName(s.next.month)} · ${fmtMoney(s.next.amount)}` : "—"}</TableCell>
                  <TableCell><Tag tone={s.closed ? "good" : "info"}>{s.closed ? "Closed" : "Active"}</Tag></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
      </SectionCard>
      {pipeline.length > 0 && (
        <SectionCard title="In the pipeline" noPad>
          <TableWrap>
            <Table size="small"><TableHead><TableRow><TableCell>Loan</TableCell><TableCell>Employee</TableCell><TableCell align="right">Amount</TableCell><TableCell align="right">EMI</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>{pipeline.map((r) => <TableRow key={r.request_id}><TableCell><Mono>{r.request_id}</Mono></TableCell><TableCell>{emp(r.employee_code)?.full_name}</TableCell><TableCell align="right">{fmtMoney(r.approved_amount ?? r.amount)}</TableCell><TableCell align="right">{fmtMoney(r.emi)} × {r.tenure_months}</TableCell><TableCell><Tag tone="warn">{r.status === "Pending" ? `Pending ${r.stage}` : "Approved · to disburse"}</Tag></TableCell></TableRow>)}</TableBody>
            </Table>
          </TableWrap>
        </SectionCard>
      )}
      <Drawer anchor="right" open={!!cur} onClose={() => setOpen(null)} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 560 } } } }}>
        {cur && (
          <>
            <Stack direction="row" sx={{ alignItems: "center", px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="h2" sx={{ flex: 1 }}>{cur.r.request_id} · {emp(cur.r.employee_code)?.full_name}</Typography>
              <IconButton onClick={() => setOpen(null)} aria-label="Close"><CloseRounded /></IconButton>
            </Stack>
            <Stack spacing={2} sx={{ p: 2.5, overflow: "auto" }}>
              <Grid min={140}>
                <StatCard label="Principal" value={compactInr(cur.s.amount)} />
                <StatCard label="Recovered" value={compactInr(cur.s.recovered)} tone="good" />
                <StatCard label="Outstanding" value={compactInr(cur.s.outstanding)} tone="warn" />
              </Grid>
              {editable && !cur.s.closed && (
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  <Button size="small" variant="outlined" onClick={() => setPay({ id: cur.r.request_id, amount: "", note: "", foreclose: false })}>Record prepayment</Button>
                  <Button size="small" variant="outlined" onClick={() => { const r = toggleLoanPause(cur.r.request_id, month); notifyToast(r.ok ? (r.paused ? `${monthName(month)} EMI skipped.` : `${monthName(month)} EMI restored.`) : r.error, r.ok ? "success" : "error"); }}>{(data.loanLedger?.[cur.r.request_id]?.paused_months || []).includes(month) ? "Resume this month's EMI" : "Skip this month's EMI"}</Button>
                  <Button size="small" color="secondary" variant="contained" onClick={() => setPay({ id: cur.r.request_id, amount: cur.s.outstanding, note: "", foreclose: true })}>Foreclose</Button>
                </Stack>
              )}
              <TableWrap>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Month</TableCell><TableCell>Entry</TableCell><TableCell align="right">Amount</TableCell><TableCell align="right">Balance</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                  <TableBody>{cur.s.rows.map((x, i) => <TableRow key={i}><TableCell>{monthName(x.month)}</TableCell><TableCell>{x.kind}{x.note && <Typography variant="caption" component="div" color="text.secondary">{x.note}</Typography>}</TableCell><TableCell align="right">{fmtMoney(x.amount)}</TableCell><TableCell align="right">{fmtMoney(x.balance)}</TableCell><TableCell><Tag tone={{ Recovered: "good", "This month": "info", Scheduled: "neutral", Paused: "warn" }[x.status]}>{x.status}</Tag></TableCell></TableRow>)}</TableBody>
                </Table>
              </TableWrap>
            </Stack>
          </>
        )}
      </Drawer>
      <ConfirmDialog open={!!pay} title={pay?.foreclose ? "Foreclose loan" : "Record prepayment"} confirmLabel={pay?.foreclose ? "Close loan" : "Record"} onClose={() => setPay(null)} onConfirm={() => { const r = recordLoanRepayment(pay.id, pay); notifyToast(r.ok ? "Recorded." : r.error, r.ok ? "success" : "error"); if (r.ok) setPay(null); }}>
        {pay && (
          <Stack spacing={1.5}>
            <TextField size="small" type="number" label="Amount received (₹)" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            <TextField size="small" label="Reference / note" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} placeholder="UTR or cheque number" />
          </Stack>
        )}
      </ConfirmDialog>
    </Stack>
  );
}

// ── Perks ──────────────────────────────────────────────
export function PerksView({ employees }) {
  const { data, user, upsertPerk, endPerk, notifyToast } = useStore();
  const editable = canRunPayroll(user);
  const rules = data.paySettings.perkRules;
  const codes = new Set(employees.map((e) => e.employee_code));
  const perks = data.perks.filter((p) => codes.has(p.employee_code));
  const [show, setShow] = useState("active");
  const [form, setForm] = useState(null);
  const [end, setEnd] = useState(null);
  const emp = (c) => data.employees.find((e) => e.employee_code === c);
  const activeP = perks.filter((p) => p.status === "active");
  const monthly = activeP.reduce((s, p) => s + perkTaxable(p, emp(p.employee_code), rules), 0);
  const list = perks.filter((p) => show === "all" || p.status === show);
  const india = employees.filter((e) => e.status === "active" && ctryOf(e) === "IN");
  const describe = (p) => {
    const d = p.details || {};
    return { car: `${d.vehicle || "Car"} · ${d.engine === "above_1600" ? "> 1.6 L" : "≤ 1.6 L"} · ${d.usage === "official" ? "official use only" : "mixed use"}${d.driver ? " · with driver" : ""}`, accommodation: `${d.address || "Leased flat"} · rent ₹${(Number(d.rent) || 0).toLocaleString("en-IN")}/month · recovery ₹${(Number(d.recovery) || 0).toLocaleString("en-IN")}`, loan: `Outstanding ₹${(Number(d.outstanding) || 0).toLocaleString("en-IN")} at ${d.rate || 0}%`, gift: `${d.name || "Vouchers"} · ₹${(Number(d.annual) || 0).toLocaleString("en-IN")} a year`, club: `${d.name || "Club"} · ₹${(Number(d.monthly) || 0).toLocaleString("en-IN")}/month`, esop: `${d.grant || "ESOP"} · ${d.shares} shares · FMV ₹${d.fmv} vs exercise ₹${d.exercise}`, other: `${d.name || "Perquisite"} · ₹${(Number(d.monthly) || 0).toLocaleString("en-IN")}/month` }[p.type];
  };
  const preview = form ? perkTaxable(form, emp(form.employee_code), rules) : 0;
  const F = (k, v) => setForm({ ...form, details: { ...form.details, [k]: v } });
  return (
    <Stack spacing={2.5}>
      <Grid min={180}>
        <StatCard label="Active perquisites" value={activeP.length} tone="accent" />
        <StatCard label="Employees with perks" value={new Set(activeP.map((p) => p.employee_code)).size} tone="info" />
        <StatCard label="Taxable value / month" value={compactInr(monthly)} tone="warn" hint="Added to taxable salary for TDS" />
        <StatCard label="Taxable value / year" value={compactInr(monthly * 12)} tone="neutral" />
      </Grid>
      <SectionCard title="Perquisites" subtitle="Benefits in kind valued for tax. The taxable value flows into TDS and Form 16 / Form 130 Part B." noPad
        action={<Stack direction="row" spacing={1}>{["active", "ended", "all"].map((v) => <Chip key={v} size="small" label={v[0].toUpperCase() + v.slice(1)} color={show === v ? "primary" : "default"} onClick={() => setShow(v)} />)}{editable && <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setForm({ employee_code: "", type: "car", details: { engine: "upto_1600", usage: "mixed", driver: false }, from: isoDate() })}>Add perk</Button>}</Stack>}>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 920 }}>
            <TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Perquisite</TableCell><TableCell>Details</TableCell><TableCell>From</TableCell><TableCell align="right">Taxable / month</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {list.length === 0 && <TableRow><TableCell colSpan={7}><Typography variant="body2" color="text.secondary">None.</Typography></TableCell></TableRow>}
              {list.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><PersonCell name={emp(p.employee_code)?.full_name || p.employee_code} sub={`${p.employee_code} · ${p.id}`} /></TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{PERK_TYPES[p.type]}</TableCell>
                  <TableCell sx={{ maxWidth: 340 }}><Typography variant="body2" color="text.secondary">{describe(p)}</Typography></TableCell>
                  <TableCell>{fmtDate(p.from)}{p.to && ` – ${fmtDate(p.to)}`}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtMoney(perkTaxable(p, emp(p.employee_code), rules))}</TableCell>
                  <TableCell><Tag tone={p.status === "active" ? "good" : "neutral"}>{p.status === "active" ? "Active" : "Ended"}</Tag></TableCell>
                  <TableCell>{editable && p.status === "active" && <Stack direction="row" spacing={0.5}><Button size="small" onClick={() => setForm(p)}>Edit</Button><Button size="small" color="error" onClick={() => setEnd({ id: p.id, to: isoDate() })}>End</Button></Stack>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
        <Note>Valuation uses Payroll admin → Perquisite rules (company defaults). Confirm the rates with your tax adviser for each tax year.</Note>
      </SectionCard>
      <ConfirmDialog open={!!form} title={form?.id ? "Edit perquisite" : "Add perquisite"} confirmLabel="Save" onClose={() => setForm(null)} onConfirm={() => { const r = upsertPerk(form); notifyToast(r.ok ? "Perquisite saved." : r.error, r.ok ? "success" : "error"); if (r.ok) setForm(null); }}>
        {form && (
          <Stack spacing={1.5}>
            <FormControl size="small" disabled={!!form.id}><InputLabel>Employee</InputLabel><Select label="Employee" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })}>{india.map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name} · {e.employee_code}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" disabled={!!form.id}><InputLabel>Perquisite</InputLabel><Select label="Perquisite" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, details: {} })}>{Object.entries(PERK_TYPES).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</Select></FormControl>
            {form.type === "car" && (<>
              <TextField size="small" label="Vehicle" value={form.details.vehicle || ""} onChange={(e) => F("vehicle", e.target.value)} />
              <FormControl size="small"><InputLabel>Engine</InputLabel><Select label="Engine" value={form.details.engine || "upto_1600"} onChange={(e) => F("engine", e.target.value)}><MenuItem value="upto_1600">Up to 1.6 litres</MenuItem><MenuItem value="above_1600">Above 1.6 litres</MenuItem></Select></FormControl>
              <FormControl size="small"><InputLabel>Use</InputLabel><Select label="Use" value={form.details.usage || "mixed"} onChange={(e) => F("usage", e.target.value)}><MenuItem value="mixed">Official and personal</MenuItem><MenuItem value="official">Official only (logbook kept)</MenuItem></Select></FormControl>
              <FormControlLabel control={<Checkbox checked={!!form.details.driver} onChange={(e) => F("driver", e.target.checked)} />} label="Driver provided" />
            </>)}
            {form.type === "accommodation" && (<>
              <TextField size="small" label="Address" value={form.details.address || ""} onChange={(e) => F("address", e.target.value)} />
              <TextField size="small" type="number" label="Lease rent (₹/month)" value={form.details.rent || ""} onChange={(e) => F("rent", e.target.value)} />
              <TextField size="small" type="number" label="Recovered from employee (₹/month)" value={form.details.recovery || ""} onChange={(e) => F("recovery", e.target.value)} />
            </>)}
            {form.type === "loan" && (<>
              <TextField size="small" type="number" label="Outstanding principal (₹)" value={form.details.outstanding || ""} onChange={(e) => F("outstanding", e.target.value)} />
              <TextField size="small" type="number" label="Interest charged (%)" value={form.details.rate ?? ""} onChange={(e) => F("rate", e.target.value)} />
            </>)}
            {form.type === "gift" && (<>
              <TextField size="small" label="Description" value={form.details.name || ""} onChange={(e) => F("name", e.target.value)} />
              <TextField size="small" type="number" label="Value in the year (₹)" value={form.details.annual || ""} onChange={(e) => F("annual", e.target.value)} />
            </>)}
            {form.type === "esop" && (<>
              <TextField size="small" label="Grant" value={form.details.grant || ""} onChange={(e) => F("grant", e.target.value)} />
              <TextField size="small" type="number" label="Shares allotted" value={form.details.shares || ""} onChange={(e) => F("shares", e.target.value)} />
              <TextField size="small" type="number" label="Fair market value per share (₹)" value={form.details.fmv || ""} onChange={(e) => F("fmv", e.target.value)} />
              <TextField size="small" type="number" label="Exercise price per share (₹)" value={form.details.exercise || ""} onChange={(e) => F("exercise", e.target.value)} />
            </>)}
            {["club", "other"].includes(form.type) && (<>
              <TextField size="small" label="Description" value={form.details.name || ""} onChange={(e) => F("name", e.target.value)} />
              <TextField size="small" type="number" label="Value (₹/month)" value={form.details.monthly || ""} onChange={(e) => F("monthly", e.target.value)} />
            </>)}
            <TextField size="small" type="date" label="From" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <Box sx={{ p: 1.2, borderRadius: 1, bgcolor: "sunk.main" }}><Typography variant="body2">Taxable value: <b>{fmtMoney(preview)}</b> a month</Typography></Box>
          </Stack>
        )}
      </ConfirmDialog>
      <ConfirmDialog open={!!end} title="End perquisite" confirmLabel="End" tone="error" onClose={() => setEnd(null)} onConfirm={() => { const r = endPerk(end.id, end.to); notifyToast(r.ok ? "Perquisite ended." : r.error, r.ok ? "success" : "error"); setEnd(null); }}>
        {end && <TextField size="small" type="date" label="Last day" value={end.to} onChange={(e) => setEnd({ ...end, to: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />}
      </ConfirmDialog>
    </Stack>
  );
}

