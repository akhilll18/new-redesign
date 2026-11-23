// Philippines payroll engine — 2026. Withholding tax (TRAIN graduated rates from 2023), SSS 15% (5% / 10%,
// MSC ₱4,000 – ₱35,000), PhilHealth 5% (₱10,000 – ₱100,000), Pag-IBIG 2% each (max fund salary ₱10,000).
import { r2, clamp, slabTax, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: '2026 (TRAIN 2023 table; SSS 15%; PhilHealth 5%)',
  tax: [[250000, 0], [400000, 0.15], [800000, 0.20], [2000000, 0.25], [8000000, 0.30], [Infinity, 0.35]],
  sss: { ee: 0.05, er: 0.10, minMsc: 4000, maxMsc: 35000 },
  philhealth: { rate: 0.05, floor: 10000, ceiling: 100000 },
  pagibig: { rate: 0.02, maxBase: 10000 },
  thirteenthExempt: 90000,
};

export const REGIONS = [['NCR', 'Metro Manila'], ['CEB', 'Cebu'], ['DAV', 'Davao']];
export const PROFILE = [{ key: 'tin', label: 'BIR TIN', type: 'text', default: '' }, { key: 'sss_no', label: 'SSS number', type: 'text', default: '' }];

export function compute(e, ctx) {
  const g = e.gross;
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const S = RATES.sss, msc = clamp(Math.round(earned / 500) * 500, S.minMsc, S.maxMsc);
  const sssEE = r2(msc * S.ee), sssER = r2(msc * S.er), ec = msc < 15000 ? 10 : 30;
  const ph = r2(clamp(earned, RATES.philhealth.floor, RATES.philhealth.ceiling) * RATES.philhealth.rate / 2);
  const hdmf = r2(Math.min(earned, RATES.pagibig.maxBase) * RATES.pagibig.rate);
  const taxableMonthly = earned - sssEE - ph - hdmf;
  const wtax = r2(slabTax(Math.max(0, taxableMonthly * 12), RATES.tax) / 12);
  const deductions = [['Withholding tax', wtax], ['SSS (5%)', sssEE], ['PhilHealth (2.5%)', ph], ['Pag-IBIG (2%)', hdmf]];
  const employer = [['SSS (10%)', sssER], ['SSS EC', ec], ['PhilHealth (2.5%)', ph], ['Pag-IBIG (2%)', hdmf], ['13th-month pay accrual', r2(g / 12)]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'PHP', gross: g, earned,
    earnings: [['Basic pay', r2(g)], [`Absences (${lop})`, -lopDed], ['Overtime (+25%)', ot]],
    deductions, employer, totalDeductions, employerTotal, net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Gross', earned], ['Less SSS, PhilHealth, Pag-IBIG', -r2(sssEE + ph + hdmf)], ['Taxable compensation', r2(taxableMonthly)], ['Annualised tax (0% to ₱250,000)', r2(wtax * 12)], ['SSS monthly salary credit', msc]],
    notes: ['13th-month pay is due by 24 December; up to ₱90,000 of it and other benefits is tax-exempt.', 'SSS includes the Mandatory Provident Fund portion for MSC above ₱20,000.'],
  };
}

export function checks(e) {
  const out = [], p = e.profile || {};
  out.push(check('BIR TIN', p.tin ? 'pass' : 'fail', p.tin ? 'Recorded.' : 'TIN needed for BIR Form 2316 and alphalist.', 'NIRC s.236', true));
  out.push(check('SSS number', p.sss_no ? 'pass' : 'warn', p.sss_no ? 'Recorded.' : 'Report the employee to SSS (R-1A) within 30 days.', 'Social Security Act 2018'));
  out.push(check('Regional minimum wage', 'info', 'Check the latest wage order for the region (e.g. NCR).', 'RTWPB wage orders'));
  return out;
}

export const policy = {
  'Working time': [['Hours', '8 h a day'], ['Overtime', '+25% normal days, +30% rest days / special days'], ['Night differential', '+10% between 22:00 and 06:00']],
  'Leave': [['Service incentive leave', '5 days with pay after 1 year'], ['Maternity / paternity', '105 days / 7 days'], ['Solo parent', '7 days a year']],
  'Pay & tax': [['Withholding', 'Graduated rates, 0% up to ₱250,000 a year'], ['13th month', 'One month’s basic by 24 December'], ['Form 2316', 'To employees by 31 January']],
  'Social security': [['SSS', '15%: 5% employee, 10% employer (MSC up to ₱35,000)'], ['PhilHealth', '5% shared, ₱10,000 – ₱100,000'], ['Pag-IBIG', '2% + 2% (max ₱200 each)']],
  'Employment terms': [['Notice', '30 days (resignation and authorised causes)'], ['Separation pay', '½ – 1 month per year by cause'], ['Probation', 'Up to 6 months']],
};

export function calendar(today) {
  return [
    ['Withholding tax (BIR 1601-C)', 'BIR', 'Monthly', monthlyDue(today, 10)],
    ['SSS contributions', 'SSS', 'Monthly', monthlyDue(today, 30)],
    ['PhilHealth & Pag-IBIG', 'PhilHealth / HDMF', 'Monthly', monthlyDue(today, 15)],
    ['13th-month pay', 'DOLE', 'Annual', annualDue(today, 12, 24)],
    ['Form 2316 to employees', 'BIR', 'Annual', annualDue(today, 1, 31)],
  ];
}
