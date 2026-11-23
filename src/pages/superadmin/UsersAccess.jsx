// Super Admin: manage employees (status override, unlock, reset), admins and super admins.
import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputAdornment,
  InputLabel,
  ListItemText,
  Menu,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { MoreVertRounded, SearchRounded, SyncRounded, PersonAddRounded } from "@mui/icons-material";
import { useStore, hasLogin } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, StatusChip, PersonCell, Mono, TableWrap, ConfirmDialog } from "../../components/kit/UI.jsx";
import { fmtDateTime, fmtNum } from "../../lib/utils.js";
import { passwordProblems } from "../../lib/validation.js";

const PERMS = [
  ["approve", "Approve / reject"],
  ["bulk", "Bulk actions"],
  ["reassign", "Reassign claims"],
  ["export", "Export reports"],
  ["flag", "Flag suspicious claims"],
  ["escalate", "Escalate to Super Admin"],
  ["people", "Add / remove employees"],
];

function AdminDialog({ open, rec, onClose }) {
  const { data, upsertAdmin, notifyToast } = useStore();
  const blankAdmin = { full_name: "", email: "", login_id: "", org_units: ["Head Office"], modules: ["leave"], permissions_scope: ["approve", "bulk", "export", "flag", "escalate"], access_profile: "", locale_access: false, employee_code: "" };
  const [f, setF] = useState(() => rec || blankAdmin);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  React.useEffect(() => {
    setF(rec ? { modules: [], ...rec } : blankAdmin);
    setPw("");
    setErr("");
  }, [rec, open]);

  async function save() {
    if (f.full_name.trim().length < 2) return setErr("Enter the admin's name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErr("Enter a valid email.");
    if (!f.org_units.length) return setErr("Assign at least one org unit.");
    if (!f.modules.length) return setErr("Choose at least one approval module.");
    if (!rec && passwordProblems(pw, { minLength: data.settings.password_min_length }).length) return setErr(`The temporary password needs ${passwordProblems(pw, { minLength: data.settings.password_min_length }).join(", ").toLowerCase()}.`);
    const r = await upsertAdmin({ ...f, full_name: f.full_name.trim(), email: f.email.trim(), login_id: (f.login_id || f.email).trim() }, rec ? null : pw);
    if (!r.ok) return setErr(r.error);
    const wired = r.chains?.length ? ` Approval workflow set up automatically: ${r.chains.join("; ")}.${r.moved?.length ? ` Took over ${r.moved.length} waiting request(s).` : ""}` : "";
    notifyToast((rec ? "Admin updated." : `Admin ${r.code} created. They must set up MFA and a new password at first sign-in.`) + wired);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{rec ? `Edit ${rec.admin_code}` : "Create admin"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField label="Full name" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <TextField label="Email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <TextField label="Login ID" value={f.login_id} placeholder="Defaults to email" onChange={(e) => setF({ ...f, login_id: e.target.value })} />
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 1.5, border: "1px solid #d7ece6", background: "#f4fbf8" }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "#0B8C8C", letterSpacing: "0.04em" }}>ACCESS PROFILE</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, mt: 1 }}>
              <TextField select size="small" label="Gives access as" value={f.access_profile || ""} onChange={(e) => { const pr = ACCESS_PROFILES.find(([k]) => k === e.target.value); setF({ ...f, access_profile: e.target.value, ...(pr?.[2] ? { modules: pr[2], permissions_scope: pr[3] } : {}) }); }}>
                {ACCESS_PROFILES.map(([k, l]) => <MenuItem key={k || "custom"} value={k}>{l}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Employee record (self-service)" value={f.employee_code || ""} onChange={(e) => setF({ ...f, employee_code: e.target.value })} helperText="Opens “My employee space” with their employee login">
                <MenuItem value="">Not an employee</MenuItem>
                {data.employees.filter((e) => e.status === "active").map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name} · {e.employee_code}</MenuItem>)}
              </TextField>
            </Box>
            <FormControlLabel sx={{ mt: 0.5 }} control={<Checkbox size="small" checked={!!f.locale_access} onChange={(e) => setF({ ...f, locale_access: e.target.checked })} />} label={<Typography sx={{ fontSize: "0.72rem" }}>Allow switching country and language (header country & language options, Country space)</Typography>} />
          </Box>
          <FormControl size="small" fullWidth required>
            <InputLabel>Org units (scope)</InputLabel>
            <Select multiple value={f.org_units} onChange={(e) => setF({ ...f, org_units: e.target.value })} input={<OutlinedInput label="Org units (scope)" />} renderValue={(v) => v.map((o) => data.orgUnits.find((u) => u.org_unit_id === o)?.name).join(", ")}>
              {data.orgUnits.map((o) => (
                <MenuItem key={o.org_unit_id} value={o.org_unit_id}>
                  <Checkbox size="small" checked={f.org_units.includes(o.org_unit_id)} />
                  <ListItemText primary={o.name} secondary={o.parent_unit ? `under ${data.orgUnits.find((u) => u.org_unit_id === o.parent_unit)?.name}` : "Top level"} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Modules (approvals they finalise after the manager, and the admin pages they can open)
            </Typography>
            <FormGroup row>
              {ADMIN_MODULES.map(([k, label]) => (
                <FormControlLabel key={k} sx={{ width: { xs: "100%", sm: "33%" }, m: 0 }} control={<Checkbox size="small" checked={f.modules.includes(k)} onChange={(e) => setF({ ...f, modules: e.target.checked ? [...f.modules, k] : f.modules.filter((p) => p !== k) })} />} label={<Typography variant="body2">{label}</Typography>} />
              ))}
            </FormGroup>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Permissions scope
            </Typography>
            <FormGroup row>
              {PERMS.map(([k, label]) => (
                <FormControlLabel key={k} sx={{ width: { xs: "100%", sm: "50%" }, m: 0 }} control={<Checkbox size="small" checked={f.permissions_scope.includes(k)} onChange={(e) => setF({ ...f, permissions_scope: e.target.checked ? [...f.permissions_scope, k] : f.permissions_scope.filter((p) => p !== k) })} />} label={<Typography variant="body2">{label}</Typography>} />
              ))}
            </FormGroup>
          </Box>
          {!rec && <TextField label="Temporary password" required type="text" value={pw} onChange={(e) => setPw(e.target.value)} helperText="Share it securely. The admin must change it and enrol MFA at first sign-in." />}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save}>
          {rec ? "Save" : "Create admin"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// v10.4: access profiles the Super Admin hands out. Every admin keeps their own employee self-service through the
// linked employee record ("My employee space"); the profile decides which admin side they get.
export const ACCESS_PROFILES = [
  ["hr", "Employee + HR admin", ["leave", "accounts", "payslips", "offers", "attendance", "location", "performance", "recruitment", "onboarding", "monitoring", "calls", "wellness", "workforce", "learning", "bgv", "compliance", "contracts"], ["approve", "bulk", "reassign", "export", "flag", "escalate", "people"]],
  ["finance", "Employee + Finance admin", ["expense", "advance", "loan", "payroll", "benefits", "assets", "compliance", "contracts"], ["approve", "bulk", "export", "flag", "escalate"]],
  ["hr_finance", "Employee + HR admin + Finance admin", ["leave", "accounts", "payslips", "offers", "attendance", "location", "performance", "recruitment", "onboarding", "monitoring", "calls", "wellness", "workforce", "learning", "bgv", "compliance", "contracts", "expense", "advance", "loan", "payroll", "benefits", "assets"], ["approve", "bulk", "reassign", "export", "flag", "escalate", "people"]],
  // v10.11: IT approvers for the IT-support and asset-purchase chains (signs in to EZY Service Desk)
  ["it", "Employee + IT admin", ["it", "assets"], ["approve", "export", "flag", "escalate"]],
  ["", "Custom (modules below)", null, null],
];
export const ACCESS_LABEL = Object.fromEntries(ACCESS_PROFILES.map(([k, l]) => [k, l]));

export const ADMIN_MODULES = [
  ["leave", "Leave"], ["accounts", "New accounts"], ["expense", "Expense claims"], ["advance", "Advances"], ["loan", "Salary loans"],
  ["attendance", "Attendance & biometrics"], ["location", "Geofencing & live location"], ["assets", "Assets"], ["calls", "Team call tracker"], ["monitoring", "Employee monitoring"],
  ["performance", "Performance"], ["recruitment", "Recruitment"], ["offers", "Offer letters"], ["onboarding", "Onboarding"], ["learning", "Learning"], ["workforce", "Workforce planning"],
  ["payroll", "Payroll (approves payslips as Finance)"], ["payslips", "Payslips (HR prepares and releases)"], ["benefits", "Benefits"], ["wellness", "Wellness"],
  ["bgv", "Background verification (full case access)"], ["compliance", "Compliance calendar"], ["it", "IT service desk"],
];

function adminSide(a) {
  const m = a.modules || [];
  const hr = m.includes("accounts") || (a.permissions_scope || []).includes("people");
  const fin = m.some((x) => ["payroll", "expense", "advance", "loan"].includes(x));
  return hr && fin ? "HR + Finance" : hr ? "HR" : fin ? "Finance" : "limited";
}

export default function UsersAccess() {
  const { data, orgBy, balanceOf, setUserStatus, forceReset, resetMfa, hrSync, adjustPoints, notifyToast, scopeUnits, setAccountAccess } = useStore();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || "employees");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [menu, setMenu] = useState(null); // { anchor, role, rec }
  const [confirm, setConfirm] = useState(null);
  const [adminDlg, setAdminDlg] = useState(null); // {rec} or {} for new
  const [adjust, setAdjust] = useState(null);
  const [adjPts, setAdjPts] = useState("");
  const [adjNote, setAdjNote] = useState("");

  const emps = data.employees.filter((e) => (!status || e.status === status) && (!q || [e.full_name, e.employee_code, e.login_id, e.designation].join(" ").toLowerCase().includes(q.toLowerCase())));
  const admins = data.admins.filter((a) => (!status || a.status === status) && (!q || [a.full_name, a.admin_code, a.login_id].join(" ").toLowerCase().includes(q.toLowerCase())));

  function act(kind) {
    const { role, rec } = menu;
    setMenu(null);
    setConfirm({ kind, role, rec });
  }

  async function runConfirm() {
    const { kind, role, rec } = confirm;
    // admins also carry an employee code — act on the admin account (ADMnn), not their employee record
    const code = role === "admin" ? rec.admin_code : rec.employee_code;
    let r = { ok: true };
    if (kind === "unlock" || kind === "activate") r = setUserStatus(role, code, "active") || r;
    if (kind === "suspend") r = setUserStatus(role, code, "suspended") || r;
    if (kind === "reset" || kind === "create") r = (await forceReset(role, code)) || r;
    if (kind === "mfa") r = resetMfa(code) || r;
    if (r.ok === false) { notifyToast(r.error || "That did not work. Try again.", "error"); setConfirm(null); return; }
    notifyToast({ unlock: `${rec.full_name} unlocked.`, activate: `${rec.full_name} activated.`, suspend: `${rec.full_name} suspended.`, reset: `${rec.full_name} must set a new password (temporary: Welcome@123).`, create: `Login created for ${rec.full_name}: ${rec.login_id} · temporary password Welcome@123 (they set their own at first sign-in).`, mfa: `${rec.full_name} must re-enrol MFA.` }[kind]);
    setConfirm(null);
  }

  const menuRec = menu?.rec;
  return (
    <>
      <PageHeader
        title="Users & access"
        subtitle="Override account status, unlock accounts, reset passwords and manage admin scope."
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<SyncRounded />}
              onClick={() => {
                const r = hrSync();
                notifyToast(r.added ? `HR sync added ${r.added} employee(s) as pending approval.` : "HR sync complete. No new employees.");
              }}
            >
              Sync with HR
            </Button>
            <Button variant="contained" startIcon={<PersonAddRounded />} onClick={() => setAdminDlg({})}>
              Create admin
            </Button>
          </>
        }
      />
      <SectionCard noPad>
        <Box sx={{ px: 1.5, pt: 1, borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={tab} onChange={(_, v) => (setTab(v), setStatus(""))}>
            <Tab value="employees" label={`Employees (${data.employees.length})`} sx={{ minHeight: 44, fontSize: 13 }} />
            <Tab value="admins" label={`Admins (${data.admins.length})`} sx={{ minHeight: 44, fontSize: 13 }} />
            <Tab value="super" label={`Super admins (${data.superAdmins.length})`} sx={{ minHeight: 44, fontSize: 13 }} />
          </Tabs>
        </Box>
        {tab !== "super" && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ p: 1.5 }}>
            <TextField placeholder="Search name, code, login ID" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: { sm: 340 } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="">Any status</MenuItem>
                {["active", "pending_approval", "locked", "suspended", "rejected"].map((s) => (
                  <MenuItem key={s} value={s}>
                    {s.replace("_", " ")}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        )}

        <TableWrap>
          {tab === "employees" && (
            <Table size="small" sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Login ID</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Failed</TableCell>
                  <TableCell>Last sign-in</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {emps.map((e) => (
                  <TableRow key={e.employee_code}>
                    <TableCell>
                      <PersonCell name={e.full_name} sub={`${e.employee_code} · ${e.designation}`} src={e.profile_photo} />
                    </TableCell>
                    <TableCell>
                      <Mono>{e.login_id}</Mono>
                      {e.must_reset && (
                        <Typography variant="caption" color="warning.main" component="div">
                          Must set password
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{orgBy[e.department]?.name}</TableCell>
                    <TableCell>
                      <StatusChip status={e.status} />
                      {!hasLogin(e) && <Chip size="small" variant="outlined" label="No login yet" sx={{ ml: 0.5, height: 20, fontSize: "0.6rem" }} />}
                    </TableCell>
                    <TableCell align="right">{e.failed_attempts || 0}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {fmtDateTime(e.last_login)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" aria-label={`Actions for ${e.full_name}`} onClick={(ev) => setMenu({ anchor: ev.currentTarget, role: "emp", rec: e })}>
                        <MoreVertRounded fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tab === "admins" && (
            <Table size="small" sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Admin</TableCell>
                  <TableCell>Org units</TableCell>
                  <TableCell>Modules / permissions</TableCell>
                  <TableCell>MFA</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last sign-in</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {admins.map((a) => (
                  <TableRow key={a.admin_code}>
                    <TableCell>
                      <PersonCell name={a.full_name} sub={`${a.admin_code} · ${a.login_id}`} />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography variant="body2">{a.org_units.map((o) => orgBy[o]?.name).join(", ")}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        effective: {[...scopeUnits(a)].length} unit(s)
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 240 }}>
                      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mb: 0.5 }}>
                        <Chip size="small" label={ACCESS_LABEL[a.access_profile || ""] && a.access_profile ? ACCESS_LABEL[a.access_profile] : `Custom · ${adminSide(a)}`} sx={{ height: 20, fontSize: "0.6rem", fontWeight: 700, bgcolor: "#e6f7f2", color: "#0B6B6B" }} />
                        <Chip size="small" label={a.employee_code ? `Employee ${a.employee_code}` : "No employee link"} sx={{ height: 20, fontSize: "0.6rem" }} />
                        <Chip size="small" clickable onClick={() => { const r = setAccountAccess("admin", a.admin_code, { locale_access: !a.locale_access }); notifyToast(r.ok ? `${a.full_name} ${a.locale_access ? "can no longer" : "can now"} switch country & language.` : r.error, r.ok ? "success" : "error"); }} label={a.locale_access ? "Country & language: on" : "Country & language: off"} sx={{ height: 20, fontSize: "0.6rem", bgcolor: a.locale_access ? "#fff4e5" : undefined }} />
                      </Stack>
                      <Typography variant="caption" component="div" sx={{ fontWeight: 700 }}>{(a.modules || []).join(", ")}</Typography>
                      <Typography variant="caption">{a.permissions_scope.join(", ")}</Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={a.mfa_status} />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={a.status} />
                      {!hasLogin(a) && <Chip size="small" variant="outlined" label="No login yet" sx={{ ml: 0.5, height: 20, fontSize: "0.6rem" }} />}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {fmtDateTime(a.last_login)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" aria-label={`Actions for ${a.full_name}`} onClick={(ev) => setMenu({ anchor: ev.currentTarget, role: "admin", rec: a })}>
                        <MoreVertRounded fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tab === "super" && (
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Super admin</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Security PIN</TableCell>
                  <TableCell>MFA secret</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last sign-in</TableCell>
                  <TableCell>Employee self-service</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.superAdmins.map((s) => (
                  <TableRow key={s.superadmin_code}>
                    <TableCell>
                      <PersonCell name={s.full_name} sub={s.superadmin_code} />
                    </TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell>
                      <Mono>•••• (hashed)</Mono>
                    </TableCell>
                    <TableCell>
                      <Mono>{s.mfa_secret.slice(0, 4)} •••• •••• ••••</Mono>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={s.status} />
                    </TableCell>
                    <TableCell>{fmtDateTime(s.last_login)}</TableCell>
                    <TableCell sx={{ minWidth: 200 }}>
                      <TextField select size="small" fullWidth value={s.employee_code || ""} onChange={(e) => { const r = setAccountAccess("superadmin", s.superadmin_code, { employee_code: e.target.value }); notifyToast(r.ok ? (e.target.value ? `Linked to ${e.target.value}. “My employee space” is now in the menu.` : "Employee link removed.") : r.error, r.ok ? "success" : "error"); }}>
                        <MenuItem value="">Not linked</MenuItem>
                        {data.employees.filter((e) => e.status === "active").map((e) => <MenuItem key={e.employee_code} value={e.employee_code}>{e.full_name} · {e.employee_code}</MenuItem>)}
                      </TextField>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableWrap>
        {tab === "super" && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", p: 1.5 }}>
            Super admin accounts are created on the server with a security PIN and MFA secret; they cannot be added from the browser.
          </Typography>
        )}
      </SectionCard>

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        {menuRec?.status === "locked" && <MenuItem onClick={() => act("unlock")}>Unlock account</MenuItem>}
        {menuRec && ["suspended", "pending_approval", "rejected"].includes(menuRec.status) && <MenuItem onClick={() => act("activate")}>Set active</MenuItem>}
        {menuRec && menuRec.status !== "suspended" && <MenuItem onClick={() => act("suspend")}>Suspend</MenuItem>}
        <MenuItem onClick={() => act(menuRec && !hasLogin(menuRec) ? "create" : "reset")}>{menuRec && !hasLogin(menuRec) ? "Create login" : "Force password reset"}</MenuItem>
        {menu?.role === "admin" && <MenuItem onClick={() => act("mfa")}>Reset MFA</MenuItem>}
        {menu?.role === "admin" && (
          <MenuItem
            onClick={() => {
              setAdminDlg({ rec: menuRec });
              setMenu(null);
            }}
          >
            Edit scope and permissions
          </MenuItem>
        )}
      </Menu>

      <ConfirmDialog
        open={!!confirm}
        title={confirm && { unlock: "Unlock account?", activate: "Set account active?", suspend: "Suspend account?", reset: "Force a password reset?", create: `Create a login for ${confirm?.rec?.full_name}?`, mfa: "Reset MFA?" }[confirm.kind]}
        text={confirm && { create: `They sign in with ${confirm.rec?.login_id}${confirm.role === "admin" ? `, admin code ${confirm.rec?.admin_code} and a one-time code` : ` and employee code ${confirm.rec?.employee_code}`}, using the temporary password Welcome@123, and must set their own password straight away.`, unlock: "Failed attempts are cleared and the user can sign in again.", activate: "The user can sign in straight away.", suspend: "The user cannot sign in until reactivated. Open claims stay as they are.", reset: "Their password becomes the temporary password Welcome@123 and they must choose a new one at next sign-in.", mfa: "The admin must re-enrol their authenticator at next sign-in." }[confirm.kind]}
        tone={confirm?.kind === "suspend" ? "error" : "primary"}
        confirmLabel="Confirm"
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
      />

      <ConfirmDialog
        open={!!adjust}
        title={`Adjust points · ${adjust?.full_name}`}
        text="Use a negative number to deduct. The employee is notified and the change is audited."
        confirmLabel="Apply"
        onClose={() => setAdjust(null)}
        onConfirm={() => {
          const r = adjustPoints(adjust.employee_code, adjPts, adjNote);
          if (!r.ok) return notifyToast(r.error, "error");
          notifyToast("Points adjusted.");
          setAdjust(null);
          setAdjPts("");
          setAdjNote("");
        }}
      >
        <Stack spacing={2}>
          <TextField label="Points (+/-)" value={adjPts} onChange={(e) => setAdjPts(e.target.value.replace(/[^\d-]/g, ""))} />
          <TextField label="Audit note (required)" value={adjNote} onChange={(e) => setAdjNote(e.target.value)} multiline minRows={2} />
        </Stack>
      </ConfirmDialog>

      <AdminDialog open={!!adminDlg} rec={adminDlg?.rec || null} onClose={() => setAdminDlg(null)} />
    </>
  );
}
