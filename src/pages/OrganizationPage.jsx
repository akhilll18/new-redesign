import React from "react";
import { Box, Stack, Typography, Grid, Card, CardActionArea, Divider } from "@mui/material";
import { AccountTree, PersonAddAlt, Groups, Star } from "@mui/icons-material";
import { Avatar, Button, PageHeader } from "../components/PortalUI.jsx";
import { Avatar as MuiAvatar, Badge, IconButton, Tooltip } from "@mui/material";
import { PhotoCameraRounded } from "@mui/icons-material";
import { useStore } from "../store/AppStore.jsx";
import { readFileAsDataUrl } from "../lib/utils.js";
import { adminKind } from "../lib/statutory.js";
import { designTokens } from "../theme/muiTheme.js";

const { color } = designTokens;

// v10.7: photos on the org chart. Higher authorities (top of the reporting line) are shown with their picture;
// HR admins and the Super Admin can change anyone's picture from here.
function PhotoAvatar({ person, size = 31 }) {
  const { data, user, suiteDo, notifyToast } = useStore();
  const e = data.employees.find((x) => x.employee_code === person.id);
  const src = e?.profile_photo || person.photo || "";
  const can = user.role === "superadmin" || (user.role === "admin" && ["hr", "hr_finance"].includes(adminKind(user)));
  const initials = person.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const av = <MuiAvatar src={src || undefined} sx={{ width: size, height: size, fontSize: size > 40 ? "1rem" : "0.65rem", fontWeight: 800, bgcolor: "#dfe9ec", color: "#15414F", border: "2px solid #fff", boxShadow: "0 2px 8px rgba(21,65,79,0.15)" }}>{initials}</MuiAvatar>;
  if (!can || size < 30) return av;
  return (
    <Badge overlap="circular" anchorOrigin={{ vertical: "bottom", horizontal: "right" }} badgeContent={
      <Tooltip title="Change picture (HR)">
        <IconButton size="small" component="label" onClick={(ev) => ev.stopPropagation()} sx={{ width: 20, height: 20, bgcolor: "#15414F", color: "#fff", "&:hover": { bgcolor: "#0B8C8C" } }}>
          <PhotoCameraRounded sx={{ fontSize: 12 }} />
          <input hidden type="file" accept="image/*" onChange={async (ev) => { const f = ev.target.files?.[0]; if (!f) return; if (f.size > 1048576) return notifyToast("Pick a picture under 1 MB.", "error"); const url = await readFileAsDataUrl(f); const r = suiteDo("admin106", (st, { x }) => { const emp = x.employees.find((y) => y.employee_code === person.id); if (emp) emp.profile_photo = url; }, { action: "PHOTO_UPDATE_HR", details: person.id }); notifyToast(r.ok ? `Picture updated for ${person.name}.` : r.error, r.ok ? "success" : "error"); }} />
        </IconButton>
      </Tooltip>}>{av}</Badge>
  );
}
function HigherAuthorities({ people }) {
  const { data } = useStore();
  const ids = new Set(people.map((p) => p.id));
  const emps = data.employees.filter((e) => ids.has(e.employee_code) && e.status === "active");
  const hasReports = (c) => data.employees.some((x) => x.reporting_manager === c && x.status === "active");
  const top = emps.filter((e) => hasReports(e.employee_code) && (!e.reporting_manager || !ids.has(e.reporting_manager) || !emps.some((m) => m.employee_code === e.reporting_manager && m.reporting_manager)))
    .sort((a, b) => (a.reporting_manager ? 1 : 0) - (b.reporting_manager ? 1 : 0) || a.full_name.localeCompare(b.full_name)).slice(0, 8);
  if (!top.length) return null;
  return (
    <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", justifyContent: "center", mb: 1, position: "relative", zIndex: 2 }}>
      {top.map((e) => {
        const p = people.find((x) => x.id === e.employee_code);
        return (
          <Card key={e.employee_code} sx={{ px: 2, py: 1.4, minWidth: 170, textAlign: "center", borderRadius: 3, border: `1px solid ${color.border}`, bgcolor: color.card }}>
            <Box sx={{ display: "flex", justifyContent: "center", mb: 0.8 }}><PhotoAvatar person={p} size={64} /></Box>
            <Typography sx={{ fontWeight: 800, fontSize: "0.74rem", color: "#202922" }}>{e.full_name}</Typography>
            <Typography sx={{ fontSize: "0.6rem", color: "#4b8060", fontWeight: 600 }}>{e.designation}</Typography>
            <Typography sx={{ fontSize: "0.56rem", color: "#89948c" }}>{e.department} · {data.employees.filter((x) => x.reporting_manager === e.employee_code && x.status === "active").length} direct reports</Typography>
          </Card>
        );
      })}
    </Stack>
  );
}

export default function OrganizationPage({ people, departments: departmentOptions = [], onAction, canManage = true, myTeamOnly = false }) {
  // Group people by department
  const teams = people.reduce((groups, person) => {
    const name = person.department || "Other";
    groups[name] = [...(groups[name] || []), person];
    return groups;
  }, {});

  const departments = [...new Set([...(myTeamOnly ? [] : departmentOptions), ...Object.keys(teams)])]
    .map((name) => [name, teams[name] || []]);

  const lineAnimation = {
    background: color.borderStrong,
  };

  const verticalLineAnimation = {
    borderLeft: `2px dashed ${color.borderStrong}`,
  };

  return (
    <>
      <PageHeader
        eyebrow="PEOPLE & REPORTING LINES"
        title="Organization chart"
        description={myTeamOnly ? "Your reporting line: your manager, teammates and direct reports." : "Explore teams, managers and reporting groups."}
        action={
          canManage && (
            <Button icon={PersonAddAlt} onClick={() => onAction("employee")}>
              Onboard employee
            </Button>
          )
        }
      />

      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", pb: 6, pt: 2, overflowX: "auto" }}>
        
        {/* ── TOP LEVEL: LEADERSHIP ── */}
        <Card
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 3,
            py: 1.5,
            border: `1px solid ${color.primary}`,
            borderRadius: 2,
            boxShadow: "0 1px 3px rgba(36,77,61,0.06)",
            position: "relative",
            zIndex: 2,
            background: color.card,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#ebf3ec",
              display: "grid",
              placeItems: "center",
            }}
          >
            <AccountTree sx={{ color: "#244d3d", fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{  fontWeight: 800, fontSize: "1rem", color: "#202922" }}>
              Leadership & higher authorities
            </Typography>
            <Typography sx={{ mt: 0.2, fontSize: "0.65rem", color: "#78827b", fontWeight: 500 }}>
              {people.length} employees · {departments.length} departments
            </Typography>
          </Box>
        </Card>

        {/* Vertical moving connector line from Leadership */}
        <Box sx={{ width: 2, height: 18, ...verticalLineAnimation }} />
        <HigherAuthorities people={people} />
        <Box
          sx={{
            width: 2,
            height: 40,
            ...verticalLineAnimation,
            position: "relative",
            zIndex: 1,
          }}
        />

        {/* Horizontal moving connector line (Desktop) */}
        <Box
          sx={{
            display: { xs: "none", md: "block" },
            height: 2,
            width: "80%",
            maxWidth: 1000,
            mb: 0,
            ...lineAnimation
          }}
        />

        {/* ── DEPARTMENT GRID ── */}
        <Grid
          container
          spacing={3}
          sx={{
            width: "100%",
            maxWidth: 1200,
            mt: 0,
            pt: { xs: 2, md: 0 },
          }}
        >
          {departments.map(([department, members]) => {
            const lead = members.find((p) => /\b(lead|manager|director|head)\b/i.test(p.role)) || members[0];
            const otherMembers = members.filter((p) => p.id !== lead?.id);

            return (
              <Grid item xs={12} sm={6} md={4} key={department}>
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  
                  {/* Vertical moving line connecting to department card */}
                  <Box
                    sx={{
                      width: 2,
                      height: 24,
                      display: { xs: "none", md: "block" },
                      ...verticalLineAnimation
                    }}
                  />

                  {/* Department Card */}
                  <Card sx={{ width: "100%", borderRadius: 2, overflow: "hidden", border: "1px solid #e5eae5" }}>
                    
                    {/* Department Header */}
                    <Box sx={{ background: "#fbfdfb", px: 2, py: 1.2, borderBottom: "1px solid #edf0ec" }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Groups sx={{ fontSize: 18, color: "#4b8060" }} />
                        <Typography sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#303b33" }}>
                          {department}
                        </Typography>
                        <Box sx={{ ml: "auto", background: "#ebf3ec", px: 1, py: 0.2, borderRadius: 1 }}>
                          <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#244d3d" }}>
                            {members.length}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>

                    {/* Lead / Manager Section */}
                    {lead && (
                      <Box sx={{ p: 1.5 }}>
                        <Typography sx={{ fontSize: "0.55rem", fontWeight: 700, color: "#89948c", textTransform: "uppercase", mb: 1, letterSpacing: "0.5px" }}>
                          Team Lead
                        </Typography>
                        <CardActionArea
                          onClick={() => onAction("person", lead)}
                          sx={{ borderRadius: 1, p: 1, border: "1px solid #e5eae5", background: "#fff" }}
                        >
                          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                            <PhotoAvatar person={lead} size={38} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 600, fontSize: "0.7rem", color: "#202922", noWrap: true }}>
                                {lead.name}
                              </Typography>
                              <Typography sx={{ fontSize: "0.6rem", color: "#4b8060", fontWeight: 500, noWrap: true }}>
                                {lead.role}
                              </Typography>
                            </Box>
                            <Star sx={{ fontSize: 16, color: "#d4a373" }} />
                          </Stack>
                        </CardActionArea>
                      </Box>
                    )}

                    {/* Other Members Section */}
                    {otherMembers.length > 0 && (
                      <>
                        <Divider />
                        <Box sx={{ px: 1.5, py: 1.2 }}>
                          <Typography sx={{ fontSize: "0.55rem", fontWeight: 700, color: "#89948c", textTransform: "uppercase", mb: 0.8, letterSpacing: "0.5px" }}>
                            Members
                          </Typography>
                          <Stack spacing={0.5}>
                            {otherMembers.map((person) => (
                              <Box
                                key={person.id}
                                onClick={() => onAction("person", person)}
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                  p: 0.8,
                                  borderRadius: 1,
                                  cursor: "pointer",
                                  transition: "background 0.15s",
                                  "&:hover": { background: "#f5f8f4" },
                                }}
                              >
                                <PhotoAvatar person={person} size={24} />
                                <Typography sx={{ flex: 1, fontSize: "0.65rem", fontWeight: 500, color: "#39443c", noWrap: true }}>
                                  {person.name}
                                </Typography>
                                <Typography sx={{ fontSize: "0.6rem", color: "#89948c", noWrap: true }}>
                                  {person.role}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      </>
                    )}
                    
                    {/* Empty State fallback if no members */}
                    {members.length === 0 && (
                      <Box sx={{ p: 3, textAlign: "center" }}>
                        <Typography sx={{ fontSize: "0.65rem", color: "#89948c" }}>
                          No team members yet.
                        </Typography>
                      </Box>
                    )}
                  </Card>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    </>
  );
}