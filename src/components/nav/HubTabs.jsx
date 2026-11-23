// v10.4: sub-tabs for the sidebar hub that owns the current screen (one row, scrollable on phones).
import React from "react";
import { Badge, Box, Tab, Tabs } from "@mui/material";
import { designTokens } from "../../theme/muiTheme.js";

const { color } = designTokens;

export default function HubTabs({ hub, page, onNavigate, badgeValue = () => 0 }) {
  if (!hub?.tabs || hub.tabs.length < 2) return null;
  const current = hub.tabs.find((t) => t.id === page || (t.alias || []).includes(page))?.id || false;
  return (
    <Box data-hub-tabs sx={{ mb: 2.2, mx: { xs: -0.5, md: 0 }, borderBottom: `1px solid ${color.border}`, background: color.card, borderRadius: "12px 12px 0 0", px: 0.5 }}>
      <Tabs
        value={current}
        onChange={(_, v) => onNavigate(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label={`${hub.label} sections`}
        sx={{ minHeight: 46, "& .MuiTab-root": { minHeight: 46, fontSize: "0.8125rem", fontWeight: 500, textTransform: "none", px: 1.8, color: color.secondaryText }, "& .Mui-selected": { color: `${color.primary} !important` }, "& .MuiTabs-indicator": { background: color.primary, height: 2, borderRadius: 2 } }}
      >
        {hub.tabs.map((t) => {
          const n = t.badge ? badgeValue(t.badge) : 0;
          return <Tab key={t.id} value={t.id} label={n ? <Badge badgeContent={n} max={99} sx={{ "& .MuiBadge-badge": { right: -10, top: 2, fontSize: "0.5rem", height: 15, minWidth: 15, bgcolor: color.primary, color: "#ffffff" } }}>{t.label}</Badge> : t.label} />;
        })}
      </Tabs>
    </Box>
  );
}
