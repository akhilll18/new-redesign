import React from "react";
import { Box, Card, Chip, Stack, Typography } from "@mui/material";
import { useStore } from "../../store/AppStore.jsx";
import { Avatar, PageHeader, SectionCard, StatusChip, KeyVal, Mono } from "../../components/kit/UI.jsx";
import { fmtDateTime } from "../../lib/utils.js";

const PERM_TEXT = { approve: "Approve / reject", bulk: "Bulk actions", reassign: "Reassign claims", export: "Export reports", flag: "Flag suspicious claims", escalate: "Escalate to Super Admin" };

export default function AdminProfile() {
  const { user, orgBy, scopeUnits, data } = useStore();
  const scope = scopeUnits(user);
  const decided = data.requests.filter((r) => (r.steps || []).some((st) => st.approver === user.admin_code && st.status !== "pending"));
  return (
    <>
      <PageHeader title="My profile" subtitle="Your admin scope and permissions are set by a Super Admin." />
      <Stack spacing={2.5}>
        <Card sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={2.5} sx={{ alignItems: "center" }}>
            <Avatar name={user.full_name} size={72} />
            <Box>
              <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>
                {user.full_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Admin · {user.email}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1 }}>
                <Mono>{user.admin_code}</Mono>
                <StatusChip status={user.status} />
              </Stack>
            </Box>
          </Stack>
        </Card>
        <SectionCard title="Admin record">
          <KeyVal
            cols={3}
            items={[
              ["Admin code", <Mono key="c">{user.admin_code}</Mono>, { required: true }],
              ["Name", user.full_name, { required: true }],
              ["Email", user.email, { required: true }],
              ["Org units held", user.org_units.map((o) => orgBy[o]?.name).join(", "), { required: true }],
              ["Effective scope (incl. child units)", [...scope].map((o) => orgBy[o]?.name).join(", ")],
              ["MFA status", <StatusChip key="m" status={user.mfa_status} />],
              ["Last sign-in", fmtDateTime(user.last_login)],
              ["Approval modules", (user.modules || []).join(", ")],
              ["Claims decided", decided.length],
            ]}
          />
        </SectionCard>
        <SectionCard title="Permissions scope">
          <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap" }}>
            {Object.entries(PERM_TEXT).map(([k, v]) => (
              <Chip key={k} label={v} color={user.permissions_scope.includes(k) ? "primary" : "default"} variant={user.permissions_scope.includes(k) ? "filled" : "outlined"} sx={{ opacity: user.permissions_scope.includes(k) ? 1 : 0.55 }} />
            ))}
          </Stack>
        </SectionCard>
      </Stack>
    </>
  );
}
