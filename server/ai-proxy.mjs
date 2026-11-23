// PeopleHub AI proxy — keeps the Claude API key on the server so browsers never see it.
// Zero dependencies (Node 18+). Also serves the built app from ./dist when it exists, so one process runs everything.
//
//   ANTHROPIC_API_KEY=sk-ant-...  node server/ai-proxy.mjs
//
// Env:
//   ANTHROPIC_API_KEY   required
//   PORT                default 8787
//   AI_ALLOWED_ORIGINS  comma-separated origins allowed to call the proxy (default: same origin + localhost:5173)
//   AI_MODELS           comma-separated model allow-list (default: claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5)
//   AI_MAX_TOKENS       hard cap per request (default 2000)
//   AI_RATE_PER_MIN     requests per minute per IP (default 40)
//   AI_UPSTREAM_URL     Messages API URL (default https://api.anthropic.com/v1/messages)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load ../.env if present (simple KEY=value lines; real environment variables win).
try {
  const envFile = path.resolve(__dirname, "..", ".env");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* ignore */
}

const DIST = path.resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 8787);
const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODELS = (process.env.AI_MODELS || "claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5").split(",").map((s) => s.trim()).filter(Boolean);
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || 2000);
const RATE = Number(process.env.AI_RATE_PER_MIN || 40);
const ORIGINS = (process.env.AI_ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173").split(",").map((s) => s.trim()).filter(Boolean);
const MAX_BODY = 400 * 1024;
const UPSTREAM = process.env.AI_UPSTREAM_URL || "https://api.anthropic.com/v1/messages"; // override for a corporate gateway

if (!KEY) console.warn("[ai-proxy] ANTHROPIC_API_KEY is not set — /api/ai/health will report not ready and the app will use its offline demo AI.");

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE;
}

function cors(req, res) {
  const o = req.headers.origin;
  if (o && ORIGINS.includes(o)) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  return !o || ORIGINS.includes(o) || o === `http://${req.headers.host}` || o === `https://${req.headers.host}`;
}

function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("Request too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleMessages(req, res) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress;
  if (limited(ip)) return json(res, 429, { error: { message: "Too many AI requests — please wait a minute." } });
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (e) {
    return json(res, 400, { error: { message: e.message || "Invalid JSON" } });
  }
  const model = MODELS.includes(body.model) ? body.model : MODELS[1] || MODELS[0];
  if (!Array.isArray(body.messages) || !body.messages.length) return json(res, 400, { error: { message: "messages are required" } });
  const payload = {
    model,
    max_tokens: Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS),
    system: typeof body.system === "string" ? body.system.slice(0, 60000) : undefined,
    messages: body.messages.slice(-20).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "").slice(0, 20000) })),
    stream: true,
  };
  if (typeof body.temperature === "number") payload.temperature = Math.max(0, Math.min(1, body.temperature));

  const ctl = new AbortController();
  req.on("close", () => ctl.abort());
  let upstream;
  try {
    upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
  } catch (e) {
    return json(res, 502, { error: { message: `AI service unreachable: ${e.message}` } });
  }
  if (!upstream.ok) {
    const t = await upstream.text();
    let msg = t;
    try {
      msg = JSON.parse(t).error?.message || t;
    } catch {
      /* keep text */
    }
    return json(res, upstream.status, { error: { message: msg } });
  }
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  try {
    for await (const chunk of upstream.body) res.write(chunk);
  } catch {
    /* client went away */
  }
  res.end();
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2" };
function serveStatic(req, res) {
  if (!fs.existsSync(DIST)) return json(res, 404, { error: "Not found. Run `npm run build` to serve the app from here." });
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = path.normalize(path.join(DIST, url));
  if (!file.startsWith(DIST)) return json(res, 403, { error: "Forbidden" });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer(async (req, res) => {
    const url = (req.url || "").split("?")[0];
    if (url.startsWith("/api/ai")) {
      const ok = cors(req, res);
      if (req.method === "OPTIONS") return res.writeHead(ok ? 204 : 403).end();
      if (!ok) return json(res, 403, { error: { message: "Origin not allowed" } });
      if (url === "/api/ai/health") return json(res, KEY ? 200 : 503, { ok: !!KEY, models: MODELS });
      if (url === "/api/ai/messages" && req.method === "POST") {
        if (!KEY) return json(res, 503, { error: { message: "AI proxy has no API key configured" } });
        return handleMessages(req, res);
      }
      return json(res, 404, { error: { message: "Unknown AI endpoint" } });
    }
    return serveStatic(req, res);
  })
  .listen(PORT, () => console.log(`[ai-proxy] listening on http://localhost:${PORT}  (AI ${KEY ? "ready" : "NOT configured"})`));
