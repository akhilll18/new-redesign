// Unified calendar (meetings, client meetings, interviews, leave, holidays, compliance and BGV due dates, joinings)
// with an AI scheduling assistant that reads everyone's real availability across time zones.
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, IconButton, InputAdornment, InputLabel, MenuItem, Rating, Select, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { ChevronLeftRounded, ChevronRightRounded, AddRounded, DownloadRounded, SendRounded, PublicRounded, VideocamRounded, PlaceRounded, PhoneRounded, DeleteOutlineRounded, OpenInNewRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, Tag, EmptyState, KeyVal } from "../kit/UI.jsx";
import { AiInsight } from "../ai/AiInsight.jsx";
import { AI_GRADIENT, Sparkle } from "../ai/AiText.jsx";
import { AiButton, AiResult, useAiRun, runAi } from "./aiKit.jsx";
import { downloadIcs } from "./ComplianceCalendar.jsx";
import { EVENT_KIND, identityCodes, directory, complianceCalendar, canManageCompliance, canManageBgv, bgvStatus, tzOf, localParts, fmtTime, fmtDay } from "../../lib/collab.js";
import { parseScheduleRequest, findSlots, schedulePrompt, mergeParsed } from "../../lib/scheduler.js";
import { holidaysFor } from "../../country/countryPacks.js";
import PeoplePicker from "../kit/PeoplePicker.jsx";
import { conferencingSettings, prepareConference, cancelOnlineMeeting, normalizeLink, canAutoCreate, jitsiLink, PROVIDERS } from "../../lib/conferencing.js";
import { ConferencePicker, JoinButton, AddToCalendarButton, ProviderMark, providerLabel } from "./ConferencingUI.jsx";
import { isoDate, DAY, fmtDate } from "../../lib/utils.js";
import { designTokens } from "../../theme/muiTheme.js";

const { color } = designTokens;

const H0 = 7;
const H1 = 21;
const ROW = 42;
const startOfWeek = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const sameDay = (a, b) => isoDate(a) === isoDate(b);
export function toLocalInput(iso) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** Everything that belongs on this user's calendar between two dates. */
export function useMyEvents(from, to, layers = {}) {
  const { data, user, reportsOf } = useStore();
  return useMemo(() => {
    const me = identityCodes(data, user);
    const has = (list) => (list || []).some((c) => me.has(c));
    const f = from.toISOString();
    const t = to.toISOString();
    const inR = (s, e) => s < t && e > f;
    const out = [];
    const isRecruiter = user.role === "superadmin" || (user.role === "admin" && user.modules?.includes("recruitment"));
    for (const m of data.meetings || []) {
      if (m.status === "cancelled" || !(has([m.organizer, ...(m.attendees || [])]) || (user.role === "superadmin" && layers.allMeetings))) continue;
      if (inR(m.start, m.end)) out.push({ id: m.id, kind: m.kind === "client" ? "client" : "meeting", title: m.title, start: m.start, end: m.end, ref: m, mode: m.mode, location: m.mode === "video" ? providerLabel(m) : m.location || m.link });
    }
    if (layers.interviews !== false) for (const iv of data.interviews || []) {
      if (iv.status === "cancelled" || !(has(iv.interviewers) || isRecruiter)) continue;
      const c = data.candidates.find((k) => k.id === iv.candidate_id);
      if (inR(iv.start, iv.end)) out.push({ id: iv.id, kind: "interview", title: `Interview: ${c?.name || ""} · ${iv.round}`, start: iv.start, end: iv.end, ref: iv, mine: has(iv.interviewers), location: normalizeLink(iv.link) });
    }
    for (const ev of data.events || []) {
      if (!(has([ev.owner, ...(ev.attendees || [])]) || ev.all_staff)) continue;
      if (inR(ev.start, ev.end)) out.push({ id: ev.id, kind: ev.kind || "event", title: ev.title, start: ev.start, end: ev.end, ref: ev });
    }
    const empCode = user.employee_code;
    const emp = data.employees.find((e) => e.employee_code === empCode);
    if (layers.leave !== false) {
      const team = empCode ? reportsOf(empCode).map((e) => e.employee_code) : [];
      for (const r of data.requests || []) {
        if (r.type !== "leave" || !["Approved", "Pending"].includes(r.status)) continue;
        const own = r.employee_code === empCode;
        if (!own && !(layers.team && team.includes(r.employee_code))) continue;
        const s = new Date(`${r.from_date}T00:00:00`);
        const e = new Date(`${r.to_date}T23:59:00`);
        if (inR(s.toISOString(), e.toISOString())) out.push({ id: r.request_id, kind: "leave", allDay: true, title: own ? `My leave${r.status === "Pending" ? " (pending)" : ""}` : `${data.employees.find((x) => x.employee_code === r.employee_code)?.full_name.split(" ")[0]} on leave`, start: s.toISOString(), end: e.toISOString(), ref: r });
      }
      for (const h of holidaysFor(data, emp || data.employees.find((e) => e.country_code === "IN")) || []) {
        const s = new Date(`${h.date}T00:00:00`);
        if (inR(s.toISOString(), new Date(`${h.date}T23:59:00`).toISOString())) out.push({ id: `H-${h.date}`, kind: "holiday", allDay: true, title: h.name, start: s.toISOString(), end: new Date(`${h.date}T23:59:00`).toISOString() });
      }
    }
    if (layers.compliance !== false && canManageCompliance(user)) {
      for (const c of complianceCalendar(data, { from: isoDate(from), to: isoDate(to) })) {
        if (["filed", "waived"].includes(c.status)) continue;
        if (c.owner !== user.code && user.role !== "superadmin") continue;
        out.push({ id: c.key, kind: "compliance", allDay: true, title: `${c.title} (${c.country})`, start: new Date(`${c.due}T00:00:00`).toISOString(), end: new Date(`${c.due}T23:59:00`).toISOString(), ref: c, overdue: c.status === "overdue" });
      }
    }
    if (layers.bgv !== false && canManageBgv(user)) {
      for (const b of data.bgv || []) {
        if (b.cancelled || b.closed_status || ["clear", "cleared_with_remarks"].includes(bgvStatus(b))) continue;
        const s = new Date(`${b.due_date}T00:00:00`);
        if (inR(s.toISOString(), new Date(`${b.due_date}T23:59:00`).toISOString())) out.push({ id: `BGV-${b.id}`, kind: "bgv", allDay: true, title: `BGV due: ${b.name}`, start: s.toISOString(), end: new Date(`${b.due_date}T23:59:00`).toISOString(), ref: b });
      }
    }
    if (layers.joining !== false) {
      const canSee = user.role === "superadmin" || (user.role === "admin" && user.modules?.includes("onboarding"));
      for (const o of data.onboarding || []) {
        if (!o.doj) continue;
        if (!canSee && !(o.buddy && me.has(o.buddy)) && !(empCode && data.reqs.some((r) => r.hiring_manager === empCode && r.role === o.role))) continue;
        const s = new Date(`${o.doj}T00:00:00`);
        if (inR(s.toISOString(), new Date(`${o.doj}T23:59:00`).toISOString())) out.push({ id: `J-${o.id}`, kind: "joining", allDay: true, title: `Joining: ${o.name}`, start: s.toISOString(), end: new Date(`${o.doj}T23:59:00`).toISOString(), ref: o });
      }
    }
    return out.sort((a, b) => a.start.localeCompare(b.start));
  }, [data, user, from.getTime(), to.getTime(), JSON.stringify(layers)]); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function CalendarPage() {
  const { data, user, reportsOf } = useStore();
  const narrow = useMediaQuery("(max-width:900px)");
  const [view, setView] = useState(narrow ? "agenda" : "week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [layers, setLayers] = useState({ team: false, interviews: true, leave: true, compliance: true, bgv: true, joining: true });
  const [ask, setAsk] = useState("");
  const [sched, setSched] = useState(null);
  const [open, setOpen] = useState(null);
  const [newEv, setNewEv] = useState(null);
  const [newMtg, setNewMtg] = useState(null);
  const isManager = user.role === "emp" && reportsOf(user.employee_code).length > 0;
  const range = useMemo(() => {
    if (view === "month") { const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1); const st = startOfWeek(s); return [st, new Date(st.getTime() + 42 * DAY)]; }
    if (view === "day") { const s = new Date(anchor); s.setHours(0, 0, 0, 0); return [s, new Date(s.getTime() + DAY)]; }
    if (view === "agenda") { const s = new Date(); s.setHours(0, 0, 0, 0); return [s, new Date(s.getTime() + 21 * DAY)]; }
    const s = startOfWeek(anchor); return [s, new Date(s.getTime() + 7 * DAY)];
  }, [view, anchor]);
  const events = useMyEvents(range[0], range[1], layers);
  const week = useMyEvents((() => { const s = new Date(); s.setHours(0, 0, 0, 0); return s; })(), new Date(Date.now() + 7 * DAY), { ...layers, team: false });
  const step = (n) => { const d = new Date(anchor); if (view === "month") d.setMonth(d.getMonth() + n); else d.setDate(d.getDate() + n * (view === "day" ? 1 : 7)); setAnchor(d); };
  const facts = useMemo(() => {
    const timed = week.filter((e) => !e.allDay);
    const byDay = {};
    timed.forEach((e) => { const k = isoDate(e.start); (byDay[k] = byDay[k] || []).push(e); });
    const b2b = Object.values(byDay).reduce((n, list) => n + list.slice(1).filter((e, i) => new Date(e.start) - new Date(list[i].end) < 10 * 60000).length, 0);
    const hours = timed.reduce((s, e) => s + (new Date(e.end) - new Date(e.start)) / 3600000, 0);
    const busiest = Object.entries(byDay).sort((a, b) => b[1].length - a[1].length)[0];
    const leave = week.filter((e) => e.kind === "leave");
    const clash = timed.filter((e) => leave.some((l) => e.start < l.end && e.end > l.start));
    const due = week.filter((e) => ["compliance", "bgv"].includes(e.kind));
    const needFb = (data.interviews || []).filter((iv) => iv.end < new Date().toISOString() && iv.status !== "cancelled" && identityCodes(data, user).has(iv.interviewers.find((p) => identityCodes(data, user).has(p))) && !(iv.feedback || []).some((f) => identityCodes(data, user).has(f.by)));
    return [
      `Next 7 days: ${timed.length} meetings/interviews, ${hours.toFixed(1)} hours booked`,
      busiest ? `Busiest day: ${fmtDay(busiest[0])} with ${busiest[1].length} items` : "",
      `${b2b} back-to-back transition(s) with less than 10 minutes between them`,
      clash.length ? `${clash.length} meeting(s) fall on your leave: ${clash.map((e) => e.title).join(", ")}` : "",
      timed.filter((e) => e.kind === "client").length ? `Client meetings: ${timed.filter((e) => e.kind === "client").map((e) => `${e.title} (${fmtDay(e.start)} ${fmtTime(e.start)})`).join("; ")}` : "",
      due.length ? `Deadlines: ${due.map((e) => `${e.title} ${fmtDay(e.start)}`).join("; ")}` : "",
      needFb.length ? `${needFb.length} interview(s) waiting for your feedback` : "",
      `Upcoming holidays/leave: ${week.filter((e) => ["holiday", "leave"].includes(e.kind)).map((e) => `${e.title} ${fmtDay(e.start)}`).join("; ") || "none"}`,
    ];
  }, [week]); // eslint-disable-line react-hooks/exhaustive-deps
  const title = view === "month" ? anchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : view === "day" ? anchor.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : view === "agenda" ? "Next 3 weeks" : `${fmtDate(isoDate(range[0]))} – ${fmtDate(isoDate(new Date(range[1].getTime() - DAY)))}`;
  return (
    <>
      <PageHeader eyebrow="COLLABORATE · CALENDAR" title="Calendar" subtitle="Your meetings, client visits, interviews, leave, holidays and deadlines in one place. Describe a meeting in plain words and AI finds a time that works for everyone." actions={<><Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadIcs("peoplehub-calendar.ics", events.filter((e) => !e.allDay || ["leave", "holiday"].includes(e.kind)).map((e) => ({ uid: e.id, title: e.title, start: e.start, end: e.end, allDay: e.allDay, date: isoDate(e.start), location: e.location })))}>Export .ics</Button><Button variant="contained" startIcon={<AddRounded />} onClick={() => setNewMtg({})}>New meeting</Button></>} />
      <Box data-ai-ui sx={{ mb: 2.5, p: 1.5, borderRadius: 2.5, background: color.primarySoft, color: color.text, border: `1px solid ${color.border}` }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ alignItems: { md: "center" } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 200 }}>
            <Box sx={{ width: 30, height: 30, borderRadius: "9px", background: AI_GRADIENT, display: "grid", placeItems: "center" }}><Sparkle size={17} /></Box>
            <Box><Typography sx={{ fontWeight: 700, fontSize: "0.875rem" }}>Schedule with AI</Typography><Typography sx={{ fontSize: "0.75rem", color: color.secondaryText }}>Checks calendars, leave, holidays & time zones</Typography></Box>
          </Stack>
          <TextField
            fullWidth
            size="small"
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && ask.trim()) setSched(ask); }}
            placeholder={user.role === "emp" ? "e.g. 30 min with Akhil and Kartik tomorrow afternoon about the release" : "e.g. 1 hour client demo with Acme and Neha next week, in person"}
            sx={{ "& .MuiOutlinedInput-root": { background: "rgba(255,255,255,0.95)", borderRadius: 2 } }}
            slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton size="small" aria-label="Find a time" disabled={!ask.trim()} onClick={() => setSched(ask)}><SendRounded fontSize="small" /></IconButton></InputAdornment> } }}
          />
        </Stack>
        <Stack direction="row" sx={{ gap: 0.8, mt: 1, flexWrap: "wrap" }}>
          {["Focus block 2 hours tomorrow morning", "45 min 1:1 with my team next week", "Client meeting with Orbit Retail this week, 1 hour", "Quick sync with Bindu today"].map((s) => <Chip key={s} size="small" label={s} onClick={() => setSched(s)} sx={{ background: "rgba(255,255,255,0.12)", color: "#e8f3ef", fontSize: "0.56rem", cursor: "pointer" }} />)}
        </Stack>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1fr) 300px" }, gap: 2.5, alignItems: "start" }}>
        <SectionCard
          title={title}
          action={
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
              {view !== "agenda" && <><IconButton size="small" aria-label="Previous" onClick={() => step(-1)}><ChevronLeftRounded /></IconButton><Button size="small" onClick={() => setAnchor(new Date())}>Today</Button><IconButton size="small" aria-label="Next" onClick={() => step(1)}><ChevronRightRounded /></IconButton></>}
              <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>{["day", "week", "month", "agenda"].map((v) => <ToggleButton key={v} value={v} sx={{ fontSize: "0.58rem", py: 0.3, textTransform: "capitalize" }}>{v}</ToggleButton>)}</ToggleButtonGroup>
            </Stack>
          }
        >
          {view === "agenda" && <Agenda events={events} onOpen={setOpen} />}
          {(view === "week" || view === "day") && <TimeGrid days={view === "day" ? [new Date(range[0])] : Array.from({ length: 7 }, (_, i) => new Date(range[0].getTime() + i * DAY))} events={events} onOpen={setOpen} onSlot={(start) => setNewEv({ start })} />}
          {view === "month" && <MonthGrid anchor={anchor} start={range[0]} events={events} onOpen={setOpen} onDay={(d) => { setAnchor(d); setView("day"); }} />}
        </SectionCard>
        <Stack spacing={2}>
          <AiInsight title="AI week planner" audience="the signed-in user planning their week" facts={facts} />
          <SectionCard title="Layers">
            <Stack>
              {[["interviews", "Interviews"], ["leave", "Leave & holidays"], ...(isManager ? [["team", "Team leave"]] : []), ...(canManageCompliance(user) ? [["compliance", "My compliance deadlines"]] : []), ...(canManageBgv(user) ? [["bgv", "BGV due dates"]] : []), ["joining", "Joinings"]].map(([k, l]) => <FormControlLabel key={k} control={<Switch size="small" checked={!!layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} />} label={<Typography sx={{ fontSize: "0.68rem" }}>{l}</Typography>} />)}
            </Stack>
            <Stack sx={{ mt: 1.5, gap: 0.6 }}>{Object.entries(EVENT_KIND).map(([k, v]) => <Stack key={k} direction="row" sx={{ alignItems: "center", gap: 0.8 }}><Box sx={{ width: 10, height: 10, borderRadius: 0.5, background: v.color }} /><Typography sx={{ fontSize: "0.58rem", color: "#5c675f" }}>{v.label}</Typography></Stack>)}</Stack>
          </SectionCard>
          <Button variant="outlined" onClick={() => setNewEv({ start: new Date(Math.ceil(Date.now() / 1800000) * 1800000).toISOString(), kind: "focus" })}>Block focus time</Button>
        </Stack>
      </Box>
      <AiScheduleDialog text={sched} onClose={() => setSched(null)} onBooked={() => { setSched(null); setAsk(""); }} />
      <EventDialog ev={open} onClose={() => setOpen(null)} />
      <QuickEventDialog value={newEv} onClose={() => setNewEv(null)} onMeeting={(start) => { setNewEv(null); setNewMtg({ start }); }} />
      <MeetingDialog value={newMtg} onClose={() => setNewMtg(null)} />
    </>
  );
}

function EventChip({ e, onOpen, compact }) {
  const k = EVENT_KIND[e.kind] || EVENT_KIND.event;
  return (
    <Box onClick={(ev) => { ev.stopPropagation(); onOpen(e); }} sx={{ cursor: "pointer", fontSize: "0.56rem", lineHeight: 1.25, px: 0.5, py: 0.25, borderRadius: 0.8, borderLeft: `3px solid ${k.color}`, background: `${k.color}1c`, color: "#1f2a24", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: e.overdue ? 700 : 500 }}>
      {!e.allDay && !compact && <b>{fmtTime(e.start)} </b>}{e.title}
    </Box>
  );
}

function Agenda({ events, onOpen }) {
  const days = {};
  events.forEach((e) => { const k = isoDate(e.start); (days[k] = days[k] || []).push(e); });
  const keys = Object.keys(days).sort();
  if (!keys.length) return <EmptyState title="Nothing in the next 3 weeks" text="Use Schedule with AI to set something up." />;
  return (
    <Stack spacing={1.5}>
      {keys.map((k) => (
        <Box key={k}>
          <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, color: k === isoDate() ? "#1D7A42" : "#3b463f", mb: 0.6 }}>{k === isoDate() ? "Today · " : ""}{fmtDay(`${k}T12:00:00`)}</Typography>
          <Stack spacing={0.6}>
            {days[k].map((e) => {
              const kind = EVENT_KIND[e.kind] || EVENT_KIND.event;
              return (
                <Stack key={e.id} direction="row" onClick={() => onOpen(e)} sx={{ cursor: "pointer", gap: 1.2, p: 1, borderRadius: 1.5, border: "1px solid #e8ece8", "&:hover": { borderColor: kind.color } }}>
                  <Box sx={{ width: 4, borderRadius: 2, background: kind.color }} />
                  <Box sx={{ minWidth: 86 }}><Typography sx={{ fontSize: "0.62rem", fontWeight: 700 }}>{e.allDay ? "All day" : `${fmtTime(e.start)}`}</Typography>{!e.allDay && <Typography sx={{ fontSize: "0.55rem", color: "#78827b" }}>{Math.round((new Date(e.end) - new Date(e.start)) / 60000)} min</Typography>}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontSize: "0.68rem", fontWeight: 600 }}>{e.title}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{kind.label}{e.location ? ` · ${e.location}` : ""}</Typography></Box>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function lanes(list) {
  const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
  const ends = [];
  return sorted.map((e) => {
    let lane = ends.findIndex((end) => end <= e.start);
    if (lane < 0) { lane = ends.length; ends.push(e.end); } else ends[lane] = e.end;
    return { e, lane };
  }).map((x, _, arr) => ({ ...x, of: Math.max(...arr.filter((y) => y.e.start < x.e.end && y.e.end > x.e.start).map((y) => y.lane)) + 1 }));
}

function TimeGrid({ days, events, onOpen, onSlot }) {
  const now = new Date();
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ minWidth: days.length > 1 ? 760 : 0 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: `52px repeat(${days.length}, minmax(0,1fr))`, borderBottom: "1px solid #e5eae5" }}>
          <Box />
          {days.map((d) => (
            <Box key={d.toISOString()} sx={{ p: 0.6, textAlign: "center", borderLeft: "1px solid #eef1ee", background: sameDay(d, now) ? "#eef7f2" : undefined }}>
              <Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{d.toLocaleDateString("en-IN", { weekday: "short" })}</Typography>
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 800, color: sameDay(d, now) ? "#1D7A42" : "#26302a" }}>{d.getDate()}</Typography>
              <Stack spacing={0.3} sx={{ mt: 0.4 }}>{events.filter((e) => e.allDay && e.start <= new Date(d.getTime() + DAY - 1).toISOString() && e.end >= d.toISOString()).map((e) => <EventChip key={e.id} e={e} onOpen={onOpen} />)}</Stack>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: `52px repeat(${days.length}, minmax(0,1fr))`, position: "relative", maxHeight: 560, overflowY: "auto" }}>
          <Box>{Array.from({ length: H1 - H0 }, (_, i) => <Box key={i} sx={{ height: ROW, fontSize: "0.52rem", color: "#8a948d", textAlign: "right", pr: 0.6, pt: 0.2 }}>{String(H0 + i).padStart(2, "0")}:00</Box>)}</Box>
          {days.map((d) => {
            const list = events.filter((e) => !e.allDay && sameDay(new Date(e.start), d));
            return (
              <Box key={d.toISOString()} sx={{ position: "relative", borderLeft: "1px solid #eef1ee", background: sameDay(d, now) ? "#fbfefc" : undefined }}>
                {Array.from({ length: H1 - H0 }, (_, i) => <Box key={i} onClick={() => { const s = new Date(d); s.setHours(H0 + i, 0, 0, 0); onSlot(s.toISOString()); }} sx={{ height: ROW, borderBottom: "1px solid #f1f4f1", cursor: "copy", "&:hover": { background: "#f4f9f6" } }} />)}
                {sameDay(d, now) && now.getHours() >= H0 && now.getHours() < H1 && <Box sx={{ position: "absolute", left: 0, right: 0, top: (now.getHours() + now.getMinutes() / 60 - H0) * ROW, height: 2, background: "#C77B1C", zIndex: 2 }} />}
                {lanes(list).map(({ e, lane, of }) => {
                  const s = new Date(e.start);
                  const top = Math.max(0, (s.getHours() + s.getMinutes() / 60 - H0) * ROW);
                  const h = Math.max(18, ((new Date(e.end) - s) / 3600000) * ROW - 2);
                  const k = EVENT_KIND[e.kind] || EVENT_KIND.event;
                  return (
                    <Box key={e.id} onClick={() => onOpen(e)} sx={{ position: "absolute", top, height: h, left: `calc(${(lane / of) * 100}% + 2px)`, width: `calc(${100 / of}% - 4px)`, background: `${k.color}26`, borderLeft: `3px solid ${k.color}`, borderRadius: 1, p: 0.4, overflow: "hidden", cursor: "pointer", zIndex: 1, "&:hover": { background: `${k.color}40` } }}>
                      <Typography sx={{ fontSize: "0.56rem", fontWeight: 700, lineHeight: 1.2, color: "#1f2a24" }}>{e.title}</Typography>
                      <Typography sx={{ fontSize: "0.5rem", color: "#46534a" }}>{fmtTime(e.start)}–{fmtTime(e.end)}</Typography>
                    </Box>
                  );
                })}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

function MonthGrid({ anchor, start, events, onOpen, onDay }) {
  const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * DAY));
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(100px,1fr))", border: "1px solid #e5eae5", borderRadius: 1.5, overflow: "hidden", minWidth: 700 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <Box key={d} sx={{ p: 0.6, fontSize: "0.58rem", fontWeight: 700, color: "#5c675f", background: "#f4f7f3" }}>{d}</Box>)}
        {cells.map((d) => {
          const list = events.filter((e) => e.start <= new Date(d.getTime() + DAY - 1).toISOString() && e.end >= d.toISOString());
          return (
            <Box key={d.toISOString()} onClick={() => onDay(d)} sx={{ minHeight: 92, p: 0.5, borderTop: "1px solid #eef1ee", borderRight: "1px solid #eef1ee", background: d.getMonth() !== anchor.getMonth() ? "#fafbfa" : sameDay(d, new Date()) ? "#eef7f2" : "#fff", cursor: "pointer" }}>
              <Typography sx={{ fontSize: "0.58rem", fontWeight: 700, color: d.getMonth() !== anchor.getMonth() ? "#a0a8a2" : "#3b463f" }}>{d.getDate()}</Typography>
              <Stack spacing={0.3}>{list.slice(0, 3).map((e) => <EventChip key={e.id} e={e} onOpen={onOpen} />)}{list.length > 3 && <Typography sx={{ fontSize: "0.5rem", color: "#2C4B8F" }}>+{list.length - 3} more</Typography>}</Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ── Event details (with interview feedback for panel members) ──
function EventDialog({ ev, onClose }) {
  const { data, user, nameOf, submitInterviewFeedback, deleteEvent, notifyToast } = useStore();
  const navigate = useNavigate();
  const [fb, setFb] = useState({ rating: 0, recommendation: "", notes: "" });
  const [edit, setEdit] = useState(null);
  useEffect(() => {
    const ids = identityCodes(data, user);
    const prev = ev?.kind === "interview" ? data.interviews.find((i) => i.id === ev.id)?.feedback?.find((f) => ids.has(f.by)) : null;
    setFb({ rating: prev?.rating || 0, recommendation: prev?.recommendation || "", notes: prev?.notes || "" });
  }, [ev?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ev) return null;
  const k = EVENT_KIND[ev.kind] || EVENT_KIND.event;
  const me = identityCodes(data, user);
  const iv = ev.kind === "interview" ? data.interviews.find((i) => i.id === ev.id) : null;
  const myFb = iv?.feedback?.find((f) => me.has(f.by));
  const mtg = ["meeting", "client"].includes(ev.kind) ? data.meetings.find((m) => m.id === ev.id) : null;
  const client = mtg?.client_id && data.clients.find((c) => c.id === mtg.client_id);
  const own = ["focus", "event"].includes(ev.kind) && ev.ref?.owner && me.has(ev.ref.owner);
  return (
    <>
      <Dialog open={!!ev} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}><Box sx={{ width: 12, height: 12, borderRadius: 0.6, background: k.color }} />{ev.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <KeyVal items={[["Type", k.label], ["When", ev.allDay ? fmtDay(ev.start) : `${fmtDay(ev.start)} · ${fmtTime(ev.start)}–${fmtTime(ev.end)}`], ev.location ? ["Where", mtg?.mode === "video" ? <Stack component="span" direction="row" sx={{ alignItems: "center", gap: 0.6 }}><ProviderMark provider={mtg.provider || "other"} size={14} />{providerLabel(mtg)}</Stack> : ev.location] : null, mtg?.guests?.length ? ["Guests", mtg.guests.join(", ")] : null, mtg ? ["Organiser", nameOf(mtg.organizer)] : null, mtg ? ["Attendees", mtg.attendees.map(nameOf).join(", ") || "—"] : null, client ? ["Client", `${client.company} · ${client.contact}`] : null, iv ? ["Panel", iv.interviewers.map(nameOf).join(", ")] : null, ev.kind === "compliance" ? ["Authority", ev.ref.authority] : null, ev.kind === "bgv" ? ["Case", ev.ref.id] : null].filter(Boolean)} />
            {mtg?.agenda && <Box><Typography variant="caption" color="text.secondary">Agenda</Typography><Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{mtg.agenda}</Typography></Box>}
            {iv && me.has(iv.interviewers.find((p) => me.has(p))) && (
              <Box sx={{ p: 1.5, borderRadius: 1.5, border: "1px solid #e5eae5", background: "#fafcfa" }}>
                <Typography sx={{ fontWeight: 700, fontSize: "0.72rem", mb: 1 }}>{myFb ? "Your feedback (you can update it)" : "Interview feedback"}</Typography>
                <Stack spacing={1.2}>
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}><Typography variant="caption">Overall</Typography><Rating value={fb.rating} onChange={(_, v) => setFb({ ...fb, rating: v || 0 })} /></Stack>
                  <ToggleButtonGroup size="small" exclusive value={fb.recommendation} onChange={(_, v) => v && setFb({ ...fb, recommendation: v })}>{[["strong_yes", "Strong yes"], ["yes", "Yes"], ["maybe", "Maybe"], ["no", "No"]].map(([v, l]) => <ToggleButton key={v} value={v} sx={{ fontSize: "0.6rem", py: 0.3 }}>{l}</ToggleButton>)}</ToggleButtonGroup>
                  <TextField size="small" label="Notes (evidence for your rating)" multiline minRows={3} value={fb.notes} onChange={(e) => setFb({ ...fb, notes: e.target.value })} />
                  <Button variant="contained" sx={{ alignSelf: "flex-start" }} onClick={() => { const r = submitInterviewFeedback(iv.id, fb); notifyToast(r.ok ? "Feedback submitted to the recruitment team." : r.error, r.ok ? "success" : "error"); if (r.ok) onClose(); }}>Submit feedback</Button>
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {own && <Button color="error" startIcon={<DeleteOutlineRounded />} sx={{ mr: "auto" }} onClick={() => { deleteEvent(ev.id); notifyToast("Removed from your calendar."); onClose(); }}>Delete</Button>}
          {mtg && <AddToCalendarButton m={mtg} data={data} nameOf={nameOf} notify={notifyToast} />}
          {mtg && <JoinButton m={mtg} />}
          {iv && /^https?:/.test(iv.link || "") && <Button startIcon={<VideocamRounded />} href={normalizeLink(iv.link)} target="_blank" rel="noreferrer">Join interview</Button>}
          {mtg && (mtg.organizer === user.code || me.has(mtg.organizer)) && <Button onClick={() => setEdit({ ...mtg })}>Edit / move</Button>}
          {mtg && <Button endIcon={<OpenInNewRounded />} onClick={() => { onClose(); navigate(`/meetings?m=${mtg.id}`); }}>Open meeting</Button>}
          {ev.kind === "compliance" && <Button onClick={() => { onClose(); navigate("/compliance-calendar"); }}>Open compliance calendar</Button>}
          {ev.kind === "bgv" && <Button onClick={() => { onClose(); navigate("/bgv"); }}>Open BGV</Button>}
          <Button color="inherit" onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
      <MeetingDialog value={edit} onClose={() => { setEdit(null); onClose(); }} />
    </>
  );
}

function QuickEventDialog({ value, onClose, onMeeting }) {
  const { saveEvent, notifyToast } = useStore();
  const [f, setF] = useState(null);
  useEffect(() => { if (value) setF({ title: value.kind === "focus" ? "Focus time" : "", kind: value.kind || "focus", start: value.start, duration: value.kind === "focus" ? 120 : 30 }); }, [value]);
  if (!value || !f) return null;
  return (
    <Dialog open={!!value} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add to calendar</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <ToggleButtonGroup size="small" exclusive value={f.kind} onChange={(_, v) => v && setF({ ...f, kind: v, title: v === "focus" && !f.title ? "Focus time" : f.title })}><ToggleButton value="focus" sx={{ fontSize: "0.62rem" }}>Focus time</ToggleButton><ToggleButton value="event" sx={{ fontSize: "0.62rem" }}>Reminder / event</ToggleButton></ToggleButtonGroup>
          <TextField size="small" label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Stack direction="row" spacing={2}>
            <TextField size="small" type="datetime-local" label="Start" value={toLocalInput(f.start)} onChange={(e) => setF({ ...f, start: new Date(e.target.value).toISOString() })} slotProps={{ inputLabel: { shrink: true } }} />
            <FormControl size="small" sx={{ minWidth: 110 }}><InputLabel>Length</InputLabel><Select label="Length" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })}>{[15, 30, 60, 90, 120, 180, 240].map((d) => <MenuItem key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} h`}</MenuItem>)}</Select></FormControl>
          </Stack>
          <Button size="small" onClick={() => onMeeting(f.start)} sx={{ alignSelf: "flex-start" }}>Invite people instead →</Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { const r = saveEvent({ title: f.title, kind: f.kind, start: f.start, end: new Date(new Date(f.start).getTime() + f.duration * 60000).toISOString() }); if (!r.ok) return notifyToast(r.error, "error"); notifyToast("Added to your calendar."); onClose(); }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Meeting create / edit (internal or client) ─────────
export function MeetingDialog({ value, onClose, onSaved }) {
  const { data, user, saveMeeting, upsertClient, notifyToast } = useStore();
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState("");
  const [newClient, setNewClient] = useState(null);
  const ai = useAiRun();
  useEffect(() => {
    if (!value) return;
    const start = value.start || new Date(Math.ceil((Date.now() + 3600000) / 1800000) * 1800000).toISOString();
    const cfg = conferencingSettings(data);
    setF(value.id
      ? { ...value, link: normalizeLink(value.link), provider: value.mode === "video" ? value.provider || null : value.provider, guests: value.guests || [], autoCreate: true, duration: Math.round((new Date(value.end) - new Date(value.start)) / 60000) }
      : { kind: value.kind || "meeting", title: value.title || "", client_id: value.client_id || "", start, duration: value.duration || 30, mode: value.mode || "video", provider: value.provider || cfg.default_provider, location: "", link: (value.provider || cfg.default_provider) === "jitsi" ? jitsiLink(value.title || "meeting") : "", guests: value.guests || [], autoCreate: true, attendees: value.attendees || [], agenda: value.agenda || "" });
    setSlots(null);
    setError("");
    ai.clear();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!value || !f) return null;
  const people = directory(data).filter((p) => p.code !== user.code && p.kind === "emp");
  const findTime = () => {
    const r = findSlots({ data, organizer: user.code, attendees: f.attendees, durationMin: Number(f.duration), from: isoDate(), to: isoDate(Date.now() + 10 * DAY), max: 5 });
    setSlots(r.slots);
    if (!r.slots.length) setError("No common free time in the next 10 working days within everyone's working hours.");
  };
  const client = data.clients.find((c) => c.id === f.client_id);
  const agendaOffline = () => {
    const past = data.meetings.filter((m) => m.client_id && m.client_id === f.client_id && m.status === "completed");
    const open = past.flatMap((m) => (m.action_items || []).filter((a) => !a.done).map((a) => a.text));
    return f.kind === "client"
      ? `1. Introductions and objectives (5 min)\n2. ${client ? `Recap: where we are with ${client.company} (${client.stage})` : "Recap of the client's needs"} (10 min)\n3. ${f.title.replace(/^.*?[–-]\s*/, "") || "Main discussion"} (${Math.max(10, f.duration - 25)} min)\n${open.length ? `4. Open items from last time: ${open.join("; ")}\n5` : "4"}. Next steps, owners and dates (5 min)`
      : `1. Purpose and expected outcome (3 min)\n2. ${f.title || "Discussion"} (${Math.max(10, f.duration - 10)} min)\n3. Decisions and action items (5 min)`;
  };
  const save = async () => {
    const start = new Date(f.start).toISOString();
    const end = new Date(new Date(f.start).getTime() + Number(f.duration) * 60000).toISOString();
    // Check the basics before touching Teams / Google so we never create an orphan event there.
    if (!String(f.title || "").trim()) return setError("Give the meeting a title.");
    if (f.kind === "client" && !f.client_id) return setError("Choose the client (or add a new one).");
    if (f.mode === "in_person" && !String(f.location || "").trim()) return setError("Add the meeting location.");
    const bad = (f.guests || []).filter((g) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g));
    if (bad.length) return setError(`Check these guest emails: ${bad.join(", ")}`);
    setError("");
    setSaving(true);
    let patch = {};
    try {
      if (f.mode === "video") patch = await prepareConference({ ...f, start, end, organizer: f.organizer || user.code }, { data, auto: f.autoCreate !== false });
      else if (f.external) { await cancelOnlineMeeting(conferencingSettings(data), f.external).catch(() => {}); patch = { external: null }; }
    } catch (e) {
      setSaving(false);
      return setError(e.message || "Couldn't create the online meeting.");
    }
    const r = saveMeeting({ ...f, ...patch, start, end });
    setSaving(false);
    if (!r.ok) return setError(r.error);
    const via = patch.external && !f.external ? ` ${PROVIDERS[patch.provider].label} meeting created; invitations sent from your ${patch.provider === "teams" ? "Outlook" : "Google"} calendar.` : "";
    notifyToast(f.id ? `Meeting updated; attendees notified.${via}` : `Meeting booked.${via || " Invitations sent."}`);
    onSaved?.(r.id);
    onClose();
  };
  return (
    <Dialog open={!!value} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{f.id ? "Edit meeting" : "New meeting"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="warning">{error}</Alert>}
          <ToggleButtonGroup size="small" exclusive value={f.kind} onChange={(_, v) => v && setF({ ...f, kind: v })}><ToggleButton value="meeting" sx={{ fontSize: "0.62rem" }}>Internal</ToggleButton><ToggleButton value="client" sx={{ fontSize: "0.62rem" }}>Client meeting</ToggleButton></ToggleButtonGroup>
          <TextField size="small" label="Title *" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          {f.kind === "client" && (
            <Stack direction="row" spacing={1}>
              <FormControl size="small" fullWidth><InputLabel>Client *</InputLabel><Select label="Client *" value={f.client_id || ""} onChange={(e) => { const c = data.clients.find((k) => k.id === e.target.value); const prev = data.clients.find((k) => k.id === f.client_id)?.email; const guests = (f.guests || []).filter((g) => g !== prev); setF({ ...f, client_id: e.target.value, guests: c?.email && !guests.includes(c.email) ? [...guests, c.email] : guests, guestsText: undefined }); }}>{data.clients.map((c) => <MenuItem key={c.id} value={c.id}>{c.company} · {c.contact}</MenuItem>)}</Select></FormControl>
              <Button size="small" onClick={() => setNewClient({ company: "", contact: "", email: "", phone: "", city: "" })}>New</Button>
            </Stack>
          )}
          {newClient && (
            <Box sx={{ p: 1.2, border: "1px dashed #cfd8d1", borderRadius: 1.5 }}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1}><TextField size="small" label="Company *" value={newClient.company} onChange={(e) => setNewClient({ ...newClient, company: e.target.value })} /><TextField size="small" label="Contact *" value={newClient.contact} onChange={(e) => setNewClient({ ...newClient, contact: e.target.value })} /></Stack>
                <Stack direction="row" spacing={1}><TextField size="small" label="Email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} /><TextField size="small" label="City" value={newClient.city} onChange={(e) => setNewClient({ ...newClient, city: e.target.value })} /></Stack>
                <Stack direction="row" spacing={1}><Button size="small" variant="contained" onClick={() => { const r = upsertClient(newClient); if (!r.ok) return setError(r.error); setF({ ...f, client_id: r.id, guests: newClient.email ? [...(f.guests || []), newClient.email] : f.guests, guestsText: undefined }); setNewClient(null); }}>Add client</Button><Button size="small" color="inherit" onClick={() => setNewClient(null)}>Cancel</Button></Stack>
              </Stack>
            </Box>
          )}
          <PeoplePicker people={people} value={f.attendees} onChange={(v) => setF({ ...f, attendees: v })} label="Invite" placeholder="Type a name, surname or initials…" helperText={f.kind === "client" ? "Colleagues joining you. Client contacts go under External guests." : undefined} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
            <TextField size="small" type="datetime-local" label="Start" value={toLocalInput(f.start)} onChange={(e) => setF({ ...f, start: new Date(e.target.value).toISOString() })} slotProps={{ inputLabel: { shrink: true } }} />
            <FormControl size="small" sx={{ minWidth: 110 }}><InputLabel>Length</InputLabel><Select label="Length" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })}>{[15, 30, 45, 60, 90, 120].map((d) => <MenuItem key={d} value={d}>{d} min</MenuItem>)}</Select></FormControl>
            <AiButton onClick={findTime}>Find best time</AiButton>
          </Stack>
          {slots?.length > 0 && <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.8 }}>{slots.map((s) => <Button key={s.start} size="small" variant={s.start === f.start ? "contained" : "outlined"} onClick={() => setF({ ...f, start: s.start })} sx={{ textTransform: "none", fontSize: "0.6rem" }}>{fmtDay(s.start)} {fmtTime(s.start)} · {s.reasons.slice(0, 2).join(", ")}</Button>)}</Stack>}
          <ToggleButtonGroup size="small" exclusive value={f.mode} onChange={(_, v) => v && setF({ ...f, mode: v, link: v === "video" ? normalizeLink(value.mode === "video" ? value.link || "" : "") : "" })}><ToggleButton value="video" sx={{ fontSize: "0.6rem" }}><VideocamRounded sx={{ fontSize: 15, mr: 0.5 }} />Video</ToggleButton><ToggleButton value="in_person" sx={{ fontSize: "0.6rem" }}><PlaceRounded sx={{ fontSize: 15, mr: 0.5 }} />In person</ToggleButton><ToggleButton value="phone" sx={{ fontSize: "0.6rem" }}><PhoneRounded sx={{ fontSize: 15, mr: 0.5 }} />Phone</ToggleButton></ToggleButtonGroup>
          {f.mode === "in_person" && <TextField size="small" label="Location *" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder={client ? `${client.company}, ${client.city}` : "Room / address"} />}
          {f.mode === "phone" && <TextField size="small" label="Dial-in / phone" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />}
          {f.mode === "video" && <ConferencePicker f={f} setF={setF} data={data} start={new Date(f.start).toISOString()} end={new Date(new Date(f.start).getTime() + Number(f.duration) * 60000).toISOString()} />}
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}><Typography variant="caption" color="text.secondary">Agenda</Typography><AiButton busy={ai.busy} onClick={() => ai.run({ task: "meeting-agenda", fast: true, instruction: "Write a tight, time-boxed meeting agenda (3–6 numbered items with minutes) for this meeting. Include open action items from earlier meetings with the same client when given.", input: JSON.stringify({ title: f.title, kind: f.kind, minutes: f.duration, client: client ? { company: client.company, stage: client.stage, industry: client.industry } : null, attendees: f.attendees.map((c) => people.find((p) => p.code === c)?.name), openItems: data.meetings.filter((m) => m.client_id && m.client_id === f.client_id).flatMap((m) => (m.action_items || []).filter((a) => !a.done).map((a) => a.text)) }), offline: agendaOffline() })}>Draft agenda</AiButton></Stack>
          <AiResult ai={ai} title="AI agenda" onUse={(t) => { setF({ ...f, agenda: t }); ai.clear(); }} useLabel="Use agenda" dense />
          <TextField size="small" multiline minRows={3} value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} placeholder="What will you cover?" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>{saving ? "Booking…" : f.id ? "Save changes" : "Book & send invites"}</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── AI scheduling assistant ────────────────────────────
export function AiScheduleDialog({ text, onClose, onBooked }) {
  const { data, user, saveMeeting, saveEvent, notifyToast } = useStore();
  const [req, setReq] = useState(null);
  const confCfg = conferencingSettings(data);
  const aiProviders = ["teams", "gmeet"].filter((id) => canAutoCreate(id, confCfg)).concat("jitsi");
  const [provider, setProvider] = useState(() => (aiProviders.includes(confCfg.default_provider) ? confCfg.default_provider : aiProviders[0]));
  const [booking, setBooking] = useState(false);
  const [result, setResult] = useState(null);
  const [pick, setPick] = useState(null);
  const [relax, setRelax] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const explain = useAiRun();
  const people = directory(data).filter((p) => p.kind === "emp" && p.code !== user.code);
  const meRec = { ...user, code: user.code };

  const search = (r, rel = relax) => {
    const isFocus = /\bfocus\b|\bblock\b|\bdeep work\b/i.test(text || "") && !(r.attendees || []).length;
    const res = findSlots({ data, organizer: user.code, attendees: isFocus ? [] : r.attendees, durationMin: r.durationMin, from: r.from, to: r.to, partOfDay: r.partOfDay, exactTime: r.exactTime, max: 5, workStart: rel ? 8 : 9.5, workEnd: rel ? 21 : 18.5 });
    setResult({ ...res, isFocus });
    setPick(res.slots[0] || null);
    return res;
  };
  useEffect(() => {
    if (!text) return;
    let alive = true;
    setError("");
    setResult(null);
    setRelax(false);
    explain.clear();
    const base = parseScheduleRequest(text, { data, me: meRec });
    setReq(base);
    setThinking(true);
    const p = schedulePrompt({ text, data, me: meRec, base });
    runAi({ task: "schedule-parse", fast: true, maxTokens: 500, instruction: p.system, input: p.messages[0].content, offline: JSON.stringify(base) })
      .then((out) => { if (!alive) return; const merged = mergeParsed(base, out); merged.attendees = merged.attendees.filter((c) => people.some((pp) => pp.code === c)); setReq(merged); search(merged, false); })
      .catch(() => { if (alive) search(base, false); })
      .finally(() => alive && setThinking(false));
    return () => { alive = false; };
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!text) return null;
  const upd = (patch) => { const n = { ...req, ...patch }; setReq(n); search(n); };
  const zoneNames = result?.people.filter((p) => p.zone !== tzOf(data.employees.find((e) => e.employee_code === user.employee_code))).map((p) => `${p.name.split(" ")[0]} (${p.zone.split("/")[1].replace("_", " ")})`) || [];
  const book = async () => {
    if (!pick) return;
    if (result.isFocus) {
      const r = saveEvent({ title: req.title === "Meeting" ? "Focus time" : req.title, kind: "focus", start: pick.start, end: pick.end });
      if (!r.ok) return setError(r.error);
      notifyToast("Focus time blocked on your calendar.");
      return onBooked?.();
    }
    const agenda = Array.isArray(req.agenda) ? req.agenda.map((a, i) => `${i + 1}. ${a}`).join("\n") : req.agenda || "";
    const client = data.clients.find((c) => c.id === req.client);
    const draft = { kind: req.kind === "client" && req.client ? "client" : "meeting", title: req.title, client_id: req.client || null, start: pick.start, end: pick.end, mode: req.mode, provider: req.mode === "video" ? provider : null, link: "", guests: client?.email ? [client.email] : [], location: req.mode === "in_person" ? (client ? `${client.company}, ${client.city}` : "Office – meeting room") : "", attendees: req.attendees, agenda, ai_scheduled: true };
    let patch = {};
    setBooking(true);
    try {
      if (draft.mode === "video") patch = await prepareConference({ ...draft, organizer: user.code }, { data });
    } catch (e) {
      setBooking(false);
      return setError(e.message);
    }
    const r = saveMeeting({ ...draft, ...patch });
    setBooking(false);
    if (!r.ok) return setError(r.error);
    notifyToast(`Booked "${req.title}" for ${fmtDay(pick.start)} ${fmtTime(pick.start)}${patch.provider ? ` on ${PROVIDERS[patch.provider].label.replace(" (free, instant)", "")}` : ""}. Invitations sent.`);
    onBooked?.(r.id);
  };
  const runExplain = () => {
    const priv = user.role === "emp"; // employees don't see why a colleague is away
    const ppl = result.people.map((p) => `${p.name}: ${p.busy} meeting(s) in range${p.leave.length ? `, ${priv ? "unavailable" : "leave"} on ${p.leave.join(", ")}` : ""}${p.holidays.length ? `, holidays ${p.holidays.join(", ")}` : ""}, time zone ${p.zone}`);
    const offline = `I checked **${result.people.length} calendar(s)** from ${fmtDate(req.from)} to ${fmtDate(req.to)} (${relax ? "08:00–21:00" : "09:30–18:30"} in each person's own time zone, weekdays, avoiding lunch).\n\n${result.slots.length ? `**Best option: ${fmtDay(result.slots[0].start)} at ${fmtTime(result.slots[0].start)}** – ${result.slots[0].reasons.join(", ")}.` : "**No slot works for everyone** in that window."}\n${result.people.filter((p) => p.leave.length || p.holidays.length).map((p) => `- ${p.name.split(" ")[0]} is away: ${[...p.leave.map((d) => `${priv ? "" : "leave "}${fmtDay(`${d}T12:00:00`)}`), ...p.holidays].join(", ")}`).join("\n")}${zoneNames.length ? `\n- Time zones considered: ${zoneNames.join(", ")}` : ""}${!result.slots.length ? "\n\n**Try:** widen the date range, shorten the meeting, drop an optional attendee, or allow extended hours." : ""}`;
    explain.run({ task: "schedule-explain", fast: true, instruction: "Explain in 3–5 short bullets why the suggested meeting time is best, mentioning conflicts, leave, holidays and time zones from the facts. If nothing fits, suggest the smallest change that would make it work.", input: `Request: ${text}\nParsed: ${JSON.stringify(req)}\nSlots: ${JSON.stringify(result.slots.slice(0, 3))}\nPeople: ${ppl.join(" | ")}`, offline });
  };
  return (
    <Dialog open={!!text} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}><Box sx={{ width: 26, height: 26, borderRadius: "8px", background: AI_GRADIENT, color: "#fff", display: "grid", placeItems: "center" }}><Sparkle size={15} /></Box>Schedule with AI</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ fontStyle: "italic", color: "#46534a", mb: 2 }}>“{text}”</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {req && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="caption" color="text.secondary">I understood {thinking && "· refining with AI…"}</Typography>
              <TextField size="small" label="Title" value={req.title} onChange={(e) => setReq({ ...req, title: e.target.value })} />
              <PeoplePicker people={people} value={req.attendees} onChange={(v) => upd({ attendees: v })} label="Invite" placeholder="Just me – type a name to invite" />
              {req.unknownNames?.length > 0 && <Alert severity="warning" sx={{ py: 0, fontSize: "0.62rem" }}>I could not find: {req.unknownNames.join(", ")}. Add them above if they are colleagues.</Alert>}
              <Stack direction="row" spacing={1}>
                <FormControl size="small" fullWidth><InputLabel>Length</InputLabel><Select label="Length" value={req.durationMin} onChange={(e) => upd({ durationMin: e.target.value })}>{[15, 30, 45, 60, 90, 120, 180].concat([req.durationMin]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).map((d) => <MenuItem key={d} value={d}>{d} min</MenuItem>)}</Select></FormControl>
                <FormControl size="small" fullWidth><InputLabel>Time of day</InputLabel><Select label="Time of day" value={req.partOfDay} onChange={(e) => upd({ partOfDay: e.target.value, exactTime: null })}>{["any", "morning", "afternoon", "evening"].map((d) => <MenuItem key={d} value={d} sx={{ textTransform: "capitalize" }}>{d}</MenuItem>)}</Select></FormControl>
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField size="small" type="date" label="From" value={req.from} onChange={(e) => upd({ from: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
                <TextField size="small" type="date" label="To" value={req.to} onChange={(e) => upd({ to: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
              </Stack>
              <Stack direction="row" spacing={1}>
                <FormControl size="small" fullWidth><InputLabel>Format</InputLabel><Select label="Format" value={req.mode} onChange={(e) => setReq({ ...req, mode: e.target.value })}><MenuItem value="video">Video</MenuItem><MenuItem value="in_person">In person</MenuItem><MenuItem value="phone">Phone</MenuItem></Select></FormControl>
                {req.mode === "video" && <FormControl size="small" fullWidth><InputLabel>Platform</InputLabel><Select label="Platform" value={provider} onChange={(e) => setProvider(e.target.value)} renderValue={(v) => <Stack direction="row" sx={{ alignItems: "center", gap: 0.8 }}><ProviderMark provider={v} size={16} />{PROVIDERS[v].short}</Stack>}>{aiProviders.map((id) => <MenuItem key={id} value={id}><Stack direction="row" sx={{ alignItems: "center", gap: 1 }}><ProviderMark provider={id} size={16} />{PROVIDERS[id].label}</Stack></MenuItem>)}</Select></FormControl>}
                <FormControl size="small" fullWidth><InputLabel>Client</InputLabel><Select label="Client" value={req.client || ""} onChange={(e) => setReq({ ...req, client: e.target.value, kind: e.target.value ? "client" : "meeting" })}><MenuItem value="">Internal</MenuItem>{data.clients.map((c) => <MenuItem key={c.id} value={c.id}>{c.company}</MenuItem>)}</Select></FormControl>
              </Stack>
              {Array.isArray(req.agenda) && req.agenda.length > 0 && <Box><Typography variant="caption" color="text.secondary">Suggested agenda</Typography>{req.agenda.map((a, i) => <Typography key={i} sx={{ fontSize: "0.62rem" }}>{i + 1}. {a}</Typography>)}</Box>}
              {req.notes?.map((n) => <Typography key={n} variant="caption" color="text.secondary">{n}</Typography>)}
            </Stack>
            <Stack spacing={1.2}>
              <Typography variant="caption" color="text.secondary">{result ? `${result.slots.length ? "Best times" : "No common time"} · searched ${result.searched} free slot(s)` : "Searching calendars…"}</Typography>
              {result?.slots.map((s, i) => (
                <Box key={s.start} onClick={() => setPick(s)} sx={{ cursor: "pointer", p: 1.2, borderRadius: 1.5, border: `2px solid ${pick?.start === s.start ? "#2E8C7A" : "#e5eae5"}`, background: pick?.start === s.start ? "#f0f8f4" : "#fff" }}>
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.74rem", flex: 1 }}>{fmtDay(s.start)} · {fmtTime(s.start)}–{fmtTime(s.end)}</Typography>
                    {i === 0 && <Tag tone="good">Best</Tag>}
                  </Stack>
                  <Typography sx={{ fontSize: "0.58rem", color: "#5c675f" }}>{s.reasons.join(" · ")}</Typography>
                </Box>
              ))}
              {result && !result.slots.length && (
                <Alert severity="warning" sx={{ fontSize: "0.62rem" }}>
                  No window where everyone is free{zoneNames.length ? ` – ${zoneNames.join(", ")} have little overlap with you` : ""}. Widen the dates, shorten it, or allow extended hours.
                </Alert>
              )}
              {result && <FormControlLabel control={<Switch size="small" checked={relax} onChange={(e) => { setRelax(e.target.checked); search(req, e.target.checked); }} />} label={<Typography sx={{ fontSize: "0.62rem" }}>Allow extended hours (08:00–21:00 local)</Typography>} />}
              {result?.people.length > 0 && (
                <Box sx={{ p: 1, borderRadius: 1.5, background: "#f6f8f6" }}>
                  {result.people.map((p) => <Stack key={p.code} direction="row" sx={{ gap: 0.8, alignItems: "center" }}><PublicRounded sx={{ fontSize: 12, color: "#78827b" }} /><Typography sx={{ fontSize: "0.58rem" }}><b>{p.name.split(" (")[0]}</b> · {p.zone.split("/")[1].replace("_", " ")}{pick ? ` · ${localParts(new Date(pick.start), p.zone).label} local` : ""}{p.leave.length ? ` · ${user.role === "emp" ? "away" : "leave"} ${p.leave.map((d) => d.slice(5)).join(", ")}` : ""}{p.holidays.length ? ` · holiday ${p.holidays.map((h) => h.split(" ").pop().slice(5)).join(", ")}` : ""}</Typography></Stack>)}
                </Box>
              )}
              {result && <AiButton busy={explain.busy} onClick={runExplain}>Why this time?</AiButton>}
              <AiResult ai={explain} title="AI scheduling note" dense />
            </Stack>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!pick || thinking || booking} onClick={book}>{result?.isFocus ? "Block time" : `Book${req?.attendees?.length ? " & invite" : ""}`}</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Small "Up next" list for dashboards. */
export function UpNext({ limit = 4, onOpenCalendar }) {
  const from = useMemo(() => new Date(), []);
  const to = useMemo(() => new Date(Date.now() + 3 * DAY), []);
  const ev = useMyEvents(from, to, { leave: false, compliance: false, bgv: false, joining: false }).filter((e) => !e.allDay && e.end >= new Date().toISOString()).slice(0, limit);
  if (!ev.length) return <Typography variant="caption" color="text.secondary">Nothing booked in the next 3 days.</Typography>;
  return (
    <Stack spacing={0.8}>
      {ev.map((e) => <Stack key={e.id} direction="row" sx={{ gap: 1, alignItems: "center", cursor: "pointer" }} onClick={onOpenCalendar}><Box sx={{ width: 4, height: 28, borderRadius: 2, background: (EVENT_KIND[e.kind] || EVENT_KIND.event).color }} /><Box sx={{ minWidth: 0 }}><Typography sx={{ fontSize: "0.66rem", fontWeight: 700 }} noWrap>{e.title}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{fmtDay(e.start)} · {fmtTime(e.start)}</Typography></Box></Stack>)}
    </Stack>
  );
}
