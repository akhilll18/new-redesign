// v10.6: colour by function. Every sidebar section carries a `tone`; the rail icon, the active item, the sub-menu panel,
// the hub tabs and the page header accent take that section's colour. Light tints keep the existing Ezyo look.
import { createContext, useContext } from "react";

export const TONES = {
  red: { name: "Red", meaning: "Strength, passion, energy", main: "#E53950", rail: "#FF8A98", light: "#FDECEE", mid: "#F8C5CC" },
  orange: { name: "Orange", meaning: "Joy, creativity, stimulation", main: "#F27C22", rail: "#FFB070", light: "#FEF1E6", mid: "#FBD3B3" },
  yellow: { name: "Yellow", meaning: "Happiness, intellect, light", main: "#D99A00", rail: "#FFD45C", light: "#FFF8DB", mid: "#F7E3A1" },
  green: { name: "Green", meaning: "Nature, balance, growth", main: "#1F9D63", rail: "#6EE0A6", light: "#E6F6EE", mid: "#B5E6CD" },
  blue: { name: "Blue", meaning: "Trust, loyalty, calm", main: "#1E88E5", rail: "#7CC0FF", light: "#E7F2FD", mid: "#B9DAF7" },
  purple: { name: "Purple", meaning: "Power, luxury, noble wisdom", main: "#7E57C2", rail: "#C3A6FF", light: "#F1ECFA", mid: "#D6C8F0" },
  pink: { name: "Pink", meaning: "Care, sensitivity, playfulness", main: "#D94F8A", rail: "#FF9CC6", light: "#FDEBF3", mid: "#F5C2D8" },
  brown: { name: "Brown", meaning: "Stability, comfort, reliability", main: "#9C6B45", rail: "#E0B48E", light: "#F6EEE7", mid: "#E4D0BF" },
  black: { name: "Black", meaning: "Elegance, authority, power", main: "#263238", rail: "#CFD8DC", light: "#ECEFF1", mid: "#C9D1D5" },
  gray: { name: "Gray", meaning: "Maturity, intelligence, balance", main: "#66767E", rail: "#B8C4CA", light: "#F0F3F4", mid: "#D5DDE0" },
  white: { name: "White", meaning: "Clarity, purity, minimalism", main: "#0B8C8C", rail: "#FFFFFF", light: "#FFFFFF", mid: "#E1E7EA" },
};

// Which function gets which colour (sidebar hub id → tone). Hubs can also set `tone` directly in roleNav.
export const HUB_TONE = {
  home: "blue", admin: "blue", super: "blue", it: "blue",
  "inbox-hub": "red",
  "oversight-hub": "black", "access-hub": "black", "platform-hub": "black", "global-hub": "black", "compliance-hub": "black",
  "profile-hub": "brown", "corehr-hub": "brown", "my-relocation": "brown", "reloc-hub": "brown",
  "calendar-hub": "blue", "people-hub": "blue",
  "attendance-hub": "yellow", "time-hub": "yellow",
  "talent-hub": "purple", "reports-hub": "purple",
  "pay-hub": "green", "toolkit-hub": "green",
  "support-hub": "pink", "team-hub": "pink", chat: "pink",
  "hire-hub": "orange", "ijp-hub": "orange",
  "my-exit": "gray", "approvals-hub": "red", "approvals": "red",
  "it-desk-hub": "red", "it-assets-hub": "brown", "it-purchase-hub": "green",
};

export const toneOf = (key) => TONES[key] || TONES.white;
export const hubTone = (item) => toneOf(item?.tone || HUB_TONE[item?.hub] || HUB_TONE[item?.id]);

export const ToneContext = createContext(TONES.white);
export const usePageTone = () => useContext(ToneContext);
