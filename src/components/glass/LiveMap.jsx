// Live map drawn in SVG (no map tiles needed): geofences, people, trails, scale bar, zoom and pan.
// Positions use a local equirectangular projection around the region's centre, accurate within a city.
import React, { useMemo, useRef, useState } from "react";
import { Box, ButtonBase, Stack, Tooltip, Typography } from "@mui/material";
import { AddRounded, RemoveRounded, CenterFocusStrongRounded } from "@mui/icons-material";
import { fmtDistance } from "../../lib/geo.js";

const STATUS = {
  inside: { fill: "#25A582", label: "Inside geofence" },
  outside: { fill: "#C77B1C", label: "Outside geofence" },
  stale: { fill: "#8A9A93", label: "No update for 15+ min" },
  self: { fill: "#2A7DC9", label: "You" },
};

export default function LiveMap({ fences = [], people = [], height = 360, dark = false, selected, onSelect, onMapClick, focusFence, showLegend = true, editing }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const ink = dark ? "#F2F7F4" : "#26322a";
  const muted = dark ? "rgba(242,247,244,0.6)" : "#78827b";
  const grid = dark ? "rgba(255,255,255,0.07)" : "#e7ece6";

  // Fit bounds around fences and people (metres in a local frame).
  const frame = useMemo(() => {
    const pts = [...fences.map((f) => ({ lat: f.lat, lng: f.lng, r: f.radius_m })), ...people.filter((p) => p.lat != null).map((p) => ({ lat: p.lat, lng: p.lng, r: 60 }))];
    const focus = focusFence ? fences.find((f) => f.id === focusFence) : null;
    const base = focus ? [{ lat: focus.lat, lng: focus.lng, r: Math.max(focus.radius_m * 4, 600) }] : pts;
    if (!base.length) return null;
    const lat0 = base.reduce((s, p) => s + p.lat, 0) / base.length;
    const lng0 = base.reduce((s, p) => s + p.lng, 0) / base.length;
    const k = Math.cos((lat0 * Math.PI) / 180) * 111320;
    const toXY = (p) => ({ x: (p.lng - lng0) * k, y: -(p.lat - lat0) * 111320 });
    const xs = base.flatMap((p) => [toXY(p).x - p.r, toXY(p).x + p.r]);
    const ys = base.flatMap((p) => [toXY(p).y - p.r, toXY(p).y + p.r]);
    const w = Math.max(400, Math.max(...xs) - Math.min(...xs));
    const h = Math.max(300, Math.max(...ys) - Math.min(...ys));
    return { lat0, lng0, k, toXY, cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2, span: Math.max(w, h * 1.6) * 1.25 };
  }, [fences, people, focusFence]);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  if (!frame) return <Box sx={{ height, display: "grid", placeItems: "center", color: muted, fontSize: "0.7rem" }}>Nothing to show on the map yet.</Box>;

  const span = frame.span / zoom;
  const vbW = span;
  const vbH = span / 1.6;
  const vx = frame.cx - vbW / 2 + pan.x;
  const vy = frame.cy - vbH / 2 + pan.y;
  const unit = vbW / 800; // svg units per screen px (approx, 800px wide)
  const step = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000].find((s) => s > vbW / 8) || 100000;

  const toLatLng = (clientX, clientY) => {
    const rect = ref.current.getBoundingClientRect();
    const x = vx + ((clientX - rect.left) / rect.width) * vbW;
    const y = vy + ((clientY - rect.top) / rect.height) * vbH;
    return { lat: frame.lat0 - y / 111320, lng: frame.lng0 + x / frame.k };
  };

  const gridLines = [];
  for (let gx = Math.floor(vx / step) * step; gx < vx + vbW; gx += step) gridLines.push(<line key={`x${gx}`} x1={gx} x2={gx} y1={vy} y2={vy + vbH} stroke={grid} strokeWidth={unit} />);
  for (let gy = Math.floor(vy / step) * step; gy < vy + vbH; gy += step) gridLines.push(<line key={`y${gy}`} y1={gy} y2={gy} x1={vx} x2={vx + vbW} stroke={grid} strokeWidth={unit} />);

  const sel = people.find((p) => p.code === selected);

  return (
    <Box sx={{ position: "relative", height, borderRadius: "14px", overflow: "hidden", background: dark ? "rgba(6,22,17,0.45)" : "#f6f9f5", border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e5eae5", touchAction: "none" }}>
      <svg
        ref={ref}
        viewBox={`${vx} ${vy} ${vbW} ${vbH}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={`Map with ${fences.length} geofences and ${people.length} people`}
        style={{ cursor: editing ? "crosshair" : drag.current ? "grabbing" : "grab", display: "block" }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, pan, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const rect = ref.current.getBoundingClientRect();
          const dx = ((e.clientX - drag.current.x) / rect.width) * vbW;
          const dy = ((e.clientY - drag.current.y) / rect.height) * vbH;
          if (Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y) > 4) drag.current.moved = true;
          setPan({ x: drag.current.pan.x - dx, y: drag.current.pan.y - dy });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved && onMapClick) onMapClick(toLatLng(e.clientX, e.clientY));
        }}
        onWheel={(e) => setZoom((z) => Math.min(40, Math.max(0.3, z * (e.deltaY < 0 ? 1.15 : 0.87))))}
      >
        {gridLines}
        {fences.map((f) => {
          const c = frame.toXY(f);
          const col = f.type === "office" ? "#2E8C7A" : f.type === "client" ? "#2A7DC9" : "#C77B1C";
          return (
            <g key={f.id} opacity={f.active === false ? 0.35 : 1}>
              <circle cx={c.x} cy={c.y} r={f.radius_m} fill={col} fillOpacity={dark ? 0.18 : 0.12} stroke={col} strokeWidth={unit * 2} strokeDasharray={f.type === "office" ? "none" : `${unit * 6} ${unit * 4}`} />
              <circle cx={c.x} cy={c.y} r={unit * 3} fill={col} />
              <text x={c.x} y={c.y - f.radius_m - unit * 6} textAnchor="middle" fontSize={unit * 11} fontWeight="700" fill={ink} style={{ paintOrder: "stroke", stroke: dark ? "rgba(6,22,17,0.8)" : "#fff", strokeWidth: unit * 3 }}>
                {f.name}
              </text>
            </g>
          );
        })}
        {sel?.trail?.length > 1 && <polyline points={sel.trail.map((t) => { const p = frame.toXY(t); return `${p.x},${p.y}`; }).join(" ")} fill="none" stroke={dark ? "#F2B35B" : "#C77B1C"} strokeWidth={unit * 2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${unit * 5} ${unit * 4}`} />}
        {people.filter((p) => p.lat != null).map((p) => {
          const c = frame.toXY(p);
          const st = STATUS[p.status] || STATUS.inside;
          const r = unit * (p.code === selected ? 11 : 9);
          return (
            <g key={p.code} onPointerUp={(e) => { if (onSelect) { e.stopPropagation(); onSelect(p.code); } }} style={{ cursor: onSelect ? "pointer" : "default" }}>
              <title>{`${p.name} · ${st.label}${p.sub ? ` · ${p.sub}` : ""}`}</title>
              {p.accuracy ? <circle cx={c.x} cy={c.y} r={Math.min(p.accuracy, 200)} fill={st.fill} fillOpacity="0.12" /> : null}
              <circle cx={c.x} cy={c.y} r={r + unit * 2} fill={dark ? "#0F2E25" : "#fff"} />
              <circle cx={c.x} cy={c.y} r={r} fill={st.fill} />
              <text x={c.x} y={c.y + unit * 3.5} textAnchor="middle" fontSize={unit * 9} fontWeight="800" fill="#fff">
                {p.initials}
              </text>
            </g>
          );
        })}
      </svg>

      <Stack sx={{ position: "absolute", right: 10, top: 10, gap: 0.6 }}>
        {[
          [<AddRounded key="a" />, "Zoom in", () => setZoom((z) => Math.min(40, z * 1.5))],
          [<RemoveRounded key="r" />, "Zoom out", () => setZoom((z) => Math.max(0.3, z / 1.5))],
          [<CenterFocusStrongRounded key="c" />, "Fit all", () => { setZoom(1); setPan({ x: 0, y: 0 }); }],
        ].map(([icon, label, fn]) => (
          <Tooltip key={label} title={label} placement="left">
            <ButtonBase aria-label={label} onClick={fn} sx={{ width: 30, height: 30, borderRadius: "8px", background: dark ? "rgba(255,255,255,0.12)" : "#fff", color: ink, border: dark ? "1px solid rgba(255,255,255,0.18)" : "1px solid #e6ece5", "& svg": { fontSize: 18 } }}>
              {icon}
            </ButtonBase>
          </Tooltip>
        ))}
      </Stack>

      <Box sx={{ position: "absolute", left: 10, bottom: 10, display: "flex", alignItems: "center", gap: 0.8, px: 0.8, py: 0.4, borderRadius: "6px", background: dark ? "rgba(6,22,17,0.55)" : "rgba(255,255,255,0.85)" }}>
        <Box sx={{ width: `${(step / vbW) * 100}%`, minWidth: 30, maxWidth: 120, height: 4, borderLeft: `2px solid ${ink}`, borderRight: `2px solid ${ink}`, borderBottom: `2px solid ${ink}` }} />
        <Typography sx={{ fontSize: "0.55rem", color: ink, fontWeight: 700 }}>{fmtDistance(step)}</Typography>
      </Box>

      {showLegend && (
        <Stack direction="row" sx={{ position: "absolute", left: 10, top: 10, gap: 1.2, px: 1, py: 0.5, borderRadius: "8px", background: dark ? "rgba(6,22,17,0.55)" : "rgba(255,255,255,0.88)", flexWrap: "wrap", maxWidth: "calc(100% - 60px)" }}>
          {Object.entries(STATUS).filter(([k]) => k !== "self" || people.some((p) => p.status === "self")).map(([k, v]) => (
            <Stack key={k} direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 9, height: 9, borderRadius: "50%", background: v.fill }} />
              <Typography sx={{ fontSize: "0.55rem", color: muted }}>{v.label}</Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}
