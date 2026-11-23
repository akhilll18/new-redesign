// Ezyo brand re-skin, applied at build time so the existing source files keep their original colours.
// Palette, in order of use:
//   1. major dark teal  #004A77  (the "EZY" letters of the Ezyo logo)
//   2. Glob colour      #F48A3E  (the orange "Glob" of the EzyGlob wordmark)
//   3. bright teal      #10FCBE  (the highlight of the Ezyo glob); #0A9E78 is its deep shade, used where text must stay readable
// Every colour in src/**/*.{js,jsx,css} is mapped from the original PeopleHub forest-green palette:
//   • key brand colours are mapped exactly (EXACT below);
//   • dark greens become Ezyo dark teal; mid, bright and "success" greens become the bright-teal family;
//   • the old coral / peach accents (secondary colour, badges, banner highlights) become the Glob orange;
//   • green-tinted greys become cool greys tinted with the Ezyo dark-teal hue.
// Saffron #C77B1C marks "due soon" / "outside geofence", so it stays amber except in the AI gradient.
// Warning (amber), error (red) and info (blue) colours are left as they are so status meaning is preserved.
// Turn it off with  EZYO_BRAND=off npm run dev  to see the original PeopleHub colours.

export const EZYO = {
  navy: "#004A77", // major dark teal
  navyDeep: "#003A5E",
  navyInk: "#00263F",
  glob: "#F48A3E", // Glob colour (orange)
  mint: "#10FCBE", // bright teal
  mintDeep: "#0A9E78", // bright teal, deep shade for text / icons on white
  mintMid: "#0CC596",
};

const EXACT = {
  // primary / sidebar
  "#27614e": "#004a77", // primary main
  "#1e493a": "#003a5e", // primary dark / sidebar
  "#315f49": "#00507f",
  "#234d3d": "#003f66",
  "#244d3d": "#003f66",
  "#466d50": "#0a5e8a",
  "#274f3c": "#004068",
  "#41654a": "#05578a",
  "#2b5540": "#004470",
  // teal accents → bright-teal family
  "#2e8c7a": "#0a9e78", // bright teal, deep shade
  "#25a582": "#0cc596",
  "#4cc3a5": "#0cc596",
  "#9fe3c9": "#7ff9d9", // light bright-teal
  "#b7edd8": "#aefbe6",
  "#9fd7a7": "#10fcbe", // "clocked in" dot on dark banner
  // glass "forest" darks → Ezyo ink
  "#0f2e25": "#00263f",
  "#12352b": "#002d4a",
  "#0b231c": "#001c30",
  // primary light tints
  "#e8f2ec": "#e3f0f7",
  "#eaf2ed": "#e3f0f7",
  "#eaf2ec": "#e3f0f7",
  // decorative coral / peach / warm accents → Glob orange
  "#d77654": "#f48a3e", // secondary colour, nav badge counts, notification dot
  "#f0a07e": "#f48a3e", // welcome-banner accent text & orbit dots
  "#f1a17c": "#f48a3e", // "not clocked in" dot on the welcome banner
  "#f2b35b": "#f48a3e", // glass dashboard warm accent
  // old ONAS tokens, in case any slipped through
  "#124554": "#004a77",
  "#0b2f3a": "#003a5e",
  "#082630": "#00263f",
  "#1a8c8c": "#0a9e78",
  "#22b7a6": "#0cc596",
  "#3ee8b0": "#10fcbe",
  "#163a44": "#003a5e",
  "#0d3442": "#002d4a",
  "#0d3542": "#002d4a",
  "#123b47": "#003d63",
  "#12354a": "#003557",
  "#1f3d48": "#0a3d5c",
  "#051c24": "#001c30",
  "#e6f8f2": "#e3fdf6",
  "#fff0e9": "#fef0e6", // warm tints → Glob orange tints
  "#fbf0e9": "#fef0e6",
};

// Ezyo target colours are final: never re-map them (otherwise a second pass would shift #10FCBE / #0ABFA7).
for (const v of [...Object.values(EXACT), ...Object.values(EZYO)]) EXACT[v.toLowerCase()] = v.toLowerCase();

// v10.3 look & feel — dark · light blue · teal · mint (#0FFCBE), taken from the Ezyo logo:
//   dark   #15414F (the EZYO letters)        light blue #1E9BD7 (accents, badges; tint #E6F4FB)
//   teal   #0B8C8C / #006285 (glob shading)  mint       #0FFCBE (glob highlight; tint #E2FEF6)
// Applied as a last step to every colour above, so the whole app moves from the v10 navy/orange to this palette.
export const V103 = {
  "#004a77": "#15414f", "#003a5e": "#0e2f3a", "#00263f": "#0a222b", "#00507f": "#1a4d5d", "#003f66": "#123a47",
  "#0a5e8a": "#006285", "#004068": "#133d4a", "#05578a": "#006285", "#004470": "#15414f", "#003d63": "#123a47",
  "#003557": "#10333f", "#002d4a": "#0d2c37", "#001c30": "#081c24", "#0a3d5c": "#123a47", "#e3f0f7": "#e6f4fb",
  "#f48a3e": "#1e9bd7", "#fef0e6": "#e6f4fb", "#c8601c": "#1577b0", "#b4561a": "#1577b0",
  "#10fcbe": "#0ffcbe", "#0a9e78": "#0b8c8c", "#0cc596": "#12c9a8", "#e3fdf6": "#e2fef6", "#557385": "#4f6f7a",
};
const FINAL = new Set([...Object.values(V103), "#0ffcbe", "#15414f", "#0b8c8c", "#1e9bd7", "#006285", "#e6f4fb", "#e2fef6", "#12c9a8"]);

// Third-party brand colours (video-call providers, chart series) are not ours to re-skin.
const KEEP = new Set(["#07c160", "#00897b", "#008300", "#1baf7a", "#2a78d6", "#eb6834", "#eda100", "#e87ba4", "#6250d6"]);

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255));
}
const toHex = ([r, g, b]) => "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function ezyoColor(hex) {
  const key = hex.toLowerCase();
  if (FINAL.has(key)) return key;
  const out = baseColor(key);
  return V103[out] || retint(out);
}
// Colours computed from the hue rules (dark teal hue 203) are nudged to the logo's dark-teal hue (195).
function retint(hex) {
  if (FINAL.has(hex)) return hex;
  const [h, s, l] = hexToHsl(hex);
  if (h >= 200 && h <= 206 && s > 0.35) return toHex(hslToRgb(193, Math.min(s, 0.62), l));
  return hex;
}
function baseColor(hex) {
  const key = hex.toLowerCase();
  if (V103[key]) return key;
  if (EXACT[key]) return EXACT[key];
  if (KEEP.has(key)) return hex;
  const [h, s, l] = hexToHsl(key);
  if (h < 75 || h > 178 || s < 0.03 || l > 0.985 || l < 0.02) return hex; // not green: keep
  // green-tinted greys → cool greys carrying the Ezyo dark-teal hue
  if (s < 0.2) return toHex(hslToRgb(203, clamp(s * 1.5 + 0.06, 0.08, 0.3), l));
  // bright, light greens → bright-teal family (#10FCBE, hue 164)
  if (l > 0.55 && s > 0.45) return toHex(hslToRgb(164, Math.max(s, 0.75), l));
  // success greens → bright-teal family, kept readable
  if (h >= 95 && h <= 145) return toHex(hslToRgb(164, clamp(s * 1.25, 0.35, 0.95), l));
  // dark brand greens → major dark teal (#004A77, hue 203)
  if (l < 0.33) return toHex(hslToRgb(203, clamp(s * 1.6, 0.45, 1), l));
  // mid / light brand greens → bright-teal family (hue 164)
  return toHex(hslToRgb(164, clamp(s * 1.3, 0.3, 0.95), l));
}

function recolor(code) {
  return code
    // AI gradient: dark teal → Glob orange → bright teal (saffron #C77B1C elsewhere stays amber = "warning / due soon")
    .replace(/#27614e 0%,\s*#2E8C7A 45%,\s*#C77B1C 100%/gi, "#15414F 0%, #1E9BD7 50%, #0FFCBE 100%")
    .replace(/#[0-9a-fA-F]{6}\b/g, (m) => ezyoColor(m))
    .replace(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*[\d.]+\s*)?\)/g, (m, r, g, b, a) => {
      const hex = toHex([+r, +g, +b]);
      const n = ezyoColor(hex);
      if (n === hex) return m;
      const [R, G, B] = [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16));
      return a ? `rgba(${R},${G},${B}${a})` : `rgb(${R},${G},${B})`;
    })
    // CSS space-separated syntax: rgb(30 46 34 / 2%)
    .replace(/rgb\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(\s*\/\s*[\d.]+%?)?\s*\)/g, (m, r, g, b, a) => {
      const hex = toHex([+r, +g, +b]);
      const n = ezyoColor(hex);
      if (n === hex) return m;
      const [R, G, B] = [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16));
      return `rgb(${R} ${G} ${B}${a || ""})`;
    });
}

export default function ezyoBrand() {
  const off = process.env.EZYO_BRAND === "off";
  return {
    name: "ezyo-brand",
    enforce: "pre",
    transform(code, id) {
      if (off) return null;
      const file = id.split("?")[0].replace(/\\/g, "/");
      if (!/\/src\/.*\.(jsx?|css)$/.test(file) || file.includes("/node_modules/") || file.includes("/src/country/") || file.endsWith("companyLogo.js")) return null;
      const out = recolor(code);
      return out === code ? null : { code: out, map: null };
    },
    transformIndexHtml(html) {
      if (off) return html;
      return html
        .replace(/<meta name="theme-color" content="[^"]*"/, '<meta name="theme-color" content="#15414F"')
        .replace(/<title>[^<]*<\/title>/, "<title>Ezyo · everything made ezy — AI-enabled HRMS</title>");
    },
  };
}

export { recolor };
