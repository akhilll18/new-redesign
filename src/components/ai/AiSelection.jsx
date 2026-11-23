// Select any word, number or sentence anywhere in the portal and generative AI can explain it,
// simplify it, translate it, or hand it to the copilot.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Box, Button, ButtonBase, CircularProgress, IconButton, MenuItem, Popover, Select, Stack, Typography } from "@mui/material";
import { CloseRounded, ContentCopyRounded, ForumRounded, TranslateRounded, LightbulbRounded, AutoFixHighRounded } from "@mui/icons-material";
import { aiGenerate } from "../../lib/ai/client.js";
import { selectionPrompt } from "../../lib/ai/prompts.js";
import { AI_LANGUAGES, useAiSettings } from "../../lib/ai/config.js";
import { AI_GRADIENT, AiText, Sparkle, openCopilot } from "./AiText.jsx";

export default function AiSelection({ page }) {
  const s = useAiSettings();
  const [sel, setSel] = useState(null); // { text, rect, around }
  const [out, setOut] = useState(null); // { action, text, busy, err, anchor }
  const [lang, setLang] = useState(s.language !== "English" ? s.language : "Hindi");
  const ctl = useRef(null);

  useEffect(() => {
    if (!s.selection) return undefined;
    const onUp = (e) => {
      if (e.target.closest?.("[data-ai-ui]")) return;
      setTimeout(() => {
        const ws = window.getSelection();
        const text = ws?.toString().trim() || "";
        const node = ws?.anchorNode?.parentElement;
        if (!text || text.length < 2 || text.length > 900 || !ws.rangeCount || node?.closest("input, textarea, [contenteditable], [data-ai-ui]")) return setSel(null);
        const r = ws.getRangeAt(0).getBoundingClientRect();
        if (!r.width && !r.height) return setSel(null);
        const around = (node?.closest("p, li, td, tr, .MuiCard-root, section, div")?.innerText || "").slice(0, 500);
        setSel({ text, rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width }, around });
      }, 10);
    };
    const onDown = (e) => {
      if (!e.target.closest?.("[data-ai-ui]")) setSel(null);
    };
    const onScroll = () => setSel(null);
    const onKeyUp = (e) => {
      if (e.shiftKey || e.key === "Shift") onUp(e);
    };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [s.selection]);

  async function run(action, target = sel) {
    if (!target) return;
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    const anchor = { top: target.rect.bottom + 8, left: Math.max(8, Math.min(target.rect.left, window.innerWidth - 380)) };
    setOut({ action, text: "", busy: true, err: "", anchor, source: target });
    setSel(null);
    try {
      const language = action === "translate" ? lang : s.language;
      const p = selectionPrompt({ action, text: target.text, page: { ...page, around: target.around }, language });
      await aiGenerate({ task: `selection:${action}`, ...p, fast: true, maxTokens: 500, signal: c.signal, hint: { text: target.text }, onText: (_, full) => setOut((o) => (o ? { ...o, text: full } : o)) });
      setOut((o) => (o ? { ...o, busy: false } : o));
    } catch (e) {
      if (e.name !== "AbortError") setOut((o) => (o ? { ...o, busy: false, err: e.message } : o));
    }
  }

  const bubble = sel && (
    <Stack
      data-ai-ui
      direction="row"
      onMouseDown={(e) => e.preventDefault()}
      sx={{ position: "fixed", zIndex: 1460, top: Math.max(8, sel.rect.top - 40), left: Math.max(8, Math.min(sel.rect.left + sel.rect.width / 2 - 150, window.innerWidth - 310)), background: "#0F2E25", color: "#F2F7F4", borderRadius: "10px", p: 0.4, gap: 0.3, boxShadow: "0 10px 26px -10px rgba(0,0,0,0.5)", animation: "aiPop .15s ease-out" }}
    >
      <Box sx={{ display: "grid", placeItems: "center", px: 0.7, background: AI_GRADIENT, borderRadius: "7px" }}><Sparkle size={13} /></Box>
      {[
        ["explain", "Explain", <LightbulbRounded key="i" sx={{ fontSize: 13 }} />],
        ["simplify", "Simplify", <AutoFixHighRounded key="i" sx={{ fontSize: 13 }} />],
        ["translate", "Translate", <TranslateRounded key="i" sx={{ fontSize: 13 }} />],
      ].map(([id, label, icon]) => (
        <ButtonBase key={id} onClick={() => run(id)} sx={{ px: 0.9, py: 0.5, borderRadius: "7px", fontSize: "0.6rem", fontWeight: 700, gap: 0.4, "&:hover": { background: "rgba(255,255,255,0.12)" } }}>{icon}{label}</ButtonBase>
      ))}
      <ButtonBase onClick={() => { openCopilot(`About this text on the page: "${sel.text}"\n\n`, { send: false }); setSel(null); }} sx={{ px: 0.9, py: 0.5, borderRadius: "7px", fontSize: "0.6rem", fontWeight: 700, gap: 0.4, "&:hover": { background: "rgba(255,255,255,0.12)" } }}>
        <ForumRounded sx={{ fontSize: 13 }} />Ask
      </ButtonBase>
    </Stack>
  );

  return (
    <>
      {bubble && createPortal(bubble, document.body)}
      {out && (
        <Popover open onClose={() => { ctl.current?.abort(); setOut(null); }} anchorReference="anchorPosition" anchorPosition={out.anchor} slotProps={{ root: { "data-ai-ui": true }, paper: { "data-ai-ui": true, sx: { width: 360, maxWidth: "calc(100vw - 16px)", borderRadius: 2, overflow: "hidden" } } }}>
          <Box sx={{ px: 1.5, py: 1, background: AI_GRADIENT, color: "#fff", display: "flex", alignItems: "center", gap: 1 }}>
            <Sparkle size={15} />
            <Typography sx={{ flex: 1, fontSize: "0.7rem", fontWeight: 800 }}>{{ explain: "AI explains", simplify: "In plain words", translate: `Translation · ${lang}` }[out.action]}</Typography>
            <IconButton size="small" onClick={() => setOut(null)} sx={{ color: "#fff" }} aria-label="Close"><CloseRounded sx={{ fontSize: 16 }} /></IconButton>
          </Box>
          <Box sx={{ p: 1.5 }}>
            <Typography sx={{ fontSize: "0.6rem", color: "#7b857e", mb: 0.8, fontStyle: "italic", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>“{out.source.text}”</Typography>
            {out.err ? <Typography sx={{ fontSize: "0.65rem", color: "error.main" }}>{out.err}</Typography> : <AiText text={out.text} />}
            {out.busy && <CircularProgress size={12} />}
            <Stack direction="row" spacing={0.8} sx={{ mt: 1, alignItems: "center", justifyContent: "space-between" }}>
              {out.action === "translate" ? (
                <Select size="small" variant="standard" disableUnderline value={lang} onChange={(e) => { setLang(e.target.value); }} sx={{ fontSize: "0.62rem" }} MenuProps={{ slotProps: { root: { "data-ai-ui": true } } }}>
                  {AI_LANGUAGES.map((l) => <MenuItem key={l} value={l} sx={{ fontSize: "0.65rem" }}>{l}</MenuItem>)}
                </Select>
              ) : <span />}
              <Stack direction="row" spacing={0.5}>
                {out.action === "translate" && <Button size="small" onClick={() => run("translate", out.source)} sx={{ fontSize: "0.6rem" }}>Translate again</Button>}
                <IconButton size="small" onClick={() => navigator.clipboard?.writeText(out.text)} aria-label="Copy"><ContentCopyRounded sx={{ fontSize: 14 }} /></IconButton>
                <Button size="small" onClick={() => { openCopilot(`Tell me more about "${out.source.text}"`); setOut(null); }} sx={{ fontSize: "0.6rem" }}>Ask follow-up</Button>
              </Stack>
            </Stack>
          </Box>
        </Popover>
      )}
    </>
  );
}
