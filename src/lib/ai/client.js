import { serverOn, getToken } from "../server/api.js";
// One entry point for every generative AI call in the portal.
// Routes to the secure proxy, a browser-held API key, or the offline demo generator, and streams text back.
import { getAiSettings, resolveProvider } from "./config.js";
import { mockGenerate } from "./mock.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Reads an Anthropic Messages SSE stream and calls onText for every text delta.
async function readSse(res, onText) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let ev;
      try {
        ev = JSON.parse(payload);
      } catch {
        continue;
      }
      if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
        full += ev.delta.text;
        onText?.(ev.delta.text, full);
      } else if (ev.type === "error") {
        throw new Error(ev.error?.message || "The AI service returned an error.");
      }
    }
  }
  return full;
}

async function errorText(res) {
  try {
    const j = await res.json();
    return j?.error?.message || j?.error || `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

/**
 * Generate text.
 * @param {object} o
 * @param {string} o.task       short task id (used by the offline generator and for logging)
 * @param {string} o.system     system prompt
 * @param {Array}  o.messages   [{role, content}]
 * @param {boolean} o.fast      use the fast model
 * @param {number} o.maxTokens
 * @param {object} o.hint       structured data the offline generator can use
 * @param {(delta:string, full:string)=>void} o.onText streaming callback
 * @param {AbortSignal} o.signal
 * @returns {Promise<string>}
 */
export async function aiGenerate({ task = "chat", system = "", messages, fast = false, maxTokens = 1024, hint, onText, signal, temperature }) {
  const s = getAiSettings();
  const { provider } = await resolveProvider();
  const model = fast ? s.fastModel : s.model;
  const body = { model, max_tokens: maxTokens, system, messages, stream: true };
  if (typeof temperature === "number") body.temperature = temperature;

  if (provider === "mock") return mockGenerate({ task, system, messages, hint, onText, signal });

  let res;
  if (provider === "proxy") {
    // v10.8: on the EZY HR server the AI endpoint needs the signed-in session
    const tok = serverOn() ? getToken() : "";
    res = await fetch(`${s.proxyUrl.replace(/\/$/, "")}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
      body: JSON.stringify(body),
      signal,
    });
  } else {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": s.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
      signal,
    });
  }
  if (!res.ok) throw new Error(await errorText(res));
  return readSse(res, onText);
}

// Small cache so dashboards do not regenerate the same insight on every visit in a session.
export function cacheKey(...parts) {
  const str = JSON.stringify(parts);
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return `peoplehub-ai-cache-${h >>> 0}`;
}
export function cacheGet(k) {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}
export function cacheSet(k, v) {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}
