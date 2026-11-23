// QA helper: the Super Admin creates logins for demo people (the same "Create login" the Users & access screen uses),
// then completes each person's first sign-in with the password given. Only for test / demo workspaces.
//   API=http://localhost:8080 node test/demo-logins.mjs --tenant demo --password Points@2026 EMP001 EMP007 ADM01 …
// Needs the server started with DEMO_OTP=1 (one-time codes returned in responses) — never in production.
const API = `${process.env.API || "http://localhost:8080"}/api/v1`;
const post = (p, b, t) => fetch(API + p, { method: "POST", headers: { "content-type": "application/json", ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

export async function superToken(tenant, login = "praveen.kumar@peoplehub.demo", password = "Points@2026", pin = "4321") {
  let r = await post("/auth/login", { tenant, role: "superadmin", login_id: login, password });
  r = await post("/auth/mfa", { challenge_id: r.body.challenge_id, otp: r.body.otp, pin });
  if (!r.body.token) throw new Error(`Super Admin sign-in failed: ${JSON.stringify(r.body)}`);
  return r.body.token;
}

// people: [{ role: "emp" | "admin", code, login_id }]; finish = false leaves them on the temporary password
export async function createLogins(tenant, people, { password = "Points@2026", finish = true, token } = {}) {
  const sa = token || (await superToken(tenant));
  const out = [];
  for (const p of people) {
    const r = await post("/admin/users/force-reset", { role: p.role, code: p.code }, sa);
    if (r.status !== 200) { out.push({ ...p, ok: false, error: r.body.error }); continue; }
    if (!finish) { out.push({ ...p, ok: true, temporary: "Welcome@123" }); continue; }
    let s = await post("/auth/login", { tenant, role: p.role, login_id: p.login_id, password: "Welcome@123", entered_code: p.code });
    if (s.body.next === "mfa") s = await post("/auth/mfa", { challenge_id: s.body.challenge_id, otp: s.body.otp });
    if (s.body.next === "reset") s = await post("/auth/reset-password", { challenge_id: s.body.challenge_id, new_password: password });
    out.push({ ...p, ok: !!s.body.token, error: s.body.error });
  }
  return out;
}

if (process.argv[1]?.endsWith("demo-logins.mjs")) {
  const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
  const tenant = arg("tenant", "demo");
  const password = arg("password", "Points@2026");
  const codes = process.argv.slice(2).filter((x, i, a) => !x.startsWith("--") && !a[i - 1]?.startsWith("--"));
  const sa = await superToken(tenant);
  const boot = await fetch(`${API}/bootstrap`, { headers: { authorization: `Bearer ${sa}` } }).then((r) => r.json());
  const people = codes.map((c) => {
    const a = boot.admins.find((x) => x.admin_code === c);
    if (a) return { role: "admin", code: c, login_id: a.login_id };
    const e = boot.employees.find((x) => x.employee_code === c);
    return e ? { role: "emp", code: c, login_id: e.login_id } : { role: "emp", code: c, login_id: "?" };
  });
  for (const r of await createLogins(tenant, people, { password, token: sa })) console.log(`${r.ok ? "✔" : "✖"} ${r.code} ${r.login_id}${r.error ? ` — ${r.error}` : ""}`);
}
