// PeopleHub AI copilot: a generative assistant on every page that sees what you see (role-scoped).
import React, { useEffect, useRef, useState } from "react";
import { Box, Button, Chip, CircularProgress, Divider, Drawer, Fab, FormControlLabel, IconButton, InputBase, MenuItem, Select, Stack, Switch, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { CloseRounded, SendRounded, StopRounded, DeleteSweepRounded, TuneRounded, ContentCopyRounded, ArrowBackRounded, CircleRounded } from "@mui/icons-material";
import { aiGenerate } from "../../lib/ai/client.js";
import { copilotSystem } from "../../lib/ai/prompts.js";
import { AI_LANGUAGES, setAiSettings, useAiSettings, useAiStatus } from "../../lib/ai/config.js";
import { buildAiContext } from "../../lib/ai/context.js";
import { AI_EVENT, AI_GRADIENT, AiText, Sparkle } from "./AiText.jsx";
import ActionCard from "./ActionCard.jsx";
import { planCommand, suggest, describeValues } from "../../ai/agent/plan.js";
import { leaveTypesFor } from "../../country/countryPacks.js";

const PAGE_SUGGESTIONS = {
  home: ["What needs my attention today?", "How many leave days do I have left?", "Summarise my week"],
  inbox: ["Summarise what is waiting for my approval", "Which requests are oldest?", "Draft a polite rejection note"],
  leave: ["How many leave days do I have left?", "Which leave type should I use for 3 days off next month?", "Explain the leave policy"],
  expenses: ["Explain the expense policy limits", "Write a description for a client travel claim", "When do I need receipts?"],
  "my-contract": ["When does my contract end?", "How is my timesheet paid?", "What TDS is deducted from my invoice?"],
  contracts: ["Which contracts end this month?", "Which contract workers are a co-employment risk?", "Summarise this month's contractor spend"],
  finances: ["Explain my latest payslip", "Old vs new tax regime — which suits me?", "What deductions are on my payslip?"],
  attendance: ["How was my attendance this week?", "How do I fix a missed punch?", "What time counts as late?"],
  "performance-me": ["Draft my self review from my goals", "Which goals are at risk?", "Suggest a new goal for next quarter"],
  profile: ["What details can I edit here?", "Is anything missing in my profile?"],
  team: ["Who in my team is off or late today?", "Draft a team update message"],
  admin: ["What needs my attention today?", "Summarise my approval queue", "Any attendance issues today?"],
  super: ["Give me a company health summary", "Any security concerns today?", "Summarise attrition and hiring"],
  approvals: ["Summarise my approval queue by type", "Which items are over SLA?", "Draft a rejection reason for a missing receipt"],
  requests: ["Summarise all open requests", "Which requests are oldest?"],
  offers: ["Draft an offer email to a candidate", "Write a probation clause", "Write a remote-work clause"],
  payslips: ["Explain the payslip approval chain", "Draft the payslip release email"],
  reports: ["What stands out in these reports?", "Summarise this page as 3 bullet points for leadership"],
  analytics: ["Summarise our HR analytics for leadership", "What drives attrition here?"],
  policies: ["Explain the approval workflow", "Suggest a fair work-from-home policy"],
  settings: ["Explain each security setting", "Recommend safer settings"],
  audit: ["Summarise recent audit activity", "Anything suspicious in the audit log?"],
  employees: ["How many employees per department?", "Draft a welcome message for a new joiner"],
  people: ["Who works in Engineering?", "Draft a welcome note for new joiners"],
  support: ["Help me write an HR support ticket", "How do I update my bank details?"],
  learning: ["Recommend a learning plan for me", "Summarise the learning library"],
};

function storageKey(code) {
  return `peoplehub-ai-chat-${code}`;
}

export default function AiCopilot({ store, route, onNavigate, nav = [] }) {
  const s = useAiSettings();
  const status = useAiStatus();
  const mobile = useMediaQuery("(max-width:700px)");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("chat");
  const [msgs, setMsgs] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey(store.user.code)) || "[]");
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const ctl = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const storeRef = useRef(store);
  storeRef.current = store;
  const routeRef = useRef(route);
  routeRef.current = route;
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  // v10.10: what the AI may act on — the live store, the signed-in user, their leave types and every screen they can open
  const me = store.user.role === "emp" ? store.data.employees.find((e) => e.employee_code === store.user.employee_code) : null;
  const ctx = React.useMemo(() => ({ store, data: store.data, user: store.user, leaveTypes: me ? leaveTypesFor(store.data, me) : store.data.leaveTypes || [], navigate: onNavigate, nav }), [store, me, onNavigate, nav]);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const liveSug = React.useMemo(() => (input.trim().length >= 2 ? suggest(input, ctx, 3) : []), [input, ctx]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(store.user.code), JSON.stringify(msgs.slice(-30).map((m) => (m.result?.table ? { ...m, result: { ...m.result, table: { ...m.result.table, rows: m.result.table.rows.slice(0, 50) } } } : m))));
    } catch {
      /* ignore */
    }
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, store.user.code]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setView("chat");
    const history = [...msgsRef.current, { role: "user", content: q }];
    setMsgs([...history, { role: "assistant", content: "", pending: true }]);
    setBusy(true);
    const c = new AbortController();
    ctl.current = c;
    // v10.10: an instruction ("create an employee…", "run the headcount report", "approve all leave") becomes an action card
    try {
      const plan = await planCommand(q, ctxRef.current, { signal: c.signal });
      if (plan) {
        setMsgs([...history, { role: "assistant", kind: "action", plan, id: Date.now() }]);
        setBusy(false);
        return;
      }
    } catch { /* fall through to chat */ }
    try {
      const ctx = buildAiContext(storeRef.current, routeRef.current);
      const system = copilotSystem({ ctx, language: s.language });
      const apiMsgs = history.filter((m) => m.content && !m.error && m.kind !== "action").slice(-12).map((m) => ({ role: m.role, content: m.content }));
      await aiGenerate({
        task: "chat",
        system,
        messages: apiMsgs,
        maxTokens: 1500,
        signal: c.signal,
        hint: { question: q, ctx: ctx.snap },
        onText: (_, full) => setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full, pending: true }]),
      });
      setMsgs((m) => [...m.slice(0, -1), { ...m[m.length - 1], pending: false }]);
    } catch (e) {
      setMsgs((m) => [...m.slice(0, -1), e.name === "AbortError" ? { ...m[m.length - 1], pending: false, content: `${m[m.length - 1].content}\n\n_(stopped)_` } : { role: "assistant", content: `Sorry — ${e.message || "the AI request failed"}.`, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  // Open from anywhere: header buttons, selection bubble, insight cards.
  useEffect(() => {
    const on = (e) => {
      if (e.detail?.type !== "copilot") return;
      setOpen(true);
      setView("chat");
      if (e.detail.prompt && e.detail.send) setTimeout(() => send(e.detail.prompt), 30);
      else if (e.detail.prompt) {
        setInput(e.detail.prompt);
        setTimeout(() => inputRef.current?.focus(), 60);
      }
    };
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setOpen((o) => !o);
        setTimeout(() => inputRef.current?.focus(), 60);
      }
    };
    window.addEventListener(AI_EVENT, on);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener(AI_EVENT, on);
      window.removeEventListener("keydown", key);
    };
  }); // re-bind each render so send() sees fresh state

  useEffect(() => {
    document.body.style.setProperty("--ai-pad", open && s.copilot && !mobile ? "420px" : "0px");
    return () => document.body.style.setProperty("--ai-pad", "0px");
  }, [open, s.copilot, mobile]);

  if (!s.copilot) return null;
  const page = route.split(/[/?]/)[1] || "home";
  const suggestions = PAGE_SUGGESTIONS[page] || ["Summarise this page for me", "What needs my attention here?", "Explain this page in simple words"];
  const live = status?.provider && status.provider !== "mock";
  const first = store.user.full_name.split(" ")[0];

  return (
    <>
      {!open && (
        <Tooltip title="Ask EZY HR AI (Ctrl + /)" placement="left">
          <Fab data-ai-ui variant="extended" size="medium" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 80); }} sx={{ position: "fixed", right: { xs: 14, md: 22 }, bottom: { xs: 14, md: 22 }, zIndex: 1150, background: AI_GRADIENT, color: "#fff", textTransform: "none", fontWeight: 800, fontSize: "0.72rem", gap: 0.8, boxShadow: "0 12px 30px -10px rgba(15,46,37,0.7)", "&:hover": { filter: "brightness(1.08)", background: AI_GRADIENT } }}>
            <Sparkle size={18} /> Ask AI
          </Fab>
        </Tooltip>
      )}
      <Drawer
        anchor="right"
        variant="persistent"
        open={open}
        slotProps={{ paper: { "data-ai-ui": true, sx: { width: mobile ? "100%" : 420, zIndex: 1250, borderLeft: "1px solid #e3e9e4", boxShadow: "-24px 0 60px -40px rgba(15,46,37,0.5)" } } }}
        sx={{ zIndex: 1250 }}
      >
        <Stack sx={{ height: "100%" }}>
          <Box sx={{ px: 2, py: 1.4, background: AI_GRADIENT, color: "#fff" }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
              {view === "settings" ? (
                <IconButton size="small" onClick={() => setView("chat")} sx={{ color: "#fff" }} aria-label="Back"><ArrowBackRounded sx={{ fontSize: 18 }} /></IconButton>
              ) : (
                <Box sx={{ width: 30, height: 30, borderRadius: "9px", background: "rgba(255,255,255,0.18)", display: "grid", placeItems: "center" }}><Sparkle size={17} /></Box>
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{  fontWeight: 800, fontSize: "0.88rem" }}>EZY HR AI</Typography>
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                  <CircleRounded sx={{ fontSize: 8, color: live ? "#9FE3C9" : "#F2B35B" }} />
                  <Typography noWrap sx={{ fontSize: "0.58rem", opacity: 0.9 }}>{status?.label || "Connecting…"}</Typography>
                </Stack>
              </Box>
              <Tooltip title="AI preferences"><IconButton size="small" onClick={() => setView((v) => (v === "settings" ? "chat" : "settings"))} sx={{ color: "#fff" }}><TuneRounded sx={{ fontSize: 17 }} /></IconButton></Tooltip>
              <Tooltip title="Clear conversation"><span><IconButton size="small" disabled={!msgs.length || busy} onClick={() => setMsgs([])} sx={{ color: "#fff", "&.Mui-disabled": { color: "rgba(255,255,255,0.4)" } }}><DeleteSweepRounded sx={{ fontSize: 17 }} /></IconButton></span></Tooltip>
              <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: "#fff" }} aria-label="Close AI copilot"><CloseRounded sx={{ fontSize: 18 }} /></IconButton>
            </Stack>
          </Box>

          {view === "settings" ? (
            <Preferences store={store} onNavigate={onNavigate} />
          ) : (
            <>
              <Box sx={{ flex: 1, overflow: "auto", px: 2, py: 1.6, background: "#fbfdfb" }}>
                {!msgs.length && (
                  <Box sx={{ pt: 1 }}>
                    <Typography sx={{  fontWeight: 800, fontSize: "1.05rem", color: "#202922" }}>Hi {first}, how can I help?</Typography>
                    <Typography sx={{ fontSize: "0.66rem", color: "#66716a", mt: 0.5, lineHeight: 1.55 }}>
                      I can see this page and your {store.user.role === "emp" ? "own HR records" : "scope of the organisation"}. Ask a question, get a summary, or have me draft anything — reasons, reviews, emails, clauses, job posts.
                    </Typography>
                    <Typography sx={{ fontSize: "0.6rem", fontWeight: 800, color: "#1E88E5", mt: 2, mb: 0.6, letterSpacing: 0.4 }}>TELL ME WHAT TO DO</Typography>
                    <Stack spacing={0.6}>
                      {suggest("", ctx, 6).map((a) => (
                        <Box key={a.id} component="button" onClick={() => { setInput(a.example); setTimeout(() => inputRef.current?.focus(), 30); }} sx={{ all: "unset", cursor: "pointer", px: 1.2, py: 0.8, borderRadius: 1.4, border: "1px dashed #cfe0ea", background: "#f7fbfd", fontSize: "0.64rem", color: "#20424f", display: "block" }}>
                          <b>{a.title}</b> <span style={{ color: "#6b7f86" }}>— “{a.example}”</span>
                        </Box>
                      ))}
                    </Stack>
                    <Typography sx={{ fontSize: "0.6rem", fontWeight: 800, color: "#2E8C7A", mt: 2, mb: 0.6, letterSpacing: 0.4 }}>OR ASK</Typography>
                    <Stack spacing={0.8}>
                      {suggestions.map((q) => (
                        <Box key={q} component="button" onClick={() => send(q)} sx={{ all: "unset", cursor: "pointer", px: 1.4, py: 1, borderRadius: 1.4, border: "1px solid #e6ece5", background: "#fff", fontSize: "0.68rem", color: "#244d3d", fontWeight: 600, display: "flex", gap: 1, alignItems: "center", "&:hover": { borderColor: "#9fd7a7", background: "#f8faf7" } }}>
                          <Sparkle size={13} /> {q}
                        </Box>
                      ))}
                    </Stack>
                    <Typography sx={{ fontSize: "0.58rem", color: "#9aa39c", mt: 2.5, lineHeight: 1.6 }}>
                      Tips: select any text on screen to explain or translate it · focus any text box and press <b>Ctrl+J</b> for AI writing · <b>Ctrl+/</b> opens this panel.
                    </Typography>
                  </Box>
                )}
                <Stack spacing={1.4}>
                  {msgs.map((m, i) =>
                    m.kind === "action" ? (
                      <ActionCard key={m.id || i} msg={m} ctx={ctx} onUpdate={(nm) => setMsgs((ms) => ms.map((x, j) => (j === i ? nm : x)))} onNavigate={(to) => { onNavigate(to); if (mobile) setOpen(false); }} />
                    ) : m.role === "user" ? (
                      <Box key={i} sx={{ alignSelf: "flex-end", maxWidth: "85%", px: 1.4, py: 0.9, borderRadius: "14px 14px 4px 14px", background: "#244d3d", color: "#fff", fontSize: "0.7rem", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.content}</Box>
                    ) : (
                      <Box key={i} sx={{ alignSelf: "flex-start", maxWidth: "94%", px: 1.4, py: 1, borderRadius: "14px 14px 14px 4px", background: m.error ? "#fdf0ec" : "#fff", border: "1px solid #e7ece7", color: "#202922", position: "relative", "&:hover .ai-copy": { opacity: 1 } }}>
                        {m.content ? <AiText text={m.content} onNavigate={(to) => { onNavigate(to); if (mobile) setOpen(false); }} /> : <CircularProgress size={14} />}
                        {m.content && !m.pending && (
                          <IconButton className="ai-copy" size="small" onClick={() => navigator.clipboard?.writeText(m.content.replace(/\[\[go:[^\]]+\]\]/g, ""))} sx={{ position: "absolute", top: 2, right: 2, opacity: 0, transition: "opacity .15s" }} aria-label="Copy reply"><ContentCopyRounded sx={{ fontSize: 13 }} /></IconButton>
                        )}
                      </Box>
                    ),
                  )}
                </Stack>
                <div ref={endRef} />
              </Box>
              {!!msgs.length && !busy && (
                <Box sx={{ px: 2, pt: 1, display: "flex", gap: 0.6, overflowX: "auto", background: "#fbfdfb" }}>
                  {suggestions.slice(0, 3).map((q) => <Chip key={q} size="small" label={q} onClick={() => send(q)} sx={{ fontSize: "0.58rem", flexShrink: 0 }} />)}
                </Box>
              )}
              {liveSug.length > 0 && !busy && (
                <Box data-testid="ai-live" sx={{ px: 1.5, pt: 0.8, background: "#fff", borderTop: "1px solid #edf0ec" }}>
                  {liveSug.map((a) => (
                    <Box key={a.id} component="button" onClick={() => (a.detected ? send() : (setInput(a.example), inputRef.current?.focus()))} sx={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", px: 1, py: 0.5, borderRadius: 1, mb: 0.3, background: a.detected ? "#eef6fc" : "transparent", "&:hover": { background: "#f1f6f8" } }}>
                      <Typography sx={{ fontSize: "0.62rem", fontWeight: 800, color: a.detected ? "#1E88E5" : "#33474f" }}>{a.detected ? "↵ " : ""}{a.title}</Typography>
                      <Typography noWrap sx={{ fontSize: "0.56rem", color: "#7b8b90" }}>{a.detected ? describeValues(a.detected, ctx) || "Press Enter to fill in the details" : `e.g. ${a.example}`}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
              <Box component="form" onSubmit={(e) => { e.preventDefault(); send(); }} sx={{ p: 1.5, borderTop: liveSug.length ? "none" : "1px solid #edf0ec", background: "#fff" }}>
                <Stack direction="row" sx={{ alignItems: "flex-end", gap: 1, border: "1px solid #dfe6df", borderRadius: 2, px: 1.2, py: 0.8, "&:focus-within": { borderColor: "#2E8C7A", boxShadow: "0 0 0 3px rgba(46,140,122,0.12)" } }}>
                  <InputBase
                    inputRef={inputRef}
                    data-ai="off"
                    multiline
                    maxRows={6}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Ask anything, or tell me what to do — “create employee…”, “run headcount report”…"
                    sx={{ flex: 1, fontSize: "0.72rem" }}
                    inputProps={{ "aria-label": "Message EZY HR AI", "data-ai": "off" }}
                  />
                  {busy ? (
                    <IconButton size="small" onClick={() => ctl.current?.abort()} aria-label="Stop"><StopRounded sx={{ fontSize: 18 }} /></IconButton>
                  ) : (
                    <IconButton type="submit" size="small" disabled={!input.trim()} sx={{ background: input.trim() ? AI_GRADIENT : undefined, color: input.trim() ? "#fff" : undefined }} aria-label="Send"><SendRounded sx={{ fontSize: 16 }} /></IconButton>
                  )}
                </Stack>
                <Typography sx={{ fontSize: "0.52rem", color: "#9aa39c", mt: 0.6, textAlign: "center" }}>AI fills in the details; nothing is saved until you click Confirm. AI can make mistakes.</Typography>
              </Box>
            </>
          )}
        </Stack>
      </Drawer>
    </>
  );
}

function Preferences({ store, onNavigate }) {
  const s = useAiSettings();
  const status = useAiStatus();
  const toggle = (k, label, help) => (
    <Box key={k}>
      <FormControlLabel control={<Switch size="small" checked={!!s[k]} onChange={(e) => setAiSettings({ [k]: e.target.checked })} />} label={<Typography sx={{ fontSize: "0.7rem", fontWeight: 600 }}>{label}</Typography>} />
      <Typography sx={{ fontSize: "0.6rem", color: "#78827b", ml: 5.5, mt: -0.6, mb: 1 }}>{help}</Typography>
    </Box>
  );
  return (
    <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
      <Typography variant="h3" sx={{ mb: 1 }}>AI preferences</Typography>
      <Typography sx={{ fontSize: "0.62rem", color: "#66716a", mb: 1 }}>Reply and translation language</Typography>
      <Select size="small" fullWidth value={s.language} onChange={(e) => setAiSettings({ language: e.target.value })} MenuProps={{ slotProps: { root: { "data-ai-ui": true } } }} sx={{ fontSize: "0.7rem", mb: 2 }}>
        {AI_LANGUAGES.map((l) => <MenuItem key={l} value={l} sx={{ fontSize: "0.7rem" }}>{l}</MenuItem>)}
      </Select>
      {toggle("fieldAssist", "AI on every text field", "✨ button to write, rewrite, fix, translate (Ctrl+J)")}
      {toggle("autocomplete", "Autocomplete while typing", "Ghost-text suggestions in long fields — Tab to accept")}
      {toggle("selection", "Explain any selected words", "Select text anywhere to explain, simplify or translate")}
      {toggle("insights", "AI insights on dashboards", "Summaries on homes, approvals, payslips and reports")}
      <Divider sx={{ my: 2 }} />
      <Typography sx={{ fontSize: "0.68rem", fontWeight: 700 }}>Connection</Typography>
      <Typography sx={{ fontSize: "0.62rem", color: "#66716a", mt: 0.4 }}>{status?.label || "Checking…"}</Typography>
      {store.user.role === "superadmin" ? (
        <Button size="small" variant="outlined" sx={{ mt: 1.2 }} onClick={() => onNavigate("/settings")}>Configure in System settings</Button>
      ) : (
        <Typography sx={{ fontSize: "0.6rem", color: "#9aa39c", mt: 0.8 }}>Your Super Admin manages the AI connection.</Typography>
      )}
    </Box>
  );
}
