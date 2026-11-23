// PeopleXP (v10): a living culture feed — recognition against company values with points, birthdays and work
// anniversaries, a one-tap daily pulse, points that become gift vouchers, and (for HR / Super Admin) insights that
// nudge managers when quiet, consistent work goes unnoticed. Also "Get the mobile app".
import { isRestrictedWorker } from "../../lib/statutory.js";
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Card, Chip, IconButton, MenuItem, Stack, Tab, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import { FavoriteRounded, FavoriteBorderRounded, EmojiEvents, Cake, Celebration, Mood, Redeem, Insights, Campaign, QrCode2, Android, Apple, Smartphone, Fingerprint, ReceiptLong, EventAvailable, Receipt, Description, Chat, NotificationsActive, Download } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { SectionCard, Avatar, EmptyState } from "../../components/kit/UI.jsx";
import { ModuleHub, Pill, TwoCol, Hint, C, Progress, Kpi, tabSx, useWho, asList } from "../../components/suite/Hub.jsx";
import { openCopilot } from "../../components/ai/AiText.jsx";
import { isoDate, timeAgo } from "../../lib/utils.js";

export const MOODS = [["😞", "Rough"], ["😕", "Meh"], ["😐", "Okay"], ["🙂", "Good"], ["😄", "Great"]];

export function upcoming(employees, field, days = 10) {
  const now = new Date();
  return employees.filter((e) => e.status === "active" && e[field]).map((e) => {
    const [, m, d] = e[field].split("-").map(Number);
    let next = new Date(now.getFullYear(), m - 1, d);
    if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next = new Date(now.getFullYear() + 1, m - 1, d);
    const years = field === "date_of_joining" ? next.getFullYear() - Number(e[field].slice(0, 4)) : null;
    return { e, next, inDays: Math.round((next - now) / 86400000), years };
  }).filter((x) => x.inDays <= days && (field !== "date_of_joining" || x.years >= 1)).sort((a, b) => a.inDays - b.inDays);
}

export default function PeopleXP() {
  const { data, user, suiteDo, notifyToast, nameOf } = useStore();
  const { isEmp, isSuper, isHR } = useWho();
  const s = data.suite || {};
  const meCode = user.employee_code || user.code;
  const [tab, setTab] = useState("feed");
  const [draft, setDraft] = useState({ kind: "recognition", to: [], value: s.values?.[0] || "", points: 50, text: "" });
  const [comment, setComment] = useState({});
  const posts = s.posts || [];
  const wallet = s.xpWallet?.[meCode] || 0;
  const today = isoDate();
  const myPulse = (s.pulses || []).find((p) => p.emp === meCode && p.date === today);
  const people = data.employees.filter((e) => e.status === "active" && e.employee_code !== meCode);
  const bdays = upcoming(data.employees, "date_of_birth");
  const annivs = upcoming(data.employees, "date_of_joining");

  function post() {
    const r = suiteDo("xp", (x, { now }) => {
      x.posts = [{ id: `XP-${Date.now()}`, kind: draft.kind, by: meCode, to: draft.to, value: draft.kind === "recognition" ? draft.value : undefined, points: draft.kind === "recognition" ? draft.points : 0, text: draft.text, at: now, likes: [], comments: [] }, ...(x.posts || [])];
      if (draft.kind === "recognition") draft.to.forEach((c) => { x.xpWallet = { ...(x.xpWallet || {}), [c]: (x.xpWallet?.[c] || 0) + Number(draft.points) }; });
    }, { action: "PEOPLEXP_POST", details: `${draft.kind} · ${draft.to.join(",")}`, note: draft.kind === "recognition" ? { to: [...new Set([...draft.to, ...draft.to.map((c) => data.employees.find((e) => e.employee_code === c)?.reporting_manager).filter(Boolean)])], text: `${nameOf(meCode)} recognised ${draft.to.map(nameOf).join(", ")} for "${draft.value}" (+${draft.points} points).`, link: "/people-xp" } : draft.to.length ? { to: draft.to, text: `${nameOf(meCode)} mentioned you in a post on People & recognition.`, link: "/people-xp" } : undefined });
    if (r.ok) { notifyToast(draft.kind === "recognition" ? "Recognition shared 🎉" : "Posted."); setDraft({ ...draft, to: [], text: "" }); }
  }
  const like = (id) => suiteDo("xp", (x) => { const p = x.posts.find((y) => y.id === id); p.likes = p.likes.includes(meCode) ? p.likes.filter((l) => l !== meCode) : [...p.likes, meCode]; }, { action: "PEOPLEXP_LIKE", details: id });
  const addComment = (id) => { if (!comment[id]) return; suiteDo("xp", (x, { now }) => { x.posts.find((y) => y.id === id).comments.push({ by: meCode, text: comment[id], at: now }); }, { action: "PEOPLEXP_COMMENT", details: id }); setComment({ ...comment, [id]: "" }); };
  const pulse = (m) => { suiteDo("pulse", (x, { now }) => { x.pulses = [...(x.pulses || []).filter((p) => !(p.emp === meCode && p.date === today)), { emp: meCode, date: today, mood: m, at: now }]; }, { action: "PULSE", details: "daily pulse" }); notifyToast("Thanks — your answer is anonymous in team reports."); };
  function redeem(v) {
    if (wallet < v.points) return notifyToast("Not enough points yet.", "info");
    const r = suiteDo("xp", (x, { now }) => { x.xpWallet[meCode] = (x.xpWallet[meCode] || 0) - v.points; x.xpRedemptions = [{ id: `RD-${Date.now()}`, emp: meCode, voucher: v.id, name: v.name, points: v.points, at: now, code: `PX-${Math.random().toString(36).slice(2, 8).toUpperCase()}` }, ...(x.xpRedemptions || [])]; }, { action: "PEOPLEXP_REDEEM", details: `${v.name} · ${v.points} pts` });
    if (r.ok) notifyToast(`${v.name} redeemed — the code is emailed to you.`);
  }

  const pulses = s.pulses || [];
  const avgMood = pulses.length ? pulses.reduce((t, p) => t + p.mood, 0) / pulses.length : null;
  const recog = posts.filter((p) => p.kind === "recognition");
  const recognised = new Set(recog.flatMap((p) => p.to));
  const quiet = data.employees.filter((e) => e.status === "active" && !recognised.has(e.employee_code)).slice(0, 8);
  const byValue = (s.values || []).map((v) => [v, recog.filter((p) => p.value === v).length]);
  const TABS = [["feed", "Culture feed"], ["rewards", "Rewards"], ...(!isEmp ? [["insights", "Insights"]] : [])];

  return (
    <ModuleHub eyebrow="PEOPLE EXPERIENCE · PEOPLEXP" title="Culture feed, recognition & rewards" subtitle="Wins get shared, peers get recognised against your company values, points become gift vouchers, and a one-tap daily pulse tells you how the team is really doing."
      brief={{ text: <><b>{recog.length}</b> recognitions this month · {bdays.length} birthday(s) and {annivs.length} work anniversary(ies) coming up{!isEmp ? <> · <b>{quiet.length}</b> people haven't been recognised in 60 days.</> : "."}</>, actions: !isEmp ? [["Nudge managers", () => { suiteDo("xp", () => ({}), { action: "PEOPLEXP_NUDGE", details: "Nudged managers", note: { to: [...new Set(quiet.map((q) => q.reporting_manager).filter(Boolean))], text: "A few people in your team haven't been recognised lately — a quick thank-you goes a long way.", link: "/people-xp" } }); notifyToast("Managers nudged."); }]] : [] }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}><Tabs value={tab} onChange={(_, v) => setTab(v)} sx={tabSx}>{TABS.map(([k, l]) => <Tab key={k} value={k} label={l} />)}</Tabs></Box>
      {tab === "feed" && (
        <TwoCol right={340}>
          <Stack spacing={2}>
            {user.role === "emp" && !myPulse && (
              <Card sx={{ p: 2 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>How's your vibe today?</Typography>
                <Stack direction="row" spacing={1}>{MOODS.map(([e, l], i) => <Button key={l} variant="outlined" onClick={() => pulse(i + 1)} sx={{ flexDirection: "column", minWidth: 64, py: 0.8 }}><span style={{ fontSize: 22 }}>{e}</span><Typography variant="caption">{l}</Typography></Button>)}</Stack>
              </Card>
            )}
            <SectionCard title="Share a win or recognise someone">
              <Stack spacing={1.2}>
                <Stack direction="row" spacing={1}><Chip label="Recognise" color={draft.kind === "recognition" ? "primary" : "default"} onClick={() => setDraft({ ...draft, kind: "recognition" })} icon={<EmojiEvents />} /><Chip label="Post" color={draft.kind === "post" ? "primary" : "default"} onClick={() => setDraft({ ...draft, kind: "post" })} icon={<Campaign />} /></Stack>
                {draft.kind === "recognition" && (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField select size="small" label="Who" slotProps={{ select: { multiple: true } }} value={draft.to} onChange={(e) => setDraft({ ...draft, to: asList(e.target.value) })} sx={{ flex: 2 }}>{people.map((p) => <MenuItem key={p.employee_code} value={p.employee_code}>{p.full_name}</MenuItem>)}</TextField>
                    <TextField select size="small" label="Value" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} sx={{ flex: 1 }}>{(s.values || []).map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField>
                    <TextField select size="small" label="Points" value={draft.points} onChange={(e) => setDraft({ ...draft, points: e.target.value })} sx={{ width: 100 }}>{[0, 25, 50, 75, 100].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}</TextField>
                  </Stack>
                )}
                <TextField multiline minRows={2} placeholder={draft.kind === "recognition" ? "What did they do, and why did it matter?" : "Share something with your team…"} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
                <Stack direction="row" spacing={1}><Button variant="contained" disabled={!draft.text || (draft.kind === "recognition" && !draft.to.length)} onClick={post}>Share</Button><Button onClick={() => openCopilot(`Draft a short, specific recognition message for ${draft.to.map(nameOf).join(" and ") || "a colleague"} for the value "${draft.value}". Two sentences, warm, no clichés.`)}>Draft with AI</Button></Stack>
              </Stack>
            </SectionCard>
            {posts.map((p) => (
              <Card key={p.id} sx={{ p: 2 }}>
                <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", mb: 1 }}>
                  {p.by === "SYSTEM" ? <Box sx={{ width: 32, height: 32, borderRadius: 99, display: "grid", placeItems: "center", bgcolor: "rgba(244,138,62,0.15)", color: C.glob }}><Celebration fontSize="small" /></Box> : <Avatar name={nameOf(p.by)} size={32} />}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{p.by === "SYSTEM" ? "Milestone" : nameOf(p.by)}{p.kind === "recognition" ? <> recognised <Box component="span" sx={{ color: C.navy }}>{p.to.map(nameOf).join(", ")}</Box></> : ""}</Typography>
                    <Typography variant="caption" color="text.secondary">{timeAgo(p.at)}</Typography>
                  </Box>
                  {p.kind === "recognition" && <Stack direction="row" spacing={0.5}><Pill tone="glob">{p.value}</Pill>{p.points ? <Pill tone="mint">+{p.points}</Pill> : null}</Stack>}
                </Stack>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{p.text}</Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1 }}>
                  <IconButton size="small" onClick={() => like(p.id)} sx={{ color: p.likes.includes(meCode) ? C.glob : undefined }}>{p.likes.includes(meCode) ? <FavoriteRounded fontSize="small" /> : <FavoriteBorderRounded fontSize="small" />}</IconButton>
                  <Typography variant="caption">{p.likes.length}</Typography>
                  <Typography variant="caption" color="text.secondary">· {p.comments.length} comment(s)</Typography>
                </Stack>
                {p.comments.map((c, i) => <Typography key={i} variant="caption" component="div" sx={{ pl: 1, borderLeft: 2, borderColor: "divider", my: 0.4 }}><b>{nameOf(c.by)}:</b> {c.text}</Typography>)}
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}><TextField size="small" fullWidth placeholder="Add a comment" value={comment[p.id] || ""} onChange={(e) => setComment({ ...comment, [p.id]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addComment(p.id)} /><Button size="small" onClick={() => addComment(p.id)}>Send</Button></Stack>
              </Card>
            ))}
          </Stack>
          <Stack spacing={2}>
            <Kpi label="My points" value={wallet} hint="Redeem under Rewards" icon={<Redeem />} tone="glob" onClick={() => setTab("rewards")} />
            <SectionCard title="Birthdays" noPad>{bdays.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>None this week.</Typography> : bdays.map((b) => <Stack key={b.e.employee_code} direction="row" spacing={1} sx={{ px: 2, py: 0.9, alignItems: "center", borderBottom: 1, borderColor: "divider" }}><Cake sx={{ color: C.glob, fontSize: 18 }} /><Typography variant="body2" sx={{ flex: 1 }}>{b.e.full_name}</Typography><Pill>{b.inDays === 0 ? "Today" : `in ${b.inDays}d`}</Pill></Stack>)}</SectionCard>
            <SectionCard title="Work anniversaries" noPad>{annivs.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>None this week.</Typography> : annivs.map((b) => <Stack key={b.e.employee_code} direction="row" spacing={1} sx={{ px: 2, py: 0.9, alignItems: "center", borderBottom: 1, borderColor: "divider" }}><Celebration sx={{ color: C.navy, fontSize: 18 }} /><Typography variant="body2" sx={{ flex: 1 }}>{b.e.full_name} · {b.years} yr</Typography><Pill>{b.inDays === 0 ? "Today" : `in ${b.inDays}d`}</Pill></Stack>)}</SectionCard>
            <SectionCard title="Company pulse"><Stack direction="row" spacing={2} sx={{ alignItems: "center" }}><Typography sx={{ fontSize: 34 }}>{avgMood ? MOODS[Math.round(avgMood) - 1][0] : "—"}</Typography><Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{avgMood ? `${avgMood.toFixed(1)} / 5` : "No answers yet"}</Typography><Typography variant="caption" color="text.secondary">{pulses.filter((p) => p.date === today).length} answered today · anonymous</Typography></Box></Stack></SectionCard>
          </Stack>
        </TwoCol>
      )}
      {tab === "rewards" && (
        <Stack spacing={2}>
          <Alert severity="info" icon={<Redeem />}>You have <b>{wallet}</b> points. Points come from recognitions; redeem them for vouchers or donate them.</Alert>
          {!isEmp && <CustomRewardForm onAdd={(v) => { const r = suiteDo("xp", (x) => { x.vouchers = [...(x.vouchers || []), { id: `V-${Date.now()}`, custom: true, ...v }]; }, { action: "REWARD_ADD", details: v.name }); if (r.ok) notifyToast(`Reward "${v.name}" added to the catalogue.`); }} onRemove={(id) => suiteDo("xp", (x) => { x.vouchers = (x.vouchers || []).filter((v) => v.id !== id); }, { action: "REWARD_REMOVE", details: id })} custom={(s.vouchers || []).filter((v) => v.custom)} />}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(5,1fr)" }, gap: 1.5 }}>
            {(s.vouchers || []).map((v) => <Card key={v.id} sx={{ p: 2 }}><Redeem sx={{ color: C.glob }} /><Typography variant="body2" sx={{ fontWeight: 700, mt: 1 }}>{v.name}</Typography><Typography variant="caption" color="text.secondary" component="div">{v.value}</Typography><Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mt: 1.5 }}><Pill tone="navy">{v.points} pts</Pill><Button size="small" variant="contained" disabled={wallet < v.points || user.role !== "emp"} onClick={() => redeem(v)}>Redeem</Button></Stack></Card>)}
          </Box>
          <SectionCard title="My redemptions" noPad>{(s.xpRedemptions || []).filter((r) => r.emp === meCode).length === 0 ? <EmptyState title="Nothing redeemed yet" /> : (s.xpRedemptions || []).filter((r) => r.emp === meCode).map((r) => <Stack key={r.id} direction="row" sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", justifyContent: "space-between" }}><Typography variant="body2">{r.name}</Typography><Typography variant="body2" sx={{  }}>{r.code}</Typography></Stack>)}</SectionCard>
        </Stack>
      )}
      {tab === "insights" && (
        <TwoCol right={380}>
          <SectionCard title="People who haven't been recognised" subtitle="Quiet, consistent work that may be going unnoticed — managers get a gentle nudge">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)" }, gap: 1 }}>{quiet.map((e) => <Stack key={e.employee_code} direction="row" spacing={1} sx={{ alignItems: "center", p: 1, border: 1, borderColor: "divider", borderRadius: 2 }}><Avatar name={e.full_name} size={28} /><Box sx={{ minWidth: 0 }}><Typography variant="body2" noWrap>{e.full_name}</Typography><Typography variant="caption" color="text.secondary" noWrap component="div">{e.department} · manager {nameOf(e.reporting_manager)}</Typography></Box></Stack>)}</Box>
          </SectionCard>
          <Stack spacing={2}>
            <SectionCard title="Recognition by value"><Stack spacing={1}>{byValue.map(([v, n], i) => <Progress key={v} label={v} right={n} value={(n / Math.max(1, recog.length)) * 100} color={[C.navy, C.glob, C.mintDeep, "#5B4BB7", "#9A6400"][i % 5]} />)}</Stack></SectionCard>
            <SectionCard title="Pulse distribution"><Stack spacing={1}>{MOODS.map(([e, l], i) => <Progress key={l} label={`${e} ${l}`} right={pulses.filter((p) => p.mood === i + 1).length} value={(pulses.filter((p) => p.mood === i + 1).length / Math.max(1, pulses.length)) * 100} color={i >= 3 ? C.mintDeep : i === 2 ? C.navy : C.glob} />)}</Stack><Hint>Individual answers are never shown — only team totals of five or more.</Hint></SectionCard>
          </Stack>
        </TwoCol>
      )}
    </ModuleHub>
  );
}

// ── Employee: Get the mobile app ────────────────────────────────────────────────
export function MyApp() {
  const { data, user, suiteDo, notifyToast } = useStore();
  const me = user.employee_code;
  const inst = data.suite?.appInstalls?.[me];
  const installs = Object.keys(data.suite?.appInstalls || {}).length;
  const active = data.employees.filter((e) => e.status === "active").length;
  const feats = [[<ReceiptLong />, "Payslips", "Every payslip and Form 16 on your phone — no more “where's my payslip?”"], [<EventAvailable />, "Leave", "Apply in a tap, see balances and who's away"], [<Fingerprint />, "Clock in", "GPS with selfie, or face — inside your geofence"], [<Receipt />, "Expenses", "Snap the bill, attach it to a claim and track it to reimbursement"], [<Description />, "Tax declarations", "Submit investments and proofs before the deadline"], [<Chat />, "Ask AI", "Answers about pay, leave and policy, any time"], [<NotificationsActive />, "Alerts", "Approvals, payslip ready, shift changes"], [<Smartphone />, "Works offline", "Punches sync when you're back online"]];
  // v10.3: contract / freelance workers: no payslips, tax declarations or leave balances in the app.
  const restricted = isRestrictedWorker(data.employees.find((e) => e.employee_code === me), data.settings);
  const shown = restricted ? feats.filter(([, t]) => !["Payslips", "Tax declarations"].includes(t)).map((f) => (f[1] === "Leave" ? [f[0], "Request leave", "Ask for time off in a tap; your manager approves"] : f)) : feats;
  function install(platform) {
    suiteDo("app", (s, { now }) => { s.appInstalls = { ...(s.appInstalls || {}), [me]: { platform, at: now } }; }, { action: "APP_INSTALL", details: platform });
    try { window.dispatchEvent(new Event("peoplehub-install")); } catch { /* ignore */ }
    notifyToast(platform === "Web app" ? "Added — open PeopleHub from your home screen." : `Link sent — install from the ${platform === "iOS" ? "App Store" : "Play Store"}, then sign in with your work email.`);
  }
  const url = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <ModuleHub eyebrow="ME · MOBILE APP" title="Everything you need, in one app" subtitle="Payslips, leave, attendance, claims and answers — self-serve, on your phone. Android, iOS and an installable web app."
      brief={{ text: <>{inst ? <>You're set up on <b>{inst.platform}</b>.</> : "You haven't installed the app yet."} <b>{installs}</b> of {active} colleagues use it.</> }}>
      <TwoCol right={340}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)" }, gap: 1.5 }}>
          {shown.map(([i, t, d]) => <Card key={t} sx={{ p: 2, display: "flex", gap: 1.5 }}><Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "rgba(0,74,119,0.08)", color: C.navy, flexShrink: 0 }}>{i}</Box><Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{t}</Typography><Typography variant="caption" color="text.secondary">{d}</Typography></Box></Card>)}
        </Box>
        <SectionCard title="Install">
          <Stack spacing={1.5} sx={{ alignItems: "center" }}>
            <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: "divider" }}><QrPattern text={url} /></Box>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>Scan with your phone camera, or use a button below. Sign in with your work email — OTP, no password to remember.</Typography>
            <Stack direction="row" spacing={1}><Button variant="contained" startIcon={<Android />} onClick={() => install("Android")}>Android</Button><Button variant="contained" startIcon={<Apple />} onClick={() => install("iOS")}>iOS</Button></Stack>
            <Button startIcon={<Download />} onClick={() => install("Web app")}>Add web app to home screen</Button>
          </Stack>
        </SectionCard>
      </TwoCol>
    </ModuleHub>
  );
}

// Deterministic QR-style pattern (decorative; the buttons do the real work).
function QrPattern({ text, size = 148 }) {
  const n = 25;
  const cells = useMemo(() => { let h = 2166136261; const out = []; for (let i = 0; i < n * n; i++) { h ^= (text.charCodeAt(i % Math.max(1, text.length)) || 7) + i; h = Math.imul(h, 16777619); out.push((h >>> 0) % 3 === 0); } return out; }, [text]);
  const finder = (x, y) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([a, b]) => x >= a && x < a + 7 && y >= b && y < b + 7);
  const finderOn = (x, y) => { const [a, b] = [[0, 0], [n - 7, 0], [0, n - 7]].find(([p, q]) => x >= p && x < p + 7 && y >= q && y < q + 7); const dx = x - a, dy = y - b; return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4); };
  const c = size / n;
  return <svg width={size} height={size}>{cells.map((on, i) => { const x = i % n, y = Math.floor(i / n); const v = finder(x, y) ? finderOn(x, y) : on; return v ? <rect key={i} x={x * c} y={y * c} width={c} height={c} fill={C.navy} /> : null; })}</svg>;
}

// v10.6: HR / Super Admin add their own rewards (custom vouchers, extra leave, lunch with the CEO…).
function CustomRewardForm({ onAdd, onRemove, custom }) {
  const [f, setF] = useState({ name: "", value: "", points: 500 });
  return (
    <SectionCard title="Custom rewards · admin" subtitle="Add your own rewards to the catalogue; employees redeem them with points.">
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
        <TextField size="small" label="Reward name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Extra day off" sx={{ flex: 1 }} />
        <TextField size="small" label="What they get" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} placeholder="e.g. 1 paid day, use within 90 days" sx={{ flex: 1.4 }} />
        <TextField size="small" type="number" label="Points" value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} sx={{ width: 120 }} />
        <Button variant="contained" disabled={!f.name.trim() || !(Number(f.points) > 0)} onClick={() => { onAdd({ name: f.name.trim(), value: f.value.trim() || "Custom reward", points: Number(f.points) }); setF({ name: "", value: "", points: 500 }); }}>Add reward</Button>
      </Stack>
      {custom.length > 0 && <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: "wrap", mt: 1.5 }}>{custom.map((v) => <Chip key={v.id} label={`${v.name} · ${v.points} pts`} onDelete={() => onRemove(v.id)} />)}</Stack>}
    </SectionCard>
  );
}
