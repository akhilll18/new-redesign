// IT support: employee "Contact IT support" page (self-help with AI, raise & track tickets), the IT section on
// My assets, and the IT service desk queue for admins with the "it" module.
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem, Rating, Select, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AddRounded, CloseRounded, SupportAgentRounded, PhoneRounded, MailOutlineRounded, ForumRounded, PlaceRounded, LockResetRounded, VpnLockRounded, SpeedRounded, AppsRounded, GppMaybeRounded, PrintRounded, AttachFileRounded, SendRounded, ComputerRounded } from "@mui/icons-material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Tag, TableWrap, Mono, PersonCell, EmptyState, KeyVal } from "../kit/UI.jsx";
import { AiInsight } from "../ai/AiInsight.jsx";
import { AI_GRADIENT, Sparkle } from "../ai/AiText.jsx";
import { AiButton, AiResult, useAiRun } from "./aiKit.jsx";
import { IT_CATEGORIES, IT_CATEGORY_LABEL, IT_PRIORITY, IT_STATUS, IT_OPEN, slaState, slaText, selfHelp, triage, canManageIt, KB } from "../../lib/itdesk.js";
import { identityCodes } from "../../lib/collab.js";
import { fmtDateTime, timeAgo, readFileAsDataUrl, fmtBytes } from "../../lib/utils.js";

export const IT_CONTACT = { phone: "+91 40 4455 1234 · ext. 2222", email: "itsupport@onasglobal.demo", desk: "Ground floor, HQ – walk-in 10:00–18:00", hours: "Mon–Sat 8:00–20:00 · Critical incidents 24×7" };
const SLA_TONE = { pending: "neutral", ok: "good", at_risk: "warn", breached: "bad", met: "good", missed: "bad" };
const QUICK = [
  { icon: <LockResetRounded />, label: "Password or MFA", text: "I am locked out / my password expired and MFA prompts are not arriving" },
  { icon: <VpnLockRounded />, label: "VPN or Wi-Fi", text: "VPN keeps disconnecting and I cannot reach internal sites" },
  { icon: <SpeedRounded />, label: "Laptop slow / crashing", text: "My laptop is very slow and freezes several times a day" },
  { icon: <AppsRounded />, label: "Software or licence", text: "Please install software / I need a licence for an application" },
  { icon: <PrintRounded />, label: "Printer", text: "The office printer is not printing my documents" },
  { icon: <GppMaybeRounded />, label: "Report phishing", text: "I received a suspicious phishing email asking for my password" },
];

function useMyTickets() {
  const { data, user } = useStore();
  return useMemo(() => (data.itTickets || []).filter((t) => t.requester === user.code).sort((a, b) => b.created_at.localeCompare(a.created_at)), [data.itTickets, user.code]);
}
const StatusTag = ({ s }) => <Tag tone={IT_STATUS[s]?.tone}>{IT_STATUS[s]?.label || s}</Tag>;
const PriTag = ({ p }) => <Tag tone={IT_PRIORITY[p]?.tone}>{IT_PRIORITY[p]?.label || p}</Tag>;

// ── Raise a ticket (with AI troubleshooting first) ─────
export function RaiseItTicketDialog({ open, onClose, preset = {}, onCreated }) {
  const { data, user, createItTicket, notifyToast } = useStore();
  const [f, setF] = useState({});
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const ai = useAiRun();
  const myAssets = data.assets.filter((a) => a.assigned_to === user.code);
  useEffect(() => {
    if (!open) return;
    const tr = triage(`${preset.subject || ""} ${preset.description || ""}`);
    setF({ subject: preset.subject || "", description: preset.description || "", category: preset.category || (preset.description ? tr.category : "hardware"), priority: preset.priority || (preset.description ? tr.priority : "normal"), asset_id: preset.asset_id || "", contact: user.phone || "", location: "", attachment: null });
    setTouched(false);
    setError("");
    ai.clear();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  const text = `${f.subject} ${f.description}`;
  const autoTriage = (desc) => {
    const n = { ...f, description: desc };
    if (!touched && desc.length > 12) { const tr = triage(`${f.subject} ${desc}`); n.category = tr.category; n.priority = tr.priority; }
    setF(n);
  };
  const troubleshoot = () => {
    const h = selfHelp(text);
    if (!touched) setF((cur) => ({ ...cur, category: h.category, priority: h.priority }));
    const asset = f.asset_id && data.assets.find((a) => a.asset_id === f.asset_id);
    const offline = `**${h.kb.title}** – try these first:\n${h.kb.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}${asset ? `\n\nYour ${asset.category.toLowerCase()} **${asset.asset_id}** (${asset.model}) is ${asset.warranty_end >= new Date().toISOString().slice(0, 10) ? `under warranty until ${asset.warranty_end}` : "out of warranty"}.` : ""}\n\nSuggested category **${IT_CATEGORY_LABEL[h.category]}**, priority **${IT_PRIORITY[h.priority].label}**${h.matched ? ` (matched “${h.matched}” in your description)` : ""}. If none of this works, send the ticket – IT responds within ${IT_PRIORITY[h.priority].slaHours} hours.`;
    ai.run({ task: "it-troubleshoot", instruction: "You are the company IT help desk assistant. Give 3–6 safe, numbered self-help steps for this problem that a non-technical employee can try in under 10 minutes, then say when to raise a ticket. Never ask for passwords. For security incidents, tell them to stop and raise a Critical ticket immediately.", input: `Problem: ${text}\nAsset: ${asset ? `${asset.asset_id} ${asset.model}, warranty until ${asset.warranty_end}` : "not given"}\nKnowledge base: ${h.kb.steps.join(" | ")}`, offline });
  };
  const submit = () => {
    const r = createItTicket({ ...f, ai_triage: triage(text) });
    if (!r.ok) return setError(r.error);
    notifyToast(r.chain ? `IT ticket ${r.id} raised. It goes for approval (${r.chain}), then to IT (SLA ${IT_PRIORITY[f.priority].slaHours} h from approval).` : `IT ticket ${r.id} raised. IT will respond within ${IT_PRIORITY[f.priority].slaHours} hours.`);
    onCreated?.(r.id);
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Raise an IT support ticket</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField size="small" label="Short title *" value={f.subject || ""} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="e.g. VPN disconnects every 10 minutes" />
          <TextField label="What is happening? *" multiline minRows={3} value={f.description || ""} onChange={(e) => autoTriage(e.target.value)} helperText="What you were doing, what you expected, any error message. Never share your password." />
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <AiButton busy={ai.busy} disabled={text.trim().length < 6} onClick={troubleshoot}>Try AI troubleshooting first</AiButton>
            {!touched && text.trim().length > 12 && <Typography variant="caption" color="text.secondary">Category and priority were suggested from your description.</Typography>}
          </Stack>
          <AiResult ai={ai} title="AI self-help" dense />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl size="small" fullWidth><InputLabel>Category *</InputLabel><Select label="Category *" value={f.category || ""} onChange={(e) => { setTouched(true); setF({ ...f, category: e.target.value }); }}>{IT_CATEGORIES.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" fullWidth><InputLabel>Impact *</InputLabel><Select label="Impact *" value={f.priority || ""} onChange={(e) => { setTouched(true); setF({ ...f, priority: e.target.value }); }}>{Object.entries(IT_PRIORITY).map(([k, p]) => <MenuItem key={k} value={k}>{p.label} – {p.help} ({p.slaHours} h)</MenuItem>)}</Select></FormControl>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl size="small" fullWidth><InputLabel>Related asset</InputLabel><Select label="Related asset" value={f.asset_id || ""} onChange={(e) => setF({ ...f, asset_id: e.target.value })}><MenuItem value="">None / not a company device</MenuItem>{myAssets.map((a) => <MenuItem key={a.asset_id} value={a.asset_id}>{a.asset_id} · {a.model}</MenuItem>)}</Select></FormControl>
            <TextField size="small" fullWidth label="Best number to reach you" value={f.contact || ""} onChange={(e) => setF({ ...f, contact: e.target.value })} />
          </Stack>
          <TextField size="small" label="Where are you? (desk, floor, home, client site)" value={f.location || ""} onChange={(e) => setF({ ...f, location: e.target.value })} />
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button size="small" component="label" startIcon={<AttachFileRounded />}>Attach screenshot<input hidden type="file" accept="image/*,application/pdf,.txt,.log" onChange={async (e) => { const fl = e.target.files?.[0]; if (!fl) return; setF({ ...f, attachment: { name: fl.name, size: fl.size, type: fl.type, data_url: await readFileAsDataUrl(fl) } }); }} /></Button>
            {f.attachment && <Chip size="small" label={`${f.attachment.name} · ${fmtBytes(f.attachment.size)}`} onDelete={() => setF({ ...f, attachment: null })} />}
          </Stack>
          {f.priority === "critical" && f.category === "security" && <Alert severity="error" sx={{ fontSize: "0.65rem" }}>Security incident: do not click further links or reply to the sender. Also call IT on {IT_CONTACT.phone}.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit}>Send to IT</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Ticket drawer (requester and IT agent views) ───────
export function ItTicketDrawer({ id, onClose }) {
  const { data, user, nameOf, commentItTicket, updateItTicket, rateItTicket, notifyToast } = useStore();
  const t = id ? (data.itTickets || []).find((k) => k.id === id) : null;
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [att, setAtt] = useState(null);
  const [resolution, setResolution] = useState("");
  const [rate, setRate] = useState(0);
  const [fb, setFb] = useState("");
  const ai = useAiRun();
  useEffect(() => { setReply(""); setInternal(false); setAtt(null); setResolution(t?.resolution || ""); setRate(0); setFb(""); ai.clear(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!t) return <Drawer anchor="right" open={false} onClose={onClose} />;
  const agent = canManageIt(user);
  const mine = t.requester === user.code;
  const asset = t.asset_id && data.assets.find((a) => a.asset_id === t.asset_id);
  const req = data.employees.find((e) => e.employee_code === t.requester);
  const agents = [...data.admins.filter((a) => a.status === "active" && a.modules.includes("it")), ...data.superAdmins];
  const thread = t.comments.filter((c) => agent || !c.internal);
  const send = () => {
    const r = commentItTicket(t.id, reply, { internal, attachment: att });
    if (!r.ok) return notifyToast(r.error, "error");
    setReply(""); setAtt(null); setInternal(false);
  };
  const upd = (patch, msg) => { const r = updateItTicket(t.id, patch); notifyToast(r.ok ? msg : r.error, r.ok ? "success" : "error"); };
  const suggest = () => {
    const kb = KB[t.category] || KB.other;
    const first = (nameOf(t.requester) || "").split(" ")[0];
    const offline = `Hi ${first},\n\nThanks for reporting this. ${t.status === "open" ? "I've picked up your ticket." : "Following up on your ticket."} Could you please try the following and let me know the result:\n\n${kb.steps.slice(0, 3).map((s, i) => `${i + 1}. ${s.replace(/\*\*/g, "")}`).join("\n")}\n\n${asset ? `I can see your ${asset.category.toLowerCase()} ${asset.asset_id} is ${asset.warranty_end >= new Date().toISOString().slice(0, 10) ? "still under warranty, so a replacement part is covered if needed" : "out of warranty"}. ` : ""}If it still doesn't work, reply with a screenshot of the error and a good time to call you${t.contact ? ` on ${t.contact}` : ""}.\n\nRegards,\n${user.full_name}\nIT Service Desk`;
    ai.run({ task: "it-reply", instruction: "Draft a short, friendly reply from the IT service desk to the employee: acknowledge, give the next 2–3 concrete steps or the fix, ask only for information that is missing, never ask for a password. Sign off as the agent.", input: `Ticket ${t.id} · ${IT_CATEGORY_LABEL[t.category]} · ${t.priority}\nSubject: ${t.subject}\nDescription: ${t.description}\nAsset: ${asset ? `${asset.asset_id} ${asset.model} warranty ${asset.warranty_end}` : "none"}\nThread: ${thread.map((c) => `${nameOf(c.by)}: ${c.text}`).join(" | ") || "none"}\nAgent: ${user.full_name}`, offline });
  };
  return (
    <Drawer anchor="right" open={!!t} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 640 } } }}>
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" color="primary"><Mono>{t.id}</Mono> · {IT_CATEGORY_LABEL[t.category]}</Typography>
            <Typography variant="h2" sx={{ fontSize: "1.05rem" }}>{t.subject}</Typography>
            <Typography variant="caption" color="text.secondary">Raised {fmtDateTime(t.created_at)} by {nameOf(t.requester)}{req ? ` · ${req.designation}` : ""}</Typography>
          </Box>
          <StatusTag s={t.status} />
          <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
        </Stack>
        <Stack direction="row" sx={{ gap: 0.8, mt: 1.2, flexWrap: "wrap" }}>
          <PriTag p={t.priority} />
          <Tag tone={SLA_TONE[slaState(t)]}>{t.status === "awaiting_approval" ? "SLA starts once it is approved" : IT_OPEN.includes(t.status) ? `SLA ${slaText(t)}` : slaState(t) === "met" ? "Resolved within SLA" : "SLA missed"}</Tag>
          <Tag>{t.assigned_to ? `Assigned to ${nameOf(t.assigned_to)}` : "Not yet assigned"}</Tag>
        </Stack>
        <Typography variant="body2" sx={{ mt: 2, whiteSpace: "pre-wrap" }}>{t.description}</Typography>
        <Box sx={{ mt: 1.5 }}><KeyVal cols={3} items={[["Asset", asset ? `${asset.asset_id} · ${asset.model}` : "—"], ["Contact", t.contact || "—"], ["Location", t.location || "—"]]} /></Box>
        {t.attachments?.map((a, i) => <Button key={i} size="small" startIcon={<AttachFileRounded sx={{ fontSize: 14 }} />} href={a.data_url || undefined} download={a.name} sx={{ mt: 1, textTransform: "none", fontSize: "0.6rem" }}>{a.name}</Button>)}
        {t.resolution && <Alert severity="success" sx={{ mt: 1.5, fontSize: "0.66rem" }}><b>Resolution:</b> {t.resolution}</Alert>}

        {agent && (
          <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, border: "1px solid #e5eae5", background: "#fafcfa" }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.72rem", mb: 1 }}>Work this ticket</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
              <FormControl size="small" fullWidth><InputLabel>Assignee</InputLabel><Select label="Assignee" value={t.assigned_to || ""} onChange={(e) => upd({ assigned_to: e.target.value }, "Assignment updated.")}><MenuItem value="">Unassigned</MenuItem>{agents.map((a) => <MenuItem key={a.admin_code || a.superadmin_code} value={a.admin_code || a.superadmin_code}>{a.full_name}</MenuItem>)}</Select></FormControl>
              <FormControl size="small" fullWidth><InputLabel>Priority</InputLabel><Select label="Priority" value={t.priority} onChange={(e) => upd({ priority: e.target.value }, "Priority and SLA updated.")}>{Object.entries(IT_PRIORITY).map(([k, p]) => <MenuItem key={k} value={k}>{p.label} · {p.slaHours} h</MenuItem>)}</Select></FormControl>
              <FormControl size="small" fullWidth><InputLabel>Category</InputLabel><Select label="Category" value={t.category} onChange={(e) => upd({ category: e.target.value }, "Category updated.")}>{IT_CATEGORIES.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}</Select></FormControl>
            </Stack>
            {IT_OPEN.includes(t.status) && (
              <>
                <TextField size="small" fullWidth label="Resolution note (shown to the employee)" multiline minRows={2} value={resolution} onChange={(e) => setResolution(e.target.value)} sx={{ mt: 1.5 }} />
                <Stack direction="row" sx={{ gap: 1, mt: 1.2, flexWrap: "wrap" }}>
                  {t.status !== "in_progress" && <Button size="small" variant="outlined" onClick={() => upd({ status: "in_progress", assigned_to: t.assigned_to || user.code }, "Marked in progress.")}>Start work</Button>}
                  {t.status !== "waiting_user" && <Button size="small" variant="outlined" onClick={() => upd({ status: "waiting_user" }, "Waiting on the employee; they were notified.")}>Waiting on employee</Button>}
                  <Button size="small" variant="contained" onClick={() => upd({ status: "resolved", resolution, assigned_to: t.assigned_to || user.code }, "Resolved; the employee was notified.")}>Resolve</Button>
                </Stack>
              </>
            )}
            {t.status === "awaiting_approval" && <Alert severity="info" sx={{ mt: 1.2 }}>Waiting for approval ({t.approval_request}). It joins the IT queue, and the SLA starts, once approved.</Alert>}
            {!IT_OPEN.includes(t.status) && t.status !== "awaiting_approval" && <Button size="small" sx={{ mt: 1.2 }} variant="outlined" onClick={() => upd({ status: "in_progress" }, "Ticket reopened.")}>Reopen</Button>}
          </Box>
        )}

        <Typography variant="h3" sx={{ mt: 2.5, mb: 1 }}>Conversation</Typography>
        <Stack spacing={1}>
          {!thread.length && <Typography variant="caption" color="text.secondary">No replies yet. IT will respond within {IT_PRIORITY[t.priority].slaHours} hours.</Typography>}
          {thread.map((c, i) => (
            <Box key={i} sx={{ p: 1.2, borderRadius: 1.5, background: c.internal ? "#fff8ec" : c.by === t.requester ? "#f4f7fb" : "#f1f8f4", border: c.internal ? "1px dashed #e8c98f" : "1px solid #e8ece8" }}>
              <Typography sx={{ fontSize: "0.62rem", fontWeight: 700 }}>{nameOf(c.by)}{c.by !== t.requester ? " · IT" : ""}{c.internal ? " · internal note" : ""} <span style={{ fontWeight: 400, color: "#78827b" }}>· {timeAgo(c.at)}</span></Typography>
              <Typography sx={{ fontSize: "0.68rem", whiteSpace: "pre-wrap", mt: 0.3 }}>{c.text}</Typography>
              {c.attachment && <Button size="small" startIcon={<AttachFileRounded sx={{ fontSize: 13 }} />} href={c.attachment.data_url || undefined} download={c.attachment.name} sx={{ textTransform: "none", fontSize: "0.58rem" }}>{c.attachment.name}</Button>}
            </Box>
          ))}
        </Stack>
        {(mine || agent) && t.status !== "closed" && (
          <Box sx={{ mt: 1.5 }}>
            {agent && <><AiButton busy={ai.busy} onClick={suggest}>AI suggested reply</AiButton><AiResult ai={ai} title="AI reply draft" onUse={(x) => { setReply(x); ai.clear(); }} useLabel="Use as reply" dense /></>}
            <TextField fullWidth multiline minRows={2} sx={{ mt: 1 }} label={mine && ["resolved"].includes(t.status) ? "Not fixed? Reply to reopen" : "Reply"} value={reply} onChange={(e) => setReply(e.target.value)} />
            <Stack direction="row" sx={{ mt: 1, gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Button size="small" component="label" startIcon={<AttachFileRounded />}>Attach<input hidden type="file" onChange={async (e) => { const fl = e.target.files?.[0]; if (!fl) return; if (fl.size > 1024 * 1024) return notifyToast("Attachments are limited to 1 MB.", "error"); setAtt({ name: fl.name, size: fl.size, type: fl.type, data_url: await readFileAsDataUrl(fl) }); }} /></Button>
              {att && <Chip size="small" label={att.name} onDelete={() => setAtt(null)} />}
              {agent && !mine && <FormControlLabel control={<Switch size="small" checked={internal} onChange={(e) => setInternal(e.target.checked)} />} label={<Typography sx={{ fontSize: "0.62rem" }}>Internal note</Typography>} />}
              <Button size="small" variant="contained" endIcon={<SendRounded />} sx={{ ml: "auto" }} onClick={send}>Send</Button>
            </Stack>
          </Box>
        )}
        {mine && t.status === "resolved" && (
          <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, border: "1px solid #cfe6d8", background: "#f1f8f4" }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Is it fixed?</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ mt: 1, alignItems: { sm: "center" } }}>
              <Rating value={rate} onChange={(_, v) => setRate(v || 0)} />
              <TextField size="small" fullWidth placeholder="Optional feedback for IT" value={fb} onChange={(e) => setFb(e.target.value)} />
              <Button variant="contained" disabled={!rate} onClick={() => { const r = rateItTicket(t.id, rate, fb); notifyToast(r.ok ? "Thanks! Ticket closed." : r.error, r.ok ? "success" : "error"); }}>Yes, close it</Button>
            </Stack>
          </Box>
        )}
        {mine && t.rating && <Typography variant="caption" sx={{ display: "block", mt: 1.5 }}>You rated this {t.rating}/5{t.feedback ? ` – “${t.feedback}”` : ""}.</Typography>}
        {agent && (
          <>
            <Typography variant="h3" sx={{ mt: 2.5, mb: 1 }}>History</Typography>
            {[...t.history].reverse().map((h, i) => <Typography key={i} sx={{ fontSize: "0.6rem", color: "#5c675f" }}>{fmtDateTime(h.at)} · {nameOf(h.by)} · {h.action}</Typography>)}
          </>
        )}
      </Box>
    </Drawer>
  );
}

// ── Contact IT card (used on IT support, HR support hint and My assets) ──
export function ContactItCard({ onRaise, compact }) {
  const navigate = useNavigate();
  const { openDm, data } = useStore();
  const items = [
    [<PhoneRounded key="p" />, "Call the service desk", IT_CONTACT.phone, `tel:${IT_CONTACT.phone.split(" ·")[0].replace(/\s/g, "")}`],
    [<MailOutlineRounded key="m" />, "Email", IT_CONTACT.email, `mailto:${IT_CONTACT.email}`],
    [<ForumRounded key="c" />, "Chat with IT", data.chatChannels?.some((c) => c.id === "CH-it") ? "#it-help channel" : "Message the IT team", null],
    [<PlaceRounded key="d" />, "Walk-in desk", IT_CONTACT.desk, null],
  ];
  return (
    <Grid min={compact ? 200 : 220} gap={1.5}>
      {items.map(([icon, title, sub, href]) => (
        <Card key={title} component={href ? "a" : "div"} href={href || undefined} onClick={title.startsWith("Chat") ? () => { const ch = data.chatChannels?.find((c) => c.id === "CH-it"); if (ch) navigate("/chat?c=CH-it"); else { const agent = data.admins.find((a) => a.status === "active" && a.modules.includes("it")); const r = agent && openDm(agent.admin_code); if (r?.ok) navigate(`/chat?c=${r.id}`); } } : undefined} sx={{ p: 1.5, display: "flex", gap: 1.2, alignItems: "center", textDecoration: "none", cursor: href || title.startsWith("Chat") ? "pointer" : "default", "&:hover": href || title.startsWith("Chat") ? { borderColor: "primary.main" } : undefined }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 1.5, display: "grid", placeItems: "center", background: "#e8f0f3", color: "#124554", "& svg": { fontSize: 19 } }}>{icon}</Box>
          <Box sx={{ minWidth: 0 }}><Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#26302a" }}>{title}</Typography><Typography sx={{ fontSize: "0.58rem", color: "#78827b" }} noWrap>{sub}</Typography></Box>
        </Card>
      ))}
    </Grid>
  );
}

// ── Employee: Contact IT support ───────────────────────
export default function ItSupportPage({ embedded = false }) {
  const tickets = useMyTickets();
  const [params, setParams] = useSearchParams();
  const [raise, setRaise] = useState(null);
  const [ask, setAsk] = useState("");
  const [q, setQ] = useState("");
  const ai = useAiRun();
  const open = tickets.filter((t) => IT_OPEN.includes(t.status) || t.status === "awaiting_approval");
  const waiting = tickets.filter((t) => t.status === "waiting_user");
  const rows = tickets.filter((t) => !q || `${t.id} ${t.subject} ${IT_CATEGORY_LABEL[t.category]}`.toLowerCase().includes(q.toLowerCase()));
  const help = () => {
    const h = selfHelp(ask);
    ai.run({ task: "it-troubleshoot", instruction: "You are the company IT help desk assistant. Give 3–6 safe, numbered self-help steps a non-technical employee can try, then say when to raise a ticket and with what priority. Never ask for passwords.", input: `Problem: ${ask}\nKnowledge base: ${h.kb.steps.join(" | ")}`, offline: `**${h.kb.title}**\n${h.kb.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nStill stuck? Raise a ticket – suggested category **${IT_CATEGORY_LABEL[h.category]}**, priority **${IT_PRIORITY[h.priority].label}** (response within ${IT_PRIORITY[h.priority].slaHours} h).` });
  };
  return (
    <>
      {embedded ? (
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.68rem", color: "#5c675f" }}>Laptop, phone, software, access, network, email or security problem? Try AI self-help, then raise a ticket and track it here.</Typography>
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => setRaise({})}>Raise IT ticket</Button>
        </Stack>
      ) : <PageHeader eyebrow="HERE TO HELP · IT" title="IT support" subtitle="Get help with your laptop, phone, software, access, network, email and security. Try AI self-help, then raise a ticket and track it here." actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setRaise({})}>Raise IT ticket</Button>} />}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.8} sx={{ alignItems: { sm: "center" }, mb: 2, p: "16px 19px", borderRadius: 1, border: "1px solid #dbe5ea", bgcolor: "background.paper" }}>
        <Box sx={{ width: 51, height: 51, borderRadius: "50%", display: "grid", placeItems: "center", background: "#fff", border: "1px solid #d5e2e8", color: "#124554", flexShrink: 0 }}><SupportAgentRounded /></Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.8px", color: "#6f8790", mb: 0.5 }}>IT SERVICE DESK · {IT_CONTACT.hours.toUpperCase()}</Typography>
          <Typography sx={{  fontWeight: 700, fontSize: "0.9rem", color: "#1f3d48" }}>Stuck? We'll get you working again.</Typography>
          <Typography sx={{ fontSize: "0.6rem", color: "#6f8790", mt: 0.4 }}>Critical issues within 4 hours · high 8 h · normal 1 working day · requests 3 days.</Typography>
        </Box>
        <Button variant="outlined" startIcon={<PhoneRounded />} href={`tel:${IT_CONTACT.phone.split(" ·")[0].replace(/\s/g, "")}`}>Contact IT</Button>
      </Stack>
      <Stack spacing={2.5}>
        <ContactItCard />
        <Grid min={150}>
          <StatCard label="Open tickets" value={open.length} tone="warn" />
          <StatCard label="Waiting on you" value={waiting.length} tone={waiting.length ? "bad" : "neutral"} hint={waiting.length ? "Reply so IT can continue" : "Nothing needed"} />
          <StatCard label="Resolved" value={tickets.filter((t) => ["resolved", "closed"].includes(t.status)).length} tone="good" />
          <StatCard label="Typical response" value="4–24 h" tone="info" hint="Depends on impact" />
        </Grid>
        {waiting.length > 0 && <Alert severity="warning">IT is waiting for your reply on {waiting.map((t) => t.id).join(", ")}. <Button size="small" onClick={() => setParams({ t: waiting[0].id })}>Open</Button></Alert>}
        <SectionCard title="Fix it yourself with AI" subtitle="Describe the problem – AI suggests safe steps from the IT knowledge base">
          <Box data-ai-ui>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField fullWidth size="small" value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask.trim() && help()} placeholder="e.g. Teams keeps asking for my password" />
              <AiButton variant="contained" busy={ai.busy} disabled={!ask.trim()} onClick={help}>Get help</AiButton>
            </Stack>
            <Stack direction="row" sx={{ gap: 0.8, mt: 1.2, flexWrap: "wrap" }}>
              {QUICK.map((qk) => <Chip key={qk.label} icon={qk.icon} label={qk.label} onClick={() => setAsk(qk.text)} sx={{ fontSize: "0.6rem", "& svg": { fontSize: 16 } }} />)}
            </Stack>
            <AiResult ai={ai} title="AI self-help" />
            {ai.text && !ai.busy && <Button size="small" sx={{ mt: 1 }} variant="outlined" onClick={() => setRaise({ description: ask, subject: ask.slice(0, 70) })}>Still not fixed – raise a ticket</Button>}
          </Box>
        </SectionCard>
        <SectionCard title="My IT tickets" subtitle="Click a ticket to see replies, add information or confirm it is fixed" action={<TextField size="small" placeholder="Search tickets" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 180 }} />} noPad>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead><TableRow><TableCell>Ticket</TableCell><TableCell>Category</TableCell><TableCell>Impact</TableCell><TableCell>Raised</TableCell><TableCell>Last update</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id} hover sx={{ cursor: "pointer" }} onClick={() => setParams({ t: t.id })}>
                    <TableCell><Typography sx={{ fontSize: "0.68rem", fontWeight: 700 }}>{t.subject}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}><Mono>{t.id}</Mono>{t.asset_id ? ` · ${t.asset_id}` : ""}</Typography></TableCell>
                    <TableCell sx={{ fontSize: "0.62rem" }}>{IT_CATEGORY_LABEL[t.category]}</TableCell>
                    <TableCell><PriTag p={t.priority} /></TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{timeAgo(t.created_at)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{timeAgo(t.updated_at)}</TableCell>
                    <TableCell><StatusTag s={t.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
          {!rows.length && <EmptyState title="No IT tickets" text="Raise one when something isn't working." />}
        </SectionCard>
      </Stack>
      <RaiseItTicketDialog open={!!raise} preset={raise || {}} onClose={() => setRaise(null)} onCreated={(id) => setParams({ t: id })} />
      <ItTicketDrawer id={params.get("t")} onClose={() => setParams({})} />
    </>
  );
}

// ── Section on My assets ───────────────────────────────
export function AssetItSupport({ onRaise }) {
  const navigate = useNavigate();
  const tickets = useMyTickets();
  const open = tickets.filter((t) => IT_OPEN.includes(t.status));
  return (
    <SectionCard title="IT support" subtitle="Device, software, access or network problem? Contact the service desk, or open the IT support tab to raise and track tickets." action={<Button size="small" variant="outlined" startIcon={<SupportAgentRounded />} onClick={() => navigate("/it-support")}>Contact IT support</Button>}>
      <Stack spacing={1.5}>
        <ContactItCard compact />
        {open.length ? (
          <Box>
            <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, color: "#5c675f", mb: 0.6 }}>Open IT tickets</Typography>
            {open.map((t) => (
              <Stack key={t.id} direction="row" onClick={() => navigate(`/it-support?t=${t.id}`)} sx={{ gap: 1.2, py: 0.8, borderBottom: "1px solid #f0f2ef", alignItems: "center", cursor: "pointer", "&:hover": { background: "#f7faf7" } }}>
                <ComputerRounded sx={{ fontSize: 18, color: "#124554" }} />
                <Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontSize: "0.68rem", fontWeight: 700 }} noWrap>{t.subject}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}><Mono>{t.id}</Mono>{t.asset_id ? ` · ${t.asset_id}` : ""} · {timeAgo(t.updated_at)}</Typography></Box>
                <PriTag p={t.priority} />
                <StatusTag s={t.status} />
              </Stack>
            ))}
          </Box>
        ) : <Typography sx={{ fontSize: "0.62rem", color: "#78827b" }}>No open IT tickets.</Typography>}
      </Stack>
    </SectionCard>
  );
}

// ── Admin: IT service desk ─────────────────────────────
export function ItHelpdeskPage() {
  const { data, user, nameOf } = useStore();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState("open");
  const [cat, setCat] = useState("");
  const [pri, setPri] = useState("");
  const [q, setQ] = useState("");
  const all = data.itTickets || [];
  const me = identityCodes(data, user);
  const rows = all.filter((t) => (view === "all" || (view === "open" ? IT_OPEN.includes(t.status) : view === "mine" ? me.has(t.assigned_to) && IT_OPEN.includes(t.status) : view === "unassigned" ? !t.assigned_to && IT_OPEN.includes(t.status) : view === "breached" ? slaState(t) === "breached" : !IT_OPEN.includes(t.status))) && (!cat || t.category === cat) && (!pri || t.priority === pri) && (!q || `${t.id} ${t.subject} ${nameOf(t.requester)} ${t.asset_id || ""}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (IT_OPEN.includes(a.status) && IT_OPEN.includes(b.status) ? a.sla_due.localeCompare(b.sla_due) : b.created_at.localeCompare(a.created_at)));
  const openT = all.filter((t) => IT_OPEN.includes(t.status));
  const closed = all.filter((t) => t.resolved_at);
  const avgH = closed.length ? closed.reduce((s, t) => s + (new Date(t.resolved_at) - new Date(t.created_at)) / 3600000, 0) / closed.length : 0;
  const rated = all.filter((t) => t.rating);
  const facts = [
    `${openT.length} open tickets: ${openT.filter((t) => t.priority === "critical").length} critical, ${openT.filter((t) => t.priority === "high").length} high, ${openT.filter((t) => !t.assigned_to).length} unassigned`,
    `SLA breached: ${openT.filter((t) => slaState(t) === "breached").map((t) => `${t.id} ${t.subject} (${slaText(t)})`).join("; ") || "none"}; at risk: ${openT.filter((t) => slaState(t) === "at_risk").map((t) => t.id).join(", ") || "none"}`,
    `Waiting on employees: ${openT.filter((t) => t.status === "waiting_user").map((t) => `${t.id} (${nameOf(t.requester)})`).join(", ") || "none"}`,
    `By category (open): ${IT_CATEGORIES.map(([k, l]) => [l, openT.filter((t) => t.category === k).length]).filter(([, n]) => n).map(([l, n]) => `${l} ${n}`).join(", ") || "none"}`,
    closed.length ? `Average resolution time ${avgH.toFixed(1)} h across ${closed.length} resolved tickets; ${closed.filter((t) => t.resolved_at <= t.sla_due).length} within SLA` : "",
    rated.length ? `Satisfaction ${(rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1)}/5 from ${rated.length} ratings` : "",
  ];
  return (
    <>
      <PageHeader eyebrow="CORE HR · IT SERVICE DESK" title="IT service desk" subtitle="Every IT ticket from employees: triage, assign, reply, resolve within SLA. Critical 4 h · High 8 h · Normal 24 h · Low 72 h." />
      <Stack spacing={2.5}>
        <Grid min={150}>
          <StatCard label="Open" value={openT.length} onClick={() => setView("open")} />
          <StatCard label="Unassigned" value={openT.filter((t) => !t.assigned_to).length} tone="warn" onClick={() => setView("unassigned")} />
          <StatCard label="SLA breached" value={openT.filter((t) => slaState(t) === "breached").length} tone="bad" onClick={() => setView("breached")} />
          <StatCard label="Assigned to me" value={openT.filter((t) => me.has(t.assigned_to)).length} tone="info" onClick={() => setView("mine")} />
          <StatCard label="Avg resolution" value={closed.length ? `${avgH.toFixed(1)} h` : "—"} tone="good" hint={rated.length ? `CSAT ${(rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1)}/5` : ""} />
        </Grid>
        <AiInsight title="AI service-desk brief" audience="the IT service desk lead" facts={facts} />
        <SectionCard title="Queue" subtitle="Sorted by SLA due time" noPad>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ p: 1.5 }}>
            <TextField size="small" placeholder="Search ticket, person, asset" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 220 }} />
            <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>View</InputLabel><Select label="View" value={view} onChange={(e) => setView(e.target.value)}>{[["open", "Open"], ["unassigned", "Unassigned"], ["mine", "Assigned to me"], ["breached", "SLA breached"], ["done", "Resolved & closed"], ["all", "All"]].map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Category</InputLabel><Select label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><MenuItem value="">All categories</MenuItem>{IT_CATEGORIES.map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}><InputLabel>Priority</InputLabel><Select label="Priority" value={pri} onChange={(e) => setPri(e.target.value)}><MenuItem value="">Any</MenuItem>{Object.entries(IT_PRIORITY).map(([k, p]) => <MenuItem key={k} value={k}>{p.label}</MenuItem>)}</Select></FormControl>
          </Stack>
          <TableWrap>
            <Table size="small" sx={{ minWidth: 1000 }}>
              <TableHead><TableRow><TableCell>Ticket</TableCell><TableCell>Requester</TableCell><TableCell>Category</TableCell><TableCell>Priority</TableCell><TableCell>SLA</TableCell><TableCell>Assignee</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>
                {rows.map((t) => {
                  const e = data.employees.find((x) => x.employee_code === t.requester);
                  return (
                    <TableRow key={t.id} hover sx={{ cursor: "pointer" }} onClick={() => setParams({ t: t.id })}>
                      <TableCell><Typography sx={{ fontSize: "0.68rem", fontWeight: 700 }}>{t.subject}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}><Mono>{t.id}</Mono>{t.asset_id ? ` · ${t.asset_id}` : ""} · {timeAgo(t.created_at)}</Typography></TableCell>
                      <TableCell><PersonCell name={nameOf(t.requester)} sub={e ? `${e.department} · ${e.city}` : t.requester} /></TableCell>
                      <TableCell sx={{ fontSize: "0.62rem" }}>{IT_CATEGORY_LABEL[t.category]}</TableCell>
                      <TableCell><PriTag p={t.priority} /></TableCell>
                      <TableCell><Tag tone={SLA_TONE[slaState(t)]}>{t.status === "awaiting_approval" ? "Not started" : IT_OPEN.includes(t.status) ? slaText(t) : slaState(t) === "met" ? "Met" : "Missed"}</Tag></TableCell>
                      <TableCell>{t.assigned_to ? nameOf(t.assigned_to) : <Tag tone="warn">Unassigned</Tag>}</TableCell>
                      <TableCell><StatusTag s={t.status} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrap>
          {!rows.length && <EmptyState title="Queue is clear" text="No tickets match this view." />}
        </SectionCard>
      </Stack>
      <ItTicketDrawer id={params.get("t")} onClose={() => setParams({})} />
    </>
  );
}
