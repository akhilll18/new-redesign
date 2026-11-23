// Shared layout for the v10 suite modules, matching the reference module screens:
// header (eyebrow · title · subtitle · actions) → tab row → AI brief strip with one-tap actions → KPI tiles → cards.
// Colours come from the Ezyo palette: dark teal first, Glob orange second, bright teal third.
import React from "react";
import { Box, Button, Card, Chip, LinearProgress, Stack, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import { CheckCircleRounded, RadioButtonUncheckedRounded, ErrorRounded, AutorenewRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../kit/UI.jsx";
import { AI_GRADIENT, Sparkle, openCopilot } from "../ai/AiText.jsx";
import { useStore } from "../../store/AppStore.jsx";
import { ONAS as C } from "../../country/brand.js";

export { C };

export const tabSx = { minHeight: 40, "& .MuiTab-root": { minHeight: 40, fontSize: "0.72rem", fontWeight: 700, textTransform: "none", px: 1.6 } };

// Who is looking: Finance (payroll / expense modules), HR (people modules), Super Admin, employee.
export function useWho() {
  const { user, data } = useStore();
  const mods = user?.modules || [];
  const isSuper = user?.role === "superadmin";
  const isEmp = user?.role === "emp";
  const isFinance = user?.role === "admin" && (mods.includes("payroll") || mods.includes("expense"));
  const isHR = user?.role === "admin" && !isFinance;
  const me = isEmp ? data.employees.find((e) => e.employee_code === user.employee_code) : null;
  const lens = isSuper ? "SUPER ADMIN" : isFinance ? "FINANCE" : isHR ? "HR" : "EMPLOYEE";
  return { user, isSuper, isEmp, isFinance, isHR, me, lens, mods };
}

/** MUI multi-selects can return a comma string (autofill); always hand back an array. */
export const asList = (v) => (typeof v === "string" ? v.split(",").filter(Boolean) : Array.isArray(v) ? v : []);

export const periodLabel = (p) => new Date(`${p}-01T12:00:00`).toLocaleString("en", { month: "long", year: "numeric" });

export const CUR_SYM = { INR: "₹", USD: "$", GBP: "£", EUR: "€", AED: "AED ", SGD: "S$", ZAR: "R", NAD: "N$", KES: "KSh ", NGN: "₦", BWP: "P", CAD: "C$", MXN: "MX$", BRL: "R$", SAR: "SAR ", MYR: "RM", PHP: "₱", IDR: "Rp", GHS: "GH₵", ZMW: "K" };
export function money(n, cur = "INR", { compact } = {}) {
  const v = Number(n) || 0;
  const sym = CUR_SYM[cur] ?? `${cur} `;
  if (compact && cur === "INR") {
    if (Math.abs(v) >= 1e7) return `${sym}${(v / 1e7).toFixed(2)} Cr`;
    if (Math.abs(v) >= 1e5) return `${sym}${(v / 1e5).toFixed(2)} L`;
  }
  if (compact && Math.abs(v) >= 1e6) return `${sym}${(v / 1e6).toFixed(1)}M`;
  return `${sym}${Math.round(v).toLocaleString(cur === "INR" ? "en-IN" : "en-US")}`;
}

/** Module page frame. `tabs`: [[id, label, route?]] — a tab with a route navigates there (deep-linkable sidebar items). */
export function ModuleHub({ eyebrow, title, subtitle, actions, tabs, tab, onTab, brief, kpis, children, live }) {
  const navigate = useNavigate();
  return (
    <Box>
      <PageHeader
        eyebrow={<Stack component="span" direction="row" spacing={1} sx={{ alignItems: "center", display: "inline-flex" }}><span>{eyebrow}</span>{live && <LivePill text={live} />}</Stack>}
        title={title}
        subtitle={subtitle}
        actions={actions}
      />
      {tabs && (
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tabs value={tab} onChange={(_, v) => { const t = tabs.find((x) => x[0] === v); if (t?.[2]) navigate(t[2]); else onTab?.(v); }} variant="scrollable" allowScrollButtonsMobile sx={tabSx}>
            {tabs.map(([id, label, , count]) => <Tab key={id} value={id} label={count ? <Stack direction="row" spacing={0.7} sx={{ alignItems: "center" }}><span>{label}</span><Chip size="small" label={count} sx={{ height: 18, fontSize: "0.62rem", bgcolor: C.glob, color: "#fff" }} /></Stack> : label} />)}
          </Tabs>
        </Box>
      )}
      {brief && <AiBrief {...brief} />}
      {kpis && <KpiRow items={kpis} />}
      {children}
    </Box>
  );
}

export function LivePill({ text = "LIVE" }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.9, py: 0.1, borderRadius: 99, bgcolor: "rgba(244,138,62,0.14)", color: "#B4561A", fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.06em" }}>
      <Box component="span" sx={{ width: 6, height: 6, borderRadius: 99, bgcolor: C.glob, animation: "phpulse 1.6s infinite", "@keyframes phpulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.35 } } }} />
      {text}
    </Box>
  );
}

/** AI brief strip: one line of what matters plus one-tap actions (the reference "AI · …" banner). */
export function AiBrief({ text, actions = [], ask }) {
  return (
    <Card sx={{ mb: 2, px: 2, py: 1.3, display: "flex", gap: 1.5, alignItems: { xs: "flex-start", md: "center" }, flexDirection: { xs: "column", md: "row" }, borderColor: "primary.light", bgcolor: "primary.light" }}>
      <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", flex: 1, minWidth: 0 }}>
        <Box sx={{ width: 28, height: 28, borderRadius: 1.5, display: "grid", placeItems: "center", background: AI_GRADIENT, flexShrink: 0 }}><Sparkle size={15} sx={{ color: "#fff" }} /></Box>
        <Typography variant="body2" sx={{ "& b": { color: C.navy } }}>
          <Box component="span" sx={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.08em", color: C.glob, mr: 1 }}>AI</Box>
          {text}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {actions.map(([label, fn]) => <Button key={label} size="small" variant="outlined" onClick={fn} sx={{ whiteSpace: "nowrap" }}>{label}</Button>)}
        <Button size="small" onClick={() => openCopilot(ask || `Explain this page and what I should do next: ${text}`)} startIcon={<Sparkle size={13} />}>Ask AI</Button>
      </Stack>
    </Card>
  );
}

const TONE = {
  navy: [C.navy, "rgba(0,74,119,0.10)"],
  glob: ["#C8601C", "rgba(244,138,62,0.14)"],
  mint: [C.mintDeep || "#0A9E78", "rgba(16,252,190,0.18)"],
  warn: ["#9A6400", "rgba(237,161,0,0.16)"],
  bad: ["#B0291F", "rgba(176,41,31,0.10)"],
  purple: ["#5B4BB7", "rgba(91,75,183,0.10)"],
};

export function KpiRow({ items }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: `repeat(${Math.min(items.length, 6)}, minmax(0,1fr))` }, gap: 1.5, mb: 2 }}>
      {items.filter(Boolean).map((k) => <Kpi key={k.label} {...k} />)}
    </Box>
  );
}

export function Kpi({ label, value, hint, icon, tone = "navy", spark, onClick }) {
  const [fg, bg] = TONE[tone] || TONE.navy;
  return (
    <Card onClick={onClick} sx={{ p: 1.6, cursor: onClick ? "pointer" : "default", position: "relative", overflow: "hidden", "&:hover": onClick ? { borderColor: fg } : undefined }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <Typography sx={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.07em", color: "text.secondary", textTransform: "uppercase" }}>{label}</Typography>
        {icon && <Box sx={{ width: 26, height: 26, borderRadius: 1.4, display: "grid", placeItems: "center", bgcolor: bg, color: fg, "& svg": { fontSize: 16 } }}>{icon}</Box>}
      </Stack>
      <Typography sx={{ fontSize: "1.45rem", fontWeight: 800, color: fg, lineHeight: 1.2, mt: 0.3, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
      {hint && <Typography variant="caption" color="text.secondary" component="div" noWrap>{hint}</Typography>}
      {spark && <Spark data={spark} color={fg} />}
    </Card>
  );
}

export function Spark({ data, color = C.navy, height = 22 }) {
  const max = Math.max(1, ...data), min = Math.min(...data, 0);
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * 100},${height - ((v - min) / Math.max(1, max - min)) * (height - 3) - 1}`).join(" ");
  return (
    <Box component="svg" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" sx={{ width: "100%", height, mt: 0.6, display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </Box>
  );
}

export function Ring({ value, max = 100, size = 96, stroke = 10, color = C.navy, label, sub }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(1, value / Math.max(1, max)));
  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(0,74,119,0.10)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: size > 80 ? "1.15rem" : "0.85rem", color, lineHeight: 1 }}>{label ?? `${Math.round(pct * 100)}%`}</Typography>
          {sub && <Typography sx={{ fontSize: "0.58rem", color: "text.secondary", mt: 0.3 }}>{sub}</Typography>}
        </Box>
      </Box>
    </Box>
  );
}

/** Horizontal pipeline of steps: status done | running | todo | error. */
export function Steps({ steps, compact }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: compact ? "repeat(3, minmax(0,1fr))" : "1fr", md: `repeat(${steps.length}, minmax(0,1fr))` }, gap: compact ? 0.6 : 1 }}>
      {steps.map((s, i) => {
        const col = s.status === "done" ? (C.mintDeep || "#0A9E78") : s.status === "running" ? C.glob : s.status === "error" ? "#B0291F" : "#9AAAB6";
        const Icon = s.status === "done" ? CheckCircleRounded : s.status === "running" ? AutorenewRounded : s.status === "error" ? ErrorRounded : RadioButtonUncheckedRounded;
        return (
          <Box key={s.key || i} sx={{ p: compact ? 1 : 1.3, borderRadius: 2, border: 1, borderColor: s.status === "running" ? C.glob : "divider", bgcolor: s.status === "done" ? "rgba(16,252,190,0.07)" : s.status === "running" ? "rgba(244,138,62,0.07)" : "background.paper" }}>
            <Stack direction={compact ? "column" : "row"} spacing={compact ? 0.4 : 0.8} sx={{ alignItems: "center", textAlign: compact ? "center" : "left" }}>
              <Icon sx={{ fontSize: 18, color: col, ...(s.status === "running" ? { animation: "phspin 1.1s linear infinite", "@keyframes phspin": { to: { transform: "rotate(360deg)" } } } : {}) }} />
              <Typography sx={{ fontSize: compact ? "0.64rem" : "0.74rem", fontWeight: 700, lineHeight: 1.25 }}>{compact ? s.label : `${i + 1}. ${s.label}`}</Typography>
            </Stack>
            {!compact && s.sub && <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.4, lineHeight: 1.35 }}>{s.sub}</Typography>}
          </Box>
        );
      })}
    </Box>
  );
}

export function QuickAction({ icon, label, sub, onClick, tone = "navy" }) {
  const [fg, bg] = TONE[tone] || TONE.navy;
  return (
    <Card onClick={onClick} sx={{ p: 1.4, cursor: "pointer", display: "flex", gap: 1.2, alignItems: "center", "&:hover": { borderColor: fg, transform: "translateY(-1px)" }, transition: "all .15s" }}>
      <Box sx={{ width: 34, height: 34, borderRadius: 1.6, display: "grid", placeItems: "center", bgcolor: bg, color: fg, flexShrink: 0, "& svg": { fontSize: 19 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700 }} noWrap>{label}</Typography>
        {sub && <Typography variant="caption" color="text.secondary" noWrap component="div">{sub}</Typography>}
      </Box>
    </Card>
  );
}

export function Progress({ value, color = C.navy, label, right }) {
  return (
    <Box>
      {(label || right) && <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.4 }}><Typography variant="body2" noWrap>{label}</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{right ?? `${Math.round(value)}%`}</Typography></Stack>}
      <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, value))} sx={{ height: 8, borderRadius: 4, bgcolor: "rgba(0,74,119,0.08)", "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 4 } }} />
    </Box>
  );
}

export function Pill({ children, tone = "navy", sx }) {
  const [fg, bg] = TONE[tone] || TONE.navy;
  return <Chip size="small" label={children} sx={{ height: 20, fontSize: "0.66rem", fontWeight: 700, bgcolor: bg, color: fg, ...sx }} />;
}

export function Hint({ children }) {
  return <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1, lineHeight: 1.45 }}>{children}</Typography>;
}

export function TwoCol({ children, right = 360 }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: `minmax(0,1fr) ${right}px` }, gap: 2, alignItems: "start" }}>{children}</Box>;
}

export function WithTip({ title, children }) {
  return <Tooltip title={title}><span>{children}</span></Tooltip>;
}

export const STATUS_TONE = { done: "mint", completed: "mint", filed: "mint", paid: "mint", applied: "mint", active: "mint", matched: "mint", approved: "mint", resolved: "mint", answered: "mint", ok: "mint", connected: "mint",
  pending: "glob", pending_review: "glob", in_progress: "glob", notice: "glob", contract_sent: "glob", documents: "glob", draft: "glob", missing_receipt: "glob", scheduled: "navy", queued: "navy", ready: "navy", computed: "navy", fnf: "navy", open: "glob",
  overdue: "bad", failed: "bad", rejected: "bad", frozen: "bad", error: "bad" };
export function StatusPill({ status }) {
  return <Pill tone={STATUS_TONE[status] || "navy"}>{String(status).replace(/_/g, " ")}</Pill>;
}
