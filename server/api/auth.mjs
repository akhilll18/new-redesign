// Sign-in, MFA, password reset and signed session tokens.
//  • Passwords: scrypt (N=16384) with a per-user salt. Records imported from the browser version carry a plain
//    SHA-256 hash; they are accepted once and upgraded to scrypt on that sign-in.
//  • Tokens: HMAC-SHA256 signed (JWT format), short-lived, tied to a row in auth_sessions so they can be revoked.
//  • Lock-out after settings.max_failed_attempts; admins need an OTP; the Super Admin also needs the security PIN.
import { createHash, createHmac, randomBytes, randomInt, randomUUID, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { one, q } from "./db.mjs";

const scrypt = promisify(_scrypt);
const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? null : "dev-only-secret-change-me");
if (!SECRET) throw new Error("Set JWT_SECRET (32+ random characters) before starting in production.");
const TOKEN_HOURS = Number(process.env.TOKEN_HOURS || 12);
export const DEMO_OTP = process.env.DEMO_OTP === "1"; // show the one-time code in the response (demo / test only)

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const b64u = (b) => Buffer.from(b).toString("base64url");

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}
export async function checkPassword(pw, stored) {
  if (!stored) return { ok: false };
  if (stored.startsWith("scrypt$")) {
    const [, s, k] = stored.split("$");
    const key = await scrypt(pw, Buffer.from(s, "base64"), 32, { N: 16384, r: 8, p: 1 });
    const want = Buffer.from(k, "base64");
    return { ok: want.length === key.length && timingSafeEqual(want, key) };
  }
  // legacy (browser version): unsalted SHA-256 → accept once, then upgrade
  const ok = sha256(pw) === stored;
  return { ok, upgrade: ok };
}

export function signToken(payload) {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_HOURS * 3600 }));
  const s = createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}
export function readToken(tok) {
  const [h, p, s] = String(tok || "").split(".");
  if (!h || !p || !s) return null;
  const want = createHmac("sha256", SECRET).update(`${h}.${p}`).digest();
  const got = Buffer.from(s, "base64url");
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const body = JSON.parse(Buffer.from(p, "base64url").toString());
  return body.exp * 1000 > Date.now() ? body : null;
}

// Session check with a 30-second in-memory cache, so a revoked session stops working within 30 s
// without a database round trip on every request.
const seen = new Map();
export async function authenticate(req) {
  const tok = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const body = readToken(tok);
  if (!body) return null;
  const hit = seen.get(body.sid);
  if (hit && hit.until > Date.now()) return hit.ok ? body : null;
  const s = await one("UPDATE auth_sessions SET last_seen = now() WHERE session_id = $1 AND NOT revoked AND expires_at > now() RETURNING session_id", [body.sid]);
  seen.set(body.sid, { ok: !!s, until: Date.now() + 30000 });
  if (seen.size > 50000) seen.clear();
  return s ? body : null;
}

async function settingsOf(t) {
  const r = await one("SELECT doc FROM tenant_docs WHERE tenant_id = $1 AND name = 'settings'", [t]);
  return { max_failed_attempts: 5, mfa_admin_required: true, otp_ttl_sec: 300, ...(r?.doc || {}) };
}
async function findUser(t, role, login) {
  if (role === "emp")
    return one("SELECT employee_code AS code, employee_code, full_name, status, password_hash, security_pin_hash, failed_attempts, must_reset FROM employees WHERE tenant_id = $1 AND lower(login_id) = lower($2)", [t, login]);
  return one("SELECT code, employee_code, doc->>'full_name' AS full_name, status, password_hash, security_pin_hash, failed_attempts, (doc->>'must_reset')::boolean AS must_reset FROM accounts WHERE tenant_id = $1 AND role = $2 AND lower(login_id) = lower($3)", [t, role, login]);
}
const table = (role) => (role === "emp" ? ["employees", "employee_code"] : ["accounts", "code"]);
async function audit(t, code, role, action, details, ip) {
  await q("INSERT INTO audit_log (tenant_id, log_id, ts, user_code, role, action, ip, details, doc) VALUES ($1, $2, now(), $3, $4, $5, $6, $7, $8)",
    [t, `AUD-S${Date.now()}${randomInt(1000)}`, code, role, action, ip, details, JSON.stringify({ user_code: code, role, action, details, ip, timestamp: new Date().toISOString(), source: "server" })]);
}
async function openSession(t, role, code, employee_code, req) {
  const sid = randomUUID();
  await q("INSERT INTO auth_sessions (session_id, tenant_id, role, code, expires_at, ip, user_agent) VALUES ($1,$2,$3,$4, now() + make_interval(hours => $5), $6, $7)",
    [sid, t, role, code, TOKEN_HOURS, req.ip, String(req.headers["user-agent"] || "").slice(0, 200)]);
  const [tb, key] = table(role);
  await q(`UPDATE ${tb} SET failed_attempts = 0, ${role === "emp" ? "last_login = now()," : ""} updated_at = now() WHERE tenant_id = $1 AND ${key} = $2`, [t, code]);
  await audit(t, code, role, "LOGIN_SUCCESS", "Signed in (server)", req.ip);
  return { token: signToken({ sid, t, role, code, emp: employee_code || (role === "emp" ? code : null) }), role, code };
}
async function challenge(t, role, code, step) {
  const id = randomUUID();
  const otp = String(randomInt(100000, 1000000));
  const s = await settingsOf(t);
  await q("INSERT INTO auth_challenges (challenge_id, tenant_id, role, code, step, otp_hash, expires_at) VALUES ($1,$2,$3,$4,$5,$6, now() + make_interval(secs => $7))", [id, t, role, code, step, sha256(otp), s.otp_ttl_sec || 300]);
  // production: deliver the OTP by authenticator / SMS / e-mail here
  return { challenge_id: id, ...(DEMO_OTP && step === "mfa" ? { otp } : {}) };
}

export async function login(req) {
  const { tenant = "demo", role, login_id, password, entered_code } = req.body || {};
  if (!["emp", "admin", "superadmin"].includes(role) || !login_id || !password) return { status: 400, body: { error: "Role, login ID and password are required." } };
  const u = await findUser(tenant, role, login_id.trim());
  const s = await settingsOf(tenant);
  if (!u) { await audit(tenant, login_id, role, "LOGIN_FAILED", "Unknown login ID", req.ip); return { status: 401, body: { error: "Those sign-in details do not match." } }; }
  if (u.status === "locked") return { status: 423, body: { error: `This account is locked after ${s.max_failed_attempts} failed attempts. Ask your Super Admin to unlock it.` } };
  const codeOk = role === "superadmin" || String(entered_code || "").trim().toUpperCase() === u.code;
  // v10.9: the Super Admin creates every other login; until then the person gets a clear answer (no attempt counted)
  if (!u.password_hash && codeOk) {
    await audit(tenant, u.code, role, "LOGIN_NO_ACCOUNT", "No login created yet", req.ip);
    return { status: 403, body: { error: "You don't have a login yet. Ask your Super Admin to create one for you.", no_login: true } };
  }
  const pw = await checkPassword(password, u.password_hash);
  const [tb, key] = table(role);
  if (!pw.ok || !codeOk) {
    const r = await one(`UPDATE ${tb} SET failed_attempts = failed_attempts + 1, status = CASE WHEN failed_attempts + 1 >= $3 THEN 'locked' ELSE status END WHERE tenant_id = $1 AND ${key} = $2 RETURNING failed_attempts, status`, [tenant, u.code, s.max_failed_attempts]);
    await audit(tenant, u.code, role, r.status === "locked" ? "ACCOUNT_LOCKED" : "LOGIN_FAILED", `${pw.ok ? "Code did not match" : "Wrong password"} (attempt ${r.failed_attempts} of ${s.max_failed_attempts})`, req.ip);
    if (r.status === "locked") {
      // tell every Super Admin of this company (same as the browser edition)
      const sas = await q("SELECT code FROM accounts WHERE tenant_id = $1 AND role = 'superadmin' AND status = 'active'", [tenant]);
      for (const sa of sas.rows) {
        const id = `N-S${Date.now()}${randomInt(1000)}`;
        await q("INSERT INTO notifications (tenant_id, id, at, recipient, doc) VALUES ($1, $2, now(), $3, $4)",
          [tenant, id, sa.code, JSON.stringify({ id, to: sa.code, text: `${u.full_name || u.code} (${u.code}) was locked after ${s.max_failed_attempts} failed sign-ins.`, at: new Date().toISOString(), read: false, link: "/users" })]);
      }
      return { status: 423, body: { error: `Account locked after ${s.max_failed_attempts} failed attempts. Ask your Super Admin to unlock it.` } };
    }
    const left = s.max_failed_attempts - r.failed_attempts;
    return { status: 401, body: { error: `Those sign-in details do not match. ${left} attempt${left === 1 ? "" : "s"} left before the account locks.` } };
  }
  if (pw.upgrade) await q(`UPDATE ${tb} SET password_hash = $3 WHERE tenant_id = $1 AND ${key} = $2`, [tenant, u.code, await hashPassword(password)]);
  if (u.status !== "active") {
    await audit(tenant, u.code, role, "LOGIN_BLOCKED", `Status: ${u.status}`, req.ip);
    const msg = { suspended: "This account is suspended. Contact your HR administrator.", pending_approval: "Your account is waiting for approval by HR. You will be notified when it is activated." }[u.status] || "This account request was declined. Contact HR.";
    return { status: 403, body: { error: msg } };
  }
  if ((role === "admin" && s.mfa_admin_required) || role === "superadmin") return { status: 200, body: { next: "mfa", ...(await challenge(tenant, role, u.code, "mfa")) } };
  if (u.must_reset) return { status: 200, body: { next: "reset", ...(await challenge(tenant, role, u.code, "reset")) } };
  return { status: 200, body: { next: "done", ...(await openSession(tenant, role, u.code, u.employee_code, req)) } };
}

export async function verifyMfa(req) {
  const { challenge_id, otp, pin } = req.body || {};
  const c = await one("UPDATE auth_challenges SET attempts = attempts + 1 WHERE challenge_id = $1 AND step = 'mfa' RETURNING *", [challenge_id]);
  if (!c || new Date(c.expires_at) < new Date()) return { status: 401, body: { error: "That code has expired. Send a new one." } };
  if (c.attempts > 5) return { status: 429, body: { error: "Too many tries. Start again." } };
  if (sha256(String(otp || "").trim()) !== c.otp_hash) { await audit(c.tenant_id, c.code, c.role, "MFA_FAILED", "Wrong one-time code", req.ip); return { status: 401, body: { error: "That code is not right. Check your authenticator and try again." } }; }
  const u = await one(`SELECT code, employee_code, security_pin_hash, (doc->>'must_reset')::boolean AS must_reset FROM accounts WHERE tenant_id = $1 AND code = $2`, [c.tenant_id, c.code]);
  if (c.role === "superadmin") {
    const p = await checkPassword(String(pin || ""), u.security_pin_hash);
    if (!p.ok) {
      const s = await settingsOf(c.tenant_id);
      const r = await one("UPDATE accounts SET failed_attempts = failed_attempts + 1, status = CASE WHEN failed_attempts + 1 >= $3 THEN 'locked' ELSE status END WHERE tenant_id = $1 AND code = $2 RETURNING failed_attempts, status", [c.tenant_id, c.code, s.max_failed_attempts]);
      await audit(c.tenant_id, c.code, c.role, "PIN_FAILED", `Wrong security PIN (attempt ${r.failed_attempts})`, req.ip);
      return { status: 401, body: { error: r.status === "locked" ? "Account locked after repeated security PIN failures." : "That security PIN is not right.", locked: r.status === "locked" } };
    }
    if (p.upgrade) await q("UPDATE accounts SET security_pin_hash = $3 WHERE tenant_id = $1 AND code = $2", [c.tenant_id, c.code, await hashPassword(String(pin))]);
  }
  await q("DELETE FROM auth_challenges WHERE challenge_id = $1", [challenge_id]);
  if (u.must_reset) return { status: 200, body: { next: "reset", ...(await challenge(c.tenant_id, c.role, c.code, "reset")) } };
  return { status: 200, body: { next: "done", ...(await openSession(c.tenant_id, c.role, c.code, u.employee_code, req)) } };
}

export async function completeReset(req) {
  const { challenge_id, new_password } = req.body || {};
  if (!new_password || String(new_password).length < 8) return { status: 400, body: { error: "Use at least 8 characters." } };
  const c = await one("DELETE FROM auth_challenges WHERE challenge_id = $1 AND step = 'reset' AND expires_at > now() RETURNING *", [challenge_id]);
  if (!c) return { status: 401, body: { error: "Your sign-in expired. Start again." } };
  const [tb, key] = table(c.role);
  const cur = await one(`SELECT password_hash, employee_code FROM ${tb} WHERE tenant_id = $1 AND ${key} = $2`, [c.tenant_id, c.code]);
  if ((await checkPassword(new_password, cur.password_hash)).ok) return { status: 400, body: { error: "Choose a password different from the temporary one." } };
  await q(`UPDATE ${tb} SET password_hash = $3, ${c.role === "emp" ? "must_reset = false" : "doc = jsonb_set(doc, '{must_reset}', 'false')"} WHERE tenant_id = $1 AND ${key} = $2`, [c.tenant_id, c.code, await hashPassword(new_password)]);
  await audit(c.tenant_id, c.code, c.role, "PASSWORD_RESET", "First-time password set", req.ip);
  return { status: 200, body: { next: "done", ...(await openSession(c.tenant_id, c.role, c.code, cur.employee_code || (c.role === "emp" ? c.code : null), req)) } };
}

export async function changePassword(auth, req) {
  const { current, next } = req.body || {};
  if (!next || String(next).length < 8) return { status: 400, body: { error: "Use at least 8 characters." } };
  const [tb, key] = table(auth.role);
  const cur = await one(`SELECT password_hash FROM ${tb} WHERE tenant_id = $1 AND ${key} = $2`, [auth.t, auth.code]);
  if (!(await checkPassword(String(current || ""), cur?.password_hash)).ok) return { status: 400, body: { error: "Your current password is not right." } };
  await q(`UPDATE ${tb} SET password_hash = $3 WHERE tenant_id = $1 AND ${key} = $2`, [auth.t, auth.code, await hashPassword(next)]);
  await q("UPDATE auth_sessions SET revoked = true WHERE tenant_id = $1 AND code = $2 AND session_id <> $3", [auth.t, auth.code, auth.sid]);
  await audit(auth.t, auth.code, auth.role, "PASSWORD_CHANGED", "Changed from profile; other sessions signed out", req.ip);
  return { status: 200, body: { ok: true } };
}

export async function logout(auth, req) {
  await q("UPDATE auth_sessions SET revoked = true WHERE session_id = $1", [auth.sid]);
  seen.delete(auth.sid);
  await audit(auth.t, auth.code, auth.role, "LOGOUT", "Signed out (server)", req.ip);
  return { status: 200, body: { ok: true } };
}
