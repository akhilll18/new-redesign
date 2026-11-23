// Mounts the portal-wide generative AI layer: field assist on every text box, explain-any-selection, and the copilot.
import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore, ROLE_LABEL } from "../../store/AppStore.jsx";
import { navFor, navScreens } from "../../data/roleNav.js";
import AiFieldAssist from "./AiFieldAssist.jsx";
import AiSelection from "./AiSelection.jsx";
import AiCopilot from "./AiCopilot.jsx";

export default function AiLayer() {
  const store = useStore();
  const { user, data, reportsOf } = store;
  const location = useLocation();
  const navigate = useNavigate();
  const route = `${location.pathname}${location.search}`;
  const pageId = location.pathname.split("/")[1] || "";
  const nav = useMemo(() => {
    if (!user) return [];
    const isManager = user.role === "emp" && reportsOf(user.employee_code).length > 0;
    return navScreens(navFor(user.role, isManager, { user, data }));
  }, [user, data, reportsOf]);
  const onNavigate = React.useCallback((to) => navigate(to.startsWith("/") ? to : `/${to}`), [navigate]);
  const page = useMemo(() => {
    if (!user) return { title: "EZY HR", who: "" };
    const isManager = user.role === "emp" && reportsOf(user.employee_code).length > 0;
    const label = navScreens(navFor(user.role, isManager, { user, data })).find((i) => i.id === pageId)?.label || "Home";
    return { title: label, who: `${user.full_name}, ${user.designation || ROLE_LABEL[user.role]}${user.department ? `, ${user.department}` : ""}` };
  }, [user, data, pageId, reportsOf]);
  if (!user) return null;
  return (
    <>
      <AiFieldAssist page={page} />
      <AiSelection page={page} />
      <AiCopilot store={store} route={route} onNavigate={onNavigate} nav={nav} />
    </>
  );
}
