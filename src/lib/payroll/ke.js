// Kenya payroll engine — 2026.
// Income Tax Act Cap 470 (PAYE, KRA) · NSSF Act 2013 (year 4 rates from February 2026) · Social Health Insurance Act 2023 (SHIF) ·
// Affordable Housing Act 2024 (AHL) · Employment Act 2007 · Industrial Training Act (NITA levy).
import { r2, clamp, slabTax, yearsBetween, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: '2026 (NSSF year 4 limits from Feb 2026)',
  tax: { monthlySlabs: [[24000, 0.10], [32333, 0.25], [500000, 0.30], [800000, 0.325], [Infinity, 0.35]], personalRelief: 2400 },
  nssf: { rate: 0.06, lel: 9000, uel: 108000 },
  shif: { rate: 0.0275, min: 300 },
  ahl: { ee: 0.015, er: 0.015 },
  nita: 50,                          // employer, per employee per month
  structure: { basic: 0.85, house: 0.15 },
  maxWeekHours: 52,
  overtime: { weekday: 1.5, restDay: 2 },
};

export const REGIONS = [['NBO', 'Nairobi'], ['MSA', 'Mombasa'], ['KSM', 'Kisumu'], ['NKR', 'Nakuru']];
export const PROFILE = [
  { key: 'kra_pin', label: 'KRA PIN', type: 'text', default: '' },
  { key: 'nssf_no', label: 'NSSF number', type: 'text', default: '' },
  { key: 'sha_no', label: 'SHA / SHIF number', type: 'text', default: '' },
];

export function nssf(pay) {
  const N = RATES.nssf, pensionable = clamp(pay, 0, N.uel);
  const tier1 = Math.min(pensionable, N.lel) * N.rate, tier2 = Math.max(0, pensionable - N.lel) * N.rate;
  return { tier1: r2(tier1), tier2: r2(tier2), total: r2(tier1 + tier2) };
}

export function compute(e, ctx) {
  const g = e.gross, S = RATES.structure;
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const ns = nssf(earned), shif = r2(Math.max(RATES.shif.min, earned * RATES.shif.rate)), ahl = r2(earned * RATES.ahl.ee);
  const taxable = Math.max(0, earned - ns.total - shif - ahl);
  const taxBefore = slabTax(taxable, RATES.tax.monthlySlabs), paye = r2(Math.max(0, taxBefore - RATES.tax.personalRelief));
  const deductions = [['PAYE (KRA)', paye], ['NSSF Tier I (6%)', ns.tier1], ['NSSF Tier II (6%)', ns.tier2], ['SHIF (2.75%)', shif], ['Affordable Housing Levy (1.5%)', ahl]];
  const employer = [['NSSF employer match', ns.total], ['Housing Levy employer (1.5%)', r2(earned * RATES.ahl.er)], ['NITA levy', RATES.nita]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'KES', gross: g, earned,
    earnings: [['Basic salary (85%)', r2(g * S.basic)], ['House allowance (15%)', r2(g * S.house)], [`Unpaid leave (${lop} day${lop === 1 ? '' : 's'})`, -lopDed], ['Overtime (1.5× / 2×)', ot]],
    deductions, employer, totalDeductions, employerTotal,
    net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Gross pay', earned], ['Less NSSF', -ns.total], ['Less SHIF', -shif], ['Less Housing Levy', -ahl], ['Taxable pay', r2(taxable)],
      ['Tax on monthly bands', r2(taxBefore)], ['Personal relief', -RATES.tax.personalRelief], ['PAYE', paye]],
    notes: ['NSSF, SHIF and the Housing Levy are deducted before PAYE (Tax Laws (Amendment) Act 2024).', 'NSSF year-4 limits: lower KES 9,000, upper KES 108,000 (max KES 6,480 each side).'],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {};
  out.push(check('KRA PIN', p.kra_pin ? 'pass' : 'fail', p.kra_pin ? `PIN ${p.kra_pin}.` : 'A KRA PIN is required to file PAYE (P10) for this employee.', 'Tax Procedures Act 2015', true));
  out.push(check('NSSF registration', p.nssf_no ? 'pass' : 'warn', p.nssf_no ? `NSSF ${p.nssf_no}.` : 'Record the NSSF number.', 'NSSF Act 2013'));
  out.push(check('SHA registration', p.sha_no ? 'pass' : 'warn', p.sha_no ? `SHA ${p.sha_no}.` : 'Register the employee with the Social Health Authority.', 'Social Health Insurance Act 2023'));
  if (ctx.weeklyHours != null) out.push(check('Weekly hours ≤ 52', ctx.weeklyHours <= RATES.maxWeekHours ? 'pass' : 'warn', `${ctx.weeklyHours.toFixed(1)} h.`, 'Regulation of Wages (General) Order'));
  out.push(check('Minimum wage', 'info', 'Check the gazetted minimum for the occupation and town (Regulation of Wages Orders).', 'Labour Institutions Act 2007'));
  out.push(check('Annual leave', 'pass', '21 working days with full pay after 12 consecutive months.', 'Employment Act 2007, s.28'));
  const tenure = yearsBetween(e.doj, ctx.today);
  out.push(check('Service pay / severance', 'info', tenure >= 1 ? 'Redundancy: at least 15 days’ pay per completed year.' : 'Severance applies after one year’s service.', 'Employment Act 2007, s.40'));
  return out;
}

export const policy = {
  'Working time': [['Normal hours', '52 hours a week (general order); 60 for night work'], ['Overtime', '1.5× normal days, 2× rest days and public holidays'], ['Rest', 'At least one rest day in every 7 days']],
  'Leave': [['Annual leave', '21 working days after 12 months'], ['Sick leave', '7 days full pay, then 7 days half pay (after 2 months’ service)'], ['Maternity / paternity', '3 months maternity; 2 weeks paternity, full pay']],
  'Pay & tax': [['PAYE', 'Monthly bands 10% – 35%; personal relief KES 2,400'], ['Due date', 'PAYE, NSSF, SHIF, Housing Levy and NITA by the 9th of the next month'], ['Annual', 'P9 forms to employees by end of February']],
  'Social security': [['NSSF', '6% employee + 6% employer up to KES 108,000'], ['SHIF', '2.75% of gross (min KES 300), employee'], ['Housing Levy', '1.5% employee + 1.5% employer']],
  'Employment terms': [['Notice', '28 days for monthly-paid staff, or pay in lieu'], ['Redundancy', '1 month’s notice to employee and labour officer; 15 days’ pay per year'], ['Probation', 'Up to 6 months (can extend to 12 with consent)']],
};

export function calendar(today) {
  return [
    ['PAYE (P10) return & payment', 'Kenya Revenue Authority', 'Monthly', monthlyDue(today, 9)],
    ['NSSF contributions', 'NSSF', 'Monthly', monthlyDue(today, 9)],
    ['SHIF contributions', 'Social Health Authority', 'Monthly', monthlyDue(today, 9)],
    ['Affordable Housing Levy', 'KRA', 'Monthly', monthlyDue(today, 9)],
    ['NITA levy', 'National Industrial Training Authority', 'Monthly', monthlyDue(today, 9)],
    ['P9 certificates to employees', 'KRA', 'Annual', annualDue(today, 2, 28)],
  ];
}
