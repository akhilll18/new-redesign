// /api/ai on the EZY HR server: the same Claude proxy as server/ai-proxy.mjs, but only for signed-in users and
// rate-limited per user (not per IP). The API key stays on the server.
const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODELS = (process.env.AI_MODELS || "claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5").split(",").map((s) => s.trim()).filter(Boolean);
const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || 2000);
const RATE = Number(process.env.AI_RATE_PER_MIN || 40);
const UPSTREAM = process.env.AI_UPSTREAM_URL || "https://api.anthropic.com/v1/messages";
const hits = new Map();
const limited = (k) => { const now = Date.now(); const a = (hits.get(k) || []).filter((t) => now - t < 60000); a.push(now); hits.set(k, a); if (hits.size > 100000) hits.clear(); return a.length > RATE; };

export function registerAi(app, guard) {
  app.get("/api/ai/health", async (req, reply) => reply.code(KEY ? 200 : 503).send({ ok: !!KEY, models: MODELS }));
  app.post("/api/ai/messages", { preHandler: guard }, async (req, reply) => {
    if (!KEY) return reply.code(503).send({ error: { message: "AI is not configured on this server (set ANTHROPIC_API_KEY)." } });
    if (limited(`${req.auth.t}:${req.auth.code}`)) return reply.code(429).send({ error: { message: "Too many AI requests — please wait a minute." } });
    const body = req.body || {};
    if (!Array.isArray(body.messages) || !body.messages.length) return reply.code(400).send({ error: { message: "messages are required" } });
    const payload = {
      model: MODELS.includes(body.model) ? body.model : MODELS[1] || MODELS[0],
      max_tokens: Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS),
      system: typeof body.system === "string" ? body.system.slice(0, 60000) : undefined,
      messages: body.messages.slice(-20).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "").slice(0, 20000) })),
      stream: true,
    };
    if (typeof body.temperature === "number") payload.temperature = Math.max(0, Math.min(1, body.temperature));
    const ctl = new AbortController();
    req.raw.on("close", () => ctl.abort());
    let up;
    try {
      up = await fetch(UPSTREAM, { method: "POST", headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify(payload), signal: ctl.signal });
    } catch (e) { return reply.code(502).send({ error: { message: `AI service unreachable: ${e.message}` } }); }
    if (!up.ok) { const t = await up.text(); let msg = t; try { msg = JSON.parse(t).error?.message || t; } catch { /* text */ } return reply.code(up.status).send({ error: { message: msg } }); }
    reply.hijack();
    reply.raw.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    try { for await (const chunk of up.body) reply.raw.write(chunk); } catch { /* client went away */ }
    reply.raw.end();
  });
}
