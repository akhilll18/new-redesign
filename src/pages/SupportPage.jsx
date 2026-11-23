import React, { useState } from "react";
import {
  Box,
  Typography,
  Stack,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  NorthEast as ArrowUpRight,
  Description as FileText,
  Add as Plus,
  Search,
  TrackChanges as Target,
  Groups as UsersRound,
} from "@mui/icons-material";
import {
  Badge,
  Button,
  PageHeader,
  Panel,
  StatCard,
} from "../components/PortalUI.jsx";

import { SupportTatCard } from "./v106/SelfService.jsx";

export default function SupportPage({ tickets, onAction, onItSupport }) {
  const [query, setQuery] = useState("");
  const filtered = tickets.filter((ticket) =>
    `${ticket.id} ${ticket.subject} ${ticket.category}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <>
      <PageHeader
        eyebrow="HERE TO HELP"
        title="HR support"
        description="Get help with pay, benefits, time off or personal details."
        action={
          <Button id="hr-new-ticket" icon={Plus} onClick={() => onAction("ticket")}>
            New request
          </Button>
        }
      />

      {/* v10.6: one quick-response card with the TAT for HR (1 working hour) and IT (1 working day) — the repeated
          "Contact HR" / "Contact IT" banners were removed. */}
      <SupportTatCard />

      {/* ── Stats ─────────────────────────────────────── */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(3, 1fr)" },
          gap: 1.5,
          mb: 2,
        }}
      >
        <StatCard
          label="Your open requests"
          value={tickets.filter((t) => t.status !== "Resolved").length}
          note="Waiting for a response"
          icon={FileText}
          tone="orange"
        />
        <StatCard
          label="Resolved this month"
          value={tickets.filter((t) => t.status === "Resolved").length}
          note="Closed requests"
          icon={Target}
          tone="green"
        />
        <StatCard
          label="HR response time (TAT)"
          value="1 hour"
          note="Within working hours"
          icon={UsersRound}
          tone="blue"
        />
      </Box>

      {/* ── Requests table ────────────────────────────── */}
      <Panel
        title="Your requests"
        subtitle="Track the latest updates from the People team"
        action={
          <TextField
            placeholder="Search requests..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            size="small"
            sx={{
              width: { xs: 140, sm: 180 },
              "& .MuiOutlinedInput-root": {
                fontSize: "0.65rem",
                borderRadius: 1,
                "& fieldset": { borderColor: "#e5eae5" },
              },
              "& .MuiInputBase-input": { py: 0.7, px: 1 },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 15, color: "#8d9890" }} />
                </InputAdornment>
              ),
            }}
          />
        }
      >
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell>REQUEST</TableCell>
                <TableCell>CATEGORY</TableCell>
                <TableCell>SUBMITTED</TableCell>
                <TableCell>STATUS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((ticket) => (
                <TableRow key={ticket.id} sx={{ "&:hover": { background: "#fcfdfb" } }}>
                  <TableCell>
                    <Typography
                      sx={{ fontSize: "0.65rem", fontWeight: 600, color: "#354138" }}
                    >
                      {ticket.subject}
                    </Typography>
                    <Typography sx={{ fontSize: "0.6rem", color: "#8d978f", mt: 0.4 }}>
                      {ticket.id}
                    </Typography>
                  </TableCell>
                  <TableCell>{ticket.category}</TableCell>
                  <TableCell sx={{ color: "#78837b" }}>{ticket.created}</TableCell>
                  <TableCell>
                    <Badge
                      tone={
                        ticket.status === "Resolved"
                          ? "green"
                          : ticket.status === "In progress"
                          ? "blue"
                          : "orange"
                      }
                    >
                      {ticket.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filtered.length === 0 && (
            <Box
              sx={{
                py: 3.5,
                px: 2,
                textAlign: "center",
                color: "#849087",
                fontSize: "0.65rem",
              }}
            >
              No matching requests.
            </Box>
          )}
        </TableContainer>
      </Panel>

      {/* ── Bottom hint ───────────────────────────────── */}
      <Stack
        direction="row"
       
       
        sx={{ justifyContent: "space-between", alignItems: "center",
          mt: 1.6,
          p: "11px 13px",
          border: "1px solid #e7ebe6",
          borderRadius: 1,
          background: "#fff",
          color: "#7d887f",
          fontSize: "0.6rem",
        }}
      >
        <span>Looking for a policy or form?</span>
        <Box
          component="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("navigate-documents"))
          }
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            border: 0,
            background: "transparent",
            color: "#50745a",
            fontSize: "0.6rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Browse documents <ArrowUpRight sx={{ fontSize: 14 }} />
        </Box>
      </Stack>
    </>
  );
}