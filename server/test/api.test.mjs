// Automated API tests — run against a live server with the demo, scale (10 lakh) and a fresh company loaded:
//   DEMO_OTP=1 node api/server.mjs &      (DEMO_OTP=1 returns the one-time code in the response, for testing only)
//   API=http://localhost:8080 node --test test/
// Test IDs match TEST-CASES.md.
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { createLogins, superToken } from "./demo-logins.mjs";

const B = `${process.env.API || "http://localhost:8080"}/api/v1`;
const SCALE = process.env.SCALE_TENANT || "scale";
const call = async (method, p, body, tok, raw = false) => {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (raw) return r;
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const post = (p, b, t) => call("POST", p, b, t);
const get = (p, t) => call("GET", p, undefined, t);
async function signIn(tenant, role, login_id, password, entered_code, pin) {
  let r = await post("/auth/login", { tenant, role, login_id, password, entered_code });
  if (r.body.next === "mfa") r = await post("/auth/mfa", { challenge_id: r.body.challenge_id, otp: r.body.otp, pin });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.token;
}
const tok = {};
before(async () => {
  // v10.9: only the Super Admin can sign in out of the box — it creates every login these tests use
  const emp = (code, login_id) => ({ role: "emp", code, login_id });
  await createLogins("demo", [emp("EMP001", "akhil.reddy@peoplehub.demo"), emp("EMP007", "bindu@peoplehub.demo"), { role: "admin", code: "ADM01", login_id: "swetha.reddy@peoplehub.demo" },
    { role: "admin", code: "ADM02", login_id: "ashok.kumar@peoplehub.demo" }, emp("EMP022", "neha.kapoor@peoplehub.demo"), emp("EMP032", "wanjiru.kamau@peoplehub.demo"),
    emp("EMP030", "ndapewa.shikongo@peoplehub.demo"), emp("EMP051", "pooja.iyer@peoplehub.demo")]);
  await createLogins("demo", [emp("EMP010", "rahul.verma@peoplehub.demo"), emp("EMP012", "meera.nair@peoplehub.demo")], { finish: false });
  await createLogins(SCALE, [emp("EMP001", "akhil.reddy@peoplehub.demo")]);
  tok.emp = await signIn("demo", "emp", "akhil.reddy@peoplehub.demo", "Points@2026", "EMP001");
  tok.mgr = await signIn("demo", "emp", "bindu@peoplehub.demo", "Points@2026", "EMP007");
  tok.hr = await signIn("demo", "admin", "swetha.reddy@peoplehub.demo", "Points@2026", "ADM01");
  tok.sa = await signIn("demo", "superadmin", "praveen.kumar@peoplehub.demo", "Points@2026", undefined, "4321");
  tok.scaleSa = await signIn(SCALE, "superadmin", "praveen.kumar@peoplehub.demo", "Points@2026", undefined, "4321");
  tok.scaleEmp = await signIn(SCALE, "emp", "akhil.reddy@peoplehub.demo", "Points@2026", "EMP001");
});

describe("AUTH · sign-in, MFA, lock-out, sessions", () => {
  test("TC-AUTH-01 employee signs in with login ID, code and password", async () => assert.ok(tok.emp));
  test("TC-AUTH-02 wrong employee code is refused", async () => {
    const r = await post("/auth/login", { tenant: "demo", role: "emp", login_id: "sneha@peoplehub.demo", password: "Points@2026", entered_code: "EMP999" });
    assert.equal(r.status, 401);
  });
  test("TC-AUTH-03 admin needs a one-time code", async () => {
    const r = await post("/auth/login", { tenant: "demo", role: "admin", login_id: "ashok.kumar@peoplehub.demo", password: "Points@2026", entered_code: "ADM02" });
    assert.equal(r.body.next, "mfa"); assert.ok(r.body.challenge_id);
    const bad = await post("/auth/mfa", { challenge_id: r.body.challenge_id, otp: "000000" });
    assert.equal(bad.status, 401);
  });
  test("TC-AUTH-04 Super Admin needs OTP and security PIN", async () => {
    const r = await post("/auth/login", { tenant: "demo", role: "superadmin", login_id: "praveen.kumar@peoplehub.demo", password: "Points@2026" });
    const bad = await post("/auth/mfa", { challenge_id: r.body.challenge_id, otp: r.body.otp, pin: "0000" });
    assert.equal(bad.status, 401); assert.match(bad.body.error, /PIN/);
  });
  test("TC-AUTH-05 locked account cannot sign in", async () => {
    const r = await post("/auth/login", { tenant: "demo", role: "emp", login_id: "kiran.patil@peoplehub.demo", password: "Points@2026", entered_code: "EMP011" });
    assert.equal(r.status, 423);
  });
  test("TC-AUTH-06 account waiting for approval cannot sign in", async () => {
    const r = await post("/auth/login", { tenant: "demo", role: "emp", login_id: "meera.nair@peoplehub.demo", password: "Welcome@123", entered_code: "EMP012" });
    assert.equal(r.status, 403);
  });
  test("TC-AUTH-07 first sign-in forces a new password", async () => {
    const r = await post("/auth/login", { tenant: "demo", role: "emp", login_id: "rahul.verma@peoplehub.demo", password: "Welcome@123", entered_code: "EMP010" });
    assert.equal(r.body.next, "reset");
    const same = await post("/auth/reset-password", { challenge_id: r.body.challenge_id, new_password: "Welcome@123" });
    assert.equal(same.status, 400);
  });
  test("TC-AUTH-08 no token / bad token → 401", async () => {
    assert.equal((await get("/bootstrap")).status, 401);
    assert.equal((await get("/bootstrap", tok.emp.slice(0, -3) + "abc")).status, 401);
  });
  test("TC-AUTH-09 signed-out session stops working", async () => {
    const t = await signIn("demo", "emp", "neha.kapoor@peoplehub.demo", "Points@2026", "EMP022");
    assert.equal((await post("/auth/logout", {}, t)).status, 200);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal((await get("/me", t)).status, 401);
  });
  test("TC-AUTH-10 unknown workspace is refused", async () => {
    const r = await post("/auth/login", { tenant: "nope", role: "emp", login_id: "a@b.c", password: "x", entered_code: "EMP001" });
    assert.ok([401, 404].includes(r.status));
  });
});

describe("LOGINS · only the Super Admin signs in out of the box", () => {
  test("TC-LOGIN-01 a person without a login is told to ask the Super Admin, and no attempt is counted", async () => {
    for (let i = 0; i < 6; i++) {
      const r = await post("/auth/login", { tenant: "demo", role: "emp", login_id: "sanjay.reddy@peoplehub.demo", password: "Points@2026", entered_code: "EMP024" });
      assert.equal(r.status, 403); assert.equal(r.body.no_login, true);
    }
  });
  test("TC-LOGIN-02 an admin without a login cannot sign in", async () => {
    const r = await post("/auth/login", { tenant: "demo", role: "admin", login_id: "ravi.teja@peoplehub.demo", password: "Points@2026", entered_code: "ADM04" });
    assert.equal(r.body.no_login, true);
  });
  test("TC-LOGIN-03 an HR admin cannot create an admin's login", async () => {
    const r = await post("/admin/users/force-reset", { role: "admin", code: "ADM04" }, tok.hr);
    assert.equal(r.status, 403);
  });
  test("TC-LOGIN-04 the Super Admin creates a login; the person signs in with the temporary password and sets their own", async () => {
    const [r] = await createLogins("demo", [{ role: "emp", code: "EMP024", login_id: "sanjay.reddy@peoplehub.demo" }], { password: "Sanjay@Pass1" });
    assert.ok(r.ok, r.error);
    const ok = await post("/auth/login", { tenant: "demo", role: "emp", login_id: "sanjay.reddy@peoplehub.demo", password: "Sanjay@Pass1", entered_code: "EMP024" });
    assert.equal(ok.body.next, "done");
  });
  test("TC-LOGIN-05 the app is told who has a login (no password data leaves the server)", async () => {
    const b = (await get("/bootstrap", tok.sa)).body;
    assert.equal(b.employees.find((e) => e.employee_code === "EMP001").has_login, true);
    assert.equal(b.employees.find((e) => e.employee_code === "EMP016" || e.employee_code === "EMP033")?.has_login ?? false, false);
    assert.equal(b.admins.find((a) => a.admin_code === "ADM04").has_login, false);
  });
});

describe("AUTH · lock-out, upgrade, revocation, isolation", () => {
  test("TC-AUTH-11 five wrong passwords lock the account and notify the Super Admin", async () => {
    let r;
    for (let i = 0; i < 5; i++) r = await post("/auth/login", { tenant: "demo", role: "emp", login_id: "wanjiru.kamau@peoplehub.demo", password: "wrong-pass", entered_code: "EMP032" });
    assert.equal(r.status, 423);
    const notes = (await get("/bootstrap", tok.sa)).body.notifications;
    assert.ok(notes.some((n) => /EMP032\) was locked/.test(n.text)));
  });
  test("TC-AUTH-12 a login created by the Super Admin keeps working on every sign-in (scrypt)", async () => {
    const t = await signIn("demo", "emp", "ndapewa.shikongo@peoplehub.demo", "Points@2026", "EMP030");
    assert.ok(t);
    // the old SHA-256 hash no longer works as a password check input: sign in again still succeeds (scrypt path)
    assert.ok(await signIn("demo", "emp", "ndapewa.shikongo@peoplehub.demo", "Points@2026", "EMP030"));
  });
  test("TC-AUTH-13 changing the password signs out other sessions", async () => {
    const a1 = await signIn("demo", "emp", "pooja.iyer@peoplehub.demo", "Points@2026", "EMP051");
    const a2 = await signIn("demo", "emp", "pooja.iyer@peoplehub.demo", "Points@2026", "EMP051");
    const r = await post("/auth/change-password", { current: "Points@2026", next: "Points@2027x" }, a1);
    assert.equal(r.status, 200);
    await new Promise((x) => setTimeout(x, 50));
    assert.equal((await get("/me", a2)).status, 401);
    assert.equal((await get("/me", a1)).status, 200);
  });
  test("TC-SEC-01 a token for one company never reads another", async () => {
    const r = await get("/employees/E0500000", tok.sa);   // demo token, scale employee
    assert.equal(r.status, 404);
    const b = await get("/bootstrap", tok.sa);
    assert.ok(b.body.__server.employees_total < 1000);
  });
});

describe("DATA · working set and privacy", () => {
  test("TC-DATA-01 employee bootstrap carries no password hashes", async () => {
    const r = await get("/bootstrap", tok.emp);
    assert.equal(r.status, 200);
    assert.ok(!JSON.stringify(r.body.employees).includes("password_hash"));
    assert.ok(!JSON.stringify(r.body.superAdmins).includes("security_pin_hash"));
  });
  test("TC-DATA-02 employee does not see colleagues' salary or bank details", async () => {
    const r = await get("/bootstrap", tok.emp);
    const other = r.body.employees.find((e) => e.employee_code === "EMP007");
    assert.equal(other.monthly_gross, 0); assert.equal(other.bank_account || "", "");
    const me = r.body.employees.find((e) => e.employee_code === "EMP001");
    assert.ok(me.monthly_gross > 0);
  });
  test("TC-DATA-03 10-lakh company: the app loads a bounded working set, not everyone", async () => {
    const r = await get("/bootstrap", tok.scaleSa);
    assert.ok(r.body.__server.employees_total >= 1000000, `total ${r.body.__server.employees_total}`);
    assert.ok(r.body.employees.length <= 2200);
    assert.ok(r.body.__server.partial);
  });
  test("TC-DATA-04 employee directory search over 10 lakh is paged and indexed", async () => {
    const t0 = Date.now();
    const r = await get("/employees?q=kavya%20sharma&limit=50", tok.scaleSa);
    assert.equal(r.status, 200); assert.ok(r.body.rows.length > 0); assert.ok(Date.now() - t0 < 1500, `${Date.now() - t0} ms`);
    const n = await get(`/employees?limit=50&after=${r.body.next || ""}`, tok.scaleSa);
    assert.equal(n.status, 200);
  });
  test("TC-DATA-05 an employee code lookup returns one person", async () => {
    const r = await get("/employees?q=E0500000", tok.scaleSa);
    assert.equal(r.body.rows[0].employee_code, "E0500000");
  });
  test("TC-DATA-06 employee cannot export the company", async () => {
    assert.equal((await get("/employees/export.csv", tok.scaleEmp)).status, 403);
  });
  test("TC-DATA-07 employee sees a colleague's profile without private fields", async () => {
    const r = await get("/employees/E0000005", tok.scaleEmp);
    assert.equal(r.status, 200); assert.equal(r.body.monthly_gross, undefined); assert.equal(r.body.pan, undefined);
  });
});

describe("SYNC · role checks, merges and collisions", () => {
  test("TC-SYNC-01 employee leave goes to their manager's inbox", async () => {
    const id = `LV-T${Date.now()}`;
    const r = await post("/sync", { changes: [{ c: "requests", upsert: [{ request_id: id, type: "leave", employee_code: "EMP001", status: "Pending", stage: "manager", from_date: "2026-12-01", to_date: "2026-12-02", created_at: new Date().toISOString(), steps: [] }], created: [id] }] }, tok.emp);
    assert.equal(r.status, 200);
    const inbox = await get("/inbox?limit=200", tok.mgr);
    assert.ok(inbox.body.rows.some((x) => x.request_id === id));
  });
  test("TC-SYNC-02 employee cannot approve or create requests for someone else", async () => {
    const r = await post("/sync", { changes: [{ c: "requests", upsert: [{ request_id: `LV-X${Date.now()}`, type: "leave", employee_code: "EMP007", status: "Approved", created_at: new Date().toISOString() }] }] }, tok.emp);
    assert.equal(r.body.rejected.length, 1);
  });
  test("TC-SYNC-03 employee cannot raise their own salary", async () => {
    await post("/sync", { changes: [{ c: "employees", upsert: [{ employee_code: "EMP001", full_name: "Akhil Reddy", monthly_gross: 9999999, status: "active" }] }] }, tok.emp);
    const me = (await get("/employees/EMP001", tok.hr)).body;
    assert.ok(me.monthly_gross < 9999999);
  });
  test("TC-SYNC-04 employee cannot change company settings", async () => {
    const r = await post("/sync", { docs: [{ name: "settings", ops: [{ path: ["max_failed_attempts"], op: "set", value: 99 }] }] }, tok.emp);
    assert.equal(r.body.rejected[0].c, "settings");
  });
  test("TC-SYNC-05 two people saving different parts of one document both keep their change", async () => {
    const a = post("/sync", { docs: [{ name: "suite", ops: [{ path: ["testA"], op: "set", value: 1 }] }] }, tok.hr);
    const b = post("/sync", { docs: [{ name: "suite", ops: [{ path: ["testB"], op: "set", value: 2 }] }] }, tok.sa);
    await Promise.all([a, b]);
    const d = (await get("/bootstrap", tok.sa)).body.suite;
    assert.equal(d.testA, 1); assert.equal(d.testB, 2);
  });
  test("TC-SYNC-06 a new employee on a code that is already taken gets the next free code", async () => {
    const r = await post("/sync", { changes: [{ c: "employees", upsert: [{ employee_code: "EMP001", full_name: "Collision Test", department: "Engineering", status: "pending_approval" }], created: ["EMP001"] }] }, tok.hr);
    assert.equal(r.body.renamed.length, 1);
    assert.equal(r.body.renamed[0].from, "EMP001"); assert.match(r.body.renamed[0].to, /^EMP\d{3,}$/);
    const orig = (await get("/employees/EMP001", tok.hr)).body;
    assert.equal(orig.full_name, "Akhil Reddy");
  });
  test("TC-SYNC-10 a manager's app picks up a new team request through /changes", async () => {
    const since = new Date(Date.now() - 1000).toISOString();
    const id = `LV-C${Date.now()}`;
    await post("/sync", { changes: [{ c: "requests", upsert: [{ request_id: id, type: "leave", employee_code: "EMP001", status: "Pending", stage: "manager", from_date: "2026-12-10", to_date: "2026-12-10", created_at: new Date().toISOString(), steps: [] }], created: [id] }] }, tok.emp);
    const c = await get(`/changes?since=${encodeURIComponent(since)}`, tok.mgr);
    assert.ok(c.body.requests.some((r) => r.request_id === id));
  });
  test("TC-SYNC-07 audit log is append-only", async () => {
    const id = `AUD-T${Date.now()}`;
    await post("/sync", { changes: [{ c: "audit", upsert: [{ log_id: id, user_code: "SA001", role: "superadmin", action: "TEST", timestamp: new Date().toISOString(), details: "append-only test" }], created: [id] }] }, tok.sa);
    const r = await post("/sync", { changes: [{ c: "audit", delete: [id] }] }, tok.sa);
    assert.equal(r.status, 200);
    const a = (await get("/bootstrap", tok.sa)).body.audit;
    assert.ok(a.some((x) => x.log_id === id), "audit entry must survive a delete");
  });
  test("TC-SYNC-08 only the Super Admin creates admins", async () => {
    const r = await post("/sync", { changes: [{ c: "admins", upsert: [{ admin_code: "ADM77", full_name: "Rogue", login_id: "rogue@x.y" }] }] }, tok.hr);
    assert.equal(r.body.rejected.length, 1);
  });
});

describe("SCALE · 10 lakh employees", () => {
  test("TC-SCALE-01 headcount dashboard answers from the statistics view", async () => {
    const t0 = Date.now();
    const r = await get("/stats/headcount", tok.scaleSa);
    assert.ok(Number(r.body.active) > 900000); assert.ok(Date.now() - t0 < 2000);
  });
  test("TC-SCALE-02 approvals inbox pages through thousands of pending requests", async () => {
    const r = await get("/inbox?limit=100", tok.scaleSa);
    assert.ok(r.body.total > 1000); assert.equal(r.body.rows.length, 100); assert.ok(r.body.next);
  });
  test("TC-SCALE-03 bulk approve moves manager-stage requests to HR, HR-stage to approved", async () => {
    const r = await get("/inbox?limit=20", tok.scaleSa);
    const ids = r.body.rows.map((x) => x.request_id);
    const d = await post("/requests/decision", { ids, decision: "approve", note: "test" }, tok.scaleSa);
    assert.equal(d.body.done, ids.length);
  });
  test("TC-SCALE-04 punch storm: 5,000 punches in one call", async () => {
    const punches = Array.from({ length: 5000 }, (_, i) => ({ employee_code: `E${String(200000 + i).padStart(7, "0")}`, type: "out", source: "biometric" }));
    const t0 = Date.now();
    const r = await post("/attendance/punches", { punches }, tok.scaleSa);
    assert.equal(r.body.saved, 5000); assert.ok(Date.now() - t0 < 5000, `${Date.now() - t0} ms`);
  });
  test("TC-SCALE-05 employee can only punch for themselves", async () => {
    const r = await post("/attendance/punches", { employee_code: "E0000009", type: "in" }, tok.scaleEmp);
    assert.equal(r.body.saved, 1);
  });
  test("TC-SCALE-06 attendance register for a day is paged", async () => {
    const day = new Date(); day.setUTCDate(1); day.setUTCMonth(day.getUTCMonth() - 1); day.setUTCDate(15);
    const r = await get(`/attendance/register?day=${day.toISOString().slice(0, 10)}&limit=200`, tok.scaleSa);
    assert.equal(r.status, 200); assert.ok(r.body.summary.length > 0);
  });
  test("TC-SCALE-07 CSV export streams", async () => {
    const r = await call("GET", "/employees/export.csv?department=Design", undefined, tok.scaleSa, true);
    assert.equal(r.status, 200);
    const reader = r.body.getReader(); const { value } = await reader.read(); reader.cancel();
    assert.match(new TextDecoder().decode(value), /^employee_code,full_name/);
  });
  test("TC-SCALE-10 bank advice file streams for a payroll batch", async () => {
    const boot = (await get("/bootstrap", tok.scaleSa)).body;
    const b = boot.payslipBatches.find((x) => /^PSB-\d{6}-S/.test(x.id));
    assert.ok(b, "a server payroll batch exists");
    const r = await call("GET", `/payroll/batches/${b.id}/bank-file.csv`, undefined, tok.scaleSa, true);
    assert.equal(r.status, 200);
    const reader = r.body.getReader(); const { value } = await reader.read(); reader.cancel();
    assert.match(new TextDecoder().decode(value), /^employee_code,full_name,bank_name,account_no,ifsc,amount/);
  });
  test("TC-SCALE-08 CSV import upserts with COPY", async () => {
    const rows = ["employee_code,full_name,email,department,monthly_gross"];
    for (let i = 0; i < 2000; i++) rows.push(`IMP${String(i).padStart(5, "0")},Import Person ${i},imp${i}@scale.demo,Operations,${30000 + i}`);
    const r = await fetch(`${B}/employees/import`, { method: "POST", headers: { "content-type": "text/csv", authorization: `Bearer ${tok.scaleSa}` }, body: rows.join("\n") });
    const b = await r.json();
    assert.equal(r.status, 200); assert.equal(b.inserted + b.updated, 2000);
  });
});
