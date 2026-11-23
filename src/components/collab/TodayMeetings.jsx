// v10.4: "Meetings for today" dashboard card on every Home (employee, HR, Finance, Super Admin).
// Lists today's internal and client meetings for the signed-in person; a click opens the full meeting details.
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { VideocamRounded, PlaceRounded, PhoneRounded, BusinessRounded, GroupsRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { useMyMeetings, MeetingDrawer } from "./MeetingsViews.jsx";
import { G, GlassCard, GlassRow, GlassPill, GlassButton } from "../glass/Glass.jsx";
import { SectionCard } from "../kit/UI.jsx";
import { fmtTime } from "../../lib/collab.js";
import { isoDate } from "../../lib/utils.js";

const MODE = { video: VideocamRounded, in_person: PlaceRounded, phone: PhoneRounded };

export function useTodayMeetings() {
  const list = useMyMeetings();
  const today = isoDate();
  return list.filter((m) => m.status !== "cancelled" && isoDate(new Date(m.start)) === today);
}

export default function TodayMeetingsCard({ glass = true, sx }) {
  const { data } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(null);
  const today = useTodayMeetings();
  const now = new Date().toISOString();
  const clientOf = (m) => (data.clients || []).find((c) => c.id === m.client_id);
  const rows = today.map((m) => {
    const Icon = MODE[m.mode] || GroupsRounded;
    const live = m.start <= now && m.end >= now;
    const done = m.end < now;
    const sub = `${fmtTime(m.start)}–${fmtTime(m.end)} · ${m.kind === "client" ? `Client · ${clientOf(m)?.company || "client"}` : "Internal"} · ${m.mode === "in_person" ? m.location || "In person" : m.mode === "video" ? "Video call" : "Phone"}`;
    return { m, Icon, live, done, sub };
  });
  const title = "Meetings for today";
  const subtitle = today.length ? `${today.length} meeting${today.length > 1 ? "s" : ""} · ${today.filter((m) => m.kind === "client").length} with clients` : "Nothing booked today";
  const body = rows.length === 0 ? (
    <Typography sx={{ fontSize: "0.68rem", color: glass ? G.muted : "#78827b" }}>No meetings today. Book one from Calendar → Meetings.</Typography>
  ) : glass ? (
    rows.map(({ m, Icon, live, done, sub }) => (
      <GlassRow key={m.id} left={<Icon sx={{ color: live ? G.mint : G.faint, fontSize: 20 }} />} title={m.title} sub={sub} right={<GlassPill tone={live ? "good" : done ? "fog" : "info"}>{live ? "Now" : done ? "Done" : fmtTime(m.start)}</GlassPill>} onClick={() => setOpen(m.id)} />
    ))
  ) : (
    rows.map(({ m, Icon, live, done, sub }) => (
      <Stack key={m.id} direction="row" spacing={1.2} role="button" onClick={() => setOpen(m.id)} sx={{ px: 2, py: 1.2, borderBottom: "1px solid #f0f2ef", alignItems: "center", cursor: "pointer", "&:hover": { background: "#fbfdfb" } }}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1, display: "grid", placeItems: "center", background: m.kind === "client" ? "#fff4e5" : "#e6f7f2", color: m.kind === "client" ? "#b26a00" : "#0B8C8C" }}>{m.kind === "client" ? <BusinessRounded sx={{ fontSize: 17 }} /> : <Icon sx={{ fontSize: 17 }} />}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{m.title}</Typography>
          <Typography noWrap sx={{ fontSize: "0.6rem", color: "#78827b" }}>{sub}</Typography>
        </Box>
        <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: live ? "#0B8C8C" : "#78827b" }}>{live ? "Now" : done ? "Done" : fmtTime(m.start)}</Typography>
      </Stack>
    ))
  );
  return (
    <>
      {glass ? (
        <GlassCard title={title} subtitle={subtitle} action={<GlassButton onClick={() => navigate("/meetings")}>All meetings</GlassButton>} sx={sx}>{body}</GlassCard>
      ) : (
        <SectionCard title={title} subtitle={subtitle} noPad sx={sx}>{body}</SectionCard>
      )}
      <MeetingDrawer id={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** v10.4.1: the list behind the "Meetings today" square box — a click on a meeting opens its full details. */
export function TodayMeetingsDialog({ open, onClose }) {
  const { data } = useStore();
  const navigate = useNavigate();
  const [sel, setSel] = useState(null);
  const today = useTodayMeetings();
  const now = new Date().toISOString();
  const clientOf = (m) => (data.clients || []).find((c) => c.id === m.client_id);
  return (
    <>
      <Dialog open={open && !sel} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>Meetings for today</DialogTitle>
        <Typography sx={{ px: 3, fontSize: "0.65rem", color: "#78827b" }}>{today.length ? `${today.length} meeting${today.length > 1 ? "s" : ""} · ${today.filter((m) => m.kind === "client").length} with clients · click one for details` : "Nothing booked today"}</Typography>
        <DialogContent sx={{ px: 0, pt: 1.5 }}>
          {today.length === 0 && <Typography sx={{ px: 3, py: 2, fontSize: "0.7rem", color: "#78827b" }}>No meetings today. Book one from Calendar → Meetings.</Typography>}
          {today.map((m) => {
            const Icon = MODE[m.mode] || GroupsRounded;
            const live = m.start <= now && m.end >= now;
            const done = m.end < now;
            return (
              <Stack key={m.id} direction="row" spacing={1.4} role="button" onClick={() => setSel(m.id)} sx={{ px: 3, py: 1.3, borderTop: "1px solid #f0f2ef", alignItems: "center", cursor: "pointer", "&:hover": { background: "#fbfdfb" } }}>
                <Box sx={{ width: 34, height: 34, borderRadius: 1, display: "grid", placeItems: "center", background: m.kind === "client" ? "#fff4e5" : "#e6f7f2", color: m.kind === "client" ? "#b26a00" : "#0B8C8C" }}>{m.kind === "client" ? <BusinessRounded sx={{ fontSize: 18 }} /> : <Icon sx={{ fontSize: 18 }} />}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: "0.74rem", fontWeight: 700 }}>{m.title}</Typography>
                  <Typography noWrap sx={{ fontSize: "0.6rem", color: "#78827b" }}>{fmtTime(m.start)}–{fmtTime(m.end)} · {m.kind === "client" ? `Client · ${clientOf(m)?.company || "client"}` : "Internal"} · {m.mode === "in_person" ? m.location || "In person" : m.mode === "video" ? "Video call" : "Phone"}</Typography>
                </Box>
                <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, color: live ? "#0B8C8C" : "#78827b" }}>{live ? "Now" : done ? "Done" : fmtTime(m.start)}</Typography>
              </Stack>
            );
          })}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={onClose}>Close</Button>
          <Button variant="contained" onClick={() => { onClose(); navigate("/meetings"); }}>All meetings</Button>
        </DialogActions>
      </Dialog>
      <MeetingDrawer id={sel} onClose={() => setSel(null)} />
    </>
  );
}

/** Square box value + note for "Meetings today". */
export function useMeetingsBox() {
  const today = useTodayMeetings();
  const now = new Date().toISOString();
  const next = today.find((m) => m.end >= now);
  return { count: today.length, note: next ? `Next ${fmtTime(next.start)} · ${next.title}` : today.length ? "All done for today" : "Nothing booked today" };
}
