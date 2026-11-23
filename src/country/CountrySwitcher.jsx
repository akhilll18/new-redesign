// Header control: choose all countries, a whole region (AMER, EMEA, ASIA, AFRICA) or one country.
// Employees see their own country (read-only).
import React, { useState } from "react";
import { Box, Divider, ListSubheader, Menu, MenuItem, Stack, Tooltip, Typography } from "@mui/material";
import { ExpandMoreRounded, CheckRounded } from "@mui/icons-material";
import { useStore } from "../store/AppStore.jsx";
import { useCountry } from "./CountryContext.jsx";
import { PACKS, packFor, countryOf, REGION_INFO, REGION_ORDER, countriesIn } from "./countryPacks.js";
import { ONAS } from "./brand.js";

export default function CountrySwitcher() {
  const { data } = useStore();
  const { scope, setScope, country, region, locked } = useCountry();
  const [anchor, setAnchor] = useState(null);
  const p = country ? packFor(country) : null;
  const count = (cc) => data.employees.filter((e) => e.status === "active" && countryOf(e) === cc).length;
  const pick = (v) => { setScope(v); setAnchor(null); };
  const label = p ? `${p.name} · ${p.currency}` : region ? `${region} · ${countriesIn(region).length} countries` : "All countries";
  const icon = p ? p.flag : region ? REGION_INFO[region].emoji : "🌐";
  return (
    <>
      <Tooltip title={locked ? "Your pay, leave, holidays and AI answers follow your country's rules" : "Switch payroll, leave, holidays, compliance and AI to a region or a country"}>
        <Stack
          direction="row"
          spacing={0.8}
          role={locked ? undefined : "button"}
          aria-label="Operating country"
          onClick={(e) => !locked && setAnchor(e.currentTarget)}
          sx={{ alignItems: "center", height: 34, px: 1.2, borderRadius: 99, border: `1px solid ${ONAS.line}`, background: country || region ? ONAS.mintSoft : "#fff", cursor: locked ? "default" : "pointer", "&:hover": locked ? {} : { borderColor: ONAS.teal } }}
        >
          <Box sx={{ fontSize: "1rem", lineHeight: 1 }}>{icon}</Box>
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            <Typography sx={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.08em", color: ONAS.muted, lineHeight: 1.1 }}>{region ? "REGION" : "COUNTRY"}</Typography>
            <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: ONAS.navy, lineHeight: 1.2 }}>{label}</Typography>
          </Box>
          {!locked && <ExpandMoreRounded sx={{ fontSize: 16, color: ONAS.muted }} />}
        </Stack>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { width: 290, maxHeight: 520 } } }}>
        <MenuItem selected={scope === "ALL"} onClick={() => pick("ALL")} sx={{ fontSize: "0.72rem", gap: 1 }}>
          <span>🌐</span> <Box sx={{ flex: 1 }}>All countries (global)</Box> {scope === "ALL" && <CheckRounded sx={{ fontSize: 16, color: ONAS.teal }} />}
        </MenuItem>
        {REGION_ORDER.map((r) => [
          <Divider key={`d-${r}`} />,
          <ListSubheader key={`h-${r}`} sx={{ fontSize: "0.55rem", fontWeight: 800, letterSpacing: "0.1em", lineHeight: "26px", color: ONAS.muted }}>{r} · {REGION_INFO[r].name.toUpperCase()}</ListSubheader>,
          <MenuItem key={`r-${r}`} selected={scope === `REGION:${r}`} onClick={() => pick(`REGION:${r}`)} sx={{ fontSize: "0.72rem", gap: 1, fontWeight: 700, color: ONAS.navy }}>
            <span>{REGION_INFO[r].emoji}</span>
            <Box sx={{ flex: 1 }}>Whole {r} region</Box>
            <Typography sx={{ fontSize: "0.6rem", color: ONAS.muted }}>{countriesIn(r).reduce((s, c) => s + count(c), 0)} staff</Typography>
            {scope === `REGION:${r}` && <CheckRounded sx={{ fontSize: 16, color: ONAS.teal }} />}
          </MenuItem>,
          ...countriesIn(r).map((c) => (
            <MenuItem key={c} selected={scope === c} onClick={() => pick(c)} sx={{ fontSize: "0.72rem", gap: 1, pl: 3 }}>
              <span>{PACKS[c].flag}</span>
              <Box sx={{ flex: 1 }}>{packFor(c).name}</Box>
              <Typography sx={{ fontSize: "0.6rem", color: ONAS.muted }}>{count(c)} staff</Typography>
              {scope === c && <CheckRounded sx={{ fontSize: 16, color: ONAS.teal }} />}
            </MenuItem>
          )),
        ])}
      </Menu>
    </>
  );
}
