// v10.8 · Server mode. The same build runs two ways:
//   • served by the EZY HR server (or pointed at one) → data lives in PostgreSQL, sign-in is checked by the server;
//   • opened from any static host with no server     → the original browser-only demo, unchanged.
// Nothing is decided at build time: the app asks `<server>/api/v1/config` when it starts.
const LS_URL = "ezyo-server-url";
const LS_TOKEN = "ezyo-server-token";
const LS_TENANT = "ezyo-server-tenant";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const state = { on: false, base: "", config: null, tenant: "" };

const read = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const write = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* storage off */ } };

export const serverOn = () => state.on;
export const serverBase = () => state.base;
export const serverConfig = () => state.config;
export const getTenant = () => state.tenant || read(LS_TENANT) || state.config?.default_tenant || "demo";
export const setTenant = (t) => { state.tenant = String(t || "").trim().toLowerCase(); write(LS_TENANT, state.tenant); };
export const getToken = () => read(LS_TOKEN);
export const setToken = (t) => write(LS_TOKEN, t);
export const isDemoTenant = () => (state.config?.demo_tenants || []).includes(getTenant());

// Where to look for the server: a saved address (mobile apps / another host), VITE_API_URL if the build set one,
// otherwise the address the app was loaded from.
function candidates() {
  const saved = read(LS_URL);
  const out = [];
  if (saved) out.push(saved);
  if (env.VITE_API_URL) out.push(env.VITE_API_URL);
  if (typeof location !== "undefined" && /^https?:/.test(location.protocol)) out.push(location.origin);
  return [...new Set(out.map((u) => u.replace(/\/+$/, "")))];
}

export async function detectServer() {
  if (read("ezyo-force-browser") === "1") return state;
  for (const base of candidates()) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 2500);
      const r = await fetch(`${base}/api/v1/config`, { signal: ctl.signal, headers: { accept: "application/json" } });
      clearTimeout(timer);
      if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) continue;
      const c = await r.json();
      if (c?.server === "ezy-hr") { Object.assign(state, { on: true, base, config: c }); return state; }
    } catch { /* not there */ }
  }
  return state;
}
// Saving or clearing a server address takes effect after a reload.
export function saveServerUrl(url) { write(LS_URL, String(url || "").trim()); write("ezyo-force-browser", ""); }
export function useBrowserOnly(on) { write("ezyo-force-browser", on ? "1" : ""); }
export const savedServerUrl = () => read(LS_URL);

export class ApiError extends Error {
  constructor(status, body) { super(body?.error || `Server error ${status}`); this.status = status; this.body = body; }
}
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = "GET", body, raw = false, headers = {}, auth = true } = {}) {
  const h = { accept: "application/json", ...headers };
  if (body !== undefined && !(typeof body === "string")) h["content-type"] = "application/json";
  const tok = getToken();
  if (auth && tok) h.authorization = `Bearer ${tok}`;
  const r = await fetch(`${state.base}/api/v1${path}`, { method, headers: h, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
  if (raw) { if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => ({}))); return r; }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && auth && tok && !path.startsWith("/auth/")) { onUnauthorized?.(); }
  if (!r.ok) throw new ApiError(r.status, data);
  return data;
}
export const apiGet = (p) => api(p);
export const apiPost = (p, body) => api(p, { method: "POST", body });

// Downloads a server file (CSV export, bank advice) with the session token.
export async function apiDownload(path, filename) {
  const r = await api(path, { raw: true, headers: { accept: "text/csv" } });
  const blob = await r.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
