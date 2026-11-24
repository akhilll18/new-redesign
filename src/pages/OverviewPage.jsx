import React, { useState } from "react";
import { useStore } from "../store/AppStore.jsx";
import { isZeroLeaveWorker } from "../lib/statutory.js";
import { TodayMeetingsDialog, useMeetingsBox } from "../components/collab/TodayMeetings.jsx";
import { Box, Typography, Stack } from "@mui/material";
import {
  SouthEast as ArrowDownRight,
  NorthEast as ArrowUpRight,
  CalendarMonth as CalendarDays,
  Check,
  AccessTime as Clock3,
  Description as FileText,
  AutoAwesome as Sparkles,
  Groups as UsersRound,
  AccountBalanceWallet as WalletCards,
  EventAvailable,
  Groups as MeetingsIcon,
} from "@mui/icons-material";
import { holidays } from "../data/peopleHubData.js";
import HoursRangeCard from "../components/workforce/HoursRangeCard.jsx";
import { theme } from "../theme.js";
import { designTokens } from "../theme/muiTheme.js";
import {
  Avatar,
  Button,
  ChevronAction,
  Panel,
  StatCard,
} from "../components/PortalUI.jsx";

const { color, shadow } = designTokens;

const tasks = [
  {
    title: "Complete your profile",
    detail: "Add an emergency contact",
    icon: UsersRound,
    route: "people",
    status: "5 min",
  },
  {
    title: "Review your leave requests",
    detail: "Check the status of time away",
    icon: CalendarDays,
    route: "timeoff",
    status: "View requests",
  },
  {
    title: "Read the updated handbook",
    detail: "People policies · Updated Sep 12",
    icon: FileText,
    route: "documents",
    status: "New",
  },
];

function formatClockTime(value) {
  return value
    ? new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "--:--";
}

export default function OverviewPage({
  onNavigate,
  onAction,
  checkedIn,
  onToggle,
  employeeCount,
  pendingLeaves,
  departmentCount = 0,
  attendanceRecords = [],
}) {
  const { data, user, leaveBalanceOf } = useStore();
  const [mtgOpen, setMtgOpen] = useState(false);
  const mtg = useMeetingsBox();
  const meRec = data.employees.find((e) => e.employee_code === user.employee_code);
  const zeroLeave = isZeroLeaveWorker(meRec, data.settings);
  const paidLeft = zeroLeave ? 0 : leaveBalanceOf(user.employee_code).filter((b) => b.available != null).reduce((s, b) => s + b.available, 0);
  const hour = new Date().getHours();
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const upcomingHoliday = holidays
    .map((holiday) => ({ ...holiday, dateValue: new Date(`${holiday.date} 12:00:00`) }))
    .filter((holiday) => holiday.dateValue >= new Date())
    .sort((first, second) => first.dateValue - second.dateValue)[0];

  const todayEntries = attendanceRecords.filter(r => {
    const d = new Date(r.timestamp);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return (
    <>
      {/* Welcome banner */}
      <Panel
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          minHeight: 198,
          alignItems: "center",
          justifyContent: "space-between",
          overflow: "hidden",
          p: { xs: 2.5, md: "30px 36px" },
          border: `1px solid ${color.border}`,
          borderRadius: "14px",
          background: "radial-gradient(ellipse at 78% 125%, rgba(113,151,108,0.42) 0, transparent 42%), linear-gradient(112deg, #234d3d 0%, #315f49 57%, #466d50 100%)",
          color: "#ffffff",
          boxShadow: shadow,
        }}
      >
        <Box sx={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
            <Box
              sx={{
                width: 22,
                height: 22,
                border: `1px solid ${color.border}`,
                borderRadius: 1,
                background: color.accent,
                color: "#ffffff",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Sparkles sx={{ fontSize: 14 }} />
            </Box>
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.08em",
                color: "#ffffff",
              }}
            >
              {todayLabel.toUpperCase()}
            </Typography>
          </Stack>

          <Typography sx={{ fontSize: 13, fontWeight: 500, color: "#ffffff" }}>
            {greeting},
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 24, lineHeight: 1.15, color: "#ffffff", mb: 0.6 }}>
            {theme.currentUser.shortName}
            <Box component="span" sx={{ color: color.accent }}>.</Box>
          </Typography>

          <Typography sx={{ fontSize: 14, color: "#f8faf7", mb: 2.5 }}>
            Your workday, your people, all in one place.
          </Typography>

          {/* Today's Entries Chips in Banner */}
          <Box
            sx={{
              display: "flex",
              gap: 1,
              overflowX: "auto",
              pb: 1,
              "&::-webkit-scrollbar": { height: 6 },
              "&::-webkit-scrollbar-track": { background: "transparent" },
              "&::-webkit-scrollbar-thumb": { background: color.borderStrong, borderRadius: 3 },
            }}
          >
            {todayEntries.length > 0 ? (
              todayEntries.map((record) => {
                const isIn = record.type.toLowerCase().includes("in");
                return (
                  <Box
                    key={record.id}
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.8,
                      px: 1.2,
                      py: 0.5,
                      borderRadius: 1,
                      background: color.card,
                      border: `1px solid ${isIn ? color.successSoft : color.dangerSoft}`,
                      color: isIn ? color.success : color.danger,
                      fontSize: 12,
                      fontWeight: 600,
                      boxShadow: shadow,
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: isIn ? color.success : color.danger,
                      }}
                    />
                    {formatClockTime(record.timestamp)}
                  </Box>
                );
              })
            ) : (
              <Typography sx={{ fontSize: 13, color: "#f8faf7", fontStyle: "italic" }}>
                No entries yet today.
              </Typography>
            )}
          </Box>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
         
          spacing={2}
          sx={{ alignItems: "center",
            position: "relative",
            zIndex: 1,
            mt: { xs: 2, sm: 0 },
            ml: { sm: 2.5 },
            pl: { sm: 2.5 },
            pt: { xs: 1.5, sm: 0 },
            borderLeft: { sm: `1px solid ${color.border}` },
            borderTop: { xs: `1px solid ${color.border}`, sm: "none" },
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              position: "relative",
              display: "grid",
              width: 104,
              height: 104,
              placeItems: "center",
              "& .MuiAvatar-root": {
                boxShadow: `0 0 0 5px ${color.lightSage}, 0 0 0 10px ${color.paleSage}`,
                border: "2px solid #ffffff",
              },
            }}
          >
            <Avatar name={theme.currentUser.name} size="large" />
          </Box>

          <Stack spacing={1.2} sx={{ alignItems: { xs: "center", sm: "flex-start" } }}>
            <Stack direction="row" spacing={0.8} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: checkedIn ? color.lightSage : color.accent,
                }}
              />
              <Typography sx={{ fontSize: 13, color: "#ffffff" }}>
                {checkedIn ? "You're checked in" : "Ready when you are"}
              </Typography>
            </Stack>
            
            {/* THE BUTTONS */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={0.7}>
              <Button
                variant="primary"
                color="success"
                icon={Clock3} 
                disabled={checkedIn} 
                onClick={onToggle} 
                sx={{ whiteSpace: "nowrap", minWidth: "max-content" }}
              >
                Tap in
              </Button>
              
              <Button
                variant="secondary"
                color="error"
                icon={Check} 
                disabled={!checkedIn} 
                onClick={onToggle} 
                sx={{ whiteSpace: "nowrap", minWidth: "max-content", color: color.danger, borderColor: color.danger, "&:hover": { backgroundColor: color.dangerSoft, borderColor: color.dangerDeep } }}
              >
                Tap out
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Panel>

      {/* Section intro */}
      <Stack
        direction="row"
       
       
        sx={{ justifyContent: "space-between", alignItems: "flex-end", mt: 3.5, mb: 1.4 }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: color.secondaryText,
              mb: 0.4,
            }}
          >
            {todayLabel.split(",")[0].toUpperCase()} SNAPSHOT
          </Typography>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: 16,
              color: color.text,
            }}
          >
            Your overview
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: color.success,
              boxShadow: `0 0 0 3px ${color.successSoft}`,
            }}
          />
          <Typography sx={{ fontSize: 12, color: color.secondaryText }}>
            Updated just now
          </Typography>
        </Stack>
      </Stack>

      {/* Stats grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            sm: "repeat(3, minmax(0, 1fr))",
            lg: "repeat(5, minmax(0, 1fr))",
            xl: "repeat(5, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        <StatCard
          label="Team members"
          value={employeeCount}
          note={`Across ${departmentCount || 0} departments`}
          icon={UsersRound}
          tone="green"
          onClick={() => onNavigate("people")}
        />
        <StatCard
          label="Request leave"
          value={`${paidLeft} days`}
          note={zeroLeave ? "Request-level leave only" : "Available balance"}
          icon={CalendarDays}
          tone="orange"
          onClick={() => onNavigate("timeoff")}
        />
        <StatCard
          label="Next payday"
          value="Oct 30"
          note="October payroll"
          icon={WalletCards}
          tone="blue"
          onClick={() => onNavigate("pay")}
        />
        <StatCard
          label="Upcoming holiday"
          value={upcomingHoliday ? upcomingHoliday.dateValue.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "--"}
          note={upcomingHoliday ? upcomingHoliday.name : "No upcoming holidays"}
          icon={EventAvailable}
          tone="blue"
        />
        <StatCard
          label="Open requests"
          value={String(pendingLeaves).padStart(2, "0")}
          note="Leave awaiting review"
          icon={Clock3}
          tone="rose"
          onClick={() => onNavigate("timeoff")}
        />
        <StatCard
          label="Meetings today"
          value={String(mtg.count).padStart(2, "0")}
          note={mtg.note}
          icon={MeetingsIcon}
          tone="green"
          onClick={() => setMtgOpen(true)}
        />
      </Box>
      <TodayMeetingsDialog open={mtgOpen} onClose={() => setMtgOpen(false)} />

      {/* Row 1 */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1.1fr" },
          gap: 1.6,
          mt: 1.6,
        }}
      >
        <HoursRangeCard />

        <Panel
          title="Coming up"
          subtitle="A few things on your radar"
          action={
            <ChevronAction onClick={() => onNavigate("timeoff")}>
              View requests
            </ChevronAction>
          }
        >
          <Box sx={{ px: 1.5, pb: 0.5 }}>
            {tasks.map((task, i) => {
              const Icon = task.icon;
              return (
                <Box
                  key={task.title}
                  onClick={() => onNavigate(task.route)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.1,
                    py: 1.2,
                    px: 0.2,
                    borderBottom: i < tasks.length - 1 ? `1px solid ${color.border}` : "none",
                    cursor: "pointer",
                    "&:hover .task-title": { color: "primary.main" },
                    "&:hover .task-arrow": { color: "primary.main" },
                  }}
                >
                  <Box
                    sx={{
                      width: 29,
                      height: 29,
                      borderRadius: 1,
                      background: color.primarySoft,
                      color: color.primary,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 16 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      className="task-title"
                      sx={{
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        color: color.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        transition: "color 0.15s",
                      }}
                    >
                      {task.title}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.6rem",
                        color: color.secondaryText,
                        mt: 0.4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {task.detail}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{ fontSize: 12, color: color.secondaryText, whiteSpace: "nowrap" }}
                  >
                    {task.status}
                  </Typography>
                  <ArrowUpRight
                    className="task-arrow"
                    sx={{
                      fontSize: 15,
                      color: color.mutedText,
                      flexShrink: 0,
                      transition: "color 0.15s",
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </Panel>
      </Box>

      {/* Row 2 */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "0.92fr 1.08fr" },
          gap: 1.6,
          mt: 1.6,
        }}
      >
        <Panel title="Quick links" subtitle="The things you do most">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
              p: 1.5,
            }}
          >
            {[
              {
                label: "Request time off",
                icon: CalendarDays,
                onClick: () => onAction("leave"),
                bg: color.primarySoft,
                color: color.primary,
              },
              {
                label: "View pay details",
                icon: WalletCards,
                onClick: () => onNavigate("pay"),
                bg: color.primarySoft,
                color: color.primary,
              },
              {
                label: "Find a teammate",
                icon: UsersRound,
                onClick: () => onNavigate("people"),
                bg: color.primarySoft,
                color: color.primary,
              },
              {
                label: "Contact HR",
                icon: FileText,
                onClick: () => onNavigate("support"),
                bg: color.primarySoft,
                color: color.primary,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Box
                  key={item.label}
                  onClick={item.onClick}
                  sx={{
                    display: "flex",
                    minHeight: 55,
                    alignItems: "center",
                    gap: 1,
                    p: 1,
                    border: `1px solid ${color.border}`,
                    borderRadius: 1,
                    background: color.card,
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                    "&:hover": { borderColor: color.borderStrong, background: color.muted },
                  }}
                >
                  <Box
                    sx={{
                      width: 31,
                      height: 31,
                      borderRadius: 1,
                      background: item.bg,
                      color: item.color,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 17 }} />
                  </Box>
                  <Typography
                    sx={{ flex: 1, fontSize: 12, fontWeight: 600, color: color.text }}
                  >
                    {item.label}
                  </Typography>
                  <ArrowUpRight sx={{ fontSize: 14, color: color.mutedText }} />
                </Box>
              );
            })}
          </Box>
        </Panel>

        <Panel
          title="From the People team"
          subtitle="Company notes for you"
          action={
            <ChevronAction onClick={() => onNavigate("documents")}>
              All updates
            </ChevronAction>
          }
        >
          {[
            {
              day: "12",
              month: "OCT",
              title: "October payroll calendar",
              detail: "Timesheets close Friday, October 23.",
              muted: false,
            },
            {
              day: "09",
              month: "OCT",
              title: "Mid-year check-in is open",
              detail: "Set aside a few minutes to reflect and plan.",
              muted: true,
            },
          ].map((a, i) => (
            <Box
              key={a.title}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.2,
                p: "11px 15px",
                borderBottom: i === 0 ? `1px solid ${color.border}` : "none",
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 39,
                  border: `1px solid ${color.border}`,
                  borderRadius: 0.6,
                  background: color.primarySoft,
                  color: a.muted ? color.mutedText : color.primary,
                  display: "grid",
                  alignContent: "center",
                  justifyItems: "center",
                  flexShrink: 0,
                }}
              >
                <Typography
                  sx={{  fontWeight: 700, fontSize: "0.85rem" }}
                >
                  {a.day}
                </Typography>
                <Typography sx={{ fontSize: "0.45rem", fontWeight: 700, mt: 0.1 }}>
                  {a.month}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.65rem", fontWeight: 600 }}>
                  {a.title}
                </Typography>
                <Typography sx={{ fontSize: 12, color: color.secondaryText, mt: 0.4 }}>
                  {a.detail}
                </Typography>
              </Box>
              <ArrowDownRight sx={{ fontSize: 16, color: color.mutedText, flexShrink: 0 }} />
            </Box>
          ))}
        </Panel>
      </Box>
    </>
  );
}