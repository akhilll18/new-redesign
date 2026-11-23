// Glass dashboard kit: frosted panels over a neutral dark surface.
import React from "react";
import { Box, ButtonBase, Stack, Tooltip, Typography } from "@mui/material";
import { designTokens } from "../../theme/muiTheme.js";

const { color } = designTokens;

export const G = {
  forest: color.text,
  pine: color.text,
  teal: color.primary,
  mint: color.primarySoft,
  mintStrong: color.primary,
  saffron: color.warning,
  saffronStrong: color.warning,
  fog: color.card,
  muted: "rgba(255,255,255,0.72)",
  faint: "rgba(255,255,255,0.5)",
  line: "rgba(255,255,255,0.16)",
  bad: color.danger,
  good: color.success,
  info: color.info,
};

export const meshBackground = {
  backgroundColor: G.forest,
};

const glassSurface = (level = 1) => ({
  background: level === 2 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
  backdropFilter: "blur(18px) saturate(140%)",
  WebkitBackdropFilter: "blur(18px) saturate(140%)",
  border: `1px solid ${G.line}`,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 24px 48px -28px rgba(0,0,0,0.55)",
  color: G.fog,
});

export function GlassCard({ title, subtitle, action, children, sx, level = 1, pad = 2.2, radius = "20px" }) {
  return (
    <Box sx={{ ...glassSurface(level), borderRadius: radius, p: pad, minWidth: 0, ...sx }}>
      {(title || action) && (
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1.6, gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            {title && <Typography sx={{  fontWeight: 700, fontSize: "0.86rem", color: G.fog }}>{title}</Typography>}
            {subtitle && <Typography sx={{ fontSize: "0.62rem", color: G.faint, mt: 0.3 }}>{subtitle}</Typography>}
          </Box>
          {action}
        </Stack>
      )}
      {children}
    </Box>
  );
}

export function GlassStat({ label, value, hint, icon, onClick, tone = "mint", spark }) {
  const accent = { mint: G.mint, saffron: G.saffron, bad: G.bad, info: G.info, fog: G.fog }[tone] || G.mint;
  const body = (
    <Box sx={{ ...glassSurface(1), borderRadius: "16px", p: 1.8, width: "100%", textAlign: "left", height: "100%", transition: "border-color .15s", "&:hover": onClick ? { borderColor: "rgba(255,255,255,0.34)" } : undefined }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.8 }}>
        <Typography sx={{ fontSize: "0.64rem", color: G.muted }}>{label}</Typography>
        {icon && <Box sx={{ color: accent, display: "grid", "& svg": { fontSize: 18 } }}>{icon}</Box>}
      </Stack>
      <Stack direction="row" sx={{ alignItems: "flex-end", justifyContent: "space-between", gap: 1 }}>
        <Typography sx={{  fontWeight: 800, fontSize: "1.45rem", lineHeight: 1.05, color: G.fog, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
        {spark && <Sparkline data={spark} color={accent} />}
      </Stack>
      {hint && <Typography sx={{ fontSize: "0.6rem", color: G.faint, mt: 0.6 }}>{hint}</Typography>}
    </Box>
  );
  return onClick ? (
    <ButtonBase onClick={onClick} sx={{ display: "block", borderRadius: "16px", width: "100%", "&:focus-visible": { outline: `2px solid ${G.saffron}`, outlineOffset: 2 } }}>
      {body}
    </ButtonBase>
  ) : (
    body
  );
}

// Single-series sparkline with an end dot; hover shows the last value via title.
export function Sparkline({ data, color = G.mint, width = 74, height = 26 }) {
  if (!data?.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const x = (i) => (i / Math.max(1, data.length - 1)) * (width - 4) + 2;
  const y = (v) => height - 3 - ((v - min) / Math.max(1, max - min)) * (height - 6);
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ overflow: "visible", flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="3" fill={color} stroke={G.forest} strokeWidth="1.5" />
    </svg>
  );
}

// Progress ring. value/max; label inside.
export function Ring({ value, max = 100, size = 92, stroke = 9, color = G.mint, label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }} role="img" aria-label={`${label ?? Math.round(pct * 100) + "%"}${sub ? ` ${sub}` : ""}`}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      </svg>
      <Stack sx={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
        <Typography sx={{  fontWeight: 800, fontSize: size > 80 ? "1.05rem" : "0.8rem", color: G.fog, lineHeight: 1 }}>{label ?? `${Math.round(pct * 100)}%`}</Typography>
        {sub && <Typography sx={{ fontSize: "0.52rem", color: G.faint, mt: 0.3 }}>{sub}</Typography>}
      </Stack>
    </Box>
  );
}

// Vertical bars for one series on glass. Hover tooltip per bar.
export function GlassBars({ data, height = 110, color = G.mint, format = (v) => v, highlightLast = true }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: "flex-end", gap: "6px", height, borderBottom: `1px solid ${G.line}` }}>
        {data.map((d, i) => (
          <Tooltip key={d.label + i} title={`${d.label}: ${format(d.value)}`}>
            <Box sx={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", cursor: "default" }}>
              <Box sx={{ width: "100%", maxWidth: 26, mx: "auto", height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0, borderRadius: "4px 4px 0 0", background: highlightLast && i === data.length - 1 ? G.saffron : color, opacity: highlightLast && i !== data.length - 1 ? 0.75 : 1 }} />
            </Box>
          </Tooltip>
        ))}
      </Stack>
      <Stack direction="row" sx={{ gap: "6px", mt: 0.6 }}>
        {data.map((d, i) => (
          <Typography key={d.label + i} sx={{ flex: 1, textAlign: "center", fontSize: "0.52rem", color: G.faint }} noWrap>
            {d.short ?? d.label}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

// Horizontal split bar (e.g. present / late / absent) with a legend that carries labels and counts.
export function SplitBar({ parts, height = 10 }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <Box>
      <Box sx={{ display: "flex", height, borderRadius: height, overflow: "hidden", gap: "2px", background: "rgba(255,255,255,0.08)" }}>
        {parts.filter((p) => p.value).map((p) => (
          <Tooltip key={p.label} title={`${p.label}: ${p.value}`}>
            <Box sx={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
          </Tooltip>
        ))}
      </Box>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1.4, mt: 1 }}>
        {parts.map((p) => (
          <Stack key={p.label} direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
            <Typography sx={{ fontSize: "0.6rem", color: G.muted }}>
              {p.label} <b style={{ color: G.fog }}>{p.value}</b>
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export function GlassPill({ children, tone = "fog" }) {
  const c = { good: G.good, bad: G.bad, warn: G.saffron, info: G.info, fog: G.fog }[tone] || G.fog;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.9, py: 0.2, borderRadius: 99, fontSize: "0.58rem", fontWeight: 700, color: c, background: "rgba(255,255,255,0.08)", border: `1px solid ${G.line}`, whiteSpace: "nowrap" }}>
      {children}
    </Box>
  );
}

export function GlassButton({ children, onClick, variant = "soft", startIcon, disabled, sx, ...rest }) {
  const solid = variant === "solid";
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      {...rest}
      sx={{
        gap: 0.8,
        px: 1.6,
        py: 0.9,
        borderRadius: 99,
        fontSize: "0.68rem",
        fontWeight: 700,
        color: solid ? G.forest : G.fog,
        background: solid ? G.mint : "rgba(255,255,255,0.1)",
        border: `1px solid ${solid ? G.mint : G.line}`,
        opacity: disabled ? 0.45 : 1,
        "&:hover": { background: solid ? "#B7EDD8" : "rgba(255,255,255,0.18)" },
        "&:focus-visible": { outline: `2px solid ${G.saffron}`, outlineOffset: 2 },
        "& svg": { fontSize: 16 },
        ...sx,
      }}
    >
      {startIcon}
      {children}
    </ButtonBase>
  );
}

export function GlassRow({ left, title, sub, right, onClick }) {
  return (
    <ButtonBase onClick={onClick} disabled={!onClick} sx={{ display: "flex", width: "100%", textAlign: "left", gap: 1.2, alignItems: "center", py: 1, px: 0.5, borderRadius: "10px", "&:hover": onClick ? { background: "rgba(255,255,255,0.06)" } : undefined, "& + &": { borderTop: `1px solid rgba(255,255,255,0.08)` } }}>
      {left}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: "0.7rem", fontWeight: 600, color: G.fog }}>{title}</Typography>
        {sub && <Typography noWrap sx={{ fontSize: "0.6rem", color: G.faint }}>{sub}</Typography>}
      </Box>
      {right}
    </ButtonBase>
  );
}

export function GlassAvatar({ name, size = 28, src }) {
  const init = (name || "?").split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <Box sx={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", fontSize: size * 0.36, fontWeight: 800, color: G.fog, background: src ? `center/cover url(${src})` : G.pine, border: "1.5px solid rgba(255,255,255,0.5)" }}>
      {!src && init}
    </Box>
  );
}

export function GlassGrid({ min = 180, gap = 1.6, children, sx }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap, ...sx }}>{children}</Box>;
}

export function DemoClockNote({ clock }) {
  if (!clock?.at) return null; // v10.10: a clean company has no sample day
  return <Typography sx={{ fontSize: "0.58rem", color: G.faint }}>Sample data for today is shown as at {clock.at}, because the demo was loaded outside working hours.</Typography>;
}
