// EZY HR brand marks — "AI-enabled HRMS by Ezyo". Drawn as vector shapes (no web font needed) in the Ezyo palette:
// deep navy for EZY, the Ezyo mint→teal gradient for HR, with the Ezyo swirl as the symbol.
import React, { useId } from "react";
import { Box, Typography } from "@mui/material";
import { EZYO_LOGO, EZYO_LOGO_LIGHT, EZYO_ICON } from "../../data/ezyoLogo.js";

export const EZY = { navy: "#17404D", teal: "#0B8C8C", mint: "#2EE6B5", mintSoft: "#E6F7F2" };
export const EZYHR_NAME = "EZY HR";
export const EZYHR_SUBTAG = "AI-enabled HRMS";

/** Wordmark: E (three bars, as in the Ezyo mark) Z Y in navy, HR in the Ezyo gradient. viewBox 0 0 262 80. */
export function EzyHrWordmark({ height = 30, light = false, sx }) {
  const gid = `ezyhr-g-${useId().replace(/:/g, "")}`;
  const ink = light ? "#FFFFFF" : EZY.navy;
  return (
    <Box component="svg" viewBox="0 0 262 80" role="img" aria-label="EZY HR" sx={{ height, width: "auto", display: "block", ...sx }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={EZY.mint} />
          <stop offset="1" stopColor={EZY.teal} />
        </linearGradient>
      </defs>
      <g fill={ink}>
        <rect x="0" y="12" width="40" height="13" rx="1.5" />
        <rect x="0" y="33.5" width="40" height="13" rx="1.5" />
        <rect x="0" y="55" width="40" height="13" rx="1.5" />
        <polygon points="48,12 93,12 93,25 67,55 93,55 93,68 48,68 48,55 74,25 48,25" />
        <polygon points="98,12 114,12 123,32 132,12 148,12 130,44 130,68 116,68 116,44" />
      </g>
      <g fill={`url(#${gid})`}>
        <rect x="162" y="12" width="13" height="56" rx="1.5" />
        <rect x="193" y="12" width="13" height="56" rx="1.5" />
        <rect x="162" y="33.5" width="44" height="13" />
        <path d="M214 12 H238 C251 12 259 20 259 30 C259 40 251 48 238 48 H227 V36 H237 C242 36 245 33.5 245 30 C245 26.5 242 24 237 24 H227 V68 H214 Z" />
        <polygon points="233,44 248,44 261,68 245,68" />
      </g>
    </Box>
  );
}

/** Symbol: the Ezyo swirl. */
export function EzyHrSymbol({ size = 34, sx }) {
  return <Box component="img" src={EZYO_ICON} alt="EZY HR" sx={{ width: size, height: size, display: "block", borderRadius: 1, ...sx }} />;
}

/** Full lockup: wordmark (no swirl symbol in front, so it reads "EZY HR"), with the sub-tag "AI-enabled HRMS by [Ezyo logo]". */
export function EzyHrLockup({ height = 30, light = false, sx, subtag = true, align = "left" }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", ...sx }}>
      <EzyHrWordmark height={height} light={light} />
      {subtag && (
        <Typography component="div" sx={{ mt: `${Math.round(height * 0.22)}px`, display: "flex", alignItems: "center", gap: 0.6,  fontWeight: 700, fontSize: Math.max(9, Math.round(height * 0.33)), letterSpacing: "0.02em", color: light ? "rgba(255,255,255,0.85)" : EZY.navy, whiteSpace: "nowrap" }}>
          {EZYHR_SUBTAG} <Box component="span" sx={{ color: light ? "rgba(255,255,255,0.65)" : "#6c7f86", fontWeight: 600 }}>by</Box>
          <Box component="img" src={light ? EZYO_LOGO_LIGHT : EZYO_LOGO} alt="Ezyo" sx={{ height: Math.max(10, Math.round(height * 0.4)), display: "block" }} />
        </Typography>
      )}
    </Box>
  );
}

// v10.7.1 · IT admin sign-ins are branded "EZY Service Desk".
export const EZYSD_NAME = "EZY Service Desk";
export const EZYSD_SUBTAG = "AI Enabled Service Desk";

/** Wordmark: the same EZY letters in navy/white, then "Service Desk" in the Ezyo mint→teal gradient. */
export function EzyServiceDeskWordmark({ height = 30, light = false, sx }) {
  const gid = `ezysd-g-${useId().replace(/:/g, "")}`;
  const ink = light ? "#FFFFFF" : EZY.navy;
  return (
    <Box component="svg" viewBox="0 0 470 80" role="img" aria-label={EZYSD_NAME} sx={{ height, width: "auto", display: "block", ...sx }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={EZY.mint} />
          <stop offset="1" stopColor={EZY.teal} />
        </linearGradient>
      </defs>
      <g fill={ink}>
        <rect x="0" y="12" width="40" height="13" rx="1.5" />
        <rect x="0" y="33.5" width="40" height="13" rx="1.5" />
        <rect x="0" y="55" width="40" height="13" rx="1.5" />
        <polygon points="48,12 93,12 93,25 67,55 93,55 93,68 48,68 48,55 74,25 48,25" />
        <polygon points="98,12 114,12 123,32 132,12 148,12 130,44 130,68 116,68 116,44" />
      </g>
      <text x="162" y="64" fill={`url(#${gid})`} style={{  fontWeight: 800, fontSize: 62, letterSpacing: "-1.5px" }} textLength="305" lengthAdjust="spacingAndGlyphs">Service Desk</text>
    </Box>
  );
}

/** Full Service Desk lockup with the sub-tag "AI Enabled Service Desk by [Ezyo logo]". */
export function EzyServiceDeskLockup({ height = 30, light = false, sx, subtag = true, align = "left" }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", ...sx }}>
      <EzyServiceDeskWordmark height={height} light={light} />
      {subtag && (
        <Typography component="div" sx={{ mt: `${Math.round(height * 0.22)}px`, display: "flex", alignItems: "center", gap: 0.6,  fontWeight: 700, fontSize: Math.max(9, Math.round(height * 0.36)), color: light ? "rgba(255,255,255,0.85)" : EZY.navy, whiteSpace: "nowrap" }}>
          {EZYSD_SUBTAG} <Box component="span" sx={{ color: light ? "rgba(255,255,255,0.65)" : "#6c7f86", fontWeight: 600 }}>by</Box>
          <Box component="img" src={light ? EZYO_LOGO_LIGHT : EZYO_LOGO} alt="Ezyo" sx={{ height: Math.max(10, Math.round(height * 0.4)), display: "block" }} />
        </Typography>
      )}
    </Box>
  );
}

/** Picks the right brand: EZY Service Desk for IT, EZY HR for everyone else. */
export function BrandLockup({ it = false, ...props }) {
  return it ? <EzyServiceDeskLockup {...props} /> : <EzyHrLockup {...props} />;
}
export const brandName = (it) => (it ? EZYSD_NAME : EZYHR_NAME);
