// Language dropdown (v10.3): English is the default. The local languages of the selected company / location (or, for an
// employee, their own work location) are listed first. Built-in translations (src/country/i18nOffline.js) switch the
// sidebar, headings, buttons and common labels with NO internet or AI connection; when a live AI connection is set,
// generative AI also translates every remaining string on screen.
// "Translate page" — generative AI applied to every string on screen. It walks every text node in the page
// (headings, labels, table cells, buttons, chips, messages), sends the unique strings to the model in batches,
// and swaps the translations in place. New text that React renders later is translated as it appears.
// Inputs, the AI panels and code are left alone; "Original" restores the page. Translations are cached per session.
import React, { useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Divider, ListSubheader, Menu, MenuItem, Tooltip, Typography } from "@mui/material";
import { TranslateRounded, CheckRounded } from "@mui/icons-material";
import { aiGenerate } from "../lib/ai/client.js";
import { resolveProvider } from "../lib/ai/config.js";
import { useStore } from "../store/AppStore.jsx";
import { useCountry } from "./CountryContext.jsx";
import { packFor } from "./countryPacks.js";
import { translateOffline, hasOffline, OFFLINE_LANGUAGES, NATIVE, LANG_CODE } from "./i18nOffline.js";
import { ALL } from "../data/entities.js";
import { ONAS } from "./brand.js";

const COMMON = OFFLINE_LANGUAGES;
const SKIP = "[data-ai-ui],script,style,textarea,input,select,code,pre,[contenteditable='true'],.MuiInputBase-root,[data-no-translate]";
const original = new WeakMap();   // text node → original string
const cache = {};                 // language → { original: translation }

function loadCache(lang) {
  if (cache[lang]) return cache[lang];
  try {
    cache[lang] = JSON.parse(sessionStorage.getItem(`onas-i18n-${lang}`) || "{}");
  } catch {
    cache[lang] = {};
  }
  return cache[lang];
}
function saveCache(lang) {
  try {
    sessionStorage.setItem(`onas-i18n-${lang}`, JSON.stringify(cache[lang]));
  } catch {
    /* quota */
  }
}

function textNodes(root) {
  const out = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const t = n.nodeValue;
      if (!t || t.trim().length < 2 || !/\p{L}/u.test(t)) return NodeFilter.FILTER_REJECT;
      if (/^[A-Z0-9$€£₹₦.,:/\-\s]{1,4}$/.test(t.trim())) return NodeFilter.FILTER_REJECT; // initials, short codes
      if (n.parentElement?.closest(SKIP)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  while (w.nextNode()) out.push(w.currentNode);
  return out;
}

async function translateBatch(strings, lang, signal) {
  const system =
    `You translate the user interface of an HR portal into ${lang}. You get a JSON array of UI strings. ` +
    `Translate each one naturally and briefly, as a local HR product would. Keep unchanged: numbers, amounts, currency symbols and codes ` +
    `(N$, ₹, R, KES…), dates, employee codes (EMP001), people's names, acronyms such as PAYE, SSC, UIF, NSSF, PF, TDS, and anything that is already in ${lang}. ` +
    `Return ONLY a JSON array of strings with exactly the same length and order. No commentary.`;
  const out = await aiGenerate({ task: "translate-ui", system, messages: [{ role: "user", content: JSON.stringify(strings) }], fast: true, maxTokens: 4000, signal, temperature: 0 });
  const a = out.indexOf("["), b = out.lastIndexOf("]");
  const arr = JSON.parse(out.slice(a, b + 1));
  if (!Array.isArray(arr) || arr.length !== strings.length) throw new Error("The AI returned a different number of strings.");
  return arr;
}

const LANG_KEY = (code) => `ezyo-lang-${code || "anon"}`;

export default function AiPageLocalizer() {
  const { notifyToast, user, allData, entityScope } = useStore();
  const data = allData;
  const { pack: headerPack } = useCountry();
  // v10.3: local languages follow the legal entity / location — the employee's own work location, or the company /
  // location picked in the header switcher (Dubai office → Arabic). The default is always English.
  const me = user?.employee_code ? data.employees.find((e) => e.employee_code === user.employee_code) : null;
  const locs = data.workLocations || [];
  const selLoc = user?.role === "emp"
    ? locs.find((l) => l.location_id === me?.location_id)
    : entityScope?.location && entityScope.location !== ALL ? locs.find((l) => l.location_id === entityScope.location) : null;
  const selCo = !selLoc && user?.role !== "emp" && entityScope?.company && entityScope.company !== ALL ? (data.companies || []).find((c) => c.company_id === entityScope.company) : null;
  const pack = selLoc ? (packFor(selLoc.country) || headerPack) : selCo ? (packFor(selCo.country) || headerPack) : headerPack;
  const placeName = selLoc?.name || selCo?.short || pack?.name || "";
  const localLangs = [...new Set([selLoc?.local_language, ...(pack?.languages || [])].filter((l) => l && l !== "English"))];
  const [anchor, setAnchor] = useState(null);
  const [lang, setLang] = useState(null);
  // Re-apply the language the person chose last time (needs the live AI connection).
  useEffect(() => {
    let saved = null;
    try { saved = localStorage.getItem(LANG_KEY(user?.code)); } catch { /* storage disabled */ }
    if (saved && saved !== "English") { const t = setTimeout(() => start(saved, true), 1200); return () => clearTimeout(t); }
    return undefined;
  }, [user?.code]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false);
  const ctl = useRef(null);
  const obs = useRef(null);
  const queued = useRef(new Set());
  const liveRef = useRef(false);
  const timer = useRef(null);

  // The whole app (sidebar, header and page); AI panels, inputs and code are skipped.
  const root = () => document.getElementById("root") || document.querySelector("[data-ai-page]");

  function apply(l, nodes) {
    const dict = loadCache(l);
    const tr = (k) => dict[k] || translateOffline(l, k);
    const missing = new Set();
    for (const n of nodes) {
      const cur = n.nodeValue;
      const known = original.get(n);
      // React may have replaced the text since we translated it: treat the new value as the new original.
      const src = known !== undefined && tr(known.trim()) === cur.trim() ? known : cur;
      original.set(n, src);
      const key = src.trim();
      const t = tr(key);
      if (t) {
        const next = src.replace(key, t);
        if (n.nodeValue !== next) n.nodeValue = next;
      } else missing.add(key);
    }
    return [...missing];
  }

  async function fill(l, strings) {
    const dict = loadCache(l);
    const todo = strings.filter((s) => !dict[s]);
    for (let i = 0; i < todo.length; i += 60) {
      const part = todo.slice(i, i + 60);
      const res = await translateBatch(part, l, ctl.current?.signal);
      part.forEach((s, k) => (dict[s] = String(res[k] ?? s)));
      saveCache(l);
      const r = root();
      if (r) apply(l, textNodes(r));
    }
  }

  function restore() {
    obs.current?.disconnect();
    const r = root();
    if (r) for (const n of textNodes(r)) { const o = original.get(n); if (o !== undefined) n.nodeValue = o; }
    root()?.removeAttribute("lang");
  }

  async function start(l, silent) {
    setAnchor(null);
    ctl.current?.abort();
    restore();
    try { localStorage.setItem(LANG_KEY(user?.code), l || "English"); } catch { /* storage disabled */ }
    if (!l) return setLang(null);
    // Built-in translations work offline; AI (when connected) translates everything else on top.
    let live = false;
    try { live = (await resolveProvider()).provider !== "mock"; } catch { live = false; }
    liveRef.current = live;
    if (!hasOffline(l) && !live) {
      if (!silent) notifyToast(`${l} needs the AI connection (Super Admin → System settings → Generative AI). Built-in, offline languages: ${OFFLINE_LANGUAGES.join(", ")}.`, "info");
      return;
    }
    setLang(l);
    ctl.current = new AbortController();
    setBusy(true);
    try {
      const r = root();
      if (!r) return;
      r.setAttribute("lang", LANG_CODE[l] || l);
      const missing = apply(l, textNodes(r));
      watch(l);
      if (live) await fill(l, missing);
    } catch (e) {
      if (e.name !== "AbortError") notifyToast(`Translation stopped: ${e.message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  // Keep translating as React re-renders or the user moves to another page.
  function watch(l) {
    obs.current?.disconnect();
    const target = root() || document.body;
    obs.current = new MutationObserver(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const r = root();
        if (!r) return;
        obs.current.disconnect();
        const missing = apply(l, textNodes(r)).filter((s) => !queued.current.has(s));
        obs.current.observe(target, { subtree: true, childList: true, characterData: true });
        if (!liveRef.current) return;
        missing.forEach((s) => queued.current.add(s));
        if (missing.length) {
          try {
            await fill(l, missing);
          } catch {
            /* keep the page usable if a batch fails */
          } finally {
            missing.forEach((s) => queued.current.delete(s));
          }
        }
      }, 350);
    });
    obs.current.observe(target, { subtree: true, childList: true, characterData: true });
  }

  useEffect(() => () => { ctl.current?.abort(); obs.current?.disconnect(); }, []);

  const local = localLangs;
  const label = (l) => (NATIVE[l] && NATIVE[l] !== l ? `${NATIVE[l]} · ${l}` : l);
  const badge = (l) => <Typography component="span" sx={{ ml: "auto", pl: 1, fontSize: "0.5rem", fontWeight: 800, color: hasOffline(l) ? ONAS.teal : "#8a948d" }}>{hasOffline(l) ? "OFFLINE" : "AI"}</Typography>;
  return (
    <>
      <Tooltip title={lang ? `Showing ${lang} — click to change` : `Language: English (default). Local languages for ${placeName} work without any connection.`}>
        <Box data-ai-ui role="button" aria-label="Language" onClick={(e) => setAnchor(e.currentTarget)} sx={{ display: "flex", alignItems: "center", gap: 0.6, height: 34, px: 1.1, borderRadius: 99, border: `1px solid ${ONAS.line}`, cursor: "pointer", background: lang ? ONAS.mintSoft : "#fff", color: ONAS.navy, "&:hover": { borderColor: ONAS.teal } }}>
          {busy ? <CircularProgress size={14} sx={{ color: ONAS.teal }} /> : <TranslateRounded sx={{ fontSize: 16 }} />}
          <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, display: { xs: "none", sm: "block" } }}>{lang ? NATIVE[lang] || lang : "English"}</Typography>
        </Box>
      </Tooltip>
      <Menu data-ai-ui anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { width: 270, maxHeight: 460 } } }}>
        <MenuItem selected={!lang} onClick={() => start(null)} sx={{ fontSize: "0.72rem" }}>English (default) {!lang && <CheckRounded sx={{ fontSize: 15, ml: "auto" }} />}</MenuItem>
        <Divider />
        {local.length > 0 && <ListSubheader sx={{ fontSize: "0.55rem", fontWeight: 800, lineHeight: "26px" }}>LOCAL · {placeName.toUpperCase()}</ListSubheader>}
        {local.map((l) => <MenuItem key={l} selected={lang === l} onClick={() => start(l)} sx={{ fontSize: "0.72rem" }}>{label(l)}{badge(l)}</MenuItem>)}
        <ListSubheader sx={{ fontSize: "0.55rem", fontWeight: 800, lineHeight: "26px" }}>MORE LANGUAGES</ListSubheader>
        {COMMON.filter((l) => !local.includes(l)).map((l) => <MenuItem key={l} selected={lang === l} onClick={() => start(l)} sx={{ fontSize: "0.72rem" }}>{label(l)}{badge(l)}</MenuItem>)}
      </Menu>
    </>
  );
}
