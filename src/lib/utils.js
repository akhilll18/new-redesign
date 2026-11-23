// Shared helpers: dates, numbers, ids, hashing, CSV export, device fingerprint.

export const DAY = 86400000;

export function nowIso() {
  return new Date().toISOString();
}

export function daysAgo(n, hour = 11) {
  const d = new Date(Date.now() - n * DAY);
  d.setHours(hour, (n * 7) % 60, 0, 0);
  return d.toISOString();
}

export function isoDate(d = new Date()) {
  const x = new Date(d);
  const off = x.getTimezoneOffset();
  return new Date(x.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function fmtDate(v) {
  if (!v) return "—";
  return new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(v) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(v) {
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function fmtNum(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

export function fmtBytes(b) {
  if (!b) return "0 KB";
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export function maskAccount(acc = "") {
  const s = String(acc).replace(/\s/g, "");
  if (s.length <= 4) return s;
  return `•••• ${s.slice(-4)}`;
}

export function uid(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export function nextSeq(list, prefix, key, pad = 4) {
  const max = list.reduce((m, item) => {
    // Trailing digits, so both "AUD-0005" and "EMP050" sequence correctly (v8.6 gave every new employee EMP001).
    const n = Number((String(item[key] ?? "").match(/(\d+)$/) || [])[1]) || 0;
    return Math.max(m, n);
  }, 0);
  return `${prefix}${String(max + 1).padStart(pad, "0")}`;
}

// SHA-256 stand-in for the server's bcrypt. Passwords never leave the browser in this demo.
export async function sha256(text) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback for contexts without SubtleCrypto (non-secure origins).
    let h1 = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      h1 ^= text.charCodeAt(i);
      h1 = Math.imul(h1, 16777619);
    }
    return `fnv-${(h1 >>> 0).toString(16)}`;
  }
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// Device fingerprint sent with every login for the audit log.
export function deviceFingerprint() {
  const parts = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency || 0,
  ].join("|");
  return `fp_${hashString(parts)}`;
}

export function deviceLabel() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`;
}

// The browser cannot see its public IP; the server records the real one.
// The demo derives a stable private-range address from the fingerprint.
export function demoIp(fp = deviceFingerprint()) {
  const h = parseInt(fp.slice(-6), 16) || 1;
  return `10.${(h >> 16) & 255}.${(h >> 8) & 255}.${h & 255}`;
}

export function makeCaptcha() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function makeOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// v10.14: every CSV export names its legal entity. The store keeps this context current:
// { companyOf(employeeCode) → entity short name, scoped → the header's entity (null for all) }.
let exportCtx = null;
export function setExportContext(ctx) { exportCtx = ctx; }
const EMP_CODE = /^(EMP|CW|VN)[-\d]/i;
/** Adds a "Legal entity" column (from the row's employee code, or the header's entity) and the entity to the file name. */
export function withLegalEntity(filename, header, rows) {
  if (!exportCtx || !Array.isArray(header) || header.some((h) => /legal entity/i.test(String(h)))) return [filename, header, rows];
  let idx = header.findIndex((h) => /^(employee|emp\.?)\s*(code|id|no\.?)$|^code$/i.test(String(h).trim()));
  if (idx < 0) {
    const counts = header.map((_, i) => rows.filter((r) => EMP_CODE.test(String(r?.[i] ?? ""))).length);
    const best = counts.indexOf(Math.max(0, ...counts));
    if (best >= 0 && counts[best] > 0 && counts[best] >= rows.length / 2) idx = best;
  }
  let h = header, rs = rows;
  if (idx >= 0) { h = [...header, "Legal entity"]; rs = rows.map((r) => [...r, exportCtx.companyOf(String(r?.[idx] ?? "")) || exportCtx.scoped || ""]); }
  else if (exportCtx.scoped) { h = [...header, "Legal entity"]; rs = rows.map((r) => [...r, exportCtx.scoped]); }
  let fn = filename;
  if (exportCtx.scoped) {
    const slug = exportCtx.scoped.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (slug && !fn.toLowerCase().includes(slug)) fn = fn.replace(/(\.[a-z0-9]+)?$/i, (ext) => `-${slug}${ext || ""}`);
  }
  return [fn, h, rs];
}

export function downloadCsv(filename0, header0, rows0) {
  const [filename, header, rows] = withLegalEntity(filename0, header0, rows0 || []);
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  return saveFile(filename, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

// Saves a generated file. Inside the claude.ai artifact viewer this goes through its downloads capability
// (the viewer confirms); everywhere else it is an ordinary browser download.
export async function saveFile(filename, data, mime = "application/octet-stream") {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  if (typeof window !== "undefined" && window.claude?.use) {
    try {
      const dl = await Promise.race([window.claude.use("downloads"), new Promise((r) => setTimeout(() => r(null), 4000))]);
      if (dl) {
        await dl.save({ filename, data: blob });
        return { ok: true };
      }
    } catch (e) {
      if (e?.code === "declined") return { ok: false, declined: true };
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { ok: true };
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// Placeholder evidence for seeded claims (a small SVG "document").
export function sampleDocDataUrl(title, sub) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420"><rect width="600" height="420" fill="#f7faf9"/><rect x="24" y="24" width="552" height="372" rx="10" fill="#fff" stroke="#d5dfdb"/><text x="48" y="80" font-family="sans-serif" font-size="22" font-weight="700" fill="#0e6b58">Supporting document</text><text x="48" y="120" font-family="sans-serif" font-size="16" fill="#14201d">${title.replace(/&/g, "and")}</text><text x="48" y="150" font-family="sans-serif" font-size="13" fill="#56655f">${sub.replace(/&/g, "and")}</text><rect x="48" y="180" width="480" height="10" rx="5" fill="#e9efed"/><rect x="48" y="204" width="420" height="10" rx="5" fill="#e9efed"/><rect x="48" y="228" width="450" height="10" rx="5" fill="#e9efed"/><text x="48" y="360" font-family="monospace" font-size="11" fill="#97a8a2">Sample evidence generated for the demo</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function monthKey(v) {
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short" });
}

export function lastMonths(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
