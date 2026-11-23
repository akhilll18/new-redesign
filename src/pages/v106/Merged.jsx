// v10.6: helpers for screens that were merged. `MergedTabs` shows each former screen as a tab inside one page (keeps
// every feature of the originals); `Stacked` shows them one under the other with a section heading.
import React, { useState } from "react";
import { Box, Chip, Stack, Tab, Tabs, Typography } from "@mui/material";
import { usePageTone } from "../../theme/tones.js";

export function MergedTabs({ tabs, initial, sx }) {
  const list = tabs.filter(Boolean);
  const [tab, setTab] = useState(initial && list.some((t) => t.id === initial) ? initial : list[0]?.id);
  const tone = usePageTone();
  const cur = list.find((t) => t.id === tab) || list[0];
  if (!cur) return null;
  return (
    <Box sx={sx}>
      <Box sx={{ mb: 2, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper", borderRadius: "10px 10px 0 0", px: 0.5 }}>
        <Tabs value={cur.id} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile
          sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontSize: "0.72rem", fontWeight: 700, color: "#5d6b66" }, "& .Mui-selected": { color: `${tone.main} !important` }, "& .MuiTabs-indicator": { background: tone.main, height: 3, borderRadius: 2 } }}>
          {list.map((t) => (
            <Tab key={t.id} value={t.id} label={t.count ? <Stack direction="row" spacing={0.7} sx={{ alignItems: "center" }}><span>{t.label}</span><Chip size="small" label={t.count} sx={{ height: 17, fontSize: "0.58rem", fontWeight: 700, bgcolor: tone.main, color: "#fff" }} /></Stack> : t.label} />
          ))}
        </Tabs>
      </Box>
      {cur.node}
    </Box>
  );
}

export function Stacked({ sections }) {
  const tone = usePageTone();
  return (
    <Stack spacing={3}>
      {sections.filter(Boolean).map((s, i) => (
        <Box key={s.title || i}>
          {s.title && (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.2 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: tone.main }} />
              <Typography sx={{  fontWeight: 800, fontSize: "0.86rem", color: "#17404D" }}>{s.title}</Typography>
              {s.hint && <Typography sx={{ fontSize: "0.65rem", color: "#7b878c" }}>· {s.hint}</Typography>}
            </Stack>
          )}
          {s.node}
        </Box>
      ))}
    </Stack>
  );
}

// Hides the first PageHeader of an embedded screen (used when a merged screen already has its own header).
export function NoHeader({ children }) {
  return <Box sx={{ "& > h1:first-of-type, & > .MuiStack-root:first-of-type:has(> .MuiBox-root > h1)": { display: "none" } }}>{children}</Box>;
}
