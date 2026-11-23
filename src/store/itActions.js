// IT service desk actions. Employees (and admins) raise tickets; admins with the "it" module work the queue.
import { nowIso } from "../lib/utils.js";
import { chainSteps, defaultChain, stepLabel } from "../lib/requests.js";
import { IT_CATEGORY_LABEL, IT_PRIORITY, IT_STATUS, IT_OPEN, slaDue } from "../lib/itdesk.js";

const err = (error) => ({ ok: false, error });

export function makeItActions({ mutate, dataRef, sessionRef, pushAudit, pushNote, activeManager, adminFor }) {
  const S = () => sessionRef.current;
  const D = () => dataRef.current;
  const audit = (x, a, d) => pushAudit(x, S().code, S().role, a, d);
  const isAgent = () => S()?.role === "superadmin" || (S()?.role === "admin" && !!D().admins.find((a) => a.admin_code === S().code)?.modules.includes("it"));
  const agents = (x) => x.admins.filter((a) => a.status === "active" && a.modules.includes("it")).map((a) => a.admin_code);
  const nameIn = (x, c) => x.employees.find((e) => e.employee_code === c)?.full_name || x.admins.find((a) => a.admin_code === c)?.full_name || x.superAdmins.find((a) => a.superadmin_code === c)?.full_name || c;
  const nextId = (x) => `IT-${String(Math.max(1000, ...x.itTickets.map((t) => Number(t.id.split("-")[1]) || 0)) + 1)}`;

  function createItTicket(t) {
    if (!S()) return err("Sign in first.");
    if (!String(t.subject || "").trim()) return err("Give the issue a short title.");
    if (String(t.description || "").trim().length < 10) return err("Describe the problem in a sentence or two (what happened, any error message).");
    if (!IT_CATEGORY_LABEL[t.category]) return err("Choose a category.");
    if (!IT_PRIORITY[t.priority]) return err("Choose how badly it affects you.");
    if (t.attachment && t.attachment.size > 1024 * 1024) return err("Screenshots are limited to 1 MB in this browser demo.");
    const d = D();
    if (t.asset_id && !d.assets.some((a) => a.asset_id === t.asset_id && a.assigned_to === S().code)) return err("That asset is not assigned to you.");
    return mutate((x) => {
      const id = nextId(x);
      const at = nowIso();
      // v10.12: IT support follows its approval chain (Super Admin → Policies). IT admin steps are the IT queue itself;
      // every other step (reporting manager, HR, Finance…) approves before IT picks the ticket up.
      // Critical issues and security incidents always go straight to IT.
      const me = S().role === "emp" ? x.employees.find((e) => e.employee_code === S().code) : null;
      const urgent = t.priority === "critical" || t.category === "security";
      const approvals = !me || urgent ? [] : chainSteps(x.settings?.workflow?.itsupport || defaultChain("itsupport"), "itsupport").filter((st) => !(st.level === "admin" && st.module === "it"));
      const mgr = approvals.some((st) => st.level === "manager") && activeManager ? activeManager(x, me) : null;
      const adminSteps = approvals.filter((st) => st.level === "admin").map((st, i) => ({ level: "admin", role: st.role || null, module: st.module, approver: adminFor ? adminFor(x, me.department, st.module) : null, status: !mgr && i === 0 ? "pending" : "waiting", at: null, note: "" }));
      const first = mgr || adminSteps[0]?.approver || null;
      const held = !!(mgr || adminSteps.length);
      x.itTickets.unshift({
        id, requester: S().code, category: t.category, priority: t.priority, subject: t.subject.trim(), description: t.description.trim(),
        asset_id: t.asset_id || null, contact: t.contact || "", location: t.location || "", status: held ? "awaiting_approval" : "open", assigned_to: null,
        created_at: at, updated_at: at, sla_due: held ? null : slaDue(at, t.priority), approval_request: null, resolved_at: null, resolution: "", rating: null,
        attachments: t.attachment ? [t.attachment] : [], ai_triage: t.ai_triage || null,
        comments: [], history: [{ at, by: S().code, action: `Raised · ${IT_CATEGORY_LABEL[t.category]} · ${IT_PRIORITY[t.priority].label}` }],
      });
      if (t.asset_id) {
        const a = x.assets.find((y) => y.asset_id === t.asset_id);
        if (a) { a.issue = { text: `${t.subject.trim()} (ticket ${id})`, at, ticket: id }; a.history.push({ at: at.slice(0, 10), action: `IT ticket ${id}: ${t.subject.trim()}`, by: S().code }); }
      }
      if (held) {
        const rid = `ITS-${String(Math.max(0, ...x.requests.filter((r) => r.type === "itsupport").map((r) => Number(String(r.request_id).split("-")[1]) || 0)) + 1).padStart(4, "0")}`;
        const chainText = [mgr ? "reporting manager" : null, ...adminSteps.map((st) => stepLabel({ type: "itsupport" }, st))].filter(Boolean).join(" → ");
        x.requests.unshift({
          request_id: rid, type: "itsupport", ticket_id: id, subject: t.subject.trim(), category: t.category, priority: t.priority, reason: t.description.trim(),
          employee_code: me.employee_code, company_id: me.company_id, location_id: me.location_id, status: "Pending", stage: mgr ? "manager" : "admin", flags: [],
          steps: [{ level: "manager", approver: mgr, status: mgr ? "pending" : "skipped", at: null, note: "" }, ...adminSteps],
          history: [{ status: "Submitted", at, by: me.employee_code, note: "" }], created_at: at,
        });
        x.itTickets[0].approval_request = rid;
        x.itTickets[0].history.push({ at, by: S().code, action: `Waiting for approval: ${chainText}` });
        if (first) pushNote(x, first, `${me.full_name} raised IT ticket ${id} (${t.subject.trim()}) — it needs your approval before IT picks it up.`, mgr ? "/inbox" : "/approvals");
        pushNote(x, me.employee_code, `IT ticket ${id} sent for approval (${chainText}), then to IT.`, `/it-support?t=${id}`);
        audit(x, "IT_TICKET_CREATE", `${id} · ${t.category} · ${t.priority} · awaiting ${chainText}`);
        return { ok: true, id, awaiting: first, chain: chainText };
      }
      agents(x).forEach((c) => pushNote(x, c, `New ${IT_PRIORITY[t.priority].label.toLowerCase()} IT ticket ${id} from ${nameIn(x, S().code)}: ${t.subject.trim()}`, `/it-helpdesk?t=${id}`));
      if (t.priority === "critical") x.superAdmins.forEach((s) => pushNote(x, s.superadmin_code, `Critical IT ticket ${id}: ${t.subject.trim()}`, `/it-helpdesk?t=${id}`));
      audit(x, "IT_TICKET_CREATE", `${id} · ${t.category} · ${t.priority} · ${t.subject.trim()}`);
      return { ok: true, id };
    });
  }

  function commentItTicket(id, text, { internal = false, attachment } = {}) {
    const t = D().itTickets.find((k) => k.id === id);
    if (!t) return err("Ticket not found.");
    const mine = t.requester === S().code;
    if (!mine && !isAgent()) return err("You cannot reply on this ticket.");
    if (!String(text || "").trim() && !attachment) return err("Write a reply.");
    if (internal && !isAgent()) return err("Only IT can add internal notes.");
    return mutate((x) => {
      const k = x.itTickets.find((y) => y.id === id);
      const at = nowIso();
      k.comments.push({ by: S().code, at, text: String(text || "").trim(), internal, attachment: attachment || null });
      k.updated_at = at;
      if (mine && k.status === "waiting_user") { k.status = "in_progress"; k.history.push({ at, by: S().code, action: "Requester replied → In progress" }); }
      if (mine && ["resolved", "closed"].includes(k.status)) { k.status = "in_progress"; k.resolved_at = null; k.history.push({ at, by: S().code, action: "Reopened by requester" }); }
      if (!internal) {
        if (mine) (k.assigned_to ? [k.assigned_to] : agents(x)).forEach((c) => pushNote(x, c, `${nameIn(x, S().code)} replied on ${id}: "${String(text).slice(0, 70)}"`, `/it-helpdesk?t=${id}`));
        else pushNote(x, k.requester, `IT replied on ${id} (${k.subject}): "${String(text).slice(0, 70)}"`, `/it-support?t=${id}`);
      }
      audit(x, internal ? "IT_TICKET_NOTE" : "IT_TICKET_REPLY", id);
      return { ok: true };
    });
  }

  function updateItTicket(id, patch) {
    if (!isAgent()) return err("Only the IT team can update tickets.");
    if (patch.status === "resolved" && !String(patch.resolution || "").trim() && !D().itTickets.find((k) => k.id === id)?.resolution) return err("Add a resolution note so the employee knows what was done.");
    return mutate((x) => {
      const k = x.itTickets.find((y) => y.id === id);
      if (!k) return err("Ticket not found.");
      const at = nowIso();
      const changes = [];
      if (patch.assigned_to !== undefined && patch.assigned_to !== k.assigned_to) {
        changes.push(`assigned to ${patch.assigned_to ? nameIn(x, patch.assigned_to) : "nobody"}`);
        k.assigned_to = patch.assigned_to || null;
        if (k.assigned_to && k.assigned_to !== S().code) pushNote(x, k.assigned_to, `IT ticket ${id} assigned to you: ${k.subject}`, `/it-helpdesk?t=${id}`);
        if (k.status === "open" && k.assigned_to) { k.status = "in_progress"; changes.push("status in progress"); }
      }
      if (patch.priority && patch.priority !== k.priority) { changes.push(`priority ${k.priority} → ${patch.priority}`); k.priority = patch.priority; k.sla_due = slaDue(k.created_at, patch.priority); }
      if (patch.category && patch.category !== k.category) { changes.push(`category → ${IT_CATEGORY_LABEL[patch.category]}`); k.category = patch.category; }
      if (patch.resolution !== undefined) k.resolution = patch.resolution;
      if (patch.status && patch.status !== k.status) {
        changes.push(`status ${IT_STATUS[k.status].label} → ${IT_STATUS[patch.status].label}`);
        k.status = patch.status;
        if (patch.status === "resolved") {
          k.resolved_at = at;
          pushNote(x, k.requester, `IT resolved ${id} (${k.subject}). ${k.resolution ? `Fix: ${k.resolution.slice(0, 90)}` : ""} Reply if it is not fixed.`, `/it-support?t=${id}`);
          const a = k.asset_id && x.assets.find((y) => y.asset_id === k.asset_id);
          if (a?.issue?.ticket === id) { a.issue = null; a.history.push({ at: at.slice(0, 10), action: `IT ticket ${id} resolved`, by: S().code }); }
        } else if (patch.status === "waiting_user") pushNote(x, k.requester, `IT needs information from you on ${id}: ${k.subject}`, `/it-support?t=${id}`);
        if (IT_OPEN.includes(patch.status)) k.resolved_at = null;
      }
      if (!changes.length) return { ok: true };
      k.updated_at = at;
      k.history.push({ at, by: S().code, action: changes.join(", ") });
      audit(x, "IT_TICKET_UPDATE", `${id} · ${changes.join(", ")}`);
      return { ok: true };
    });
  }

  function rateItTicket(id, rating, feedback) {
    const t = D().itTickets.find((k) => k.id === id);
    if (!t || t.requester !== S().code) return err("Only the requester can rate the ticket.");
    if (!["resolved", "closed"].includes(t.status)) return err("You can rate a ticket once it is resolved.");
    return mutate((x) => {
      const k = x.itTickets.find((y) => y.id === id);
      k.rating = rating;
      k.feedback = feedback || "";
      k.status = "closed";
      k.history.push({ at: nowIso(), by: S().code, action: `Confirmed fixed · rated ${rating}/5` });
      if (k.assigned_to) pushNote(x, k.assigned_to, `${nameIn(x, S().code)} rated ${id} ${rating}/5.`, `/it-helpdesk?t=${id}`);
      audit(x, "IT_TICKET_RATE", `${id} · ${rating}/5`);
      return { ok: true };
    });
  }

  return { createItTicket, commentItTicket, updateItTicket, rateItTicket };
}
