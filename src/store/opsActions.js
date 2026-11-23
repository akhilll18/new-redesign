import { demoIp, deviceLabel } from "../lib/utils.js";
// Store actions for workforce, talent and operations modules. Each mirrors one REST endpoint (README).
// Built once per provider; reads the live session and data through refs.
import { nearestGeofence, fencesFor, fmtDistance, haversine } from "../lib/geo.js";
import { nowIso, nextSeq, isoDate } from "../lib/utils.js";

const err = (error) => ({ ok: false, error });

export function makeOpsActions({ mutate, dataRef, sessionRef, pushAudit, pushNote }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;
  const me = (x) => x.employees.find((e) => e.employee_code === S()?.code);
  const adminsWith = (x, module) => x.admins.filter((a) => a.status === "active" && a.modules.includes(module)).map((a) => a.admin_code);
  const isAdminFor = (module) => S()?.role === "superadmin" || (S()?.role === "admin" && D().admins.find((a) => a.admin_code === S().code)?.modules.includes(module));
  const audit = (x, action, details) => pushAudit(x, S().code, S().role, action, details);
  const todayPunches = (x, code) => x.punches.filter((p) => p.employee_code === code && p.ts.startsWith(isoDate()));

  // ── Attendance ───────────────────────────────────────
  function punch({ type, source, pos, selfie, verified, device_id }) {
    const d = D();
    const e = me(d);
    if (!e) return err("Only employees can punch.");
    const st = d.settings;
    const today = todayPunches(d, e.employee_code).sort((a, b) => a.ts.localeCompare(b.ts));
    const last = today[today.length - 1];
    if (type === "in" && last?.type === "in") return err("You are already clocked in. Punch out first.");
    if (type === "out" && last?.type !== "in") return err("You have not clocked in today.");
    const mode = e.attendance_mode;
    if (source === "web" && !["web", "any"].includes(mode)) return err("Web punch is not enabled for you. Use the biometric terminal or the geofenced mobile punch.");
    if (source === "geo_mobile" && mode === "biometric" && e.field_staff !== "yes") return err("Your attendance method is the biometric terminal at your office.");
    let geo = { fence: null, distance: null, inside: true };
    let flag = null;
    if (source.startsWith("biometric")) {
      const dev = d.devices.find((x) => x.device_id === device_id);
      if (!dev) return err("Choose the terminal you are at.");
      if (dev.status !== "online") return err(`${dev.name} is offline. Use another terminal or the mobile punch, and tell the admin team.`);
      if (!e.biometric_id) return err("You are not enrolled on the biometric terminals. Ask HR to enrol your fingerprint or face.");
      if (!["biometric", "any"].includes(mode) && e.field_staff !== "yes") return err("Terminal punches are not enabled for you.");
      geo = { fence: d.geofences.find((g) => g.id === dev.geofence_id), distance: 0, inside: true };
    }
    if (source === "geo_mobile") {
      if (!pos) return err("Your location is needed for a geofenced punch.");
      const allowed = fencesFor(e, d.geofences).map((g) => g.id);
      geo = nearestGeofence(pos, d.geofences, allowed);
      if (!geo.fence) return err("No geofence is set up for you. Ask HR to assign a work location.");
      if (!geo.inside) {
        const msg = `${fmtDistance(geo.distance - geo.fence.radius_m)} outside ${geo.fence.name}`;
        if (st.geofence_enforcement === "block") return err(`You are ${msg}. Move inside the geofence to punch, or raise an attendance correction.`);
        if (st.geofence_enforcement === "flag") flag = `Outside geofence · ${msg}`;
      }
      if (st.selfie_required_geo && !["device_biometric", "demo_scan"].includes(verified) && !selfie) return err("Take a selfie or verify with your device biometrics to punch.");
    }
    return mutate((x) => {
      const p = {
        id: nextSeq(x.punches, "PN-", "id", 1),
        employee_code: e.employee_code,
        ts: nowIso(),
        type,
        source,
        device_id: device_id || null,
        verified: verified || (source === "web" ? "password" : "selfie"),
        lat: pos ? +pos.lat.toFixed(6) : null,
        lng: pos ? +pos.lng.toFixed(6) : null,
        accuracy: pos?.accuracy ?? null,
        simulated_location: !!pos?.simulated,
        geofence_id: geo.fence?.id || null,
        distance_m: geo.distance != null ? Math.round(geo.distance) : null,
        inside: geo.inside,
        flag,
        selfie: selfie || null,
        // v10.6: punch IP address (shown with the punch-in location in Attendance)
        ip: demoIp(),
        device_label: deviceLabel(),
      };
      x.punches.push(p);
      const consent = x.consents[e.employee_code];
      if (type === "in" && pos && consent?.location && x.settings.location_tracking !== "off") x.locations[e.employee_code] = { lat: p.lat, lng: p.lng, accuracy: p.accuracy, battery: null, ts: p.ts, trail: [{ lat: p.lat, lng: p.lng, ts: p.ts }], source: "punch" };
      if (type === "out" && x.settings.location_tracking === "clocked_in") delete x.locations[e.employee_code];
      audit(x, type === "in" ? "PUNCH_IN" : "PUNCH_OUT", `${source}${geo.fence ? ` · ${geo.fence.name} · ${fmtDistance(geo.distance)}` : ""}${flag ? ` · ${flag}` : ""}`);
      if (flag && e.reporting_manager) pushNote(x, e.reporting_manager, `${e.full_name} punched ${type} outside the geofence (${flag.replace("Outside geofence · ", "")}).`, "/team-live");
      return { ok: true, punch: p, flag, geo };
    });
  }

  function pingLocation(pos) {
    const d = D();
    const e = me(d);
    if (!e || !pos) return;
    if (!d.consents[e.employee_code]?.location || d.settings.location_tracking === "off") return;
    const open = todayPunches(d, e.employee_code).sort((a, b) => a.ts.localeCompare(b.ts)).pop();
    if (d.settings.location_tracking === "clocked_in" && open?.type !== "in") return;
    mutate((x) => {
      const cur = x.locations[e.employee_code] || { trail: [] };
      const trail = [...(cur.trail || []), { lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6), ts: nowIso() }].slice(-20);
      x.locations[e.employee_code] = { lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6), accuracy: pos.accuracy, battery: pos.battery ?? null, ts: nowIso(), trail, source: pos.simulated ? "simulated" : "browser" };
    });
  }

  function setConsent({ location, activity }) {
    return mutate((x) => {
      const e = me(x);
      if (!e) return err("Only employees give consent.");
      x.consents[e.employee_code] = { location: !!location, activity: !!activity, at: nowIso(), version: "2026.1" };
      if (!location) delete x.locations[e.employee_code];
      audit(x, "MONITORING_CONSENT", `location ${location ? "on" : "off"} · activity ${activity ? "on" : "off"}`);
      adminsWith(x, "monitoring").forEach((a) => pushNote(x, a, `${e.full_name} updated monitoring consent (location ${location ? "on" : "off"}, activity ${activity ? "on" : "off"}).`, "/monitoring"));
      return { ok: true };
    });
  }

  function saveDeviceKey(credentialId) {
    return mutate((x) => {
      const e = me(x);
      x.deviceKeys[e.employee_code] = { credentialId, at: nowIso() };
      audit(x, "BIOMETRIC_DEVICE_ENROL", "Device biometrics (WebAuthn) registered for punch verification");
      return { ok: true };
    });
  }

  // Simulates pulling the day's punches from a terminal.
  function syncDevice(device_id) {
    return mutate((x) => {
      const dev = x.devices.find((dv) => dv.device_id === device_id);
      if (!dev) return err("Device not found.");
      if (dev.status !== "online") return err(`${dev.name} is offline. Check its power and network, then try again.`);
      const today = isoDate();
      const nowMin = x.demo_clock ? 870 : new Date().getHours() * 60 + new Date().getMinutes();
      let added = 0;
      x.employees
        .filter((e) => e.status === "active" && e.biometric_id && e.primary_geofence === dev.geofence_id && ["biometric", "any"].includes(e.attendance_mode))
        .forEach((e, i) => {
          if (x.punches.some((p) => p.employee_code === e.employee_code && p.ts.startsWith(today) && p.type === "in")) return;
          if (x.requests.some((r) => r.type === "leave" && r.status === "Approved" && r.employee_code === e.employee_code && r.from_date <= today && r.to_date >= today)) return;
          const m = Math.min(nowMin - 1, 545 + ((i * 7) % 40));
          if (m < 480) return;
          x.punches.push({ id: nextSeq(x.punches, "PN-", "id", 1), employee_code: e.employee_code, ts: new Date(`${today}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`).toISOString(), type: "in", source: dev.type === "face" ? "biometric_face" : "biometric_fp", device_id: dev.device_id, verified: "device", lat: null, lng: null, accuracy: null, geofence_id: dev.geofence_id, inside: true, flag: null });
          added += 1;
        });
      dev.last_sync = nowIso();
      audit(x, "DEVICE_SYNC", `${dev.device_id} · ${added} new punch(es)`);
      return { ok: true, added };
    });
  }

  function upsertDevice(dev) {
    if (S()?.role !== "superadmin") return err("Only a Super Admin can register devices.");
    if (!(dev.name || "").trim() || !dev.geofence_id) return err("Give the device a name and a location.");
    if (!/^[\d.]+$/.test(dev.ip || "")) return err("Enter the device IP address.");
    return mutate((x) => {
      const ex = x.devices.find((d) => d.device_id === dev.device_id);
      if (ex) Object.assign(ex, dev);
      else x.devices.push({ ...dev, device_id: nextSeq(x.devices, "DEV-", "device_id", 2), last_sync: null, enrolled: 0, status: dev.status || "online" });
      audit(x, ex ? "DEVICE_UPDATE" : "DEVICE_ADD", `${dev.name} · ${dev.geofence_id}`);
      return { ok: true };
    });
  }
  function removeDevice(id) {
    return mutate((x) => {
      x.devices = x.devices.filter((d) => d.device_id !== id);
      audit(x, "DEVICE_REMOVE", id);
      return { ok: true };
    });
  }

  function upsertGeofence(g) {
    if (S()?.role !== "superadmin") return err("Only a Super Admin can change geofences.");
    const lat = Number(g.lat);
    const lng = Number(g.lng);
    const r = Number(g.radius_m);
    if (!(g.name || "").trim()) return err("Give the geofence a name.");
    if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) return err("Latitude must be −90 to 90 and longitude −180 to 180.");
    if (!(r >= 30 && r <= 5000)) return err("Radius must be 30 to 5,000 metres.");
    return mutate((x) => {
      const clean = { ...g, lat, lng, radius_m: r, name: g.name.trim() };
      const ex = x.geofences.find((f) => f.id === g.id);
      if (ex) Object.assign(ex, clean);
      else x.geofences.push({ ...clean, id: `GF-${clean.name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase()}${x.geofences.length + 1}`, active: true });
      audit(x, "GEOFENCE_SAVE", `${clean.name} · ${lat.toFixed(4)}, ${lng.toFixed(4)} · ${r} m`);
      return { ok: true };
    });
  }
  function removeGeofence(id) {
    return mutate((x) => {
      const used = x.employees.filter((e) => e.primary_geofence === id).length + x.devices.filter((d) => d.geofence_id === id).length;
      if (used) return err(`${used} employee(s) or device(s) use this geofence. Move them first, or turn the geofence off instead.`);
      x.geofences = x.geofences.filter((g) => g.id !== id);
      audit(x, "GEOFENCE_REMOVE", id);
      return { ok: true };
    });
  }

  // ── Calls ────────────────────────────────────────────
  function logCall(c) {
    const e = me(D());
    if (!e || e.call_tracking !== "yes") return err("Call tracking is not enabled for you.");
    if (!(c.contact || "").trim() || !(c.company || "").trim()) return err("Enter the contact and company.");
    const [m, s] = String(c.duration || "0:00").split(":").map(Number);
    const sec = (m || 0) * 60 + (s || 0);
    if (c.outcome === "connected" && sec < 5) return err("Enter the call duration (mm:ss) for a connected call.");
    if (c.disposition === "follow_up" && !c.follow_up_date) return err("Choose a follow-up date.");
    return mutate((x) => {
      x.calls.push({ id: nextSeq(x.calls, "CL-", "id", 1), employee_code: e.employee_code, ts: nowIso(), direction: c.direction || "outbound", contact: c.contact.trim(), company: c.company.trim(), phone: c.phone || "", duration_sec: c.outcome === "connected" ? sec : 0, outcome: c.outcome, disposition: c.outcome === "connected" ? c.disposition : "", follow_up_date: c.follow_up_date || "", notes: c.notes || "", source: "manual" });
      audit(x, "CALL_LOG", `${c.company.trim()} · ${c.outcome}`);
      return { ok: true };
    });
  }

  // ── Assets ───────────────────────────────────────────
  function upsertAsset(a) {
    if (!isAdminFor("assets")) return err("You do not manage assets.");
    if (!a.category || !(a.model || "").trim() || !(a.serial || "").trim()) return err("Category, model and serial number are required.");
    return mutate((x) => {
      if (x.assets.some((y) => y.serial === a.serial && y.asset_id !== a.asset_id)) return err("Another asset has that serial number.");
      const ex = x.assets.find((y) => y.asset_id === a.asset_id);
      const clean = { ...a, cost: Number(a.cost) || 0 };
      if (ex) Object.assign(ex, clean);
      else {
        const prefix = { Laptop: "LT-", Monitor: "MN-", Phone: "PH-", SIM: "SM-", "Access card": "AC-", Headset: "HS-", Vehicle: "VH-" }[a.category] || "OT-";
        x.assets.push({ ...clean, asset_id: nextSeq(x.assets.filter((y) => y.asset_id.startsWith(prefix)), prefix, "asset_id", 4), status: "in_stock", assigned_to: null, assigned_on: null, acknowledged: false, condition: a.condition || "New", history: [{ at: isoDate(), action: "Added to stock" }] });
      }
      audit(x, ex ? "ASSET_UPDATE" : "ASSET_ADD", `${a.category} · ${a.model} · ${a.serial}`);
      return { ok: true };
    });
  }
  function assignAsset(assetId, empCode, requestId) {
    if (!isAdminFor("assets")) return err("You do not manage assets.");
    return mutate((x) => {
      const a = x.assets.find((y) => y.asset_id === assetId);
      if (!a || a.status !== "in_stock") return err("Only assets in stock can be assigned.");
      const e = x.employees.find((y) => y.employee_code === empCode);
      if (!e || e.status !== "active") return err("Choose an active employee.");
      Object.assign(a, { status: "assigned", assigned_to: empCode, assigned_on: isoDate(), acknowledged: false });
      a.history.push({ at: isoDate(), action: "Assigned", to: empCode, by: S().code });
      if (requestId) {
        const r = x.requests.find((q) => q.request_id === requestId);
        if (r) {
          r.status = "Fulfilled";
          r.assigned_asset = assetId;
          r.history.push({ status: "Fulfilled", at: nowIso(), by: S().code, note: `${a.asset_id} · ${a.model}` });
        }
      }
      pushNote(x, empCode, `${a.category} ${a.asset_id} (${a.model}) was assigned to you. Confirm you received it.`, "/assets");
      audit(x, "ASSET_ASSIGN", `${assetId} → ${empCode}${requestId ? ` · ${requestId}` : ""}`);
      return { ok: true };
    });
  }
  function returnAsset(assetId, condition = "Good") {
    if (!isAdminFor("assets")) return err("You do not manage assets.");
    return mutate((x) => {
      const a = x.assets.find((y) => y.asset_id === assetId);
      const from = a.assigned_to;
      Object.assign(a, { status: condition === "Good" ? "in_stock" : "repair", assigned_to: null, assigned_on: null, acknowledged: false, condition, issue: null });
      a.history.push({ at: isoDate(), action: `Returned · ${condition}`, from, by: S().code });
      audit(x, "ASSET_RETURN", `${assetId} from ${from} · ${condition}`);
      return { ok: true };
    });
  }
  function setAssetStatus(assetId, status) {
    if (!isAdminFor("assets")) return err("You do not manage assets.");
    return mutate((x) => {
      const a = x.assets.find((y) => y.asset_id === assetId);
      if (a.assigned_to && status !== "assigned") return err("Take the asset back from the employee first.");
      a.status = status;
      if (status === "in_stock") a.condition = "Good";
      a.history.push({ at: isoDate(), action: `Status → ${status}`, by: S().code });
      audit(x, "ASSET_STATUS", `${assetId} → ${status}`);
      return { ok: true };
    });
  }
  function acknowledgeAsset(assetId) {
    return mutate((x) => {
      const a = x.assets.find((y) => y.asset_id === assetId && y.assigned_to === S().code);
      if (!a) return err("This asset is not assigned to you.");
      a.acknowledged = true;
      a.history.push({ at: isoDate(), action: "Receipt confirmed", by: S().code });
      audit(x, "ASSET_ACK", assetId);
      return { ok: true };
    });
  }
  function reportAssetIssue(assetId, text) {
    if (!(text || "").trim()) return err("Describe the problem.");
    return mutate((x) => {
      const a = x.assets.find((y) => y.asset_id === assetId && y.assigned_to === S().code);
      if (!a) return err("This asset is not assigned to you.");
      a.issue = { text: text.trim(), at: nowIso() };
      a.history.push({ at: isoDate(), action: `Issue reported: ${text.trim()}`, by: S().code });
      adminsWith(x, "assets").forEach((ad) => pushNote(x, ad, `${me(x)?.full_name} reported a problem with ${a.asset_id}: ${text.trim()}`, "/assets-admin"));
      audit(x, "ASSET_ISSUE", `${assetId} · ${text.trim()}`);
      return { ok: true };
    });
  }

  // ── Performance ──────────────────────────────────────
  const canEditGoalsOf = (x, code) => code === S().code || x.employees.find((e) => e.employee_code === code)?.reporting_manager === S().code || isAdminFor("performance");
  function upsertGoal(g) {
    const d = D();
    const owner = g.employee_code || S().code;
    if (!canEditGoalsOf(d, owner)) return err("You can only edit your own goals or your team's.");
    if (!(g.title || "").trim()) return err("Give the goal a title.");
    const w = Number(g.weight);
    const p = Number(g.progress);
    if (!(w >= 5 && w <= 100)) return err("Weight must be 5 to 100.");
    if (!(p >= 0 && p <= 100)) return err("Progress must be 0 to 100.");
    const others = d.goals.filter((x) => x.employee_code === owner && x.id !== g.id).reduce((s, x) => s + x.weight, 0);
    if (others + w > 100 && !g.rebalance) return err(`Weights would total ${others + w}%. Lower the weight or tick "rebalance my other goals".`);
    if (g.due && g.start && g.due < g.start) return err("The due date must be after the start date.");
    return mutate((x) => {
      // Scale the owner's other goals so everything still adds up to 100%.
      if (g.rebalance && others + w > 100 && others > 0) {
        const mine = x.goals.filter((y) => y.employee_code === owner && y.id !== g.id);
        let left = 100 - w;
        mine.forEach((y, i) => { const nw = i === mine.length - 1 ? left : Math.max(1, Math.round((y.weight / others) * (100 - w))); y.weight = Math.min(nw, left); left -= y.weight; });
      }
      const ex = x.goals.find((y) => y.id === g.id);
      const { rebalance, ...rest } = g; // eslint-disable-line no-unused-vars
      const clean = { ...rest, employee_code: owner, title: g.title.trim(), weight: w, progress: p, status: p >= 100 ? "done" : g.status === "at_risk" && p < 100 ? "at_risk" : p < 40 ? "at_risk" : "on_track", updated_at: nowIso() };
      if (ex) Object.assign(ex, clean);
      else x.goals.push({ ...clean, id: nextSeq(x.goals, "GL-", "id", 1) });
      audit(x, ex ? "GOAL_UPDATE" : "GOAL_ADD", `${owner} · ${clean.title} · ${p}%`);
      return { ok: true };
    });
  }
  function removeGoal(id) {
    return mutate((x) => {
      const g = x.goals.find((y) => y.id === id);
      if (!g || !canEditGoalsOf(x, g.employee_code)) return err("You cannot remove this goal.");
      x.goals = x.goals.filter((y) => y.id !== id);
      audit(x, "GOAL_REMOVE", `${g.employee_code} · ${g.title}`);
      return { ok: true };
    });
  }
  const scoreOk = (s) => ["g", "c", "v"].every((k) => Number(s[k]) >= 1 && Number(s[k]) <= 5);
  /** Self review: save a draft any time; submit (or resubmit) until the manager has reviewed or calibration starts. */
  function submitSelfReview(s, { draft = false } = {}) {
    const d = D();
    const mine = d.reviews[me(d)?.employee_code] || {};
    if (draft) {
      return mutate((x) => {
        const e = me(x);
        x.reviews[e.employee_code] = { ...(x.reviews[e.employee_code] || {}), self_draft: { ...s, saved_at: nowIso() } };
        return { ok: true };
      });
    }
    if (["calibration", "closed"].includes(d.cycle.stage)) return err("Self reviews are closed for this cycle.");
    if (mine.manager) return err("Your manager has already reviewed you, so the self review is locked.");
    if (!scoreOk(s)) return err("Rate goals, competency and values from 1 to 5.");
    if ((s.comments || "").trim().length < 20) return err("Add at least a couple of sentences about your achievements.");
    return mutate((x) => {
      const e = me(x);
      const again = !!x.reviews[e.employee_code]?.self;
      const { self_draft, ...keep } = x.reviews[e.employee_code] || {}; // eslint-disable-line no-unused-vars
      x.reviews[e.employee_code] = { ...keep, self: { g: +s.g, c: +s.c, v: +s.v, comments: s.comments.trim(), strengths: (s.strengths || "").trim(), improve: (s.improve || "").trim(), goals: s.goals || {}, submitted_at: nowIso() } };
      pushNote(x, e.reporting_manager, `${e.full_name} ${again ? "updated their" : "submitted a"} self review. Add your manager review.`, "/team-reviews");
      audit(x, again ? "SELF_REVIEW_UPDATE" : "SELF_REVIEW", e.employee_code);
      return { ok: true };
    });
  }
  function submitManagerReview(code, s) {
    const d = D();
    const e = d.employees.find((y) => y.employee_code === code);
    if (!e || e.reporting_manager !== S().code) return err("You can only review your direct reports.");
    if (!["self_review", "manager_review"].includes(d.cycle.stage)) return err("Manager reviews are closed for this cycle.");
    if (!scoreOk(s) || !(Number(s.pot) >= 1 && Number(s.pot) <= 3)) return err("Rate each area 1–5 and potential 1–3.");
    if ((s.comments || "").trim().length < 20) return err("Add a short summary the employee will see.");
    return mutate((x) => {
      x.reviews[code] = { ...(x.reviews[code] || {}), manager: { g: +s.g, c: +s.c, v: +s.v, pot: +s.pot, comments: s.comments.trim(), submitted_at: nowIso(), by: S().code } };
      adminsWith(x, "performance").forEach((a) => pushNote(x, a, `${me(x)?.full_name} reviewed ${e.full_name}; ready for calibration.`, "/performance"));
      audit(x, "MANAGER_REVIEW", code);
      return { ok: true };
    });
  }
  function calibrate(code, s) {
    if (!isAdminFor("performance")) return err("You do not manage performance.");
    if (!scoreOk(s)) return err("Scores must be 1 to 5.");
    return mutate((x) => {
      x.perf[code] = { g: +s.g, c: +s.c, v: +s.v, pot: +s.pot || x.perf[code]?.pot || 2 };
      const e = x.employees.find((y) => y.employee_code === code);
      if (e) e.potential = x.perf[code].pot;
      audit(x, "CALIBRATE", `${code} · ${s.g}/${s.c}/${s.v} · pot ${s.pot}`);
      return { ok: true };
    });
  }
  const STAGES = ["goal_setting", "self_review", "manager_review", "calibration", "closed"];
  function setCycleStage(stage) {
    if (!isAdminFor("performance")) return err("You do not manage performance.");
    if (!STAGES.includes(stage)) return err("Unknown stage.");
    return mutate((x) => {
      const prev = x.cycle.stage;
      x.cycle.stage = stage;
      if (stage === "calibration") {
        // Start calibration from manager scores where they exist.
        Object.entries(x.reviews).forEach(([code, r]) => {
          if (r.manager) x.perf[code] = { g: r.manager.g, c: r.manager.c, v: r.manager.v, pot: r.manager.pot };
        });
      }
      x.employees.filter((e) => e.status === "active").forEach((e) => {
        if (stage === "self_review") pushNote(x, e.employee_code, `${x.cycle.name}: self reviews are open until ${x.cycle.self_due}.`, "/performance-me");
        if (stage === "closed") pushNote(x, e.employee_code, `${x.cycle.name} is closed. Your final rating is on your performance page.`, "/performance-me");
      });
      audit(x, "CYCLE_STAGE", `${prev} → ${stage}`);
      return { ok: true };
    });
  }
  function giveFeedback(f) {
    if (!f.to || !(f.text || "").trim()) return err("Choose a colleague and write your feedback.");
    if (f.to === S().code) return err("Feedback is for colleagues.");
    return mutate((x) => {
      x.feedback.unshift({ id: nextSeq(x.feedback, "FB-", "id", 1), from: S().code, to: f.to, type: f.type || "praise", text: f.text.trim(), at: nowIso(), visibility: f.visibility || "public" });
      pushNote(x, f.to, `${me(x)?.full_name} sent you ${f.type === "suggestion" ? "a suggestion" : "praise"}.`, "/performance-me");
      audit(x, "FEEDBACK", `to ${f.to} · ${f.type}`);
      return { ok: true };
    });
  }

  // ── Recruitment & onboarding ─────────────────────────
  function upsertReq(r) {
    if (!isAdminFor("recruitment")) return err("You do not manage recruitment.");
    if (!(r.role || "").trim() || !r.dept || !(Number(r.n) >= 1)) return err("Role, department and at least one seat are required.");
    return mutate((x) => {
      const ex = x.reqs.find((q) => q.id === r.id);
      const clean = { ...r, n: Number(r.n), cost: Number(r.cost) || 0 };
      if (ex) Object.assign(ex, clean);
      else x.reqs.unshift({ app: 0, scr: 0, int: 0, off: 0, acc: 0, closed: "", ...clean, id: nextSeq(x.reqs, "R-", "id", 4), open: isoDate() });
      audit(x, ex ? "REQ_UPDATE" : "REQ_OPEN", `${clean.role} · ${clean.dept} · ${clean.n} seat(s)`);
      return { ok: true };
    });
  }
  const STAGE_COUNTER = { applied: "app", screen: "scr", interview: "int", offer: "off", hired: "acc" };
  function addCandidate(c) {
    if (!isAdminFor("recruitment")) return err("You do not manage recruitment.");
    if (!(c.name || "").trim() || !c.req_id) return err("Name and requisition are required.");
    if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return err("Enter a valid email.");
    return mutate((x) => {
      x.candidates.unshift({ id: nextSeq(x.candidates, "CD-", "id", 1), name: c.name.trim(), req_id: c.req_id, stage: "applied", source: c.source || "Careers page", rating: 0, email: c.email || "", updated_at: nowIso() });
      const q = x.reqs.find((y) => y.id === c.req_id);
      if (q) q.app += 1;
      audit(x, "CANDIDATE_ADD", `${c.name.trim()} → ${c.req_id}`);
      return { ok: true };
    });
  }
  function moveCandidate(id, stage, rating) {
    if (!isAdminFor("recruitment")) return err("You do not manage recruitment.");
    return mutate((x) => {
      const c = x.candidates.find((y) => y.id === id);
      const q = x.reqs.find((y) => y.id === c.req_id);
      const order = ["applied", "screen", "interview", "offer", "hired"];
      if (stage !== "rejected" && order.indexOf(stage) > order.indexOf(c.stage) && q && STAGE_COUNTER[stage]) q[STAGE_COUNTER[stage]] += 1;
      c.stage = stage;
      if (rating != null) c.rating = rating;
      c.updated_at = nowIso();
      if (stage === "hired" && q) {
        x.onboarding.unshift({ id: nextSeq(x.onboarding, "ONB-", "id", 1), employee_code: null, name: c.name, role: q.role, dept: q.dept, doj: isoDate(Date.now() + 14 * 86400000), done: x.onbTasks.map((_, i) => i === 0), buddy: null });
        if (q.acc >= q.n && !q.closed) q.closed = isoDate();
      }
      audit(x, "CANDIDATE_STAGE", `${c.name} → ${stage}`);
      return { ok: true };
    });
  }
  function toggleOnbTask(id, idx) {
    const d = D();
    const o = d.onboarding.find((y) => y.id === id);
    const self = o?.employee_code === S().code;
    if (!isAdminFor("onboarding") && !self) return err("You cannot change this checklist.");
    if (self && ![1, 5].includes(idx)) return err("HR completes this step.");
    return mutate((x) => {
      const ob = x.onboarding.find((y) => y.id === id);
      ob.done[idx] = !ob.done[idx];
      audit(x, "ONBOARDING_TASK", `${ob.name} · ${x.onbTasks[idx][0]} · ${ob.done[idx] ? "done" : "reopened"}`);
      return { ok: true };
    });
  }
  function setBuddy(id, code) {
    if (!isAdminFor("onboarding")) return err("You do not manage onboarding.");
    return mutate((x) => {
      const ob = x.onboarding.find((y) => y.id === id);
      ob.buddy = code;
      ob.done[4] = !!code;
      if (code) pushNote(x, code, `You are the onboarding buddy for ${ob.name}, starting ${ob.doj}.`, "/home");
      audit(x, "ONBOARDING_BUDDY", `${ob.name} · ${code || "none"}`);
      return { ok: true };
    });
  }

  // ── Payroll ──────────────────────────────────────────
  function runPayroll(country, totals) {
    if (!isAdminFor("payroll")) return err("You do not run payroll.");
    if (totals.blocking) return err(`${totals.blocking} blocking compliance failure(s). Fix them in Local compliance first.`);
    return mutate((x) => {
      const period = isoDate().slice(0, 7);
      const ex = x.payrollRuns.find((r) => r.country === country && r.period === period);
      if (ex?.status === "Locked") return err("This month's run is locked.");
      const run = { id: ex?.id || nextSeq(x.payrollRuns, "PR-", "id", 3), country, period, status: "Draft", computed_at: nowIso(), by: S().code, ...totals };
      if (ex) Object.assign(ex, run);
      else x.payrollRuns.push(run);
      audit(x, "PAYROLL_RUN", `${country} ${period} · ${totals.headcount} employees · net ${totals.net} ${totals.currency}`);
      return { ok: true };
    });
  }
  function lockPayroll(id) {
    if (!isAdminFor("payroll")) return err("You do not run payroll.");
    return mutate((x) => {
      const r = x.payrollRuns.find((y) => y.id === id);
      r.status = "Locked";
      r.locked_at = nowIso();
      r.locked_by = S().code;
      x.employees.filter((e) => e.status === "active" && (e.country_code || "IN") === r.country).forEach((e) => pushNote(x, e.employee_code, `Your payslip for ${r.period} is ready.`, "/finances"));
      audit(x, "PAYROLL_LOCK", `${r.country} ${r.period}`);
      return { ok: true };
    });
  }

  // ── Benefits & wellness ──────────────────────────────
  function updateBenefits(code, patch) {
    const self = code === S().code;
    if (!self && !isAdminFor("benefits")) return err("You do not manage benefits.");
    if (self && !D().settings.benefits_window_open) return err("Benefits enrolment is closed. Changes open again in the next enrolment window or after a life event (ask HR).");
    return mutate((x) => {
      x.benefits[code] = { ...(x.benefits[code] || { tier: "S", nps: 0, meal: false }), ...patch };
      audit(x, "BENEFITS_UPDATE", `${code} · ${JSON.stringify(patch)}`);
      return { ok: true };
    });
  }
  function submitPulse(p) {
    const d = D();
    const e = me(d);
    const month = isoDate().slice(0, 7);
    if ((d.pulseSubmitted[month] || []).includes(e.employee_code)) return err("You already answered this month's pulse. Thank you.");
    if (!["stress", "sleep", "activity", "energy"].every((k) => p[k] >= 1 && p[k] <= 5)) return err("Answer all four questions.");
    return mutate((x) => {
      // Stored without the employee code: department and month only.
      x.pulses.push({ dept: e.department, month, stress: p.stress, sleep: p.sleep, activity: p.activity, energy: p.energy, in_programme: !!p.in_programme });
      x.pulseSubmitted[month] = [...(x.pulseSubmitted[month] || []), e.employee_code];
      return { ok: true };
    });
  }

  // ── Workforce, territory, succession ─────────────────
  function setBudget(dept, patch) {
    if (!isAdminFor("workforce")) return err("You do not manage workforce plans.");
    return mutate((x) => {
      x.budget[dept] = { ...(x.budget[dept] || { hc: 0, cost: 0 }), ...patch };
      audit(x, "BUDGET_UPDATE", `${dept} · ${JSON.stringify(patch)}`);
      return { ok: true };
    });
  }
  function setRoster(code, day, shift) {
    if (!isAdminFor("workforce")) return err("You do not manage rosters.");
    return mutate((x) => {
      x.roster[code] = [...(x.roster[code] || ["G", "G", "G", "G", "G", "O", "O"])];
      x.roster[code][day] = shift;
      audit(x, "ROSTER_UPDATE", `${code} · day ${day + 1} → ${shift}`);
      return { ok: true };
    });
  }
  function addToRoster(code) {
    return setRoster(code, 0, "G");
  }
  function setFx(cur, val) {
    if (S()?.role !== "superadmin") return err("Only a Super Admin can change exchange rates.");
    const v = Number(val);
    if (!(v > 0)) return err("Enter a positive rate.");
    return mutate((x) => {
      x.fx[cur] = v;
      audit(x, "FX_UPDATE", `${cur} = ₹${v}`);
      return { ok: true };
    });
  }
  function setRevenue(v) {
    return mutate((x) => {
      x.revenue = Number(v) || 0;
      audit(x, "REVENUE_UPDATE", String(x.revenue));
      return { ok: true };
    });
  }
  function upsertSuccession(item) {
    if (S()?.role !== "superadmin" && !isAdminFor("performance")) return err("You do not manage succession plans.");
    if (!(item.role || "").trim() || !item.incumbent) return err("Role and incumbent are required.");
    return mutate((x) => {
      const ex = x.succession.find((s) => s.id === item.id);
      if (ex) Object.assign(ex, item);
      else x.succession.push({ ...item, id: nextSeq(x.succession, "SC-", "id", 1) });
      audit(x, "SUCCESSION_SAVE", `${item.role} · ${item.successors.length} successor(s)`);
      return { ok: true };
    });
  }

  // ── My activity (this portal session only) ───────────
  function recordMyActivity(activeMin, idleMin) {
    const d = D();
    const e = me(d);
    if (!e || !d.settings.activity_tracking || !d.consents[e.employee_code]?.activity) return;
    const today = isoDate();
    const hh = new Date().toTimeString().slice(0, 5);
    mutate((x) => {
      let a = x.activity.find((y) => y.employee_code === e.employee_code && y.date === today);
      if (!a) {
        a = { employee_code: e.employee_code, date: today, productive: 0, neutral: 0, unproductive: 0, idle: 0, first: hh, last: hh, apps: [["EZY HR portal", "productive", 0]] };
        x.activity.push(a);
      }
      a.productive += activeMin;
      a.idle += idleMin;
      a.last = hh;
      const app = a.apps.find((p) => p[0] === "EZY HR portal");
      if (app) app[2] += activeMin;
      else a.apps.unshift(["EZY HR portal", "productive", activeMin]);
    });
  }

  function purgeMonitoring() {
    if (S()?.role !== "superadmin") return err("Only a Super Admin can purge monitoring data.");
    return mutate((x) => {
      const cutoff = isoDate(Date.now() - x.settings.monitoring_retention_days * 86400000);
      const before = x.activity.length;
      x.activity = x.activity.filter((a) => a.date >= cutoff);
      const removed = before - x.activity.length;
      Object.keys(x.locations).forEach((k) => {
        if (!x.consents[k]?.location) delete x.locations[k];
      });
      audit(x, "MONITORING_PURGE", `${removed} activity record(s) older than ${cutoff}`);
      return { ok: true, removed };
    });
  }

  return {
    punch, pingLocation, setConsent, saveDeviceKey, syncDevice, upsertDevice, removeDevice, upsertGeofence, removeGeofence,
    logCall,
    upsertAsset, assignAsset, returnAsset, setAssetStatus, acknowledgeAsset, reportAssetIssue,
    upsertGoal, removeGoal, submitSelfReview, submitManagerReview, calibrate, setCycleStage, giveFeedback,
    upsertReq, addCandidate, moveCandidate, toggleOnbTask, setBuddy,
    runPayroll, lockPayroll, updateBenefits, submitPulse,
    setBudget, setRoster, addToRoster, setFx, setRevenue, upsertSuccession,
    recordMyActivity, purgeMonitoring,
    distance: haversine,
  };
}
