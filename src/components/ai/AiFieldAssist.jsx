// ✨ Generative AI on every text field in the portal.
// Focus any text box or text area and a sparkle appears: write it for me, rewrite, fix, change tone, shorten,
// expand, bullet, continue, translate, or give your own instruction. Long fields also get ghost-text
// autocomplete while you type (press Tab to accept).
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Box, Button, ButtonBase, Chip, CircularProgress, IconButton, InputBase, MenuItem, Popover, Select, Stack, Tooltip, Typography } from "@mui/material";
import { CloseRounded, ReplayRounded, CheckRounded, ContentCopyRounded, SendRounded, TranslateRounded, KeyboardTabRounded } from "@mui/icons-material";
import { aiGenerate } from "../../lib/ai/client.js";
import { fieldPrompt, autocompletePrompt, FIELD_ACTIONS } from "../../lib/ai/prompts.js";
import { AI_LANGUAGES, useAiSettings } from "../../lib/ai/config.js";
import { AI_GRADIENT, Sparkle } from "./AiText.jsx";

const SKIP_NAME = /pass|captcha|\botp\b|\bpin\b|cvv|ifsc|\bpan\b|aadhaar|account.?(no|number)|amount|\bqty\b|phone|mobile|\blat\b|\blng\b|search/i;

export function isAiField(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.closest("[data-ai-ui]") || el.closest("[data-ai='off']") || el.dataset.ai === "off") return false;
  if (el.readOnly || el.disabled) return false;
  if (el.tagName === "TEXTAREA") return !el.getAttribute("aria-hidden");
  if (el.tagName !== "INPUT") return false;
  const type = (el.getAttribute("type") || "text").toLowerCase();
  if (!["text", ""].includes(type)) return false;
  if (el.getAttribute("role") === "combobox" || el.getAttribute("aria-hidden") === "true") return false;
  const im = el.getAttribute("inputmode");
  if (im && im !== "text") return false;
  const ac = el.getAttribute("autocomplete") || "";
  if (/one-time-code|cc-|password/.test(ac)) return false;
  if (SKIP_NAME.test(`${el.name} ${el.id}`)) return false;
  const lbl = fieldMeta(el).label;
  if (SKIP_NAME.test(lbl) && !/reason|note|remark|description/i.test(lbl)) return false;
  return true;
}

function labelOf(el) {
  const fc = el.closest(".MuiFormControl-root, .MuiTextField-root");
  const l = fc?.querySelector("label")?.innerText || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText) || el.getAttribute("aria-label") || el.placeholder || el.name || "";
  return l.replace(/\s*\*\s*$/, "").trim();
}

export function fieldMeta(el) {
  const fc = el.closest(".MuiFormControl-root, .MuiTextField-root");
  const scope = el.closest("form, [role='dialog'], .MuiDrawer-paper, .MuiCard-root") || null;
  let siblings = "";
  if (scope) {
    const pairs = [];
    scope.querySelectorAll("input, textarea, [role='combobox']").forEach((x) => {
      if (x === el || pairs.length >= 14) return;
      if (x.type === "password" || x.type === "hidden" && !x.value) return;
      const l = x.closest(".MuiFormControl-root, .MuiTextField-root")?.querySelector("label")?.innerText?.replace(/\s*\*\s*$/, "");
      const v = x.getAttribute("role") === "combobox" ? x.innerText : x.type === "checkbox" ? (x.checked ? "yes" : "no") : x.value;
      if (l && v) pairs.push(`${l}: ${String(v).slice(0, 80)}`);
    });
    siblings = pairs.join("; ");
  }
  return {
    label: labelOf(el),
    placeholder: el.placeholder || "",
    helper: fc?.querySelector(".MuiFormHelperText-root")?.innerText || "",
    multiline: el.tagName === "TEXTAREA",
    maxLength: el.maxLength > 0 ? el.maxLength : undefined,
    siblings,
  };
}

export function setNativeValue(el, value) {
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const clean = (t, single) => {
  let s = (t || "").replace(/^\s*["“]|["”]\s*$/g, "").trim();
  if (single) s = s.replace(/\s*\n+\s*/g, " ");
  return s;
};

export default function AiFieldAssist({ page }) {
  const s = useAiSettings();
  const [field, setField] = useState(null); // focused element
  const [rect, setRect] = useState(null);
  const [panel, setPanel] = useState(null); // { el, meta, original }
  const [ghost, setGhostState] = useState(null); // { el, text }
  const ghostRef = useRef(null);
  const setGhost = useCallback((g) => {
    ghostRef.current = g;
    setGhostState(g);
  }, []);
  const hideT = useRef(null);
  const ghostT = useRef(null);
  const ghostCtl = useRef(null);
  const panelOpen = useRef(false);
  panelOpen.current = !!panel;
  const pageRef = useRef(page);
  pageRef.current = page;
  const sRef = useRef(s);
  sRef.current = s;

  const measure = useCallback((el) => {
    if (!el || !document.contains(el)) return setRect(null);
    const host = el.closest(".MuiInputBase-root") || el;
    const r = host.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return setRect(null);
    setRect({ top: r.top, left: r.left, right: r.right, bottom: r.bottom, height: r.height, width: r.width });
  }, []);

  // Track the focused field.
  useEffect(() => {
    if (!s.fieldAssist && !s.autocomplete) return undefined;
    const onIn = (e) => {
      const el = e.target;
      if (!isAiField(el)) return;
      clearTimeout(hideT.current);
      setField(el);
      measure(el);
    };
    const onOut = (e) => {
      if (e.relatedTarget?.closest?.("[data-ai-ui]")) return;
      hideT.current = setTimeout(() => {
        if (panelOpen.current) return;
        setField(null);
        setGhost(null);
      }, 180);
    };
    const onMove = () => setField((f) => (measure(f), f));
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [s.fieldAssist, s.autocomplete, measure]);

  // Ghost-text autocomplete in long fields.
  useEffect(() => {
    if (!s.autocomplete) return undefined;
    const onInput = (e) => {
      const el = e.target;
      if (el.tagName !== "TEXTAREA" || !isAiField(el)) return;
      setGhost(null);
      clearTimeout(ghostT.current);
      ghostCtl.current?.abort();
      measure(el);
      const text = el.value;
      if (text.trim().length < 15 || el.selectionEnd !== text.length || /\n$/.test(text)) return;
      ghostT.current = setTimeout(async () => {
        const ctl = new AbortController();
        ghostCtl.current = ctl;
        const meta = fieldMeta(el);
        try {
          const p = autocompletePrompt({ text, field: meta, page: pageRef.current });
          let out = await aiGenerate({ task: "autocomplete", ...p, fast: true, maxTokens: 40, signal: ctl.signal, hint: { text, field: meta } });
          out = out.replace(/\n.*/s, "");
          if (!out.trim() || ctl.signal.aborted || el.value !== text) return;
          if (!/^\s/.test(out) && /[A-Za-z0-9]$/.test(text) && /^[A-Za-z]/.test(out)) out = ` ${out}`;
          setGhost({ el, text: out });
        } catch {
          /* silent: autocomplete is best-effort */
        }
      }, 1100);
    };
    const onKey = (e) => {
      const g = ghostRef.current;
      if (!g) return;
      if (e.key === "Tab" && e.target === g.el && !e.shiftKey) {
        e.preventDefault();
        ghostRef.current = null;
        setGhost(null);
        setNativeValue(g.el, g.el.value + g.text);
        return;
      }
      if (e.key === "Escape" || e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") {
        ghostRef.current = null;
        setGhost(null);
      }
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keydown", onKey, true);
      clearTimeout(ghostT.current);
    };
  }, [s.autocomplete, measure]);

  const openPanel = () => {
    if (!field) return;
    setGhost(null);
    setPanel({ el: field, meta: fieldMeta(field), original: field.value });
  };

  // Ctrl/⌘ + J opens the assistant on the focused field.
  useEffect(() => {
    const k = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j" && isAiField(document.activeElement)) {
        e.preventDefault();
        const el = document.activeElement;
        setField(el);
        measure(el);
        setPanel({ el, meta: fieldMeta(el), original: el.value });
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [measure]);

  const showBtn = s.fieldAssist && field && rect && !panel;
  return (
    <>
      {showBtn &&
        createPortal(
          <Tooltip title="Generative AI · write, rewrite, translate (Ctrl+J)" placement="top">
            <ButtonBase
              data-ai-ui
              aria-label="Open AI writing assistant for this field"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openPanel}
              sx={{
                position: "fixed",
                zIndex: 1450,
                top: field.tagName === "TEXTAREA" ? rect.bottom - 30 : rect.top + rect.height / 2 - 12,
                left: rect.right - (field.tagName === "TEXTAREA" ? 32 : 30),
                width: 24,
                height: 24,
                borderRadius: "8px",
                background: AI_GRADIENT,
                color: "#fff",
                boxShadow: "0 4px 12px -4px rgba(39,97,78,0.6)",
                animation: "aiPop .18s ease-out",
                "@keyframes aiPop": { from: { transform: "scale(0.6)", opacity: 0 }, to: { transform: "scale(1)", opacity: 1 } },
                "&:hover": { filter: "brightness(1.1)" },
              }}
            >
              <Sparkle size={14} />
            </ButtonBase>
          </Tooltip>,
          document.body,
        )}
      {ghost && rect && field === ghost.el &&
        createPortal(
          <Box data-ai-ui sx={{ position: "fixed", zIndex: 1450, top: Math.min(rect.bottom + 4, window.innerHeight - 40), left: rect.left, maxWidth: Math.max(240, rect.width), px: 1, py: 0.5, borderRadius: 1, background: "#fff", border: "1px dashed #9fd7a7", boxShadow: "0 6px 16px -8px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", gap: 0.8, pointerEvents: "none" }}>
            <Sparkle size={12} sx={{ color: "#2E8C7A" }} />
            <Typography sx={{ fontSize: "0.65rem", color: "#7b857e", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>…{ghost.text}</Typography>
            <Chip size="small" icon={<KeyboardTabRounded sx={{ fontSize: 12 }} />} label="Tab" sx={{ height: 18, fontSize: "0.55rem" }} />
          </Box>,
          document.body,
        )}
      {panel && <AssistPanel panel={panel} rect={rect} page={page} settings={s} onClose={() => { setPanel(null); setTimeout(() => panel.el.focus?.(), 0); }} />}
    </>
  );
}

function AssistPanel({ panel, rect, page, settings, onClose }) {
  const { el, meta, original } = panel;
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [last, setLast] = useState(null);
  const [custom, setCustom] = useState("");
  const [lang, setLang] = useState(settings.language !== "English" ? settings.language : "Hindi");
  const ctl = useRef(null);
  useEffect(() => () => ctl.current?.abort(), []);

  async function run(action, instr) {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setLast({ action, instr });
    setBusy(true);
    setErr("");
    setResult("");
    const text = el.value;
    try {
      const p = fieldPrompt({ action, text, field: meta, page, language: settings.language, custom: instr });
      let out = await aiGenerate({ task: `field:${action}`, ...p, fast: true, maxTokens: meta.multiline ? 900 : 160, signal: c.signal, hint: { text, field: { ...meta, page: page.title } }, onText: (_, full) => setResult(full) });
      out = action === "continue" ? out : clean(out, !meta.multiline);
      if (meta.maxLength) out = out.slice(0, meta.maxLength);
      setResult(out);
      if (!out.trim()) setErr("The AI had nothing to suggest for this field. Try another action or add a few words first.");
    } catch (e) {
      if (e.name !== "AbortError") setErr(e.message || "AI request failed.");
    } finally {
      if (ctl.current === c) setBusy(false);
    }
  }

  const apply = (mode) => {
    const cur = el.value;
    const next = last?.action === "continue" || mode === "append" ? `${cur}${cur && !/\s$/.test(cur) && !/^\s/.test(result) ? (meta.multiline && mode === "append" ? "\n" : " ") : ""}${result}` : result;
    setNativeValue(el, meta.maxLength ? next.slice(0, meta.maxLength) : next);
    onClose();
  };

  const anchor = rect ? { top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - 400)) } : { top: 120, left: 120 };
  const actions = FIELD_ACTIONS.filter((a) => !a.multiline || meta.multiline).filter((a) => a.id === "write" || a.id === "continue" ? true : !!original.trim());

  return (
    <Popover
      open
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchor}
      disableRestoreFocus
      slotProps={{ root: { "data-ai-ui": true }, paper: { "data-ai-ui": true, sx: { width: 390, maxWidth: "calc(100vw - 16px)", borderRadius: 2, overflow: "hidden", boxShadow: "0 20px 50px -18px rgba(15,46,37,0.45)" } } }}
    >
      <Box sx={{ px: 1.6, py: 1.1, background: AI_GRADIENT, color: "#fff", display: "flex", alignItems: "center", gap: 1 }}>
        <Sparkle size={16} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 800 }}>Generative AI</Typography>
          <Typography noWrap sx={{ fontSize: "0.58rem", opacity: 0.85 }}>{meta.label || "This field"} · {page.title}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: "#fff" }} aria-label="Close AI assistant"><CloseRounded sx={{ fontSize: 16 }} /></IconButton>
      </Box>
      <Box sx={{ p: 1.4 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6 }}>
          {actions.map((a) => (
            <Chip key={a.id} size="small" label={a.label} onClick={() => run(a.id)} disabled={busy} icon={a.id === "write" ? <Sparkle size={12} /> : undefined} sx={{ fontSize: "0.6rem", fontWeight: 600, background: a.id === "write" ? "#ebf3ec" : "#f8faf7", color: "#244d3d", "&:hover": { background: "#ebf3ec" } }} />
          ))}
        </Box>
        <Stack direction="row" spacing={0.8} sx={{ mt: 1, alignItems: "center" }}>
          <TranslateRounded sx={{ fontSize: 15, color: "#66716a" }} />
          <Select size="small" value={lang} onChange={(e) => setLang(e.target.value)} variant="standard" disableUnderline sx={{ fontSize: "0.62rem", minWidth: 90 }} MenuProps={{ slotProps: { root: { "data-ai-ui": true } } }}>
            {AI_LANGUAGES.map((l) => <MenuItem key={l} value={l} sx={{ fontSize: "0.65rem" }}>{l}</MenuItem>)}
          </Select>
          <Button size="small" disabled={busy || !original.trim()} onClick={() => run(`translate:${lang}`)} sx={{ fontSize: "0.6rem" }}>Translate</Button>
        </Stack>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) run("custom", custom.trim()); }} sx={{ mt: 1, display: "flex", alignItems: "center", gap: 0.5, border: "1px solid #e1e7e1", borderRadius: 1.2, px: 1, py: 0.2, "&:focus-within": { borderColor: "#2E8C7A" } }}>
          <InputBase data-ai="off" autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Tell AI what to write or change…" sx={{ flex: 1, fontSize: "0.65rem" }} inputProps={{ "aria-label": "Custom AI instruction" }} />
          <IconButton type="submit" size="small" disabled={busy || !custom.trim()} aria-label="Run instruction"><SendRounded sx={{ fontSize: 15 }} /></IconButton>
        </Box>

        {(busy || result || err) && (
          <Box sx={{ mt: 1.2, p: 1.2, borderRadius: 1.2, background: "#f7faf8", border: "1px solid #e3ece6", maxHeight: 220, overflow: "auto" }}>
            {err ? (
              <Typography sx={{ fontSize: "0.65rem", color: "error.main" }}>{err}</Typography>
            ) : (
              <Typography sx={{ fontSize: "0.68rem", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                {last?.action === "continue" && <span style={{ color: "#9aa39c" }}>…</span>}
                {result}
                {busy && <CircularProgress size={10} sx={{ ml: 0.8, verticalAlign: "middle" }} />}
              </Typography>
            )}
          </Box>
        )}
        {result && !busy && !err && (
          <Stack direction="row" spacing={0.8} sx={{ mt: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Tooltip title="Try again"><IconButton size="small" onClick={() => run(last.action, last.instr)}><ReplayRounded sx={{ fontSize: 16 }} /></IconButton></Tooltip>
            <Tooltip title="Copy"><IconButton size="small" onClick={() => navigator.clipboard?.writeText(result)}><ContentCopyRounded sx={{ fontSize: 15 }} /></IconButton></Tooltip>
            {last?.action !== "continue" && original.trim() && <Button size="small" variant="outlined" onClick={() => apply("append")} sx={{ fontSize: "0.6rem" }}>Add below</Button>}
            <Button size="small" variant="contained" startIcon={<CheckRounded sx={{ fontSize: 14 }} />} onClick={() => apply(last?.action === "continue" ? "append" : "replace")} sx={{ fontSize: "0.6rem" }}>
              {last?.action === "continue" ? "Insert" : original.trim() ? "Replace" : "Use this"}
            </Button>
          </Stack>
        )}
        <Typography sx={{ mt: 1, fontSize: "0.55rem", color: "#9aa39c" }}>AI can make mistakes — check before you submit.</Typography>
      </Box>
    </Popover>
  );
}
