// Video conferencing UI shared by the calendar, client meetings and the AI scheduler:
// provider picker (Teams, Google Meet, Zoom, Webex, Jitsi, other), Join button, "Add to calendar" menu and invite copy.
import React, { useState } from "react";
import { Alert, Box, Button, Chip, FormControlLabel, ListItemIcon, Menu, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { VideocamRounded, OpenInNewRounded, EventAvailableRounded, ContentCopyRounded, DownloadRounded, AutorenewRounded, CheckCircleRounded } from "@mui/icons-material";
import {
  PROVIDERS, PROVIDER_ORDER, conferencingSettings, canAutoCreate, detectProvider, isUrl, providerOf, normalizeLink, jitsiLink,
  teamsSchedulerUrl, googleCalendarUrl, outlookUrl, ZOOM_SCHEDULER, WEBEX_SCHEDULER, MEET_NEW, attendeeEmails, inviteText, meetingIcs,
} from "../../lib/conferencing.js";

const LETTER = { teams: "T", gmeet: "M", zoom: "Z", webex: "W", jitsi: "J", other: "" };

export function ProviderMark({ provider, size = 18 }) {
  const p = PROVIDERS[provider] || PROVIDERS.other;
  return (
    <Box component="span" aria-hidden sx={{ width: size, height: size, flexShrink: 0, borderRadius: provider === "teams" ? "5px" : "50%", background: p.color, color: "#fff", display: "inline-grid", placeItems: "center", fontSize: size * 0.55, fontWeight: 800, lineHeight: 1 }}>
      {LETTER[provider] || <VideocamRounded sx={{ fontSize: size * 0.7 }} />}
    </Box>
  );
}

export function providerLabel(m) {
  const p = providerOf(m);
  return p ? (PROVIDERS[p] || PROVIDERS.other).label.replace(" (free, instant)", "") : null;
}

/** Picker + setup helpers inside the meeting form. `f` holds { provider, link, autoCreate, guestsText, title, start, end, agenda, attendees }. */
export function ConferencePicker({ f, setF, data, start, end }) {
  const cfg = conferencingSettings(data);
  const provider = f.provider || cfg.default_provider;
  const auto = canAutoCreate(provider, cfg);
  const emails = attendeeEmails(data, f.attendees || [], f.guests || []);
  const linkProvider = f.link ? detectProvider(f.link) : null;
  const pre = { title: f.title || "Meeting", start, end, emails, agenda: f.agenda || "", details: f.agenda || "" };
  const pick = (id) => setF({ ...f, provider: id, link: id === "jitsi" ? jitsiLink(f.title) : f.external?.provider === id ? f.external.link : "", autoCreate: true });
  const onLink = (v) => {
    const d = detectProvider(v);
    setF({ ...f, link: v, provider: d && d !== "other" ? d : provider });
  };
  const open = (url) => window.open(url, "_blank", "noopener");
  return (
    <Stack spacing={1.2} sx={{ p: 1.4, borderRadius: 1.5, border: "1px solid #e3e9e4", background: "#fafcfa" }}>
      <Typography variant="caption" color="text.secondary">Video platform</Typography>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.8 }}>
        {PROVIDER_ORDER.filter((id) => cfg.enabled.includes(id)).map((id) => (
          <Chip
            key={id}
            icon={<ProviderMark provider={id} size={16} />}
            label={PROVIDERS[id].label.replace(" (free, instant)", "")}
            onClick={() => pick(id)}
            variant={provider === id ? "filled" : "outlined"}
            sx={{ fontSize: "0.62rem", fontWeight: provider === id ? 700 : 500, pl: 0.4, background: provider === id ? `${PROVIDERS[id].color}1f` : "#fff", borderColor: provider === id ? PROVIDERS[id].color : "#e6ece5", color: "#26302a" }}
          />
        ))}
      </Stack>

      {auto && (
        <>
          <FormControlLabel
            control={<Switch size="small" checked={f.autoCreate !== false} onChange={(e) => setF({ ...f, autoCreate: e.target.checked })} />}
            label={<Typography sx={{ fontSize: "0.64rem" }}>Create the {PROVIDERS[provider].label} meeting automatically when I book</Typography>}
          />
          {f.autoCreate !== false && (
            <Alert severity="info" icon={<ProviderMark provider={provider} />} sx={{ fontSize: "0.62rem", py: 0.2 }}>
              {f.external?.provider === provider
                ? `Linked to your ${provider === "teams" ? "Outlook / Teams" : "Google"} calendar event. Changes you save here update it and notify everyone.`
                : `You'll sign in to ${provider === "teams" ? "Microsoft 365" : "Google"} once. The meeting is added to your calendar with a ${PROVIDERS[provider].short} link, and ${emails.length ? `${emails.length} attendee${emails.length === 1 ? "" : "s"} get` : "attendees get"} invitations from ${provider === "teams" ? "Outlook" : "Google Calendar"}.`}
            </Alert>
          )}
        </>
      )}

      {provider === "jitsi" && (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <TextField size="small" fullWidth label="Jitsi link (ready to use, no account needed)" value={f.link || ""} onChange={(e) => onLink(e.target.value)} />
          <Button size="small" startIcon={<AutorenewRounded />} onClick={() => setF({ ...f, link: jitsiLink(f.title) })}>New</Button>
        </Stack>
      )}

      {provider !== "jitsi" && !(auto && f.autoCreate !== false) && (
        <>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.8 }}>
            {provider === "teams" && <Button size="small" variant="outlined" endIcon={<OpenInNewRounded />} onClick={() => open(teamsSchedulerUrl(pre))}>Open Teams with this meeting</Button>}
            {provider === "gmeet" && <><Button size="small" variant="outlined" endIcon={<OpenInNewRounded />} onClick={() => open(googleCalendarUrl(pre))}>Open Google Calendar with this meeting</Button><Button size="small" endIcon={<OpenInNewRounded />} onClick={() => open(MEET_NEW)}>Instant Meet link</Button></>}
            {provider === "zoom" && <Button size="small" variant="outlined" endIcon={<OpenInNewRounded />} onClick={() => open(ZOOM_SCHEDULER)}>Schedule in Zoom</Button>}
            {provider === "webex" && <Button size="small" variant="outlined" endIcon={<OpenInNewRounded />} onClick={() => open(WEBEX_SCHEDULER)}>Schedule in Webex</Button>}
          </Stack>
          <TextField
            size="small"
            label={`${PROVIDERS[provider].label} join link *`}
            placeholder={provider === "teams" ? "https://teams.microsoft.com/l/meetup-join/…" : provider === "gmeet" ? "https://meet.google.com/abc-defg-hij" : provider === "zoom" ? "https://us02web.zoom.us/j/…" : "https://…"}
            value={f.link || ""}
            onChange={(e) => onLink(e.target.value)}
            error={!!f.link && !isUrl(f.link)}
            helperText={
              f.link && !isUrl(f.link) ? "Paste the full link, starting with https://"
                : linkProvider && linkProvider !== "other" ? <Stack component="span" direction="row" sx={{ alignItems: "center", gap: 0.5 }}><CheckCircleRounded sx={{ fontSize: 13, color: "#2E8C7A" }} />{PROVIDERS[linkProvider].label.replace(" (free, instant)", "")} link recognised</Stack>
                : provider === "teams" ? "Teams opens with the title, time and attendees filled in. Send it, then copy the join link here."
                : provider === "gmeet" ? "Save the event in Google Calendar (Meet is added automatically), then paste the Meet link here."
                : "Create the meeting there, then paste the join link here."
            }
          />
        </>
      )}

      <TextField
        size="small"
        label="External guests (emails)"
        placeholder="client@company.com, partner@firm.com"
        value={f.guestsText ?? (f.guests || []).join(", ")}
        onChange={(e) => setF({ ...f, guestsText: e.target.value, guests: e.target.value.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean) })}
        helperText={`Invitations go to ${emails.length} email${emails.length === 1 ? "" : "s"} (colleagues + guests).`}
      />
    </Stack>
  );
}

export function JoinButton({ m, size = "small", variant = "contained" }) {
  if (!m || m.mode !== "video" || !m.link || m.status === "cancelled") return null;
  const p = providerOf(m);
  const prov = PROVIDERS[p] || PROVIDERS.other;
  return (
    <Button size={size} variant={variant} startIcon={<ProviderMark provider={p} size={16} />} href={normalizeLink(m.link)} target="_blank" rel="noreferrer" sx={variant === "contained" ? { background: prov.color, "&:hover": { background: prov.color, filter: "brightness(0.92)" } } : undefined}>
      Join {p === "other" ? "video call" : prov.short}
    </Button>
  );
}

export function AddToCalendarButton({ m, data, nameOf, notify }) {
  const [anchor, setAnchor] = useState(null);
  if (!m) return null;
  const link = normalizeLink(m.link);
  const mm = { ...m, link };
  const emails = attendeeEmails(data, [m.organizer, ...(m.attendees || [])], m.guests || []);
  const client = m.client_id && data.clients?.find((c) => c.id === m.client_id);
  if (client?.email && !emails.includes(client.email.toLowerCase())) emails.push(client.email.toLowerCase());
  const when = `${new Date(m.start).toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} – ${new Date(m.end).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  const details = inviteText(mm, { organizer: nameOf?.(m.organizer), when });
  const location = m.mode === "in_person" ? m.location : link;
  const go = (url) => { window.open(url, "_blank", "noopener"); setAnchor(null); };
  return (
    <>
      <Button size="small" variant="outlined" startIcon={<EventAvailableRounded />} onClick={(e) => setAnchor(e.currentTarget)}>Add to calendar</Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {m.external?.webLink && <MenuItem dense onClick={() => go(m.external.webLink)}><ListItemIcon><ProviderMark provider={m.external.provider} /></ListItemIcon>Open in {m.external.provider === "teams" ? "Outlook" : "Google Calendar"}</MenuItem>}
        <MenuItem dense onClick={() => go(googleCalendarUrl({ title: m.title, start: m.start, end: m.end, emails, details, location }))}><ListItemIcon><ProviderMark provider="gmeet" /></ListItemIcon>Google Calendar</MenuItem>
        <MenuItem dense onClick={() => go(outlookUrl({ title: m.title, start: m.start, end: m.end, emails, details, location }))}><ListItemIcon><ProviderMark provider="teams" /></ListItemIcon>Outlook / Microsoft 365</MenuItem>
        <MenuItem dense onClick={() => { meetingIcs(mm, { emails, description: details }); setAnchor(null); }}><ListItemIcon><DownloadRounded fontSize="small" /></ListItemIcon>Download .ics (Apple, Outlook desktop)</MenuItem>
        <MenuItem dense onClick={async () => { try { await navigator.clipboard.writeText(details); notify?.("Invite details copied."); } catch { notify?.("Couldn't copy – your browser blocked clipboard access.", "error"); } setAnchor(null); }}><ListItemIcon><ContentCopyRounded fontSize="small" /></ListItemIcon>Copy invite text</MenuItem>
      </Menu>
    </>
  );
}
