// v10.3 — Payroll entities & tax registration (/payroll-entities).
// Frozen defaults per company and location (country, currency, tax engine, default language), the payroll registration
// mode of every legal entity (central / location-wise / hybrid), the payroll groups that mode produces — "possibilities" —
// with registrations, authorities and warnings, and this month's run split by payroll group in local currency.
import React, { useMemo, useState } from "react";
import { MenuItem, Alert, Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { AccountBalanceRounded, ApartmentRounded, GavelRounded, WarningAmberRounded, DownloadRounded, EditRounded, LockRounded, TranslateRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { ModuleHub, money, tabSx, useWho, C } from "../../components/suite/Hub.jsx";
import { SectionCard, Tag, TableWrap, Mono, EmptyState } from "../../components/kit/UI.jsx";
import { AiInsight } from "../../components/ai/AiInsight.jsx";
import { PAYROLL_MODES, MODE_BY, payrollGroups, regFieldsFor, isRegistered, entityProfile, groupOfLocation } from "../../lib/statutory.js";
import { computeRun, bankFileRows, formsFor } from "../../lib/suitePayroll.js";
import { COUNTRIES } from "../../lib/payroll/index.js";
import { PACKS } from "../../country/countryPacks.js";
import { downloadCsv, isoDate } from "../../lib/utils.js";
import { useCountry } from "../../country/CountryContext.jsx";
import { ALL } from "../../data/entities.js";
import { OFFLINE_LANGUAGES, NATIVE, hasOffline } from "../../country/i18nOffline.js";

const KIND = {
  central: ["Head-office payroll", "navy"],
  location: ["Own registration", "good"],
  foreign: ["Local payroll (other country)", "info"],
  unregistered_foreign: ["Needs local registration / EOR", "bad"],
  location_unregistered: ["Not registered", "warn"],
};
const kindTone = (k) => ({ navy: "accent", good: "good", info: "info", bad: "bad", warn: "warn" })[KIND[k]?.[1]] || "neutral";

export default function PayrollEntities() {
  const store = useStore();
  const { data, setPayrollMode, saveRegistration, setStatutorySettings, setLocationLanguage, canEditStatutory, notifyToast, user } = store;
  const { isSuper, lens } = useWho();
  const [tab, setTab] = useState("groups");
  const [edit, setEdit] = useState(null);
  const canEdit = canEditStatutory();
  // Follows the header: selected legal entity, location and country (e.g. ONAS Middle East + UAE → Dubai only).
  const { entityScope } = store;
  const { country: hdrCountry } = useCountry();
  const inScope = (l) => (!entityScope || entityScope.company === ALL || l.company_id === entityScope.company)
    && (!entityScope || entityScope.location === ALL || l.location_id === entityScope.location)
    && (!hdrCountry || l.country === hdrCountry);
  const locations = (data.workLocations || []).filter(inScope);
  const locIds = new Set(locations.map((l) => l.location_id));
  const groups = useMemo(() => payrollGroups(data).filter((g) => g.locations.some((l) => locIds.has(l.location_id))).map((g) => ({ ...g, locations: g.locations.filter((l) => locIds.has(l.location_id)), employees: g.employees.filter((e) => locIds.has(e.location_id)) })), [data, entityScope, hdrCountry]); // eslint-disable-line react-hooks/exhaustive-deps
  const companies = (data.companies || []).filter((c) => c.status !== "inactive" && locations.some((l) => l.company_id === c.company_id));
  const scopeLabel = [entityScope?.company !== ALL && companies[0]?.short, entityScope?.location !== ALL && locations[0]?.name, hdrCountry && COUNTRIES[hdrCountry]?.name].filter(Boolean).join(" · ");
  const warnings = groups.flatMap((g) => g.warnings.map((w) => ({ g, w })));
  const registered = locations.filter(isRegistered).length;
  const run = useMemo(() => { try { const r = computeRun(data); return { ...r, rows: r.rows.filter((x) => locIds.has(x.e.location_id)) }; } catch { return null; } }, [data, entityScope, hdrCountry]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupOf = (e) => groups.find((g) => g.employees.some((x) => x.employee_code === e.employee_code));
  const byGroup = useMemo(() => {
    const m = {};
    (run?.rows || []).forEach((r) => {
      const g = groupOf(r.e);
      const k = g?.id || "unassigned";
      const b = (m[k] ||= { g, cur: r.cur, people: 0, gross: 0, tax: 0, social: 0, net: 0, er: 0, rows: [] });
      b.people += 1;
      b.rows.push(r);
      if (r.pay) {
        b.gross += r.pay.earned; b.net += r.pay.net; b.er += r.pay.employerTotal || 0;
        r.pay.deductions.forEach(([k2, v]) => { if (/tax|PAYE|TDS|PCB|ISR|IRRF|Lohnsteuer|Prélèvement|USC|PPh|withholding/i.test(k2)) b.tax += Number(v) || 0; else b.social += Number(v) || 0; });
      }
    });
    return Object.values(m);
  }, [run, groups]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = (r, msg) => { if (r?.ok) notifyToast(msg); else notifyToast(r?.error || "Could not save.", "error"); };
  const lock = data.settings.lock_country_to_location !== false;
  const facts = [
    `${companies.length} legal entities, ${locations.length} locations, ${registered} locations with their own statutory registration`,
    ...companies.map((c) => `${c.short}: payroll mode ${MODE_BY[c.payroll_mode || "central"].short}; ${groups.filter((g) => g.company.company_id === c.company_id).length} payroll group(s)`),
    ...warnings.slice(0, 8).map(({ g, w }) => `Warning for ${g.label}: ${w}`),
    `Country & currency locked to work location: ${lock ? "yes" : "no"}; default language ${data.settings.default_language || "English"}`,
  ];

  return (
    <ModuleHub
      eyebrow={`PAY & BENEFITS · LOCAL TAX COMPLIANCE · ${lens}${scopeLabel ? ` · ${scopeLabel.toUpperCase()}` : ""}`}
      title="Payroll entities & tax registration"
      subtitle="Country, currency and language follow each person's legal entity and registered location. Choose how every company runs payroll — one central payroll, one per registered location, or a hybrid — and see every payroll group that produces, with its registration, authorities and this month's taxes in local currency."
      tabs={[["groups", "Payroll groups"], ["modes", "Registration modes"], ["defaults", "Frozen defaults"], ["run", "This month by group"]]}
      tab={tab}
      onTab={setTab}
      brief={{
        text: warnings.length ? <>Found <b>{warnings.length} registration gap{warnings.length > 1 ? "s" : ""}</b> across {new Set(warnings.map((x) => x.g.id)).size} payroll group(s). Fix them before the next run so taxes are paid under the right registration.</> : <>All <b>{groups.length} payroll groups</b> have their registrations. Taxes, TDS and payslips are computed per group in local currency.</>,
        actions: [["Payroll groups", () => setTab("groups")], ["This month", () => setTab("run")]],
        ask: `Review our payroll registration setup and suggest the best mode for each company. ${facts.join(". ")}`,
      }}
      kpis={[
        { label: "Legal entities", value: companies.length, icon: <ApartmentRounded />, hint: `${locations.length} locations` },
        { label: "Payroll groups", value: groups.length, icon: <AccountBalanceRounded />, tone: "mint", hint: "separate runs & filings" },
        { label: "Registered locations", value: `${registered}/${locations.length}`, icon: <GavelRounded />, tone: "glob", hint: "own tax registration" },
        { label: "Gaps", value: warnings.length, icon: <WarningAmberRounded />, tone: warnings.length ? "bad" : "mint", hint: warnings.length ? "need attention" : "none" },
      ]}
    >
      {tab === "groups" && (
        <Stack spacing={2}>
          {warnings.length > 0 && (
            <Alert severity="warning" sx={{ fontSize: "0.68rem" }}>
              {warnings.slice(0, 6).map(({ g, w }, i) => <div key={i}><b>{g.label}:</b> {w}</div>)}
            </Alert>
          )}
          {companies.map((c) => {
            const gs = groups.filter((g) => g.company.company_id === c.company_id);
            return (
              <SectionCard key={c.company_id} title={`${c.short} · ${c.name}`} subtitle={`${MODE_BY[c.payroll_mode || "central"].label} · ${gs.length} payroll group${gs.length === 1 ? "" : "s"} · ${COUNTRIES[c.country]?.name || c.country} (${c.currency})`} action={<Tag tone="accent">{MODE_BY[c.payroll_mode || "central"].short}</Tag>} noPad>
                <TableWrap>
                  <Table size="small" sx={{ minWidth: 880 }}>
                    <TableHead><TableRow><TableCell>Payroll group</TableCell><TableCell>Country · currency</TableCell><TableCell>Locations</TableCell><TableCell align="right">On payroll</TableCell><TableCell>Registration</TableCell><TableCell>Pays to</TableCell>{canEdit && <TableCell />}</TableRow></TableHead>
                    <TableBody>
                      {gs.map((g) => (
                        <TableRow key={g.id} hover>
                          <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{g.label}</Typography><Tag tone={kindTone(g.kind)}>{KIND[g.kind]?.[0]}</Tag></TableCell>
                          <TableCell>{PACKS[g.country]?.flag} {COUNTRIES[g.country]?.name || g.country} · <b>{g.currency}</b></TableCell>
                          <TableCell sx={{ maxWidth: 200 }}><Typography sx={{ fontSize: "0.62rem" }}>{g.locations.map((l) => l.name).join(", ")}</Typography></TableCell>
                          <TableCell align="right">{g.employees.length}</TableCell>
                          <TableCell sx={{ maxWidth: 260 }}>
                            {regFieldsFor(g.country).map(([k, l]) => (
                              <Typography key={k} sx={{ fontSize: "0.58rem", color: g.registration[k] ? "text.primary" : "error.main" }} noWrap>{l.replace(/ \(.*\)/, "")}: {g.registration[k] ? <Mono>{g.registration[k]}</Mono> : "missing"}</Typography>
                            ))}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 200 }}><Typography sx={{ fontSize: "0.6rem", color: "text.secondary" }}>{g.authorities.slice(0, 3).join(", ")}</Typography></TableCell>
                          {canEdit && <TableCell><Button size="small" startIcon={<EditRounded />} onClick={() => setEdit({ level: "location", rec: g.registrationAt })}>Registration</Button></TableCell>}
                        </TableRow>
                      ))}
                      {!gs.length && <TableRow><TableCell colSpan={7}><EmptyState title="No active locations" text="Add a location under Companies & locations." /></TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TableWrap>
              </SectionCard>
            );
          })}
        </Stack>
      )}

      {tab === "modes" && (
        <Stack spacing={2}>
          <Grid3>
            {PAYROLL_MODES.map((m) => (
              <Card key={m.id} sx={{ p: 2 }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", color: C.navy }}>{m.label}</Typography>
                <Typography sx={{ fontSize: "0.66rem", color: "text.secondary", mt: 0.6 }}>{m.text}</Typography>
              </Card>
            ))}
          </Grid3>
          {companies.map((c) => {
            // Possibilities: what each mode would produce for this company.
            const sim = PAYROLL_MODES.map((m) => {
              const cc = { ...c, payroll_mode: m.id };
              const ls = locations.filter((l) => l.company_id === c.company_id && l.status !== "inactive");
              const ids = new Set(ls.map((l) => groupOfLocation(l, cc, locations)?.id));
              const gaps = ls.filter((l) => { const g = groupOfLocation(l, cc, locations); return g && ["unregistered_foreign", "location_unregistered"].includes(g.kind); }).length;
              return { m, runs: ids.size, gaps };
            });
            const best = [...sim].sort((a, b) => a.gaps - b.gaps || a.runs - b.runs)[0];
            return (
              <SectionCard key={c.company_id} title={`${c.short}`} subtitle={`${locations.filter((l) => l.company_id === c.company_id).length} locations · ${locations.filter((l) => l.company_id === c.company_id && isRegistered(l)).length} registered on their own`} action={
                <ToggleButtonGroup size="small" exclusive value={c.payroll_mode || "central"} onChange={(_, v) => v && (canEdit ? act(setPayrollMode(c.company_id, v), `${c.short} now runs ${MODE_BY[v].short.toLowerCase()} payroll.`) : notifyToast("Only Finance (payroll) or a Super Admin can change this.", "info"))}>
                  {PAYROLL_MODES.map((m) => <ToggleButton key={m.id} value={m.id} sx={{ fontSize: "0.62rem", px: 1.2, py: 0.4 }}>{m.short}</ToggleButton>)}
                </ToggleButtonGroup>
              }>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Possibility</TableCell><TableCell align="right">Payroll runs / filings per month</TableCell><TableCell align="right">Registration gaps</TableCell><TableCell /></TableRow></TableHead>
                  <TableBody>
                    {sim.map((x) => (
                      <TableRow key={x.m.id} selected={(c.payroll_mode || "central") === x.m.id}>
                        <TableCell>{x.m.label}</TableCell>
                        <TableCell align="right">{x.runs}</TableCell>
                        <TableCell align="right">{x.gaps ? <Tag tone="warn">{x.gaps}</Tag> : <Tag tone="good">0</Tag>}</TableCell>
                        <TableCell>{x === best && <Tag tone="info">AI suggests</Tag>}{(c.payroll_mode || "central") === x.m.id && <Tag tone="accent" sx={{ ml: 0.5 }}>Current</Tag>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", mt: 1 }}>Locations outside {COUNTRIES[c.country]?.name} always run their own local payroll in local currency, whatever the mode. Company-level numbers: {regFieldsFor(c.country).filter(([, , lv]) => lv === "company").map(([k, l]) => `${l}: ${c.statutory?.[k] || "—"}`).join(" · ") || "none"} {canEdit && <Button size="small" onClick={() => setEdit({ level: "company", rec: c })}>Edit</Button>}</Typography>
              </SectionCard>
            );
          })}
        </Stack>
      )}

      {tab === "defaults" && (
        <Stack spacing={2}>
          <SectionCard title="Frozen defaults" subtitle="Country, currency and tax engine are not picked per person: they follow the legal entity and the registered work location. Language defaults to English; each location's local language is listed first in the header language dropdown and works offline (built-in translations), with AI filling in the rest when connected.">
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
              <FormControlLabel control={<Switch checked={lock} disabled={!isSuper} onChange={(e) => act(setStatutorySettings({ lock_country_to_location: e.target.checked }), e.target.checked ? "Country and currency now follow each person's location." : "Country can be set by hand again.")} />} label={<Typography sx={{ fontSize: "0.7rem", fontWeight: 600 }}><LockRounded sx={{ fontSize: 14, verticalAlign: "middle" }} /> Lock country & currency to work location</Typography>} />
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><TranslateRounded sx={{ fontSize: 16, color: C.navy }} /><Typography sx={{ fontSize: "0.7rem" }}>Default language: <b>{data.settings.default_language || "English"}</b></Typography></Stack>
              {!isSuper && <Typography sx={{ fontSize: "0.6rem", color: "text.secondary" }}>Only a Super Admin can change these.</Typography>}
            </Stack>
          </SectionCard>
          <SectionCard title="By location" noPad>
            <TableWrap>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead><TableRow><TableCell>Location</TableCell><TableCell>Legal entity</TableCell><TableCell>Country</TableCell><TableCell>Currency</TableCell><TableCell>Tax / payroll engine</TableCell><TableCell>Tax year</TableCell><TableCell>Default · local language</TableCell><TableCell align="right">Staff</TableCell></TableRow></TableHead>
                <TableBody>
                  {locations.map((l) => {
                    const c = companies.find((x) => x.company_id === l.company_id);
                    const p = PACKS[l.country] || {};
                    const p2 = entityProfile({ location_id: l.location_id }, data);
                    return (
                      <TableRow key={l.location_id} hover>
                        <TableCell><Typography sx={{ fontSize: "0.68rem", fontWeight: 700 }}>{l.name}</Typography><Mono>{l.location_id}</Mono></TableCell>
                        <TableCell>{c?.short || l.company_id}{p2.crossBorder && <Tag tone="info" sx={{ ml: 0.5 }}>cross-border</Tag>}</TableCell>
                        <TableCell>{p.flag} {COUNTRIES[l.country]?.name || l.country}</TableCell>
                        <TableCell><b>{COUNTRIES[l.country]?.currency}</b> {p.symbol}</TableCell>
                        <TableCell>{p2.engine}</TableCell>
                        <TableCell>{p.taxYear || "—"}</TableCell>
                        <TableCell sx={{ minWidth: 220 }}>
                          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                            <Typography sx={{ fontSize: "0.6rem", whiteSpace: "nowrap" }}><b>English</b> ·</Typography>
                            <TextField select size="small" value={l.local_language || (p.languages || [])[0] || ""} disabled={!(canEdit || (user?.modules || []).includes("accounts"))} onChange={(e) => act(setLocationLanguage(l.location_id, e.target.value), `${l.name}: local language ${e.target.value}.`)} sx={{ minWidth: 150, "& .MuiInputBase-input": { fontSize: "0.62rem", py: 0.5 } }}>
                              {[...new Set([...(p.languages || []), ...OFFLINE_LANGUAGES, l.local_language].filter(Boolean))].map((x) => <MenuItem key={x} value={x} sx={{ fontSize: "0.68rem" }}>{NATIVE[x] && NATIVE[x] !== x ? `${NATIVE[x]} · ${x}` : x}{hasOffline(x) ? "" : " (AI)"}</MenuItem>)}
                            </TextField>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{data.employees.filter((e) => e.location_id === l.location_id && e.status === "active").length}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrap>
          </SectionCard>
        </Stack>
      )}

      {tab === "run" && (
        <Stack spacing={2}>
          <AiInsight title="AI · this month's taxes by payroll group" facts={[...facts, ...byGroup.map((b) => `${b.g?.label || "Unassigned"}: ${b.people} people, gross ${money(b.gross, b.cur)}, income tax ${money(b.tax, b.cur)}, social ${money(b.social, b.cur)}, net ${money(b.net, b.cur)}`)]} audience="the Finance team that files and pays these taxes" />
          <SectionCard title={`Payroll for ${run ? new Date(`${run.period}-01T12:00:00`).toLocaleString("en", { month: "long", year: "numeric" }) : "this month"} by payroll group`} subtitle="Local currency of each group. Taxes and contributions are paid to the authority of the group's registration; payslips are generated from the same engine." noPad>
            <TableWrap>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead><TableRow><TableCell>Payroll group</TableCell><TableCell align="right">People</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right">Income tax / TDS</TableCell><TableCell align="right">Social & pension</TableCell><TableCell align="right">Net pay</TableCell><TableCell>Returns</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>
                  {byGroup.map((b) => (
                    <TableRow key={b.g?.id || "u"} hover>
                      <TableCell><Typography sx={{ fontSize: "0.68rem", fontWeight: 700 }}>{b.g?.label || "Not in a payroll group"}</Typography><Typography sx={{ fontSize: "0.58rem", color: "text.secondary" }}>{b.g ? `${COUNTRIES[b.g.country]?.name} · ${b.cur}` : "Assign a location"}</Typography></TableCell>
                      <TableCell align="right">{b.people}</TableCell>
                      <TableCell align="right">{money(b.gross, b.cur)}</TableCell>
                      <TableCell align="right">{money(b.tax, b.cur)}</TableCell>
                      <TableCell align="right">{money(b.social, b.cur)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{money(b.net, b.cur)}</TableCell>
                      <TableCell sx={{ maxWidth: 220 }}><Typography sx={{ fontSize: "0.58rem", color: "text.secondary" }}>{formsFor(b.g?.country || "IN").slice(0, 3).map((f) => f[0]).join(" · ")}</Typography></TableCell>
                      <TableCell><Button size="small" startIcon={<DownloadRounded />} onClick={() => {
                        const rows = bankFileRows({ ...run, rows: b.rows }, b.g?.country || b.rows[0]?.code || "IN");
                        downloadCsv(`bank-file-${(b.g?.id || "group").replace(/[^A-Z0-9-]/gi, "_")}-${run.period}.csv`, ["#", "Name", "Bank", "Account", "IFSC / sort / routing", "Currency", "Net", "Narration", "Email"], rows);
                      }}>Bank file</Button></TableCell>
                    </TableRow>
                  ))}
                  {!byGroup.length && <TableRow><TableCell colSpan={8}><EmptyState title="Nobody on payroll" text="Payroll groups fill as soon as active employees are assigned to locations." /></TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableWrap>
          </SectionCard>
        </Stack>
      )}

      {edit && <RegistrationDialog edit={edit} onClose={() => setEdit(null)} onSave={(vals) => { const r = saveRegistration(edit.level, edit.level === "company" ? edit.rec.company_id : edit.rec.location_id, vals); act(r, "Registration saved."); if (r.ok) setEdit(null); }} />}
    </ModuleHub>
  );
}

function Grid3({ children }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0,1fr))" }, gap: 1.5 }}>{children}</Box>;
}

function RegistrationDialog({ edit, onClose, onSave }) {
  const { rec, level } = edit;
  const fields = regFieldsFor(rec.country).filter(([, , lv]) => lv === level || (level === "location"));
  const [vals, setVals] = useState(() => ({ ...(rec.statutory || {}) }));
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Statutory registration · {rec.name || rec.short}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.6} sx={{ pt: 1 }}>
          <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>{COUNTRIES[rec.country]?.name} · {level === "company" ? "company-level numbers apply to every location of the entity" : "a location with its own numbers can run its own payroll (Location-wise or Hybrid mode)"}. Last checked {isoDate()}.</Typography>
          {fields.map(([k, l]) => <TextField key={k} label={l} value={vals[k] || ""} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} />)}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(vals)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
