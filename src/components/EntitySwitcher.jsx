// Header control: narrow the whole application to one company (legal entity) and, optionally, one location.
// Admins and the Super Admin only; admins see just the companies and locations they have been given.
import React, { useState } from "react";
import { Box, Divider, ListSubheader, Menu, MenuItem, Stack, Tooltip, Typography } from "@mui/material";
import { ExpandMoreRounded, CheckRounded, BusinessRounded, PlaceRounded } from "@mui/icons-material";
import { useStore } from "../store/AppStore.jsx";
import { ALL, scopeLabel } from "../data/entities.js";
import { ONAS } from "../country/brand.js";
import { canSwitchEntity } from "../lib/statutory.js";

export default function EntitySwitcher() {
  const { user, allData, entityScope, setEntityScope, entityAccess } = useStore();
  const [anchor, setAnchor] = useState(null);
  if (!user || !canSwitchEntity(user)) return null;
  const { companies, locations } = entityAccess;
  if (!companies.length) return null;
  const restricted = companies.length < (allData.companies || []).length || locations.length < (allData.workLocations || []).length;
  const company = companies.some((c) => c.company_id === entityScope.company) ? entityScope.company : ALL;
  const location = locations.some((l) => l.location_id === entityScope.location) ? entityScope.location : ALL;
  const label = scopeLabel({ company, location }, companies, locations);
  const staff = (pred) => allData.employees.filter((e) => e.status === "active" && pred(e)).length;
  const active = company !== ALL || location !== ALL;
  const pick = (v) => { setEntityScope(v); setAnchor(null); };
  const shownCompanies = company === ALL ? companies : companies.filter((c) => c.company_id === company);

  return (
    <>
      <Tooltip title="Show the whole application for one company and location — people, approvals, attendance, payroll, expenses and reports">
        <Stack direction="row" spacing={0.8} role="button" aria-label="Company and location" onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ alignItems: "center", height: 34, px: 1.2, borderRadius: 99, border: `1px solid ${ONAS.line}`, background: active ? ONAS.mintSoft : "#fff", cursor: "pointer", maxWidth: 260, "&:hover": { borderColor: ONAS.teal } }}>
          <BusinessRounded sx={{ fontSize: 17, color: ONAS.navy }} />
          <Box sx={{ display: { xs: "none", sm: "block" }, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.08em", color: ONAS.muted, lineHeight: 1.1 }}>{label.company.toUpperCase()}{restricted ? " · LIMITED" : ""}</Typography>
            <Typography noWrap sx={{ fontSize: "0.68rem", fontWeight: 700, color: ONAS.navy, lineHeight: 1.2 }}>{label.location}</Typography>
          </Box>
          <ExpandMoreRounded sx={{ fontSize: 16, color: ONAS.muted }} />
        </Stack>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { width: 320, maxHeight: 560 } } }}>
        <ListSubheader sx={{ fontSize: "0.55rem", fontWeight: 800, letterSpacing: "0.1em", lineHeight: "26px", color: ONAS.muted }}>COMPANY</ListSubheader>
        <MenuItem selected={company === ALL} onClick={() => pick({ company: ALL, location: ALL })} sx={{ fontSize: "0.72rem", gap: 1 }}>
          <BusinessRounded sx={{ fontSize: 16, color: ONAS.muted }} />
          <Box sx={{ flex: 1 }}>{restricted ? "All my companies" : "All companies"}</Box>
          <Typography sx={{ fontSize: "0.6rem", color: ONAS.muted }}>{staff((e) => locations.some((l) => l.location_id === e.location_id))} staff</Typography>
          {company === ALL && <CheckRounded sx={{ fontSize: 16, color: ONAS.teal }} />}
        </MenuItem>
        {companies.map((c) => (
          <MenuItem key={c.company_id} selected={company === c.company_id && location === ALL} onClick={() => pick({ company: c.company_id, location: ALL })} sx={{ fontSize: "0.72rem", gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: "0.72rem", fontWeight: 600 }}>{c.short}</Typography>
              <Typography noWrap sx={{ fontSize: "0.58rem", color: ONAS.muted }}>{c.name} · {c.currency}</Typography>
            </Box>
            <Typography sx={{ fontSize: "0.6rem", color: ONAS.muted }}>{staff((e) => e.company_id === c.company_id && locations.some((l) => l.location_id === e.location_id))}</Typography>
            {company === c.company_id && location === ALL && <CheckRounded sx={{ fontSize: 16, color: ONAS.teal }} />}
          </MenuItem>
        ))}
        <Divider />
        <ListSubheader sx={{ fontSize: "0.55rem", fontWeight: 800, letterSpacing: "0.1em", lineHeight: "26px", color: ONAS.muted }}>LOCATION{company !== ALL ? ` · ${label.company.toUpperCase()}` : ""}</ListSubheader>
        {shownCompanies.map((c) => {
          const ls = locations.filter((l) => l.company_id === c.company_id);
          if (!ls.length) return null;
          return [
            company === ALL && <Typography key={`h-${c.company_id}`} sx={{ px: 2, pt: 0.6, fontSize: "0.56rem", fontWeight: 700, color: ONAS.muted }}>{c.short}</Typography>,
            ...ls.map((l) => (
              <MenuItem key={l.location_id} selected={location === l.location_id} onClick={() => pick({ company: l.company_id, location: l.location_id })} sx={{ fontSize: "0.7rem", gap: 1, pl: 3 }}>
                <PlaceRounded sx={{ fontSize: 15, color: ONAS.muted }} />
                <Box sx={{ flex: 1 }}>{l.name}</Box>
                <Typography sx={{ fontSize: "0.6rem", color: ONAS.muted }}>{staff((e) => e.location_id === l.location_id)}</Typography>
                {location === l.location_id && <CheckRounded sx={{ fontSize: 16, color: ONAS.teal }} />}
              </MenuItem>
            )),
          ];
        })}
      </Menu>
    </>
  );
}
