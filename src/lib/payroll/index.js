// Country payroll registry. Each engine exports RATES, REGIONS, PROFILE, compute(), checks(), policy, calendar().
// To add a country: create xx.js with the same exports and register it below.
import * as IN from './in.js';
import * as GB from './gb.js';
import * as US from './us.js';
import * as AE from './ae.js';
import * as SG from './sg.js';
// ONAS: African country engines
import * as NA from './na.js';
import * as ZA from './za.js';
import * as KE from './ke.js';
import * as NG from './ng.js';
import * as BW from './bw.js';
// ONAS: AMER, EMEA, ASIA and more AFRICA engines
import * as CA from './ca.js';
import * as MX from './mx.js';
import * as BR from './br.js';
import * as DE from './de.js';
import * as FR from './fr.js';
import * as IE from './ie.js';
import * as SA from './sa.js';
import * as MY from './my.js';
import * as PH from './ph.js';
import * as ID from './id.js';
import * as GH from './gh.js';
import * as ZM from './zm.js';
import { D } from './common.js';

export const COUNTRIES = {
  IN: { name: 'India', currency: 'INR', engine: IN },
  GB: { name: 'United Kingdom', currency: 'GBP', engine: GB },
  US: { name: 'United States', currency: 'USD', engine: US },
  AE: { name: 'United Arab Emirates', currency: 'AED', engine: AE },
  SG: { name: 'Singapore', currency: 'SGD', engine: SG },
  NA: { name: 'Namibia', currency: 'NAD', engine: NA },
  ZA: { name: 'South Africa', currency: 'ZAR', engine: ZA },
  KE: { name: 'Kenya', currency: 'KES', engine: KE },
  NG: { name: 'Nigeria', currency: 'NGN', engine: NG },
  BW: { name: 'Botswana', currency: 'BWP', engine: BW },
  CA: { name: 'Canada', currency: 'CAD', engine: CA },
  MX: { name: 'Mexico', currency: 'MXN', engine: MX },
  BR: { name: 'Brazil', currency: 'BRL', engine: BR },
  DE: { name: 'Germany', currency: 'EUR', engine: DE },
  FR: { name: 'France', currency: 'EUR', engine: FR },
  IE: { name: 'Ireland', currency: 'EUR', engine: IE },
  SA: { name: 'Saudi Arabia', currency: 'SAR', engine: SA },
  MY: { name: 'Malaysia', currency: 'MYR', engine: MY },
  PH: { name: 'Philippines', currency: 'PHP', engine: PH },
  ID: { name: 'Indonesia', currency: 'IDR', engine: ID },
  GH: { name: 'Ghana', currency: 'GHS', engine: GH },
  ZM: { name: 'Zambia', currency: 'ZMW', engine: ZM },
};

export const engineFor = code => COUNTRIES[code]?.engine;

/** Standard context for a pay period. */
export function periodContext(today, extra = {}) {
  const t = D(today), period = today.slice(0, 7);
  return { today, period, daysInMonth: new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(), lopDays: 0, otPay: 0, ...extra };
}

export function computePay(emp, ctx) {
  const eng = engineFor(emp.ctry);
  if (!eng) throw new Error(`No payroll engine for country ${emp.ctry}`);
  return eng.compute(emp, ctx);
}

export function complianceChecks(emp, ctx) {
  const eng = engineFor(emp.ctry);
  return eng ? eng.checks(emp, ctx) : [{ rule: 'Payroll engine', status: 'fail', detail: `No rules for ${emp.ctry}.`, law: '' }];
}

export function filingCalendar(code, today) {
  return engineFor(code).calendar(today).map(([name, authority, freq, due]) => ({
    name, authority, freq, due, daysLeft: Math.round((D(due) - D(today)) / 864e5),
  }));
}

// Adapter: PeopleHub employee master record → the shape the Sahayog engines expect.
export function toEngineEmp(e) {
  return {
    id: e.employee_code,
    name: e.full_name,
    ctry: e.country_code || 'IN',
    gross: Number(e.monthly_gross) || 0,
    region: e.region || '',
    g: e.gender,
    doj: e.date_of_joining,
    dob: e.date_of_birth,
    grade: e.grade_code,
    profile: e.payroll_profile || {},
  };
}
