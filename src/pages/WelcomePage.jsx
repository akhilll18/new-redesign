// v10.13 · Right-hand "Why EZY HR" panel and a comparison with other HR software.
// v10.7 · Before sign-in: Contact us → how many employees → pricing & subscription → sign in.
// Enquiries are kept in this browser (localStorage "ezyo-enquiries") and listed for the Super Admin in Chat with EZY Support.
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, Chip, MenuItem, Slider, Stack, Step, StepLabel, Stepper, Switch, TextField, Typography } from "@mui/material";
import { CheckCircleRounded, LoginRounded, ArrowForwardRounded, ArrowBackRounded, StarRounded } from "@mui/icons-material";
import { EzyHrLockup } from "../components/brand/EzyHrLogo.jsx";
import { WhyEzyPanel, CompareSection, CompareGlance } from "./welcome/WhyEzy.jsx";

import { PRICING, pageFor } from "../seo/publicPages.js";
import { applySeo } from "../seo/seo.js";
export { PRICING };
const BANDS = ["1–10", "11–50", "51–200", "201–500", "501–1,000", "1,000+"];
const inr = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const enquiries = () => { try { return JSON.parse(localStorage.getItem("ezyo-enquiries") || "[]"); } catch { return []; } };

export default function WelcomePage() {
  const navigate = useNavigate();
  const loc = useLocation();
  // /pricing/ (and #/welcome?view=pricing) opens straight on the plans; contact details are asked for before subscribing
  const plansFirst = new URLSearchParams(loc.search).get("view") === "pricing";
  const [step, setStep] = useState(plansFirst ? 2 : 0);
  const seoPage = pageFor(plansFirst ? "/pricing/" : step === 0 ? "/contact/" : "/");
  React.useEffect(() => { applySeo({ title: seoPage.title, description: seoPage.description, index: true, path: seoPage.path }); }, [seoPage]);
  const [f, setF] = useState({ name: "", company: "", email: "", phone: "", country: "India", message: "" });
  const [count, setCount] = useState(50);
  const [annual, setAnnual] = useState(true);
  const [plan, setPlan] = useState("");
  const [err, setErr] = useState("");
  const suggested = count <= 10 ? "free" : count <= 300 ? "growth" : "global";
  const price = (p) => { const m = p.base + p.per * count; return annual ? m * 10 / 12 : m; };
  const chosen = PRICING.find((p) => p.id === (plan || suggested));
  const band = useMemo(() => BANDS[count <= 10 ? 0 : count <= 50 ? 1 : count <= 200 ? 2 : count <= 500 ? 3 : count <= 1000 ? 4 : 5], [count]);

  function next() {
    if (step === 0) {
      if (!f.name.trim() || !f.company.trim() || !/^\S+@\S+\.\S+$/.test(f.email) || !/^[+\d][\d\s-]{6,}$/.test(f.phone)) return setErr("Enter your name, company, a valid work email and phone number.");
    }
    setErr(""); setStep(step + 1);
  }
  function subscribe() {
    const contactOk = f.name.trim() && f.company.trim() && /^\S+@\S+\.\S+$/.test(f.email) && /^[+\d][\d\s-]{6,}$/.test(f.phone);
    if (!contactOk) { setPlan(chosen.id); setErr(`Tell us who you are to finish subscribing to ${chosen.name}.`); setStep(0); return; }
    const rec = { id: `ENQ-${Date.now()}`, ...f, employees: count, band, plan: chosen.id, plan_name: chosen.name, billing: annual ? "annual" : "monthly", monthly_estimate: Math.round(price(chosen)), at: new Date().toISOString() };
    try { localStorage.setItem("ezyo-enquiries", JSON.stringify([rec, ...enquiries()].slice(0, 100))); } catch { /* storage full */ }
    setStep(3);
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", backgroundImage: "radial-gradient(circle at 85% 0%, rgba(76,195,165,0.16), transparent 40%), radial-gradient(circle at 0% 100%, rgba(242,124,34,0.10), transparent 40%)" }}>
      <Stack direction="row" sx={{ alignItems: "center", px: { xs: 2, md: 5 }, py: 2 }}>
        <EzyHrLockup height={32} />
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<LoginRounded />} onClick={() => navigate("/login")}>Already a customer? Sign in</Button>
      </Stack>
      <Box sx={{ maxWidth: 1180, mx: "auto", px: 2, pb: 6 }}>
        <Typography component="h1" sx={{  fontWeight: 800, fontSize: { xs: 26, md: 34 }, textAlign: "center", mt: 2 }}>{plansFirst && step === 2 ? "EZY HR pricing" : "Get started with EZY HR"}</Typography>
        <Typography sx={{ textAlign: "center", color: "text.secondary", mb: 3 }}>Tell us about your company, see your price, pick a plan — then sign in.</Typography>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>{["Contact", "Employee count", "Pricing & subscription", "Sign in"].map((l) => <Step key={l}><StepLabel>{l}</StepLabel></Step>)}</Stepper>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        {/* v10.13: the form on the left, "Why EZY HR" on the right (below it on phones) */}
        {(step === 0 || step === 1) && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) 420px" }, gap: 3, alignItems: "start" }}>
        <Box>
        {step === 0 && (
          <Card sx={{ p: 3 }}>
            <Typography variant="h3" component="h2" sx={{ mb: 2 }}>Contact details</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <TextField label="Your name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <TextField label="Company *" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
              <TextField label="Work email *" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              <TextField label="Phone *" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
              <TextField select label="Country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>{["India", "United Arab Emirates", "Singapore", "United Kingdom", "United States", "Other"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
              <TextField label="What do you need? (optional)" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
            </Box>
            <Stack direction="row" sx={{ justifyContent: "flex-end", mt: 2 }}><Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={next}>Next · employee count</Button></Stack>
          </Card>
        )}

        {step === 1 && (
          <Card sx={{ p: 3 }}>
            <Typography variant="h3" component="h2">How many employees do you have?</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Include permanent, contract and freelance staff you want to manage.</Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Slider aria-label="Number of employees" value={Math.min(count, 2000)} min={1} max={2000} onChange={(e, v) => setCount(v)} sx={{ flex: 1 }} />
              <TextField type="number" size="small" value={count} slotProps={{ htmlInput: { "aria-label": "Number of employees" } }} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} sx={{ width: 110 }} />
            </Stack>
            <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>{[[10, "1–10"], [50, "11–50"], [200, "51–200"], [500, "201–500"], [1000, "501–1,000"], [1500, "1,000+"]].map(([n, l]) => <Chip key={l} label={l} color={band === l ? "primary" : "default"} onClick={() => setCount(n)} />)}</Stack>
            <Stack direction="row" sx={{ justifyContent: "space-between", mt: 3 }}><Button startIcon={<ArrowBackRounded />} onClick={() => setStep(0)}>Back</Button><Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={next}>See pricing</Button></Stack>
          </Card>
        )}
        <CompareGlance />
        </Box>
        <WhyEzyPanel />
        </Box>
        )}

        {step === 2 && (
          <>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "center", alignItems: "center", mb: 2 }}>
              <Typography sx={{ fontWeight: annual ? 400 : 800 }}>Monthly</Typography><Switch checked={annual} onChange={(e) => setAnnual(e.target.checked)} slotProps={{ input: { "aria-label": "Annual billing" } }} /><Typography sx={{ fontWeight: annual ? 800 : 400 }}>Annual</Typography><Chip size="small" color="success" label="2 months free" />
              <Typography sx={{ ml: 2, color: "text.secondary" }}>· {count} employees</Typography>
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0,1fr))" }, gap: 2 }}>
              {PRICING.map((p) => {
                const on = (plan || suggested) === p.id;
                return (
                  <Card key={p.id} onClick={() => setPlan(p.id)} sx={{ p: 2.5, cursor: "pointer", borderTop: `4px solid ${p.colour}`, outline: on ? `2px solid ${p.colour}` : "none", background: on ? `${p.colour}0d` : "#fff" }}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><Typography variant="h3" component="h2">{p.name}</Typography>{p.id === suggested && <Chip size="small" icon={<StarRounded />} label="Best for you" sx={{ background: `${p.colour}22`, color: p.colour, fontWeight: 800 }} />}</Stack>
                    <Typography sx={{  fontWeight: 800, fontSize: 28, mt: 1, color: p.colour }}>{p.per ? inr(price(p)) : "₹0"}<Typography component="span" sx={{ fontSize: 13, color: "text.secondary" }}> / month</Typography></Typography>
                    <Typography variant="caption" color="text.secondary">{p.per ? `${inr(p.base)} base + ${inr(p.per)} per employee${annual ? " · billed yearly" : ""}` : "Free forever"}</Typography>
                    <Typography variant="body2" sx={{ my: 1.2 }}>{p.blurb}</Typography>
                    {p.features.map((t) => <Stack key={t} direction="row" spacing={0.8} sx={{ alignItems: "center", mb: 0.4 }}><CheckCircleRounded sx={{ fontSize: 16, color: p.colour }} /><Typography variant="body2">{t}</Typography></Stack>)}
                  </Card>
                );
              })}
            </Box>
            <Stack direction="row" sx={{ justifyContent: "space-between", mt: 3 }}><Button startIcon={<ArrowBackRounded />} onClick={() => setStep(1)}>Back</Button><Button variant="contained" size="large" onClick={subscribe}>Subscribe to {chosen.name}{chosen.per ? ` · ${inr(price(chosen))}/month` : ""}</Button></Stack>
            <CompareSection />
          </>
        )}

        {step === 3 && (
          <Card sx={{ p: 4, maxWidth: 560, mx: "auto", textAlign: "center" }}>
            <CheckCircleRounded sx={{ fontSize: 56, color: "#1F9D63" }} />
            <Typography variant="h3" component="h2" sx={{ mt: 1 }}>Thanks, {f.name.split(" ")[0]} — your {chosen.name} subscription is requested</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ my: 1.5 }}>{f.company} · {count} employees · {annual ? "annual" : "monthly"} billing{chosen.per ? ` · about ${inr(price(chosen))} a month` : ""}. Our team will email {f.email} with your account set-up within one working day.</Typography>
            <Button variant="contained" size="large" startIcon={<LoginRounded />} onClick={() => navigate("/login")}>Continue to sign in</Button>
          </Card>
        )}
      </Box>
    </Box>
  );
}
