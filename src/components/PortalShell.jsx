import React, { useEffect, useRef, useState } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton as MuiIconButton,
  InputBase,
  Badge as MuiBadge,
  Popover,
  Divider,
  Stack,
  Menu as MuiMenu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button as MuiButton,
  Tooltip,
  useMediaQuery,
  useTheme,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
} from "@mui/material";
import {
  Home as HomeIcon,
  Inbox as InboxIcon,
  Notifications as NotificationsIcon,
  AccessTime as AccessTimeIcon,
  EventAvailable as EventAvailableIcon,
  Receipt as ReceiptIcon,
  Stars as StarsIcon,
  AccountBalanceWallet as AccountBalanceWalletIcon,
  Person as PersonIcon,
  Groups as GroupsIcon,
  Badge as BadgeIcon,
  AccountTree as AccountTreeIcon,
  Folder as FolderIcon,
  School as SchoolIcon,
  Support as SupportIcon,
  Dashboard as DashboardIcon,
  FactCheck as FactCheckIcon,
  Insights as InsightsIcon,
  ListAlt as ListAltIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Rule as RuleIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Circle as CircleIcon,
  Fingerprint as FingerprintIcon,
  PhoneInTalk as PhoneInTalkIcon,
  Flag as FlagIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  Inventory as InventoryIcon,
  Checklist as ChecklistIcon,
  Place as PlaceIcon,
  Business as BusinessIcon,
  RateReview as RateReviewIcon,
  Work as WorkIcon,
  AutoGraph as AutoGraphIcon,
  VideoLibrary as VideoLibraryIcon,
  Monitor as MonitorIcon,
  Payments as PaymentsIcon,
  Spa as SpaIcon,
  Radar as RadarIcon,
  Shield as ShieldIcon,
  Public as PublicIcon,
  Gavel as GavelIcon,
  ReceiptLong as ReceiptLongIcon,
  HistoryEdu as HistoryEduIcon,
  Forum as ForumIcon,
  CalendarMonth as CalendarMonthIcon,
  Handshake as HandshakeIcon,
  VerifiedUser as VerifiedUserIcon,
  EventNote as EventNoteIcon,
  SupportAgent as SupportAgentIcon,
  Computer as ComputerIcon,
  Assignment as AssignmentIcon,
  PendingActions as PendingActionsIcon,
} from "@mui/icons-material";
const Icons = { Home: HomeIcon, Inbox: InboxIcon, Notifications: NotificationsIcon, AccessTime: AccessTimeIcon, EventAvailable: EventAvailableIcon, Receipt: ReceiptIcon, Stars: StarsIcon, AccountBalanceWallet: AccountBalanceWalletIcon, Person: PersonIcon, Groups: GroupsIcon, Badge: BadgeIcon, AccountTree: AccountTreeIcon, Folder: FolderIcon, School: SchoolIcon, Support: SupportIcon, Dashboard: DashboardIcon, FactCheck: FactCheckIcon, Insights: InsightsIcon, ListAlt: ListAltIcon, AdminPanelSettings: AdminPanelSettingsIcon, Rule: RuleIcon, History: HistoryIcon, Settings: SettingsIcon, Circle: CircleIcon, Fingerprint: FingerprintIcon, PhoneInTalk: PhoneInTalkIcon, Flag: FlagIcon, HealthAndSafety: HealthAndSafetyIcon, Inventory: InventoryIcon, Checklist: ChecklistIcon, Place: PlaceIcon, RateReview: RateReviewIcon, Work: WorkIcon, AutoGraph: AutoGraphIcon, VideoLibrary: VideoLibraryIcon, Monitor: MonitorIcon, Payments: PaymentsIcon, Spa: SpaIcon, Radar: RadarIcon, Shield: ShieldIcon, Public: PublicIcon, Gavel: GavelIcon, ReceiptLong: ReceiptLongIcon, HistoryEdu: HistoryEduIcon, Forum: ForumIcon, CalendarMonth: CalendarMonthIcon, Handshake: HandshakeIcon, VerifiedUser: VerifiedUserIcon, EventNote: EventNoteIcon, SupportAgent: SupportAgentIcon, Computer: ComputerIcon, Assignment: AssignmentIcon, PendingActions: PendingActionsIcon, PhoneIphone: PhoneIphoneIcon, EmojiEvents: EmojiEventsIcon, Schedule: ScheduleIcon, CreditCard: CreditCardIcon, PrivacyTip: PrivacyTipIcon, FlightTakeoff: FlightTakeoffIcon, ExitToApp: ExitToAppIcon, QueryStats: QueryStatsIcon, Policy: PolicyIcon, Tune: TuneIcon, SmartToy: SmartToyIcon, Hub: HubIcon, TaskAlt: TaskAltIcon, RocketLaunch: RocketLaunchIcon, Lock: LockIcon, Business: BusinessIcon, AccountBalance: AccountBalanceIcon, Timeline: TimelineIcon, SwitchAccount: SwitchAccountIcon };
import { Notifications as Bell, Logout as LogOut, Menu, Search, Close as X, TimerOutlined, Key } from "@mui/icons-material";
import { AccountBalance as AccountBalanceIcon, Timeline as TimelineIcon, SwitchAccount as SwitchAccountIcon } from "@mui/icons-material";
import { PhoneIphone as PhoneIphoneIcon, EmojiEvents as EmojiEventsIcon, Schedule as ScheduleIcon, CreditCard as CreditCardIcon, PrivacyTip as PrivacyTipIcon, FlightTakeoff as FlightTakeoffIcon, ExitToApp as ExitToAppIcon, QueryStats as QueryStatsIcon, Policy as PolicyIcon, Tune as TuneIcon, SmartToy as SmartToyIcon, Hub as HubIcon, TaskAlt as TaskAltIcon, RocketLaunch as RocketLaunchIcon, Lock as LockIcon } from "@mui/icons-material";
import { theme } from "../theme.js";
import { designTokens } from "../theme/muiTheme.js";
import { Avatar } from "./PortalUI.jsx";
import { useStore, ROLE_LABEL } from "../store/AppStore.jsx";
import { inboxCount } from "../pages/inbox/InboxHub.jsx";
import { navFor, navScreens, hubFor } from "../data/roleNav.js";
import { canSwitchLocale } from "../lib/statutory.js";
import { applySeo } from "../seo/seo.js";
import { SECTION_DESC } from "../seo/publicPages.js";
import { EzyHrLockup, EzyHrWordmark, EZYHR_NAME, EZYHR_SUBTAG, EzyServiceDeskLockup, EzyServiceDeskWordmark, EZYSD_NAME, EZYSD_SUBTAG } from "./brand/EzyHrLogo.jsx";
import { timeAgo } from "../lib/utils.js";
import { IT_OPEN, slaState } from "../lib/itdesk.js";
import { docChecklist } from "../lib/empdocs.js";
import { totalUnread, bgvStatus, bgvAccessLevel, bgvFor, complianceCalendar } from "../lib/collab.js";
import { payslipWaiting } from "./pay/PayslipViews.jsx";
import { contractsWaiting } from "./contracts/ContractViews.jsx";
import { myContractBadge, approverBadge } from "./contracts/MyContract.jsx";
import ChangePasswordDialog from "./kit/ChangePasswordDialog.jsx";
import HubTabs from "./nav/HubTabs.jsx";
import { hubTone, ToneContext } from "../theme/tones.js";
// Country mode + AI page translation in the header (Super Admin, or admins the Super Admin has enabled)
import CountrySwitcher from "../country/CountrySwitcher.jsx";
import EntitySwitcher from "./EntitySwitcher.jsx";
import AiPageLocalizer from "../country/AiPageLocalizer.jsx";
import { workerTypeOf, WORKER_TYPE_BY } from "../data/employeeFields.js";
import { automationVisible } from "../lib/automation.js";
import { itBuyCount } from "../pages/v106/ItAdmin.jsx";

const PANEL_WIDTH = 196;
const { color, radius } = designTokens;
const RAIL_BG = color.primary;

// Signs the user out after the configured idle time, with a 60-second warning.
function IdleGuard() {
  const { data, touch, logout, session } = useStore();
  const timeoutMs = data.settings.session_timeout_min * 60000;
  const warnMs = Math.min(60000, timeoutMs / 3);
  const last = useRef(Date.now());
  const lastTouch = useRef(0);
  const [left, setLeft] = useState(timeoutMs);
  useEffect(() => {
    const onAct = () => {
      last.current = Date.now();
      if (Date.now() - lastTouch.current > 20000) {
        lastTouch.current = Date.now();
        touch();
      }
    };
    const evs = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, onAct, { passive: true }));
    const t = setInterval(() => {
      const remaining = timeoutMs - (Date.now() - last.current);
      setLeft(remaining);
      if (remaining <= 0) logout(`You were signed out after ${data.settings.session_timeout_min} minutes of inactivity.`);
    }, 1000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, onAct));
      clearInterval(t);
    };
  }, [timeoutMs, touch, logout, data.settings.session_timeout_min]);
  const mins = Math.max(0, Math.floor(left / 60000));
  const secs = Math.max(0, Math.floor((left % 60000) / 1000));
  return (
    <>
      <Tooltip title={`Session ends after ${data.settings.session_timeout_min} min without activity`}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: left < warnMs ? "warning.main" : color.mutedText, display: { xs: "none", sm: "flex" } }}>
          <TimerOutlined sx={{ fontSize: 15 }} />
          <Typography sx={{ fontSize: "0.6rem", fontVariantNumeric: "tabular-nums" }}>
            {mins}:{String(secs).padStart(2, "0")}
          </Typography>
        </Stack>
      </Tooltip>
      <Dialog open={!!session && left > 0 && left < warnMs} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Still there?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "0.75rem" }}>For your security you will be signed out in {secs} seconds.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <MuiButton color="inherit" onClick={() => logout("")}>
            Sign out
          </MuiButton>
          <MuiButton
            variant="contained"
            onClick={() => {
              last.current = Date.now();
              touch();
              setLeft(timeoutMs);
            }}
          >
            Stay signed in
          </MuiButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default function PortalShell({ page, onNavigate, onSearch, children, stage }) {
  const glass = stage === "glass";
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));
  const store = useStore();
  const { user, data, logout, markRead, markAllRead, reportsOf, pendingForManager, pendingForAdmin, session, switchWorkspace, notifyToast } = store;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [pwOpen, setPwOpen] = useState(false);

  if (!user) return null;
  const isManager = user.role === "emp" && reportsOf(user.employee_code).length > 0;
  const origin = session?.origin || null;
  const groups = navFor(user.role, isManager, { user, data, origin });
  const localeOk = canSwitchLocale(user);
  const runAction = (a) => {
    const r = switchWorkspace(a === "switch-back" ? "back" : "emp");
    if (!r.ok) return notifyToast(r.error, "error");
    notifyToast(r.role === "emp" ? "You are in your employee workspace. Use “Back to admin workspace” to return." : "Back in your admin workspace.", "info");
    onNavigate(r.role === "emp" ? "home" : r.role === "superadmin" ? "super" : "admin");
  };
  const mine = data.notifications.filter((n) => n.to === user.code);
  const unread = mine.filter((n) => !n.read).length;
  const badgeValue = (key) => {
    if (key === "unread") return unread;
    if (key === "inbox-all") return unread + inboxCount(data, user, { pendingForManager, pendingForAdmin });
    if (key === "inbox" && user.role === "emp") {
      const p = pendingForManager(user.employee_code);
      return p.requests.length + p.points.length;
    }
    if (key === "admin" && user.role === "admin") {
      const p = pendingForAdmin(user);
      return p.requests.length + p.points.length + p.accounts.length + p.payouts.length;
    }
    if (key === "locked") return [...data.employees, ...data.admins].filter((u) => u.status === "locked").length;
    if (key === "payslips") return payslipWaiting(data, user);
    if (key === "contracts") return contractsWaiting(data, user);
    if (key === "contract-me") return myContractBadge(data, user.employee_code);
    if (key === "ts-approve") return approverBadge(data, user.employee_code);
    if (key === "escalated") return data.requests.filter((r) => r.status === "Pending" && !r.steps.some((st) => st.status === "pending" && st.approver)).length;
    if (key === "chat") return totalUnread(data, user);
    if (key === "it-buy") return itBuyCount(data, user);
    if (key === "notes") return data.notifications.filter((n) => n.to === user.code && !n.read).length;
    if (key === "emp-req") return (data.suite?.selfReq || []).filter((r) => r.status === "pending").length;
    if (key === "automation") return (data.automation?.queue || []).filter((q) => q.status === "review" && automationVisible(q, user)).length;
    if (key === "docreq") return (data.docRequests || []).filter((r) => r.status === "open" && r.recipients.some((p) => p.code === user.employee_code && p.status === "pending")).length;
    if (key === "docs-me") return docChecklist(data, data.employees.find((e) => e.employee_code === user.employee_code)).missing;
    if (key === "it-me") return (data.itTickets || []).filter((t) => t.requester === user.code && (t.status === "waiting_user" || t.status === "resolved")).length;
    if (key === "it-desk") return (data.itTickets || []).filter((t) => IT_OPEN.includes(t.status) && (!t.assigned_to || slaState(t) === "breached" || (t.assigned_to === user.code && t.status === "in_progress" && t.comments.slice(-1)[0]?.by === t.requester))).length;
    if (key === "bgv") return (data.bgv || []).filter((c) => !c.cancelled && ["insufficient", "discrepancy", "consent_pending"].includes(bgvStatus(c)) && bgvAccessLevel(data, user, c) === "full").length;
    if (key === "bgv-me") { const c = bgvFor(data, user.employee_code); return c && (c.consent?.status !== "given" || c.checks.some((k) => k.status === "insufficient")) ? 1 : 0; }
    if (key === "compliance") return complianceCalendar(data).filter((c) => c.status === "overdue" || (c.status === "due_soon" && (user.role === "superadmin" || c.owner === user.code))).length;
    return 0;
  };
  const allItems = navScreens(groups);
  const hub = hubFor(groups, page);
  const hubCount = (item) => (item.badges || (item.badge ? [item.badge] : [])).reduce((t, k) => t + (badgeValue(k) || 0), 0);
  // Shows what kind of worker signed in: Employee, Contract employee, Freelancer, Consultant, Intern…
  const meRec = user.role === "emp" ? data.employees.find((e) => e.employee_code === user.employee_code) : null;
  const roleText = meRec ? WORKER_ROLE_TEXT[workerTypeOf(meRec)] || WORKER_TYPE_BY[workerTypeOf(meRec)]?.short || ROLE_LABEL.emp : user.role === "admin" ? ADMIN_KIND_TEXT[adminKindOf(user)] || ROLE_LABEL.admin : ROLE_LABEL[user.role];
  const QUICK_ICON = { attendance: "Fingerprint", leave: "EventAvailable", inbox: "Inbox", finances: "AccountBalanceWallet", expenses: "Receipt", approvals: "FactCheck", automation: "SmartToy", "payroll-agent": "Payments", requests: "FactCheck", activity: "Timeline" };
  const quick = (QUICK[user.role] || []).map(([id, short]) => { const found = allItems.find((i) => i.id === id); const it = found && { ...found, icon: QUICK_ICON[id] || found.icon }; return it ? { ...it, short: id === "leave" && it.label === "Request leave" ? "Leave" : short } : null; }).filter(Boolean).slice(0, 4);
  // v10.7.1: IT admin sign-ins are branded "EZY Service Desk · AI Enabled Service Desk by Ezyo".
  const isItDesk = user.role === "admin" && adminKindOf(user) === "it";
  const BRAND_NAME = isItDesk ? EZYSD_NAME : EZYHR_NAME;
  const BRAND_SUBTAG = isItDesk ? EZYSD_SUBTAG : EZYHR_SUBTAG;
  // v10.8 SEO: every screen has its own title ("Payslips · Pay & benefits · EZY HR") and description; signed-in screens are noindex.
  const pageLabel = allItems.find((i) => i.id === page || (i.alias || []).includes(page))?.label || hub?.label || "Home";
  useEffect(() => {
    const brand = isItDesk ? EZYSD_NAME : EZYHR_NAME;
    const parts = [pageLabel, hub?.label && hub.label !== pageLabel ? hub.label : null, brand].filter(Boolean);
    applySeo({ title: parts.join(" · "), description: `${pageLabel}${hub?.label && hub.label !== pageLabel ? ` in ${hub.label}` : ""} — ${SECTION_DESC[hub?.id] || `${brand}, ${isItDesk ? EZYSD_SUBTAG : EZYHR_SUBTAG} by Ezyo.`}`, index: false });
  }, [isItDesk, pageLabel, hub?.id, hub?.label]);
  const subtitle = user.role === "emp" ? user.designation : user.role === "admin" ? `${ADMIN_KIND_TEXT[adminKindOf(user)] || "Admin"} · ${user.modules.length} modules` : "Super Admin · global";

  function submitSearch(e) {
    e.preventDefault();
    onSearch(search.trim());
    setMobileOpen(false);
  }

  // v10.4.1: two-level sidebar — dark main rail (sections) + a sub-menu panel listing the active section's screens.
  const RAIL = collapsed ? 68 : 240;
  const showPanel = !isMobile && !!hub?.tabs && hub.tabs.length > 1;
  const navWidth = RAIL + (showPanel ? PANEL_WIDTH : 0);
  const pill = (n, tone = color.accent) => <Box sx={{ minWidth: 19, height: 19, px: 0.6, borderRadius: 9, background: tone, color: "#ffffff", fontSize: "0.6875rem", fontWeight: 600, display: "grid", placeItems: "center" }}>{n}</Box>;
  const rail = (
    <Box sx={{ width: isMobile ? "100%" : RAIL, flexShrink: 0, display: "flex", flexDirection: "column", height: "100%", p: collapsed ? "18px 8px 12px" : "18px 10px 12px", background: RAIL_BG, color: "#ffffff", overflowY: "auto", transition: "width .18s ease", "&::-webkit-scrollbar": { width: 6 }, "&::-webkit-scrollbar-thumb": { background: color.primaryLight, borderRadius: 3 } }}>
      <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", px: collapsed ? 0.3 : 1, pb: 2.2 }}>
        {isItDesk ? (collapsed ? <EzyServiceDeskWordmark height={9} light /> : <EzyServiceDeskLockup height={22} light />) : (collapsed ? <EzyHrWordmark height={13} light /> : <EzyHrLockup height={24} light />)}
        {isMobile && (
          <MuiIconButton size="small" onClick={() => setMobileOpen(false)} sx={{ ml: "auto", color: "#ffffff" }} aria-label="Close menu">
            <X sx={{ fontSize: 17 }} />
          </MuiIconButton>
        )}
      </Stack>
      {!collapsed && (
        <Box sx={{ mx: 1, mb: 1.8, px: 1, py: 0.65, borderRadius: 1, background: color.primaryLight, color: "#ffffff", fontSize: 11, fontWeight: 600, letterSpacing: "0.045em", alignSelf: "flex-start" }}>
          {roleText.toUpperCase()} VIEW{isManager ? " · MANAGER" : ""}{origin ? ` · ${ROLE_LABEL[origin.role].toUpperCase()} ACCOUNT` : ""}
        </Box>
      )}
      {groups.map((group) => (
        <Box key={group.group || "main"} sx={{ mb: 1.2 }}>
          {!collapsed && group.group && <Typography sx={{ px: 1.2, pb: 0.7, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: color.faintText, textTransform: "uppercase" }}>{group.group}</Typography>}
          <List disablePadding>
            {group.items.map((item) => {
              const Icon = Icons[item.icon] || Icons.Circle;
              const active = !item.action && (page === item.id || (item.alias || []).includes(page));
              const count = hubCount(item);
              const tn = hubTone(item);
              return (
                <React.Fragment key={item.id}>
                  <ListItemButton
                    title={collapsed ? item.label : undefined}
                    onClick={() => {
                      if (item.action) runAction(item.action);
                      else onNavigate(item.id);
                      if (!item.tabs || item.tabs.length < 2 || !isMobile) setMobileOpen(false);
                    }}
                    sx={{ ...(item.action ? { border: `1px dashed ${color.lightSage}` } : {}), position: "relative", minHeight: 36, px: 1.2, borderRadius: `${radius.sm + 2}px`, color: active ? color.primary : "#ffffff", background: active ? color.primarySoft : "transparent", boxShadow: "none", "&:before": active ? { content: '""', position: "absolute", left: 0, top: 7, bottom: 7, width: 3, borderRadius: "0 3px 3px 0", background: color.primary } : undefined, "&:hover": { background: active ? color.primarySoft : color.primaryLight, color: active ? color.primary : "#ffffff" }, mb: 0.4 }}
                  >
                    <ListItemIcon sx={{ minWidth: 32, color: active ? color.primary : tn.rail }}>
                      <MuiBadge color="secondary" variant="dot" invisible={!collapsed || !count}>
                        <Icon sx={{ fontSize: 18 }} />
                      </MuiBadge>
                    </ListItemIcon>
                    <ListItemText sx={{ display: collapsed ? "none" : "block" }} primary={item.label} slotProps={{ primary: { sx: { fontSize: 13, fontWeight: active ? 600 : 500 } } }} />
                    {!collapsed && count > 0 && pill(count, tn.main)}
                  </ListItemButton>
                  {isMobile && active && item.tabs && item.tabs.length > 1 && (
                    <Box sx={{ ml: 3.6, mb: 0.8, borderLeft: `1px solid ${color.border}` }}>
                      {item.tabs.map((t) => {
                        const on = t.id === page || (t.alias || []).includes(page);
                        const n = t.badge ? badgeValue(t.badge) : 0;
                        return (
                          <ListItemButton key={t.id} onClick={() => { onNavigate(t.id); setMobileOpen(false); }} sx={{ minHeight: 36, pl: 1.4, pr: 1, color: on ? color.primary : "#ffffff", background: on ? color.primarySoft : "transparent", fontWeight: on ? 600 : 500 }}>
                            <ListItemText primary={t.label} slotProps={{ primary: { sx: { fontSize: 13, fontWeight: "inherit" } } }} />
                            {n > 0 && pill(n, tn.main)}
                          </ListItemButton>
                        );
                      })}
                    </Box>
                  )}
                </React.Fragment>
              );
            })}
          </List>
        </Box>
      ))}
      <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 1, pt: 1 }}>
        <Divider sx={{ borderColor: color.border }} />
        <ListItemButton onClick={() => logout("")} sx={{ px: 1.2, minHeight: 36, borderRadius: `${radius.sm + 2}px`, color: "#ffffff", "&:hover": { background: color.primaryLight, color: "#ffffff" } }}>
          <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
            <LogOut sx={{ fontSize: 17 }} />
          </ListItemIcon>
          <ListItemText sx={{ display: collapsed ? "none" : "block" }} primary="Sign out" slotProps={{ primary: { sx: { fontSize: "0.74rem" } } }} />
        </ListItemButton>
      </Box>
    </Box>
  );
  const activeTone = hubTone(hub);
  const panel = showPanel && (
    <Box sx={{ width: PANEL_WIDTH, flexShrink: 0, height: "100%", overflowY: "auto", background: color.card, borderRight: `1px solid ${color.border}` }}>
    <Box sx={{ px: 2, pt: 2.6, pb: 1.4, borderBottom: `1px solid ${color.border}` }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: color.faintText }}>SECTION</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: color.text, lineHeight: 1.35, mt: 0.3 }}>{hub.label}</Typography>
      </Box>
      <List disablePadding>
        {hub.tabs.map((t) => {
          const on = t.id === page || (t.alias || []).includes(page);
          const n = t.badge ? badgeValue(t.badge) : 0;
          return (
            <ListItemButton key={t.id} onClick={() => onNavigate(t.id)} sx={{ minHeight: 36, mx: 1, my: 0.35, px: 1.3, borderRadius: `${radius.sm + 2}px`, color: on ? color.primary : color.secondaryText, background: on ? color.primarySoft : "transparent", "&:hover": { background: color.primarySoft, color: color.primary } }}>
              <ListItemText primary={t.label} slotProps={{ primary: { sx: { fontSize: 13, fontWeight: on ? 600 : 500 } } }} />
              {n > 0 && pill(n, activeTone.main)}
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
  const drawerContent = (
    <Box sx={{ display: "flex", height: "100%" }}>
      {rail}
      {panel}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Box component="nav" sx={{ width: { md: navWidth }, flexShrink: { md: 0 }, transition: "width .18s ease" }}>
        {isMobile ? (
          <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ "& .MuiDrawer-paper": { width: "min(280px, 84vw)", boxSizing: "border-box" } }}>
            {drawerContent}
          </Drawer>
        ) : (
          <Drawer variant="permanent" open sx={{ "& .MuiDrawer-paper": { width: navWidth, boxSizing: "border-box", borderRight: 0, transition: "width .18s ease", overflow: "hidden" } }}>
            {drawerContent}
          </Drawer>
        )}
      </Box>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, pr: { md: "var(--ai-pad, 0px)" }, transition: "padding-right .2s ease" }}>
        <AppBar position="sticky" elevation={0} sx={{ background: color.card, borderBottom: `1px solid ${color.border}`, color: color.text }}>
          <Toolbar sx={{ minHeight: 56, px: { xs: 1.5, md: 3 }, gap: 1.5 }}>
            <MuiIconButton size="small" aria-label={isMobile ? "Open menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => (isMobile ? setMobileOpen(true) : setCollapsed((v) => !v))}>
              <Menu sx={{ fontSize: 20 }} />
            </MuiIconButton>
            <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 12, color: color.mutedText, display: { xs: "none", sm: "block" }, flexShrink: 0 }}>{BRAND_NAME}</Typography>
              <Typography sx={{ color: color.borderStrong, display: { xs: "none", sm: "block" } }}>/</Typography>
              {hub?.tabs && hub.tabs.length > 1 && (
                <>
                  <Typography noWrap sx={{ fontSize: 12, color: color.mutedText, display: { xs: "none", xl: "block" } }}>{hub.label}</Typography>
                  <Typography sx={{ color: color.borderStrong, display: { xs: "none", xl: "block" } }}>/</Typography>
                </>
              )}
              <Typography noWrap sx={{ fontSize: 18, fontWeight: 600, color: color.text }}>{allItems.find((i) => i.id === page || (i.alias || []).includes(page))?.label || hub?.label || "Home"}</Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <EntitySwitcher />
              {localeOk && <CountrySwitcher />}
              {localeOk && <AiPageLocalizer />}
              <Box component="form" onSubmit={submitSearch} sx={{ display: { xs: "none", lg: "flex" }, width: 250, height: 36, alignItems: "center", gap: 1, px: 1.2, border: `1px solid ${color.border}`, borderRadius: `${radius.sm + 2}px`, background: color.muted, color: color.mutedText, "&:focus-within": { borderColor: color.primary, boxShadow: `0 0 0 3px ${color.primarySoft}` } }}>
                <Search sx={{ fontSize: 16 }} />
                <InputBase placeholder="Search people..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ fontSize: "0.8125rem", flex: 1 }} slotProps={{ input: { "aria-label": "Search people" } }} />
              </Box>
              <IdleGuard />
              <MuiIconButton size="small" aria-label={`Notifications, ${unread} unread`} onClick={(e) => setNotifAnchor(e.currentTarget)} sx={{ color: color.secondaryText, "&:hover": { background: color.muted } }}>
                <MuiBadge color="secondary" badgeContent={unread} overlap="circular">
                  <Bell sx={{ fontSize: 18 }} />
                </MuiBadge>
              </MuiIconButton>
              <Popover open={Boolean(notifAnchor)} anchorEl={notifAnchor} onClose={() => setNotifAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }} slotProps={{ paper: { sx: { width: 340, maxWidth: "calc(100vw - 24px)", mt: 1, borderRadius: 1.5 } } }}>
                <Box sx={{ p: 2, pb: 1.5, borderBottom: `1px solid ${color.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box>
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 700 }}>Notifications</Typography>
                    <Typography sx={{ fontSize: 12, color: color.secondaryText, mt: 0.3 }}>Latest updates for you</Typography>
                  </Box>
                  <MuiButton size="small" onClick={markAllRead} disabled={!unread} sx={{ fontSize: 12 }}>
                    Mark all read
                  </MuiButton>
                </Box>
                <Box sx={{ maxHeight: 360, overflowY: "auto" }}>
                  {mine.length === 0 && <Typography sx={{ p: 2, fontSize: 13, color: color.secondaryText }}>Nothing yet.</Typography>}
                  {mine.slice(0, 10).map((item) => (
                    <Box
                      key={item.id}
                      onClick={() => {
                        markRead(item.id);
                        setNotifAnchor(null);
                        if (item.link) onNavigate(item.link.replace(/^\//, ""));
                      }}
                      sx={{ display: "flex", gap: 1.2, p: "12px 15px", borderBottom: `1px solid ${color.border}`, cursor: "pointer", background: item.read ? color.card : color.primarySoft, "&:hover": { background: color.muted } }}
                    >
                      <Box sx={{ width: 27, height: 27, borderRadius: 1, background: color.primarySoft, color: color.primary, display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <Bell sx={{ fontSize: 15 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: item.read ? 400 : 500 }}>{item.text}</Typography>
                        <Typography sx={{ fontSize: 11, color: color.secondaryText, mt: 0.4 }}>{timeAgo(item.at)}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Box onClick={() => { setNotifAnchor(null); onNavigate("notifications"); }} sx={{ p: 1.4, textAlign: "center", background: color.muted, color: color.primary, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" }}>
                  Open all notifications
                </Box>
              </Popover>
              <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />
              <Stack direction="row" spacing={1} onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ alignItems: "center", cursor: "pointer" }} role="button" aria-label="Account menu">
                <Avatar name={user.full_name} />
                <Box sx={{ display: { xs: "none", md: "block" } }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{user.full_name}</Typography>
                  <Typography sx={{ fontSize: 11, color: color.secondaryText }}>{roleText}{isManager ? " · Manager" : ""}</Typography>
                </Box>
              </Stack>
              <MuiMenu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
                <Box sx={{ px: 2, py: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{user.full_name}</Typography>
                  <Typography sx={{ fontSize: 12, color: color.secondaryText }}>{user.code} · {user.login_id}</Typography>
                </Box>
                <Divider />
                {user.role !== "superadmin" && <MenuItem sx={{ fontSize: 13 }} onClick={() => { setMenuAnchor(null); onNavigate("profile"); }}>My profile</MenuItem>}
                {groups.flatMap((g) => g.items).filter((i) => i.action).map((i) => (
                  <MenuItem key={i.id} sx={{ fontSize: 13 }} onClick={() => { setMenuAnchor(null); runAction(i.action); }}>
                    <SwitchAccountIcon sx={{ fontSize: 15, mr: 1 }} /> {i.label}
                  </MenuItem>
                ))}
                <MenuItem sx={{ fontSize: 13 }} onClick={() => { setMenuAnchor(null); setPwOpen(true); }}>
                  <Key sx={{ fontSize: 15, mr: 1 }} /> Change password
                </MenuItem>
                <MenuItem sx={{ fontSize: 13 }} onClick={() => { setMenuAnchor(null); logout(""); }}>
                  <LogOut sx={{ fontSize: 15, mr: 1 }} /> Sign out
                </MenuItem>
              </MuiMenu>
            </Stack>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, width: "100%", background: glass ? color.text : color.app }}>
        <Box component="main" data-ai-page sx={{ width: "100%", maxWidth: 1440, mx: "auto", p: { xs: "16px 16px 84px", md: 3 } }}>
          <ToneContext.Provider value={hubTone(hub)}>
          {!glass && isMobile && <HubTabs hub={hub} page={page} onNavigate={onNavigate} badgeValue={badgeValue} />}
          {children}
          </ToneContext.Provider>
          <Stack direction="row" sx={{ justifyContent: "space-between", mt: 3.5, pt: 2, borderTop: `1px solid ${glass ? "rgba(255,255,255,0.12)" : color.border}`, color: glass ? "rgba(242,247,244,0.5)" : color.mutedText, fontSize: "0.6875rem", gap: 2, flexWrap: "wrap" }}>
            <span>{BRAND_NAME} · {BRAND_SUBTAG} by Ezyo · {roleText} view</span>
            <span>Demo data · Changes are saved in this browser</span>
          </Stack>
        </Box>
        </Box>
      </Box>
      {isMobile && (
        // v10.3: app-style bottom bar on phones (web, iOS and Android builds) — the four most used screens + the full menu.
        <Paper elevation={0} sx={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1200, borderTop: `1px solid ${color.border}`, pb: "env(safe-area-inset-bottom)", background: color.card }}>
          <BottomNavigation showLabels value={quick.some((q) => q.id === page) ? page : "menu"} onChange={(_, v) => (v === "menu" ? setMobileOpen(true) : onNavigate(v))} sx={{ background: "transparent", height: 60 }}>
            {quick.map((q) => {
              const Icon = Icons[q.icon] || Icons.Circle;
              const n = q.badge ? badgeValue(q.badge) : 0;
              return <BottomNavigationAction key={q.id} value={q.id} label={q.short || q.label} icon={<MuiBadge color="secondary" badgeContent={n} max={99}><Icon sx={{ fontSize: 21 }} /></MuiBadge>} sx={{ minWidth: 0, px: 0.5, "& .MuiBottomNavigationAction-label": { fontSize: "0.58rem", whiteSpace: "nowrap" }, "&.Mui-selected": { color: "primary.main" } }} />;
            })}
            <BottomNavigationAction value="menu" label="Menu" icon={<Menu sx={{ fontSize: 21 }} />} sx={{ minWidth: 0, "& .MuiBottomNavigationAction-label": { fontSize: "0.58rem" } }} />
          </BottomNavigation>
        </Paper>
      )}
      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </Box>
  );
}

const ADMIN_KIND_TEXT = { hr: "HR admin", finance: "Finance admin", hr_finance: "HR & Finance admin", it: "IT admin", custom: "Admin" };
function adminKindOf(user) {
  if (["hr", "finance", "hr_finance", "it"].includes(user.access_profile)) return user.access_profile;
  const m = user.modules || [];
  if (m.includes("accounts") || (user.permissions_scope || []).includes("people")) return "hr";
  if (m.some((x) => ["payroll", "expense", "advance", "loan"].includes(x))) return "finance";
  return "custom";
}
const WORKER_ROLE_TEXT = { permanent: "Employee", contract: "Contract employee", freelance: "Freelancer", consultant: "Consultant", intern: "Intern", agency: "Agency worker", temporary: "Temporary employee", apprentice: "Apprentice" };

// Bottom-bar shortcuts per role; only screens this person can open are shown.
const QUICK = {
  emp: [["home", "Home"], ["attendance", "Clock in"], ["leave", "Leave"], ["inbox", "Inbox"], ["finances", "Pay"], ["expenses", "Claims"]],
  admin: [["admin", "Home"], ["approvals", "Approvals"], ["inbox", "Inbox"], ["automation", "AI"], ["payroll-agent", "Payroll"]],
  superadmin: [["super", "Home"], ["requests", "Requests"], ["inbox", "Inbox"], ["automation", "AI"], ["activity", "Activity"]],
};
