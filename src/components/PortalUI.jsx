import React from "react";
import {
  Box,
  Card,
  Typography,
  Button as MuiButton,
  Chip,
  Avatar as MuiAvatar,
  IconButton as MuiIconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
} from "@mui/material";
import {
  NorthEast as ArrowUpRight,
  Check,
  ChevronRight,

  Close as X,
  HelpOutlineRounded as CircleHelp,
} from "@mui/icons-material";
import { designTokens } from "../theme/muiTheme.js";

const { color, radius, shadow } = designTokens;

// ── Button ─────────────────────────────────────────────────
export function Button({ children, variant = "primary", icon: Icon, sx, ...props }) {
  const variantMap = {
    primary: "contained",
    secondary: "outlined",
    ghost: "text",
  };
  return (
    <MuiButton
      variant={variantMap[variant] || "text"}
      color={variant === "primary" ? "primary" : "inherit"}
      startIcon={Icon ? <Icon size={16} /> : undefined}
      sx={{
        ...(variant === "secondary" ? { color: color.text, borderColor: color.border, backgroundColor: color.card } : {}),
        ...(variant === "ghost" ? { color: color.secondaryText } : {}),
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiButton>
  );
}

// ── IconButton ─────────────────────────────────────────────
export function IconButton({ children, label, sx, ...props }) {
  return (
    <MuiIconButton
      aria-label={label}
      title={label}
      size="small"
      sx={{
        color: color.secondaryText,
        width: 34,
        height: 34,
        borderRadius: "8px",
        "&:hover": { background: color.muted, color: "primary.main" },
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiIconButton>
  );
}

// ── PageHeader ─────────────────────────────────────────────
export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <Stack
      direction="row"
     
     
      sx={{ justifyContent: "space-between", alignItems: "flex-start", minHeight: 69, mb: 2.5 }}
    >
      <Box>
        {/* v10.5: code-style eyebrow lines are no longer shown (same as the kit PageHeader). */}
        <Typography variant="h1">{title}</Typography>
        {description && (
          <Typography sx={{ mt: 0.5, color: color.secondaryText, fontSize: "0.8125rem" }}>
            {description}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>{action}</Box>}
    </Stack>
  );
}

// ── Panel ──────────────────────────────────────────────────
export function Panel({ title, subtitle, action, className, children, sx }) {
  return (
    <Card sx={{ overflow: "hidden", ...sx }}>
      {(title || action) && (
        <Stack
          direction="row"
         
         
          sx={{ justifyContent: "space-between", alignItems: "center",
            minHeight: 64,
            px: { xs: 2.5, md: 3 },
            py: 1.8,
            borderBottom: `1px solid ${color.border}`,
          }}
        >
          <Box>
            {title && (
              <Typography variant="h2" sx={{ color: color.text, fontSize: 15, fontWeight: 600 }}>
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography sx={{ mt: 0.4, color: color.secondaryText, fontSize: 13 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action}
        </Stack>
      )}
      {children}
    </Card>
  );
}

// ── StatCard ───────────────────────────────────────────────
export function StatCard({ label, value, note, icon: Icon, tone = "green", onClick }) {
  const toneMap = {
    green: { bg: color.successSoft, color: color.sage },
    orange: { bg: color.warningSoft, color: color.warning },
    blue: { bg: color.infoSoft, color: color.info },
    rose: { bg: color.dangerSoft, color: color.danger },
  };
  const t = toneMap[tone] || toneMap.green;
  return (
    <Card
      component={onClick ? "button" : "div"}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      sx={{
        p: { xs: 2.5, md: 3 },
        display: "flex",
        flexDirection: "column",
        gap: 1.1,
        minHeight: 152,
        borderRadius: `${radius.lg}px`,
        boxShadow: shadow,
        ...(onClick ? {
          width: "100%",
          borderWidth: "1px",
          textAlign: "left",
          font: "inherit",
          cursor: "pointer",
          transition: "transform .15s, border-color .15s, box-shadow .15s",
          "&:hover": { transform: "translateY(-2px)", borderColor: color.borderStrong, boxShadow: "0 8px 18px rgba(36,77,61,.07)" },
        } : {}),
      }}
    >
      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: color.secondaryText, fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
            {label}
          </Typography>
          <Typography sx={{ mt: 1, color: color.text, fontSize: 28, fontWeight: 700, lineHeight: 1.15 }}>
            {value}
          </Typography>
          {note && <Typography sx={{ mt: 0.75, color: color.secondaryText, fontSize: 12 }}>{note}</Typography>}
        </Box>
        {Icon && (
          <Box sx={{ width: 36, height: 36, flex: "0 0 auto", borderRadius: 2, background: t.bg, color: t.color, display: "grid", placeItems: "center" }}>
            <Icon size={18} />
          </Box>
        )}
      </Stack>
    </Card>
  );
}

// ── Badge ──────────────────────────────────────────────────
export function Badge({ children, tone = "neutral" }) {
  const toneMap = {
    neutral: { bg: color.muted, color: color.secondaryText, border: color.border },
    green: { bg: color.successSoft, color: color.success, border: color.border },
    orange: { bg: color.warningSoft, color: color.warning, border: color.border },
    blue: { bg: color.infoSoft, color: color.info, border: color.border },
    "light-green": { bg: color.successSoft, color: color.success, border: color.border },
  };
  const t = toneMap[tone] || toneMap.neutral;
  return (
    <Chip
      label={children}
      size="small"
      sx={{
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
        height: 22,
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        "& .MuiChip-label": { px: 1 },
      }}
    />
  );
}

// ── Avatar ─────────────────────────────────────────────────
export function Avatar({ name, size = "normal" }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const dim = size === "large" ? 63 : 31;
  return (
    <MuiAvatar
      sx={{
        width: dim,
        height: dim,
        background: color.avatar,
        color: color.secondaryText,
        border: `1px solid ${color.border}`,
        fontSize: size === "large" ? "13px" : "13px",
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials}
    </MuiAvatar>
  );
}

// ── ChevronAction ──────────────────────────────────────────
export function ChevronAction({ children, onClick }) {
  return (
    <MuiButton
      size="small"
      onClick={onClick}
      endIcon={<ChevronRight sx={{ fontSize: 15 }} />}
      sx={{
        color: color.primary,
        fontSize: "0.8125rem",
        p: 0,
        minWidth: 0,
        "&:hover": { background: "transparent", color: color.primaryHover },
      }}
    >
      {children}
    </MuiButton>
  );
}

// ── EmptyState ─────────────────────────────────────────────
export function EmptyState({ title, description, action }) {
  return (
    <Stack
     
      spacing={0.7}
      sx={{ alignItems: "center", py: 4, px: 2, textAlign: "center", color: color.secondaryText }}
    >
      <CircleHelp sx={{ color: color.mutedText, fontSize: 22 }} />
      <Typography sx={{ color: color.text, fontSize: "0.875rem", fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: "0.75rem", maxWidth: 280 }}>
        {description}
      </Typography>
      {action}
    </Stack>
  );
}

// ── ModalFrame ─────────────────────────────────────────────
export function ModalFrame({ title, description, onClose, children, footer }) {
  return (
    <Dialog
      open
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 460,
          maxWidth: "100%",
          borderRadius: `${radius.lg}px`,
          border: `1px solid ${color.border}`,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          p: 2.5,
          pb: 1.8,
          borderBottom: `1px solid ${color.border}`,
        }}
      >
        <Box>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: "1rem",
              color: color.text,
            }}
          >
            {title}
          </Typography>
          {description && (
            <Typography sx={{ mt: 0.5, color: color.secondaryText, fontSize: "0.8125rem" }}>
              {description}
            </Typography>
          )}
        </Box>
        <MuiIconButton onClick={onClose} size="small">
          <X sx={{ fontSize: 18 }} />
        </MuiIconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 2.5 }}>{children}</DialogContent>
      {footer && <DialogActions sx={{ p: "0 20px 16px" }}>{footer}</DialogActions>}
    </Dialog>
  );
}

// ── LinkButton ─────────────────────────────────────────────
export function LinkButton({ children, onClick }) {
  return (
    <MuiButton
      onClick={onClick}
      endIcon={<ArrowUpRight sx={{ fontSize: 14 }} />}
      sx={{ fontSize: "0.75rem", p: 0, minWidth: 0 }}
    >
      {children}
    </MuiButton>
  );
}

// ── SuccessMark ────────────────────────────────────────────
export function SuccessMark() {
  return (
    <Box
      sx={{
        display: "inline-grid",
        width: 20,
        height: 20,
        placeItems: "center",
        borderRadius: "50%",
        background: color.successSoft,
        color: color.success,
      }}
    >
      <Check sx={{ fontSize: 13 }} />
    </Box>
  );
}