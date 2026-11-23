// Ezyo brand tokens, in order of use:
// 1. major dark teal #004A77 (the "EZY" letters), 2. Glob colour #F48A3E (the orange "Glob" of the EzyGlob wordmark),
// 3. bright teal #10FCBE (the glob highlight; #0A9E78 is its deep shade for readable text on white).
// The ONAS export name is kept so existing imports keep working.
export const ONAS = {
  // v10.3 look & feel: dark · light blue · teal · mint (#0FFCBE), from the Ezyo logo.
  navy: "#15414F", // dark (EZYO letters)
  navyDeep: "#0E2F3A",
  navyInk: "#0A222B",
  glob: "#1E9BD7", // light blue accent (was the Glob orange)
  globSoft: "#E6F4FB",
  teal: "#0B8C8C", // teal, readable on white (section labels)
  mintDeep: "#0B8C8C",
  tealBright: "#12C9A8",
  blueTeal: "#006285",
  mint: "#0FFCBE", // mint highlight
  mintSoft: "#E2FEF6",
  muted: "#8a948d",
  mist: "#F2F8FA",
  line: "#D6E6EC",
  gradient: designTokens.color.primary,
};
export const EZYO = ONAS;
import { designTokens } from "../theme/muiTheme.js";

