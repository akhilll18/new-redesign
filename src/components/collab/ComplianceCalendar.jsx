// Compliance calendar: statutory filings from every country payroll engine, company labour-law / licence items and
// custom obligations on one month grid, with owners, filing proof, overdue tracking, .ics export and AI help.
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { ChevronLeftRounded, ChevronRightRounded, AddRounded, EventRounded, DownloadRounded, ForumRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { useCountry } from "../../country/CountryContext.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Tag, TableWrap, EmptyState, KeyVal } from "../kit/UI.jsx";
import { AiInsight } from "../ai/AiInsight.jsx";
import { openCopilot } from "../ai/AiText.jsx";
import { AiButton, AiResult, useAiRun } from "./aiKit.jsx";
import { complianceCalendar, COMPLIANCE_STATUS, COMPLIANCE_CATEGORY, canManageCompliance } from "../../lib/collab.js";
import { COUNTRIES } from "../../lib/payroll/index.js";
import { countriesIn } from "../../country/countryPacks.js";
import { fmtDate, isoDate, DAY, fmtNum } from "../../lib/utils.js";

const STATUS_COLOR = { overdue: "#B0291F", due_soon: "#C77B1C", in_progress: "#2C4B8F", upcoming: "#5c675f", filed: "#1D7A42", waived: "#9aa39c" };
const flag = (cc) => (cc === "ALL" ? "🌐" : cc ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : "");

export function downloadIcs(filename, events) {
  const esc = (s) => String(s || "").replace(/[,;\\]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const dt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EZY HR by Ezyo//EN", "CALSCALE:GREGORIAN"];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${esc(e.uid)}@peoplehub`, `DTSTAMP:${dt(new Date().toISOString())}`);
    if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${isoDate(new Date(`${e.date}T12:00:00`).getTime() + DAY).replace(/-/g, "")}`);
    else lines.push(`DTSTART:${dt(e.start)}`, `DTEND:${dt(e.end)}`);
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.alarmDays) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-P${e.alarmDays}D`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function ComplianceCalendarPage() {
  const { data, user, nameOf } = useStore();
  const { country, region } = useCountry();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 12); });
  const [view, setView] = useState("month");
  const [cc, setCc] = useState(country || (region ? `REGION:${region}` : ""));
  const [cat, setCat] = useState("");
  const [st, setSt] = useState("");
  const [mine, setMine] = useState(false);
  const [open, setOpen] = useState(null);
  const [add, setAdd] = useState(null);
  const manage = canManageCompliance(user);
  const countries = cc.startsWith("REGION:") ? countriesIn(cc.slice(7)) : cc ? [cc] : undefined;
  const all = useMemo(() => complianceCalendar(data, { countries }), [data, cc]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = all.filter((i) => (!cat || i.category === cat) && (!st || i.status === st) && (!mine || i.owner === user.code));
  const staffCountries = [...new Set(data.employees.filter((e) => e.status === "active").map((e) => e.country_code || "IN"))];
  const ym = isoDate(month).slice(0, 7);
  const monthItems = items.filter((i) => i.due.startsWith(ym));
  const overdue = all.filter((i) => i.status === "overdue");
  const soon = all.filter((i) => i.status === "due_soon");
  const pastMonth = all.filter((i) => i.due < isoDate() && i.due >= isoDate(Date.now() - 90 * DAY));
  const onTime = pastMonth.filter((i) => i.status === "filed" && i.record.filed_at && i.record.filed_at.slice(0, 10) <= i.due).length;
  const facts = [
    `${overdue.length} overdue: ${overdue.map((i) => `${i.title} (${i.country}, due ${i.due}, owner ${nameOf(i.owner)})`).join("; ") || "none"}`,
    `${soon.length} due in the next 7 days: ${soon.map((i) => `${i.title} (${i.country}, ${i.due})`).join("; ") || "none"}`,
    `On-time filing rate over the last 90 days: ${pastMonth.length ? Math.round((onTime / pastMonth.length) * 100) : 100}% (${onTime} of ${pastMonth.length})`,
    `This month: ${monthItems.length} obligations, ${monthItems.filter((i) => i.status === "filed").length} filed`,
    `Countries covered: ${(countries || staffCountries).join(", ")}`,
  ];
  const exportIcs = () => downloadIcs(`compliance-${ym}.ics`, items.filter((i) => i.status !== "filed" && i.status !== "waived").map((i) => ({ uid: i.key.replace(/[^a-z0-9]/gi, ""), allDay: true, date: i.due, title: `${flag(i.country)} ${i.title}`, description: `${i.authority} · ${i.freq} · owner ${nameOf(i.owner)}`, alarmDays: 3 })));

  // Month grid
  const first = new Date(month);
  const startPad = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const today = isoDate();

  return (
    <>
      <PageHeader eyebrow="COMPLIANCE · CALENDAR" title="Compliance calendar" subtitle="Every statutory filing from the country payroll engines, labour-law returns, licence renewals, audits and your own obligations — with owners, filing proof and reminders. Confirm dates with your advisers." actions={<Button variant="outlined" startIcon={<DownloadRounded />} onClick={exportIcs}>Add to my calendar (.ics)</Button>} />
      <Stack spacing={2.5}>
        <Grid min={150}>
          <StatCard label="Overdue" value={overdue.length} tone="bad" onClick={() => { setSt("overdue"); setView("list"); }} />
          <StatCard label="Due in 7 days" value={soon.length} tone="warn" onClick={() => { setSt("due_soon"); setView("list"); }} />
          <StatCard label="This month" value={`${monthItems.filter((i) => i.status === "filed").length}/${monthItems.length}`} hint="filed / total" tone="info" />
          <StatCard label="On time (90 days)" value={`${pastMonth.length ? Math.round((onTime / pastMonth.length) * 100) : 100}%`} tone="good" />
          <StatCard label="Assigned to me" value={all.filter((i) => i.owner === user.code && !["filed", "waived"].includes(i.status)).length} tone="neutral" onClick={() => setMine(!mine)} />
        </Grid>
        <AiInsight title="AI compliance brief" audience="the HR / payroll compliance owner" facts={facts} />
        <SectionCard
          title={view === "month" ? month.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "All obligations"}
          action={
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
              {view === "month" && <><IconButton size="small" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}><ChevronLeftRounded /></IconButton><Button size="small" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1, 12)); }}>Today</Button><IconButton size="small" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}><ChevronRightRounded /></IconButton></>}
              <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}><ToggleButton value="month" sx={{ fontSize: "0.6rem", py: 0.3 }}>Month</ToggleButton><ToggleButton value="list" sx={{ fontSize: "0.6rem", py: 0.3 }}>List</ToggleButton></ToggleButtonGroup>
              {manage && <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setAdd({ title: "", authority: "", country: cc && !cc.startsWith("REGION") ? cc : "IN", freq: "Once", due: isoDate(Date.now() + 14 * DAY), category: "custom", owner: user.code, notes: "" })}>Add obligation</Button>}
            </Stack>
          }
        >
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Country</InputLabel><Select label="Country" value={cc} onChange={(e) => setCc(e.target.value)}><MenuItem value="">All countries with staff</MenuItem>{["AMER", "EMEA", "ASIA", "AFRICA"].map((r) => <MenuItem key={r} value={`REGION:${r}`}>Whole {r} region</MenuItem>)}{staffCountries.map((c) => <MenuItem key={c} value={c}>{flag(c)} {COUNTRIES[c]?.name || c}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel>Category</InputLabel><Select label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><MenuItem value="">All categories</MenuItem>{Object.entries(COMPLIANCE_CATEGORY).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Status</InputLabel><Select label="Status" value={st} onChange={(e) => setSt(e.target.value)}><MenuItem value="">Any status</MenuItem>{Object.entries(COMPLIANCE_STATUS).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}</Select></FormControl>
            <Button size="small" variant={mine ? "contained" : "outlined"} onClick={() => setMine(!mine)}>Assigned to me</Button>
          </Stack>
          {view === "month" ? (
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(110px, 1fr))", border: "1px solid #e5eae5", borderRadius: 1.5, overflow: "hidden", minWidth: 770 }}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <Box key={d} sx={{ p: 0.8, fontSize: "0.6rem", fontWeight: 700, color: "#5c675f", background: "#f4f7f3", borderBottom: "1px solid #e5eae5" }}>{d}</Box>)}
                {cells.map((d, i) => {
                  const date = d ? `${ym}-${String(d).padStart(2, "0")}` : null;
                  const list = date ? monthItems.filter((x) => x.due === date) : [];
                  return (
                    <Box key={i} sx={{ minHeight: 104, p: 0.6, borderRight: (i + 1) % 7 ? "1px solid #eef1ee" : 0, borderBottom: "1px solid #eef1ee", background: !d ? "#fafbfa" : date === today ? "#eef7f2" : "#fff" }}>
                      {d && <Typography sx={{ fontSize: "0.6rem", fontWeight: date === today ? 800 : 600, color: date === today ? "#1D7A42" : "#5c675f", mb: 0.4 }}>{d}</Typography>}
                      <Stack spacing={0.4}>
                        {list.slice(0, 4).map((x) => (
                          <Tooltip key={x.key} title={`${x.title} · ${x.authority} · ${COMPLIANCE_STATUS[x.status].label}`}>
                            <Box onClick={() => setOpen(x.key)} sx={{ cursor: "pointer", fontSize: "0.55rem", lineHeight: 1.25, px: 0.5, py: 0.3, borderRadius: 0.8, borderLeft: `3px solid ${STATUS_COLOR[x.status]}`, background: `${STATUS_COLOR[x.status]}14`, color: "#26302a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: x.status === "filed" ? "line-through" : "none", opacity: x.status === "filed" || x.status === "waived" ? 0.7 : 1 }}>
                              {flag(x.country)} {x.title}
                            </Box>
                          </Tooltip>
                        ))}
                        {list.length > 4 && <Typography onClick={() => { setView("list"); }} sx={{ fontSize: "0.52rem", color: "#2C4B8F", cursor: "pointer" }}>+{list.length - 4} more</Typography>}
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
              <Stack direction="row" sx={{ gap: 1.5, mt: 1, flexWrap: "wrap" }}>{Object.entries(COMPLIANCE_STATUS).map(([k, v]) => <Stack key={k} direction="row" sx={{ alignItems: "center", gap: 0.5 }}><Box sx={{ width: 10, height: 10, borderRadius: 0.5, background: STATUS_COLOR[k] }} /><Typography sx={{ fontSize: "0.56rem", color: "#5c675f" }}>{v.label}</Typography></Stack>)}</Stack>
            </Box>
          ) : (
            <TableWrap>
              <Table size="small" sx={{ minWidth: 960 }}>
                <TableHead><TableRow><TableCell>Due</TableCell><TableCell>Obligation</TableCell><TableCell>Country</TableCell><TableCell>Authority</TableCell><TableCell>Frequency</TableCell><TableCell>Owner</TableCell><TableCell>Status</TableCell><TableCell>Reference</TableCell></TableRow></TableHead>
                <TableBody>
                  {items.filter((i) => !st || i.status === st).slice(0, 300).map((x) => (
                    <TableRow key={x.key} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(x.key)}>
                      <TableCell sx={{ whiteSpace: "nowrap", fontWeight: x.status === "overdue" ? 700 : 400, color: x.status === "overdue" ? "error.main" : undefined }}>{fmtDate(x.due)}<Typography sx={{ fontSize: "0.55rem", color: "#78827b" }}>{x.status === "filed" ? "" : x.daysLeft < 0 ? `${-x.daysLeft} days late` : x.daysLeft === 0 ? "today" : `in ${x.daysLeft} days`}</Typography></TableCell>
                      <TableCell><Typography sx={{ fontSize: "0.68rem", fontWeight: 600 }}>{x.title}</Typography><Typography sx={{ fontSize: "0.55rem", color: "#78827b" }}>{COMPLIANCE_CATEGORY[x.category]}</Typography></TableCell>
                      <TableCell>{flag(x.country)} {x.country}</TableCell>
                      <TableCell sx={{ fontSize: "0.62rem" }}>{x.authority}</TableCell>
                      <TableCell>{x.freq}</TableCell>
                      <TableCell>{x.owner ? nameOf(x.owner) : "—"}</TableCell>
                      <TableCell><Tag tone={COMPLIANCE_STATUS[x.status].tone}>{COMPLIANCE_STATUS[x.status].label}</Tag></TableCell>
                      <TableCell sx={{ fontSize: "0.6rem" }}>{x.record.ref || ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
          {!items.length && <EmptyState title="Nothing here" text="No obligations match these filters." />}
        </SectionCard>
      </Stack>
      <ComplianceItemDialog item={all.find((i) => i.key === open)} onClose={() => setOpen(null)} manage={manage} />
      <AddItemDialog value={add} onClose={() => setAdd(null)} />
    </>
  );
}

function ComplianceItemDialog({ item, onClose, manage }) {
  const { data, nameOf, setComplianceStatus, deleteComplianceItem, notifyToast } = useStore();
  const [f, setF] = useState(null);
  const ai = useAiRun();
  React.useEffect(() => { if (item) { setF({ ref: item.record.ref || "", amount: item.record.amount || "", notes: item.record.notes || item.notes || "", owner: item.owner || "" }); ai.clear(); } }, [item?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!item || !f) return null;
  const owners = [...data.admins.filter((a) => a.status === "active" && a.modules.some((m) => ["compliance", "payroll"].includes(m))), ...data.superAdmins];
  const act = (status) => {
    const r = setComplianceStatus(item.key, { status, ref: f.ref, amount: f.amount ? Number(f.amount) : undefined, notes: f.notes, owner: f.owner });
    if (!r.ok) return notifyToast(r.error, "error");
    notifyToast(status === "filed" ? "Marked as filed." : status === "waived" ? "Marked not applicable." : status === "in_progress" ? "Marked in progress." : "Saved.");
    onClose();
  };
  const offline = () => {
    const steps = item.category === "statutory"
      ? ["Lock the payroll for the period and export the statutory register.", `Reconcile employee and employer amounts with the payroll ${item.country === "IN" ? "(PF / ESI / PT / TDS)" : ""} totals.`, `Prepare the return / challan on the ${item.authority} portal.`, "Get maker-checker approval from Finance.", "Pay and file before the due date; download the acknowledgement.", "Record the acknowledgement number here and attach the receipt in Documents."]
      : item.category === "licence"
        ? ["Check the current registration certificate and its expiry.", "Update headcount, address and signatory details.", `Submit the renewal application to ${item.authority} with the fee.`, "Record the application / receipt number here.", "Display the renewed certificate at the premises."]
        : ["Collect the data or evidence the return needs.", "Draft the return or report and have the owner review it.", `Submit to ${item.authority}.`, "Record the reference here and file a copy in Documents."];
    return `**${item.title}** – due ${fmtDate(item.due)} (${item.daysLeft < 0 ? `${-item.daysLeft} days late` : `${item.daysLeft} days left`}).\n\n**Checklist**\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n${item.status === "overdue" ? "**It is overdue:** file immediately; interest or late fees may apply – check with your adviser and record the reason for the delay." : "**Tip:** start 3 working days before the due date to leave time for approvals."}`;
  };
  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{flag(item.country)} {item.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}><Tag tone={COMPLIANCE_STATUS[item.status].tone}>{COMPLIANCE_STATUS[item.status].label}</Tag><Typography variant="caption" color="text.secondary">{item.source === "engine" ? "From the payroll engine filing calendar" : item.source === "company" ? "Company statutory item" : "Custom obligation"}</Typography></Stack>
          <KeyVal cols={2} items={[["Due", `${fmtDate(item.due)}${item.status !== "filed" ? ` · ${item.daysLeft < 0 ? `${-item.daysLeft} days late` : `${item.daysLeft} days left`}` : ""}`], ["Authority", item.authority], ["Country", `${COUNTRIES[item.country]?.name || item.country}`], ["Frequency", item.freq], ["Category", COMPLIANCE_CATEGORY[item.category]], ["Filed", item.record.filed_at ? `${fmtDate(item.record.filed_at)} by ${nameOf(item.record.filed_by)}` : "—"]]} />
          <Stack direction="row" spacing={1}>
            <AiButton busy={ai.busy} onClick={() => ai.run({ task: "compliance-steps", instruction: "Give a practical filing checklist for this obligation (5–7 numbered steps), the documents needed, and the risk of filing late. Say that dates and rates must be confirmed with a local adviser.", input: JSON.stringify({ title: item.title, authority: item.authority, country: item.country, due: item.due, freq: item.freq, status: item.status }), offline: offline() })}>AI filing checklist</AiButton>
            <Button size="small" startIcon={<ForumRounded />} onClick={() => openCopilot(`Explain the ${item.title} obligation for ${COUNTRIES[item.country]?.name || item.country} (authority ${item.authority}, due ${item.due}). What do we need to file and what happens if it is late?`)}>Ask the copilot</Button>
          </Stack>
          <AiResult ai={ai} title="AI filing checklist" />
          {manage ? (
            <>
              <FormControl size="small"><InputLabel>Owner</InputLabel><Select label="Owner" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>{owners.map((o) => <MenuItem key={o.admin_code || o.superadmin_code} value={o.admin_code || o.superadmin_code}>{o.full_name}</MenuItem>)}</Select></FormControl>
              <Stack direction="row" spacing={2}>
                <TextField size="small" fullWidth label="Acknowledgement / challan no." value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} />
                <TextField size="small" label="Amount paid" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} />
              </Stack>
              <TextField size="small" label="Notes" multiline minRows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </>
          ) : (
            <Alert severity="info">You can view this obligation. Owners with the Compliance or Payroll module update it.</Alert>
          )}
          {item.record.amount ? <Typography variant="caption">Amount paid: {fmtNum(item.record.amount)}</Typography> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
        {manage && item.source === "custom" && <Button color="error" sx={{ mr: "auto" }} onClick={() => { deleteComplianceItem(item.key.replace("custom|", "")); notifyToast("Obligation removed."); onClose(); }}>Delete</Button>}
        <Button color="inherit" onClick={onClose}>Close</Button>
        {manage && item.status !== "filed" && <><Button onClick={() => act("waived")}>Not applicable</Button><Button variant="outlined" onClick={() => act("in_progress")}>In progress</Button><Button variant="contained" onClick={() => act("filed")}>Mark filed</Button></>}
        {manage && item.status === "filed" && <Button variant="outlined" onClick={() => act("upcoming")}>Reopen</Button>}
      </DialogActions>
    </Dialog>
  );
}

function AddItemDialog({ value, onClose }) {
  const { data, upsertComplianceItem, notifyToast } = useStore();
  const [f, setF] = useState(null);
  const [error, setError] = useState("");
  React.useEffect(() => { setF(value); setError(""); }, [value]);
  if (!value || !f) return null;
  const owners = [...data.admins.filter((a) => a.status === "active"), ...data.superAdmins];
  return (
    <Dialog open={!!value} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add obligation</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Title *" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <TextField label="Authority / body" value={f.authority} onChange={(e) => setF({ ...f, authority: e.target.value })} />
          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth><InputLabel>Country</InputLabel><Select label="Country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}><MenuItem value="ALL">All countries</MenuItem>{Object.entries(COUNTRIES).map(([k, v]) => <MenuItem key={k} value={k}>{v.name}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" fullWidth><InputLabel>Category</InputLabel><Select label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(COMPLIANCE_CATEGORY).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</Select></FormControl>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField size="small" fullWidth type="date" label="Due *" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <FormControl size="small" fullWidth><InputLabel>Frequency</InputLabel><Select label="Frequency" value={f.freq} onChange={(e) => setF({ ...f, freq: e.target.value })}>{["Once", "Monthly", "Quarterly", "Half-yearly", "Annual"].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl>
          </Stack>
          <FormControl size="small"><InputLabel>Owner</InputLabel><Select label="Owner" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>{owners.map((o) => <MenuItem key={o.admin_code || o.superadmin_code} value={o.admin_code || o.superadmin_code}>{o.full_name}</MenuItem>)}</Select></FormControl>
          <TextField label="Notes" multiline minRows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { const r = upsertComplianceItem(f); if (!r.ok) return setError(r.error); notifyToast("Obligation added; the owner has been notified."); onClose(); }}>Add</Button>
      </DialogActions>
    </Dialog>
  );
}
