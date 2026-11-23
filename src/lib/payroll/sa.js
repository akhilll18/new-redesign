// Saudi Arabia payroll engine — 2026. No personal income tax. GOSI on basic + housing (cap SAR 45,000):
// Saudi nationals (legacy or registered from 3 July 2024 with the phased annuity increase), expatriates 2% employer.
// End-of-service award accrual for all staff (Labor Law Art. 84).
import { r2, clamp, yearsBetween, monthlyDue, lastWorkingDay, check } from './common.js';

export const RATES = {
  effective: '2026 (GOSI; new-system annuity +0.5% each from 1 Jul 2026)',
  structure: { basic: 0.65, housing: 0.25, transport: 0.10 },
  gosi: { floor: 1500, cap: 45000, annuity: 0.09, annuityNewBefore202607: 0.095, annuityNew: 0.10, saned: 0.0075, hazards: 0.02 },
};

export const REGIONS = [['RUH', 'Riyadh'], ['JED', 'Jeddah'], ['DMM', 'Dammam']];
export const PROFILE = [
  { key: 'national', label: 'Nationality', options: [['expat', 'Expatriate'], ['saudi_legacy', 'Saudi (GOSI before 3 Jul 2024)'], ['saudi_new', 'Saudi (GOSI from 3 Jul 2024)']], default: 'expat' },
  { key: 'iqama', label: 'Iqama / national ID', type: 'text', default: '' },
];

export function compute(e, ctx) {
  const g = e.gross, S = RATES.structure, p = e.profile || {}, G = RATES.gosi;
  const basic = g * S.basic, housing = g * S.housing, transport = g - basic - housing;
  const base = clamp(basic + housing, G.floor, G.cap), nat = p.national || 'expat', saudi = nat !== 'expat';
  const annuity = nat === 'saudi_new' ? (ctx.period >= '2026-07' ? G.annuityNew : G.annuityNewBefore202607) : G.annuity;
  const gEE = saudi ? r2(base * (annuity + G.saned)) : 0;
  const gER = r2(base * ((saudi ? annuity + G.saned : 0) + G.hazards));
  const tenure = yearsBetween(e.doj, ctx.today);
  const eos = r2(basic * (tenure >= 5 ? 1 : 0.5) / 12);
  const deductions = [['GOSI (annuity + SANED)', gEE]];
  const employer = [[saudi ? 'GOSI employer (annuity, SANED, hazards)' : 'GOSI occupational hazards 2%', gER], ['End-of-service award accrual', eos]];
  const totalDeductions = gEE, employerTotal = r2(gER + eos);
  return {
    currency: 'SAR', gross: g, earned: g,
    earnings: [['Basic (65%)', r2(basic)], ['Housing allowance (25%)', r2(housing)], ['Transport allowance (10%)', r2(transport)]],
    deductions, employer, totalDeductions, employerTotal, net: r2(g - gEE), cost: r2(g + employerTotal),
    steps: [['GOSI base: basic + housing (SAR 1,500 – 45,000)', r2(base)], ['Annuity rate', `${(annuity * 100).toFixed(1)}% each`], ['Service', `${tenure.toFixed(1)} years`], ['EOS: ½ month per year (first 5), 1 month after', eos]],
    notes: ['No personal income tax in Saudi Arabia.', saudi ? 'Saudi national: counts toward Nitaqat Saudisation.' : 'Expatriate: no employee GOSI; Iqama and work permit fees are separate.'],
  };
}

export function checks(e) {
  const out = [], p = e.profile || {};
  out.push(check('Iqama / national ID', p.iqama ? 'pass' : 'fail', p.iqama ? 'Recorded.' : 'Required for GOSI and the Wage Protection System (Mudad).', 'Labor Law; WPS', true));
  out.push(check('Nationality for GOSI', p.national ? 'pass' : 'warn', p.national ? 'Set.' : 'Set nationality and GOSI registration date to apply the right rates.', 'Social Insurance Law 2024'));
  out.push(check('Mudad / WPS', 'info', 'Upload the payroll file to Mudad each month.', 'Wage Protection Program'));
  out.push(check('Nitaqat', 'info', 'Check the Saudisation band before hiring expatriates.', 'MHRSD Nitaqat'));
  return out;
}

export const policy = {
  'Working time': [['Hours', '8 h a day, 48 h a week (6 h a day in Ramadan for Muslims)'], ['Overtime', 'Hourly wage + 50% of basic'], ['Rest', 'Friday weekly rest day']],
  'Leave': [['Annual leave', '21 days; 30 after 5 years'], ['Sick leave', '30 days full pay, 60 at 75%, 30 unpaid'], ['Maternity', '12 weeks paid']],
  'Pay & tax': [['Income tax', 'None'], ['WPS', 'Salaries through Mudad, on time each month'], ['Structure', 'Basic, housing and transport allowances']],
  'Social security': [['Saudis (legacy)', 'Annuity 9% + SANED 0.75% each; hazards 2% employer'], ['Saudis (new system)', 'Annuity rising 0.5% a year from July 2025'], ['Expatriates', 'Occupational hazards 2% employer only']],
  'Employment terms': [['Notice', '60 days (monthly paid) / 30 days'], ['End of service', '½ month per year for 5 years, 1 month after'], ['Probation', 'Up to 180 days']],
};

export function calendar(today) {
  return [
    ['GOSI contributions', 'GOSI', 'Monthly', monthlyDue(today, 15)],
    ['Payroll file to Mudad (WPS)', 'MHRSD', 'Monthly', lastWorkingDay(today)],
  ];
}
