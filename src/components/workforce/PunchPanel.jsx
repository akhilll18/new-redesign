// Punch in / out with biometric verification and geofencing. Used on the glass home (dark) and Attendance (light).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { FingerprintRounded, PhotoCameraFrontRounded, RouterRounded, LanguageRounded, PlaceRounded, LockClockRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { G } from "../glass/Glass.jsx";
import { fencesFor, nearestGeofence, getPosition, offset, fmtDistance } from "../../lib/geo.js";
import { platformBiometricAvailable, enrolDevice, verifyDevice, openCamera, snapshot, stopStream } from "../../lib/biometric.js";
import { todayStatus } from "../../lib/workforce.js";
import { designTokens } from "../../theme/muiTheme.js";

const { color } = designTokens;

const METHODS = [
  { id: "device", label: "Fingerprint / face", icon: <FingerprintRounded />, source: "geo_mobile", help: "Your phone or laptop checks your fingerprint or face. We only receive a signed “verified” result." },
  { id: "selfie", label: "Selfie + location", icon: <PhotoCameraFrontRounded />, source: "geo_mobile", help: "A small selfie and your location are saved with the punch." },
  { id: "terminal", label: "Office terminal", icon: <RouterRounded />, source: "biometric", help: "Simulates the fingerprint or face terminal at your office (demo)." },
  { id: "web", label: "Web punch", icon: <LanguageRounded />, source: "web", help: "For staff allowed to punch from the browser without location." },
];

function allowedMethods(e) {
  const m = e.attendance_mode;
  if (m === "any") return ["device", "selfie", "terminal", "web"];
  if (m === "biometric") return e.field_staff === "yes" ? ["terminal", "device", "selfie"] : ["terminal"];
  if (m === "geo_mobile") return ["device", "selfie"];
  return ["web"];
}

function SelfieDialog({ open, onClose, onCapture }) {
  const video = useRef(null);
  const stream = useRef(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return undefined;
    setError("");
    let cancelled = false;
    openCamera()
      .then((s) => {
        if (cancelled) return stopStream(s);
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
      })
      .catch((e) => setError(e?.name === "NotAllowedError" ? "Camera permission was denied." : e?.message || "The camera is not available here."));
    return () => {
      cancelled = true;
      stopStream(stream.current);
      stream.current = null;
    };
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Take a selfie</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="warning">{error} Use device fingerprint / face instead, or continue with a demo selfie.</Alert>
        ) : (
          <Box sx={{ width: 220, height: 220, mx: "auto", borderRadius: "50%", overflow: "hidden", background: "#0F2E25", border: "3px solid #9FE3C9" }}>
            <video ref={video} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          </Box>
        )}
        <Typography sx={{ fontSize: "0.62rem", color: "#78827b", mt: 1.5, textAlign: "center" }}>A 96 × 96 thumbnail is stored with this punch and kept for the retention period set by your company.</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        {error ? (
          <Button variant="outlined" onClick={() => onCapture(null, true)}>Use demo selfie</Button>
        ) : (
          <Button variant="contained" onClick={() => video.current && onCapture(snapshot(video.current), false)}>Capture and punch</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function PunchPanel({ dark = false, compact = false }) {
  const { data, user, punch, saveDeviceKey, notifyToast } = useStore();
  const e = data.employees.find((x) => x.employee_code === user.employee_code);
  const methods = allowedMethods(e);
  const [method, setMethod] = useState(methods[0]);
  const [locMode, setLocMode] = useState("demo_inside");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [scan, setScan] = useState(false);
  const [bioAvail, setBioAvail] = useState(null);
  const [lastPos, setLastPos] = useState(null);
  const now = useClock();
  const fences = fencesFor(e, data.geofences);
  const home = fences[0];
  const devs = data.devices.filter((d) => d.geofence_id === e.primary_geofence);
  const [device, setDevice] = useState(devs.find((d) => d.status === "online")?.device_id || devs[0]?.device_id || "");
  const st = todayStatus(data, e);
  const clockedIn = st.open;
  const type = clockedIn ? "out" : "in";
  const meta = METHODS.find((m) => m.id === method);

  useEffect(() => {
    platformBiometricAvailable().then(setBioAvail);
  }, []);
  useEffect(() => {
    if (!methods.includes(method)) setMethod(methods[0]);
  }, [e.attendance_mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => {
    if (!lastPos) return null;
    return nearestGeofence(lastPos, data.geofences, fences.map((f) => f.id));
  }, [lastPos, data.geofences]); // eslint-disable-line react-hooks/exhaustive-deps

  async function locate() {
    if (locMode === "device") {
      const p = await getPosition({ fallback: home ? { lat: home.lat, lng: home.lng, accuracy: 25 } : null });
      if (p?.simulated) setMsg({ tone: "warning", text: `${p.reason} Using your office location for this demo punch.` });
      return p;
    }
    if (!home) return null;
    return locMode === "demo_outside" ? { ...offset(home, 1200, 700), accuracy: 18, simulated: true } : { ...offset(home, 30, -20), accuracy: 12, simulated: true };
  }

  async function doPunch(extra = {}) {
    setBusy(true);
    setMsg(null);
    try {
      let pos = null;
      if (meta.source === "geo_mobile") {
        pos = await locate();
        setLastPos(pos);
      }
      const source = meta.source === "biometric" ? (data.devices.find((d) => d.device_id === device)?.type === "face" ? "biometric_face" : "biometric_fp") : meta.source;
      const r = punch({ type, source, pos, device_id: meta.source === "biometric" ? device : null, ...extra });
      if (!r.ok) {
        setMsg({ tone: "error", text: r.error });
        return;
      }
      const where = r.geo?.fence ? ` at ${r.geo.fence.name}` : "";
      setMsg({ tone: r.flag ? "warning" : "success", text: r.flag ? `Punched ${type}, flagged for review: ${r.flag.replace("Outside geofence · ", "")}.` : `Punched ${type}${where} at ${new Date(r.punch.ts).toTimeString().slice(0, 5)}.` });
      notifyToast(`Punched ${type}.`, r.flag ? "warning" : "success");
    } finally {
      setBusy(false);
    }
  }

  async function onPrimary() {
    if (method === "selfie") return setSelfieOpen(true);
    if (method === "device") {
      if (bioAvail) {
        try {
          let key = data.deviceKeys[e.employee_code]?.credentialId;
          if (!key) {
            const reg = await enrolDevice(e);
            key = reg.credentialId;
            saveDeviceKey(key);
          }
          const ok = await verifyDevice(key);
          if (!ok) return setMsg({ tone: "error", text: "Your device did not confirm your fingerprint or face. Try again." });
          return doPunch({ verified: "device_biometric" });
        } catch (er) {
          if (er?.name === "NotAllowedError") return setMsg({ tone: "error", text: "Verification was cancelled. Try again, or use a selfie." });
          setMsg({ tone: "warning", text: "Device biometrics are blocked in this window. Hold the scanner for a demo scan instead." });
          setBioAvail(false);
          return undefined;
        }
      }
      setScan(true);
      return undefined;
    }
    return doPunch({ verified: method === "terminal" ? "device" : "password" });
  }

  const ringColor = preview ? (preview.inside ? G.mint : G.saffron) : clockedIn ? G.mint : "rgba(255,255,255,0.35)";
  const ink = dark ? G.fog : "#202922";
  const muted = dark ? G.muted : "#78827b";
  const faint = dark ? G.faint : "#8a948d";
  const surface = dark ? "rgba(255,255,255,0.08)" : "#f4f7f3";

  return (
    <Box>
      <Stack direction={compact ? "column" : { xs: "column", sm: "row" }} spacing={2.5} sx={{ alignItems: "center" }}>
        {/* The orb */}
        <ButtonBase
          onClick={onPrimary}
          disabled={busy}
          aria-label={`Punch ${type} with ${meta.label}`}
          sx={{
            position: "relative",
            width: 168,
            height: 168,
            borderRadius: "50%",
            flexShrink: 0,
            background: dark ? "rgba(255,255,255,0.14)" : color.primarySoft,
            border: `3px solid ${ringColor}`,
            boxShadow: dark ? `0 0 0 10px rgba(255,255,255,0.05), 0 0 48px -6px ${ringColor}` : `0 0 0 10px ${color.muted}`,
            color: ink,
            flexDirection: "column",
            transition: "box-shadow .3s, border-color .3s",
            "&:focus-visible": { outline: `3px solid ${G.saffron}`, outlineOffset: 6 },
            "@keyframes breathe": { "0%,100%": { transform: "scale(1)" }, "50%": { transform: "scale(1.04)" } },
            "@media (prefers-reduced-motion: no-preference)": scan ? { animation: "breathe 1.2s ease-in-out infinite" } : {},
          }}
        >
          <Box sx={{ color: ringColor === "rgba(255,255,255,0.35)" ? (dark ? G.fog : "#244d3d") : ringColor, "& svg": { fontSize: 44 } }}>{scan ? <FingerprintRounded /> : meta.icon}</Box>
          <Typography sx={{  fontWeight: 800, fontSize: "1.35rem", fontVariantNumeric: "tabular-nums", lineHeight: 1.1, mt: 0.4 }}>{now.toTimeString().slice(0, 8)}</Typography>
          <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, mt: 0.4, color: dark ? G.mint : "#244d3d" }}>{busy ? "Checking…" : scan ? "Hold to scan" : `Punch ${type}`}</Typography>
        </ButtonBase>

        <Stack spacing={1.2} sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          <Box>
            <Typography sx={{  fontWeight: 800, fontSize: "1rem", color: ink }}>
              {st.status === "leave" ? "You are on leave today" : clockedIn ? `Clocked in since ${st.inT}` : st.outT ? `Clocked out at ${st.outT}` : "You have not clocked in"}
            </Typography>
            <Typography sx={{ fontSize: "0.65rem", color: muted, mt: 0.3 }}>
              {clockedIn ? `${st.late ? "Late arrival · " : ""}shift ${data.settings.shift_start}–${String(Number(data.settings.shift_start.slice(0, 2)) + data.settings.shift_hours + 1).padStart(2, "0")}${data.settings.shift_start.slice(2)}` : `Shift starts ${data.settings.shift_start}; late after ${data.settings.late_after}`}
              {home ? ` · ${home.name}` : ""}
            </Typography>
          </Box>

          <ToggleButtonGroup exclusive size="small" value={method} onChange={(_, v) => v && (setMethod(v), setMsg(null), setScan(false))} sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { fontSize: "0.6rem", textTransform: "none", gap: 0.5, px: 1, color: muted, borderColor: dark ? "rgba(255,255,255,0.18)" : undefined, "&.Mui-selected": { color: dark ? G.forest : "#244d3d", background: dark ? G.mint : "#e3efe7" }, "& svg": { fontSize: 15 } } }}>
            {METHODS.filter((m) => methods.includes(m.id)).map((m) => (
              <ToggleButton key={m.id} value={m.id}>
                {m.icon}
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography sx={{ fontSize: "0.6rem", color: faint }}>
            {meta.help}
            {method === "device" && bioAvail === false ? " Not available in this browser, so a demo scan is used." : ""}
          </Typography>

          {meta.source === "geo_mobile" && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
              <PlaceRounded sx={{ fontSize: 16, color: ringColor === "rgba(255,255,255,0.35)" ? muted : ringColor }} />
              <FormControl size="small" sx={{ minWidth: 210 }}>
                <InputLabel sx={{ color: muted }}>Location</InputLabel>
                <Select label="Location" value={locMode} onChange={(ev) => setLocMode(ev.target.value)} sx={{ fontSize: "0.65rem", color: ink, background: surface, "& .MuiOutlinedInput-notchedOutline": { borderColor: dark ? "rgba(255,255,255,0.2)" : undefined }, "& svg": { color: muted } }}>
                  <MenuItem value="device">My device location</MenuItem>
                  <MenuItem value="demo_inside">Demo: at {home?.name || "office"}</MenuItem>
                  <MenuItem value="demo_outside">Demo: 1.4 km away</MenuItem>
                </Select>
              </FormControl>
              <Typography sx={{ fontSize: "0.6rem", color: muted }}>
                {preview?.fence ? `${preview.inside ? "Inside" : `${fmtDistance(preview.distance - preview.fence.radius_m)} outside`} ${preview.fence.name} (radius ${preview.fence.radius_m} m)` : `Geofence ${home ? `${home.name}, ${home.radius_m} m` : "not set"} · rule: ${data.settings.geofence_enforcement === "block" ? "block outside" : data.settings.geofence_enforcement === "flag" ? "allow and flag" : "allow"}`}
              </Typography>
            </Stack>
          )}
          {meta.source === "biometric" && (
            <FormControl size="small" sx={{ maxWidth: 300 }}>
              <InputLabel sx={{ color: muted }}>Terminal</InputLabel>
              <Select label="Terminal" value={device} onChange={(ev) => setDevice(ev.target.value)} sx={{ fontSize: "0.65rem", color: ink, background: surface, "& .MuiOutlinedInput-notchedOutline": { borderColor: dark ? "rgba(255,255,255,0.2)" : undefined }, "& svg": { color: muted } }}>
                {devs.map((d) => <MenuItem key={d.device_id} value={d.device_id}>{d.name} · {d.type} · {d.status}</MenuItem>)}
                {devs.length === 0 && <MenuItem value="" disabled>No terminal at your work location</MenuItem>}
              </Select>
            </FormControl>
          )}

          {scan && (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<FingerprintRounded />}
                onClick={() => {
                  setScan(false);
                  doPunch({ verified: "demo_scan" });
                }}
              >
                Complete demo scan
              </Button>
              <Button size="small" color="inherit" sx={{ color: muted }} onClick={() => setScan(false)}>Cancel</Button>
            </Stack>
          )}
          {msg && <Alert severity={msg.tone} sx={{ py: 0, fontSize: "0.65rem" }}>{msg.text}</Alert>}
          {!compact && (
            <Stack direction="row" spacing={2.5} sx={{ pt: 0.5 }}>
              {[["In", st.inT || "—"], ["Out", st.outT || "—"], ["Worked", st.hours ? `${st.hours.toFixed(1)} h` : clockedIn ? "running" : "—"], ["Punches", st.punches.length]].map(([k, v]) => (
                <Box key={k}>
                  <Typography sx={{ fontSize: "0.55rem", color: faint }}>{k}</Typography>
                  <Typography sx={{  fontWeight: 800, fontSize: "0.85rem", color: ink }}>{v}</Typography>
                </Box>
              ))}
              {st.flagged && (
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: dark ? G.saffron : "#bf7955" }}>
                  <LockClockRounded sx={{ fontSize: 15 }} />
                  <Typography sx={{ fontSize: "0.6rem" }}>Flagged for review</Typography>
                </Stack>
              )}
            </Stack>
          )}
        </Stack>
      </Stack>
      <SelfieDialog
        open={selfieOpen}
        onClose={() => setSelfieOpen(false)}
        onCapture={(img, demo) => {
          setSelfieOpen(false);
          doPunch({ verified: demo ? "demo_scan" : "selfie", selfie: img });
        }}
      />
    </Box>
  );
}
