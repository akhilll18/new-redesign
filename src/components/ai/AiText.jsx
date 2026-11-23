// Shared AI bits: the event bus, the sparkle mark, and a tiny renderer for AI replies
// (**bold**, '- ' bullets, line breaks and [[go:/route|Label]] navigation buttons).
import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { AutoAwesomeRounded, NorthEastRounded } from "@mui/icons-material";
import { designTokens } from "../../theme/muiTheme.js";

const { color } = designTokens;

export const AI_EVENT = "peoplehub-ai";
export function openCopilot(prompt, { send = true } = {}) {
  window.dispatchEvent(new CustomEvent(AI_EVENT, { detail: { type: "copilot", prompt, send } }));
}

export const AI_GRADIENT = color.primary;

export function Sparkle({ size = 16, sx }) {
  return <AutoAwesomeRounded sx={{ fontSize: size, ...sx }} />;
}

function inline(text, key) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong> : <React.Fragment key={`${key}-${i}`}>{p}</React.Fragment>));
}

export function AiText({ text, onNavigate, dark, size = "0.72rem" }) {
  const lines = (text || "").split("\n");
  const out = [];
  let list = [];
  const flush = (k) => {
    if (!list.length) return;
    out.push(
      <Box key={`ul-${k}`} component="ul" sx={{ m: 0, pl: 2.2, my: 0.4 }}>
        {list.map((l, i) => (
          <li key={i} style={{ marginBottom: 2 }}>{inline(l, `${k}-${i}`)}</li>
        ))}
      </Box>,
    );
    list = [];
  };
  lines.forEach((raw, i) => {
    const links = [...raw.matchAll(/\[\[go:([^|\]]+)\|([^\]]+)\]\]/g)];
    const line = raw.replace(/\[\[go:[^\]]+\]\]/g, "").replace(/^#{1,4}\s+/, "");
    if (/^\s*[-*•]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*•]\s+/, ""));
    } else {
      flush(i);
      if (line.trim()) out.push(<Typography key={`p-${i}`} component="div" sx={{ fontSize: size, lineHeight: 1.55, mb: 0.5 }}>{inline(line, `p-${i}`)}</Typography>);
      else if (!links.length) out.push(<Box key={`s-${i}`} sx={{ height: 4 }} />);
    }
    if (links.length) {
      flush(`l${i}`);
      out.push(
        <Box key={`g-${i}`} sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", my: 0.6 }}>
          {links.map((m, j) => (
            <Button key={j} size="small" variant="outlined" endIcon={<NorthEastRounded sx={{ fontSize: 14 }} />} onClick={() => onNavigate?.(m[1].trim())} sx={{ fontSize: "0.62rem", py: 0.2, ...(dark ? { color: "#9FE3C9", borderColor: "rgba(159,227,201,0.5)" } : {}) }}>
              {m[2].trim()}
            </Button>
          ))}
        </Box>,
      );
    }
  });
  flush("end");
  return <Box sx={{ wordBreak: "break-word" }}>{out}</Box>;
}

// Parses "KEY: value" sections used by insight and review replies.
export function parseSections(text, keys) {
  const res = { bullets: [] };
  let current = null;
  (text || "").split("\n").forEach((line) => {
    const m = line.match(/^\s*([A-Z]{3,20}):\s*(.*)$/);
    if (m && keys.includes(m[1])) {
      current = m[1];
      res[current] = m[2].trim();
    } else if (/^\s*[-*•]\s+/.test(line)) {
      res.bullets.push(line.replace(/^\s*[-*•]\s+/, "").trim());
    } else if (current && line.trim() && !res[current]) {
      res[current] = line.trim();
    }
  });
  return res;
}
