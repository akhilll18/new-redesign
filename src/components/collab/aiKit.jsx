// Small generative-AI building blocks for the v8 modules (BGV, ATS, compliance, chat, meetings, calendar).
// Every call passes an offline answer computed from real data, so the button still works without a live model.
import React, { useRef, useState } from "react";
import { Box, Button, Chip, CircularProgress, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { ContentCopyRounded, ReplayRounded, CloseRounded } from "@mui/icons-material";
import { aiGenerate } from "../../lib/ai/client.js";
import { BASE } from "../../lib/ai/prompts.js";
import { getAiSettings, useAiSettings, useAiStatus } from "../../lib/ai/config.js";
import { AI_GRADIENT, AiText, Sparkle } from "../ai/AiText.jsx";
import { designTokens } from "../../theme/muiTheme.js";

const { color } = designTokens;

/** Run one AI task. Returns the full text. */
export async function runAi({ task, instruction, input, offline, fast = false, maxTokens = 700, onText, signal }) {
  const lang = getAiSettings().language;
  return aiGenerate({
    task,
    fast,
    maxTokens,
    signal,
    onText,
    hint: { offline },
    system: `${BASE()}\n${instruction}\nReply in ${lang || "English"}. Use only the facts provided; if something is missing, say so.`,
    messages: [{ role: "user", content: input }],
  });
}

export function useAiRun() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ctl = useRef(null);
  const run = async (opts) => {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setBusy(true);
    setError("");
    setText("");
    try {
      const out = await runAi({ ...opts, signal: c.signal, onText: (_, full) => setText(full) });
      setText(out);
      return out;
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || "AI request failed");
      return "";
    } finally {
      if (ctl.current === c) setBusy(false);
    }
  };
  const clear = () => { ctl.current?.abort(); setText(""); setError(""); setBusy(false); };
  return { text, busy, error, run, clear, setText };
}

export function AiButton({ children, onClick, busy, size = "small", variant = "outlined", sx, disabled }) {
  return (
    <Button
      data-ai-ui
      size={size}
      variant={variant}
      disabled={busy || disabled}
      onClick={onClick}
      startIcon={busy ? <CircularProgress size={13} /> : <Sparkle size={15} />}
      sx={{ borderColor: color.border, color: variant === "contained" ? "#fff" : color.primary, background: variant === "contained" ? AI_GRADIENT : color.primarySoft, whiteSpace: "nowrap", ...sx }}
    >
      {children}
    </Button>
  );
}

/** Output panel for an AI result with copy / use / retry / close. */
export function AiResult({ ai, title = "AI draft", onUse, useLabel = "Use this", onRetry, dense }) {
  const status = useAiStatus();
  if (!ai.text && !ai.busy && !ai.error) return null;
  return (
    <Box data-ai-ui sx={{ mt: 1, p: dense ? 1.2 : 1.6, borderRadius: 2, border: `1px solid ${color.border}`, background: color.primarySoft }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.6 }}>
        <Box sx={{ width: 20, height: 20, borderRadius: "6px", background: AI_GRADIENT, color: "#fff", display: "grid", placeItems: "center" }}><Sparkle size={12} /></Box>
        <Typography sx={{ fontWeight: 800, fontSize: "0.7rem", flex: 1 }}>{title}</Typography>
        <Chip size="small" label={status?.provider === "mock" ? "Demo AI" : "Generative AI"} sx={{ height: 17, fontSize: "0.5rem", fontWeight: 700, background: "#ebf3ec", color: "#244d3d" }} />
        {ai.busy && <CircularProgress size={12} />}
        {!ai.busy && ai.text && <Tooltip title="Copy"><IconButton size="small" onClick={() => navigator.clipboard?.writeText(ai.text)}><ContentCopyRounded sx={{ fontSize: 14 }} /></IconButton></Tooltip>}
        {!ai.busy && onRetry && <Tooltip title="Regenerate"><IconButton size="small" onClick={onRetry}><ReplayRounded sx={{ fontSize: 14 }} /></IconButton></Tooltip>}
        <Tooltip title="Close"><IconButton size="small" onClick={ai.clear}><CloseRounded sx={{ fontSize: 14 }} /></IconButton></Tooltip>
      </Stack>
      {ai.error ? <Typography sx={{ fontSize: "0.65rem", color: "error.main" }}>{ai.error}</Typography> : <Box sx={{ fontSize: "0.68rem", color: "#2f3a33" }}><AiText text={ai.text} size="0.68rem" /></Box>}
      {onUse && ai.text && !ai.busy && <Button size="small" variant="contained" sx={{ mt: 1 }} onClick={() => onUse(ai.text)}>{useLabel}</Button>}
    </Box>
  );
}

export function useAiOn() {
  const s = useAiSettings();
  return s;
}
