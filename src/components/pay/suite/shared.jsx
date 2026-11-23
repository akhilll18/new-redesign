// Shared bits for the payroll suite: pay-group picker, donut chart, employee list dialog, small inputs.
import React from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import { useStore } from "../../../store/AppStore.jsx";
import { useCountry } from "../../../country/CountryContext.jsx";
import { ALL_GROUPS } from "../../../lib/payrollSuite.js";
import { TableWrap } from "../../kit/UI.jsx";

// Validated categorical order (dataviz reference palette, light mode). Slot 8 is reserved for "Other".
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];
export const OTHER = "#9aa39d";

export function canRunPayroll(user) {
  return user?.role === "superadmin" || (user?.role === "admin" && (user.modules || []).includes("payroll"));
}

/** Pay groups that have at least one active employee in scope. */
export function usePayGroups(employees) {
  const { data } = useStore();
  const present = new Set(employees.filter((e) => e.status === "active").map((e) => e.country_code || "IN"));
  return (data.paySettings?.payGroups || []).filter((g) => present.has(g.country) && g.status !== "inactive");
}

export function usePayGroupState(employees, allowAll = true) {
  const groups = usePayGroups(employees);
  const { focusCountry } = useCountry();
  const initial = () => groups.find((g) => g.country === focusCountry)?.id || groups.find((g) => g.country === "IN")?.id || groups[0]?.id || ALL_GROUPS;
  const [id, setId] = React.useState(initial);
  React.useEffect(() => {
    const g = groups.find((x) => x.country === focusCountry);
    if (g) setId(g.id);
  }, [focusCountry]); // eslint-disable-line react-hooks/exhaustive-deps
  const group = id === ALL_GROUPS ? ALL_GROUPS : groups.find((g) => g.id === id) || groups[0] || ALL_GROUPS;
  const picker = (
    <FormControl size="small" variant="standard" sx={{ minWidth: 240 }}>
      <Select value={group === ALL_GROUPS ? ALL_GROUPS : group.id} onChange={(e) => setId(e.target.value)} disableUnderline sx={{ fontSize: "1.35rem", fontWeight: 600 }} inputProps={{ "aria-label": "Pay group" }}>
        {allowAll && <MenuItem value={ALL_GROUPS}>All pay groups (₹)</MenuItem>}
        {groups.map((g) => <MenuItem key={g.id} value={g.id}>{g.name} ({g.currency})</MenuItem>)}
      </Select>
    </FormControl>
  );
  return { group, groups, picker, currency: group === ALL_GROUPS ? "INR" : group.currency, inInr: group === ALL_GROUPS };
}

/** Donut with a legend table. Slices beyond seven fold into "Other". Hover shows the value. */
export function Donut({ data, format, size = 168, total: totalLabel = "Total" }) {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 7).map((d, i) => ({ ...d, color: SERIES[i] }));
  const rest = sorted.slice(7);
  if (rest.length) top.push({ label: `Other (${rest.length})`, value: rest.reduce((s, d) => s + d.value, 0), color: OTHER });
  const total = top.reduce((s, d) => s + d.value, 0);
  const R = size / 2, r = R * 0.62, gap = top.length > 1 ? 0.012 : 0;
  let a0 = -Math.PI / 2;
  const arcs = top.map((d) => {
    const sweep = (d.value / Math.max(1, total)) * Math.PI * 2;
    const s = a0 + gap, e = a0 + sweep - gap;
    a0 += sweep;
    const big = e - s > Math.PI ? 1 : 0;
    const p = (ang, rad) => [R + rad * Math.cos(ang), R + rad * Math.sin(ang)];
    const [x1, y1] = p(s, R), [x2, y2] = p(e, R), [x3, y3] = p(e, r), [x4, y4] = p(s, r);
    const path = top.length === 1 ? null : `M${x1},${y1} A${R},${R} 0 ${big} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${big} 0 ${x4},${y4} Z`;
    return { ...d, path };
  });
  if (!total) return <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>No payroll in this period.</Typography>;
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} sx={{ alignItems: "center" }}>
      <Box sx={{ position: "relative", width: size, height: size, flex: "none" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribution chart">
          {arcs.map((d) => (
            <Tooltip key={d.label} title={`${d.label}: ${format(d.value)} (${((d.value / total) * 100).toFixed(1)}%)`} followCursor>
              {d.path ? <path d={d.path} fill={d.color} stroke="#fff" strokeWidth="2" /> : <circle cx={R} cy={R} r={(R + r) / 2} fill="none" stroke={d.color} strokeWidth={R - r} />}
            </Tooltip>
          ))}
        </svg>
        <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <Typography variant="caption" color="text.secondary">{totalLabel}</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", fontVariantNumeric: "tabular-nums" }}>{format(total)}</Typography>
        </Box>
      </Box>
      <Stack spacing={0.6} sx={{ flex: 1, minWidth: 0, width: "100%" }}>
        {top.map((d) => (
          <Stack key={d.label} direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: d.color, flex: "none" }} />
            <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>{d.label}</Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", color: "text.secondary" }}>{((d.value / total) * 100).toFixed(1)}%</Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 92, textAlign: "right" }}>{format(d.value)}</Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

/** Simple list dialog used by "View employees". */
export function ListDialog({ open, title, subtitle, columns, rows, onClose, actions }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {title}
        {subtitle && <Typography variant="caption" component="div" color="text.secondary">{subtitle}</Typography>}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {rows.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Nobody in this list.</Typography> : (
          <TableWrap>
            <Table size="small">
              <TableHead><TableRow>{columns.map((c) => <TableCell key={c[0]} align={c[2] || "left"}>{c[0]}</TableCell>)}</TableRow></TableHead>
              <TableBody>{rows.map((r, i) => <TableRow key={i}>{columns.map((c) => <TableCell key={c[0]} align={c[2] || "left"}>{c[1](r)}</TableCell>)}</TableRow>)}</TableBody>
            </Table>
          </TableWrap>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        {actions}
        <Button onClick={onClose} color="inherit">Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export function Note({ children }) {
  return <Typography variant="caption" color="text.secondary" component="div" sx={{ p: 1.5 }}>{children}</Typography>;
}

export function ReadOnlyHint() {
  return <Typography variant="caption" color="text.secondary">View only: you need the payroll module to make changes.</Typography>;
}
