// United Arab Emirates payroll engine — 2026.
// No personal income tax. GPSSA pension for UAE nationals; end-of-service gratuity accrual for expatriates.
import { r2, clamp, yearsBetween, monthlyDue, lastWorkingDay, check } from './common.js';

export const RATES = {
  effective: '2026 (Federal Decree-Law 33/2021 and GPSSA law from Oct 2023)',
  structure: { basic: 0.60, housing: 0.25, transport: 0.15 },
  gpssa: { ee: 0.11, er: 0.15, govt: 0.025, govtBelow: 20000, min: 3000, max: 70000 },
  eosb: { first5Years: 21, after5Years: 30 },
  overtime: { normal: 1.25, night: 1.5 },
  maxWeekHours: 48,
  annualLeave: 30,
};

export const REGIONS = [['DXB', 'Dubai'], ['AUH', 'Abu Dhabi'], ['SHJ', 'Sharjah']];
export const PROFILE = [
  { key: 'national', label: 'Nationality', options: [['expat', 'Expatriate'], ['uae', 'UAE national']], default: 'expat' },
  { key: 'iloe', label: 'ILOE insurance', options: [['yes', 'Subscribed'], ['no', 'Not confirmed']], default: 'no' },
];

export function compute(e, ctx) {
  const g = e.gross, S = RATES.structure, p = e.profile || {};
  const basic = g * S.basic, housing = g * S.housing, transport = g - basic - housing;
  const national = p.national === 'uae', tenure = yearsBetween(e.doj, ctx.today);
  let gEE = 0, gER = 0, eosb = 0, contributory = 0;
  if (national) {
    const G = RATES.gpssa; contributory = clamp(g, G.min, G.max);
    gEE = r2(contributory * G.ee);
    gER = r2(contributory * (g < G.govtBelow ? G.er - G.govt : G.er));
  } else {
    eosb = r2(basic / 30 * (tenure >= 5 ? RATES.eosb.after5Years : RATES.eosb.first5Years) / 12);
  }
  const deductions = [['Pension – GPSSA (EE 11%)', gEE]];
  const employer = [['Pension – GPSSA (ER)', gER], ['End-of-service gratuity accrual', eosb]];
  return {
    currency: 'AED', gross: g, earned: g,
    earnings: [['Basic (60%)', r2(basic)], ['Housing allowance (25%)', r2(housing)], ['Transport allowance (15%)', r2(transport)]],
    deductions, employer, totalDeductions: gEE, employerTotal: r2(gER + eosb),
    net: r2(g - gEE), cost: r2(g + gER + eosb),
    steps: national
      ? [['Contributory salary (AED 3,000–70,000)', r2(contributory)], ['Employee 11%', gEE], [g < RATES.gpssa.govtBelow ? 'Employer 12.5% (after 2.5% government share)' : 'Employer 15%', gER]]
      : [['Service', `${tenure.toFixed(1)} years`], ['Gratuity days per year', tenure >= 5 ? 30 : 21], ['Monthly accrual = basic ÷ 30 × days ÷ 12', eosb]],
    notes: ['No personal income tax in the UAE.', national ? 'UAE national: GPSSA pension replaces end-of-service gratuity.' : 'Expatriate: gratuity accrues as an employer liability.'],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {};
  out.push(check('Salary paid through WPS', 'info', 'Pay through the Wage Protection System within 15 days of the due date.', 'Ministerial Resolution 43/2022'));
  out.push(check('Nationality recorded', p.national ? 'pass' : 'warn', p.national ? (p.national === 'uae' ? 'UAE national: register with GPSSA.' : 'Expatriate: gratuity accrues.') : 'Record nationality to decide GPSSA vs gratuity.', 'Federal Decree-Law 57/2023'));
  out.push(check('ILOE unemployment insurance', p.iloe === 'yes' ? 'pass' : 'warn', p.iloe === 'yes' ? 'Subscription confirmed.' : 'Ask the employee to confirm ILOE subscription (employee-paid).', 'Federal Decree-Law 13/2022'));
  out.push(check('Annual leave', 'pass', 'Company 30 calendar days meets the statutory minimum.', 'Federal Decree-Law 33/2021, Art. 29'));
  if (ctx.weeklyHours != null) out.push(check('Weekly hours ≤ 48', ctx.weeklyHours <= RATES.maxWeekHours ? 'pass' : 'fail', `${ctx.weeklyHours.toFixed(1)} h.`, 'Federal Decree-Law 33/2021, Art. 17'));
  out.push(check('Health insurance', 'info', e.region === 'SHJ' ? 'Check employer health cover policy.' : 'Mandatory employer health insurance in this emirate.', 'Emirate health insurance laws'));
  return out;
}

export const policy = {
  'Working time': [['Maximum hours', '8 hours a day, 48 a week'], ['Overtime', '125% of basic hourly wage; 150% for 10pm–4am'], ['Rest day', 'At least one paid rest day a week']],
  'Leave': [['Annual leave', '30 calendar days after one year'], ['Sick leave', '90 days a year: 15 full pay, 30 half pay, 45 unpaid'], ['Maternity', '60 days (45 full pay, 15 half pay)']],
  'Pay & tax': [['Pay cycle', 'Monthly through WPS'], ['Income tax', 'None'], ['Salary structure', 'Basic 60%, housing 25%, transport 15% (company)']],
  'Social security': [['UAE nationals', 'GPSSA: 11% employee, 12.5%–15% employer'], ['Expatriates', 'End-of-service gratuity: 21 days’ basic per year for 5 years, 30 days after'], ['Unemployment', 'ILOE insurance, employee-paid']],
  'Employment terms': [['Contract', 'Fixed-term contracts registered with MOHRE'], ['Probation', 'Up to 6 months'], ['Notice', '30–90 days as per contract']],
};

export function calendar(today) {
  return [
    ['Salary transfer through WPS', 'MOHRE', 'Monthly', lastWorkingDay(today)],
    ['GPSSA contributions (UAE nationals)', 'GPSSA', 'Monthly', monthlyDue(today, 15)],
  ];
}
