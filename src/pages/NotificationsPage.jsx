import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, ListItemButton, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { NotificationsNoneRounded } from "@mui/icons-material";
import { useStore } from "../store/AppStore.jsx";
import { PageHeader, SectionCard, EmptyState } from "../components/kit/UI.jsx";
import { fmtDateTime, timeAgo } from "../lib/utils.js";

export default function NotificationsPage({ embedded = false }) {
  const { data, user, markRead, markAllRead } = useStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const mine = data.notifications.filter((n) => n.to === user.code);
  const list = filter === "unread" ? mine.filter((n) => !n.read) : mine;
  return (
    <>
      {!embedded && <PageHeader
        title="Notifications"
        subtitle="Every change to your claims, accounts and approvals is posted here."
        actions={
          <Button variant="outlined" onClick={markAllRead} disabled={!mine.some((n) => !n.read)}>
            Mark all read
          </Button>
        }
      />}
      <SectionCard
        title={`${mine.filter((n) => !n.read).length} unread`}
        action={
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {embedded && <Button size="small" variant="outlined" onClick={markAllRead} disabled={!mine.some((n) => !n.read)}>Mark all read</Button>}
            <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="unread">Unread</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        }
        noPad
      >
        {list.length === 0 ? (
          <EmptyState icon={<NotificationsNoneRounded />} title="You're all caught up" text="New notifications appear here when something changes." />
        ) : (
          list.map((n) => (
            <ListItemButton
              key={n.id}
              divider
              onClick={() => {
                markRead(n.id);
                if (n.link) navigate(n.link);
              }}
              sx={{ gap: 1.5, alignItems: "flex-start", py: 1.5, bgcolor: n.read ? "transparent" : "accentSoft.main" }}
            >
              <Box sx={{ width: 8, height: 8, mt: 0.9, borderRadius: "50%", bgcolor: n.read ? "divider" : "primary.main", flexShrink: 0 }} />
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2">{n.text}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {timeAgo(n.at)} · {fmtDateTime(n.at)}
                </Typography>
              </Stack>
            </ListItemButton>
          ))
        )}
      </SectionCard>
    </>
  );
}
