// Country mode. Admins and the Super Admin pick an operating country in the header ("All countries" = global);
// employees always work in their own country. The choice drives the Country workspace, the default country on
// Payroll / Compliance / Live location, and every AI prompt (see aiCountry.js).
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useStore } from "../store/AppStore.jsx";
import { packFor, countryOf, countriesIn } from "./countryPacks.js";
import { setAiCountry } from "./aiCountry.js";

const Ctx = createContext({ scope: "ALL", setScope: () => {}, country: "IN", region: null, pack: null, locked: false });

const keyFor = (code) => `onas-country-scope-${code || "anon"}`;
function read(code) {
  try {
    return localStorage.getItem(keyFor(code)) || "ALL";
  } catch {
    return "ALL";
  }
}

export function CountryProvider({ children }) {
  const { user, data } = useStore();
  const me = user?.role === "emp" ? data.employees.find((e) => e.employee_code === user.employee_code) : null;
  const locked = !!me;
  const [scope, setScopeState] = useState(() => read(user?.code));
  useEffect(() => setScopeState(read(user?.code)), [user?.code]);
  const setScope = (v) => {
    setScopeState(v);
    try {
      localStorage.setItem(keyFor(user?.code), v);
    } catch {
      /* storage disabled */
    }
  };
  // v10.4: HR / Finance admins work across all countries unless the Super Admin has enabled country switching for them.
  const noSwitch = user?.role === "admin" && !user.locale_access;
  const effective = locked ? countryOf(me) : noSwitch ? "ALL" : scope;
  const region = !locked && String(effective).startsWith("REGION:") ? effective.slice(7) : null;
  const country = effective === "ALL" || region ? null : effective;
  const pack = country ? packFor(country) : null;
  // Country that country-specific screens (payroll, compliance, live map) open on: the selected country,
  // or in region mode the first country of the region that has staff.
  const focusCountry = country || (region ? countriesIn(region).find((c) => data.employees.some((e) => e.status === "active" && countryOf(e) === c)) || countriesIn(region)[0] : null);
  useEffect(() => {
    setAiCountry(country, { role: user?.role, employeeCountry: me ? countryOf(me) : null, region });
  }, [country, region, user?.role, me]);
  const value = useMemo(() => ({ scope: locked ? country : scope, setScope, country, region, focusCountry, pack, locked }), [scope, country, region, focusCountry, pack, locked]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCountry() {
  return useContext(Ctx);
}

/** Pick the selected country if it is in `available`, otherwise the fallback. */
export function preferCountry(selected, available, fallback) {
  return selected && available.includes(selected) ? selected : fallback;
}

/**
 * Filter for "align the whole application to the selected country": true when the employee belongs to the
 * country (or region) chosen in the header. "All countries" lets everyone through. Employees are always locked to their own country.
 */
export function useCountryFilter() {
  const { country, region, locked } = useCountry();
  return useMemo(() => {
    if (locked || (!country && !region)) return () => true;
    if (country) return (e) => countryOf(e) === country;
    const set = new Set(countriesIn(region));
    return (e) => set.has(countryOf(e));
  }, [country, region, locked]);
}

/**
 * Country picker for country-specific screens. When a country is selected in the header the page is fixed to it and
 * its own country chips are hidden; with "All countries" (or a region) the page shows chips for the available countries.
 */
export function useCountryChoice(available, fallback) {
  const { country, region, focusCountry } = useCountry();
  const inRegion = region ? available.filter((c) => countriesIn(region).includes(c)) : available;
  const [picked, setPicked] = useState(null);
  // A country chosen in the header always wins, even when this page has no data for it (the page shows its empty state).
  const fixed = country || null;
  const value = fixed || (picked && inRegion.includes(picked) ? picked : preferCountry(focusCountry, inRegion, inRegion[0] || fallback || available[0]));
  return { value, setValue: setPicked, showChips: !country && inRegion.length > 1, options: inRegion, fixedTo: country || null };
}
