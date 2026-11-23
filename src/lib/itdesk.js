// IT service desk: categories, priorities & SLA, rule-based triage and a small self-help knowledge base.
// The AI layer uses these as the offline answer; the live model only rewrites / extends them.

export const IT_CATEGORIES = [
  ["hardware", "Hardware (laptop, monitor, phone)"],
  ["software", "Software & licences"],
  ["network", "Network, Wi-Fi & VPN"],
  ["email", "Email, Teams & calendar"],
  ["access", "Access, accounts & passwords"],
  ["printer", "Printer & scanner"],
  ["security", "Security incident / phishing"],
  ["other", "Other"],
];
export const IT_CATEGORY_LABEL = Object.fromEntries(IT_CATEGORIES);
export const IT_PRIORITY = {
  critical: { label: "Critical", tone: "bad", slaHours: 4, help: "Many people blocked or a security incident" },
  high: { label: "High", tone: "warn", slaHours: 8, help: "I cannot work" },
  normal: { label: "Normal", tone: "info", slaHours: 24, help: "I can work with a workaround" },
  low: { label: "Low", tone: "neutral", slaHours: 72, help: "Request or minor issue" },
};
export const IT_STATUS = {
  awaiting_approval: { label: "Awaiting manager approval", tone: "neutral" },
  open: { label: "Open", tone: "warn" },
  in_progress: { label: "In progress", tone: "info" },
  waiting_user: { label: "Waiting on you", tone: "warn" },
  resolved: { label: "Resolved", tone: "good" },
  closed: { label: "Closed", tone: "neutral" },
};
export const IT_OPEN = ["open", "in_progress", "waiting_user"];

export function slaDue(createdIso, priority) {
  return new Date(new Date(createdIso).getTime() + (IT_PRIORITY[priority]?.slaHours || 24) * 3600000).toISOString();
}
export function slaState(t) {
  if (t.status === "awaiting_approval") return "pending"; // v10.11: the SLA clock starts when the manager approves
  if (!IT_OPEN.includes(t.status)) return t.resolved_at && t.resolved_at > t.sla_due ? "missed" : "met";
  const left = new Date(t.sla_due) - Date.now();
  if (left < 0) return "breached";
  if (left < 2 * 3600000) return "at_risk";
  return "ok";
}
export function slaText(t) {
  const left = new Date(t.sla_due) - Date.now();
  const h = Math.abs(left) / 3600000;
  const s = h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`;
  return left < 0 ? `${s} overdue` : `${s} left`;
}

const RULES = [
  { cat: "security", pri: "critical", re: /phish|suspicious (email|link|mail)|hack|virus|malware|ransom|compromis|clicked (a|the) link|lost (my )?(laptop|phone)|stolen/i },
  { cat: "network", pri: "high", re: /vpn|wi-?fi|wifi|internet|network|no connection|can'?t connect|disconnect|dns|lan\b|ethernet/i },
  { cat: "access", pri: "high", re: /password|locked out|account locked|mfa|otp|2fa|authenticator|access to|permission|login|sign in|can'?t log ?in|gitlab|jira|sharepoint access/i },
  { cat: "email", pri: "normal", re: /outlook|email|e-mail|mailbox|teams|calendar|meeting invite|signature|distribution list/i },
  { cat: "printer", pri: "low", re: /print|scanner|scan to|toner|paper jam/i },
  { cat: "software", pri: "normal", re: /install|licen[cs]e|software|update|upgrade|crash|excel|word|intellij|vs ?code|adobe|zoom|app (is )?not|application|slack/i },
  { cat: "hardware", pri: "normal", re: /laptop|keyboard|mouse|monitor|screen|battery|charger|overheat|slow|hang|freez|blue screen|bsod|won'?t (turn|boot|start)|phone|headset|camera|webcam|speaker|mic\b|microphone/i },
];
/** Suggest category & priority from free text (explainable). */
export function triage(text) {
  const t = String(text || "");
  const hit = RULES.find((r) => r.re.test(t));
  let pri = hit?.pri || "normal";
  if (/urgent|asap|cannot work|can'?t work|blocked|client (call|demo|meeting)|whole team|everyone|all users/i.test(t) && pri !== "critical") pri = "high";
  if (/whole team|everyone|all users|office down/i.test(t)) pri = "critical";
  if (/request|need (a|an|new)|please install|when possible|no rush/i.test(t) && !hit?.pri?.match(/critical/)) pri = pri === "high" && !/urgent|blocked/i.test(t) ? "normal" : pri;
  return { category: hit?.cat || "other", priority: pri, matched: hit ? t.match(hit.re)?.[0] : null };
}

export const KB = {
  network: { title: "VPN / network not working", steps: ["Check other sites load – if nothing loads, restart your router or switch to mobile hotspot.", "Quit the VPN client completely, then reconnect and approve the MFA prompt.", "Make sure your laptop date & time are set automatically (VPN certificates fail when the clock is wrong).", "Run `ipconfig /flushdns` (Windows) or toggle Wi-Fi off/on (Mac).", "Still failing? Note the exact error message and raise a ticket – include your location and network (home / office / client)."] },
  access: { title: "Password, MFA and access", steps: ["Use **Forgot password** on the sign-in page – the self-service reset link comes to your personal email or phone.", "For MFA prompts not arriving: open the authenticator app, check the time sync, then retry.", "New phone? Ask IT to reset MFA – you will be asked to verify your identity.", "Access to a tool (GitLab, Jira, SharePoint): raise a ticket and say which project/space and why – your manager will be asked to approve."] },
  email: { title: "Outlook, Teams and calendar", steps: ["Close and reopen Outlook/Teams; sign out and back in if it keeps asking for a password.", "Check your mailbox size – a full mailbox stops sending (archive old mail).", "Phone not syncing: remove and re-add the work account in the Outlook mobile app.", "Calendar invites missing: check the Other / Junk folders and the 'Shared calendars' setting."] },
  printer: { title: "Printer and scanner", steps: ["Make sure you are on office Wi-Fi (printers are not reachable over VPN).", "Remove and re-add the printer from Settings → Printers with the queue name on the printer label.", "Paper jam / toner: tell the front desk; raise a ticket only if the printer shows an error code."] },
  software: { title: "Software, licences and crashes", steps: ["Install approved apps yourself from **Company Portal / Self Service** – no ticket needed.", "App crashing: restart the laptop, install pending updates, then try again.", "Need a paid licence (IntelliJ, Adobe, etc.)? Raise a ticket with the business reason – your manager approves the cost."] },
  hardware: { title: "Laptop, phone and peripherals", steps: ["Restart – a full restart (not sleep) fixes most slowness and freezing.", "Laptop slow: close browser tabs, check Task Manager / Activity Monitor for anything using 90%+ CPU or memory, keep 15% disk free.", "Battery swelling, burning smell or cracked screen: **stop using it** and raise a High ticket – IT will arrange a loaner.", "Peripherals: try another USB-C port / cable before raising a ticket.", "Include the asset tag (e.g. LT-0101) so IT can check warranty."] },
  security: { title: "Security incident – act now", steps: ["**Do not** click further links, open attachments or reply to the sender.", "If you typed your password into a suspicious page, change it immediately from another device.", "Disconnect from Wi-Fi if you think malware is running.", "Use **Report phishing** in Outlook, then raise a Critical ticket – the security team responds within 4 hours.", "Lost or stolen device: raise a Critical ticket now so IT can lock and wipe it remotely; file a police report for insurance."] },
  other: { title: "Getting help faster", steps: ["Describe what you were doing, what you expected and what happened.", "Add a screenshot of any error message.", "Say how badly it blocks your work and whether others are affected."] },
};

export function selfHelp(text) {
  const tr = triage(text);
  const kb = KB[tr.category] || KB.other;
  return { ...tr, kb };
}

export function canManageIt(user) {
  return user?.role === "superadmin" || (user?.role === "admin" && !!user.modules?.includes("it"));
}
