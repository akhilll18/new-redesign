// Multi-role sign-in: credentials + captcha → MFA (Admin) / MFA + security PIN (Super Admin) → forced reset on first login.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  RefreshRounded,
  ShieldRounded,
  LockClockRounded,
  FingerprintRounded,
  VerifiedUserRounded,
  HistoryRounded,
  ArrowBackRounded,
  BadgeRounded,
  AdminPanelSettingsRounded,
  PersonRounded,
} from "@mui/icons-material";
import { useStore, ROLE_HOME } from "../store/AppStore.jsx";
import { APP_CONFIG, DEMO_ACCOUNTS } from "../data/seed.js";
import { getTenant, setTenant, saveServerUrl, savedServerUrl, serverBase, useBrowserOnly } from "../lib/server/api.js";
import { makeCaptcha } from "../lib/utils.js";
import { applySeo } from "../seo/seo.js";
import { pageFor } from "../seo/publicPages.js";
import { passwordProblems } from "../lib/validation.js";
import { PasswordRules } from "../components/kit/ChangePasswordDialog.jsx";
import { EzyHrLockup } from "../components/brand/EzyHrLogo.jsx";

// (v10.9.1: the Employee / Admin / Super Admin selector was removed — one sign-in form for everyone)

function Captcha({ code, onRefresh }) {
  const glyphs = useMemo(() => [...code].map((c, i) => ({ c, r: ((i * 37 + code.charCodeAt(i)) % 30) - 15, y: ((i * 13) % 7) - 3 })), [code]);
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Box
        aria-label={`Captcha code ${code.split("").join(" ")}`}
        role="img"
        sx={{
          px: 1.5,
          height: 40,
          minWidth: 132,
          borderRadius: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          userSelect: "none",
          bgcolor: "sunk.main",
          border: 1,
          borderColor: "divider",
        }}
      >
        {glyphs.map((g, i) => (
          <Box key={i} component="span" sx={{  fontWeight: 700, fontSize: 20, color: i % 2 ? "primary.main" : "text.primary", transform: `rotate(${g.r}deg) translateY(${g.y}px)`, display: "inline-block" }}>
            {g.c}
          </Box>
        ))}
      </Box>
      <Tooltip title="New code">
        <IconButton onClick={onRefresh} aria-label="Refresh captcha">
          <RefreshRounded />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

function OtpCountdown({ expires }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.round((expires - now) / 1000));
  return (
    <Typography variant="caption" color={left ? "text.secondary" : "error.main"}>
      {left ? `Code expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Code expired"}
    </Typography>
  );
}

export default function LoginPage() {
  const store = useStore();
  const { beginLogin, verifyMfa, completeReset, resendOtp, cancelPending, pending, data, logoutReason, rememberedLogin, fingerprint, empBy, adminBy, session, resetDemo } = store;
  const navigate = useNavigate();

  // v10.9.1: one sign-in form — who is signing in follows from the code: ADM… = admin, any other code = employee,
  // no code = Super Admin
  const [code, setCode] = useState(rememberedLogin?.code || "");
  const [loginId, setLoginId] = useState(rememberedLogin?.login_id || "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [captcha, setCaptcha] = useState(makeCaptcha);
  const [captchaIn, setCaptchaIn] = useState("");
  const [remember, setRemember] = useState(!!rememberedLogin);
  const [caps, setCaps] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoOtp, setDemoOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showNewPw2, setShowNewPw2] = useState(false);
  const [fieldErr, setFieldErr] = useState({});
  const [confirmReset, setConfirmReset] = useState(false);
  // v10.8 server mode: which company (workspace) you sign in to; demo shortcuts only in the demo workspaces
  useEffect(() => { const p = pageFor("/login/"); applySeo({ title: p.title, description: p.description, index: true, path: p.path }); }, []);
  const srv = store.server;
  const [tenant, setTenantState] = useState(getTenant());
  const [tenantInfo, setTenantInfo] = useState(null);
  const [serverDlg, setServerDlg] = useState(false);
  const [serverUrl, setServerUrl] = useState(savedServerUrl());
  const showDemo = !srv || (srv && ["demo", "scale"].includes(tenant));
  useEffect(() => {
    if (!srv || !tenant) return undefined;
    const tm = setTimeout(() => {
      fetch(`${serverBase()}/api/v1/config/tenant/${encodeURIComponent(tenant)}`).then((r) => r.json()).then(setTenantInfo).catch(() => setTenantInfo(null));
    }, 300);
    return () => clearTimeout(tm);
  }, [srv, tenant]);

  useEffect(() => {
    if (session) navigate(ROLE_HOME[session.role], { replace: true });
  }, [session, navigate]);

  const step = pending?.step || "credentials";

  const role = /^ADM/i.test(code.trim()) ? "admin" : code.trim() ? "emp" : "superadmin";
  function switchRole() {
    setError("");
    setFieldErr({});
  }

  function fillDemo(acc) {
    switchRole(acc.role);
    setLoginId(acc.login_id);
    setPassword(acc.password);
    setCode(acc.code || "");
    setError("");
  }

  async function submitCredentials(e) {
    e.preventDefault();
    const fe = {};
    if (!loginId.trim()) fe.loginId = "Enter your login ID.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginId.trim()) && !/^[a-z0-9._-]{3,}$/i.test(loginId.trim())) fe.loginId = "Enter a valid email or login ID.";
    if (!password) fe.password = "Enter your password.";
    if (srv && (!tenant.trim() || tenantInfo?.exists === false)) fe.tenant = tenant.trim() ? "No workspace with that ID on this server." : "Enter your workspace ID.";
    if (!captchaIn.trim()) fe.captcha = "Type the characters shown.";
    else if (captchaIn.trim().toUpperCase() !== captcha) fe.captcha = "The characters do not match. Try the new code.";
    setFieldErr(fe);
    if (Object.keys(fe).length) {
      if (fe.captcha && captchaIn) {
        setCaptcha(makeCaptcha());
        setCaptchaIn("");
      }
      return;
    }
    setBusy(true);
    setError("");
    const r = await beginLogin({ role, login_id: loginId, password, entered_code: code, remember, device_fingerprint: fingerprint });
    setBusy(false);
    setCaptcha(makeCaptcha());
    setCaptchaIn("");
    if (!r.ok) {
      // no code = Super Admin sign-in; if that is not who this is, say what is missing
      setError(role === "superadmin" && !/locked/i.test(r.error) ? "Those sign-in details do not match. Employees and admins: enter your employee or admin code." : r.error);
      setPassword("");
      return;
    }
    if (r.next === "mfa") setDemoOtp(r.otp);
  }

  async function submitMfa(e) {
    e.preventDefault();
    const fe = {};
    if (!/^\d{6}$/.test(otp.trim())) fe.otp = "Enter the 6-digit code.";
    if (pending.role === "superadmin" && !/^\d{4,6}$/.test(pin)) fe.pin = "Enter your 4–6 digit security PIN.";
    setFieldErr(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    const r = await verifyMfa({ otp, pin });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      if (r.locked) setOtp("");
      setPin("");
      return;
    }
    setError("");
    setOtp("");
    setPin("");
  }

  async function submitReset(e) {
    e.preventDefault();
    const probs = passwordProblems(newPw, { minLength: data.settings.password_min_length });
    if (probs.length) return setError(`Your new password needs: ${probs.join(", ").toLowerCase()}.`);
    if (newPw !== newPw2) return setError("The two passwords do not match.");
    setBusy(true);
    const r = await completeReset(newPw);
    setBusy(false);
    if (!r.ok) setError(r.error);
  }

  function back() {
    cancelPending();
    setError("");
    setOtp("");
    setPin("");
    setNewPw("");
    setNewPw2("");
  }

  const pendingUser = pending ? (pending.role === "emp" ? empBy[pending.code] : pending.role === "admin" ? adminBy[pending.code] : data.superAdmins.find((s) => s.superadmin_code === pending.code)) : null;

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(440px, 520px)" }, bgcolor: "background.default" }}>
      {/* Brand panel */}
      <Box sx={{ display: { xs: "none", md: "flex" }, flexDirection: "column", justifyContent: "space-between", p: 6, bgcolor: "primary.dark", color: "primary.contrastText", position: "relative", overflow: "hidden" }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", position: "relative" }}>
          <EzyHrLockup height={40} light />
        </Stack>
        <Box sx={{ position: "relative", maxWidth: 520 }}>
          <Typography sx={{  fontWeight: 700, fontSize: 40, lineHeight: 1.08, color: "#fff", letterSpacing: "-0.02em" }}>Everything made ezy: people, pay, time and compliance — run by AI.</Typography>
          <Typography sx={{ mt: 2, opacity: 0.8, fontSize: 15 }}>Local country, currency and tax for every legal entity and location. Employees self-serve, managers approve, HR sees every activity, Finance runs payroll — and AI automates the routine at a granular level.</Typography>
          <Stack spacing={1.4} sx={{ mt: 4 }}>
            {[
              [<VerifiedUserRounded key="a" />, "MFA for admins; MFA plus security PIN for super admins"],
              [<LockClockRounded key="b" />, `Account locks after ${data.settings.max_failed_attempts} failed attempts; ${data.settings.session_timeout_min}-minute idle timeout`],
              [<FingerprintRounded key="c" />, "Every sign-in logged with IP, time and device fingerprint"],
              [<HistoryRounded key="d" />, "Every submission, decision and setting change in the audit log"],
            ].map(([icon, t]) => (
              <Stack key={t} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Box sx={{ color: "#4CC3A5", display: "grid", "& svg": { fontSize: 20 } }}>{icon}</Box>
                <Typography sx={{ fontSize: 14 }}>{t}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Typography sx={{ position: "relative", fontSize: 12, opacity: 0.55 }}>EZY HR · AI-enabled HRMS by Ezyo · web, iOS & Android · demo data stays in this browser</Typography>
      </Box>

      {/* Form panel */}
      <Stack sx={{ justifyContent: "center", p: { xs: 2, sm: 4 }, py: { xs: 3, sm: 5 } }}>
        <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", alignItems: "flex-start", gap: 0.6, mb: 2 }}>
          <EzyHrLockup height={30} />
        </Box>
        <Card sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Alert severity="info" icon={false} sx={{ mb: 2, fontSize: 13 }}>New to EZY HR? <Link component="button" type="button" onClick={() => navigate("/welcome")} sx={{ fontWeight: 700 }}>Contact us & see pricing</Link></Alert>
          {logoutReason && step === "credentials" && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {logoutReason}
            </Alert>
          )}

          {step === "credentials" && (
            <Box component="form" onSubmit={submitCredentials} noValidate>
              <Typography variant="h1" sx={{ fontSize: "1.5rem" }}>
                Sign in
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                Use your work email, your employee or admin code and your password.
              </Typography>
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="device_fingerprint" value={fingerprint} />
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <Stack spacing={2}>
                {srv && (
                  <TextField label="Workspace ID" required value={tenant} onChange={(e) => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); setTenantState(v); setTenant(v); }}
                    error={!!fieldErr.tenant || tenantInfo?.exists === false}
                    helperText={fieldErr.tenant || (tenantInfo?.exists ? `${tenantInfo.name}` : tenantInfo?.exists === false ? "No workspace with that ID on this server." : "Your company's ID, e.g. acme — from your welcome e-mail.")} />
                )}
                <TextField label="Login ID (work email)" required value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" error={!!fieldErr.loginId} helperText={fieldErr.loginId} slotProps={{ htmlInput: { maxLength: 120 } }} />
                {(
                  <TextField
                    label="Employee or admin code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. EMP001 or ADM01"
                    error={!!fieldErr.code}
                    helperText={fieldErr.code || "As in the HR master. Super Admins leave this empty."} slotProps={{ htmlInput: { maxLength: 12, style: {  } } }} />
                )}
                <TextField
                  label="Password"
                  required
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock"))}
                  autoComplete="current-password"
                  error={!!fieldErr.password}
                  helperText={fieldErr.password || (caps ? "Caps Lock is on" : " ")}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPw((v) => !v)} edge="end" aria-label={showPw ? "Hide password" : "Show password"} size="small">
                            {showPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Box>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.6 }}>
                    Security check
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ alignItems: { sm: "flex-start" } }}>
                    <Captcha code={captcha} onRefresh={() => setCaptcha(makeCaptcha())} />
                    <TextField label="Type the characters" required value={captchaIn} onChange={(e) => setCaptchaIn(e.target.value)} error={!!fieldErr.captcha} helperText={fieldErr.captcha} slotProps={{ htmlInput: { maxLength: 5, autoCapitalize: "characters", style: {  letterSpacing: 2 } } }} />
                  </Stack>
                </Box>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                  <FormControlLabel control={<Checkbox size="small" checked={remember} onChange={(e) => setRemember(e.target.checked)} />} label={<Typography variant="body2">Remember me on this device</Typography>} />
                  <Tooltip title="Ask your Super Admin to reset your password. You will set a new one at your next sign-in.">
                    <Link component="button" type="button" variant="body2" underline="hover">
                      Forgot password?
                    </Link>
                  </Tooltip>
                </Stack>
                <Button type="submit" variant="contained" size="large" disabled={busy}>
                  {busy ? "Checking…" : "Continue"}
                </Button>
                <Stack direction="row" spacing={0.8} sx={{ alignItems: "center", color: "text.secondary" }}>
                  <FingerprintRounded sx={{ fontSize: 15 }} />
                  <Typography variant="caption">
                    Device <Box component="span" sx={{  }}>{fingerprint}</Box> is recorded with this sign-in.
                  </Typography>
                </Stack>
              </Stack>
            </Box>
          )}

          {step === "mfa" && (
            <Box component="form" onSubmit={submitMfa} noValidate>
              <Button startIcon={<ArrowBackRounded />} size="small" color="inherit" onClick={back} sx={{ mb: 1, ml: -1 }}>
                Back
              </Button>
              <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
                <ShieldRounded color="primary" />
                <Typography variant="h1" sx={{ fontSize: "1.4rem" }}>
                  {pending.role === "superadmin" ? "Two-factor check" : "Verify it's you"}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8, mb: 2 }}>
                {pendingUser?.full_name}, enter the 6-digit code from your authenticator app{pending.role === "superadmin" ? " and your security PIN" : ""}.
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Demo authenticator code: <b style={{  letterSpacing: 2 }}>{pending.otp || demoOtp}</b>
              </Alert>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <Stack spacing={2}>
                <TextField
                  label="One-time code (MFA)"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  autoComplete="one-time-code"
                  autoFocus
                  error={!!fieldErr.otp}
                  helperText={fieldErr.otp || <OtpCountdown expires={pending.otp_expires} />} slotProps={{ htmlInput: { inputMode: "numeric", style: {  letterSpacing: 6, fontSize: 18 } } }} />
                {pending.role === "superadmin" && (
                  <TextField label="Security PIN" required type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} error={!!fieldErr.pin} helperText={fieldErr.pin || "4–6 digits. Failed PINs count toward the lockout limit."} slotProps={{ htmlInput: { inputMode: "numeric", style: { letterSpacing: 6 } } }} />
                )}
                <Button type="submit" variant="contained" size="large" disabled={busy}>
                  {busy ? "Verifying…" : "Verify and sign in"}
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    const o = resendOtp();
                    setDemoOtp(o);
                    setError("");
                  }}
                >
                  Send a new code
                </Button>
              </Stack>
            </Box>
          )}

          {step === "reset" && (
            <Box component="form" onSubmit={submitReset} noValidate>
              <Button startIcon={<ArrowBackRounded />} size="small" color="inherit" onClick={back} sx={{ mb: 1, ml: -1 }}>
                Cancel
              </Button>
              <Typography variant="h1" sx={{ fontSize: "1.4rem" }}>
                Set your password
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8, mb: 2 }}>
                Welcome, {pendingUser?.full_name}. This is your first sign-in (or your password was reset), so choose a new password before continuing.
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <Stack spacing={2}>
                <TextField label="New password" type={showNewPw ? "text" : "password"} required value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" autoFocus slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowNewPw((v) => !v)} edge="end" aria-label={showNewPw ? "Hide password" : "Show password"} size="small">{showNewPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> } }} />
                <PasswordRules value={newPw} minLength={data.settings.password_min_length} />
                <TextField label="Confirm new password" type={showNewPw2 ? "text" : "password"} required value={newPw2} onChange={(e) => setNewPw2(e.target.value)} autoComplete="new-password" error={!!newPw2 && newPw !== newPw2} helperText={newPw2 && newPw !== newPw2 ? "Passwords do not match" : " "} slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowNewPw2((v) => !v)} edge="end" aria-label={showNewPw2 ? "Hide password" : "Show password"} size="small">{showNewPw2 ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> } }} />
                <Button type="submit" variant="contained" size="large" disabled={busy}>
                  Save password and sign in
                </Button>
              </Stack>
            </Box>
          )}
        </Card>

        {step === "credentials" && srv && (
          <Alert severity="success" icon={false} sx={{ mt: 2, fontSize: 12 }}>
            Connected to the EZY HR server{serverBase() ? ` · ${serverBase().replace(/^https?:\/\//, "")}` : ""}. Your data is stored in the company database, not in this browser.
          </Alert>
        )}
        {step === "credentials" && !srv && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5, textAlign: "center" }}>
            Using an EZY HR server? <Link component="button" type="button" onClick={() => setServerDlg(true)}>Connect to a server</Link>
          </Typography>
        )}
        <Dialog open={serverDlg} onClose={() => setServerDlg(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Connect to an EZY HR server</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>For the mobile apps or a web app hosted somewhere else. Your company's IT team gives you the address.</Typography>
            <TextField fullWidth label="Server address" placeholder="https://hr.yourcompany.com" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
          </DialogContent>
          <DialogActions>
            {savedServerUrl() && <Button color="error" onClick={() => { saveServerUrl(""); useBrowserOnly(true); window.location.reload(); }}>Use without a server</Button>}
            <Button onClick={() => setServerDlg(false)}>Cancel</Button>
            <Button variant="contained" disabled={!/^https?:\/\/.+/.test(serverUrl.trim())} onClick={() => { saveServerUrl(serverUrl); window.location.reload(); }}>Connect</Button>
          </DialogActions>
        </Dialog>
        {step === "credentials" && showDemo && (
          <Box sx={{ mt: 2.5 }}>
            <Divider sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Demo accounts · click to fill
              </Typography>
            </Divider>
            <Stack direction="row" useFlexGap spacing={0.8} sx={{ flexWrap: "wrap" }}>
              {DEMO_ACCOUNTS.map((a) => (
                <Tooltip key={a.login_id} title={`${a.login_id} · ${a.password}${a.pin ? ` · PIN ${a.pin}` : ""} — ${a.note}`}>
                  <Chip label={`${a.label}: ${a.login_id.split("@")[0]}`} onClick={() => fillDemo(a)} variant={a.role === role ? "filled" : "outlined"} size="small" color={a.role === role ? "primary" : "default"} />
                </Tooltip>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
              Super Admin password: <b>Points@2026</b> · security PIN <b>4321</b>. Every other login (admins, employees) is created by the Super Admin in Users &amp; access. The captcha still needs typing.{" "}
              {srv ? null : confirmReset ? (
                <Link
                  component="button"
                  type="button"
                  color="error"
                  onClick={() => {
                    resetDemo();
                    setConfirmReset(false);
                    setError("");
                  }}
                >
                  Click again to erase all changes
                </Link>
              ) : (
                <Link
                  component="button"
                  type="button"
                  onClick={() => {
                    setConfirmReset(true);
                    setTimeout(() => setConfirmReset(false), 4000);
                  }}
                >
                  Reset demo data
                </Link>
              )}
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
