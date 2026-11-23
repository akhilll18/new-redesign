// Client & internal meetings: schedule (manually or with AI), agenda, pre-meeting brief, notes → AI minutes and
// action items, follow-up email, client list.
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { AddRounded, CloseRounded, VideocamRounded, PlaceRounded, PhoneRounded, DeleteOutlineRounded, EventRepeatRounded, BusinessRounded } from "@mui/icons-material";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Tag, TableWrap, PersonCell, EmptyState, KeyVal } from "../kit/UI.jsx";
import { AiButton, AiResult, useAiRun } from "./aiKit.jsx";
import { MeetingDialog, AiScheduleDialog } from "./CalendarViews.jsx";
import { identityCodes, directory, fmtTime, fmtDay } from "../../lib/collab.js";
import { fmtDate, isoDate, timeAgo } from "../../lib/utils.js";
import { JoinButton, AddToCalendarButton, ProviderMark, providerLabel } from "./ConferencingUI.jsx";
import { cancelOnlineMeeting, conferencingSettings, providerOf, normalizeLink } from "../../lib/conferencing.js";

const MODE_ICON = { video: <VideocamRounded sx={{ fontSize: 15 }} />, in_person: <PlaceRounded sx={{ fontSize: 15 }} />, phone: <PhoneRounded sx={{ fontSize: 15 }} /> };

/** Employees see only clients they own or have met with; admins see all. */
function useMyClients() {
  const { data, user } = useStore();
  return useMemo(() => {
    if (user.role !== "emp") return data.clients;
    const me = identityCodes(data, user);
    const met = new Set((data.meetings || []).filter((m) => m.client_id && (me.has(m.organizer) || (m.attendees || []).some((c) => me.has(c)))).map((m) => m.client_id));
    return data.clients.filter((c) => me.has(c.owner) || met.has(c.id));
  }, [data, user]);
}

export function useMyMeetings() {
  const { data, user } = useStore();
  return useMemo(() => {
    const me = identityCodes(data, user);
    return (data.meetings || []).filter((m) => user.role === "superadmin" || me.has(m.organizer) || (m.attendees || []).some((c) => me.has(c))).sort((a, b) => a.start.localeCompare(b.start));
  }, [data, user]);
}

// v10.5: Calendar → "Internal meetings" (kind="internal") and "Client meetings" (kind="client") are separate tabs.
export default function MeetingsPage({ kind }) {
  const { data, user, nameOf } = useStore();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState("upcoming");
  const [open, setOpen] = useState(params.get("m"));
  const [newMtg, setNewMtg] = useState(null);
  const [ai, setAi] = useState(null);
  const [aiText, setAiText] = useState("");
  const all = useMyMeetings();
  const list = kind ? all.filter((m) => (kind === "client" ? m.kind === "client" : m.kind !== "client")) : all;
  const myClients = useMyClients();
  const now = new Date().toISOString();
  const me = identityCodes(data, user);
  const upcoming = list.filter((m) => m.end >= now && m.status === "scheduled");
  const past = list.filter((m) => m.end < now || m.status !== "scheduled").reverse();
  const needMinutes = past.filter((m) => m.status !== "cancelled" && !m.minutes && me.has(m.organizer));
  const actions = list.flatMap((m) => (m.action_items || []).map((a, i) => ({ ...a, m, i }))).filter((a) => me.has(a.owner) || me.has(a.m.organizer));
  useEffect(() => { if (params.get("m")) setOpen(params.get("m")); }, [params]);
  return (
    <>
      <PageHeader eyebrow="COLLABORATE · MEETINGS" title={kind === "client" ? "Client meetings" : kind === "internal" ? "Internal meetings" : "Meetings"} subtitle="Plan client and internal meetings, let AI draft the agenda and a pre-meeting brief, then turn your notes into minutes, action items and a follow-up email." actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setNewMtg({ kind: kind === "internal" ? "meeting" : "client" })}>New meeting</Button>} />
      <Box data-ai-ui sx={{ mb: 2.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField fullWidth size="small" value={aiText} onChange={(e) => setAiText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && aiText.trim() && setAi(aiText)} placeholder="Describe it: “1 hour demo with Nimbus Health and Vikram next week, video”" />
          <AiButton variant="contained" onClick={() => aiText.trim() && setAi(aiText)} disabled={!aiText.trim()}>Schedule with AI</AiButton>
        </Stack>
      </Box>
      <Stack spacing={2.5}>
        <Grid min={150}>
          <StatCard label="Upcoming" value={upcoming.length} hint={`${upcoming.filter((m) => m.kind === "client").length} with clients`} onClick={() => setTab("upcoming")} />
          <StatCard label="This week" value={upcoming.filter((m) => m.start <= new Date(Date.now() + 7 * 86400000).toISOString()).length} tone="info" />
          <StatCard label="Need minutes" value={needMinutes.length} tone="warn" onClick={() => setTab("past")} />
          <StatCard label="Open action items" value={actions.filter((a) => !a.done).length} tone="bad" onClick={() => setTab("actions")} />
          <StatCard label="Clients" value={myClients.length} tone="neutral" onClick={() => setTab("clients")} />
        </Grid>
        <Box sx={{ borderBottom: "1px solid #e5eae4" }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
            <Tab value="upcoming" label="Upcoming" sx={{ fontSize: "0.7rem" }} />
            <Tab value="past" label="Past & minutes" sx={{ fontSize: "0.7rem" }} />
            <Tab value="actions" label="Action items" sx={{ fontSize: "0.7rem" }} />
            <Tab value="clients" label="Clients" sx={{ fontSize: "0.7rem" }} />
          </Tabs>
        </Box>
        {(tab === "upcoming" || tab === "past") && (
          <SectionCard noPad>
            <TableWrap>
              <Table size="small" sx={{ minWidth: 860 }}>
                <TableHead><TableRow><TableCell>When</TableCell><TableCell>Meeting</TableCell><TableCell>Client</TableCell><TableCell>Format</TableCell><TableCell>People</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {(tab === "upcoming" ? upcoming : past).map((m) => {
                    const c = data.clients.find((k) => k.id === m.client_id);
                    return (
                      <TableRow key={m.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(m.id)}>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDay(m.start)}<Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{fmtTime(m.start)}–{fmtTime(m.end)}</Typography></TableCell>
                        <TableCell><Typography sx={{ fontSize: "0.68rem", fontWeight: 700 }}>{m.title}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>Organiser {nameOf(m.organizer)}{m.ai_scheduled ? " · ✨ AI scheduled" : ""}</Typography></TableCell>
                        <TableCell>{c ? <><Typography sx={{ fontSize: "0.66rem", fontWeight: 600 }}>{c.company}</Typography><Typography sx={{ fontSize: "0.55rem", color: "#78827b" }}>{c.contact}</Typography></> : <Tag>Internal</Tag>}</TableCell>
                        <TableCell><Stack direction="row" sx={{ alignItems: "center", gap: 0.6 }}>{m.mode === "video" ? <ProviderMark provider={providerOf(m)} size={16} /> : MODE_ICON[m.mode]}<Typography sx={{ fontSize: "0.6rem" }}>{m.mode === "in_person" ? m.location : m.mode === "video" ? providerLabel(m) : "Phone"}</Typography>{tab === "upcoming" && m.mode === "video" && m.link && <Box onClick={(e) => e.stopPropagation()}><JoinButton m={m} variant="text" /></Box>}</Stack></TableCell>
                        <TableCell sx={{ fontSize: "0.6rem" }}>{[m.organizer, ...m.attendees].map((x) => nameOf(x).split(" ")[0]).join(", ")}</TableCell>
                        <TableCell>{m.status === "cancelled" ? <Tag>Cancelled</Tag> : m.status === "completed" ? <Tag tone="good">Minutes done</Tag> : m.end < now ? <Tag tone="warn">Needs minutes</Tag> : <Tag tone="info">Scheduled</Tag>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrap>
            {!(tab === "upcoming" ? upcoming : past).length && <EmptyState title="No meetings" text="Book one with New meeting or Schedule with AI." />}
          </SectionCard>
        )}
        {tab === "actions" && <ActionItems actions={actions} onOpen={setOpen} />}
        {tab === "clients" && <Clients />}
      </Stack>
      <MeetingDrawer id={open} onClose={() => { setOpen(null); if (params.get("m")) setParams({}); }} />
      <MeetingDialog value={newMtg} onClose={() => setNewMtg(null)} onSaved={(id) => setOpen(id)} />
      <AiScheduleDialog text={ai} onClose={() => setAi(null)} onBooked={(id) => { setAi(null); setAiText(""); if (id) setOpen(id); }} />
    </>
  );
}

function ActionItems({ actions, onOpen }) {
  const { nameOf, toggleActionItem } = useStore();
  const sorted = [...actions].sort((a, b) => Number(a.done) - Number(b.done) || String(a.due || "9").localeCompare(String(b.due || "9")));
  return (
    <SectionCard noPad>
      <Table size="small">
        <TableHead><TableRow><TableCell /><TableCell>Action</TableCell><TableCell>Owner</TableCell><TableCell>Due</TableCell><TableCell>From meeting</TableCell></TableRow></TableHead>
        <TableBody>
          {sorted.map((a) => (
            <TableRow key={`${a.m.id}-${a.i}`} sx={{ opacity: a.done ? 0.55 : 1 }}>
              <TableCell padding="checkbox"><Checkbox checked={!!a.done} onChange={() => toggleActionItem(a.m.id, a.i)} /></TableCell>
              <TableCell sx={{ textDecoration: a.done ? "line-through" : "none" }}>{a.text}</TableCell>
              <TableCell>{a.owner ? nameOf(a.owner) : "—"}</TableCell>
              <TableCell sx={{ color: !a.done && a.due && a.due < isoDate() ? "error.main" : undefined, whiteSpace: "nowrap" }}>{a.due ? fmtDate(a.due) : "—"}</TableCell>
              <TableCell><Button size="small" onClick={() => onOpen(a.m.id)} sx={{ textTransform: "none", fontSize: "0.6rem" }}>{a.m.title}</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!sorted.length && <EmptyState title="No action items" text="Generate them from meeting notes with AI." />}
    </SectionCard>
  );
}

function Clients() {
  const { data, nameOf, upsertClient, notifyToast } = useStore();
  const clients = useMyClients();
  const [dlg, setDlg] = useState(null);
  const [error, setError] = useState("");
  return (
    <SectionCard title="Clients" action={<Button size="small" variant="contained" startIcon={<BusinessRounded />} onClick={() => { setDlg({ company: "", contact: "", email: "", phone: "", city: "", industry: "", stage: "Discovery" }); setError(""); }}>Add client</Button>} noPad>
      <TableWrap>
        <Table size="small" sx={{ minWidth: 820 }}>
          <TableHead><TableRow><TableCell>Company</TableCell><TableCell>Contact</TableCell><TableCell>City</TableCell><TableCell>Stage</TableCell><TableCell>Owner</TableCell><TableCell align="right">Meetings</TableCell><TableCell>Next</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {clients.map((c) => {
              const ms = data.meetings.filter((m) => m.client_id === c.id && m.status !== "cancelled");
              const next = ms.filter((m) => m.start >= new Date().toISOString()).sort((a, b) => a.start.localeCompare(b.start))[0];
              return (
                <TableRow key={c.id}>
                  <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{c.company}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{c.industry}</Typography></TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.66rem" }}>{c.contact}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{c.email}</Typography></TableCell>
                  <TableCell>{c.city}</TableCell>
                  <TableCell><Tag tone={c.stage === "Negotiation" ? "warn" : c.stage === "Onboarding" ? "good" : "info"}>{c.stage}</Tag></TableCell>
                  <TableCell>{nameOf(c.owner)}</TableCell>
                  <TableCell align="right">{ms.length}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{next ? `${fmtDay(next.start)} ${fmtTime(next.start)}` : "—"}</TableCell>
                  <TableCell><Button size="small" onClick={() => { setDlg({ ...c }); setError(""); }}>Edit</Button></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableWrap>
      <Dialog open={!!dlg} onClose={() => setDlg(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{dlg?.id ? "Edit client" : "Add client"}</DialogTitle>
        <DialogContent>
          {dlg && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                {[["company", "Company *"], ["contact", "Contact name *"], ["email", "Email"], ["phone", "Phone"], ["city", "City"], ["industry", "Industry"]].map(([k, l]) => <TextField key={k} size="small" label={l} value={dlg[k] || ""} onChange={(e) => setDlg({ ...dlg, [k]: e.target.value })} />)}
                <FormControl size="small"><InputLabel>Stage</InputLabel><Select label="Stage" value={dlg.stage} onChange={(e) => setDlg({ ...dlg, stage: e.target.value })}>{["Discovery", "Demo", "Proposal", "Negotiation", "Onboarding", "Active", "Lost"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</Select></FormControl>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setDlg(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { const r = upsertClient(dlg); if (!r.ok) return setError(r.error); notifyToast("Client saved."); setDlg(null); }}>Save</Button>
        </DialogActions>
      </Dialog>
    </SectionCard>
  );
}

function extractActions(notes, people, me) {
  const lines = String(notes || "").split(/(?<=[.!?])\s+|\n/).map((s) => s.trim()).filter(Boolean);
  const verbs = /\b(will|to send|send|share|follow up|follow-up|prepare|get|schedule|call|email|review|update|draft|confirm|collect|book|arrange|fix|check|deliver)\b/i;
  const items = [];
  for (const l of lines) {
    if (!verbs.test(l)) continue;
    const owner = people.find((p) => new RegExp(`\\b${p.name.split(" ")[0]}\\b`, "i").test(l));
    const due = /\bfriday\b/i.test(l) ? (() => { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return isoDate(d); })() : /\btomorrow\b/i.test(l) ? isoDate(Date.now() + 86400000) : /\bnext week\b/i.test(l) ? isoDate(Date.now() + 7 * 86400000) : isoDate(Date.now() + 3 * 86400000);
    items.push({ text: l.replace(/^[-•*]\s*/, "").replace(/\.$/, ""), owner: owner?.code || (/(\bI\b|\bwe\b)/i.test(l) ? me : ""), due, done: false });
  }
  return items.slice(0, 8);
}

export function MeetingDrawer({ id, onClose }) {
  const { data, user, nameOf, saveMinutes, cancelMeeting, notifyToast } = useStore();
  const m = id ? data.meetings.find((x) => x.id === id) : null;
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [outcome, setOutcome] = useState("");
  const [edit, setEdit] = useState(null);
  const brief = useAiRun();
  const mins = useAiRun();
  const mail = useAiRun();
  useEffect(() => {
    if (!m) return;
    setNotes(m.notes || "");
    setItems(m.action_items || []);
    setOutcome(m.outcome || "");
    brief.clear(); mins.clear(); mail.clear();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return <Drawer anchor="right" open={false} onClose={onClose} />;
  const client = data.clients.find((c) => c.id === m.client_id);
  const participants = [m.organizer, ...m.attendees];
  const people = directory(data).filter((p) => participants.includes(p.code));
  const isOwner = identityCodes(data, user).has(m.organizer) || user.role === "superadmin";
  const history = client ? data.meetings.filter((x) => x.client_id === client.id && x.id !== m.id && x.status === "completed").sort((a, b) => b.start.localeCompare(a.start)) : [];
  const facts = () => [
    `Meeting: ${m.title} on ${m.start} (${Math.round((new Date(m.end) - new Date(m.start)) / 60000)} min, ${m.mode})`,
    client ? `Client: ${client.company} (${client.industry}, ${client.city}), contact ${client.contact}, stage ${client.stage}, owner ${nameOf(client.owner)}` : "Internal meeting",
    `Participants: ${participants.map(nameOf).join(", ")}`,
    `Agenda: ${m.agenda || "none"}`,
    ...history.slice(0, 3).map((h) => `Previous meeting ${h.start.slice(0, 10)} "${h.title}": ${h.minutes || h.notes || "no minutes"}; open actions: ${(h.action_items || []).filter((a) => !a.done).map((a) => `${a.text} (${nameOf(a.owner)})`).join("; ") || "none"}`),
  ];
  const briefOffline = () => {
    const open = history.flatMap((h) => (h.action_items || []).filter((a) => !a.done).map((a) => `${a.text} – ${nameOf(a.owner)}${a.due ? `, due ${fmtDate(a.due)}` : ""}`));
    return [`**${client ? client.company : m.title} – pre-meeting brief**`, client ? `- **Account:** ${client.industry}, ${client.city}. Stage **${client.stage}**. Main contact ${client.contact} (${client.email}).` : "- Internal meeting.", history.length ? `- **Last meeting (${fmtDate(history[0].start)}):** ${history[0].minutes?.replace(/\*\*/g, "").split("\n").filter(Boolean)[0] || history[0].notes || "no minutes recorded"}` : "- **First recorded meeting** with this client.", open.length ? `- **Open action items:** ${open.join("; ")}` : "- No open action items.", `- **Agenda:** ${m.agenda ? m.agenda.split("\n").map((x) => x.replace(/^\d+\.\s*/, "")).join("; ") : "not set yet – draft one"}`, "", `**Goal for this meeting:** ${client?.stage === "Negotiation" ? "agree commercial terms and a signing date" : client?.stage === "Proposal" ? "walk through the proposal and get a decision timeline" : client?.stage === "Demo" ? "show the 3 features that match their needs and agree a next step" : "align on outcomes and owners"}.`].join("\n");
  };
  const minutesOffline = () => {
    const acts = extractActions(notes, people, user.code);
    const lines = String(notes).split(/(?<=[.!?])\s+|\n/).map((s) => s.trim()).filter(Boolean);
    const decisions = lines.filter((l) => /\b(agree|agreed|decid|confirmed|approved|target|go-live|sign)/i.test(l));
    return { text: [`**Summary:** ${lines.slice(0, 2).join(" ") || "No notes were captured."}`, decisions.length ? `\n**Decisions:**\n${decisions.map((d) => `- ${d}`).join("\n")}` : "", acts.length ? `\n**Action items:**\n${acts.map((a) => `- ${a.text} – ${a.owner ? nameOf(a.owner) : "owner to confirm"} (due ${fmtDate(a.due)})`).join("\n")}` : "\n**Action items:** none found – add them below.", client ? `\n**Next step with ${client.company}:** ${acts[0]?.text || "agree the follow-up date."}` : ""].filter(Boolean).join("\n"), acts };
  };
  const runMinutes = async () => {
    const off = minutesOffline();
    const out = await mins.run({ task: "meeting-minutes", instruction: `Turn these raw meeting notes into crisp minutes with **Summary**, **Decisions** and **Action items** (each: action – owner – due date YYYY-MM-DD). Owners must be one of: ${people.map((p) => `${p.name.split(" (")[0]} [${p.code}]`).join(", ")}. After the minutes, output a line ACTIONS_JSON: followed by a JSON array of {"text","owner","due"} using the codes.`, input: `${facts().join("\n")}\n\nRaw notes:\n${notes}`, offline: `${off.text}\n\nACTIONS_JSON: ${JSON.stringify(off.acts)}` });
    const i = out.indexOf("ACTIONS_JSON:");
    if (i >= 0) {
      try {
        const arr = JSON.parse(out.slice(i + 13).trim().replace(/^```json|```$/g, ""));
        if (Array.isArray(arr) && arr.length) setItems(arr.map((a) => ({ text: a.text, owner: participants.includes(a.owner) ? a.owner : "", due: a.due || "", done: false })));
      } catch { /* keep manual items */ }
      mins.setText(out.slice(0, i).trim());
    }
  };
  const mailOffline = () => `Subject: Thank you – ${m.title}\n\nDear ${client?.contact?.split(" ")[0] || "team"},\n\nThank you for your time ${new Date(m.start) < new Date() ? "today" : ""}. A quick recap:\n\n${(mins.text || m.minutes || notes || "").replace(/\*\*/g, "").split("\n").filter((l) => l.trim()).slice(0, 6).join("\n")}\n\n**Next steps**\n${items.map((a) => `- ${a.text}${a.owner ? ` (${nameOf(a.owner).split(" ")[0]})` : ""}${a.due ? ` – by ${fmtDate(a.due)}` : ""}`).join("\n") || "- We will share the next steps shortly."}\n\nPlease let me know if I missed anything.\n\nBest regards,\n${user.full_name}\nONAS Global Services`;
  const save = (complete) => {
    const r = saveMinutes(m.id, { notes, minutes: mins.text || m.minutes, action_items: items, outcome, complete });
    notifyToast(r.ok ? (complete ? "Minutes saved and meeting completed. Owners were notified of their action items." : "Saved.") : r.error, r.ok ? "success" : "error");
  };
  return (
    <Drawer anchor="right" open={!!m} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 680 } } } }}>
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" color="primary">{m.kind === "client" ? "Client meeting" : "Internal meeting"} · {m.id}{m.ai_scheduled ? " · ✨ AI scheduled" : ""}</Typography>
            <Typography variant="h2" sx={{ fontSize: "1.1rem" }}>{m.title}</Typography>
            <Typography variant="caption" color="text.secondary">{fmtDay(m.start)} · {fmtTime(m.start)}–{fmtTime(m.end)} · {m.mode === "in_person" ? m.location : m.mode === "video" ? providerLabel(m) : "Phone"}</Typography>
          </Box>
          {m.status === "cancelled" ? <Tag>Cancelled</Tag> : m.status === "completed" ? <Tag tone="good">Completed</Tag> : <Tag tone="info">Scheduled</Tag>}
          <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
        </Stack>
        <Stack direction="row" sx={{ mt: 1.5, gap: 1, flexWrap: "wrap" }}>
          {m.status === "scheduled" && <JoinButton m={m} />}
          {m.status === "scheduled" && <AddToCalendarButton m={m} data={data} nameOf={nameOf} notify={notifyToast} />}
          {isOwner && m.status === "scheduled" && <Button size="small" variant="outlined" startIcon={<EventRepeatRounded />} onClick={() => setEdit({ ...m })}>Edit / reschedule</Button>}
          {isOwner && m.status === "scheduled" && <Button size="small" color="error" startIcon={<DeleteOutlineRounded />} onClick={async () => { let remote = ""; if (m.external) { try { await cancelOnlineMeeting(conferencingSettings(data), m.external); remote = ` The ${m.external.provider === "teams" ? "Teams" : "Google Meet"} event was cancelled too.`; } catch (e) { remote = ` Couldn't cancel the ${m.external.provider === "teams" ? "Teams" : "Google"} event (${e.message}); cancel it there.`; } } cancelMeeting(m.id, ""); notifyToast(`Meeting cancelled; attendees notified.${remote}`); }}>Cancel</Button>}
        </Stack>
        <Box sx={{ mt: 2 }}>
          <KeyVal items={[["Organiser", nameOf(m.organizer)], ["Attendees", m.attendees.map(nameOf).join(", ") || "—"], m.guests?.length ? ["Guests", m.guests.join(", ")] : null, m.mode === "video" && m.link ? ["Join link", <Box component="a" href={normalizeLink(m.link)} target="_blank" rel="noreferrer" sx={{ display: "block", overflowWrap: "anywhere", color: "#2C4B8F" }}>{normalizeLink(m.link)}</Box>] : null, client ? ["Client", `${client.company} · ${client.contact}`] : null, client ? ["Client email", client.email] : null].filter(Boolean)} />
        </Box>
        {m.agenda && <Box sx={{ mt: 2 }}><Typography variant="caption" color="text.secondary">Agenda</Typography><Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{m.agenda}</Typography></Box>}
        <Stack direction="row" sx={{ mt: 2, gap: 1, flexWrap: "wrap" }}>
          <AiButton busy={brief.busy} onClick={() => brief.run({ task: "meeting-brief", instruction: "Write a short pre-meeting brief: account context, what happened last time, open action items, a goal for this meeting, and 3 smart questions to ask. Bullets, under 180 words.", input: facts().join("\n"), offline: briefOffline() })}>Pre-meeting brief</AiButton>
        </Stack>
        <AiResult ai={brief} title="AI pre-meeting brief" />

        <Typography variant="h3" sx={{ mt: 2.5, mb: 1 }}>Notes & minutes</Typography>
        <TextField fullWidth multiline minRows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Type rough notes during the meeting – who said what, decisions, follow-ups…" />
        <Stack direction="row" sx={{ mt: 1, gap: 1, flexWrap: "wrap" }}>
          <AiButton busy={mins.busy} disabled={!notes.trim()} onClick={runMinutes}>AI minutes & action items</AiButton>
          {m.kind === "client" && <AiButton busy={mail.busy} onClick={() => mail.run({ task: "meeting-followup", instruction: "Write a concise, warm follow-up email to the client: thanks, 3–5 bullet recap, next steps with owners and dates, and a closing line. Include a subject. No internal-only details (pricing approvals, internal opinions).", input: `${facts().join("\n")}\nMinutes: ${mins.text || m.minutes || notes}\nAction items: ${JSON.stringify(items.map((a) => ({ ...a, owner: nameOf(a.owner) })))}`, offline: mailOffline() })}>Follow-up email</AiButton>}
        </Stack>
        <AiResult ai={mins} title="AI minutes" />
        {!mins.text && m.minutes && <Box sx={{ mt: 1, p: 1.2, borderRadius: 1.5, background: "#f6f9f6", fontSize: "0.66rem", whiteSpace: "pre-wrap" }}>{m.minutes.replace(/\*\*/g, "")}</Box>}
        <AiResult ai={mail} title="AI follow-up email" />

        <Stack direction="row" sx={{ mt: 2.5, mb: 1, alignItems: "center" }}><Typography variant="h3" sx={{ flex: 1 }}>Action items</Typography><Button size="small" startIcon={<AddRounded />} onClick={() => setItems([...items, { text: "", owner: user.code, due: isoDate(Date.now() + 3 * 86400000), done: false }])}>Add</Button></Stack>
        <Stack spacing={1}>
          {items.map((a, i) => (
            <Stack key={i} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
              <Checkbox size="small" checked={!!a.done} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} />
              <TextField size="small" fullWidth value={a.text} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="Action" />
              <FormControl size="small" sx={{ minWidth: 140 }}><Select value={a.owner || ""} displayEmpty onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, owner: e.target.value } : x)))}><MenuItem value=""><em>Owner</em></MenuItem>{people.map((p) => <MenuItem key={p.code} value={p.code}>{p.name.split(" (")[0]}</MenuItem>)}</Select></FormControl>
              <TextField size="small" type="date" value={a.due || ""} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} sx={{ minWidth: 140 }} />
              <IconButton size="small" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}><DeleteOutlineRounded fontSize="small" /></IconButton>
            </Stack>
          ))}
          {!items.length && <Typography variant="caption" color="text.secondary">No action items yet.</Typography>}
        </Stack>
        {m.kind === "client" && (
          <FormControl size="small" sx={{ mt: 2, minWidth: 200 }}><InputLabel>Outcome</InputLabel><Select label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}><MenuItem value="">Not set</MenuItem><MenuItem value="positive">Positive – moving forward</MenuItem><MenuItem value="neutral">Neutral – needs follow-up</MenuItem><MenuItem value="negative">At risk</MenuItem></Select></FormControl>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={() => save(false)}>Save</Button>
          {m.status !== "cancelled" && <Button variant="contained" onClick={() => save(true)}>Save & complete</Button>}
        </Stack>
        {history.length > 0 && (
          <>
            <Typography variant="h3" sx={{ mt: 3, mb: 1 }}>Earlier meetings with {client.company}</Typography>
            {history.map((h) => <Typography key={h.id} sx={{ fontSize: "0.62rem", mb: 0.5 }}><b>{fmtDate(h.start)}</b> · {h.title} — {(h.minutes || h.notes || "no minutes").replace(/\*\*/g, "").slice(0, 160)}</Typography>)}
          </>
        )}
      </Box>
      <MeetingDialog value={edit} onClose={() => setEdit(null)} />
    </Drawer>
  );
}
