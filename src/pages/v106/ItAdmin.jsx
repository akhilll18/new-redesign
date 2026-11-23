// v10.6 · IT admin: IT purchase requests (employee → IT → HR → Finance), the IT admin dashboard, and helpers used by
// the inbox badges. Asset requests and IT tickets already route to admins holding the "assets" / "it" modules, which is
// the IT admin (ADM04) — Finance no longer holds assets.
import React, { useMemo, useState } from "react";
import ListSelect from "../../components/kit/ListSelect.jsx";
import { Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Step, StepLabel, Stepper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AddShoppingCartRounded, ComputerRounded, Inventory2Rounded, ConfirmationNumberRounded, ShoppingCartCheckoutRounded, WarningAmberRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Tag, EmptyState, TableWrap, PersonCell, Mono, Grid } from "../../components/kit/UI.jsx";
import { fmtNum, fmtDate, timeAgo } from "../../lib/utils.js";
import { adminKind } from "../../lib/statutory.js";
import { IT_OPEN, slaState, IT_CATEGORY_LABEL } from "../../lib/itdesk.js";

export const IT_BUY_STAGES = [
  ["it", "IT review", "IT checks the need, spec and stock"],
  ["hr", "HR approval", "HR confirms role eligibility and policy"],
  ["finance", "Finance approval", "Finance approves budget and raises the PO"],
];
const STAGE_INDEX = { it: 0, hr: 1, finance: 2, approved: 3, ordered: 4, rejected: -1 };
const CATS = ["Laptop / desktop", "Monitor", "Mobile phone", "Peripherals (keyboard, mouse, headset)", "Software licence", "Network / Wi-Fi equipment", "Printer / scanner", "Other IT item"];
const STATUS_TONE = { it: "warn", hr: "warn", finance: "warn", approved: "good", ordered: "info", rejected: "bad" };
const STATUS_TEXT = { it: "With IT", hr: "With HR", finance: "With Finance", approved: "Approved", ordered: "Ordered", rejected: "Rejected" };

/** Which approval stage this signed-in user can act on ("it" / "hr" / "finance"), or "all" for the Super Admin. */
export function buyStageFor(user) {
  if (!user) return null;
  if (user.role === "superadmin") return "all";
  if (user.role !== "admin") return null;
  const k = adminKind(user);
  if (k === "it" || (user.modules || []).includes("it")) return "it";
  if (k === "hr") return "hr";
  if (k === "finance") return "finance";
  if (k === "hr_finance") return "hr_finance";
  return null;
}
const canAct = (stage, status) => stage === "all" || stage === status || (stage === "hr_finance" && ["hr", "finance"].includes(status));

export function itBuyCount(data, user) {
  const st = buyStageFor(user);
  if (!st) return 0;
  return (data.suite?.itPurchases || []).filter((p) => canAct(st, p.status)).length;
}

function approversFor(x, stage) {
  return (x.admins || []).filter((a) => a.status === "active" && (stage === "it" ? (a.modules || []).includes("it") : stage === "hr" ? ["hr", "hr_finance"].includes(adminKind({ ...a, role: "admin" })) : ["finance", "hr_finance"].includes(adminKind({ ...a, role: "admin" })))).map((a) => a.admin_code);
}

/** Employee side — raise and track IT purchase requests (shown in Quick support → IT support & my assets). */
export function MyItPurchases() {
  const { data, user, suiteDo, notifyToast } = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ category: CATS[0], item: "", qty: 1, est_cost: "", reason: "", needed_by: "" });
  const mine = (data.suite?.itPurchases || []).filter((p) => p.employee_code === user.employee_code);
  function submit() {
    if (!f.item.trim() || !f.reason.trim() || !(Number(f.est_cost) > 0)) return notifyToast("Enter the item, an estimated cost and the reason.", "error");
    const r = suiteDo("it-purchase", (s, { x, me, now }) => {
      s.itPurchases = s.itPurchases || [];
      const id = `ITP-${String(s.itPurchases.length + 1).padStart(4, "0")}`;
      s.itPurchases.unshift({ id, employee_code: me, ...f, qty: Number(f.qty) || 1, est_cost: Number(f.est_cost), status: "it", steps: [], created_at: now });
      approversFor(x, "it").forEach((c) => x.notifications.unshift({ id: `N-${Date.now()}-${c}`, to: c, text: `New IT purchase request ${id}: ${f.item} (₹${fmtNum(Number(f.est_cost) * (Number(f.qty) || 1))}).`, at: now, read: false, link: "/it-purchase" }));
      return { id };
    }, { action: "IT_PURCHASE_REQUEST", details: (r) => `${r.id} · ${f.item}`, note: { to: user.employee_code, text: `Your IT purchase request for ${f.item} was sent to IT for review.`, link: "/assets" } });
    if (!r.ok) return notifyToast(r.error, "error");
    notifyToast("Request sent to IT. It then goes to HR and Finance for approval.");
    setOpen(false);
    setF({ category: CATS[0], item: "", qty: 1, est_cost: "", reason: "", needed_by: "" });
  }
  return (
    <SectionCard title="IT purchase requests" subtitle="Need new equipment or software? IT reviews it, then HR and Finance approve." action={<Button size="small" variant="contained" startIcon={<AddShoppingCartRounded />} onClick={() => setOpen(true)}>Request IT purchase</Button>} noPad>
      {mine.length === 0 ? <EmptyState title="No purchase requests yet" text="Requests you raise appear here with the stage they are at." /> : (
        <TableWrap>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead><TableRow><TableCell>Ref</TableCell><TableCell>Item</TableCell><TableCell align="right">Est. cost</TableCell><TableCell>Stage</TableCell><TableCell>Raised</TableCell></TableRow></TableHead>
            <TableBody>{mine.map((p) => (
              <TableRow key={p.id}><TableCell><Mono>{p.id}</Mono></TableCell><TableCell>{p.item}<Typography variant="caption" display="block" color="text.secondary">{p.category} · qty {p.qty}</Typography></TableCell><TableCell align="right">₹{fmtNum(p.est_cost * p.qty)}</TableCell><TableCell><Tag tone={STATUS_TONE[p.status]}>{STATUS_TEXT[p.status]}</Tag></TableCell><TableCell>{timeAgo(p.created_at)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        </TableWrap>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Request an IT purchase</DialogTitle>
        <DialogContent>
          <Stack spacing={1.6} sx={{ mt: 1 }}>
            <ListSelect listKey="it_purchase_category" blank={false} label="Category" value={f.category} onChange={(v) => setF({ ...f, category: v })} />
            <TextField label="Item and specification *" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} placeholder="e.g. 27-inch 4K monitor, USB-C" />
            <Stack direction="row" spacing={1.5}>
              <TextField type="number" label="Quantity" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} sx={{ width: 120 }} />
              <TextField type="number" label="Estimated cost per unit (₹) *" value={f.est_cost} onChange={(e) => setF({ ...f, est_cost: e.target.value })} sx={{ flex: 1 }} />
              <TextField type="date" label="Needed by" value={f.needed_by} onChange={(e) => setF({ ...f, needed_by: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            <TextField multiline minRows={3} label="Why do you need it? *" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
            <Stepper activeStep={-1} alternativeLabel>{IT_BUY_STAGES.map(([k, l]) => <Step key={k}><StepLabel>{l}</StepLabel></Step>)}</Stepper>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={submit}>Send to IT</Button></DialogActions>
      </Dialog>
    </SectionCard>
  );
}

/** Admin side — the approval queue for the signed-in admin's stage, plus every request with its trail. */
export function ItPurchaseApprovals({ embedded }) {
  const { data, user, nameOf, suiteDo, notifyToast } = useStore();
  const stage = buyStageFor(user);
  const [view, setView] = useState("mine");
  const [act, setAct] = useState(null);
  const [note, setNote] = useState("");
  const all = data.suite?.itPurchases || [];
  const rows = view === "mine" ? all.filter((p) => canAct(stage, p.status)) : all;
  const empBy = useMemo(() => Object.fromEntries(data.employees.map((e) => [e.employee_code, e])), [data.employees]);

  function decide(p, approve) {
    if (!approve && !note.trim()) return notifyToast("Give a reason for the rejection.", "error");
    const r = suiteDo("it-purchase", (s, { x, code, now }) => {
      const rec = (s.itPurchases || []).find((i) => i.id === p.id);
      if (!rec || !canAct(stage, rec.status)) return { ok: false, error: "This request is no longer at your stage." };
      const from = rec.status;
      rec.steps = [...(rec.steps || []), { level: from, by: code, at: now, status: approve ? "approved" : "rejected", note: note.trim() }];
      rec.status = !approve ? "rejected" : from === "it" ? "hr" : from === "hr" ? "finance" : "approved";
      if (approve && rec.status !== "approved") approversFor(x, rec.status).forEach((c) => x.notifications.unshift({ id: `N-${Date.now()}-${c}`, to: c, text: `IT purchase ${rec.id} (${rec.item}) needs your approval.`, at: now, read: false, link: "/it-purchase" }));
      return { id: rec.id, status: rec.status, emp: rec.employee_code };
    }, { action: approve ? "IT_PURCHASE_APPROVE" : "IT_PURCHASE_REJECT", details: (r) => `${r.id} → ${r.status}`, note: (r) => ({ to: r.emp, text: `Your IT purchase ${r.id} is now: ${STATUS_TEXT[r.status]}.`, link: "/assets" }) });
    if (!r.ok) return notifyToast(r.error, "error");
    notifyToast(approve ? "Approved and sent to the next stage." : "Rejected; the employee was told.");
    setAct(null);
    setNote("");
  }
  function markOrdered(p) {
    suiteDo("it-purchase", (s, { now }) => { const rec = s.itPurchases.find((i) => i.id === p.id); rec.status = "ordered"; rec.ordered_at = now; return { id: rec.id }; }, { action: "IT_PURCHASE_ORDERED", details: p.id, note: { to: p.employee_code, text: `Your IT purchase ${p.id} has been ordered.`, link: "/assets" } });
  }

  return (
    <>
      {!embedded && <PageHeader title="IT purchase approvals" subtitle="Every IT purchase goes IT → HR → Finance. You see the requests waiting at your stage; the full trail is under All requests." />}
      <Card sx={{ p: 1.5, mb: 2, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        {IT_BUY_STAGES.map(([k, l, h], i) => (
          <React.Fragment key={k}>
            <Box sx={{ px: 1.4, py: 0.8, borderRadius: 2, background: canAct(stage, k) ? "#E7F2FD" : "#f3f6f7", border: canAct(stage, k) ? "1px solid #1E88E5" : "1px solid #e3e9ec" }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 800 }}>{i + 1}. {l}</Typography>
              <Typography sx={{ fontSize: "0.58rem", color: "#6b777c" }}>{h} · {all.filter((p) => p.status === k).length} waiting</Typography>
            </Box>
            {i < 2 && <Typography sx={{ color: "#9aa7ac" }}>→</Typography>}
          </React.Fragment>
        ))}
        <Box sx={{ flex: 1 }} />
        <TextField select size="small" value={view} onChange={(e) => setView(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="mine">Waiting for me ({all.filter((p) => canAct(stage, p.status)).length})</MenuItem>
          <MenuItem value="all">All requests ({all.length})</MenuItem>
        </TextField>
      </Card>
      <SectionCard noPad>
        {rows.length === 0 ? <EmptyState title="Nothing waiting" text="IT purchase requests that reach your stage appear here." /> : (
          <TableWrap>
            <Table size="small" sx={{ minWidth: 860 }}>
              <TableHead><TableRow><TableCell>Ref</TableCell><TableCell>Employee</TableCell><TableCell>Item</TableCell><TableCell align="right">Total</TableCell><TableCell>Reason</TableCell><TableCell>Stage</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
              <TableBody>{rows.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell><Mono>{p.id}</Mono><Typography variant="caption" display="block" color="text.secondary">{fmtDate(p.created_at)}</Typography></TableCell>
                  <TableCell><PersonCell name={nameOf(p.employee_code)} sub={empBy[p.employee_code]?.department} /></TableCell>
                  <TableCell>{p.item}<Typography variant="caption" display="block" color="text.secondary">{p.category} · qty {p.qty}{p.needed_by ? ` · by ${fmtDate(p.needed_by)}` : ""}</Typography></TableCell>
                  <TableCell align="right">₹{fmtNum(p.est_cost * p.qty)}</TableCell>
                  <TableCell sx={{ maxWidth: 220 }}><Typography variant="body2" sx={{ fontSize: "0.68rem" }}>{p.reason}</Typography>{(p.steps || []).map((st, i) => <Typography key={i} variant="caption" display="block" color="text.secondary">{st.level.toUpperCase()} {st.status} by {nameOf(st.by)}{st.note ? ` — ${st.note}` : ""}</Typography>)}</TableCell>
                  <TableCell><Tag tone={STATUS_TONE[p.status]}>{STATUS_TEXT[p.status]}</Tag></TableCell>
                  <TableCell align="right">
                    {canAct(stage, p.status) ? <Stack direction="row" spacing={0.6} sx={{ justifyContent: "flex-end" }}><Button size="small" variant="contained" onClick={() => setAct({ p, approve: true })}>Approve</Button><Button size="small" color="error" onClick={() => setAct({ p, approve: false })}>Reject</Button></Stack>
                      : p.status === "approved" && (stage === "it" || stage === "all") ? <Button size="small" onClick={() => markOrdered(p)}>Mark ordered</Button> : "—"}
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>
      <Dialog open={!!act} onClose={() => setAct(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{act?.approve ? "Approve" : "Reject"} {act?.p.id}</DialogTitle>
        <DialogContent><TextField fullWidth multiline minRows={2} sx={{ mt: 1 }} label={act?.approve ? "Note (optional)" : "Reason *"} value={note} onChange={(e) => setNote(e.target.value)} /></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setAct(null)}>Cancel</Button><Button variant="contained" color={act?.approve ? "primary" : "error"} onClick={() => decide(act.p, act.approve)}>{act?.approve ? "Approve" : "Reject"}</Button></DialogActions>
      </Dialog>
    </>
  );
}

/** IT admin dashboard (home for access profile "it"). */
export function ItDashboard() {
  const { data, user, nameOf } = useStore();
  const navigate = useNavigate();
  const tickets = data.itTickets || [];
  const open = tickets.filter((t) => IT_OPEN.includes(t.status));
  const breached = open.filter((t) => slaState(t) === "breached");
  const assets = data.assets || [];
  const assigned = assets.filter((a) => a.assigned_to).length;
  const assetReq = data.requests.filter((r) => r.type === "asset" && r.status === "Pending");
  const buys = itBuyCount(data, user);
  const byCat = Object.entries(open.reduce((m, t) => ({ ...m, [t.category]: (m[t.category] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const tat = data.settings.support_tat || { it_days: 1 };
  return (
    <>
      <PageHeader title={`Welcome, ${user.full_name.split(" ")[0]}`} subtitle={`IT service desk, assets and IT purchase approvals. Target response time for IT queries: ${tat.it_min_minutes || 30} minutes to 1 hour.`} />
      <Grid min={190} sx={{ mb: 2.5 }}>
        <StatCard label="Open IT tickets" value={open.length} hint={`${breached.length} past SLA`} tone={breached.length ? "bad" : "info"} icon={<ConfirmationNumberRounded />} onClick={() => navigate("/it-helpdesk")} />
        <StatCard label="Asset requests" value={assetReq.length} hint="waiting for approval" tone="warn" icon={<Inventory2Rounded />} onClick={() => navigate("/inbox")} />
        <StatCard label="IT purchases at IT" value={buys} hint="then HR → Finance" tone="accent" icon={<ShoppingCartCheckoutRounded />} onClick={() => navigate("/it-purchase")} />
        <StatCard label="Assets allocated" value={`${assigned}/${assets.length}`} hint={`${assets.length - assigned} in stock`} tone="good" icon={<ComputerRounded />} onClick={() => navigate("/assets-admin")} />
      </Grid>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" }, gap: 2 }}>
        <SectionCard title="Tickets that need attention" subtitle="Past or close to SLA, oldest first" noPad>
          {open.length === 0 ? <EmptyState title="All clear" text="No open IT tickets." /> : (
            <TableWrap><Table size="small"><TableBody>{[...open].sort((a, b) => a.sla_due.localeCompare(b.sla_due)).slice(0, 8).map((t) => (
              <TableRow key={t.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate("/it-helpdesk")}>
                <TableCell sx={{ whiteSpace: "nowrap" }}><Mono>{t.id}</Mono></TableCell><TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{t.subject}</Typography><Typography variant="caption" display="block" color="text.secondary">{nameOf(t.requester)} · {IT_CATEGORY_LABEL[t.category]}</Typography></TableCell>
                <TableCell>{slaState(t) === "breached" ? <Tag tone="bad">SLA breached</Tag> : slaState(t) === "at_risk" ? <Tag tone="warn">At risk</Tag> : <Tag tone="good">On time</Tag>}</TableCell>
              </TableRow>))}</TableBody></Table></TableWrap>
          )}
        </SectionCard>
        <SectionCard title="Open tickets by category">
          {byCat.length === 0 ? <Typography variant="body2" color="text.secondary">Nothing open.</Typography> : byCat.map(([c, n]) => (
            <Stack key={c} direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
              <Typography sx={{ fontSize: "0.7rem", width: 170 }}>{IT_CATEGORY_LABEL[c] || c}</Typography>
              <Box sx={{ flex: 1, height: 8, borderRadius: 4, background: "#eef2f4" }}><Box sx={{ width: `${(n / open.length) * 100}%`, height: "100%", borderRadius: 4, background: "#E53950" }} /></Box>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, width: 20, textAlign: "right" }}>{n}</Typography>
            </Stack>
          ))}
          {breached.length > 0 && <Stack direction="row" spacing={0.8} sx={{ mt: 1.5, color: "#b4232f", alignItems: "center" }}><WarningAmberRounded sx={{ fontSize: 16 }} /><Typography sx={{ fontSize: "0.66rem" }}>{breached.length} ticket(s) are past their SLA.</Typography></Stack>}
        </SectionCard>
      </Box>
    </>
  );
}
