// v10.3 — AI automation (/automation). Granular, rule-by-rule automation of leave, attendance, payroll, payslips, taxes,
// registrations, contracts, benefits eligibility, probation, BGV and onboarding. For each rule: Auto / Review / Off and its
// own thresholds. The review queue holds what the AI prepared for a person to approve in one tap; the log shows what it did.
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Card, Chip, FormControlLabel, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { SmartToyRounded, PlaylistAddCheckRounded, BoltRounded, RuleRounded, PlayArrowRounded, CheckRounded, CloseRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { ModuleHub, useWho, C } from "../../components/suite/Hub.jsx";
import { SectionCard, Tag, TableWrap, EmptyState } from "../../components/kit/UI.jsx";
import { AiInsight } from "../../components/ai/AiInsight.jsx";
import { RULES, RULE_BY, AUTOMATION_GROUPS, MODES, ruleConfig, automationVisible, canManageRule, scanAutomation } from "../../lib/automation.js";
import { fmtDateTime } from "../../lib/utils.js";

export default function AutomationCentre() {
  const { allData, user, runAutomation, decideAutomation, setAutomationRule, pauseAutomation, notifyToast } = useStore();
  const data = allData;
  const { lens, isSuper } = useWho();
  const [tab, setTab] = useState("queue");
  const a = data.automation || { queue: [], log: [], rules: {} };
  const rules = RULES.filter((r) => automationVisible({ rule: r.id }, user));
  const queue = (a.queue || []).filter((q) => q.status === "review" && automationVisible(q, user));
  const log = (a.log || []).filter((l) => automationVisible({ rule: l.rule }, user));
  const pending = useMemo(() => scanAutomation(data).filter((p) => automationVisible(p, user)), [data, user]);
  const autoOn = rules.filter((r) => ruleConfig(data, r.id).mode === "auto").length;
  const act = (r, msg) => (r?.ok ? notifyToast(msg) : notifyToast(r?.error || "Could not do that.", "error"));

  return (
    <ModuleHub
      eyebrow={`AI · AUTOMATION · ${lens}`}
      title="AI automation"
      subtitle="Everything repetitive runs on its own, rule by rule: the AI approves what is clearly within policy, chases what is due, fixes what drifted and prepares the rest for a one-tap decision. Every rule has its own mode and thresholds; everything is logged."
      live={a.paused ? "PAUSED" : "RUNNING"}
      actions={<Button variant="contained" startIcon={<PlayArrowRounded />} onClick={() => { const r = runAutomation({ manual: true }); act(r, `Automation ran: ${r.auto || 0} done, ${r.queued || 0} queued for review.`); }}>Run now</Button>}
      tabs={[["queue", "Review queue", null, queue.length], ["rules", "Rules"], ["log", "What AI did"]]}
      tab={tab}
      onTab={setTab}
      brief={{
        text: <>{a.paused ? <b>Automation is paused.</b> : <>The AI is running <b>{autoOn} rule{autoOn === 1 ? "" : "s"}</b> automatically</>} · <b>{queue.length}</b> item(s) wait for your one-tap decision · {pending.length} new finding(s) on the next run{a.last_run ? ` · last run ${fmtDateTime(a.last_run)}` : ""}.</>,
        actions: [["Open queue", () => setTab("queue")], ["Tune rules", () => setTab("rules")]],
        ask: "Look at my AI automation rules and review queue and suggest which rules I can safely switch to Auto and which thresholds to change.",
      }}
      kpis={[
        { label: "Rules on auto", value: autoOn, icon: <BoltRounded />, tone: "mint", hint: `${rules.length} rules for you` },
        { label: "Review queue", value: queue.length, icon: <PlaylistAddCheckRounded />, tone: queue.length ? "glob" : "mint", onClick: () => setTab("queue") },
        { label: "Actions logged", value: log.length, icon: <SmartToyRounded />, hint: "notifications, approvals, fixes", onClick: () => setTab("log") },
        { label: "Next run finds", value: pending.length, icon: <RuleRounded />, tone: "purple" },
      ]}
    >
      {isSuper && (
        <FormControlLabel sx={{ mb: 1 }} control={<Switch checked={!a.paused} onChange={(e) => act(pauseAutomation(!e.target.checked), e.target.checked ? "Automation resumed." : "Automation paused for everyone.")} />} label={<Typography sx={{ fontSize: "0.7rem", fontWeight: 600 }}>Automation on for the whole organisation</Typography>} />
      )}

      {tab === "queue" && (
        <SectionCard title="Prepared by AI — waiting for a person" subtitle="Approve to let the AI finish it, or dismiss. Decisions are written to the audit log with your name." noPad>
          {queue.length === 0 ? <Box sx={{ p: 2 }}><EmptyState title="Nothing waiting" text="Items appear here when a rule in Review mode finds something. Switch a rule to Auto to let the AI finish it on its own." /></Box> : (
            <TableWrap>
              <Table size="small" sx={{ minWidth: 760 }}>
                <TableHead><TableRow><TableCell>What the AI prepared</TableCell><TableCell>Rule</TableCell><TableCell>Found</TableCell><TableCell align="right">Decide</TableCell></TableRow></TableHead>
                <TableBody>
                  {queue.map((q) => {
                    const mine = canManageRule(RULE_BY[q.rule], user);
                    return (
                      <TableRow key={q.id} hover>
                        <TableCell><Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{q.title}</Typography><Typography sx={{ fontSize: "0.6rem", color: "text.secondary" }}>{q.detail || q.text}</Typography></TableCell>
                        <TableCell><Tag tone="info">{RULE_BY[q.rule]?.label}</Tag></TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDateTime(q.at)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          {mine ? (
                            <>
                              <Button size="small" variant="contained" startIcon={<CheckRounded />} onClick={() => { const r = decideAutomation(q.id, true); act(r, r.stale ? "Already handled by someone — removed from the queue." : "Done."); }}>Approve</Button>
                              <Button size="small" color="inherit" startIcon={<CloseRounded />} onClick={() => act(decideAutomation(q.id, false), "Dismissed.")} sx={{ ml: 0.5 }}>Dismiss</Button>
                            </>
                          ) : <Typography sx={{ fontSize: "0.6rem", color: "text.secondary" }}>Owned by {RULE_BY[q.rule]?.modules.join(" / ")}</Typography>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </SectionCard>
      )}

      {tab === "rules" && (
        <Stack spacing={2}>
          <AiInsight title="AI · how automated are we?" facts={rules.map((r) => { const c = ruleConfig(data, r.id); return `${r.label}: ${c.mode}${Object.keys(c.params).length ? ` (${Object.entries(c.params).map(([k, v]) => `${k}=${v}`).join(", ")})` : ""}`; }).concat([`${queue.length} items waiting in review`, `${log.length} actions done`])} audience="the admin who owns these rules; recommend which to move to Auto and why" />
          {AUTOMATION_GROUPS.map(([g, label]) => {
            const rs = rules.filter((r) => r.group === g);
            if (!rs.length) return null;
            return (
              <SectionCard key={g} title={label} noPad>
                {rs.map((r) => <RuleRow key={r.id} r={r} data={data} canEdit={canManageRule(r, user)} onSave={(patch, msg) => act(setAutomationRule(r.id, patch), msg)} />)}
              </SectionCard>
            );
          })}
        </Stack>
      )}

      {tab === "log" && (
        <SectionCard title="What the AI did" subtitle="Newest first. Approvals made by the AI name the rule on the request and in the audit log." noPad>
          {log.length === 0 ? <Box sx={{ p: 2 }}><EmptyState title="No actions yet" text="Press Run now, or wait for the next automatic run." /></Box> : (
            <TableWrap>
              <Table size="small" sx={{ minWidth: 700 }}>
                <TableHead><TableRow><TableCell>When</TableCell><TableCell>Rule</TableCell><TableCell>Action</TableCell><TableCell>By</TableCell></TableRow></TableHead>
                <TableBody>
                  {log.slice(0, 200).map((l) => (
                    <TableRow key={l.id} hover>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDateTime(l.at)}</TableCell>
                      <TableCell><Tag tone="info">{RULE_BY[l.rule]?.label || l.rule}</Tag></TableCell>
                      <TableCell><Typography sx={{ fontSize: "0.64rem" }}>{l.text}</Typography></TableCell>
                      <TableCell>{l.by === "AI" ? <Chip size="small" icon={<SmartToyRounded sx={{ fontSize: 14 }} />} label="AI" /> : l.by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </SectionCard>
      )}
    </ModuleHub>
  );
}

function RuleRow({ r, data, canEdit, onSave }) {
  const cfg = ruleConfig(data, r.id);
  const [params, setParams] = useState(cfg.params);
  const dirty = JSON.stringify(params) !== JSON.stringify(cfg.params);
  return (
    <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider", display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr auto" }, gap: 1.5, alignItems: "center" }}>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: C.navy }}>{r.label}</Typography>
          <Tag tone={cfg.mode === "auto" ? "good" : cfg.mode === "review" ? "info" : "neutral"}>{MODES.find(([m]) => m === cfg.mode)?.[1]}</Tag>
        </Stack>
        <Typography sx={{ fontSize: "0.62rem", color: "text.secondary", mt: 0.4, maxWidth: "90ch" }}>{r.text}</Typography>
        {Object.keys(r.params).length > 0 && (
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1, alignItems: "center" }}>
            {Object.entries(r.params).map(([k, [label, , unit]]) => (
              <TextField key={k} size="small" label={label} value={params[k]} disabled={!canEdit} type={unit === "time" ? "time" : "text"} onChange={(e) => setParams((p) => ({ ...p, [k]: unit === "time" ? e.target.value : e.target.value.replace(/[^\d.]/g, "") }))} sx={{ width: 170 }} slotProps={{ inputLabel: { shrink: true } }} />
            ))}
            {dirty && <Button size="small" variant="outlined" onClick={() => onSave({ params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, r.params[k][2] === "time" ? v : Number(v)])) }, "Thresholds saved.")}>Save thresholds</Button>}
          </Stack>
        )}
      </Box>
      <ToggleButtonGroup size="small" exclusive value={cfg.mode} disabled={!canEdit} onChange={(_, v) => v && onSave({ mode: v }, `${r.label}: ${v}.`)}>
        {MODES.map(([m, l]) => <ToggleButton key={m} value={m} sx={{ fontSize: "0.62rem", px: 1.4 }}>{l}</ToggleButton>)}
      </ToggleButtonGroup>
    </Box>
  );
}
