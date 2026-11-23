import React, { useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography, Alert } from "@mui/material";
import { CheckCircleRounded, RadioButtonUncheckedRounded } from "@mui/icons-material";
import { useStore } from "../../store/AppStore.jsx";
import { passwordProblems } from "../../lib/validation.js";

export function PasswordRules({ value, minLength }) {
  const all = ["At least " + minLength + " characters", "An uppercase letter", "A lowercase letter", "A number", "A symbol"];
  const missing = passwordProblems(value, { minLength });
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5 }}>
      {all.map((r) => {
        const ok = !missing.includes(r);
        return (
          <Stack key={r} direction="row" spacing={0.6} sx={{ alignItems: "center", color: ok ? "success.main" : "text.secondary" }}>
            {ok ? <CheckCircleRounded sx={{ fontSize: 15 }} /> : <RadioButtonUncheckedRounded sx={{ fontSize: 15 }} />}
            <Typography variant="caption">{r}</Typography>
          </Stack>
        );
      })}
    </Box>
  );
}

export default function ChangePasswordDialog({ open, onClose }) {
  const { changePassword, data, notifyToast } = useStore();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const min = data.settings.password_min_length;

  async function submit() {
    setError("");
    if (passwordProblems(next, { minLength: min }).length) return setError("The new password does not meet the rules.");
    if (next !== confirm) return setError("The two new passwords do not match.");
    const r = await changePassword(cur, next);
    if (!r.ok) return setError(r.error);
    notifyToast("Password changed.");
    setCur("");
    setNext("");
    setConfirm("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Change password</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Current password" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
          <TextField label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          <PasswordRules value={next} minLength={min} />
          <TextField label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={!cur || !next}>
          Change password
        </Button>
      </DialogActions>
    </Dialog>
  );
}
