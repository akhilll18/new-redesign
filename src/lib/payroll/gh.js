// Ghana payroll engine — 2026. PAYE on chargeable income after SSNIT (revised resident bands from 1 September 2026),
// SSNIT 5.5% employee + 13% employer (Tier 1 13.5%, Tier 2 5%), insurable earnings GHS 587.80 – 69,000.
import { r2, clamp, slabTax, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: '2026 (revised PAYE bands from 1 Sep 2026)',
  bands: [[588, 0], [668, 0.05], [768, 0.10], [3668, 0.175], [19668, 0.25], [50000, 0.30], [Infinity, 0.35]],
  bandsBeforeSep2026: [[490, 0], [600, 0.05], [730, 0.10], [3896.67, 0.175], [19896.67, 0.25], [50416.67, 0.30], [Infinity, 0.35]],
  ssnit: { ee: 0.055, er: 0.13, min: 587.80, max: 69000 },
};

export const REGIONS = [['GA', 'Greater Accra'], ['AS', 'Ashanti'], ['WR', 'Western']];
export const PROFILE = [{ key: 'ghana_card', label: 'Ghana Card (PIN)', type: 'text', default: '' }, { key: 'ssnit_no', label: 'SSNIT number', type: 'text', default: '' }];

export function compute(e, ctx) {
  const g = e.gross;
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const base = clamp(earned, RATES.ssnit.min, RATES.ssnit.max), ssEE = r2(base * RATES.ssnit.ee), ssER = r2(base * RATES.ssnit.er);
  const chargeable = Math.max(0, earned - ssEE), revised = ctx.period >= '2026-09';
  const paye = r2(slabTax(chargeable, revised ? RATES.bands : RATES.bandsBeforeSep2026));
  const deductions = [['PAYE (GRA)', paye], ['SSNIT employee 5.5%', ssEE]];
  const employer = [['SSNIT employer 13%', ssER]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = ssER;
  return {
    currency: 'GHS', gross: g, earned,
    earnings: [['Basic salary', r2(g)], [`Unpaid leave (${lop})`, -lopDed], ['Overtime', ot]],
    deductions, employer, totalDeductions, employerTotal, net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Gross', earned], ['Less SSNIT 5.5%', -ssEE], ['Chargeable income', r2(chargeable)], [revised ? 'PAYE on revised bands (first GHS 588 at 0%)' : 'PAYE on previous bands', paye], ['SSNIT split', '13.5% Tier 1, 5% Tier 2']],
    notes: ['Qualifying overtime and bonuses (≤ 15% of basic) can be taxed at 5% final; not applied here.'],
  };
}

export function checks(e) {
  const out = [], p = e.profile || {};
  out.push(check('Ghana Card PIN', p.ghana_card ? 'pass' : 'fail', p.ghana_card ? 'Recorded.' : 'The Ghana Card PIN is the TIN for PAYE returns.', 'Income Tax Act 896', true));
  out.push(check('SSNIT registration', p.ssnit_no ? 'pass' : 'warn', p.ssnit_no ? 'Recorded.' : 'Register the employee with SSNIT and a Tier 2 trustee.', 'National Pensions Act 766'));
  out.push(check('National minimum wage', 'info', 'Check the daily minimum wage for 2026.', 'Labour Act 651'));
  return out;
}

export const policy = {
  'Working time': [['Hours', '8 h a day, 40 h a week'], ['Overtime', 'By agreement; junior staff overtime tax 5% / 10%'], ['Rest', '48 consecutive hours a week']],
  'Leave': [['Annual leave', '15 working days after 12 months'], ['Sick leave', 'By contract or collective agreement'], ['Maternity', '12 weeks paid']],
  'Pay & tax': [['PAYE', '0% – 35% monthly bands (revised Sep 2026)'], ['Due date', 'PAYE by the 15th; SSNIT by the 14th'], ['Annual return', 'By 31 March']],
  'Social security': [['SSNIT', '5.5% employee + 13% employer'], ['Tiers', '13.5% Tier 1 (SSNIT), 5% Tier 2'], ['Tier 3', 'Voluntary, deductible up to 16.5%']],
  'Employment terms': [['Notice', '1 month (3+ years), 2 weeks, or 1 week'], ['Redundancy', 'Negotiated; notify the Labour Department'], ['Contract', 'Written statement within 2 months']],
};

export function calendar(today) {
  return [
    ['SSNIT contributions', 'SSNIT', 'Monthly', monthlyDue(today, 14)],
    ['PAYE return & payment', 'Ghana Revenue Authority', 'Monthly', monthlyDue(today, 15)],
    ['Annual PAYE reconciliation', 'GRA', 'Annual', annualDue(today, 3, 31)],
  ];
}
