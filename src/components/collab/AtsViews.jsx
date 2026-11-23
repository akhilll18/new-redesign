// Applicant tracking & recruitment management: applicants with AI screening, interviews with AI slot finding,
// job postings with AI job descriptions, and the original requisitions/funnel view.
import { jitsiLink } from "../../lib/conferencing.js";
import ListSelect from "../kit/ListSelect.jsx";
import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, FormControl, FormControlLabel, IconButton, InputAdornment, InputLabel, LinearProgress, MenuItem, Rating, Select, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import { AddRounded, CloseRounded, EventRounded, PersonAddAlt1Rounded, VerifiedUserRounded, HistoryEduRounded, ArrowForwardRounded, BlockRounded, VideocamRounded, PlaceRounded, PhoneRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatCard, Grid, Tag, TableWrap, Mono, PersonCell, EmptyState, KeyVal } from "../kit/UI.jsx";
import { RecruitmentView } from "../hire/HireViews.jsx";
import { AiButton, AiResult, useAiRun } from "./aiKit.jsx";
import { BgvChip, StartBgvDialog, BgvCaseDrawer } from "./BgvViews.jsx";
import { ATS_STAGES, matchScore, bgvForCandidate, bgvAccessLevel, fmtTime, fmtDay } from "../../lib/collab.js";
import { findSlots } from "../../lib/scheduler.js";
import { fmtDate, fmtDateTime, fmtNum, isoDate, timeAgo } from "../../lib/utils.js";

const STAGE_LABEL = Object.fromEntries([...ATS_STAGES, ["rejected", "Rejected"]]);
const STAGE_TONE = { applied: "neutral", screen: "info", interview: "info", offer: "warn", hired: "good", rejected: "bad" };
const REC = { strong_yes: ["Strong yes", "good"], yes: ["Yes", "good"], maybe: ["Maybe", "warn"], no: ["No", "bad"] };
const lakh = (n) => (n ? `₹${(n / 100000).toFixed(1)} L` : "—");
const KNOWN_SKILLS = ["Customer support", "Zendesk", "Freshdesk", "Ticketing", "Escalations", "English", "Hindi", "Telugu", "Tamil", "B2B sales", "SaaS", "CRM", "Salesforce", "HubSpot", "Negotiation", "Inside sales", "Cold calling", "SQL", "Python", "Pandas", "Power BI", "Tableau", "Excel", "MS Excel", "Data modelling", "Java", "React", "Node.js", "AWS", "Kubernetes", "Payroll", "Recruitment", "Figma"];

function useApplicants() {
  const { data } = useStore();
  return useMemo(() => data.candidates.map((c) => {
    const profile = data.atsProfiles?.[c.id] || {};
    const posting = data.jobPostings?.[c.req_id] || {};
    const req = data.reqs.find((r) => r.id === c.req_id) || {};
    const m = matchScore(profile, posting, req);
    const ivs = (data.interviews || []).filter((i) => i.candidate_id === c.id).sort((a, b) => a.start.localeCompare(b.start));
    const next = ivs.find((i) => i.status === "scheduled" && i.end > new Date().toISOString());
    return { c, profile, posting, req, m, ivs, next, bgv: bgvForCandidate(data, c.id) };
  }), [data]);
}

export function RecruitmentHub() {
  const [tab, setTab] = useState("applicants");
  return (
    <>
      <PageHeader eyebrow="HIRE & ONBOARD · APPLICANT TRACKING" title="Recruitment" subtitle="Applicants with AI match scores, interviews and feedback, job postings with AI-written descriptions, background checks before offer, and the requisition funnel." />
      <Box sx={{ mb: 2, borderBottom: "1px solid #e5eae4" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
          <Tab value="applicants" label="Applicants" sx={{ fontSize: "0.7rem" }} />
          <Tab value="interviews" label="Interviews" sx={{ fontSize: "0.7rem" }} />
          <Tab value="postings" label="Job postings" sx={{ fontSize: "0.7rem" }} />
          <Tab value="funnel" label="Requisitions & pipeline" sx={{ fontSize: "0.7rem" }} />
        </Tabs>
      </Box>
      {tab === "applicants" && <Applicants />}
      {tab === "interviews" && <Interviews />}
      {tab === "postings" && <Postings />}
      {tab === "funnel" && <RecruitmentView />}
    </>
  );
}

function Applicants() {
  const { data } = useStore();
  const all = useApplicants();
  const [job, setJob] = useState("");
  const [stage, setStage] = useState("active");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [add, setAdd] = useState(false);
  const ai = useAiRun();
  const rows = all.filter(({ c, profile }) => (!job || c.req_id === job) && (stage === "all" || (stage === "active" ? !["rejected", "hired"].includes(c.stage) : c.stage === stage)) && (!q || `${c.name} ${c.email} ${(profile.skills || []).join(" ")} ${profile.current_company || ""}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.m.score - a.m.score);
  const activeAll = all.filter(({ c }) => !["rejected", "hired"].includes(c.stage));
  const rank = () => {
    const list = rows.slice(0, 8);
    const role = job ? data.reqs.find((r) => r.id === job)?.role : "all open roles";
    const offline = [`**Shortlist for ${role}** (ranked by match score from skills, experience, pay and notice):`, ...list.map(({ c, m, profile }, i) => `${i + 1}. **${c.name}** – ${m.score}/100 (${m.band}). ${m.hit.length ? `Has ${(data.jobPostings[c.req_id]?.skills || []).filter((s) => m.hit.includes(s.toLowerCase().replace(/[^a-z0-9+#.]/g, ""))).join(", ")}` : "Few required skills"}${m.missing.length ? `; missing ${m.missing.join(", ")}` : ""}. ${profile.experience_yrs ?? "?"} yrs, notice ${profile.notice_days ?? "?"} days, asks ${lakh(profile.expected_ctc)}.`), "", `**Suggested next step:** move the top ${Math.min(3, list.length)} to interview; ${list.filter((x) => x.m.score < 55).length ? "reject or keep on file the weak matches with a polite note." : "keep the rest warm."}`].join("\n");
    ai.run({ task: "ats-rank", instruction: "You are a recruiter's assistant. Rank these applicants for the role, give one line of reasoning each (skills, experience, pay, notice), flag risks, and suggest who to interview first. Never use age, gender, religion, caste or other protected attributes.", input: list.map(({ c, m, profile }) => `${c.name} | stage ${c.stage} | score ${m.score} | ${m.facts.join(" | ")} | resume: ${profile.resume_text || "-"}`).join("\n"), offline });
  };
  return (
    <Stack spacing={2.5}>
      <Grid min={150}>
        <StatCard label="Active applicants" value={activeAll.length} hint={`${all.filter(({ c }) => c.stage === "applied").length} new`} />
        <StatCard label="Strong matches" value={activeAll.filter(({ m }) => m.score >= 75).length} tone="good" hint="AI match ≥ 75" />
        <StatCard label="Interviews this week" value={(data.interviews || []).filter((i) => i.status === "scheduled" && i.start >= new Date().toISOString() && i.start <= new Date(Date.now() + 7 * 86400000).toISOString()).length} tone="info" />
        <StatCard label="Awaiting feedback" value={(data.interviews || []).filter((i) => i.end < new Date().toISOString() && i.status !== "cancelled" && (i.feedback || []).length < i.interviewers.length).length} tone="warn" />
        <StatCard label="Offers out" value={all.filter(({ c }) => c.stage === "offer").length} tone="neutral" />
      </Grid>
      <SectionCard title="Applicants" subtitle="Sorted by AI match score · click a row for the full profile" action={<Stack direction="row" spacing={1}><AiButton busy={ai.busy} onClick={rank}>AI shortlist</AiButton><Button size="small" variant="contained" startIcon={<PersonAddAlt1Rounded />} onClick={() => setAdd(true)}>Add applicant</Button></Stack>} noPad>
        <Box sx={{ px: 1.5 }}><AiResult ai={ai} title="AI shortlist" onRetry={rank} /></Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ p: 1.5 }}>
          <TextField size="small" placeholder="Search name, skill, company" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 220 }} />
          <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel>Job</InputLabel><Select label="Job" value={job} onChange={(e) => setJob(e.target.value)}><MenuItem value="">All jobs</MenuItem>{data.reqs.map((r) => <MenuItem key={r.id} value={r.id}>{r.id} · {r.role}{r.closed ? " (filled)" : ""}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Stage</InputLabel><Select label="Stage" value={stage} onChange={(e) => setStage(e.target.value)}><MenuItem value="active">Active</MenuItem><MenuItem value="all">All</MenuItem>{Object.entries(STAGE_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</Select></FormControl>
        </Stack>
        <TableWrap>
          <Table size="small" sx={{ minWidth: 1080 }}>
            <TableHead><TableRow><TableCell>Applicant</TableCell><TableCell>Job</TableCell><TableCell>Stage</TableCell><TableCell sx={{ minWidth: 130 }}>AI match</TableCell><TableCell align="right">Exp.</TableCell><TableCell align="right">Expected</TableCell><TableCell align="right">Notice</TableCell><TableCell>Next interview</TableCell><TableCell>BGV</TableCell><TableCell>Rating</TableCell></TableRow></TableHead>
            <TableBody>
              {rows.map(({ c, profile, m, next, bgv, req }) => (
                <TableRow key={c.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(c.id)}>
                  <TableCell><PersonCell name={c.name} sub={`${profile.current_company || c.source}${profile.location ? ` · ${profile.location}` : ""}`} /></TableCell>
                  <TableCell><Typography sx={{ fontSize: "0.66rem", fontWeight: 600 }}>{req.role}</Typography><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{c.source} · {profile.applied_at ? timeAgo(profile.applied_at) : timeAgo(c.updated_at)}</Typography></TableCell>
                  <TableCell><Tag tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Tag></TableCell>
                  <TableCell><Stack direction="row" sx={{ alignItems: "center", gap: 0.8 }}><LinearProgress variant="determinate" value={m.score} color={m.score >= 75 ? "success" : m.score >= 55 ? "warning" : "error"} sx={{ flex: 1, height: 6, borderRadius: 3 }} /><Typography sx={{ fontSize: "0.66rem", fontWeight: 700, minWidth: 22 }}>{m.score}</Typography></Stack></TableCell>
                  <TableCell align="right">{profile.experience_yrs ?? "—"} y</TableCell>
                  <TableCell align="right">{lakh(profile.expected_ctc)}</TableCell>
                  <TableCell align="right">{profile.notice_days ?? "—"} d</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{next ? `${fmtDay(next.start)} ${fmtTime(next.start)}` : "—"}</TableCell>
                  <TableCell>{bgv ? <BgvChip c={bgv} /> : "—"}</TableCell>
                  <TableCell><Rating size="small" readOnly value={c.rating} sx={{ fontSize: "0.85rem" }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrap>
        {!rows.length && <EmptyState title="No applicants match" text="Clear the filters or add an applicant." />}
      </SectionCard>
      <ApplicantDrawer id={open} onClose={() => setOpen(null)} />
      <AddApplicantDialog open={add} onClose={() => setAdd(false)} onAdded={(id) => { setAdd(false); setOpen(id); }} defaultJob={job} />
    </Stack>
  );
}

function extractFromResume(text) {
  const t = String(text || "");
  const email = (t.match(/[^\s@]+@[^\s@]+\.[^\s@,;]+/) || [])[0] || "";
  const phone = (t.match(/(\+?\d[\d\s-]{8,}\d)/) || [])[0] || "";
  const yrs = Number((t.match(/(\d+(?:\.\d)?)\+?\s*(?:years|yrs)/i) || [])[1]) || "";
  const skills = KNOWN_SKILLS.filter((s) => new RegExp(`\\b${s.replace(/[.+]/g, "\\$&")}\\b`, "i").test(t));
  const company = (t.match(/(?:at|with)\s+([A-Z][A-Za-z0-9&]+(?:\s[A-Z][A-Za-z0-9&]+)?)/) || [])[1] || "";
  const name = (t.split("\n")[0] || "").trim().split(/\s+/).length <= 4 && /^[A-Z][a-z]+(\s[A-Z][a-z]+)+$/.test((t.split("\n")[0] || "").trim()) ? t.split("\n")[0].trim() : "";
  return { email, phone: phone.trim(), experience_yrs: yrs, skills, current_company: company, name };
}

function AddApplicantDialog({ open, onClose, onAdded, defaultJob }) {
  const { data, addApplicant, notifyToast } = useStore();
  const blank = () => ({ name: "", email: "", phone: "", req_id: defaultJob || data.reqs.find((r) => !r.closed)?.id || "", source: "Careers page", location: "", experience_yrs: "", current_company: "", current_ctc: "", expected_ctc: "", notice_days: "30", skills: "", resume_text: "" });
  const [f, setF] = useState(blank);
  const [error, setError] = useState("");
  const ai = useAiRun();
  React.useEffect(() => { if (open) { setF(blank()); setError(""); ai.clear(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const extract = async () => {
    const base = extractFromResume(f.resume_text);
    const out = await ai.run({ task: "ats-extract", fast: true, instruction: 'Extract applicant details from the resume text. Output ONLY JSON: {"name":"","email":"","phone":"","experience_yrs":0,"current_company":"","location":"","skills":["..."]}. Leave a field empty if it is not in the text.', input: f.resume_text, offline: JSON.stringify(base) });
    try {
      const j = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
      setF((cur) => ({ ...cur, name: cur.name || j.name || "", email: cur.email || j.email || "", phone: cur.phone || j.phone || "", experience_yrs: cur.experience_yrs || j.experience_yrs || "", current_company: cur.current_company || j.current_company || "", location: cur.location || j.location || "", skills: cur.skills || (j.skills || []).join(", ") }));
      ai.setText("Filled the empty fields from the resume. Check them before saving.");
    } catch {
      ai.setText("Could not read the details automatically – fill the fields by hand.");
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add applicant</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Paste resume text (optional)" multiline minRows={3} value={f.resume_text} onChange={set("resume_text")} placeholder="Paste the CV here and let AI fill the form" />
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><AiButton busy={ai.busy} disabled={!f.resume_text.trim()} onClick={extract}>Fill from resume</AiButton>{ai.text && !ai.busy && <Typography variant="caption" color="text.secondary">{ai.text.startsWith("{") ? "" : ai.text}</Typography>}</Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <TextField label="Name *" value={f.name} onChange={set("name")} />
            <FormControl size="small"><InputLabel>Job *</InputLabel><Select label="Job *" value={f.req_id} onChange={set("req_id")}>{data.reqs.filter((r) => !r.closed).map((r) => <MenuItem key={r.id} value={r.id}>{r.id} · {r.role}</MenuItem>)}</Select></FormControl>
            <TextField label="Email" value={f.email} onChange={set("email")} />
            <TextField label="Phone" value={f.phone} onChange={set("phone")} />
            <TextField label="Location" value={f.location} onChange={set("location")} />
            <ListSelect listKey="candidate_source" size="small" blank={false} label="Source" value={f.source} onChange={(v) => setF({ ...f, source: v })} />
            <TextField label="Current company" value={f.current_company} onChange={set("current_company")} />
            <TextField label="Experience (years)" value={f.experience_yrs} onChange={(e) => setF({ ...f, experience_yrs: e.target.value.replace(/[^\d.]/g, "") })} />
            <TextField label="Current CTC (₹ / year)" value={f.current_ctc} onChange={(e) => setF({ ...f, current_ctc: e.target.value.replace(/\D/g, "") })} />
            <TextField label="Expected CTC (₹ / year)" value={f.expected_ctc} onChange={(e) => setF({ ...f, expected_ctc: e.target.value.replace(/\D/g, "") })} />
            <TextField label="Notice period (days)" value={f.notice_days} onChange={(e) => setF({ ...f, notice_days: e.target.value.replace(/\D/g, "") })} />
            <TextField label="Skills (comma separated)" value={f.skills} onChange={set("skills")} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { const r = addApplicant(f); if (!r.ok) return setError(r.error); notifyToast("Applicant added."); onAdded?.(r.id); }}>Add applicant</Button>
      </DialogActions>
    </Dialog>
  );
}

export function ApplicantDrawer({ id, onClose }) {
  const { data, user, nameOf, moveCandidate, addAtsNote, updateApplicant, notifyToast } = useStore();
  const navigate = useNavigate();
  const all = useApplicants();
  const row = all.find((x) => x.c.id === id);
  const [note, setNote] = useState("");
  const [sched, setSched] = useState(null);
  const [bgvStart, setBgvStart] = useState(false);
  const [bgvOpen, setBgvOpen] = useState(null);
  const screen = useAiRun();
  const mail = useAiRun();
  React.useEffect(() => { screen.clear(); mail.clear(); setNote(""); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!row) return <Drawer anchor="right" open={false} onClose={onClose} />;
  const { c, profile, posting, req, m, ivs, bgv } = row;
  const notes = (data.atsNotes || []).filter((n) => n.candidate_id === c.id);
  const idx = ATS_STAGES.findIndex((s) => s[0] === c.stage);
  const nextStage = idx >= 0 && idx < ATS_STAGES.length - 1 ? ATS_STAGES[idx + 1] : null;
  const bgvLvl = bgv && bgvAccessLevel(data, user, bgv);
  const fbAll = ivs.flatMap((i) => (i.feedback || []).map((f) => ({ ...f, round: i.round })));
  const runScreen = () => {
    const offline = [`**${m.band} match – ${m.score}/100 for ${req.role}.**`, ...m.facts.map((f) => `- ${f}`), fbAll.length ? `- Interview feedback: ${fbAll.map((f) => `${REC[f.recommendation]?.[0]} (${f.rating}/5) from ${nameOf(f.by)}`).join("; ")}` : "", "", `**Strengths:** ${m.hit.length ? `${m.hit.length} of the required skills` : "limited overlap with required skills"}${profile.experience_yrs >= (posting.exp?.[0] || 0) ? ", meets the experience bar" : ""}.`, `**Watch-outs:** ${[m.missing.length ? `no evidence of ${m.missing.join(", ")}` : "", profile.notice_days > 60 ? `${profile.notice_days}-day notice` : "", posting.budget_max && profile.expected_ctc > posting.budget_max ? "asks above budget" : ""].filter(Boolean).join("; ") || "none from the data"}.`, `**Suggested next step:** ${m.score >= 75 ? "move to interview and probe the missing skills" : m.score >= 55 ? "short screening call to check the gaps" : "keep on file or send a polite rejection"}.`].filter(Boolean).join("\n");
    screen.run({ task: "ats-screen", instruction: "Screen this applicant against the job. Give: a one-line verdict with the match score, 3–4 evidence-based bullets (skills, experience, pay, notice), strengths, watch-outs, 3 interview questions to probe the gaps, and a next step. Never consider age, gender, religion, caste, marital status or other protected attributes.", input: `Job: ${req.role}\nRequired skills: ${(posting.skills || []).join(", ")}\nExperience wanted: ${(posting.exp || []).join("–")} yrs\nBudget: ${posting.budget_max || "n/a"}\nJD: ${posting.jd || "-"}\n\nApplicant: ${c.name}\n${m.facts.join("\n")}\nResume: ${profile.resume_text || "-"}\nFeedback: ${fbAll.map((f) => `${f.round}: ${f.recommendation} ${f.rating}/5 – ${f.notes}`).join(" | ") || "none"}`, offline }).then((t) => t && updateApplicant(c.id, { ai: { text: t, at: new Date().toISOString(), score: m.score } }));
  };
  const runMail = (kind) => {
    const first = c.name.split(" ")[0];
    const next = ivs.find((i) => i.status === "scheduled");
    const offline = kind === "invite"
      ? `Subject: Interview for ${req.role} at ONAS Global Services\n\nHi ${first},\n\nThank you for applying for the ${req.role} role. We'd like to invite you to ${next ? `a ${next.round} interview on **${fmtDay(next.start)} at ${fmtTime(next.start)}** (${next.type === "video" ? `video call: ${next.link}` : next.type === "phone" ? "phone call" : next.link})` : "an interview – please reply with two or three times that suit you this week"}.\n\nThe conversation will take about 45 minutes and cover your experience with ${(posting.skills || []).slice(0, 3).join(", ")}.\n\nLooking forward to speaking with you.\n\nBest regards,\nTalent Acquisition, ONAS Global Services`
      : kind === "reject"
        ? `Subject: Your application for ${req.role}\n\nHi ${first},\n\nThank you for your interest in the ${req.role} role and for the time you spent with us. After careful consideration we have decided to move forward with other candidates whose experience more closely matches the current needs of the role.\n\nWe were impressed by ${profile.skills?.[0] ? `your background in ${profile.skills[0]}` : "your application"} and would like to keep your profile on file for future openings.\n\nWe wish you every success.\n\nKind regards,\nTalent Acquisition, ONAS Global Services`
        : `Subject: Next steps – ${req.role}\n\nHi ${first},\n\nGreat news – the team would like to move forward with you for the ${req.role} role. Could we schedule a short call tomorrow to walk you through the offer and next steps (including background verification)?\n\nBest regards,\nTalent Acquisition, ONAS Global Services`;
    mail.run({ task: `ats-mail-${kind}`, instruction: `Write a short, warm, professional ${kind === "invite" ? "interview invitation" : kind === "reject" ? "rejection" : "offer-call"} email to the candidate. Include a subject line. Do not mention scores or internal notes.`, input: `Candidate ${c.name}; role ${req.role}; skills ${(profile.skills || []).join(", ")}; next interview ${next ? `${next.round} ${next.start} ${next.type} ${next.link}` : "not scheduled"}`, offline });
  };
  return (
    <Drawer anchor="right" open={!!row} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 660 } } }}>
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" color="primary"><Mono>{c.id}</Mono> · {req.role} · {c.source}</Typography>
            <Typography variant="h2" sx={{ fontSize: "1.1rem" }}>{c.name}</Typography>
            <Typography variant="caption" color="text.secondary">{c.email || "no email"}{profile.phone ? ` · ${profile.phone}` : ""}</Typography>
          </Box>
          <Tag tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Tag>
          <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
        </Stack>
        <Stack direction="row" sx={{ mt: 1.5, gap: 1, flexWrap: "wrap" }}>
          {nextStage && c.stage !== "rejected" && <Button size="small" variant="contained" endIcon={<ArrowForwardRounded />} onClick={() => { const r = moveCandidate(c.id, nextStage[0]); notifyToast(r.ok ? `${c.name} moved to ${nextStage[1]}.${nextStage[0] === "hired" ? " Onboarding checklist created." : ""}` : r.error, r.ok ? "success" : "error"); }}>Move to {nextStage[1]}</Button>}
          {!["hired", "rejected"].includes(c.stage) && <Button size="small" variant="outlined" startIcon={<EventRounded />} onClick={() => setSched({ candidate_id: c.id })}>Schedule interview</Button>}
          {!bgv && ["interview", "offer", "hired"].includes(c.stage) && <Button size="small" variant="outlined" startIcon={<VerifiedUserRounded />} onClick={() => setBgvStart(true)}>Start BGV</Button>}
          {["offer", "interview"].includes(c.stage) && <Button size="small" variant="outlined" startIcon={<HistoryEduRounded />} onClick={() => navigate("/offers")}>Prepare offer</Button>}
          {!["hired", "rejected"].includes(c.stage) && <Button size="small" color="error" startIcon={<BlockRounded />} onClick={() => { moveCandidate(c.id, "rejected"); notifyToast(`${c.name} rejected.`); }}>Reject</Button>}
        </Stack>
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, background: "#f6f9f6", border: "1px solid #e5eae5" }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
            <Box sx={{ textAlign: "center", minWidth: 64 }}>
              <Typography sx={{ fontSize: "1.6rem", fontWeight: 800, color: m.score >= 75 ? "#1D7A42" : m.score >= 55 ? "#8A5200" : "#B0291F", lineHeight: 1 }}>{m.score}</Typography>
              <Typography sx={{ fontSize: "0.55rem", color: "#78827b" }}>AI match</Typography>
            </Box>
            <Box sx={{ flex: 1 }}>{m.facts.map((f) => <Typography key={f} sx={{ fontSize: "0.62rem", color: "#46534a" }}>• {f}</Typography>)}</Box>
          </Stack>
          <Stack direction="row" sx={{ mt: 1, gap: 1, flexWrap: "wrap" }}>
            <AiButton busy={screen.busy} onClick={runScreen}>AI screening report</AiButton>
            <AiButton busy={mail.busy} onClick={() => runMail("invite")}>Draft invite</AiButton>
            <AiButton busy={mail.busy} onClick={() => runMail(c.stage === "offer" ? "offer" : "reject")}>{c.stage === "offer" ? "Draft offer call" : "Draft rejection"}</AiButton>
          </Stack>
          {!screen.text && profile.ai?.text && <Typography sx={{ fontSize: "0.58rem", color: "#78827b", mt: 0.8 }}>Last AI screening {timeAgo(profile.ai.at)} – click to refresh.</Typography>}
          <AiResult ai={screen} title="AI screening report" onRetry={runScreen} />
          <AiResult ai={mail} title="AI email draft" />
        </Box>
        <Typography variant="h3" sx={{ mt: 2.5, mb: 1 }}>Profile</Typography>
        <KeyVal cols={3} items={[["Current company", profile.current_company], ["Location", profile.location], ["Experience", profile.experience_yrs != null ? `${profile.experience_yrs} yrs` : ""], ["Current CTC", lakh(profile.current_ctc)], ["Expected CTC", lakh(profile.expected_ctc)], ["Notice", profile.notice_days != null ? `${profile.notice_days} days` : ""], ["Applied", profile.applied_at ? fmtDate(profile.applied_at) : fmtDate(c.updated_at)], ["Rating", <Rating key="r" size="small" value={c.rating} onChange={(_, v) => moveCandidate(c.id, c.stage, v || 0)} />], ["Background check", bgv ? <Box key="b" sx={{ cursor: bgvLvl ? "pointer" : "default" }} onClick={() => bgvLvl && setBgvOpen(bgv.id)}><BgvChip c={bgv} /></Box> : "Not started"]]} />
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.6, mt: 1.5 }}>{(profile.skills || []).map((s) => <Tag key={s} tone={m.hit.includes(s.toLowerCase().replace(/[^a-z0-9+#.]/g, "")) ? "good" : "neutral"}>{s}</Tag>)}</Stack>
        {profile.resume_text && <Typography sx={{ fontSize: "0.65rem", color: "#46534a", mt: 1.5, whiteSpace: "pre-wrap", p: 1.2, borderLeft: "3px solid #cfe0d5", background: "#fbfcfb" }}>{profile.resume_text}</Typography>}
        <Typography variant="h3" sx={{ mt: 2.5, mb: 1 }}>Interviews</Typography>
        {!ivs.length && <Typography variant="caption" color="text.secondary">No interviews yet.</Typography>}
        <Stack spacing={1}>
          {ivs.map((iv) => (
            <Box key={iv.id} sx={{ p: 1.2, border: "1px solid #e5eae5", borderRadius: 1.5 }}>
              <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                {iv.type === "video" ? <VideocamRounded sx={{ fontSize: 16, color: "#5b5fc7" }} /> : iv.type === "phone" ? <PhoneRounded sx={{ fontSize: 16 }} /> : <PlaceRounded sx={{ fontSize: 16 }} />}
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, flex: 1 }}>{iv.round}</Typography>
                <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{fmtDay(iv.start)} · {fmtTime(iv.start)}–{fmtTime(iv.end)}</Typography>
                <Tag tone={iv.status === "completed" ? "good" : iv.status === "cancelled" ? "neutral" : "info"}>{iv.status}</Tag>
              </Stack>
              <Typography sx={{ fontSize: "0.6rem", color: "#5c675f", mt: 0.3 }}>Panel: {iv.interviewers.map(nameOf).join(", ")}</Typography>
              {(iv.feedback || []).map((f) => <Typography key={f.by} sx={{ fontSize: "0.6rem", mt: 0.4 }}><Tag tone={REC[f.recommendation]?.[1]}>{REC[f.recommendation]?.[0]}</Tag> {f.rating}/5 · {nameOf(f.by)}: {f.notes}</Typography>)}
            </Box>
          ))}
        </Stack>
        <Typography variant="h3" sx={{ mt: 2.5, mb: 1 }}>Notes</Typography>
        <Stack direction="row" spacing={1}>
          <TextField size="small" fullWidth placeholder="Add a private recruiter note" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button variant="outlined" onClick={() => { const r = addAtsNote(c.id, note); if (!r.ok) return notifyToast(r.error, "error"); setNote(""); }}>Add</Button>
        </Stack>
        <Stack spacing={0.6} sx={{ mt: 1 }}>{notes.map((n) => <Typography key={n.id} sx={{ fontSize: "0.62rem" }}><b>{nameOf(n.by)}</b> <span style={{ color: "#78827b" }}>· {timeAgo(n.at)}</span> — {n.text}</Typography>)}</Stack>
      </Box>
      <InterviewDialog value={sched} onClose={() => setSched(null)} />
      <StartBgvDialog open={bgvStart} onClose={() => setBgvStart(false)} preset={{ candidate_id: c.id, package: "standard" }} onStarted={() => setBgvStart(false)} />
      <BgvCaseDrawer id={bgvOpen} onClose={() => setBgvOpen(null)} />
    </Drawer>
  );
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function InterviewDialog({ value, onClose }) {
  const { data, scheduleInterview, notifyToast } = useStore();
  const [f, setF] = useState(null);
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState("");
  React.useEffect(() => {
    if (!value) return;
    const c = data.candidates.find((k) => k.id === value.candidate_id);
    const req = c && data.reqs.find((r) => r.id === c.req_id);
    const ex = value.id && data.interviews.find((i) => i.id === value.id);
    const start = ex?.start || new Date(Math.ceil((Date.now() + 86400000) / 1800000) * 1800000).toISOString();
    setF(ex ? { ...ex, duration: Math.round((new Date(ex.end) - new Date(ex.start)) / 60000) } : { candidate_id: value.candidate_id, round: "Technical", type: "video", start, duration: 45, interviewers: req?.hiring_manager ? [req.hiring_manager] : [], link: "" });
    setSlots(null);
    setError("");
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!value || !f) return null;
  const c = data.candidates.find((k) => k.id === f.candidate_id);
  const suggest = () => {
    if (!f.interviewers.length) return setError("Add interviewers first.");
    const r = findSlots({ data, organizer: f.interviewers[0], attendees: f.interviewers.slice(1), durationMin: Number(f.duration) || 45, from: isoDate(), to: isoDate(Date.now() + 7 * 86400000), max: 4 });
    setSlots(r.slots);
    setError(r.slots.length ? "" : "No common free slot in the next 7 days – try fewer interviewers or a shorter round.");
  };
  const save = () => {
    const start = new Date(f.start).toISOString();
    const end = new Date(new Date(f.start).getTime() + (Number(f.duration) || 45) * 60000).toISOString();
    const r = scheduleInterview({ ...f, start, end, link: f.link || (f.type === "video" ? jitsiLink(`interview-${Date.now().toString(36)}`) : "") });
    if (!r.ok) return setError(r.error);
    notifyToast("Interview scheduled. The panel has been notified and it is on their calendars.");
    onClose();
  };
  return (
    <Dialog open={!!value} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{f.id ? "Reschedule" : "Schedule"} interview · {c?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="warning">{error}</Alert>}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField size="small" label="Round" value={f.round} onChange={(e) => setF({ ...f, round: e.target.value })} fullWidth />
            <FormControl size="small" fullWidth><InputLabel>Type</InputLabel><Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><MenuItem value="video">Video</MenuItem><MenuItem value="onsite">On-site</MenuItem><MenuItem value="phone">Phone</MenuItem></Select></FormControl>
          </Stack>
          <FormControl size="small"><InputLabel>Interview panel *</InputLabel><Select multiple label="Interview panel *" value={f.interviewers} onChange={(e) => setF({ ...f, interviewers: e.target.value })} renderValue={(v) => v.map((x) => data.employees.find((e) => e.employee_code === x)?.full_name || x).join(", ")}>{data.employees.filter((e) => e.status === "active").map((e) => <MenuItem key={e.employee_code} value={e.employee_code}><Checkbox size="small" checked={f.interviewers.includes(e.employee_code)} />{e.full_name} · {e.designation}</MenuItem>)}</Select></FormControl>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
            <TextField size="small" type="datetime-local" label="Start" value={toLocalInput(f.start)} onChange={(e) => setF({ ...f, start: new Date(e.target.value).toISOString() })} slotProps={{ inputLabel: { shrink: true } }} />
            <FormControl size="small" sx={{ minWidth: 120 }}><InputLabel>Duration</InputLabel><Select label="Duration" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })}>{[30, 45, 60, 90].map((d) => <MenuItem key={d} value={d}>{d} min</MenuItem>)}</Select></FormControl>
            <AiButton onClick={suggest}>Find a slot</AiButton>
          </Stack>
          {slots && slots.length > 0 && (
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              {slots.map((s) => <Button key={s.start} size="small" variant={s.start === f.start ? "contained" : "outlined"} onClick={() => setF({ ...f, start: s.start })} sx={{ textTransform: "none", fontSize: "0.62rem" }}>{fmtDay(s.start)} {fmtTime(s.start)} · {s.reasons[0]}</Button>)}
            </Stack>
          )}
          <TextField size="small" label={f.type === "onsite" ? "Location" : f.type === "phone" ? "Phone number" : "Video link (auto if empty)"} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>{f.id ? "Reschedule" : "Schedule"}</Button>
      </DialogActions>
    </Dialog>
  );
}

function Interviews() {
  const { data, nameOf, setInterviewStatus, notifyToast } = useStore();
  const [sched, setSched] = useState(null);
  const [open, setOpen] = useState(null);
  const now = new Date().toISOString();
  const list = [...(data.interviews || [])].sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = list.filter((i) => i.end >= now && i.status === "scheduled");
  const past = list.filter((i) => !(i.end >= now && i.status === "scheduled")).reverse();
  const candOf = (id) => data.candidates.find((c) => c.id === id);
  const Row = ({ iv }) => {
    const c = candOf(iv.candidate_id);
    const missing = iv.end < now && iv.status !== "cancelled" ? iv.interviewers.filter((p) => !(iv.feedback || []).some((f) => f.by === p)) : [];
    return (
      <TableRow hover>
        <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDay(iv.start)}<Typography sx={{ fontSize: "0.58rem", color: "#78827b" }}>{fmtTime(iv.start)}–{fmtTime(iv.end)}</Typography></TableCell>
        <TableCell><Box sx={{ cursor: "pointer" }} onClick={() => setOpen(iv.candidate_id)}><PersonCell name={c?.name || "—"} sub={data.reqs.find((r) => r.id === iv.req_id)?.role} /></Box></TableCell>
        <TableCell>{iv.round}</TableCell>
        <TableCell>{iv.type === "video" ? "Video" : iv.type === "phone" ? "Phone" : "On-site"}</TableCell>
        <TableCell>{iv.interviewers.map(nameOf).join(", ")}</TableCell>
        <TableCell>{(iv.feedback || []).length ? (iv.feedback || []).map((f) => <Tag key={f.by} tone={REC[f.recommendation]?.[1]} sx={{ mr: 0.4 }}>{REC[f.recommendation]?.[0]} {f.rating}/5</Tag>) : missing.length ? <Tag tone="warn">Waiting on {missing.map((p) => nameOf(p).split(" ")[0]).join(", ")}</Tag> : "—"}</TableCell>
        <TableCell><Tag tone={iv.status === "completed" ? "good" : iv.status === "cancelled" ? "neutral" : iv.status === "no_show" ? "bad" : "info"}>{iv.status.replace("_", "-")}</Tag></TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>
          {iv.status === "scheduled" && <><Button size="small" onClick={() => setSched({ candidate_id: iv.candidate_id, id: iv.id })}>Reschedule</Button><Button size="small" color="error" onClick={() => { setInterviewStatus(iv.id, "cancelled"); notifyToast("Interview cancelled; panel notified."); }}>Cancel</Button></>}
          {iv.status === "scheduled" && iv.end < now && <Button size="small" onClick={() => setInterviewStatus(iv.id, "no_show")}>No-show</Button>}
        </TableCell>
      </TableRow>
    );
  };
  const head = <TableHead><TableRow><TableCell>When</TableCell><TableCell>Candidate</TableCell><TableCell>Round</TableCell><TableCell>Type</TableCell><TableCell>Panel</TableCell><TableCell>Feedback</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>;
  return (
    <Stack spacing={2.5}>
      <SectionCard title="Upcoming interviews" subtitle="Interviewers see these on their calendar and give feedback there" noPad>
        <TableWrap><Table size="small" sx={{ minWidth: 1000 }}>{head}<TableBody>{upcoming.map((iv) => <Row key={iv.id} iv={iv} />)}</TableBody></Table></TableWrap>
        {!upcoming.length && <EmptyState title="Nothing scheduled" text="Open an applicant and choose Schedule interview." />}
      </SectionCard>
      <SectionCard title="Past interviews" noPad>
        <TableWrap><Table size="small" sx={{ minWidth: 1000 }}>{head}<TableBody>{past.map((iv) => <Row key={iv.id} iv={iv} />)}</TableBody></Table></TableWrap>
      </SectionCard>
      <InterviewDialog value={sched} onClose={() => setSched(null)} />
      <ApplicantDrawer id={open} onClose={() => setOpen(null)} />
    </Stack>
  );
}

function Postings() {
  const { data, saveJobPosting, notifyToast } = useStore();
  const [edit, setEdit] = useState(null);
  const ai = useAiRun();
  const qs = useAiRun();
  const reqs = data.reqs.filter((r) => !r.closed);
  const openEdit = (r) => {
    const p = data.jobPostings[r.id] || {};
    setEdit({ req_id: r.id, title: p.title || r.role, location: p.location || "Hyderabad", mode: p.mode || "Hybrid", exp0: p.exp?.[0] ?? 2, exp1: p.exp?.[1] ?? 5, budget_max: p.budget_max || "", skills: (p.skills || []).join(", "), jd: p.jd || "", published: !!p.published, channels: p.channels || ["Careers page"] });
    ai.clear();
    qs.clear();
  };
  const jdOffline = (e) => {
    const req = data.reqs.find((r) => r.id === e.req_id);
    const skills = e.skills.split(",").map((s) => s.trim()).filter(Boolean);
    return `**${e.title}** · ${e.location} · ${e.mode} · ${e.exp0}–${e.exp1} years\n\n**About the role**\nJoin our ${req?.dept || ""} team at ONAS Global Services to ${e.title.toLowerCase().includes("sales") || e.title.toLowerCase().includes("account") ? "win and grow customer relationships for our HR and payroll platform" : e.title.toLowerCase().includes("support") ? "help customers succeed with our HR and payroll platform every day" : "build the systems and insights that power our HR and payroll platform"}.\n\n**What you will do**\n- Own day-to-day ${skills[0] || "delivery"} for your area with clear goals and measurable outcomes\n- Work closely with product, operations and customer teams\n- Improve how we work: document, automate and share what you learn\n- Report progress to the hiring manager every two weeks\n\n**What you bring**\n${skills.map((s) => `- Hands-on experience with ${s}`).join("\n")}\n- ${e.exp0}+ years of relevant experience\n- Clear written and spoken communication\n\n**What we offer**\n- Competitive pay${e.budget_max ? ` (up to ₹${(Number(e.budget_max) / 100000).toFixed(1)} L per year)` : ""}, health cover for you and your family, learning budget\n- ${e.mode} working and a supportive team\n\nWe are an equal-opportunity employer and welcome applicants of every background. Offers are subject to background verification.`;
  };
  const qOffline = (e) => {
    const skills = e.skills.split(",").map((s) => s.trim()).filter(Boolean);
    return [`**Interview kit – ${e.title}**`, ...skills.slice(0, 5).map((s, i) => `${i + 1}. Tell me about a recent piece of work where you used ${s}. What was hard and what would you do differently? *(Look for: specific example, ownership, measurable result.)*`), `${skills.length + 1}. Walk me through how you prioritise when several urgent requests arrive at once.`, `${skills.length + 2}. What would you want to achieve in your first 90 days in this role?`, "", "**Scorecard:** skills depth · problem solving · communication · ownership · culture add (1–5 each)."].join("\n");
  };
  return (
    <Stack spacing={2.5}>
      <Grid min={300}>
        {reqs.map((r) => {
          const p = data.jobPostings[r.id];
          return (
            <SectionCard key={r.id} title={p?.title || r.role} subtitle={`${r.id} · ${r.dept} · ${r.n} seat(s)`} action={<Button size="small" onClick={() => openEdit(r)}>{p ? "Edit" : "Create posting"}</Button>}>
              {p ? (
                <>
                  <Stack direction="row" sx={{ gap: 0.6, flexWrap: "wrap", mb: 1 }}>{p.published ? <Tag tone="good">Published</Tag> : <Tag>Draft</Tag>}<Tag>{p.location}</Tag><Tag>{p.exp?.join("–")} yrs</Tag>{(p.channels || []).map((ch) => <Tag key={ch} tone="info">{ch}</Tag>)}</Stack>
                  <Typography sx={{ fontSize: "0.65rem", color: "#46534a", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.jd}</Typography>
                  <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap", mt: 1 }}>{(p.skills || []).map((s) => <Tag key={s}>{s}</Tag>)}</Stack>
                  <Typography sx={{ fontSize: "0.58rem", color: "#78827b", mt: 1 }}>{data.candidates.filter((c) => c.req_id === r.id).length} applicants{p.published_at ? ` · live since ${fmtDate(p.published_at)}` : ""}</Typography>
                </>
              ) : <EmptyState title="No posting yet" text="Create one and let AI draft the job description." />}
            </SectionCard>
          );
        })}
      </Grid>
      <Dialog open={!!edit} onClose={() => setEdit(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Job posting · {edit?.req_id}</DialogTitle>
        <DialogContent>
          {edit && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr 1fr" }, gap: 2 }}>
                <TextField size="small" label="Title *" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                <TextField size="small" label="Location" value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} />
                <ListSelect listKey="job_work_mode" size="small" blank={false} label="Mode" value={edit.mode} onChange={(v) => setEdit({ ...edit, mode: v })} />
                <TextField size="small" label="Required skills (comma separated)" value={edit.skills} onChange={(e) => setEdit({ ...edit, skills: e.target.value })} />
                <Stack direction="row" spacing={1}><TextField size="small" label="Min yrs" value={edit.exp0} onChange={(e) => setEdit({ ...edit, exp0: e.target.value.replace(/\D/g, "") })} /><TextField size="small" label="Max yrs" value={edit.exp1} onChange={(e) => setEdit({ ...edit, exp1: e.target.value.replace(/\D/g, "") })} /></Stack>
                <TextField size="small" label="Budget (max ₹/yr)" value={edit.budget_max} onChange={(e) => setEdit({ ...edit, budget_max: e.target.value.replace(/\D/g, "") })} />
              </Box>
              <Stack direction="row" spacing={1}>
                <AiButton busy={ai.busy} onClick={() => ai.run({ task: "ats-jd", instruction: "Write an inclusive, specific job description with sections: About the role, What you will do (4–6 bullets), What you bring (bullets from the skills), What we offer, and an equal-opportunity line. No gendered language, no age limits. Use **bold** headings.", input: JSON.stringify(edit), offline: jdOffline(edit) })}>Write JD with AI</AiButton>
                <AiButton busy={qs.busy} onClick={() => qs.run({ task: "ats-questions", instruction: "Create a structured interview kit: 6–8 behavioural and technical questions tied to the required skills, each with what a good answer shows, and a 5-point scorecard.", input: JSON.stringify(edit), offline: qOffline(edit) })}>Interview questions</AiButton>
              </Stack>
              <AiResult ai={ai} title="AI job description" onUse={(t) => { setEdit({ ...edit, jd: t }); ai.clear(); }} useLabel="Use as job description" />
              <AiResult ai={qs} title="AI interview kit" />
              <TextField label="Job description *" multiline minRows={6} value={edit.jd} onChange={(e) => setEdit({ ...edit, jd: e.target.value })} />
              <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                {["Careers page", "Job portal", "LinkedIn", "Referral", "Agency", "Campus"].map((ch) => <FormControlLabel key={ch} control={<Checkbox size="small" checked={edit.channels.includes(ch)} onChange={(e) => setEdit({ ...edit, channels: e.target.checked ? [...edit.channels, ch] : edit.channels.filter((x) => x !== ch) })} />} label={<Typography variant="body2">{ch}</Typography>} />)}
                <FormControlLabel sx={{ ml: "auto" }} control={<Switch checked={edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} />} label="Published" />
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setEdit(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => { const r = saveJobPosting(edit.req_id, { ...edit, exp: [edit.exp0, edit.exp1] }); if (!r.ok) return notifyToast(r.error, "error"); notifyToast(edit.published ? "Posting saved and published." : "Posting saved as draft."); setEdit(null); }}>Save posting</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
