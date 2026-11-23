// Admin and Super Admin home: glass "org pulse" — who is in, where they are, what is waiting, and what is due.
import React, { useMemo } from "react";
import { useCountryFilter } from "../../country/CountryContext.jsx";
import { useNavigate } from "react-router-dom";
import { Box, Stack, Typography } from "@mui/material";
import { FactCheckRounded, FingerprintRounded, InventoryRounded, PhoneInTalkRounded, InsightsRounded, WorkRounded, PaymentsRounded, ShieldRounded, PublicRounded, PlaceRounded, HistoryRounded, ViewQuiltRounded, LockRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { G, GlassCard, GlassStat, GlassGrid, GlassBars, GlassButton, GlassRow, GlassPill, GlassAvatar, Ring, SplitBar, DemoClockNote } from "../../components/glass/Glass.jsx";
import LiveMap from "../../components/glass/LiveMap.jsx";
import { adminKind, payrollGroups } from "../../lib/statutory.js";
import { register, registerCounts, livePeople, teamActivity } from "../../lib/workforce.js";
import { callStats } from "../../lib/hrcalc.js";
import { COUNTRIES, filingCalendar } from "../../lib/payroll/index.js";
import { REQUEST_TYPES } from "../../lib/requests.js";
import { isoDate, timeAgo } from "../../lib/utils.js";
import { AiInsight } from "../../components/ai/AiInsight.jsx";
import HrDashboardWidgets from "../../components/dashboard/HrDashboardWidgets.jsx";
import { CelebrationsCard } from "../v106/HomeExtras.jsx";
import { TodayMeetingsDialog, useMeetingsBox } from "../../components/collab/TodayMeetings.jsx";
import { GroupsRounded as MeetingsIcon } from "@mui/icons-material";

// Employees this admin manages, narrowed to the country (or region) selected in the header — every module page follows it.
export function useScopedEmployees() {
  const { data, user, scopeUnits } = useStore();
  const inCountry = useCountryFilter();
  return useMemo(() => {
    if (user.role === "superadmin") return data.employees.filter(inCountry);
    const s = scopeUnits(user);
    return data.employees.filter((e) => s.has(e.department) && inCountry(e));
  }, [data.employees, user, scopeUnits, inCountry]);
}

const COUNTRY_FLAG_NAME = { IN: "India", GB: "UK", US: "US", AE: "UAE", SG: "Singapore" };

export default function OpsGlassHome({ classic, view = "glass", onView = () => {} }) {
  const { data, user, pendingForAdmin } = useStore();
  const navigate = useNavigate();
  const mtg = useMeetingsBox();
  const [mtgOpen, setMtgOpen] = React.useState(false);
  const isSuper = user.role === "superadmin";
  const emps = useScopedEmployees();
  const active = emps.filter((e) => e.status === "active");
  const today = isoDate();
  const has = (m) => isSuper || user.modules?.includes(m);
  // v10.3: Finance admins see finance, payment and attendance-for-pay information only.
  const fin = adminKind(user) === "finance";
  const groups = useMemo(() => (fin ? payrollGroups(data) : []), [fin, data]);

  const rows = useMemo(() => register(data, active), [data, active]); // eslint-disable-line react-hooks/exhaustive-deps
  const c = registerCounts(rows);
  const working = rows.filter((r) => r.status !== "weekend" && r.status !== "leave").length;
  const inNow = c.present + c.late;
  const people = useMemo(() => livePeople(data, active), [data, active]); // eslint-disable-line react-hooks/exhaustive-deps
  const homeFences = data.geofences.filter((g) => (g.country || "IN") === "IN" && g.active !== false);
  const mapPeople = people.filter((p) => (p.e.country_code || "IN") === "IN");
  const outside = people.filter((p) => p.status === "outside").length;
  const flagged = data.punches.filter((p) => p.flag && p.ts.startsWith(today) && active.some((e) => e.employee_code === p.employee_code));

  // Approvals
  const pend = isSuper ? { requests: data.requests.filter((r) => r.status === "Pending"), points: [], accounts: data.employees.filter((e) => e.status === "pending_approval"), payouts: data.requests.filter((r) => r.status === "Approved" && ["expense", "advance", "loan", "asset"].includes(r.type)) } : pendingForAdmin(user);
  const byType = {};
  pend.requests.forEach((r) => { byType[r.type] = (byType[r.type] || 0) + 1; });
  const approvalTotal = pend.requests.length + pend.points.length + pend.accounts.length + pend.payouts.length;

  // Devices, assets, calls, activity, hiring
  const devOnline = data.devices.filter((d) => d.status === "online").length;
  const myAssets = data.assets;
  const inStock = myAssets.filter((a) => a.status === "in_stock").length;
  const assigned = myAssets.filter((a) => a.assigned_to).length;
  const repair = myAssets.filter((a) => ["repair", "lost"].includes(a.status)).length;
  const callEmps = new Set(active.filter((e) => e.call_tracking === "yes").map((e) => e.employee_code));
  const callsToday = callStats(data.calls.filter((x) => callEmps.has(x.employee_code) && x.ts.startsWith(today)));
  const callWeek = Array.from({ length: 7 }, (_, i) => {
    const d = isoDate(Date.now() - (6 - i) * 86400000);
    return { label: new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short" }), short: new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "narrow" }), value: data.calls.filter((x) => callEmps.has(x.employee_code) && x.ts.startsWith(d)).length };
  });
  const act = teamActivity(data, active.filter((e) => data.consents[e.employee_code]?.activity)).filter((r) => r.a);
  const avgProd = act.length ? Math.round(act.reduce((s, r) => s + r.p.productivePct, 0) / act.length) : 0;
  const openReqs = data.reqs.filter((r) => !r.closed);
  const funnel = [["Applied", "app"], ["Screened", "scr"], ["Interviewed", "int"], ["Offered", "off"], ["Accepted", "acc"]].map(([s, k]) => ({ s, n: data.reqs.reduce((t, r) => t + (r[k] || 0), 0) }));

  // Payroll / compliance
  const countries = [...new Set(active.map((e) => e.country_code || "IN"))];
  const period = today.slice(0, 7);
  const filings = countries.flatMap((cc) => (COUNTRIES[cc] ? filingCalendar(cc, today).map((f) => ({ ...f, cc })) : [])).filter((f) => f.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 4);

  // Super-only
  const locked = [...data.employees, ...data.admins].filter((u) => u.status === "locked").length;
  const consented = active.filter((e) => data.consents[e.employee_code]).length;
  const failedLogins = data.audit.filter((a) => /LOGIN_FAIL|LOCK/.test(a.action) && a.timestamp.startsWith(today)).length;
  const exits12 = data.exits.filter((x) => x.d >= isoDate(Date.now() - 365 * 86400000)).length;
  const attrition = Math.round((exits12 / Math.max(1, active.length)) * 1000) / 10;
  const costInr = active.reduce((s, e) => s + e.monthly_gross * (data.fx[COUNTRIES[e.country_code || "IN"]?.currency] || 1), 0);

  if (view === "classic" && classic) {
    return (
      <Box>
        <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 1.5 }}>
          <GlassButton sx={{ color: "#244d3d", background: "#e8f2ec", border: "1px solid #d5e5da" }} startIcon={<ViewQuiltRounded />} onClick={() => onView("glass")}>Glass dashboard</GlassButton>
        </Stack>
        {classic}
      </Box>
    );
  }

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const statusParts = [
    { label: "On time", value: c.present, color: G.mint },
    { label: "Late", value: c.late, color: G.saffron },
    { label: "Clocked out", value: c.out, color: G.info },
    { label: "On leave", value: c.leave, color: "#C9B8F0" },
    { label: "Not in", value: c.absent + c.not_in, color: G.bad },
  ];

  return (
    <Stack spacing={2.2} sx={{ color: G.fog }}>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "flex-end" }, gap: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: "0.68rem", color: G.faint }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</Typography>
          <Typography component="h1" sx={{  fontWeight: 800, fontSize: { xs: "1.5rem", md: "1.9rem" }, lineHeight: 1.15, mt: 0.4 }}>
            {greet}, {user.full_name.split(" ")[0]}
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: G.muted, mt: 0.5 }}>
            {isSuper ? `Global pulse across ${countries.length} countries and ${active.length} people.` : `Your scope: ${user.org_units.join(", ")} · ${active.length} people · modules ${user.modules.length}`}
          </Typography>
          <DemoClockNote clock={data.demo_clock} />
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <GlassButton variant="solid" startIcon={<FactCheckRounded />} onClick={() => navigate(isSuper ? "/requests" : "/approvals")}>Approvals{approvalTotal ? ` · ${approvalTotal}` : ""}</GlassButton>
          {has("location") && <GlassButton startIcon={<PlaceRounded />} onClick={() => navigate("/live-map")}>Live map</GlassButton>}
          {classic && <GlassButton startIcon={<ViewQuiltRounded />} onClick={() => onView("classic")}>Classic view</GlassButton>}
        </Stack>
      </Stack>

      <AiInsight
        variant="glass"
        title={isSuper ? "AI company pulse" : "AI operations brief"}
        audience={isSuper ? "the Super Admin (company leadership)" : `an admin responsible for ${user.modules.join(", ")}`}
        facts={[
          `${inNow} of ${working} working people are in today (${c.present} on time, ${c.late} late, ${c.absent + c.not_in} not in, ${c.leave} on leave)`,
          approvalTotal > 0 && `${approvalTotal} approval(s) waiting: ${Object.entries(byType).map(([t, n]) => `${n} ${t}`).join(", ")}${pend.accounts.length ? `, ${pend.accounts.length} new account(s)` : ""}${pend.payouts?.length ? `, ${pend.payouts.length} payout(s)` : ""}`,
          flagged.length > 0 && `${flagged.length} punch(es) flagged today`,
          outside > 0 && `${outside} people currently outside their geofence`,
          `${devOnline} of ${data.devices.length} biometric devices online`,
          repair > 0 && `${repair} asset(s) in repair or lost; ${inStock} in stock`,
          !fin && callsToday.total > 0 && `${callsToday.total} sales calls logged today`,
          !fin && act.length > 0 && `Average productive time ${avgProd}% among consenting employees`,
          !fin && openReqs.length > 0 && `${openReqs.length} open job requisition(s)`,
          fin && `${groups.length} payroll group(s) across ${new Set(groups.map((g) => g.company.company_id)).size} legal entities; ${groups.reduce((n, g) => n + g.warnings.length, 0)} registration gap(s)`,
          filings[0] && `Next statutory filing: ${filings[0].name || filings[0].label || "filing"} in ${filings[0].daysLeft} day(s)`,
          isSuper && locked > 0 && `${locked} account(s) locked`,
          isSuper && failedLogins > 0 && `${failedLogins} failed sign-in(s) today`,
          isSuper && `12-month attrition ${attrition}% across ${active.length} active people in ${countries.length} countries`,
        ]}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.35fr" }, gap: 2.2 }}>
        <GlassCard title="Attendance right now" subtitle={`Biometric, selfie and terminal punches · late after ${data.settings.late_after}`} level={2} action={has("attendance") && <GlassButton onClick={() => navigate("/attendance-admin")}>Register</GlassButton>}>
          <Stack direction="row" spacing={2.4} sx={{ alignItems: "center", mb: 2 }}>
            <Ring value={inNow} max={Math.max(1, working)} size={112} stroke={11} label={`${inNow}/${working}`} sub="in today" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{  fontWeight: 800, fontSize: "2.2rem", lineHeight: 1 }}>{working ? Math.round((inNow / working) * 100) : 0}%</Typography>
              <Typography sx={{ fontSize: "0.64rem", color: G.muted, mt: 0.5 }}>of people expected today have punched in</Typography>
              <Stack direction="row" spacing={0.6} useFlexGap sx={{ mt: 1.2, flexWrap: "wrap" }}>
                {flagged.length > 0 && <GlassPill tone="warn">{flagged.length} punch{flagged.length > 1 ? "es" : ""} outside geofence</GlassPill>}
                {outside > 0 && <GlassPill tone="bad">{outside} live outside site</GlassPill>}
                <GlassPill tone={devOnline === data.devices.length ? "good" : "warn"}>{devOnline}/{data.devices.length} devices online</GlassPill>
              </Stack>
            </Box>
          </Stack>
          <SplitBar parts={statusParts} />
          <Box sx={{ mt: 1.6 }}>
            {rows.filter((r) => ["late", "absent"].includes(r.status)).slice(0, 4).map((r) => (
              <GlassRow key={r.e.employee_code} left={<GlassAvatar name={r.e.full_name} />} title={r.e.full_name} sub={`${r.e.designation} · ${r.e.department}`} right={<GlassPill tone={r.status === "late" ? "warn" : "bad"}>{r.status === "late" ? `Late · ${r.inT || ""}` : "Not in"}</GlassPill>} onClick={has("attendance") ? () => navigate("/attendance-admin") : undefined} />
            ))}
          </Box>
        </GlassCard>

        {fin ? (
          <GlassCard title="Payroll groups · local tax" subtitle={`${groups.length} groups · taxes paid under each registration, in local currency`} action={<GlassButton startIcon={<PaymentsRounded />} onClick={() => navigate("/payroll-entities")}>Entities</GlassButton>}>
            {groups.slice(0, 9).map((g) => <GlassRow key={g.id} title={g.label} sub={`${g.employees.length} on payroll · ${COUNTRIES[g.country]?.name || g.country} · ${g.currency}`} right={<GlassPill tone={g.warnings.length ? "warn" : "good"}>{g.warnings.length ? `${g.warnings.length} gap` : "Registered"}</GlassPill>} onClick={() => navigate("/payroll-entities")} />)}
          </GlassCard>
        ) : (
        <GlassCard title="Live location · India sites" subtitle={`${mapPeople.length} people sharing location while clocked in · ${homeFences.length} geofences`} pad={1.4} action={has("location") && <GlassButton onClick={() => navigate("/live-map")}>Open map</GlassButton>}>
          <LiveMap fences={homeFences} people={mapPeople.map((p) => ({ ...p }))} height={330} dark showLegend />
        </GlassCard>
        )}
      </Box>

      <GlassGrid min={170}>
        <GlassStat label="Approvals pending" value={approvalTotal} hint={`${pend.requests.length} requests · ${pend.payouts.length} to pay/assign`} icon={<FactCheckRounded />} tone="saffron" onClick={() => navigate(isSuper ? "/requests" : "/approvals")} />
        {has("calls") && <GlassStat label="Calls today" value={callsToday.total} hint={`${callsToday.connectRate}% connected · ${callsToday.talkMin} min talk`} icon={<PhoneInTalkRounded />} spark={callWeek.map((d) => d.value)} onClick={() => navigate("/calls-admin")} />}
        {has("monitoring") && <GlassStat label="Avg productive time" value={`${avgProd}%`} hint={`${act.length} consenting people`} icon={<InsightsRounded />} tone="info" onClick={() => navigate("/monitoring")} />}
        {has("assets") && <GlassStat label="Assets assigned" value={assigned} hint={`${inStock} in stock · ${repair} repair/lost`} icon={<InventoryRounded />} tone="fog" onClick={() => navigate("/assets-admin")} />}
        {has("recruitment") && <GlassStat label="Open roles" value={openReqs.length} hint={`${data.candidates.filter((x) => !["hired", "rejected"].includes(x.stage)).length} in pipeline`} icon={<WorkRounded />} tone="mint" onClick={() => navigate("/recruitment")} />}
        {has("attendance") && <GlassStat label="Biometric devices" value={`${devOnline}/${data.devices.length}`} hint={data.devices.filter((d) => d.status !== "online").map((d) => d.name).join(", ") || "All online"} icon={<FingerprintRounded />} tone={devOnline === data.devices.length ? "mint" : "bad"} onClick={() => navigate(isSuper ? "/geofences" : "/attendance-admin")} />}
        <GlassStat label="Meetings today" value={mtg.count} hint={mtg.note} icon={<MeetingsIcon />} tone="info" onClick={() => setMtgOpen(true)} />
      </GlassGrid>
      <TodayMeetingsDialog open={mtgOpen} onClose={() => setMtgOpen(false)} />
      {["hr", "hr_finance"].includes(adminKind(user)) && <Box sx={{ background: "#f4f7f8", borderRadius: 3, p: { xs: 1.2, md: 2 } }}><HrDashboardWidgets /></Box>}

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 2.2 }}>
        <GlassCard title="Approvals by type" subtitle={isSuper ? "Everything open across the company" : "Reached your stage"}>
          {Object.keys(byType).length === 0 && pend.points.length === 0 && <Typography sx={{ fontSize: "0.66rem", color: G.faint }}>Nothing waiting. Nice.</Typography>}
          {Object.entries(byType).map(([t, n]) => (
            <GlassRow key={t} title={REQUEST_TYPES[t]?.label || t} right={<Typography sx={{  fontWeight: 800 }}>{n}</Typography>} onClick={() => navigate(isSuper ? "/requests" : "/approvals")} />
          ))}
          {pend.accounts.length > 0 && <GlassRow title="New accounts" right={<Typography sx={{  fontWeight: 800 }}>{pend.accounts.length}</Typography>} onClick={() => navigate(isSuper ? "/users" : "/approvals")} />}
        </GlassCard>

        <CelebrationsCard />

        {has("calls") && (
          <GlassCard title="Team calls · last 7 days" subtitle={`Target ${data.settings.call_daily_target} calls a day per person`} action={<GlassButton onClick={() => navigate("/calls-admin")}>Call tracker</GlassButton>}>
            <GlassBars data={callWeek} height={110} format={(v) => `${v} calls`} />
          </GlassCard>
        )}

        {has("recruitment") && (
          <GlassCard title="Hiring funnel" subtitle={`All requisitions this year · ${openReqs.length} still open`} action={<GlassButton onClick={() => navigate("/recruitment")}>Pipeline</GlassButton>}>
            {funnel.map((f, i) => (
              <Box key={f.s} sx={{ mb: 1 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography sx={{ fontSize: "0.62rem", color: G.muted, }}>{f.s}</Typography>
                  <Typography sx={{ fontSize: "0.62rem", fontWeight: 700 }}>{f.n}</Typography>
                </Stack>
                <Box sx={{ height: 8, borderRadius: 8, background: "rgba(255,255,255,0.08)", mt: 0.4 }}>
                  <Box sx={{ height: "100%", width: `${(f.n / Math.max(1, funnel[0].n)) * 100}%`, borderRadius: 8, background: i === 4 ? G.saffron : G.mint }} />
                </Box>
              </Box>
            ))}
          </GlassCard>
        )}

        {(has("payroll") || isSuper) && (
          <GlassCard title="Payroll & filings" subtitle={`Period ${period}`} action={<GlassButton startIcon={<PaymentsRounded />} onClick={() => navigate("/payroll")}>Payroll</GlassButton>}>
            {countries.filter((cc) => COUNTRIES[cc]).map((cc) => {
              const run = data.payrollRuns.find((r) => r.country === cc && r.period === period);
              return <GlassRow key={cc} title={COUNTRIES[cc].name} sub={`${active.filter((e) => (e.country_code || "IN") === cc).length} people · ${COUNTRIES[cc].currency}`} right={<GlassPill tone={run?.status === "Locked" ? "good" : run ? "info" : "warn"}>{run ? run.status : "Not run"}</GlassPill>} onClick={() => navigate("/payroll")} />;
            })}
            <Typography sx={{ fontSize: "0.6rem", color: G.faint, mt: 1.2, mb: 0.4 }}>Next statutory deadlines</Typography>
            {filings.map((f) => <GlassRow key={f.cc + f.name} title={f.name} sub={`${COUNTRY_FLAG_NAME[f.cc]} · ${f.authority}`} right={<GlassPill tone={f.daysLeft <= 5 ? "bad" : "fog"}>{f.daysLeft === 0 ? "Today" : `${f.daysLeft} d`}</GlassPill>} />)}
          </GlassCard>
        )}

        {isSuper && (
          <GlassCard title="Countries" subtitle="Headcount and monthly cost in ₹ at today's rates" action={<GlassButton startIcon={<PublicRounded />} onClick={() => navigate("/territory")}>Territory</GlassButton>}>
            {countries.map((cc) => {
              const list = active.filter((e) => (e.country_code || "IN") === cc);
              const cost = list.reduce((s, e) => s + e.monthly_gross * (data.fx[COUNTRIES[cc]?.currency] || 1), 0);
              return <GlassRow key={cc} title={COUNTRIES[cc]?.name || cc} sub={`${list.length} people · ${data.geofences.filter((g) => (g.country || "IN") === cc).length} geofences`} right={<Typography sx={{ fontSize: "0.66rem", fontWeight: 700 }}>₹{(cost / 100000).toFixed(1)} L</Typography>} />;
            })}
            <Typography sx={{ fontSize: "0.6rem", color: G.faint, mt: 1 }}>Total ₹{(costInr / 100000).toFixed(1)} L a month · attrition {attrition}% (12 months)</Typography>
          </GlassCard>
        )}

        {isSuper && (
          <GlassCard title="Security & privacy" subtitle="Accounts, monitoring consent and retention" action={<GlassButton startIcon={<ShieldRounded />} onClick={() => navigate("/monitoring-policy")}>Policy</GlassButton>}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 1.2 }}>
              <Ring value={consented} max={Math.max(1, active.length)} size={84} label={`${Math.round((consented / Math.max(1, active.length)) * 100)}%`} sub="chose" />
              <Typography sx={{ fontSize: "0.64rem", color: G.muted }}>{consented} of {active.length} people have made a monitoring choice. Screenshots are {data.settings.screenshots}; data is kept {data.settings.monitoring_retention_days} days.</Typography>
            </Stack>
            <GlassRow left={<LockRounded sx={{ fontSize: 18, color: locked ? G.bad : G.mint }} />} title="Locked accounts" right={<b>{locked}</b>} onClick={() => navigate("/users")} />
            <GlassRow left={<ShieldRounded sx={{ fontSize: 18, color: G.info }} />} title="Failed sign-ins today" right={<b>{failedLogins}</b>} onClick={() => navigate("/audit")} />
          </GlassCard>
        )}

        {isSuper && (
          <GlassCard title="Audit stream" subtitle="Latest changes" action={<GlassButton startIcon={<HistoryRounded />} onClick={() => navigate("/audit")}>All</GlassButton>}>
            {data.audit.slice(0, 6).map((a) => <GlassRow key={a.log_id} title={a.action.replace(/_/g, " ").toLowerCase()} sub={`${a.user_code} · ${a.details || ""}`} right={<Typography sx={{ fontSize: "0.56rem", color: G.faint, whiteSpace: "nowrap" }}>{timeAgo(a.timestamp)}</Typography>} />)}
          </GlassCard>
        )}
      </Box>
    </Stack>
  );
}
