import { createTheme } from "@mui/material/styles";

export const designTokens = {
  color: {
    app: "#f7faf7",
    card: "#ffffff",
    soft: "#fbfdfb",
    muted: "#f8faf7",
    backgroundSage: "#ebf3ec",
    text: "#202922",
    secondaryText: "#39443c",
    mutedText: "#8a948d",
    faintText: "#89948c",
    disabledText: "#b2bbb3",
    avatar: "#ebf3ec",
    borderSoft: "#edf0ec",
    border: "#e6ece5",
    borderDivider: "#f0f2ef",
    borderStrong: "#d9e2d9",
    primary: "#244d3d",
    primaryLight: "#315f49",
    primaryDark: "#1b3a2e",
    primaryHover: "#1b3a2e",
    primarySoft: "#ebf3ec",
    deeperGreen: "#466d50",
    accent: "#f0a07e",
    sage: "#64a37a",
    lightSage: "#c6dfaa",
    paleSage: "#9fd7a7",
    success: "#2e7d32",
    successDeep: "#1b5e20",
    successSoft: "#e8f2ec",
    warning: "#bf7955",
    warningSoft: "#fdf2e9",
    danger: "#d32f2f",
    dangerDeep: "#b71c1c",
    dangerSoft: "#f7eded",
    info: "#315f49",
    infoSoft: "#ebf3ec",
  },
  radius: { sm: 6, md: 10, lg: 14 },
  shadow: "0 1px 2px rgba(36,77,61,.04), 0 1px 3px rgba(36,77,61,.06)",
};

const { color, radius, shadow } = designTokens;
const shadows = [...createTheme().shadows];
shadows[1] = shadow;
shadows[2] = shadow;

export const muiTheme = createTheme({
  palette: {
    primary: { main: color.primary, light: color.primaryLight, dark: color.primaryDark, contrastText: "#ffffff" },
    secondary: { main: color.accent, contrastText: "#ffffff" },
    success: { main: color.success, dark: color.successDeep, light: color.successSoft },
    warning: { main: color.warning, light: color.warningSoft },
    info: { main: color.info, light: color.infoSoft },
    error: { main: color.danger, dark: color.dangerDeep, light: color.dangerSoft },
    background: { default: color.app, paper: color.card },
    text: { primary: color.text, secondary: color.mutedText, disabled: color.disabledText },
    divider: color.border,
    sunk: { main: color.muted, contrastText: color.text },
    goodSoft: { main: color.successSoft, contrastText: color.success },
    warnSoft: { main: color.warningSoft, contrastText: color.warning },
    badSoft: { main: color.dangerSoft, contrastText: color.danger },
    infoSoft: { main: color.infoSoft, contrastText: color.info },
    accentSoft: { main: color.primarySoft, contrastText: color.primaryHover },
    neutralSoft: { main: color.muted, contrastText: color.secondaryText },
    sidebar: { main: color.card, contrastText: color.secondaryText },
  },
  typography: {
    fontFamily: '"Inter", "Manrope", system-ui, -apple-system, sans-serif',
    fontSize: 14,
    h1: { fontWeight: 700, fontSize: "1.75rem", letterSpacing: "-0.035em", lineHeight: 1.2 },
    h2: { fontWeight: 600, fontSize: "1.05rem", letterSpacing: "-0.015em" },
    h3: { fontWeight: 600, fontSize: "0.9375rem" },
    h4: { fontWeight: 700, fontSize: "1.75rem", letterSpacing: "-0.025em" },
    body1: { fontSize: "0.875rem", lineHeight: 1.55 },
    body2: { fontSize: "0.8125rem", lineHeight: 1.5 },
    caption: { fontSize: "0.75rem", color: color.secondaryText, lineHeight: 1.45 },
    overline: { fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.045em", lineHeight: 1.6 },
    button: { textTransform: "none", fontWeight: 500, fontSize: "0.8125rem" },
  },
  shape: { borderRadius: radius.md },
  shadows,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: color.app,
          color: color.text,
          WebkitFontSmoothing: "antialiased",
        },
        "*, *::before, *::after": { boxSizing: "border-box" },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 36,
          paddingInline: 14,
          borderRadius: 8,
          boxShadow: "none",
          fontWeight: 500,
          "&:hover": { boxShadow: "none" },
        },
        contained: {
          "&:hover": { backgroundColor: color.primaryHover },
          "&.Mui-disabled": { backgroundColor: color.muted, color: color.mutedText },
        },
        containedSuccess: {
          "&:hover": { backgroundColor: color.successDeep },
        },
        outlined: {
          borderColor: color.border,
          color: color.text,
          backgroundColor: color.card,
          "&:hover": { borderColor: color.borderStrong, backgroundColor: color.muted },
        },
        text: { color: color.secondaryText, "&:hover": { backgroundColor: color.muted } },
        sizeSmall: { minHeight: 36, fontSize: "0.75rem" },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${color.border}`,
          borderRadius: radius.lg,
          backgroundColor: color.card,
          boxShadow: shadow,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          height: 44,
          padding: "0 16px",
          color: color.secondaryText,
          backgroundColor: color.card,
          borderBottom: `1px solid ${color.border}`,
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          "&:first-of-type": { paddingLeft: 20 },
        },
        body: {
          height: 52,
          padding: "8px 16px",
          color: color.text,
          borderBottom: `1px solid ${color.borderDivider}`,
          fontSize: "0.8125rem",
          "&:first-of-type": { paddingLeft: 20 },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { "&:last-child td, &:last-child th": { borderBottom: 0 } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { height: 22, borderRadius: 99, fontSize: "0.6875rem", fontWeight: 600 },
        label: { paddingInline: 8 },
      },
    },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          height: 36,
          borderRadius: 8,
          backgroundColor: color.card,
          fontSize: "0.8125rem",
          "&.MuiInputBase-multiline": { height: "auto" },
        },
        notchedOutline: { borderColor: color.borderStrong },
        input: { padding: "8px 12px" },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: 2, borderRadius: 2, backgroundColor: color.primary },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 42,
          color: color.secondaryText,
          fontSize: "0.8125rem",
          fontWeight: 500,
          textTransform: "none",
          "&.Mui-selected": { color: color.primary, fontWeight: 600 },
        },
      },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: radius.lg } } },
  },
});

