// Generative AI insight cards (dashboards, payslips, reports) and the AI review panel used in approval drawers.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Skeleton, Stack, Tooltip, Typography } from "@mui/material";
import { ReplayRounded, ForumRounded, CheckCircleRounded, CancelRounded, HelpRounded, NoteAddRounded } from "@mui/icons-material";
import { aiGenerate, cacheGet, cacheKey, cacheSet } from "../../lib/ai/client.js";
import { insightPrompt, reviewPrompt } from "../../lib/ai/prompts.js";
import { useAiSettings, useAiStatus } from "../../lib/ai/config.js";
import { AI_GRADIENT, Sparkle, openCopilot, parseSections } from "./AiText.jsx";
import { G } from "../glass/Glass.jsx";
import { designTokens } from "../../theme/muiTheme.js";

const { color } = designTokens;

function useGenerated({ enabled, key, build, task, hint, maxTokens = 500 }) {
  const status = useAiStatus();
  const [text, setText] = useState(() => (key ? cacheGet(key) || "" : ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ctl = useRef(null);
  const run = async (force) => {
    if (!force && cacheGet(key)) return setText(cacheGet(key));
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setBusy(true);
    setErr("");
    setText("");
    try {
      const p = build();
      const out = await aiGenerate({ task, ...p, maxTokens, signal: c.signal, hint, onText: (_, full) => setText(full) });
      cacheSet(key, out);
    } catch (e) {
      if (e.name !== "AbortError") setErr(e.message || "AI request failed");
    } finally {
      if (ctl.current === c) setBusy(false);
    }
  };
  useEffect(() => {
    if (enabled && status) run(false);
    return () => ctl.current?.abort();
  }, [enabled, key, status?.provider]); // eslint-disable-line react-hooks/exhaustive-deps
  return { text, busy, err, run, status };
}

/**
 * <AiInsight title="…" facts={["…"]} audience="an HR admin" variant="glass|card" />
 * Facts are computed locally from real data; the AI only turns them into a narrative.
 */
export function AiInsight({ title = "AI insight", facts = [], audience = "the signed-in user", variant = "card", sx }) {
  const s = useAiSettings();
  const clean = facts.filter(Boolean);
  const key = useMemo(() => cacheKey("insight", title, clean, s.language, s.model), [title, clean.join("|"), s.language, s.model]); // eslint-disable-line react-hooks/exhaustive-deps
  const { text, busy, err, run, status } = useGenerated({
    enabled: s.insights && clean.length > 0,
    key,
    task: "insight",
    hint: { facts: clean, title },
    build: () => insightPrompt({ title, facts: clean, audience, language: s.language }),
  });
  if (!s.insights || !clean.length) return null;
  const p = parseSections(text, ["HEADLINE", "ACTION"]);
  const glass = variant === "glass";
  const fg = glass ? G.fog : color.text;
  const muted = glass ? G.muted : color.secondaryText;
  return (
    <Box
      data-ai-ui
      sx={{
        position: "relative",
        borderRadius: glass ? "20px" : 2,
        p: 2,
        overflow: "hidden",
        color: fg,
        background: glass ? G.forest : color.primarySoft,
        border: glass ? `1px solid ${G.line}` : `1px solid ${color.border}`,
        backdropFilter: glass ? "blur(18px)" : undefined,
        ...sx,
      }}
    >
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1 }}>
        <Box sx={{ width: 24, height: 24, borderRadius: "8px", background: AI_GRADIENT, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}><Sparkle size={14} /></Box>
        <Typography sx={{  fontWeight: 800, fontSize: "0.78rem", flex: 1 }}>{title}</Typography>
        <Chip size="small" label={status?.provider === "mock" ? "Demo AI" : "Generative AI"} sx={{ height: 18, fontSize: "0.52rem", fontWeight: 700, background: glass ? "rgba(255,255,255,0.14)" : color.primarySoft, color: glass ? G.mint : color.primary }} />
        <Tooltip title="Regenerate"><span><IconButton size="small" disabled={busy} onClick={() => run(true)} sx={{ color: muted }}><ReplayRounded sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
      </Stack>
      {err ? (
        <Typography sx={{ fontSize: "0.65rem", color: glass ? G.bad : "error.main" }}>{err}</Typography>
      ) : !text ? (
        <Stack spacing={0.6}>
          <Skeleton variant="text" width="85%" sx={{ bgcolor: glass ? "rgba(255,255,255,0.12)" : undefined }} />
          <Skeleton variant="text" width="65%" sx={{ bgcolor: glass ? "rgba(255,255,255,0.12)" : undefined }} />
        </Stack>
      ) : (
        <>
          {p.HEADLINE && <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, lineHeight: 1.45, mb: 0.6 }}>{p.HEADLINE}</Typography>}
          {!p.HEADLINE && !p.bullets.length && <Typography sx={{ fontSize: "0.7rem", whiteSpace: "pre-wrap" }}>{text}</Typography>}
          {p.bullets.length > 0 && (
            <Box component="ul" sx={{ m: 0, pl: 2.2 }}>
              {p.bullets.map((b, i) => <li key={i}><Typography sx={{ fontSize: "0.66rem", color: muted, lineHeight: 1.55 }}>{b}</Typography></li>)}
            </Box>
          )}
          {p.ACTION && (
            <Stack direction="row" sx={{ mt: 1, alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.64rem", fontWeight: 700, color: glass ? G.saffron : "#C77B1C" }}>Next step: <span style={{ fontWeight: 500, color: fg }}>{p.ACTION}</span></Typography>
            </Stack>
          )}
          {busy && <CircularProgress size={11} sx={{ mt: 0.5, color: glass ? G.mint : undefined }} />}
          {!busy && (
            <Button size="small" startIcon={<ForumRounded sx={{ fontSize: 14 }} />} onClick={() => openCopilot(`${p.HEADLINE || title} — tell me more and what I should do.`)} sx={{ mt: 0.8, fontSize: "0.6rem", color: glass ? G.mint : "#244d3d", px: 0.5 }}>
              Ask a follow-up
            </Button>
          )}
        </>
      )}
    </Box>
  );
}

const REC_STYLE = {
  approve: { icon: <CheckCircleRounded sx={{ fontSize: 15 }} />, color: "success" },
  reject: { icon: <CancelRounded sx={{ fontSize: 15 }} />, color: "error" },
  ask: { icon: <HelpRounded sx={{ fontSize: 15 }} />, color: "warning" },
};

/** AI review for an approval: recommendation, reasons and a ready-to-send note. */
export function AiReview({ kind, id, facts = [], flags = [], rec, onUseNote, onDecision }) {
  const s = useAiSettings();
  const key = useMemo(() => cacheKey("review", id, facts, flags, s.language, s.model), [id, facts.join("|"), flags.join("|"), s.language, s.model]); // eslint-disable-line react-hooks/exhaustive-deps
  const { text, busy, err, run } = useGenerated({
    enabled: s.insights,
    key,
    task: "review",
    maxTokens: 600,
    hint: { facts, flags, rec, kind },
    build: () => reviewPrompt({ kind, facts: [...facts, ...flags.map((f) => `Flag: ${f}`)], language: s.language }),
  });
  if (!s.insights) {
    return (
      <Button size="small" startIcon={<Sparkle size={14} />} onClick={() => openCopilot(`Review this ${kind} for me:\n${facts.join("\n")}`)} sx={{ fontSize: "0.62rem" }}>
        Ask AI to review
      </Button>
    );
  }
  const p = parseSections(text, ["RECOMMENDATION", "WHY", "NOTE"]);
  const r = (p.RECOMMENDATION || "").toLowerCase();
  const kindRec = r.startsWith("approve") ? "approve" : r.startsWith("reject") ? "reject" : r ? "ask" : null;
  return (
    <Box data-ai-ui sx={{ borderRadius: 2, p: 1.6, background: color.primarySoft, border: `1px solid ${color.border}` }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.8 }}>
        <Box sx={{ width: 22, height: 22, borderRadius: "7px", background: AI_GRADIENT, color: "#fff", display: "grid", placeItems: "center" }}><Sparkle size={13} /></Box>
        <Typography sx={{ fontWeight: 800, fontSize: "0.74rem", flex: 1 }}>AI review</Typography>
        {kindRec && <Chip size="small" color={REC_STYLE[kindRec].color} icon={REC_STYLE[kindRec].icon} label={p.RECOMMENDATION} sx={{ fontSize: "0.6rem", fontWeight: 700 }} />}
        <Tooltip title="Re-run review"><span><IconButton size="small" disabled={busy} onClick={() => run(true)}><ReplayRounded sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
      </Stack>
      {err && <Alert severity="warning" sx={{ fontSize: "0.62rem", py: 0 }}>{err}</Alert>}
      {!text && !err && <Skeleton variant="text" width="80%" />}
      {p.bullets.length > 0 && (
        <Box component="ul" sx={{ m: 0, pl: 2.2 }}>
          {p.bullets.map((b, i) => <li key={i}><Typography sx={{ fontSize: "0.64rem", color: "#4d5850", lineHeight: 1.5 }}>{b}</Typography></li>)}
        </Box>
      )}
      {p.NOTE && (
        <Box sx={{ mt: 1, p: 1, borderRadius: 1, background: "#fff", border: "1px dashed #cfdcd3" }}>
          <Typography sx={{ fontSize: "0.6rem", color: "#78827b", mb: 0.3 }}>Suggested note to the employee</Typography>
          <Typography sx={{ fontSize: "0.66rem", lineHeight: 1.5 }}>{p.NOTE}</Typography>
          {!busy && (
            <Stack direction="row" spacing={1} sx={{ mt: 0.8 }}>
              {onUseNote && <Button size="small" variant="outlined" startIcon={<NoteAddRounded sx={{ fontSize: 14 }} />} onClick={() => { onUseNote(p.NOTE); if (kindRec && kindRec !== "ask") onDecision?.(kindRec); }} sx={{ fontSize: "0.6rem" }}>Use note{kindRec && kindRec !== "ask" ? ` & ${kindRec}` : ""}</Button>}
              <Button size="small" onClick={() => openCopilot(`About ${kind} ${id}: ${p.RECOMMENDATION}. Help me think this decision through.`)} sx={{ fontSize: "0.6rem" }}>Discuss</Button>
            </Stack>
          )}
        </Box>
      )}
      <Typography sx={{ fontSize: "0.52rem", color: "#9aa39c", mt: 0.8 }}>Advisory only — you make the decision.</Typography>
    </Box>
  );
}
