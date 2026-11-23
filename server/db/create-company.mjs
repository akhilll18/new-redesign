// Creates a new, empty company (tenant) with ONE sign-in: its Super Admin.
// The Super Admin then creates admins and employees from inside the app — no code change, no rebuild.
//
//   node db/create-company.mjs --tenant acme --name "Acme Industries Pvt Ltd" --country IN \
//        --owner "Priya Shah" --email priya@acme.in --password "Strong@Pass1" --pin 482913
//
// The same function backs POST /api/v1/signup (the pricing page) when ALLOW_SIGNUP=1.
import { pool } from "../api/db.mjs";
import { hashPassword } from "../api/auth.mjs";
import { migrate } from "./migrate.mjs";
import { importDataset } from "./seed-demo.mjs";

// Configuration lists that a new company starts with (leave types, holidays, pay components, …).
export async function createCompany({ tenant, name, country = "IN", owner, email, password, pin, phone = "", plan = "growth" }) {
  tenant = String(tenant || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  if (!tenant || tenant.length < 3) throw new Error("Workspace ID needs at least 3 letters or numbers.");
  if ((await pool.query("SELECT 1 FROM tenants WHERE tenant_id = $1", [tenant])).rowCount) throw new Error(`Workspace "${tenant}" already exists.`);
  if (!password || password.length < 8) throw new Error("The Super Admin password needs at least 8 characters.");
  if (!/^\d{4,6}$/.test(String(pin || ""))) throw new Error("The security PIN needs 4 to 6 digits.");
  const { buildDemoSeed } = await import("../../src/data/seed.js");
  const { freshCompany } = await import("../../src/data/freshCompany.js");
  const seed = buildDemoSeed();
  const data = freshCompany(seed, { full_name: owner, email, phone });   // Super Admin + company set-up, no sample people
  const company_id = `${tenant.toUpperCase().slice(0, 8)}-${country}`;
  const location_id = `${country}-HQ`;
  const today = new Date().toISOString().slice(0, 10);
  const ccy = { IN: "INR", AE: "AED", SG: "SGD", GB: "GBP", US: "USD", KE: "KES", NA: "NAD" }[country] || "INR";
  data.companies = [{ company_id, name, short: name.split(" ")[0], country, currency: ccy, status: "active", payroll_mode: "hybrid", default_language: "English", address: "", registration: "", tax_id: "", statutory: {} }];
  data.workLocations = [{ location_id, company_id, name: "Head Office", city: "", country, status: "active" }];
  data.orgUnits = [{ org_unit_id: "Head Office", name: "Head Office", parent_unit: null }];
  // one geofence for the head office (move it to the real address in Attendance → Geofences)
  data.geofences = [{ id: "GF-HQ", name: `${name.split(" ")[0]} Head Office`, lat: 17.4474, lng: 78.3762, radius_m: 200, type: "office", country, active: true }];
  Object.assign(data.employees[0], { company_id, location_id, country_code: country, primary_geofence: "GF-HQ", date_of_joining: today });
  data.settings = { ...seed.settings, payslip_company: { ...(seed.settings.payslip_company || {}), legal_name: name } };
  await importDataset(tenant, data, { name, log: () => {} });
  const pw = await hashPassword(password);
  await pool.query("UPDATE accounts SET password_hash = $2, security_pin_hash = $3 WHERE tenant_id = $1 AND code = 'SA001'", [tenant, pw, await hashPassword(String(pin))]);
  // The owner's employee record uses the same password for "My employee space" sign-in.
  await pool.query("UPDATE employees SET password_hash = $2 WHERE tenant_id = $1 AND employee_code = 'EMP001'", [tenant, pw]);
  await pool.query("UPDATE tenants SET plan = $2 WHERE tenant_id = $1", [tenant, plan]);
  return { tenant, company_id, super_admin: { login_id: email, code: "SA001" } };
}

if (process.argv[1]?.endsWith("create-company.mjs")) {
  const arg = (k, def) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : def; };
  (async () => {
    await migrate({ quiet: true });
    const r = await createCompany({ tenant: arg("tenant"), name: arg("name", "New company"), country: arg("country", "IN"), owner: arg("owner", "Super Admin"), email: arg("email"), password: arg("password"), pin: arg("pin") });
    console.log(`Created workspace "${r.tenant}". Sign in as Super Admin with ${r.super_admin.login_id} (workspace ID: ${r.tenant}).`);
    await pool.end();
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
