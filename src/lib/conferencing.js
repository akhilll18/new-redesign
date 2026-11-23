// Video conferencing for meetings, client meetings and interviews:
//  • Microsoft Teams and Google Meet: created for real through Microsoft Graph / Google Calendar when a sign-in app (client ID) is set
//    in System settings → Video conferencing. The meeting lands in the organiser's own calendar and invitations go to every attendee.
//    Without a client ID, PeopleHub opens Teams / Google Calendar with everything pre-filled and the organiser pastes the join link back.
//  • Zoom, Webex: open the provider's scheduler, paste the join link back (their APIs need a server-side secret).
//  • Jitsi Meet: free, no account, link generated instantly.
//  • Any other link: pasted and recognised automatically.

export const PROVIDERS = {
  teams: { id: "teams", label: "Microsoft Teams", short: "Teams", color: "#5059C9", host: /(^|\.)teams\.(microsoft|live)\.com$/ },
  gmeet: { id: "gmeet", label: "Google Meet", short: "Meet", color: "#00897B", host: /^meet\.google\.com$/ },
  zoom: { id: "zoom", label: "Zoom", short: "Zoom", color: "#0B5CFF", host: /(^|\.)zoom\.(us|com)$/ },
  webex: { id: "webex", label: "Webex", short: "Webex", color: "#07C160", host: /(^|\.)webex\.com$/ },
  jitsi: { id: "jitsi", label: "Jitsi Meet (free, instant)", short: "Jitsi", color: "#1D76BA", host: /^meet\.jit\.si$/ },
  other: { id: "other", label: "Other link", short: "Video", color: "#5c675f", host: null },
};
export const PROVIDER_ORDER = ["teams", "gmeet", "zoom", "webex", "jitsi", "other"];

/** Old demo links (meet.peoplehub.demo/…) didn't open anywhere: map them to a working Jitsi room. */
export function normalizeLink(link) {
  const s = String(link || "").trim();
  const m = s.match(/^https?:\/\/meet\.peoplehub\.demo\/(.+)$/i);
  return m ? `https://meet.jit.si/ONAS-PeopleHub-${m[1].replace(/[^a-z0-9-]/gi, "")}` : s;
}

export function detectProvider(link) {
  try {
    const host = new URL(normalizeLink(link)).hostname.toLowerCase();
    return Object.values(PROVIDERS).find((p) => p.host && p.host.test(host))?.id || "other";
  } catch {
    return null;
  }
}
export const isUrl = (s) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(String(s || "").trim());

/** Provider of a stored meeting (older records have only a link). */
export function providerOf(m) {
  if (!m || m.mode !== "video") return null;
  return m.provider || detectProvider(m.link) || "other";
}

export function jitsiLink(title = "meeting") {
  const slug = String(title).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "meeting";
  return `https://meet.jit.si/ONAS-${slug}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Pre-filled scheduler / "add to calendar" links (no setup needed) ──
const gDate = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function teamsSchedulerUrl({ title, start, end, emails = [], agenda = "" }) {
  const q = new URLSearchParams({ subject: title || "Meeting", startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString() });
  if (agenda) q.set("content", agenda.slice(0, 1500));
  if (emails.length) q.set("attendees", emails.join(","));
  return `https://teams.microsoft.com/l/meeting/new?${q.toString()}`;
}
export function googleCalendarUrl({ title, start, end, emails = [], details = "", location = "" }) {
  const q = new URLSearchParams({ action: "TEMPLATE", text: title || "Meeting", dates: `${gDate(start)}/${gDate(end)}`, details: details.slice(0, 1800) });
  if (location) q.set("location", location);
  if (emails.length) q.set("add", emails.join(","));
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
export function outlookUrl({ title, start, end, emails = [], details = "", location = "" }) {
  const q = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: title || "Meeting", startdt: new Date(start).toISOString(), enddt: new Date(end).toISOString(), body: details.slice(0, 1800) });
  if (location) q.set("location", location);
  if (emails.length) q.set("to", emails.join(","));
  return `https://outlook.office.com/calendar/0/deeplink/compose?${q.toString()}`;
}
export const ZOOM_SCHEDULER = "https://zoom.us/meeting/schedule";
export const WEBEX_SCHEDULER = "https://signin.webex.com/";
export const MEET_NEW = "https://meet.new";

// ── People & invite text ─────────────────────────────────
/** Email addresses for colleague codes + external guests (client contacts etc.). */
export function attendeeEmails(data, codes = [], guests = []) {
  const byCode = (c) =>
    data.employees.find((e) => e.employee_code === c)?.email ||
    data.admins.find((a) => a.admin_code === c)?.email ||
    data.superAdmins.find((s) => s.superadmin_code === c)?.email;
  return [...new Set([...codes.map(byCode), ...guests].filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim())).map((e) => e.trim().toLowerCase()))];
}
export function parseEmails(text) {
  return [...new Set(String(text || "").split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)))];
}

export function inviteText(m, { organizer = "", when = "" } = {}) {
  const p = PROVIDERS[providerOf(m)];
  return [
    m.title,
    when,
    m.mode === "video" && m.link ? `Join ${p?.label.replace(" (free, instant)", "") || "video call"}: ${m.link}` : m.mode === "in_person" ? `Where: ${m.location}` : m.link ? `Dial-in: ${m.link}` : "",
    organizer ? `Organiser: ${organizer}` : "",
    m.agenda ? `\nAgenda:\n${m.agenda}` : "",
  ].filter(Boolean).join("\n");
}

export function meetingIcs(m, { emails = [], organizerEmail = "", description = "" } = {}) {
  const esc = (s) => String(s || "").replace(/[,;\\]/g, (x) => `\\${x}`).replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ONAS PeopleHub//EN", "METHOD:REQUEST", "BEGIN:VEVENT", `UID:${m.id || Date.now()}@peoplehub`, `DTSTAMP:${gDate(new Date().toISOString())}`, `DTSTART:${gDate(m.start)}`, `DTEND:${gDate(m.end)}`, `SUMMARY:${esc(m.title)}`];
  if (description) lines.push(`DESCRIPTION:${esc(description)}`);
  const loc = m.mode === "in_person" ? m.location : m.link;
  if (loc) lines.push(`LOCATION:${esc(loc)}`);
  if (m.mode === "video" && m.link) lines.push(`URL:${m.link}`);
  if (organizerEmail) lines.push(`ORGANIZER:mailto:${organizerEmail}`);
  emails.forEach((e) => lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${e}`));
  lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(m.title)}`, "TRIGGER:-PT10M", "END:VALARM", "END:VEVENT", "END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${String(m.title || "meeting").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ── Real integrations (OAuth popup → Microsoft Graph / Google Calendar) ──
const TOKENS = new Map(); // provider → { token, exp }

export function conferencingSettings(data) {
  const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
  const s = data?.settings?.conferencing || {};
  return {
    default_provider: s.default_provider || "jitsi",
    google_client_id: s.google_client_id || env.VITE_GOOGLE_CLIENT_ID || "",
    ms_client_id: s.ms_client_id || env.VITE_MS_CLIENT_ID || "",
    ms_tenant: s.ms_tenant || env.VITE_MS_TENANT || "organizations",
    enabled: s.enabled || PROVIDER_ORDER,
  };
}
export function canAutoCreate(provider, cfg) {
  return (provider === "teams" && !!cfg.ms_client_id) || (provider === "gmeet" && !!cfg.google_client_id);
}
export function redirectUri() {
  return new URL("auth-redirect.html", document.baseURI).href.split("#")[0];
}

function oauthPopup(authUrl) {
  return new Promise((resolve, reject) => {
    const w = window.open(authUrl, "peoplehub-oauth", "width=520,height=680");
    if (!w) return reject(new Error("The sign-in window was blocked. Allow pop-ups for this site and try again."));
    let done = false;
    const finish = (fn, v) => { if (done) return; done = true; window.removeEventListener("message", onMsg); clearInterval(timer); try { w.close(); } catch { /* */ } fn(v); };
    const onMsg = (e) => {
      if (e.origin !== window.location.origin || e.data?.type !== "peoplehub-oauth") return;
      const p = new URLSearchParams(String(e.data.hash || "").replace(/^#/, "") || String(e.data.search || "").replace(/^\?/, ""));
      if (p.get("access_token")) finish(resolve, { token: p.get("access_token"), exp: Date.now() + (Number(p.get("expires_in") || 3600) - 60) * 1000 });
      else finish(reject, new Error(p.get("error_description") || p.get("error") || "Sign-in was cancelled."));
    };
    window.addEventListener("message", onMsg);
    const timer = setInterval(() => { if (w.closed) finish(reject, new Error("Sign-in window was closed before finishing.")); }, 600);
  });
}

async function tokenFor(provider, cfg) {
  const cached = TOKENS.get(provider);
  if (cached && cached.exp > Date.now()) return cached.token;
  const state = Math.random().toString(36).slice(2);
  let url;
  if (provider === "gmeet") {
    url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: cfg.google_client_id, redirect_uri: redirectUri(), response_type: "token", scope: "https://www.googleapis.com/auth/calendar.events", include_granted_scopes: "true", prompt: "select_account", state })}`;
  } else {
    url = `https://login.microsoftonline.com/${encodeURIComponent(cfg.ms_tenant)}/oauth2/v2.0/authorize?${new URLSearchParams({ client_id: cfg.ms_client_id, redirect_uri: redirectUri(), response_type: "token", response_mode: "fragment", scope: "https://graph.microsoft.com/Calendars.ReadWrite", prompt: "select_account", state })}`;
  }
  const t = await oauthPopup(url);
  TOKENS.set(provider, t);
  return t.token;
}
export function isSignedIn(provider) {
  const t = TOKENS.get(provider);
  return !!(t && t.exp > Date.now());
}

async function api(provider, cfg, method, url, body) {
  const call = async () => {
    const token = await tokenFor(provider, cfg);
    return fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  };
  let res = await call();
  if (res.status === 401) { TOKENS.delete(provider); res = await call(); }
  if (!res.ok && res.status !== 204 && res.status !== 410 && !(method === "DELETE" && res.status === 404)) {
    let msg = `${res.status}`;
    try { const j = await res.json(); msg = j.error?.message || j.error_description || msg; } catch { /* */ }
    throw new Error(`${PROVIDERS[provider].label}: ${msg}`);
  }
  return res.status === 204 || method === "DELETE" ? null : res.json();
}

/**
 * Create (or update, when `external` is given) the meeting in the organiser's Microsoft 365 / Google calendar with a
 * Teams / Meet link. Invitations are sent by Microsoft / Google to every email. Returns { link, external }.
 */
export async function upsertOnlineMeeting(provider, cfg, { title, start, end, agenda = "", emails = [], external = null }) {
  if (provider === "teams") {
    const body = {
      subject: title,
      body: { contentType: "text", content: agenda || "" },
      start: { dateTime: new Date(start).toISOString().replace("Z", ""), timeZone: "UTC" },
      end: { dateTime: new Date(end).toISOString().replace("Z", ""), timeZone: "UTC" },
      attendees: emails.map((address) => ({ emailAddress: { address }, type: "required" })),
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
    };
    const ev = external?.id
      ? await api("teams", cfg, "PATCH", `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(external.id)}`, body)
      : await api("teams", cfg, "POST", "https://graph.microsoft.com/v1.0/me/events", body);
    const link = ev?.onlineMeeting?.joinUrl || ev?.onlineMeetingUrl || external?.link;
    if (!link) throw new Error("Microsoft Teams: the event was created but Teams didn't return a join link. Check that Teams meetings are allowed for this account.");
    return { link, external: { provider: "teams", id: ev.id, webLink: ev.webLink, link } };
  }
  if (provider === "gmeet") {
    const body = {
      summary: title,
      description: agenda || "",
      start: { dateTime: new Date(start).toISOString() },
      end: { dateTime: new Date(end).toISOString() },
      attendees: emails.map((email) => ({ email })),
      ...(external?.id ? {} : { conferenceData: { createRequest: { requestId: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, conferenceSolutionKey: { type: "hangoutsMeet" } } } }),
    };
    const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const ev = external?.id
      ? await api("gmeet", cfg, "PATCH", `${base}/${encodeURIComponent(external.id)}?sendUpdates=all`, body)
      : await api("gmeet", cfg, "POST", `${base}?conferenceDataVersion=1&sendUpdates=all`, body);
    const link = ev?.hangoutLink || ev?.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri || external?.link;
    if (!link) throw new Error("Google Meet: the event was created but no Meet link came back. Check that Google Meet is enabled for this Google account.");
    return { link, external: { provider: "gmeet", id: ev.id, webLink: ev.htmlLink, link } };
  }
  throw new Error("Automatic creation is available for Microsoft Teams and Google Meet only.");
}

export async function cancelOnlineMeeting(cfg, external) {
  if (!external?.id) return;
  if (external.provider === "teams") await api("teams", cfg, "POST", `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(external.id)}/cancel`, { comment: "Cancelled in PeopleHub" });
  else if (external.provider === "gmeet") await api("gmeet", cfg, "DELETE", `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(external.id)}?sendUpdates=all`);
}

/**
 * Shared by the meeting dialog and the AI scheduler: make sure a video meeting has a working link before it is saved.
 * Returns the meeting patch ({ provider, link, external }) or throws with a readable message.
 */
export async function prepareConference(meeting, { data, auto = true }) {
  if (meeting.mode !== "video") return { provider: null, external: meeting.external || null };
  const cfg = conferencingSettings(data);
  const provider = meeting.provider || detectProvider(meeting.link) || cfg.default_provider;
  const link = normalizeLink(meeting.link);
  // The organiser owns the Outlook / Google event, so only the other people are invited.
  const own = attendeeEmails(data, [meeting.organizer].filter(Boolean));
  const emails = attendeeEmails(data, meeting.attendees || [], meeting.guests || []).filter((e) => !own.includes(e));
  if (canAutoCreate(provider, cfg) && auto && (!link || meeting.external?.provider === provider)) {
    const r = await upsertOnlineMeeting(provider, cfg, { title: meeting.title, start: meeting.start, end: meeting.end, agenda: meeting.agenda, emails, external: meeting.external?.provider === provider ? meeting.external : null });
    return { provider, link: r.link, external: r.external };
  }
  if (link) return { provider: detectProvider(link) === "other" ? provider : detectProvider(link), link, external: meeting.external?.link === link ? meeting.external : null };
  if (provider === "jitsi" || provider === "other") return { provider: "jitsi", link: jitsiLink(meeting.title), external: null };
  throw new Error(`Add the ${PROVIDERS[provider].label} join link, or pick Jitsi for an instant link.`);
}
