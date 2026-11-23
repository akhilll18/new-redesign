// New joiner onboarding checklist (employee view).
import React from "react";
import { Box, Button, Checkbox, LinearProgress, Stack, Typography } from "@mui/material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, Tag, KeyVal } from "../../components/kit/UI.jsx";
import { fmtDate, isoDate } from "../../lib/utils.js";

export function dueDate(doj, offset) {
  return isoDate(new Date(`${doj}T12:00:00`).getTime() + offset * 86400000);
}

export default function MyOnboarding() {
  const { data, user, toggleOnbTask, notifyToast, nameOf } = useStore();
  const o = data.onboarding.find((x) => x.employee_code === user.employee_code);
  if (!o) return <PageHeader title="Onboarding" subtitle="You have no onboarding checklist." />;
  const done = o.done.filter(Boolean).length;
  return (
    <>
      <PageHeader eyebrow="ME · ONBOARDING" title={`Welcome, ${o.name.split(" ")[0]}`} subtitle={`Your first 30 days as ${o.role} in ${o.dept}. HR completes most steps; two are yours.`} />
      <Stack spacing={2.5}>
        <SectionCard>
          <KeyVal cols={4} items={[["Start date", fmtDate(o.doj)], ["Buddy", o.buddy ? nameOf(o.buddy) : "Being assigned"], ["Progress", `${done} of ${o.done.length} steps`], ["Manager", nameOf(data.employees.find((e) => e.employee_code === user.employee_code)?.reporting_manager)]]} />
          <LinearProgress variant="determinate" value={(done / o.done.length) * 100} sx={{ height: 8, borderRadius: 4, mt: 2 }} />
        </SectionCard>
        <SectionCard title="Checklist" noPad>
          {data.onbTasks.map(([t, off], i) => {
            const due = dueDate(o.doj, off);
            const mine = [1, 5].includes(i);
            const overdue = !o.done[i] && due < isoDate();
            return (
              <Stack key={t} direction="row" spacing={1.5} sx={{ px: 2, py: 1.2, borderBottom: "1px solid #f0f2ef", alignItems: "center" }}>
                <Checkbox checked={!!o.done[i]} disabled={!mine} onChange={() => { const r = toggleOnbTask(o.id, i); if (!r.ok) notifyToast(r.error, "error"); }} slotProps={{ input: { "aria-label": t } }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, textDecoration: o.done[i] ? "line-through" : "none", color: o.done[i] ? "#8a948d" : "#26322a" }}>{t}</Typography>
                  <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>Day {off < 0 ? off : `+${off}`} · due {fmtDate(due)} · {mine ? "you" : "HR"}</Typography>
                </Box>
                {o.done[i] ? <Tag tone="good">Done</Tag> : overdue ? <Tag tone="bad">Overdue</Tag> : mine ? <Tag tone="warn">Your step</Tag> : <Tag>HR</Tag>}
              </Stack>
            );
          })}
        </SectionCard>
        {o.done[5] === false && <Button variant="outlined" sx={{ alignSelf: "flex-start" }} href="#/documents">Read the policies in Documents</Button>}
      </Stack>
    </>
  );
}
