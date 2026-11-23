// Shared building blocks used across all three role views.
import React, { useEffect } from "react";
import {
  Avatar as MuiAvatar,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Alert,
  Stack,
  Typography,
  Tooltip,
} from "@mui/material";
import { InfoOutlined, WarningAmberRounded, FlagRounded } from "@mui/icons-material";
import { initials } from "../../lib/utils.js";
import { designTokens } from "../../theme/muiTheme.js";
import { useStore } from "../../store/AppStore.jsx";
import { Sparkle, openCopilot } from "../ai/AiText.jsx";

const { color, radius, shadow } = designTokens;

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "flex-end" }, mb: 2.5 }}>
      <Box sx={{ minWidth: 0 }}>
        {/* v10.5: the code-style eyebrow line (e.g. "ADM01 · LEAVE · ACCOUNTS …") is no longer shown on any page. */}
        <Typography variant="h1" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: "72ch" }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Tooltip title="Generative AI summary of everything on this page">
          <Button
            data-ai-ui
            variant="outlined"
            color="primary"
            startIcon={<Sparkle size={15} />}
            onClick={() => openCopilot(`Summarise the "${typeof title === "string" ? title : "current"}" page for me in a few bullets and tell me what needs my attention.`)}
          >
            AI summary
          </Button>
        </Tooltip>
        {actions}
      </Stack>
    </Stack>
  );
}

const TONES = {
  good: "goodSoft",
  warn: "warnSoft",
  bad: "badSoft",
  info: "infoSoft",
  accent: "accentSoft",
  neutral: "neutralSoft",
};

export function StatCard({ label, value, hint, tone = "accent", icon, onClick }) {
  const t = TONES[tone];
  return (
    <Card
      onClick={onClick}
      sx={{
        p: { xs: 2.5, md: 3 },
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1,
        borderRadius: `${radius.lg}px`,
        boxShadow: shadow,
        cursor: onClick ? "pointer" : "default",
        transition: "transform .15s, border-color .15s, box-shadow .15s",
        "&:hover": onClick ? { borderColor: color.borderStrong, transform: "translateY(-2px)", boxShadow: "0 8px 18px rgba(36,77,61,.07)" } : undefined,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        {icon && (
          <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: `${t}.main`, color: `${t}.contrastText`, "& svg": { fontSize: 19 } }}>
            {icon}
          </Box>
        )}
      </Stack>
      <Typography variant="h4" sx={{ fontSize: 28, lineHeight: 1.15 }}>{value}</Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Card>
  );
}

const STATUS_TONE = {
  Draft: "neutral",
  Pending: "info",
  "Manager Approved": "info",
  Paid: "good",
  Disbursed: "good",
  Cancelled: "neutral",
  approved: "good",
  rejected_step: "bad",
  pending: "warn",
  waiting: "neutral",
  skipped: "neutral",
  Submitted: "info",
  "Under Review": "info",
  "On Hold": "warn",
  Escalated: "warn",
  Approved: "good",
  Credited: "good",
  Rejected: "bad",
  Withdrawn: "neutral",
  active: "good",
  locked: "bad",
  suspended: "warn",
  pending_approval: "info",
  rejected: "bad",
  enabled: "good",
  pending_setup: "warn",
  credit: "good",
  redeem: "info",
  adjust: "warn",
};

const STATUS_TEXT = { pending_approval: "Pending approval", pending_setup: "Setup pending", active: "Active", locked: "Locked", suspended: "Suspended", rejected: "Declined", enabled: "Enabled", credit: "Credit", redeem: "Redeemed", adjust: "Adjustment" };

export function StatusChip({ status, size = "small" }) {
  const t = TONES[STATUS_TONE[status] || "neutral"];
  return <Chip size={size} label={STATUS_TEXT[status] || status} sx={{ bgcolor: `${t}.main`, color: `${t}.contrastText`, border: "1px solid", borderColor: "divider", height: 22, fontSize: 11, fontWeight: 600 }} />;
}

export function Tag({ children, tone = "neutral", sx }) {
  const t = TONES[tone];
  return <Chip size="small" label={children} sx={{ bgcolor: `${t}.main`, color: `${t}.contrastText`, border: "1px solid", borderColor: "divider", height: 22, fontSize: 11, fontWeight: 600, ...sx }} />;
}

export function SectionCard({ title, subtitle, action, children, noPad, sx }) {
  return (
    <Card sx={{ ...sx }}>
      {(title || action) && (
        <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center", px: { xs: 2.5, md: 3 }, py: 2, borderBottom: 1, borderColor: "divider" }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3">{title}</Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {action}
        </Stack>
      )}
      <Box sx={{ p: noPad ? 0 : { xs: 2.5, md: 3 } }}>{children}</Box>
    </Card>
  );
}

export function EmptyState({ title, text, action, icon }) {
  return (
    <Stack spacing={1} sx={{ alignItems: "center", py: 5, px: 2, textAlign: "center" }}>
      {icon && <Box sx={{ color: "text.secondary", "& svg": { fontSize: 40 } }}>{icon}</Box>}
      <Typography variant="h3">{title}</Typography>
      {text && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {text}
        </Typography>
      )}
      {action}
    </Stack>
  );
}

export function Avatar({ name, size = 32, src }) {
  return (
    <MuiAvatar src={src || undefined} sx={{ width: size, height: size, fontSize: 13, fontWeight: 600, bgcolor: color.avatar, color: color.secondaryText }}>
      {initials(name)}
    </MuiAvatar>
  );
}

export function PersonCell({ name, sub, src }) {
  return (
    <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", minWidth: 0 }}>
      <Avatar name={name} size={28} src={src} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {name}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {sub}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

export function Mono({ children, sx }) {
  return (
    <Box component="span" sx={{ fontVariantNumeric: "tabular-nums", fontSize: "0.75rem", ...sx }}>
      {children}
    </Box>
  );
}

export function FlagList({ flags = [], flagged, dense }) {
  if (!flags.length && !flagged) return null;
  return (
    <Stack spacing={0.75}>
      {flagged && (
        <Alert severity="error" icon={<FlagRounded fontSize="small" />} sx={{ py: dense ? 0 : 0.5 }}>
          Flagged as suspicious by {flagged.by}: {flagged.reason}
        </Alert>
      )}
      {flags.map((f) => (
        <Alert key={f.code} severity={f.level === "warn" ? "warning" : "info"} icon={f.level === "warn" ? <WarningAmberRounded fontSize="small" /> : <InfoOutlined fontSize="small" />} sx={{ py: dense ? 0 : 0.25 }}>
          {f.text}
        </Alert>
      ))}
    </Stack>
  );
}

export function FlagIcons({ s }) {
  const warn = s.flags?.filter((f) => f.level === "warn") || [];
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
      {s.flagged && (
        <Tooltip title={`Flagged: ${s.flagged.reason}`}>
          <FlagRounded sx={{ fontSize: 16, color: "error.main" }} />
        </Tooltip>
      )}
      {warn.length > 0 && (
        <Tooltip title={warn.map((f) => f.text).join(" · ")}>
          <WarningAmberRounded sx={{ fontSize: 16, color: "warning.main" }} />
        </Tooltip>
      )}
    </Stack>
  );
}

export function KeyVal({ items, cols = 2 }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: `repeat(${cols}, minmax(0,1fr))` }, gap: 1.5 }}>
      {items.filter(Boolean).map(([k, v, opts = {}]) => (
        <Box key={k} sx={{ minWidth: 0, gridColumn: opts.full ? "1 / -1" : undefined }}>
          <Typography variant="caption" color="text.secondary" component="div">
            {k}
            {opts.required && <Box component="span" sx={{ color: "error.main", ml: 0.3 }}>*</Box>}
          </Typography>
          <Typography variant="body2" component="div" sx={{ overflowWrap: "anywhere", whiteSpace: opts.pre ? "pre-wrap" : undefined }}>
            {v === "" || v == null ? "—" : v}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// Plain bar chart (one or two series) with labelled values; no chart library needed.
export function BarChart({ data, series, height = 160, format = (v) => v }) {
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)));
  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
        {series.map((s) => (
          <Stack key={s.key} direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: s.color }} />
            <Typography variant="caption" color="text.secondary">
              {s.label}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end", height, borderBottom: 1, borderColor: "divider" }}>
        {data.map((d) => (
          <Stack key={d.label} direction="row" spacing={0.4} sx={{ justifyContent: "center", alignItems: "flex-end", flex: 1, height: "100%" }}>
            {series.map((s) => (
              <Tooltip key={s.key} title={`${d.label} · ${s.label}: ${format(d[s.key] || 0)}`}>
                <Box sx={{ width: "100%", maxWidth: 22, height: `${((d[s.key] || 0) / max) * 100}%`, minHeight: d[s.key] ? 3 : 0, bgcolor: s.color, borderRadius: "4px 4px 0 0" }} />
              </Tooltip>
            ))}
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        {data.map((d) => (
          <Typography key={d.label} variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: "center" }}>
            {d.label}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

export function HBar({ label, value, max, color = "primary.main", right }) {
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.4 }}>
        <Typography variant="body2" noWrap sx={{ pr: 1 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {right ?? value}
        </Typography>
      </Stack>
      <Box sx={{ height: 8, borderRadius: 4, bgcolor: "sunk.main", overflow: "hidden" }}>
        <Box sx={{ height: "100%", width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, bgcolor: color, borderRadius: 4 }} />
      </Box>
    </Box>
  );
}

export function ConfirmDialog({ open, title, text, confirmLabel = "Confirm", tone = "primary", onConfirm, onClose, children, disabled }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        {text && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: children ? 2 : 0 }}>
            {text}
          </Typography>
        )}
        {children}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" color={tone} onClick={onConfirm} disabled={disabled}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ToastHost() {
  const { toast, setToast } = useStore();
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast, setToast]);
  return (
    <Snackbar open={!!toast} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} onClose={() => setToast(null)}>
      {toast ? (
        <Alert severity={toast.tone} variant="filled" onClose={() => setToast(null)} sx={{ maxWidth: 440 }}>
          {toast.text}
        </Alert>
      ) : (
        <span />
      )}
    </Snackbar>
  );
}

export function Grid({ min = 220, gap = 2, children, sx }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap, ...sx }}>{children}</Box>;
}

export function TableWrap({ children }) {
  return <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>{children}</Box>;
}
