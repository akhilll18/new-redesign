// My assets: what is assigned to me, confirm receipt, report a problem, request new equipment.
import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { LaptopMacRounded, MonitorRounded, PhoneIphoneRounded, SimCardRounded, BadgeRounded, HeadsetMicRounded, TwoWheelerRounded, DevicesOtherRounded, AddRounded, ReportProblemRounded, TaskAltRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, Tag, EmptyState, Mono, KeyVal, Grid } from "../../components/kit/UI.jsx";
import { RequestDrawer, RequestStatus } from "../../components/kit/Requests.jsx";
import ListSelect from "../../components/kit/ListSelect.jsx";
import { ASSET_CATEGORIES, validateAssetRequest, validateAssetPurchase, chainLabel, defaultChain } from "../../lib/requests.js";
import { ShoppingCartRounded } from "@mui/icons-material";
import { fmtDate, fmtNum, isoDate } from "../../lib/utils.js";
import { AssetItSupport, RaiseItTicketDialog } from "../../components/collab/ItSupport.jsx";
import { SupportAgentRounded } from "@mui/icons-material";

export const ASSET_ICON = { Laptop: <LaptopMacRounded />, Monitor: <MonitorRounded />, Phone: <PhoneIphoneRounded />, SIM: <SimCardRounded />, "Access card": <BadgeRounded />, Headset: <HeadsetMicRounded />, Vehicle: <TwoWheelerRounded />, Other: <DevicesOtherRounded /> };

function RequestAssetDialog({ open, onClose }) {
  const { createRequest, notifyToast, user } = useStore();
  const [f, setF] = useState({});
  const [tried, setTried] = useState(false);
  React.useEffect(() => {
    if (open) {
      setF({ category: "Monitor", reason: "", needed_by: isoDate(Date.now() + 7 * 86400000), priority: "normal" });
      setTried(false);
    }
  }, [open]);
  const { errors } = validateAssetRequest(f);
  const show = (k) => tried && errors[k];
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Request an asset</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <ListSelect listKey="asset_category" size="small" label="What do you need?" required value={f.category || ""} onChange={(v) => setF({ ...f, category: v })} />
          <TextField label="Why do you need it? *" multiline minRows={2} value={f.reason || ""} onChange={(e) => setF({ ...f, reason: e.target.value })} error={!!show("reason")} helperText={show("reason") || " "} />
          <Stack direction="row" spacing={2}>
            <TextField label="Needed by *" type="date" value={f.needed_by || ""} onChange={(e) => setF({ ...f, needed_by: e.target.value })} error={!!show("needed_by")} helperText={show("needed_by") || " "} slotProps={{ inputLabel: { shrink: true } }} />
            <FormControl size="small" fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select label="Priority" value={f.priority || "normal"} onChange={(e) => setF({ ...f, priority: e.target.value })}>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="high">Urgent</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>Goes to {user.reporting_manager ? "your manager" : "the asset team"} first, then the asset team assigns one from stock.</Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { setTried(true); if (Object.keys(errors).length) return; const r = createRequest("asset", f); if (!r.ok) return notifyToast(Object.values(r.errors)[0], "error"); notifyToast(`Asset request ${r.id} sent.`); onClose(); }}>Send request</Button>
      </DialogActions>
    </Dialog>
  );
}

// v10.11: ask the company to BUY new equipment (not in stock). Goes through the asset-purchase approval chain
// (default: Reporting manager → IT admin → HR admin → Finance admin; the Super Admin can change it in Policies).
function PurchaseRequestDialog({ open, onClose }) {
  const { createRequest, notifyToast, data } = useStore();
  const [f, setF] = useState({});
  const [tried, setTried] = useState(false);
  React.useEffect(() => {
    if (open) { setF({ item: "", category: "Laptop", quantity: 1, est_cost: "", vendor: "", reason: "", needed_by: isoDate(Date.now() + 14 * 86400000) }); setTried(false); }
  }, [open]);
  const { errors, total } = validateAssetPurchase(f);
  const show = (k) => tried && errors[k];
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const chain = chainLabel(data.settings.workflow?.asset_purchase || defaultChain("asset_purchase"), "asset_purchase");
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Asset purchase request</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }} data-testid="purchase-form">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField size="small" fullWidth label="What should be bought? *" placeholder="e.g. Dell Latitude 5440, 16 GB" value={f.item || ""} onChange={set("item")} error={!!show("item")} helperText={show("item") || " "} inputProps={{ "data-field": "item" }} />
            <ListSelect listKey="asset_category" size="small" fullWidth={false} sx={{ minWidth: 160 }} label="Category" required value={f.category || ""} onChange={(v) => setF({ ...f, category: v })} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField size="small" label="Quantity *" type="number" value={f.quantity ?? ""} onChange={set("quantity")} error={!!show("quantity")} helperText={show("quantity") || " "} inputProps={{ "data-field": "quantity" }} />
            <TextField size="small" label="Estimated cost per unit (₹) *" type="number" value={f.est_cost ?? ""} onChange={set("est_cost")} error={!!show("est_cost")} helperText={show("est_cost") || (total ? `Total ₹${fmtNum(total)}` : " ")} inputProps={{ "data-field": "est_cost" }} />
            <TextField size="small" label="Needed by *" type="date" value={f.needed_by || ""} onChange={set("needed_by")} error={!!show("needed_by")} helperText={show("needed_by") || " "} slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
          <TextField size="small" label="Preferred vendor or link (optional)" value={f.vendor || ""} onChange={set("vendor")} />
          <TextField label="Why is it needed? *" multiline minRows={2} value={f.reason || ""} onChange={set("reason")} error={!!show("reason")} helperText={show("reason") || " "} inputProps={{ "data-field": "reason" }} />
          <Alert severity="info" sx={{ fontSize: "0.65rem" }}>Approval: {chain}. You are notified at every step.</Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" data-testid="purchase-submit" onClick={() => { setTried(true); if (Object.keys(errors).length) return; const r = createRequest("asset_purchase", f); if (!r.ok) return notifyToast(Object.values(r.errors || { e: r.error })[0], "error"); notifyToast(`Purchase request ${r.id} sent for approval.`); onClose(); }}>Send for approval</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function MyAssets({ embedded = false, onItTab }) {
  const { data, user, acknowledgeAsset, reportAssetIssue, notifyToast } = useStore();
  const [params, setParams] = useSearchParams();
  const [reqOpen, setReqOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [issue, setIssue] = useState(null);
  const [issueText, setIssueText] = useState("");
  const [itRaise, setItRaise] = useState(null);
  const mine = data.assets.filter((a) => a.assigned_to === user.employee_code);
  const reqs = data.requests.filter((r) => ["asset", "asset_purchase"].includes(r.type) && r.employee_code === user.employee_code);
  return (
    <>
      {embedded ? (
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.68rem", color: "#5c675f" }}>Company equipment assigned to you. Confirm what you received, request new equipment or report a problem.</Typography>
          <Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<ShoppingCartRounded />} onClick={() => setBuyOpen(true)}>Purchase request</Button><Button variant="contained" startIcon={<AddRounded />} onClick={() => setReqOpen(true)}>Request an asset</Button></Stack>
        </Stack>
      ) : <PageHeader eyebrow="ME · ASSETS" title="My assets" subtitle="Company equipment assigned to you. Confirm what you received, request new equipment, and get IT support for device, software or access problems." actions={<><Button variant="outlined" startIcon={<SupportAgentRounded />} onClick={() => setItRaise({})}>IT support</Button><Button variant="outlined" startIcon={<ShoppingCartRounded />} onClick={() => setBuyOpen(true)}>Purchase request</Button><Button variant="contained" startIcon={<AddRounded />} onClick={() => setReqOpen(true)}>Request an asset</Button></>} />}
      <Stack spacing={2.5}>
        {mine.some((a) => !a.acknowledged) && <Alert severity="warning">Please confirm you received {mine.filter((a) => !a.acknowledged).map((a) => a.asset_id).join(", ")}.</Alert>}
        {mine.length === 0 ? (
          <SectionCard><EmptyState title="No assets assigned" text="Request a laptop, phone or other equipment." /></SectionCard>
        ) : (
          <Grid min={280}>
            {mine.map((a) => (
              <Card key={a.asset_id} sx={{ p: 2 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                  <Box sx={{ width: 42, height: 42, borderRadius: 2, display: "grid", placeItems: "center", background: "#e8f2ec", color: "#244d3d", "& svg": { fontSize: 24 } }}>{ASSET_ICON[a.category] || ASSET_ICON.Other}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700 }}>{a.model}</Typography>
                    <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}><Mono>{a.asset_id}</Mono> · {a.category}</Typography>
                  </Box>
                  <Tag tone={a.acknowledged ? "good" : "warn"}>{a.acknowledged ? "Confirmed" : "Confirm receipt"}</Tag>
                </Stack>
                <Box sx={{ mt: 1.5 }}>
                  <KeyVal cols={2} items={[["Serial", a.serial], ["Assigned", fmtDate(a.assigned_on)], ["Warranty until", fmtDate(a.warranty_end)], ["Condition", a.condition]]} />
                </Box>
                {a.issue && <Alert severity="info" sx={{ mt: 1.5, py: 0 }}>Reported {fmtDate(a.issue.at)}: {a.issue.text}</Alert>}
                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                  {!a.acknowledged && <Button size="small" variant="contained" startIcon={<TaskAltRounded />} onClick={() => { const r = acknowledgeAsset(a.asset_id); notifyToast(r.ok ? `Receipt of ${a.asset_id} confirmed.` : r.error, r.ok ? "success" : "error"); }}>I received it</Button>}
                  <Button size="small" startIcon={<ReportProblemRounded />} onClick={() => { setIssue(a); setIssueText(""); }}>Report a problem</Button>
                  {["Laptop", "Monitor", "Phone", "SIM", "Headset"].includes(a.category) && <Button size="small" startIcon={<SupportAgentRounded />} onClick={() => setItRaise({ asset_id: a.asset_id, category: a.category === "SIM" ? "network" : "hardware", subject: `${a.category} ${a.asset_id}: ` })}>Get IT help</Button>}
                </Stack>
              </Card>
            ))}
          </Grid>
        )}
        <SectionCard title="My asset requests" noPad>
          {reqs.length === 0 ? <Typography sx={{ p: 2, fontSize: "0.66rem", color: "#78827b" }}>No requests yet.</Typography> : reqs.map((r) => (
            <Stack key={r.request_id} direction="row" spacing={1.5} onClick={() => setParams({ req: r.request_id })} sx={{ px: 2, py: 1.2, borderBottom: "1px solid #f0f2ef", alignItems: "center", cursor: "pointer", "&:hover": { background: "#f7faf7" } }}>
              <Box sx={{ color: "#2e7d32", "& svg": { fontSize: 20 } }}>{r.type === "asset_purchase" ? <ShoppingCartRounded /> : ASSET_ICON[r.category] || ASSET_ICON.Other}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{r.type === "asset_purchase" ? `Purchase · ${r.quantity} × ${r.item} · ₹${fmtNum(r.total_cost)}` : r.category}{r.assigned_asset ? ` · ${r.assigned_asset}` : ""}</Typography>
                <Typography noWrap sx={{ fontSize: "0.6rem", color: "#78827b" }}><Mono>{r.request_id}</Mono> · needed by {fmtDate(r.needed_by)} · {r.reason}</Typography>
              </Box>
              <RequestStatus r={r} />
            </Stack>
          ))}
        </SectionCard>
        <AssetItSupport onRaise={setItRaise} />
        <Typography sx={{ fontSize: "0.6rem", color: "#9aa39c" }}>Total value of equipment assigned to you: ₹{fmtNum(mine.reduce((s, a) => s + a.cost, 0))}. Return everything to IT on your last day.</Typography>
      </Stack>
      <RequestAssetDialog open={reqOpen} onClose={() => setReqOpen(false)} />
      <PurchaseRequestDialog open={buyOpen} onClose={() => setBuyOpen(false)} />
      <RequestDrawer id={params.get("req")} onClose={() => setParams({})} />
      <RaiseItTicketDialog open={!!itRaise} preset={itRaise || {}} onClose={() => setItRaise(null)} />
      <Dialog open={!!issue} onClose={() => setIssue(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Report a problem with {issue?.asset_id}</DialogTitle>
        <DialogContent><TextField sx={{ mt: 1 }} label="What is wrong?" multiline minRows={3} value={issueText} onChange={(e) => setIssueText(e.target.value)} /></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setIssue(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { const r = reportAssetIssue(issue.asset_id, issueText); if (!r.ok) return notifyToast(r.error, "error"); notifyToast("Problem reported to the asset team."); setIssue(null); }}>Report</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
