// Generative AI settings shared by every AI feature in the portal.
// Stored in this browser (localStorage). The API key never leaves the browser except to the provider it is for.
import { useSyncExternalStore } from "react";

const KEY = "peoplehub-ai-settings";

export const AI_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 · most capable" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 · balanced (recommended)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 · fastest" },
];

export const AI_LANGUAGES = ["English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Urdu", "Arabic", "French", "German", "Spanish"];

export const AI_DEFAULTS = {
  // auto: proxy if it answers, else the browser key if one is saved, else the offline demo
  mode: "auto", // auto | proxy | browser | mock
  proxyUrl: (import.meta.env && import.meta.env.VITE_AI_PROXY_URL) || "./api/ai",
  apiKey: "",
  model: "claude-sonnet-5-5", // copilot, insights, reviews
  fastModel: "claude-haiku-5-5", // field assist, autocomplete, selection
  language: "English", // reply language for copilot and translations
  fieldAssist: true, // ✨ button on every text field
  autocomplete: true, // ghost-text suggestions while typing in long fields
  selection: true, // explain / translate any selected words
  copilot: true, // page-aware assistant on every page
  insights: true, // AI summaries on dashboards, approvals, payslips, reports
};

let state = read();
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...AI_DEFAULTS, ...JSON.parse(raw) } : { ...AI_DEFAULTS };
  } catch {
    return { ...AI_DEFAULTS };
  }
}

export function getAiSettings() {
  return state;
}

export function setAiSettings(patch) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage disabled: keep in memory */
  }
  resetProviderCache();
  listeners.forEach((l) => l());
}

export function useAiSettings() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// ── Which provider is live right now ──
let resolved = null; // { provider: "proxy"|"browser"|"mock", label }
let resolving = null;
const statusListeners = new Set();

function resetProviderCache() {
  resolved = null;
  resolving = null;
  statusListeners.forEach((l) => l());
}

async function proxyAlive(url) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch(`${url.replace(/\/$/, "")}/health`, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    const j = await res.json().catch(() => null);
    return !!j?.ok;
  } catch {
    return false;
  }
}

export async function resolveProvider() {
  if (resolved) return resolved;
  if (resolving) return resolving;
  const s = state;
  resolving = (async () => {
    let r;
    if (s.mode === "mock") r = { provider: "mock", label: "Offline demo AI" };
    else if (s.mode === "browser") r = s.apiKey ? { provider: "browser", label: "Live · Claude (browser key)" } : { provider: "mock", label: "Offline demo AI · no API key saved" };
    else if (s.mode === "proxy") r = (await proxyAlive(s.proxyUrl)) ? { provider: "proxy", label: "Live · Claude via secure proxy" } : { provider: "mock", label: "Offline demo AI · proxy not reachable" };
    else if (await proxyAlive(s.proxyUrl)) r = { provider: "proxy", label: "Live · Claude via secure proxy" };
    else if (s.apiKey) r = { provider: "browser", label: "Live · Claude (browser key)" };
    else r = { provider: "mock", label: "Offline demo AI" };
    resolved = r;
    resolving = null;
    statusListeners.forEach((l) => l());
    return r;
  })();
  return resolving;
}

export function useAiStatus() {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      if (!resolved && !resolving) resolveProvider();
      return () => statusListeners.delete(l);
    },
    () => resolved,
  );
}

export function retestProvider() {
  resetProviderCache();
  return resolveProvider();
}
