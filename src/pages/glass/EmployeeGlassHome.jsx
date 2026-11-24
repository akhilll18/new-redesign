// Employee home: glass dashboard with the punch orb, today's picture, balances, team view for managers.
import { isRestrictedWorker, isZeroLeaveWorker } from "../../lib/statutory.js";
import { useTodayMeetings, TodayMeetingsDialog } from "../../components/collab/TodayMeetings.jsx";
import { docChecklist } from "../../lib/empdocs.js";
import { ijpOf } from "../suite/Ijp.jsx";
import { inboxCount } from "../inbox/InboxHub.jsx";
import { IT_OPEN } from "../../lib/itdesk.js";
import { MailRounded, FolderRounded, SupportAgentRounded, WorkRounded, AccountBalanceWalletRounded, EventRounded } from "@mui/icons-material";
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Stack, Typography } from "@mui/material";
import { EventAvailableRounded, ReceiptLongRounded, StarsRounded, FlagRounded, PhoneInTalkRounded, InsightsRounded, ScheduleRounded, InventoryRounded, AddRounded, HistoryEduRounded, PlaceRounded, ViewQuiltRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { G, GlassCard, GlassStat, GlassGrid, GlassBars, GlassButton, GlassRow, GlassPill, GlassAvatar, Ring, SplitBar, DemoClockNote } from "../../components/glass/Glass.jsx";
import PunchPanel from "../../components/workforce/PunchPanel.jsx";
import { lastNDays, dayAttendance, callStats, productivity, isWeekend } from "../../lib/hrcalc.js";
import { register, registerCounts, activityFor } from "../../lib/workforce.js";
import { isoDate, fmtNum, timeAgo } from "../../lib/utils.js";
import { REQUEST_TYPES } from "../../lib/requests.js";
import { AiInsight } from "../../components/ai/AiInsight.jsx";
import { holidaysFor } from "../../country/countryPacks.js";
import { VibePopup, CelebrationsCard, WeekHoursList } from "../v106/HomeExtras.jsx";

export default function EmployeeGlassHome({ classic, view = "glass", onView = () => {} }) {
  const store = useStore();
  const { data, user, leaveBalanceOf, balanceOf, reportsOf, pendingForManager, nameOf } = store;
  const navigate = useNavigate();
  const e = data.employees.find((x) => x.employee_code === user.employee_code);
  const today = isoDate();
  const hour = new Date().getHours();
  const team = reportsOf(e.employee_code).filter((x) => x.status === "active");
  const isManager = team.length > 0;

  const week = useMemo(
    () =>
      lastNDays(7).map((d) => {
        const a = dayAttendance(data.punches.filter((p) => p.employee_code === e.employee_code && p.ts.startsWith(d)), { grace: data.settings.late_after });
        return { label: new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short" }), short: new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "narrow" }), value: +a.hours.toFixed(1), weekend: isWeekend(d) };
      }),
    [data.punches, e.employee_code, data.settings.late_after],
  );
  const weekHours = week.reduce((s, d) => s + d.value, 0);
  const el = leaveBalanceOf(e.employee_code).find((b) => b.code === "EL");
  const cl = leaveBalanceOf(e.employee_code).find((b) => b.code === "CL");
  const myGoals = data.goals.filter((g) => g.employee_code === e.employee_code);
  const goalPct = myGoals.length ? Math.round(myGoals.reduce((s, g) => s + g.progress * g.weight, 0) / Math.max(1, myGoals.reduce((s, g) => s + g.weight, 0))) : 0;
  const myCalls = data.calls.filter((c) => c.employee_code === e.employee_code && c.ts.startsWith(today));
  const cs = callStats(myCalls);
  const act = activityFor(data, e.employee_code, today);
  const prod = productivity(act);
  const consent = data.consents[e.employee_code];
  const openReqs = data.requests.filter((r) => r.employee_code === e.employee_code && r.status === "Pending");
  const myAssets = data.assets.filter((a) => a.assigned_to === e.employee_code);
  const toAck = myAssets.filter((a) => !a.acknowledged);
  const nextHoliday = holidaysFor(data, e).find((h) => h.date >= today);
  const onb = data.onboarding.find((o) => o.employee_code === e.employee_code);
  const praise = data.feedback.filter((f) => f.to === e.employee_code && (f.visibility === "public" || f.to === e.employee_code)).slice(0, 2);
  const live = data.locations[e.employee_code];
  const review = data.reviews[e.employee_code];
  const teamRows = isManager ? register(data, team) : [];
  const tc = registerCounts(teamRows);
  const pend = isManager ? pendingForManager(e.employee_code) : { requests: [], points: [] };
  // v10.4 quick info: meetings today, inbox, latest payslip, documents, IT tickets, internal jobs.
  const meetingsToday = useTodayMeetings();
  const [mtgOpen, setMtgOpen] = React.useState(false);
  const zeroLeave = isZeroLeaveWorker(e, data.settings);
  const unread = data.notifications.filter((n) => n.to === user.code && !n.read).length;
  const inboxN = unread + inboxCount(data, user, store);
  const slips = isRestrictedWorker(e, data.settings) ? [] : data.payslipBatches.filter((b) => b.status === "Released" && b.slips.some((sl) => sl.employee_code === e.employee_code)).map((b) => b.period).sort();
  const lastSlip = slips[slips.length - 1];
  const docs = docChecklist(data, e);
  const myTickets = (data.itTickets || []).filter((t) => t.requester === user.code && IT_OPEN.includes(t.status));
  const ijpOpen = ijpOf(data).postings.filter((p) => p.status === "open").length;
  const nextMeeting = meetingsToday.find((m) => m.end >= new Date().toISOString());

  const upcoming = [
    data.cycle.stage === "self_review" && !review?.self && { icon: <HistoryEduRounded />, title: "Self review is open", sub: `Due ${data.cycle.self_due} · ${data.cycle.name}`, to: "/performance-me" },
    toAck.length > 0 && { icon: <InventoryRounded />, title: `Confirm receipt of ${toAck.length} asset${toAck.length > 1 ? "s" : ""}`, sub: toAck.map((a) => a.asset_id).join(", "), to: "/assets" },
    onb && onb.done.some((d) => !d) && { icon: <ScheduleRounded />, title: "Finish your onboarding", sub: `${onb.done.filter(Boolean).length} of ${onb.done.length} steps done`, to: "/onboarding-me" },
    !consent && { icon: <PlaceRounded />, title: "Choose your monitoring settings", sub: "Location while clocked in and work activity", to: "/attendance" },
    nextHoliday && { icon: <EventAvailableRounded />, title: nextHoliday.name, sub: `${new Date(`${nextHoliday.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}${nextHoliday.type === "floater" ? " · floater" : ""}`, to: "/leave" },
  ].filter(Boolean);

  if (view === "classic" && classic) {
    return (
      <Box>
        <VibePopup />
        <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 1.5 }}>
          <GlassButton sx={{ color: "#244d3d", background: "#e8f2ec", border: "1px solid #d5e5da" }} startIcon={<ViewQuiltRounded />} onClick={() => onView("glass")}>Glass dashboard</GlassButton>
        </Stack>
        {classic}
      </Box>
    );
  }

  return (
    <Box sx={{ color: G.fog }}>
      <VibePopup />
      <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", alignItems: { md: "flex-end" }, mb: 2.5, gap: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: "0.7rem", color: G.muted }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</Typography>
          <Typography component="h1" sx={{  fontWeight: 800, fontSize: { xs: "1.6rem", md: "2.1rem" }, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            {hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, {e.full_name.split(" ")[0]}
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: G.muted, mt: 0.5 }}>{e.designation} in {e.department}{e.reporting_manager ? `, reporting to ${nameOf(e.reporting_manager)}` : ""}</Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <GlassButton variant="solid" startIcon={<AddRounded />} onClick={() => navigate("/leave?new=1")}>{zeroLeave ? "Request leave" : "Apply leave"}</GlassButton>
          <GlassButton startIcon={<ReceiptLongRounded />} onClick={() => navigate("/expenses")}>Claim expense</GlassButton>
          {classic && <GlassButton startIcon={<ViewQuiltRounded />} onClick={() => onView("classic")}>Classic view</GlassButton>}
        </Stack>
      </Stack>

      <AiInsight
        variant="glass"
        title="Your AI daily brief"
        audience={`${e.full_name.split(" ")[0]}, an employee${isManager ? " who manages a team" : ""}`}
        sx={{ mb: 1.6 }}
        facts={[
          upcoming[0] && `Top item for today: ${upcoming[0].title} (${upcoming[0].sub})`,
          `${weekHours.toFixed(1)} hours worked over the last 7 days`,
          zeroLeave ? "Leave balance is 0 (request-level leave for this worker type)" : el && `Earned leave: ${el.available} day(s) available`,
          !zeroLeave && cl && `Casual leave: ${cl.available} day(s) available`,
          meetingsToday.length > 0 && `${meetingsToday.length} meeting(s) today${nextMeeting ? `; next: ${nextMeeting.title}` : ""}`,
          openReqs.length > 0 && `${openReqs.length} of your request(s) are pending: ${openReqs.map((r) => `${REQUEST_TYPES[r.type]?.label} ${r.request_id}`).join(", ")}`,
          myGoals.length > 0 && `Goal progress ${goalPct}% overall; ${myGoals.filter((g) => g.status === "at_risk").length} goal(s) at risk`,
          toAck.length > 0 && `${toAck.length} asset(s) waiting for your acknowledgement`,
          nextHoliday && `Next holiday: ${nextHoliday.name} on ${nextHoliday.date}`,
          isManager && `Team today: ${tc.present} on time, ${tc.late} late, ${tc.leave} on leave, ${tc.absent + tc.not_in} not in`,
          isManager && pend.requests.length + pend.points.length > 0 && `${pend.requests.length + pend.points.length} team approval(s) waiting for you`,
        ]}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.55fr 1fr" }, gap: 1.6, mb: 1.6 }}>
        <GlassCard level={2} pad={2.6} radius="26px">
          <PunchPanel dark />
        </GlassCard>
        <GlassCard title="Today" subtitle={data.demo_clock ? `Demo clock ${data.demo_clock.at}` : undefined}>
          <Stack spacing={1.4}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Ring value={weekHours} max={40} label={`${weekHours.toFixed(0)} h`} sub="this week" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <WeekHoursList week={week} />
              </Box>
            </Stack>
            <GlassRow left={<PlaceRounded sx={{ color: live ? G.mint : G.faint, fontSize: 20 }} />} title={live ? "Sharing location while clocked in" : consent?.location ? "Location shares after you clock in" : "Live location is off"} sub={consent ? `Activity tracking ${consent.activity ? "on" : "off"} · change in My activity` : "You have not chosen your monitoring settings"} onClick={() => navigate("/attendance")} right={<GlassPill tone={live ? "good" : "fog"}>{live ? "Live" : "Off"}</GlassPill>} />
            {openReqs.length > 0 && <GlassRow left={<ScheduleRounded sx={{ color: G.saffron, fontSize: 20 }} />} title={`${openReqs.length} request${openReqs.length > 1 ? "s" : ""} waiting`} sub={openReqs.map((r) => `${REQUEST_TYPES[r.type].label} with ${nameOf(r.steps.find((s) => s.status === "pending")?.approver)}`).slice(0, 2).join(" · ")} onClick={() => navigate("/inbox")} />}
            <DemoClockNote clock={data.demo_clock} />
          </Stack>
        </GlassCard>
      </Box>

      <GlassGrid min={170} sx={{ mb: 1.6 }}>
        {zeroLeave
          ? <GlassStat label="Leave balance" value="0" hint="Request-level leave · your manager approves" icon={<EventAvailableRounded />} onClick={() => navigate("/leave?new=1")} />
          : <GlassStat label="Earned leave" value={el?.available ?? "—"} hint={`Casual ${cl?.available ?? 0} · pending ${el?.pending ?? 0}`} icon={<EventAvailableRounded />} onClick={() => navigate("/leave")} />}
        <GlassStat label="Goal progress" value={`${goalPct}%`} hint={`${myGoals.filter((g) => g.status === "at_risk").length} at risk · ${data.cycle.name}`} icon={<FlagRounded />} onClick={() => navigate("/performance-me")} />
        {e.call_tracking === "yes" && <GlassStat label="Calls today" value={`${cs.total}/${data.settings.call_daily_target}`} hint={`${cs.connectRate}% connected · ${cs.talkMin} min talk`} icon={<PhoneInTalkRounded />} tone="info" onClick={() => navigate("/calls")} />}
        <GlassStat label="Focus today" value={consent?.activity ? `${prod.productivePct}%` : "Off"} hint={consent?.activity ? `${Math.round(prod.active / 60 * 10) / 10} h active · ${prod.idlePct}% idle` : "Activity tracking needs your consent"} icon={<InsightsRounded />} tone="fog" onClick={() => navigate("/attendance")} />
      </GlassGrid>

      <Typography sx={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.12em", color: G.faint, mb: 0.8 }}>QUICK INFO</Typography>
      <GlassGrid min={isManager ? 124 : 140} sx={{ mb: 1.6 }}>
        <GlassStat label="Inbox" value={inboxN} hint={`${unread} unread notification${unread === 1 ? "" : "s"}`} icon={<MailRounded />} onClick={() => navigate("/inbox")} />
        {!isRestrictedWorker(e, data.settings) && <GlassStat label="Latest payslip" value={lastSlip ? new Date(`${lastSlip}-01T12:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—"} hint={lastSlip ? "Released · view or download" : "Appears once released"} icon={<AccountBalanceWalletRounded />} tone="fog" onClick={() => navigate("/finances")} />}
        <GlassStat label="Documents" value={docs.missing ? `${docs.missing} to upload` : "Complete"} hint="My profile → Documents" icon={<FolderRounded />} tone={docs.missing ? "saffron" : "mint"} onClick={() => navigate("/documents")} />
        <GlassStat label="IT tickets" value={myTickets.length} hint={myTickets.length ? "Open with IT support" : "No open tickets"} icon={<SupportAgentRounded />} tone="fog" onClick={() => navigate("/assets")} />
        <GlassStat label="Internal jobs" value={ijpOpen} hint="Open IJP postings · apply or move" icon={<WorkRounded />} onClick={() => navigate("/ijp")} />
        <GlassStat label="My requests" value={openReqs.length} hint={openReqs.length ? "Waiting for approval" : "Nothing pending"} icon={<ScheduleRounded />} tone={openReqs.length ? "saffron" : "mint"} onClick={() => navigate("/inbox")} />
        <GlassStat label="Meetings today" value={meetingsToday.length} hint={nextMeeting ? `Next ${new Date(nextMeeting.start).toTimeString().slice(0, 5)} · ${nextMeeting.title}` : meetingsToday.length ? "All done for today" : "Nothing booked today"} icon={<EventRounded />} tone="info" onClick={() => setMtgOpen(true)} />
      </GlassGrid>
      <TodayMeetingsDialog open={mtgOpen} onClose={() => setMtgOpen(false)} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: isManager ? "repeat(4, minmax(0,1fr))" : "repeat(3, minmax(0,1fr))" }, gap: 1.6 }}>
        {isManager && (
          <GlassCard title="My team today" subtitle={`${team.length} direct reports`} action={<GlassButton onClick={() => navigate("/inbox")}>{pend.requests.length + pend.points.length} to approve</GlassButton>}>
            <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: "wrap" }}>{[["On time", tc.present, "good"], ["Late", tc.late, "warn"], ["On leave", tc.leave, "info"], ["Not in", tc.absent + tc.not_in, "bad"], ["Out", tc.out, "fog"]].map(([l, n, t]) => <GlassPill key={l} tone={t}>{l} · {n}</GlassPill>)}</Stack>
            <Box sx={{ mt: 1.4 }}>
              {teamRows.slice(0, 5).map((r) => (
                <GlassRow key={r.e.employee_code} left={<GlassAvatar name={r.e.full_name} />} title={r.e.full_name} sub={r.inT ? `In ${r.inT}${r.outT ? ` · out ${r.outT}` : ""} · ${(r.source || "").replace("_", " ")}` : r.status === "leave" ? "On leave" : "No punch yet"} right={<GlassPill tone={{ present: "good", late: "warn", leave: "info", absent: "bad" }[r.status] || "fog"}>{{ present: "On time", late: "Late", leave: "Leave", absent: "Not in", not_in: "Not in yet", out: "Out", weekend: "Off" }[r.status]}</GlassPill>} onClick={() => navigate("/team-live")} />
              ))}
            </Box>
          </GlassCard>
        )}
        <CelebrationsCard />
        <GlassCard title="Coming up" subtitle="Things that need you">
          {upcoming.length === 0 ? <Typography sx={{ fontSize: "0.68rem", color: G.muted }}>Nothing pending. Enjoy your day.</Typography> : upcoming.map((u) => <GlassRow key={u.title} left={<Box sx={{ color: G.mint, display: "grid", "& svg": { fontSize: 20 } }}>{u.icon}</Box>} title={u.title} sub={u.sub} onClick={() => navigate(u.to)} />)}
        </GlassCard>
        <GlassCard title="Recognition and assets">
          {praise.map((f) => <GlassRow key={f.id} left={<GlassAvatar name={nameOf(f.from)} />} title={f.text} sub={`${nameOf(f.from)} · ${timeAgo(f.at)}`} onClick={() => navigate("/performance-me")} />)}
          {myAssets.slice(0, 3).map((a) => <GlassRow key={a.asset_id} left={<InventoryRounded sx={{ color: G.faint, fontSize: 20 }} />} title={`${a.category} · ${a.model}`} sub={`${a.asset_id} · ${a.acknowledged ? "receipt confirmed" : "confirm receipt"}`} right={!a.acknowledged ? <GlassPill tone="warn">Action</GlassPill> : null} onClick={() => navigate("/assets")} />)}
          {praise.length + myAssets.length === 0 && <Typography sx={{ fontSize: "0.68rem", color: G.muted }}>Praise from colleagues and your assigned assets show here.</Typography>}
        </GlassCard>
      </Box>
    </Box>
  );
}
