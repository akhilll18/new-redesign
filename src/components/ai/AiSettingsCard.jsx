// Super Admin → System settings → Generative AI: how the portal reaches Claude, which models, and which AI features are on.
import React, { useState } from "react";
import { Alert, Box, Button, Chip, FormControlLabel, IconButton, InputAdornment, MenuItem, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { VisibilityRounded, VisibilityOffRounded, WifiTetheringRounded } from "@mui/icons-material";
import { AI_LANGUAGES, AI_MODELS, retestProvider, setAiSettings, useAiSettings, useAiStatus } from "../../lib/ai/config.js";
import { aiGenerate } from "../../lib/ai/client.js";
import { SectionCard } from "../kit/UI.jsx";
import { Sparkle } from "./AiText.jsx";

export default function AiSettingsCard({ onAudit }) {
  const s = useAiSettings();
  const status = useAiStatus();
  const [f, setF] = useState({ mode: s.mode, proxyUrl: s.proxyUrl, apiKey: s.apiKey, model: s.model, fastModel: s.fastModel, language: s.language });
  const [show, setShow] = useState(false);
  const [test, setTest] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const dirty = Object.keys(f).some((k) => f[k] !== s[k]);

  function save() {
    const changed = Object.keys(f).filter((k) => f[k] !== s[k]);
    setAiSettings(f);
    if (changed.length) onAudit?.({ mode: f.mode, proxy_url: f.proxyUrl, model: f.model, fast_model: f.fastModel, language: f.language, browser_key: f.apiKey ? "saved in browser" : "none" });
    setTest(null);
  }

  async function runTest() {
    setTest({ busy: true });
    try {
      const st = await retestProvider();
      const out = await aiGenerate({ task: "chat", system: "Reply with one short friendly sentence confirming you are connected to the EZY HR portal.", messages: [{ role: "user", content: "Connection test" }], fast: true, maxTokens: 60, hint: { question: "hello" } });
      setTest({ ok: true, text: `${st.label}: ${out.replace(/\[\[[^\]]+\]\]|\*\*/g, "").slice(0, 200)}` });
    } catch (e) {
      setTest({ ok: false, text: e.message });
    }
  }

  const toggle = (k, label) => <FormControlLabel key={k} control={<Switch checked={!!s[k]} onChange={(e) => setAiSettings({ [k]: e.target.checked })} />} label={label} />;

  return (
    <SectionCard
      title={<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Sparkle size={16} sx={{ color: "#2E8C7A" }} /><span>Generative AI</span></Stack>}
      subtitle="Claude powers the copilot, writing help on every field, explain-any-word, insights and approval reviews."
      action={<Chip size="small" color={status?.provider === "mock" ? "warning" : "success"} label={status?.label || "Checking…"} sx={{ fontSize: "0.6rem" }} />}
    >
      <Typography variant="caption" color="text.secondary">Connection</Typography>
      <ToggleButtonGroup exclusive size="small" value={f.mode} onChange={(_, v) => v && set("mode", v)} sx={{ display: "flex", flexWrap: "wrap", mt: 0.5, mb: 1.5 }}>
        <ToggleButton value="auto">Auto</ToggleButton>
        <ToggleButton value="proxy">Secure proxy</ToggleButton>
        <ToggleButton value="browser">Browser key</ToggleButton>
        <ToggleButton value="mock">Offline demo</ToggleButton>
      </ToggleButtonGroup>
      <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", mb: 2 }}>
        {{
          auto: "Uses the secure proxy if it answers, otherwise a saved browser key, otherwise the offline demo AI.",
          proxy: "Recommended for production. Run `npm run ai-proxy` (or `npm start`) with ANTHROPIC_API_KEY on the server; the key never reaches browsers.",
          browser: "For demos only: the key is stored in this browser and sent directly to Anthropic from it. Anyone using this browser can read it.",
          mock: "Rule-based demo with no network calls. Every AI control works, with simpler answers.",
        }[f.mode]}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
        {(f.mode === "auto" || f.mode === "proxy") && <TextField label="Proxy URL" value={f.proxyUrl} onChange={(e) => set("proxyUrl", e.target.value)} helperText="Same-origin default ./api/ai" data-ai="off" slotProps={{ htmlInput: { "data-ai": "off" } }} />}
        {(f.mode === "auto" || f.mode === "browser") && (
          <TextField
            label="Anthropic API key (browser)"
            type={show ? "text" : "password"}
            value={f.apiKey}
            onChange={(e) => set("apiKey", e.target.value.trim())}
            helperText="Stored only in this browser"
            autoComplete="off"
            slotProps={{ htmlInput: { "data-ai": "off" }, input: { endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShow((v) => !v)} aria-label="Show key">{show ? <VisibilityOffRounded sx={{ fontSize: 16 }} /> : <VisibilityRounded sx={{ fontSize: 16 }} />}</IconButton></InputAdornment> } }}
          />
        )}
        <TextField select label="Main model" value={f.model} onChange={(e) => set("model", e.target.value)} helperText="Copilot, insights, approval reviews">
          {AI_MODELS.map((m) => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
        </TextField>
        <TextField select label="Fast model" value={f.fastModel} onChange={(e) => set("fastModel", e.target.value)} helperText="Field writing, autocomplete, explain-a-word">
          {AI_MODELS.map((m) => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
        </TextField>
        <TextField select label="Default AI language" value={f.language} onChange={(e) => set("language", e.target.value)} helperText="Users can change their own in the copilot">
          {AI_LANGUAGES.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
        </TextField>
      </Box>
      {f.mode === "browser" && <Alert severity="warning" sx={{ mt: 2 }}>A browser-held key is visible to anyone with access to this browser. Use the secure proxy for real employees.</Alert>}
      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap", gap: 1 }}>
        <Button variant="contained" disabled={!dirty} onClick={save}>Save AI connection</Button>
        <Button variant="outlined" startIcon={<WifiTetheringRounded />} onClick={runTest} disabled={test?.busy || dirty}>Test connection</Button>
      </Stack>
      {test && !test.busy && <Alert severity={test.ok ? "success" : "error"} sx={{ mt: 1.5 }}>{test.text}</Alert>}
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 2.5 }}>Features (this browser)</Typography>
      <Stack>
        {toggle("copilot", "AI copilot on every page")}
        {toggle("fieldAssist", "AI writing assistant on every text field")}
        {toggle("autocomplete", "Autocomplete while typing")}
        {toggle("selection", "Explain / translate any selected words")}
        {toggle("insights", "AI insights and approval reviews")}
      </Stack>
    </SectionCard>
  );
}
