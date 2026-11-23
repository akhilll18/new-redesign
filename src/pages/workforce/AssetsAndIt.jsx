// Employee self-service: "My assets & IT support" on one page (two tabs). /assets opens assets, /it-support opens IT.
import React from "react";
import { Box, Tab, Tabs } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader } from "../../components/kit/UI.jsx";
import MyAssets from "./MyAssets.jsx";
import ItSupportPage from "../../components/collab/ItSupport.jsx";
import { IT_OPEN } from "../../lib/itdesk.js";

export default function AssetsAndIt() {
  const { data, user } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = location.pathname.startsWith("/it-support") ? "it" : "assets";
  const assets = data.assets.filter((a) => a.assigned_to === user.employee_code).length;
  const openIt = (data.itTickets || []).filter((t) => t.requester === user.code && IT_OPEN.includes(t.status)).length;
  return (
    <>
      <PageHeader eyebrow="CORE HR · ME" title="My assets & IT support" subtitle="Your laptop, phone and other equipment, and help when something isn't working, in one place." />
      <Box sx={{ borderBottom: "1px solid #e5eae4", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => navigate(v === "it" ? "/it-support" : "/assets")}>
          <Tab value="assets" label={`My assets (${assets})`} sx={{ fontSize: "0.7rem" }} />
          <Tab value="it" label={`IT support${openIt ? ` · ${openIt} open` : ""}`} sx={{ fontSize: "0.7rem" }} />
        </Tabs>
      </Box>
      {tab === "assets" ? <MyAssets embedded /> : <ItSupportPage embedded />}
    </>
  );
}
