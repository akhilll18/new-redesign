import React from "react";
import { PageHeader } from "../../components/kit/UI.jsx";
import ApprovalsPage from "../requests/ApprovalsPage.jsx";
import { useStore } from "../../store/AppStore.jsx";

export default function AllRequests() {
  const { user } = useStore();
  // v10.3: HR admins get the same organisation-wide view, read-only.
  if (user?.role === "admin") {
    return (
      <>
        <PageHeader eyebrow="OVERSIGHT" title="All requests" subtitle="Every leave, expense, advance, loan, attendance correction and asset request across all modules and departments — including Finance's. Read-only: each request is still decided by its own approver." />
        <ApprovalsPage mode="oversight" />
      </>
    );
  }
  return (
    <>
      <PageHeader eyebrow="SUPER ADMIN · OVERSIGHT" title="All requests" subtitle="Leave, expenses, advances, loans, attendance corrections and asset requests across the organisation. “Needs you” holds escalations and requests with no available approver. Any request can be overridden with an audit note." />
      <ApprovalsPage mode="super" />
    </>
  );
}
