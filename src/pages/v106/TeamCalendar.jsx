// v10.6 · Team calendar for reporting managers: a month grid (or any custom date range) with each team member's name on
// the days they are on leave, absent, late, on a holiday or working — under My team → Team summary.
import React, { useMemo, useState } from "react";
import { Box, Card, Chip, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { ChevronLeftRounded, ChevronRightRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard } from "../../components/kit/UI.jsx";
import { dayAttendance } from "../../lib/hrcalc.js";
import { isoDate } from "../../lib/utils.js";

const KIND = {
  leave: ["On leave", "#1E88E5", "#E7F2FD"],
  pending: ["Leave pending", "#7E57C2", "#F1ECFA"],
  late: ["Late", "#F27C22", "#FEF1E6"],
  absent: ["Absent", "#E53950", "#FDECEE"],
  present: ["Present", "#1F9D63", "#E6F6EE"],
  holiday: ["Holiday", "#D99A00", "#FFF8DB"],
};

export default function TeamCalendar() {
  const { data, user, reportsOf } = useStore();
  const team = reportsOf(user.employee_code).filter((e) => e.status === "active");
  const now = new Date();
  const [mode, setMode] = useState("month");
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(isoDate());
  const [show, setShow] = useState({ leave: true, pending: true, late: true, absent: true, present: false, holiday: true });
  const today = isoDate();

  const days = useMemo(() => {
    const out = [];
    if (mode === "month") {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
      for (let i = 0; i < 42; i += 1) { const d = new Date(start); d.setDate(start.getDate() + i); out.push({ iso: isoDate(d), inMonth: d.getMonth() === cursor.getMonth(), d }); }
    } else {
      for (let d = new Date(`${from}T12:00:00`); isoDate(d) <= to && out.length < 62; d.setDate(d.getDate() + 1)) out.push({ iso: isoDate(d), inMonth: true, d: new Date(d) });
    }
    return out;
  }, [mode, cursor, from, to]);

  const entriesFor = (iso) => {
    const wd = new Date(`${iso}T12:00:00`).getDay();
    const hol = (data.holidays || []).find((h) => h.date === iso && h.type !== "optional");
    const list = [];
    if (hol && show.holiday) list.push({ kind: "holiday", name: hol.name });
    team.forEach((e) => {
      const lv = data.requests.find((r) => r.type === "leave" && r.employee_code === e.employee_code && ["Approved", "Pending"].includes(r.status) && r.from_date <= iso && r.to_date >= iso);
      if (lv) { const k = lv.status === "Approved" ? "leave" : "pending"; if (show[k]) list.push({ kind: k, name: e.full_name.split(" ")[0], full: `${e.full_name} · ${lv.leave_type} ${lv.status.toLowerCase()}` }); return; }
      if (wd === 0 || wd === 6 || hol || iso > today) return;
      const a = dayAttendance(data.punches.filter((p) => p.employee_code === e.employee_code && p.ts.startsWith(iso)), { grace: data.settings.late_after });
      const k = a.inT ? (a.late ? "late" : "present") : "absent";
      if (show[k]) list.push({ kind: k, name: e.full_name.split(" ")[0], full: `${e.full_name} · ${KIND[k][0]}${a.inT ? ` · in ${a.inT}${a.outT ? `, out ${a.outT}` : ""}` : ""}` });
    });
    return list;
  };

  return (
    <SectionCard title="Team calendar" subtitle={`${team.length} people · names on each day · switch to a custom date range for any period`}
      action={<Stack direction="row" spacing={0.6}><Chip size="small" label="Month" onClick={() => setMode("month")} color={mode === "month" ? "primary" : "default"} /><Chip size="small" label="Custom dates" onClick={() => setMode("custom")} color={mode === "custom" ? "primary" : "default"} /></Stack>}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 1.5, alignItems: { md: "center" } }}>
        {mode === "month" ? (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <IconButton size="small" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeftRounded /></IconButton>
            <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", minWidth: 130, textAlign: "center" }}>{cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</Typography>
            <IconButton size="small" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month"><ChevronRightRounded /></IconButton>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1}>
            <TextField size="small" type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
        )}
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={0.6} useFlexGap sx={{ flexWrap: "wrap" }}>
          {Object.entries(KIND).map(([k, [l, c, bg]]) => <Chip key={k} size="small" label={l} onClick={() => setShow({ ...show, [k]: !show[k] })} sx={{ fontSize: "0.6rem", fontWeight: 700, bgcolor: show[k] ? bg : "#f3f5f6", color: show[k] ? c : "#9aa7ac", border: `1px solid ${show[k] ? c : "#e3e9ec"}` }} />)}
        </Stack>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: mode === "month" ? "repeat(7, minmax(0,1fr))" : "repeat(auto-fill, minmax(150px, 1fr))", gap: 0.6 }}>
        {mode === "month" && ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <Typography key={d} sx={{ fontSize: "0.6rem", fontWeight: 800, color: "#7b878c", textAlign: "center" }}>{d}</Typography>)}
        {days.map(({ iso, inMonth, d }) => {
          const list = entriesFor(iso);
          const wk = [0, 6].includes(d.getDay());
          return (
            <Card key={iso} variant="outlined" sx={{ p: 0.6, minHeight: 84, opacity: inMonth ? 1 : 0.45, background: iso === today ? "#FDEBF3" : wk ? "#fafbfb" : "#fff", borderColor: iso === today ? "#D94F8A" : undefined }}>
              <Typography sx={{ fontSize: "0.6rem", fontWeight: 800, color: iso === today ? "#D94F8A" : "#5d6b70" }}>{mode === "month" ? d.getDate() : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</Typography>
              <Stack spacing={0.3} sx={{ mt: 0.3 }}>
                {list.slice(0, 4).map((x, i) => (
                  <Tooltip key={i} title={x.full || x.name}>
                    <Box sx={{ px: 0.5, borderRadius: 1, background: KIND[x.kind][2], color: KIND[x.kind][1], fontSize: "0.56rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.name}</Box>
                  </Tooltip>
                ))}
                {list.length > 4 && <Typography sx={{ fontSize: "0.52rem", color: "#7b878c" }}>+{list.length - 4} more</Typography>}
              </Stack>
            </Card>
          );
        })}
      </Box>
    </SectionCard>
  );
}
