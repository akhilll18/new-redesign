// Internal chat: company channels, department channels, groups and direct messages, with @mentions, reactions,
// attachments, AI smart replies, AI "catch me up" summaries and /schedule to book a meeting from the conversation.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, InputAdornment, InputLabel, List, ListItemButton, MenuItem, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { SendRounded, AttachFileRounded, AddRounded, TagRounded, LockRounded, ArrowBackRounded, DeleteOutlineRounded, AddReactionOutlined, CampaignRounded, EventRounded } from "@mui/icons-material";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, Avatar, EmptyState } from "../kit/UI.jsx";
import { AI_GRADIENT, Sparkle } from "../ai/AiText.jsx";
import { AiButton, AiResult, useAiRun, runAi } from "./aiKit.jsx";
import { AiScheduleDialog } from "./CalendarViews.jsx";
import PeoplePicker from "../kit/PeoplePicker.jsx";
import { myChannels, channelMembers, unreadCount, directory } from "../../lib/collab.js";
import { readFileAsDataUrl, fmtBytes } from "../../lib/utils.js";

const EMOJI = ["👍", "🎉", "🙏", "😂", "✅", "👀"];
const dayLabel = (iso) => {
  const d = new Date(iso);
  const t = new Date();
  const y = new Date(Date.now() - 86400000);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
};
const timeOf = (iso) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

function smartRepliesOffline(last, myName) {
  const t = String(last?.text || "").toLowerCase();
  if (!last) return ["Hi everyone 👋", "Quick update from my side:", "Does anyone have a minute?"];
  if (/\b(thanks|thank you|thx)\b/.test(t)) return ["You're welcome!", "Happy to help 🙂", "Anytime!"];
  if (/\b(can we|could we|move|reschedule|meet|call|sync|1:1)\b/.test(t)) return ["Sure, that works for me.", "Can we do 30 minutes later instead?", "Let me check my calendar and confirm."];
  if (/\?\s*$/.test(t) || /\b(how|what|when|where|why|can|could|do|does|is|are)\b/.test(t.split(" ")[0] || "")) return ["Let me check and get back to you shortly.", "Good question – here's what I know:", "I'm not sure – adding someone who might know."];
  if (/\b(please|pls|kindly)\b/.test(t)) return ["On it 👍", "Will do – I'll update here once done.", "Sure, by when do you need it?"];
  if (/\b(great|awesome|congrat|well done|good job)\b/.test(t)) return ["Thank you! 🙏", "Team effort 🎉", "Thanks – appreciate it!"];
  return ["Got it, thanks!", "Sounds good 👍", "Noted – I'll follow up."];
}

export default function ChatPage() {
  const { data, user, nameOf, sendChatMessage, markChannelRead, openDm, reactChat, deleteChatMessage, notifyToast } = useStore();
  const [params, setParams] = useSearchParams();
  const narrow = useMediaQuery("(max-width:900px)");
  const channels = myChannels(data, user);
  const [active, setActive] = useState(params.get("c") || channels.find((c) => c.id === "CH-general")?.id || channels[0]?.id);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [q, setQ] = useState("");
  const [newDlg, setNewDlg] = useState(null);
  const [sched, setSched] = useState(null);
  const [replies, setReplies] = useState(null);
  const [repBusy, setRepBusy] = useState(false);
  const [mobileList, setMobileList] = useState(!params.get("c"));
  const summary = useAiRun();
  const endRef = useRef(null);
  const ch = channels.find((c) => c.id === active);
  // Only conversations the signed-in person belongs to are readable (a ?c= link to someone else's chat shows nothing).
  const msgs = useMemo(() => (ch ? (data.chatMessages || []).filter((m) => m.channel_id === ch.id).sort((a, b) => a.at.localeCompare(b.at)) : []), [data.chatMessages, ch?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastOther = [...msgs].reverse().find((m) => m.from !== user.code && !m.deleted);
  const titleOf = (c) => (c.kind === "dm" ? nameOf(c.members.find((x) => x !== user.code) || user.code) : c.kind === "channel" ? `#${c.name}` : c.name);

  useEffect(() => { if (params.get("c") && params.get("c") !== active) { setActive(params.get("c")); setMobileList(false); } }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (active && !ch && channels[0]) setActive(channels.find((c) => c.id === "CH-general")?.id || channels[0].id); }, [active, ch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ch) markChannelRead(ch.id); setReplies(null); summary.clear(); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ch && msgs.length) markChannelRead(ch.id); endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (id) => { setActive(id); setParams({ c: id }); setMobileList(false); };
  const send = () => {
    const body = text.trim();
    if (body.startsWith("/schedule")) {
      const others = ch ? channelMembers(data, ch).filter((c) => c !== user.code && c.startsWith("EMP")) : [];
      const rest = body.replace(/^\/schedule\s*/, "");
      const withPart = rest && !/\bwith\b/i.test(rest) && ch?.kind !== "channel" ? ` with ${others.map((c) => nameOf(c).split(" ")[0]).join(" and ")}` : "";
      setSched(`${rest || "30 min"}${withPart}`);
      setText("");
      return;
    }
    if (!body && !file) return;
    const r = sendChatMessage(active, body, file);
    if (!r.ok) return notifyToast(r.error, "error");
    setText("");
    setFile(null);
    setReplies(null);
  };
  const suggest = async () => {
    setRepBusy(true);
    const offline = smartRepliesOffline(lastOther, user.full_name);
    try {
      const out = await runAi({ task: "chat-replies", fast: true, maxTokens: 200, instruction: "Suggest exactly 3 short, natural replies (max 12 words each) the user could send next in this workplace chat. Output one per line starting with '- '. Match the tone of the conversation.", input: msgs.slice(-8).map((m) => `${nameOf(m.from)}: ${m.text}`).join("\n") + `\n(I am ${user.full_name})`, offline: offline.map((x) => `- ${x}`).join("\n") });
      const list = out.split("\n").map((l) => l.replace(/^[-*\d.\s]+/, "").replace(/^"|"$/g, "").trim()).filter(Boolean).slice(0, 3);
      setReplies(list.length ? list : offline);
    } catch {
      setReplies(offline);
    } finally {
      setRepBusy(false);
    }
  };
  const catchUp = () => {
    const last = data.chatReads?.[user.code]?.[active] || "";
    const recent = msgs.slice(-40);
    const people = [...new Set(recent.map((m) => nameOf(m.from)))];
    const qs = recent.filter((m) => /\?/.test(m.text));
    const asks = recent.filter((m) => /@|please|can you|could you/i.test(m.text));
    const offline = [`**${titleOf(ch)} – ${recent.length} recent message(s)** from ${people.join(", ") || "nobody yet"}.`, ...recent.slice(-5).map((m) => `- **${nameOf(m.from).split(" ")[0]}:** ${m.text.slice(0, 120)}`), qs.length ? `\n**Open questions:** ${qs.map((m) => `"${m.text.slice(0, 80)}" (${nameOf(m.from).split(" ")[0]})`).join("; ")}` : "", asks.some((m) => m.mentions?.includes(user.code)) ? "\n**You were mentioned** – reply to keep things moving." : ""].filter(Boolean).join("\n");
    summary.run({ task: "chat-summary", instruction: "Summarise this chat for someone catching up: 2–4 bullets of what happened, decisions, open questions, and anything that needs the reader's action (they are named below). Keep it under 120 words.", input: `Reader: ${user.full_name}\n` + recent.map((m) => `[${m.at.slice(0, 16)}] ${nameOf(m.from)}: ${m.text}`).join("\n"), offline });
  };
  const renderText = (t) => t.split(/(@[A-Za-z]+)/g).map((p, i) => (p.startsWith("@") ? <Box key={i} component="span" sx={{ color: "#2C4B8F", fontWeight: 700, background: "#e9effa", borderRadius: 0.5, px: 0.3 }}>{p}</Box> : <React.Fragment key={i}>{p}</React.Fragment>));
  const filtered = channels.filter((c) => !q || titleOf(c).toLowerCase().includes(q.toLowerCase()));
  const group = (kind) => filtered.filter((c) => (kind === "channel" ? c.kind === "channel" : kind === "dm" ? c.kind === "dm" : c.kind === "group")).sort((a, b) => {
    const la = (data.chatMessages || []).filter((m) => m.channel_id === a.id).reduce((x, m) => (m.at > x ? m.at : x), a.created_at);
    const lb = (data.chatMessages || []).filter((m) => m.channel_id === b.id).reduce((x, m) => (m.at > x ? m.at : x), b.created_at);
    return lb.localeCompare(la);
  });
  const canPost = ch && !(ch.readonly && user.role === "emp");
  const showList = !narrow || mobileList;
  const showConv = !narrow || !mobileList;

  return (
    <>
      <PageHeader eyebrow="COLLABORATE · CHAT" title="Chat" subtitle="Talk to colleagues, teams and HR. Use @name to mention, /schedule to book a meeting, and AI to catch up or suggest replies. Press Ctrl+J in the message box to rewrite with AI." />
      <Box sx={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "280px minmax(0,1fr)", height: { xs: "calc(100vh - 210px)", md: "calc(100vh - 230px)" }, minHeight: 480, border: "1px solid #e1e7e2", borderRadius: 2.5, overflow: "hidden", background: "#fff" }}>
        {showList && (
          <Box sx={{ borderRight: narrow ? 0 : "1px solid #e9eee9", display: "flex", flexDirection: "column", minHeight: 0, background: "#f8faf8" }}>
            <Stack direction="row" spacing={1} sx={{ p: 1.2 }}>
              <TextField size="small" fullWidth placeholder="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} />
              <Tooltip title="New message or group"><IconButton onClick={() => setNewDlg({ kind: "dm", members: [], name: "", topic: "" })} sx={{ background: "#124554", color: "#fff", "&:hover": { background: "#0d3542" } }}><AddRounded fontSize="small" /></IconButton></Tooltip>
            </Stack>
            <Box sx={{ overflowY: "auto", flex: 1, px: 0.6, pb: 1 }}>
              {[["channel", "Channels"], ["group", "Groups"], ["dm", "Direct messages"]].map(([k, l]) => group(k).length > 0 && (
                <Box key={k} sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: "0.56rem", fontWeight: 800, color: "#7c8a80", px: 1, py: 0.6, letterSpacing: "0.06em" }}>{l.toUpperCase()}</Typography>
                  <List dense disablePadding>
                    {group(k).map((c) => {
                      const n = unreadCount(data, user, c.id);
                      const other = c.kind === "dm" ? c.members.find((x) => x !== user.code) : null;
                      return (
                        <ListItemButton key={c.id} selected={c.id === active} onClick={() => select(c.id)} sx={{ borderRadius: 1.5, py: 0.5, gap: 1 }}>
                          {c.kind === "dm" ? <Avatar name={nameOf(other)} size={24} /> : c.readonly ? <CampaignRounded sx={{ fontSize: 18, color: "#7c8a80" }} /> : c.kind === "group" ? <Avatar name={c.name} size={24} /> : <TagRounded sx={{ fontSize: 18, color: "#7c8a80" }} />}
                          <Typography sx={{ flex: 1, fontSize: "0.7rem", fontWeight: n ? 800 : 500, color: "#26302a" }} noWrap>{c.kind === "channel" ? c.name : titleOf(c)}</Typography>
                          {n > 0 && <Box sx={{ minWidth: 18, height: 18, px: 0.5, borderRadius: 9, background: "#C77B1C", color: "#fff", fontSize: "0.55rem", fontWeight: 800, display: "grid", placeItems: "center" }}>{n}</Box>}
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Box>
              ))}
            </Box>
          </Box>
        )}
        {showConv && (ch ? (
          <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, px: 1.5, py: 1, borderBottom: "1px solid #e9eee9" }}>
              {narrow && <IconButton size="small" aria-label="Back" onClick={() => setMobileList(true)}><ArrowBackRounded /></IconButton>}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.82rem" }} noWrap>{titleOf(ch)} {ch.readonly && <LockRounded sx={{ fontSize: 13, verticalAlign: "middle", color: "#7c8a80" }} />}</Typography>
                <Typography sx={{ fontSize: "0.56rem", color: "#7c8a80" }} noWrap>{ch.kind === "dm" ? data.employees.find((e) => e.employee_code === ch.members.find((x) => x !== user.code))?.designation || "Direct message" : `${channelMembers(data, ch).length} members${ch.topic ? ` · ${ch.topic}` : ""}`}</Typography>
              </Box>
              <AiButton busy={summary.busy} onClick={catchUp}>Catch me up</AiButton>
              <Tooltip title="Schedule a meeting with this conversation"><IconButton size="small" onClick={() => setSched(ch.kind === "channel" ? "30 min meeting this week" : `30 min with ${channelMembers(data, ch).filter((c) => c !== user.code && c.startsWith("EMP")).map((c) => nameOf(c).split(" ")[0]).join(" and ")} this week`)}><EventRounded fontSize="small" /></IconButton></Tooltip>
            </Stack>
            {(summary.text || summary.busy || summary.error) && <Box sx={{ px: 1.5 }}><AiResult ai={summary} title="AI catch-up" dense /></Box>}
            <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 1 }}>
              {!msgs.length && <EmptyState title="Say hello 👋" text="This is the start of the conversation." />}
              {msgs.map((m, i) => {
                const prev = msgs[i - 1];
                const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
                const grouped = prev && !newDay && prev.from === m.from && new Date(m.at) - new Date(prev.at) < 5 * 60000;
                const mine = m.from === user.code;
                return (
                  <React.Fragment key={m.id}>
                    {newDay && <Stack direction="row" sx={{ alignItems: "center", gap: 1, my: 1.2 }}><Box sx={{ flex: 1, height: 1, background: "#e9eee9" }} /><Typography sx={{ fontSize: "0.56rem", fontWeight: 700, color: "#7c8a80" }}>{dayLabel(m.at)}</Typography><Box sx={{ flex: 1, height: 1, background: "#e9eee9" }} /></Stack>}
                    <Stack direction="row" sx={{ gap: 1, mt: grouped ? 0.2 : 1, "&:hover .msg-actions": { opacity: 1 }, position: "relative", background: m.mentions?.includes(user.code) ? "#fff8ec" : undefined, borderRadius: 1, px: 0.5 }}>
                      <Box sx={{ width: 30, flexShrink: 0 }}>{!grouped && <Avatar name={nameOf(m.from)} size={30} />}</Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {!grouped && <Typography sx={{ fontSize: "0.66rem", fontWeight: 800 }}>{nameOf(m.from)} <Box component="span" sx={{ fontWeight: 400, color: "#8a948d", fontSize: "0.55rem", ml: 0.5 }}>{timeOf(m.at)}</Box></Typography>}
                        {m.deleted ? <Typography sx={{ fontSize: "0.66rem", fontStyle: "italic", color: "#9aa39c" }}>Message deleted</Typography> : <Typography sx={{ fontSize: "0.7rem", color: "#26302a", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{renderText(m.text)}</Typography>}
                        {m.attachment && !m.deleted && (m.attachment.type?.startsWith("image/") && m.attachment.data_url ? <Box component="img" src={m.attachment.data_url} alt={m.attachment.name} sx={{ maxWidth: 260, maxHeight: 200, borderRadius: 1.5, mt: 0.5, border: "1px solid #e5eae5" }} /> : <Button size="small" startIcon={<AttachFileRounded sx={{ fontSize: 14 }} />} href={m.attachment.data_url || undefined} download={m.attachment.name} sx={{ fontSize: "0.6rem", textTransform: "none", mt: 0.3 }}>{m.attachment.name} · {fmtBytes(m.attachment.size)}</Button>)}
                        {Object.keys(m.reactions || {}).length > 0 && <Stack direction="row" sx={{ gap: 0.5, mt: 0.4, flexWrap: "wrap" }}>{Object.entries(m.reactions).map(([e, who]) => <Chip key={e} size="small" label={`${e} ${who.length}`} onClick={() => reactChat(m.id, e)} title={who.map(nameOf).join(", ")} sx={{ height: 20, fontSize: "0.6rem", background: who.includes(user.code) ? "#e3f1ea" : "#f1f4f1", border: who.includes(user.code) ? "1px solid #9fd0b8" : "1px solid transparent" }} />)}</Stack>}
                      </Box>
                      {!m.deleted && (
                        <Stack className="msg-actions" direction="row" sx={{ opacity: 0, transition: "opacity .15s", position: "absolute", right: 4, top: -6, background: "#fff", border: "1px solid #e5eae5", borderRadius: 1.5, boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
                          {EMOJI.slice(0, 4).map((e) => <IconButton key={e} size="small" onClick={() => reactChat(m.id, e)} sx={{ fontSize: "0.8rem", width: 26, height: 26 }}>{e}</IconButton>)}
                          {(mine || user.role === "superadmin") && <IconButton size="small" aria-label="Delete message" onClick={() => deleteChatMessage(m.id)} sx={{ width: 26, height: 26 }}><DeleteOutlineRounded sx={{ fontSize: 15 }} /></IconButton>}
                        </Stack>
                      )}
                    </Stack>
                  </React.Fragment>
                );
              })}
              <div ref={endRef} />
            </Box>
            <Box sx={{ borderTop: "1px solid #e9eee9", p: 1.2, pr: { xs: 8, md: 13 } }}>
              {canPost ? (
                <>
                  <Stack direction="row" sx={{ gap: 0.6, mb: 0.8, flexWrap: "wrap", alignItems: "center" }} data-ai-ui>
                    {replies ? replies.map((r) => <Chip key={r} size="small" label={r} onClick={() => setText(r)} sx={{ fontSize: "0.6rem", cursor: "pointer", background: "#f0f6f2", border: "1px solid #d5e6dc" }} />) : (
                      <Button size="small" disabled={repBusy} onClick={suggest} startIcon={<Box sx={{ width: 16, height: 16, borderRadius: "5px", background: AI_GRADIENT, color: "#fff", display: "grid", placeItems: "center" }}><Sparkle size={10} /></Box>} sx={{ fontSize: "0.58rem", color: "#244d3d", textTransform: "none" }}>{repBusy ? "Thinking…" : "Suggest replies"}</Button>
                    )}
                    {file && <Chip size="small" label={`📎 ${file.name}`} onDelete={() => setFile(null)} sx={{ fontSize: "0.6rem" }} />}
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
                    <IconButton component="label" aria-label="Attach file" size="small"><AttachFileRounded fontSize="small" /><input hidden type="file" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 1024 * 1024) return notifyToast("Attachments are limited to 1 MB in this browser demo.", "error"); setFile({ name: f.name, size: f.size, type: f.type, data_url: await readFileAsDataUrl(f) }); e.target.value = ""; }} /></IconButton>
                    <TextField
                      fullWidth
                      multiline
                      maxRows={5}
                      size="small"
                      label={`Message ${titleOf(ch)}`}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder="Type a message · @name to mention · /schedule 30 min tomorrow"
                    />
                    <IconButton color="primary" aria-label="Send" onClick={send} disabled={!text.trim() && !file} sx={{ background: text.trim() || file ? "#124554" : undefined, color: text.trim() || file ? "#fff" : undefined, "&:hover": { background: "#0d3542" } }}><SendRounded fontSize="small" /></IconButton>
                  </Stack>
                </>
              ) : <Alert severity="info" sx={{ fontSize: "0.65rem" }}>Only admins can post in #{ch.name}.</Alert>}
            </Box>
          </Box>
        ) : <EmptyState title="No conversation selected" text="Pick a channel or start a direct message." />)}
      </Box>
      <NewConversationDialog value={newDlg} onClose={() => setNewDlg(null)} onCreated={(id) => { setNewDlg(null); select(id); }} />
      <AiScheduleDialog text={sched} onClose={() => setSched(null)} onBooked={() => { setSched(null); notifyToast("Meeting booked from chat."); }} />
    </>
  );
}

function NewConversationDialog({ value, onClose, onCreated }) {
  const { data, user, openDm, createChannel } = useStore();
  const [f, setF] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { setF(value); setError(""); }, [value]);
  if (!value || !f) return null;
  const people = directory(data).filter((p) => p.code !== user.code);
  const depts = data.orgUnits.filter((o) => o.parent_unit).map((o) => o.name);
  const create = () => {
    let r;
    if (f.kind === "dm") r = f.members[0] ? openDm(f.members[0]) : { ok: false, error: "Choose someone." };
    else if (f.kind === "group") r = createChannel({ kind: "group", name: f.name, members: f.members, topic: f.topic });
    else r = createChannel({ kind: "channel", name: f.name, topic: f.topic, members: f.audience === "all" ? "all" : f.audience?.startsWith("dept:") ? f.audience : [user.code, ...f.members] });
    if (!r.ok) return setError(r.error);
    onCreated(r.id);
  };
  return (
    <Dialog open={!!value} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>New conversation</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <ToggleButtonGroup size="small" exclusive value={f.kind} onChange={(_, v) => v && setF({ ...f, kind: v, members: [] })}><ToggleButton value="dm" sx={{ fontSize: "0.6rem" }}>Direct message</ToggleButton><ToggleButton value="group" sx={{ fontSize: "0.6rem" }}>Group</ToggleButton><ToggleButton value="channel" sx={{ fontSize: "0.6rem" }}>Channel</ToggleButton></ToggleButtonGroup>
          {f.kind !== "dm" && <TextField size="small" label={f.kind === "channel" ? "Channel name (e.g. q4-launch)" : "Group name"} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
          {f.kind === "channel" && (
            <FormControl size="small"><InputLabel>Who can join</InputLabel><Select label="Who can join" value={f.audience || "members"} onChange={(e) => setF({ ...f, audience: e.target.value })}><MenuItem value="members">People I add</MenuItem>{depts.map((d) => <MenuItem key={d} value={`dept:${d}`}>Everyone in {d}</MenuItem>)}<MenuItem value="all" disabled={user.role === "emp"}>Whole company{user.role === "emp" ? " (admins only)" : ""}</MenuItem></Select></FormControl>
          )}
          {(f.kind !== "channel" || !f.audience || f.audience === "members") && (
            <PeoplePicker people={people} multiple={f.kind !== "dm"} value={f.kind === "dm" ? f.members[0] || "" : f.members} onChange={(v) => setF({ ...f, members: f.kind === "dm" ? (v ? [v] : []) : v })} label={f.kind === "dm" ? "To" : "Members"} placeholder="Type a name…" />
          )}
          {f.kind !== "dm" && <TextField size="small" label="Topic (optional)" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={create}>{f.kind === "dm" ? "Open chat" : "Create"}</Button>
      </DialogActions>
    </Dialog>
  );
}
