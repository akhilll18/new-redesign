// Inbox & notifications in one place (v10.1): tab 1 "Inbox" — what is waiting on you and your own requests
// (employees: team approvals + my requests; admins: approvals for their modules; Super Admin: escalated / all requests);
// tab 2 "Notifications" — every update posted to you. /inbox and /notifications both open this page on the right tab,
// so the bell, notification links and AI shortcuts keep working.
import React from "react";
import { Box, Chip, Stack, Tab, Tabs } from "@mui/material";
import { InboxRounded, NotificationsRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader } from "../../components/kit/UI.jsx";
import InboxPage from "./InboxPage.jsx";
import NotificationsPage from "../NotificationsPage.jsx";
import ApprovalsPage from "../requests/ApprovalsPage.jsx";
import { tabSx } from "../../components/suite/Hub.jsx";
import { DocRequestsPage } from "../suite/MyFiles.jsx";
import { ItPurchaseApprovals, itBuyCount, buyStageFor } from "../v106/ItAdmin.jsx";
import { isContingent } from "../../data/employeeFields.js";
import { DescriptionRounded, ShoppingCartRounded } from "@mui/icons-material";

// v10.6: one Inbox screen per role — approvals (the former "All approvals"), notifications, document requests
// (employees on payroll) and IT purchase approvals (IT, HR, Finance) are tabs here, so there is no separate side panel.
import { SelfRequestsAdmin, selfReqCount, WhatsAppLeaveCard } from "../v106/SelfService.jsx";
import { PeopleAltRounded } from "@mui/icons-material";
const ROUTE = { inbox: "/inbox", notifications: "/notifications", docreq: "/doc-requests", purchase: "/it-purchase", empreq: "/emp-requests" };

export function inboxCount(data, user, { pendingForManager, pendingForAdmin }) {
  if (user.role === "emp") { const p = pendingForManager(user.employee_code); return p.requests.length + p.points.length; }
  if (user.role === "admin") { const p = pendingForAdmin(user); return p.requests.length + p.points.length + p.accounts.length + p.payouts.length; }
  return data.requests.filter((r) => r.status === "Pending" && !r.steps.some((st) => st.status === "pending" && st.approver)).length;
}

function Label({ icon, text, count, tone }) {
  return (
    <Stack direction="row" spacing={0.8} sx={{ alignItems: "center" }}>
      {icon}
      <span>{text}</span>
      {count > 0 && <Chip size="small" label={count} sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700, bgcolor: tone, color: "#fff" }} />}
    </Stack>
  );
}

export default function InboxHub({ tab = "inbox" }) {
  const store = useStore();
  const { data, user } = store;
  const navigate = useNavigate();
  const pending = inboxCount(data, user, store);
  const unread = data.notifications.filter((n) => n.to === user.code && !n.read).length;
  const me = user.role === "emp" ? data.employees.find((e) => e.employee_code === user.employee_code) : null;
  const showDocs = user.role === "emp";
  const docs = (data.docRequests || []).filter((r) => r.status === "open" && r.recipients.some((p) => p.code === user.employee_code && p.status === "pending")).length;
  const showBuy = user.role !== "emp" && !!buyStageFor(user);
  const buys = showBuy ? itBuyCount(data, user) : 0;
  const showEmpReq = user.role === "superadmin" || (user.role === "admin" && ["hr", "hr_finance"].includes(user.access_profile || ((user.modules || []).includes("accounts") ? "hr" : "")));
  const empReq = showEmpReq ? selfReqCount(data) : 0;
  const subtitle = tab === "inbox"
    ? user.role === "emp" ? "Approvals waiting on you and every request you have made — who it is with and what happened."
      : user.role === "admin" ? "Everything that has reached you for a decision: leave, expenses, advances, loans, corrections, assets and new accounts. Use the Approved / all tab and its status drop-down for history."
        : "Requests that need Super Admin sign-off, and every request across the company."
    : tab === "docreq" ? "Documents HR or Finance asked you for (for example income-tax proofs). Upload them here."
      : tab === "purchase" ? "IT purchase requests at your stage: IT reviews, then HR, then Finance."
        : tab === "empreq" ? "Bank-details changes and learning requests raised by employees."
        : "Every change to your requests, approvals, payslips, filings and accounts is posted here.";
  // v10.7: Inbox, Notifications, Document requests, IT purchases and Employee requests are items in the side bar,
  // so this screen shows only the selected one (no row of tabs).
  const TITLE = { inbox: user.role === "emp" ? "Inbox" : "Inbox · approvals", notifications: `Notifications${unread ? ` · ${unread} unread` : ""}`, docreq: `Document requests${docs ? ` · ${docs} to upload` : ""}`, purchase: `IT purchases${buys ? ` · ${buys} waiting` : ""}`, empreq: `Employee requests${empReq ? ` · ${empReq} waiting` : ""}` };
  return (
    <>
      <PageHeader title={TITLE[tab] || "Inbox"} subtitle={subtitle} />
      {tab === "inbox" && (user.role === "emp" ? <InboxPage embedded /> : <><WhatsAppLeaveCard approver /><ApprovalsPage mode={user.role === "admin" ? "admin" : "super"} /></>)}
      {tab === "purchase" && <ItPurchaseApprovals embedded />}
      {tab === "docreq" && <DocRequestsPage embedded />}
      {tab === "empreq" && <SelfRequestsAdmin />}
      {tab === "notifications" && <NotificationsPage embedded />}
    </>
  );
}
