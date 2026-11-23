// v10.6 · Home page additions: the "How's your vibe today?" pop-up after sign-in (once a day), work anniversaries and
// birthdays on the home page, and a compact week summary that replaces the bar charts on the employee home.
import React, { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogContent, IconButton, Stack, Typography } from "@mui/material";
import { CloseRounded, CakeRounded, CelebrationRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { GlassCard, GlassRow, GlassAvatar, G } from "../../components/glass/Glass.jsx";
import { MOODS, upcoming } from "../suite/PeopleXP.jsx";
import { isoDate } from "../../lib/utils.js";

const MOOD_TONE = ["#E53950", "#F27C22", "#D99A00", "#1E88E5", "#1F9D63"];

export function VibePopup() {
  const { data, user, suiteDo, notifyToast } = useStore();
  const today = isoDate();
  const me = user.employee_code || user.code;
  const answered = (data.suite?.pulses || []).some((p) => p.emp === me && p.date === today);
  const key = `ezy-vibe-${me}-${today}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let skipped = false;
    try { skipped = sessionStorage.getItem(key) === "skip"; } catch { /* storage off */ }
    if (!answered && !skipped) { const t = setTimeout(() => setOpen(true), 600); return () => clearTimeout(t); }
    return undefined;
  }, [answered, key]);
  const close = () => { try { sessionStorage.setItem(key, "skip"); } catch { /* storage off */ } setOpen(false); };
  const pick = (m) => {
    suiteDo("pulse", (x, { now }) => { x.pulses = [...(x.pulses || []).filter((p) => !(p.emp === me && p.date === today)), { emp: me, date: today, mood: m, at: now }]; }, { action: "PULSE", details: "daily pulse (sign-in)" });
    notifyToast("Thanks — your answer is anonymous in team reports.");
    setOpen(false);
  };
  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4, overflow: "hidden" } } }}>
      <Box sx={{ bgcolor: "primary.light", px: 3, pt: 2.5, pb: 2, position: "relative" }}>
        <IconButton size="small" onClick={close} sx={{ position: "absolute", right: 8, top: 8 }} aria-label="Skip for today"><CloseRounded fontSize="small" /></IconButton>
        <Typography sx={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "1px", color: "primary.main" }}>DAILY PULSE · ANONYMOUS</Typography>
        <Typography sx={{  fontWeight: 800, fontSize: "1.25rem", mt: 0.4 }}>How's your vibe today, {user.full_name.split(" ")[0]}?</Typography>
      </Box>
      <DialogContent sx={{ pt: 2.5 }}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
          {MOODS.map(([e, l], i) => (
            <Button key={l} onClick={() => pick(i + 1)} variant="outlined" sx={{ flexDirection: "column", minWidth: 0, flex: 1, py: 1.2, borderRadius: 3, borderColor: `${MOOD_TONE[i]}55`, color: MOOD_TONE[i], "&:hover": { background: `${MOOD_TONE[i]}14`, borderColor: MOOD_TONE[i] } }}>
              <span style={{ fontSize: 26 }}>{e}</span>
              <span style={{ fontSize: "0.62rem", fontWeight: 700 }}>{l}</span>
            </Button>
          ))}
        </Stack>
        <Typography sx={{ fontSize: "0.62rem", color: "#7b878c", mt: 1.5, textAlign: "center" }}>Only team averages are shown to HR. You can also answer later in Talent & recognition → People & recognition.</Typography>
      </DialogContent>
    </Dialog>
  );
}

/** Work anniversaries and birthdays in the next 10 days (home page). */
export function CelebrationsCard({ glass = true }) {
  const { data, user } = useStore();
  const navigate = useNavigate();
  const annivs = upcoming(data.employees, "date_of_joining", 14);
  const bdays = upcoming(data.employees, "date_of_birth", 10);
  const me = user.employee_code;
  const when = (n) => (n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`);
  const rows = [
    ...annivs.map((x) => ({ k: `a-${x.e.employee_code}`, icon: <CelebrationRounded sx={{ color: "#F27C22", fontSize: 20 }} />, title: `${x.e.employee_code === me ? "Your" : `${x.e.full_name}'s`} ${x.years}-year work anniversary`, sub: `${when(x.inDays)} · ${x.e.department}`, e: x.e })),
    ...bdays.map((x) => ({ k: `b-${x.e.employee_code}`, icon: <CakeRounded sx={{ color: "#D94F8A", fontSize: 20 }} />, title: `${x.e.employee_code === me ? "Your" : `${x.e.full_name}'s`} birthday`, sub: `${when(x.inDays)} · ${x.e.department}`, e: x.e })),
  ].slice(0, 6);
  if (!glass) return (
    <Box sx={{ mb: 2, p: 1.6, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: rows.length ? 1 : 0 }}>
        <CakeRounded sx={{ color: "#D94F8A", fontSize: 20 }} />
        <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", color: "#3a2a33" }}>Work anniversaries & birthdays</Typography>
        <Typography sx={{ fontSize: "0.62rem", color: "#8a7680" }}>· next two weeks</Typography>
        <Button size="small" sx={{ ml: "auto" }} onClick={() => navigate("/people-xp")}>Say well done</Button>
      </Stack>
      {rows.length === 0 ? <Typography sx={{ fontSize: "0.68rem", color: "#8a7680" }}>No celebrations coming up.</Typography> : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px,100%), 1fr))", gap: 1 }}>
          {rows.map((r) => <Stack key={r.k} direction="row" spacing={1} sx={{ alignItems: "center", p: 0.8, borderRadius: 2, background: "#fff", border: "1px solid #f1e6ea" }}>{r.icon}<Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontSize: "0.68rem", fontWeight: 700 }}>{r.title}</Typography><Typography noWrap sx={{ fontSize: "0.6rem", color: "#8a7680" }}>{r.sub}</Typography></Box></Stack>)}
        </Box>
      )}
    </Box>
  );
  return (
    <GlassCard title="Work anniversaries & birthdays" subtitle="Next two weeks · say well done in People & recognition">
      {rows.length === 0 ? <Typography sx={{ fontSize: "0.68rem", color: G.muted }}>No celebrations coming up.</Typography> : rows.map((r) => <GlassRow key={r.k} left={r.icon} title={r.title} sub={r.sub} right={<GlassAvatar name={r.e.full_name} />} onClick={() => navigate("/people-xp")} />)}
    </GlassCard>
  );
}

/** Replaces the vertical bar chart on the employee home: one line per day with hours (no bars). */
export function WeekHoursList({ week }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
      {week.map((d, i) => (
        <Box key={i} sx={{ textAlign: "center", py: 0.6, borderRadius: 2, background: d.weekend ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)" }}>
          <Typography sx={{ fontSize: "0.55rem", color: G.muted }}>{d.label}</Typography>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: d.value ? G.fog : G.faint }}>{d.value ? `${d.value}h` : "—"}</Typography>
        </Box>
      ))}
    </Box>
  );
}
