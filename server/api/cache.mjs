// Small in-process TTL cache (per API instance). Dashboards hit it instead of PostgreSQL.
// Concurrent misses for the same key share one database query ("single flight").
const store = new Map();
const inflight = new Map();
const MAX = 5000;
export async function cached(tenant, key, ttlSec, fn) {
  const hit = store.get(key);
  if (hit && hit.until > Date.now()) return hit.v;
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const v = await fn();
      if (store.size > MAX) store.delete(store.keys().next().value);
      store.set(key, { v, until: Date.now() + ttlSec * 1000, tenant });
      return v;
    } finally { inflight.delete(key); }
  })();
  inflight.set(key, p);
  return p;
}
export function invalidate(tenant) { for (const [k, v] of store) if (v.tenant === tenant) store.delete(k); }
