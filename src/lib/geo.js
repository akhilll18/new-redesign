// Geofencing and live-location helpers. All distances in metres.
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Nearest active geofence (optionally limited to the ids the employee may use).
export function nearestGeofence(pos, geofences, allowedIds) {
  let best = null;
  geofences
    .filter((g) => g.active && (!allowedIds?.length || allowedIds.includes(g.id)))
    .forEach((g) => {
      const d = haversine(pos, g);
      if (!best || d - g.radius_m < best.distance - best.fence.radius_m) best = { fence: g, distance: d };
    });
  if (!best) return { fence: null, distance: null, inside: false };
  return { ...best, inside: best.distance <= best.fence.radius_m + (pos.accuracy ? Math.min(pos.accuracy, 50) : 0) };
}

// Geofences an employee may punch at: their primary fence, plus client/site fences for field staff.
export function fencesFor(emp, geofences) {
  if (!emp) return [];
  const own = geofences.filter((g) => g.id === emp.primary_geofence);
  if (emp.field_staff === "yes") return [...own, ...geofences.filter((g) => g.type !== "office" && g.id !== emp.primary_geofence)];
  return own.length ? own : geofences.filter((g) => g.type === "office");
}

export function fmtDistance(m) {
  if (m == null) return "—";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

// Deterministic pseudo-random generator so demo positions are stable within a time window.
export function rng(seed) {
  let s = 0;
  for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Offset a point by metres east/north.
export function offset(p, east, north) {
  return { lat: p.lat + north / 111320, lng: p.lng + east / (111320 * Math.cos(rad(p.lat))) };
}

// Browser location with a timeout. Resolves { lat, lng, accuracy, simulated }.
export function getPosition({ timeout = 8000, fallback } = {}) {
  return new Promise((resolve) => {
    const done = (p) => resolve(p);
    if (!navigator.geolocation) return done(fallback ? { ...fallback, simulated: true, reason: "This browser has no location service." } : null);
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      done(fallback ? { ...fallback, simulated: true, reason: "Location timed out." } : null);
    }, timeout);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        done({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy), simulated: false });
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        done(fallback ? { ...fallback, simulated: true, reason: err.code === 1 ? "Location permission was denied." : "Location is unavailable." } : null);
      },
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    );
  });
}

export function mapsLink(p) {
  return `https://www.google.com/maps?q=${p.lat},${p.lng}`;
}
