// v10.8 · Sends the app's changes to the server as small, record-level patches.
// The store keeps working exactly as before (every action edits `data`); after each change this engine compares the
// new data with what the server last confirmed and sends only the differences:
//   lists    → { c, upsert: [records], delete: [keys], created: [keys], front: [keys] }
//   settings → { name, ops: [{ path, op: set | unset | upsert | remove }] }  (merged on the server under a row lock)
import { apiPost } from "./api.js";

// Keys must match server/api/collections.mjs
export const KEY_BY = {
  employees: "employee_code", admins: "admin_code", superAdmins: "superadmin_code", companies: "company_id", workLocations: "location_id",
  orgUnits: "org_unit_id", requests: "request_id", audit: "log_id", punches: "id", notifications: "id", payslipBatches: "id",
};
const ID_FIELDS = ["id", "request_id", "log_id", "code", "key", "ticket_id", "batch_id"];
// 53-bit string hash (cyrb53) — the same function runs on the server
export function hash53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
export function keyOf(rec) {
  if (rec && typeof rec === "object") for (const f of ID_FIELDS) if (rec[f] !== undefined && rec[f] !== null && rec[f] !== "") return `${f}:${rec[f]}`;
  return `h:${hash53(JSON.stringify(rec))}`;
}
const keyFor = (col) => (KEY_BY[col] ? (r) => String(r?.[KEY_BY[col]]) : keyOf);
const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v);
const isRecList = (v) => Array.isArray(v) && v.every(isPlain);
const LOCAL_ONLY = new Set(["__server", "demo_clock", "version"]);
// Slips belong to payslips on the server; the app sends batch headers plus the slips it changed.
const strip = (col, r) => r;

export function snapshot(data) {
  const lists = new Map(), docs = new Map(), whole = new Map();
  for (const [k, v] of Object.entries(data || {})) {
    if (LOCAL_ONLY.has(k)) continue;
    const s = JSON.stringify(v);
    whole.set(k, s);
    if (KEY_BY[k] || isRecList(v)) {
      const kf = keyFor(k);
      lists.set(k, new Map((v || []).map((r) => [kf(r), JSON.stringify(r)])));
    } else docs.set(k, s);
  }
  return { lists, docs, whole };
}

function itemOps(path, a, b, ops) {
  const ma = new Map(a.map((x) => [keyOf(x), JSON.stringify(x)]));
  const items = [];
  b.forEach((x, i) => { const k = keyOf(x); const s = JSON.stringify(x); if (ma.get(k) !== s) items.push({ item: x, front: !ma.has(k) && i < b.length / 2 }); });
  const kb = new Set(b.map(keyOf));
  const keys = [...ma.keys()].filter((k) => !kb.has(k));
  if (items.length) ops.push({ path, op: "upsert", items });
  if (keys.length) ops.push({ path, op: "remove", keys });
}
function docOps(oldV, newV) {
  if (!isPlain(oldV) || !isPlain(newV)) return [{ path: [], op: "set", value: newV ?? null }];
  const ops = [];
  for (const k of new Set([...Object.keys(oldV), ...Object.keys(newV)])) {
    const a = oldV[k], b = newV[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (b === undefined) ops.push({ path: [k], op: "unset" });
    else if (isRecList(a) && isRecList(b)) itemOps([k], a, b, ops);
    else if (isPlain(a) && isPlain(b)) {
      for (const k2 of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const a2 = a[k2], b2 = b[k2];
        if (JSON.stringify(a2) === JSON.stringify(b2)) continue;
        if (b2 === undefined) ops.push({ path: [k, k2], op: "unset" });
        else if (isRecList(a2) && isRecList(b2)) itemOps([k, k2], a2, b2, ops);
        else ops.push({ path: [k, k2], op: "set", value: b2 });
      }
    } else ops.push({ path: [k], op: "set", value: b });
  }
  return ops;
}

export function diff(base, data) {
  const changes = [], docs = [];
  for (const [k, v] of Object.entries(data || {})) {
    if (LOCAL_ONLY.has(k)) continue;
    const s = JSON.stringify(v);
    if (base.whole.get(k) === s) continue;
    if (KEY_BY[k] || isRecList(v) || base.lists.has(k)) {
      const old = base.lists.get(k) || new Map();
      const kf = keyFor(k);
      const upsert = [], seen = new Set(), created = [], front = [];
      (v || []).forEach((r, i) => {
        const key = kf(r);
        seen.add(key);
        const js = JSON.stringify(r);
        if (old.get(key) !== js) { upsert.push(strip(k, r)); if (!old.has(key)) { created.push(key); if (i < (v.length / 2)) front.push(key); } }
      });
      const del = [...old.keys()].filter((key) => !seen.has(key));
      if (upsert.length || del.length) changes.push({ c: k, upsert, delete: del, created, front });
    } else {
      const ops = docOps(base.docs.has(k) ? JSON.parse(base.docs.get(k)) : undefined, v);
      if (ops.length) docs.push({ name: k, ops });
    }
  }
  return { changes, docs };
}

// One engine per signed-in session.
export function createSyncEngine({ onRejected, onRenamed, onError, onSaved, delay = 600 }) {
  let base = null, timer = null, busy = false, pendingData = null, failures = 0;
  const engine = {
    reset(data) { base = snapshot(data); pendingData = null; },
    // after merging changes that came from the server, mark those collections as already saved
    accept(data, cols) {
      if (!base) return;
      const s = snapshot(Object.fromEntries(cols.filter((c) => c in data).map((c) => [c, data[c]])));
      for (const c of cols) { if (s.whole.has(c)) base.whole.set(c, s.whole.get(c)); if (s.lists.has(c)) base.lists.set(c, s.lists.get(c)); if (s.docs.has(c)) base.docs.set(c, s.docs.get(c)); }
    },
    schedule(data) {
      if (!base) return;
      pendingData = data;
      clearTimeout(timer);
      timer = setTimeout(engine.flush, delay);
    },
    async flush() {
      if (busy || !pendingData || !base) return;
      const data = pendingData;
      const d = diff(base, data);
      if (!d.changes.length && !d.docs.length) { pendingData = null; return; }
      busy = true;
      try {
        // big edits (bulk uploads) go in slices so one request stays small
        const slices = [];
        let cur = { changes: [], docs: d.docs };
        let n = 0;
        for (const ch of d.changes) {
          for (let i = 0; i < Math.max(ch.upsert.length, 1); i += 2000) {
            const part = { ...ch, upsert: ch.upsert.slice(i, i + 2000), delete: i === 0 ? ch.delete : [], created: ch.created.filter((k) => ch.upsert.slice(i, i + 2000).some((r) => keyFor(ch.c)(r) === k)) };
            if (n + part.upsert.length > 3000 && cur.changes.length) { slices.push(cur); cur = { changes: [], docs: [] }; n = 0; }
            cur.changes.push(part); n += part.upsert.length;
          }
        }
        slices.push(cur);
        const rejected = [], renamed = [];
        for (const s of slices) { const r = await apiPost("/sync", s); rejected.push(...(r.rejected || [])); renamed.push(...(r.renamed || [])); }
        base = snapshot(data);
        if (pendingData === data) pendingData = null;
        failures = 0;
        onSaved?.();
        if (rejected.length) onRejected?.(rejected);
        // the server gave some new records a different code (already taken) — the app follows
        if (renamed.length) onRenamed?.(renamed);
      } catch (e) {
        failures++;
        onError?.(e, failures);
        if (e.status !== 401) setTimeout(engine.flush, Math.min(30000, 1000 * 2 ** failures));
      } finally {
        busy = false;
        if (pendingData && pendingData !== data) engine.schedule(pendingData);
      }
    },
    pending: () => !!pendingData,
    stop() { clearTimeout(timer); base = null; pendingData = null; },
  };
  return engine;
}
