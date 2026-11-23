// v10.13 · "Why EZY HR" — shown beside the sign-up steps and under the pricing plans.
// The other-software columns describe typical coverage by product type, taken from vendors' own public descriptions
// (HRMS comparison listings). Products vary, so the table says so and names examples rather than rating each product.
import React, { useState } from "react";
import { Box, Button, Card, Chip, Dialog, DialogContent, DialogTitle, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { CheckCircleRounded, RemoveRounded, AutoAwesomeRounded, AccountTreeRounded, PublicRounded, SupportAgentRounded, SmartphoneRounded, SpeedRounded, CloseRounded, CompareArrowsRounded, TranslateRounded, ReceiptLongRounded, TouchAppRounded, EmojiEventsRounded, SchoolRounded, LockPersonRounded, SavingsRounded, FavoriteRounded } from "@mui/icons-material";

const BRAND = "#1F9D63";

/** The module checklist (the four groups people compare HR software on). Every item is built into EZY HR. */
export const MODULE_GROUPS = [
  ["Core HR & Payroll", ["Core HR / employee records", "Payroll", "Benefits administration", "Compensation management", "Multi-currency / international payroll"]],
  ["Time & Workforce", ["Time & attendance", "PTO / leave tracking"]],
  ["Talent", ["Recruitment / applicant tracking (ATS)", "Onboarding & offboarding", "Performance management", "Learning management (LMS / training)", "Succession planning"]],
  ["Self-Service & Documents", ["Employee self-service", "Manager self-service", "Document management"]],
];

/** What only an all-in-one, AI-first suite brings. Each point is a working feature of this build. */
export const BENEFITS = [
  [AutoAwesomeRounded, "AI that does the work", "Type “create employee Ravi Kumar as Sales Executive” or “run the headcount report”. The AI fills it in, you press Confirm."],
  [AccountTreeRounded, "Approvals your way", "Every request follows the chain you choose — manager, IT, HR, Finance — or build your own with +."],
  [PublicRounded, "India-first, global-ready", "PF, ESI, PT, TDS and LWF out of the box; payroll rules for 22 countries and multi-currency pay."],
  [SupportAgentRounded, "IT service desk included", "Tickets, assets and purchase requests in the same app as HR — no separate helpdesk tool."],
  [SmartphoneRounded, "One app, every device", "Web, Android and iOS, with geofenced, selfie-verified attendance."],
  [TranslateRounded, "Speaks your team's language", "The AI answers in 15 languages, including Hindi, Telugu, Tamil, Kannada and Arabic."],
  [SpeedRounded, "Built to scale", "From a 5-person start-up to 10 lakh employees on the PostgreSQL edition."],
];

/** Why employees like it — each point is a working feature of this build. */
export const EMPLOYEE_BENEFITS = [
  [ReceiptLongRounded, "Payslips & tax forms in your pocket", "See every payslip, download tax forms and declare investments from the mobile app — no more emailing HR."],
  [TouchAppRounded, "Requests in a few taps", "Leave, work from home, travel, overtime, letters — and always see who has your request right now."],
  [AutoAwesomeRounded, "An assistant that speaks your language", "Ask “how many leaves do I have?” or “raise a ticket, my laptop won't charge” in 15 languages."],
  [SavingsRounded, "Advances & salary loans", "Ask for an advance or a loan in the app; the EMI is shown before you apply."],
  [EmojiEventsRounded, "Recognition that counts", "Points, kudos and celebrations for birthdays and work anniversaries."],
  [SchoolRounded, "Grow your skills", "Courses, training requests and internal job openings in one place."],
  [LockPersonRounded, "Speak up safely", "Raise a concern in confidence — it goes to HR, not to your manager."],
  [FavoriteRounded, "Benefits & wellness", "See your health cover and wellness benefits, and get IT help without chasing anyone."],
];

// "yes" = core to this kind of product · "some" = varies by product / add-on or integration · "no" = not the focus
const TYPES = [
  { id: "ezy", name: "EZY HR", sub: "All-in-one, AI-first" },
  { id: "payroll", name: "Payroll-first tools", sub: "e.g. ADP RUN, Gusto, Paycor" },
  { id: "ats", name: "Recruiting-only (ATS)", sub: "e.g. Workable, Breezy HR, JazzHR, Zoho Recruit" },
  { id: "perf", name: "Performance & engagement", sub: "e.g. Lattice, Leapsome, Nestor" },
  { id: "suite", name: "Enterprise HCM suites", sub: "e.g. Workday, Oracle, UKG Pro, Dayforce" },
];
const ROWS = [
  ["Core HR & Payroll", [
    ["Core HR / employee records", "yes", "yes", "some", "some", "yes"],
    ["Payroll", "yes", "yes", "no", "no", "yes"],
    ["Benefits administration", "yes", "yes", "no", "no", "yes"],
    ["Compensation management", "yes", "some", "no", "some", "yes"],
    ["Multi-currency / international payroll", "yes", "some", "no", "no", "yes"],
  ]],
  ["Time & Workforce", [
    ["Time & attendance", "yes", "yes", "no", "no", "yes"],
    ["PTO / leave tracking", "yes", "yes", "no", "some", "yes"],
  ]],
  ["Talent", [
    ["Recruitment / ATS", "yes", "some", "yes", "no", "yes"],
    ["Onboarding & offboarding", "yes", "some", "some", "some", "yes"],
    ["Performance management", "yes", "some", "no", "yes", "yes"],
    ["Learning management (LMS)", "yes", "no", "no", "some", "yes"],
    ["Succession planning", "yes", "no", "no", "some", "yes"],
  ]],
  ["Self-Service & Documents", [
    ["Employee self-service", "yes", "yes", "no", "yes", "yes"],
    ["Manager self-service", "yes", "some", "some", "yes", "yes"],
    ["Document management", "yes", "some", "some", "some", "yes"],
  ]],
  ["What sets EZY HR apart", [
    ["AI that creates records & runs reports for you", "yes", "some", "some", "some", "some"],
    ["Approval chains you build yourself", "yes", "some", "some", "some", "yes"],
    ["IT service desk & asset tracking", "yes", "no", "no", "no", "no"],
    ["India statutory payroll (PF, ESI, PT, TDS, LWF)", "yes", "some", "no", "no", "some"],
    ["Free plan to start", "yes", "some", "some", "some", "no"],
  ]],
];
const MARK = {
  yes: <Tooltip title="Included"><CheckCircleRounded sx={{ fontSize: 18, color: BRAND }} aria-label="Included" /></Tooltip>,
  some: <Tooltip title="Varies by product — often an add-on or integration"><Typography component="span" sx={{ fontSize: "0.66rem", fontWeight: 700, color: "#B7791F" }}>Varies</Typography></Tooltip>,
  no: <Tooltip title="Not the focus of this kind of product"><RemoveRounded sx={{ fontSize: 18, color: "#B8C0BA" }} aria-label="Not the focus" /></Tooltip>,
};

export function ComparisonTable({ dense = false }) {
  return (
    <Box data-testid="compare-table">
      <Box sx={{ overflowX: "auto", border: "1px solid #E6EBE7", borderRadius: 2, background: "#fff" }}>
        <Table size="small" sx={{ minWidth: 760, "& td, & th": { borderColor: "#EEF1EE", py: 0.7, px: 1.2, height: "auto" }, "& tbody tr": { height: "auto" } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: dense ? 230 : 280 }} />
              {TYPES.map((t) => (
                <TableCell key={t.id} align="center" sx={{ verticalAlign: "bottom", background: t.id === "ezy" ? `${BRAND}12` : undefined, borderTop: t.id === "ezy" ? `3px solid ${BRAND}` : undefined }}>
                  <Typography sx={{ fontWeight: 800, fontSize: "0.74rem", color: t.id === "ezy" ? BRAND : "text.primary" }}>{t.name}</Typography>
                  <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", lineHeight: 1.3 }}>{t.sub}</Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {ROWS.map(([group, rows]) => (
              <React.Fragment key={group}>
                <TableRow><TableCell colSpan={TYPES.length + 1} sx={{ background: "#F6F8F6", fontWeight: 800, fontSize: "0.68rem", letterSpacing: 0.3, textTransform: "uppercase", color: "#4F5D55" }}>{group}</TableCell></TableRow>
                {rows.map(([label, ...v]) => (
                  <TableRow key={label} hover>
                    <TableCell sx={{ fontSize: "0.74rem" }}>{label}</TableCell>
                    {v.map((x, i) => <TableCell key={i} align="center" sx={{ background: i === 0 ? `${BRAND}08` : undefined }}>{MARK[x]}</TableCell>)}
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Typography sx={{ fontSize: "0.62rem", color: "text.secondary", mt: 1 }}>
        Other columns show typical coverage for each type of product, based on vendors' own public descriptions; individual products and editions vary, so check with each vendor. “Varies” usually means an add-on, a higher tier or a separate integrated product.
      </Typography>
    </Box>
  );
}

/** Compact "at a glance" card under the sign-up form: how much of the checklist each kind of product covers. */
export function CompareGlance() {
  const groups = ROWS;
  const cover = (ti) => groups.map(([g, rows]) => { const v = rows.map((r) => r[ti + 1]); return [g, v.filter((x) => x === "yes").length, v.length]; });
  return (
    <Card sx={{ p: 2.5, mt: 2 }} data-testid="compare-glance">
      <Typography component="h2" sx={{ fontWeight: 800, fontSize: "0.95rem" }}>At a glance: EZY HR vs other HR software</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.74rem", mb: 1.5 }}>The 15 modules HR software is usually compared on, plus 5 extras EZY HR is built around (AI actions, your own approval chains, IT desk, India statutory payroll, a free plan).</Typography>
      <Stack spacing={1.1}>
        {TYPES.map((t, ti) => {
          const c = cover(ti); const got = c.reduce((a, [, y]) => a + y, 0); const all = c.reduce((a, [, , n]) => a + n, 0);
          return (
            <Box key={t.id}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <Typography sx={{ fontSize: "0.76rem", fontWeight: t.id === "ezy" ? 800 : 600, color: t.id === "ezy" ? BRAND : "text.primary" }}>{t.name} <Typography component="span" sx={{ fontSize: "0.62rem", color: "text.secondary", fontWeight: 400 }}>{t.sub}</Typography></Typography>
                <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: t.id === "ezy" ? BRAND : "text.secondary" }}>{got} / {all}</Typography>
              </Stack>
              <Box sx={{ height: 8, borderRadius: 4, background: "#EEF1EE", overflow: "hidden", mt: 0.4 }}><Box sx={{ width: `${(got / all) * 100}%`, height: "100%", background: t.id === "ezy" ? BRAND : "#9DB3A6", borderRadius: 4 }} /></Box>
            </Box>
          );
        })}
      </Stack>
      <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", mt: 1.2 }}>Counts modules that are core to each kind of product; many tools add the rest through add-ons or integrations. Based on vendors' public descriptions — products vary.</Typography>
    </Card>
  );
}

/** The right-hand panel beside the Contact and Employee-count steps: "For your company" and "For your employees". */
export function WhyEzyPanel() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("company");
  const emp = view === "employees";
  const accent = emp ? "#FFE0B8" : "#8FE3C0";
  const toggleSx = { "& .MuiToggleButton-root": { color: "rgba(255,255,255,0.75)", borderColor: "rgba(255,255,255,0.25)", fontWeight: 800, fontSize: "0.68rem", textTransform: "none", py: 0.5 }, "& .Mui-selected": { color: emp ? "#7A2E0B !important" : "#10343D !important", background: `${accent} !important` } };
  return (
    <Card sx={{ p: 2.5, color: "#fff", position: { md: "sticky" }, top: { md: 16 }, transition: "background 300ms", background: emp ? "linear-gradient(155deg, #C2410C 0%, #E8590C 45%, #F59E0B 100%)" : "linear-gradient(160deg, #10343D 0%, #17505A 100%)" }} data-testid="why-ezy">
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, letterSpacing: 1, color: accent }}>WHY EZY HR</Typography>
        <ToggleButtonGroup exclusive size="small" value={view} onChange={(e, v) => v && setView(v)} sx={toggleSx} aria-label="Show benefits for">
          <ToggleButton value="company" data-testid="why-company">For your company</ToggleButton>
          <ToggleButton value="employees" data-testid="why-employees">For your employees</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {!emp ? (
        <>
          <Typography component="h2" sx={{  fontWeight: 800, fontSize: 20, lineHeight: 1.25, mt: 1 }}>Replace 4–5 HR tools with one AI-first app</Typography>
          <Typography sx={{ fontSize: "0.78rem", opacity: 0.8, mt: 0.8 }}>Most teams stitch together a payroll tool, an ATS, a performance tool, an LMS and an IT helpdesk. EZY HR has all of them in one login and one price.</Typography>
          <Stack spacing={1.1} sx={{ mt: 2 }}>
            {MODULE_GROUPS.map(([g, items]) => (
              <Box key={g}>
                <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, opacity: 0.75, mb: 0.4 }}>{g.toUpperCase()}</Typography>
                <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.5 }}>
                  {items.map((m) => <Chip key={m} size="small" icon={<CheckCircleRounded sx={{ fontSize: "14px !important", color: `${accent} !important` }} />} label={m.replace(" / employee records", "").replace(" (LMS / training)", "").replace(" / applicant tracking (ATS)", " (ATS)").replace(" / international payroll", " payroll")} sx={{ height: 22, fontSize: "0.62rem", color: "#fff", background: "rgba(255,255,255,0.1)" }} />)}
                </Stack>
              </Box>
            ))}
          </Stack>
          <Stack spacing={1.2} sx={{ mt: 2.2 }}>
            {BENEFITS.slice(0, 5).map(([Icon, t, d]) => <Benefit key={t} Icon={Icon} t={t} d={d} accent={accent} />)}
          </Stack>
        </>
      ) : (
        <>
          <Typography component="h2" sx={{  fontWeight: 800, fontSize: 20, lineHeight: 1.25, mt: 1 }}>An HR app your people will actually open</Typography>
          <Typography sx={{ fontSize: "0.78rem", opacity: 0.9, mt: 0.8 }}>Employees get answers and approvals in minutes, not emails and follow-ups — on web, Android and iOS.</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, mt: 1.8 }}>
            {[["15", "languages"], ["3 apps", "web · Android · iOS"], ["24×7", "self-service"]].map(([n, l]) => (
              <Box key={l} sx={{ background: "rgba(255,255,255,0.16)", borderRadius: 2, p: 1, textAlign: "center" }}>
                <Typography sx={{ fontWeight: 800, fontSize: "1.05rem" }}>{n}</Typography>
                <Typography sx={{ fontSize: "0.6rem", opacity: 0.9 }}>{l}</Typography>
              </Box>
            ))}
          </Box>
          <Stack spacing={1.2} sx={{ mt: 2 }} data-testid="why-employee-list">
            {EMPLOYEE_BENEFITS.map(([Icon, t, d]) => <Benefit key={t} Icon={Icon} t={t} d={d} accent="#FFF4E5" bg="rgba(255,255,255,0.2)" />)}
          </Stack>
        </>
      )}

      <Button fullWidth variant="contained" startIcon={<CompareArrowsRounded />} onClick={() => setOpen(true)} data-testid="why-compare" sx={{ mt: 2.2, background: accent, color: emp ? "#7A2E0B" : "#10343D", fontWeight: 800, "&:hover": { background: "#fff" } }}>Compare with other HR software</Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, pr: 6 }}>How EZY HR compares
          <IconButton aria-label="Close" onClick={() => setOpen(false)} sx={{ position: "absolute", right: 12, top: 12 }}><CloseRounded /></IconButton>
        </DialogTitle>
        <DialogContent><ComparisonTable dense /></DialogContent>
      </Dialog>
    </Card>
  );
}

function Benefit({ Icon, t, d, accent, bg = "rgba(143,227,192,0.16)" }) {
  return (
    <Stack direction="row" spacing={1.2}>
      <Box sx={{ width: 30, height: 30, borderRadius: 1.5, background: bg, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon sx={{ fontSize: 17, color: accent }} /></Box>
      <Box><Typography sx={{ fontWeight: 800, fontSize: "0.8rem" }}>{t}</Typography><Typography sx={{ fontSize: "0.7rem", opacity: 0.85, lineHeight: 1.4 }}>{d}</Typography></Box>
    </Stack>
  );
}

/** Benefit cards + table, shown under the pricing plans. */
export function CompareSection() {
  return (
    <Box sx={{ mt: 5 }} data-testid="compare-section">
      <Typography component="h2" sx={{  fontWeight: 800, fontSize: { xs: 22, md: 26 }, textAlign: "center" }}>How EZY HR compares with other HR software</Typography>
      <Typography sx={{ textAlign: "center", color: "text.secondary", mb: 2.5 }}>Every module on one subscription — plus things single-purpose tools don't do.</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, minmax(0,1fr))" }, gap: 1.5, mb: 2.5 }}>
        {BENEFITS.slice(0, 4).map(([Icon, t, d]) => (
          <Card key={t} sx={{ p: 2 }}>
            <Icon sx={{ color: BRAND }} />
            <Typography sx={{ fontWeight: 800, fontSize: "0.86rem", mt: 0.5 }}>{t}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.74rem" }}>{d}</Typography>
          </Card>
        ))}
      </Box>
      <ComparisonTable />
      <Box sx={{ mt: 4, p: { xs: 2, md: 3 }, borderRadius: 3, color: "#fff", background: "linear-gradient(120deg, #C2410C 0%, #E8590C 50%, #F59E0B 100%)" }} data-testid="employee-section">
        <Typography component="h2" sx={{  fontWeight: 800, fontSize: { xs: 20, md: 24 } }}>Good for your employees, too</Typography>
        <Typography sx={{ opacity: 0.9, mb: 2, fontSize: "0.85rem" }}>The things people use every week — in one app, in their language.</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, minmax(0,1fr))" }, gap: 1.5 }}>
          {EMPLOYEE_BENEFITS.map(([Icon, t, d]) => (
            <Box key={t} sx={{ background: "rgba(255,255,255,0.14)", borderRadius: 2, p: 1.6 }}>
              <Icon sx={{ color: "#FFF4E5" }} />
              <Typography sx={{ fontWeight: 800, fontSize: "0.84rem", mt: 0.4 }}>{t}</Typography>
              <Typography sx={{ fontSize: "0.72rem", opacity: 0.9 }}>{d}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
