// United States payroll engine — calendar year 2026.
// Federal withholding uses the annualised bracket method (approximates IRS Pub 15-T for a default W-4).
import { r2, slabTax, ytdBefore, monthlyDue, quarterlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: 'Calendar year 2026',
  federal: {
    single: { standardDeduction: 16100, slabs: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]] },
    married: { standardDeduction: 32200, slabs: [[24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [Infinity, 0.37]] },
  },
  socialSecurity: { rate: 0.062, wageBase: 184500 },
  medicare: { rate: 0.0145, additional: 0.009, additionalFrom: 200000 },
  futa: { rate: 0.006, wageBase: 7000 },          // 6.0% less 5.4% state credit
  states: {
    TX: { name: 'Texas', incomeTax: false, sui: { rate: 0.027, wageBase: 9000 } },
    FL: { name: 'Florida', incomeTax: false, sui: { rate: 0.027, wageBase: 7000 } },
    NY: { name: 'New York', incomeTax: null },     // null = not configured yet
    CA: { name: 'California', incomeTax: null },
  },
  k401Match: 0.04,            // company matches 100% up to 4% of pay
  federalMinimumWage: 7.25,
  flsaSalaryLevelWeekly: 684,
};

export const REGIONS = Object.entries(RATES.states).map(([k, v]) => [k, v.name]);
export const PROFILE = [
  { key: 'filing', label: 'W-4 filing status', options: [['single', 'Single'], ['married', 'Married filing jointly']], default: 'single' },
  { key: 'k401', label: '401(k) deferral %', type: 'number', default: 5, min: 0, max: 50 },
];

export function compute(e, ctx) {
  const g = e.gross, p = e.profile || {}, st = RATES.states[e.region];
  const filing = p.filing === 'married' ? 'married' : 'single', F = RATES.federal[filing];
  const pct = Math.min(50, Math.max(0, Number(p.k401 ?? 5))) / 100;
  const k401 = r2(g * pct), ytd = ytdBefore(e, ctx.period, g);
  const annualTaxable = Math.max(0, (g - k401) * 12 - F.standardDeduction);
  const fit = r2(slabTax(annualTaxable, F.slabs) / 12);
  const S = RATES.socialSecurity, ssWage = Math.max(0, Math.min(g, S.wageBase - ytd));
  const ss = r2(ssWage * S.rate);
  const M = RATES.medicare, addl = Math.max(0, ytd + g - M.additionalFrom) - Math.max(0, ytd - M.additionalFrom);
  const medEE = r2(g * M.rate + addl * M.additional), medER = r2(g * M.rate);
  const futa = r2(Math.max(0, Math.min(g, RATES.futa.wageBase - ytd)) * RATES.futa.rate);
  const sui = st?.sui ? r2(Math.max(0, Math.min(g, st.sui.wageBase - ytd)) * st.sui.rate) : 0;
  const match = r2(g * Math.min(pct, RATES.k401Match));
  const deductions = [['Federal income tax', fit], ['State income tax', 0], ['Social Security 6.2%', ss], ['Medicare 1.45%', medEE], ['401(k) deferral', k401]];
  const employer = [['Social Security 6.2%', ss], ['Medicare 1.45%', medER], ['FUTA 0.6%', futa], [`State unemployment (${e.region || '—'})`, sui], ['401(k) match', match]];
  const totalDeductions = r2(fit + ss + medEE + k401), employerTotal = r2(ss + medER + futa + sui + match);
  return {
    currency: 'USD', gross: g, earned: g,
    earnings: [['Salary', g]], deductions, employer, totalDeductions, employerTotal,
    net: r2(g - totalDeductions), cost: r2(g + employerTotal),
    steps: [['Filing status', filing === 'married' ? 'Married filing jointly' : 'Single'], ['Annual wages less 401(k)', r2((g - k401) * 12)], ['Standard deduction', -F.standardDeduction],
      ['Annual taxable', r2(annualTaxable)], ['Federal tax ÷ 12', fit], ['Year-to-date wages before this month', r2(ytd)], ['Wages subject to Social Security', r2(ssWage)]],
    notes: [st ? (st.incomeTax === false ? `${st.name} has no state income tax.` : `${st.name} income tax is not configured.`) : 'Work state not set.',
      'FUTA and state unemployment stop once year-to-date wages pass their wage bases.'],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {}, st = RATES.states[e.region], weekly = e.gross * 12 / 52;
  out.push(check('Work state configured', !st ? 'fail' : st.incomeTax === null ? 'fail' : 'pass',
    !st ? 'Set the work state.' : st.incomeTax === null ? `${st.name} withholding rules are not configured. Add them before running payroll.` : `${st.name}: no state income tax.`, 'State revenue codes', true));
  out.push(check('W-4 on file', p.filing ? 'pass' : 'warn', p.filing ? `Filing status: ${p.filing}.` : 'No W-4: withholding as single.', 'IRC §3402'));
  out.push(check('FLSA exempt salary level', weekly >= RATES.flsaSalaryLevelWeekly ? 'pass' : 'warn',
    `$${weekly.toFixed(0)} a week vs $${RATES.flsaSalaryLevelWeekly}. Below this, overtime applies over 40 h.`, 'Fair Labor Standards Act'));
  out.push(check('Minimum wage', e.gross * 12 / 2080 >= RATES.federalMinimumWage ? 'pass' : 'fail', `Federal $${RATES.federalMinimumWage}/h${st?.name === 'Texas' ? '; Texas follows the federal rate' : ''}.`, 'FLSA'));
  out.push(check('Form I-9', 'info', 'Keep a completed I-9 for every employee.', 'Immigration Reform and Control Act'));
  if (ctx.weeklyHours != null && ctx.weeklyHours > 40) out.push(check('Overtime over 40 h', 'warn', 'Non-exempt staff must be paid 1.5× above 40 hours.', 'FLSA'));
  return out;
}

export const policy = {
  'Working time': [['Standard week', '40 hours; overtime 1.5× for non-exempt staff above 40'], ['Breaks', 'Set by state law; none required federally for adults']],
  'Leave': [['Paid time off', 'Company 15 days + 11 holidays (no federal minimum)'], ['Family leave', 'FMLA: 12 weeks unpaid for eligible staff (employers with 50+)'], ['Sick leave', 'Set by state or city law']],
  'Pay & tax': [['Pay cycle', 'Monthly, last working day'], ['Federal income tax', 'Withheld per Form W-4; 10%–37% brackets'], ['State income tax', 'Texas and Florida have none; others must be configured']],
  'Social security': [['Social Security', '6.2% each on wages up to $184,500'], ['Medicare', '1.45% each; extra 0.9% employee over $200,000'], ['Unemployment', 'FUTA 0.6% on first $7,000; state rate on state wage base'], ['Retirement', '401(k) with 100% match up to 4%']],
  'Employment terms': [['Employment', 'At-will unless the contract says otherwise'], ['Eligibility', 'Form I-9 within 3 business days of starting']],
};

export function calendar(today) {
  return [
    ['Federal tax deposit (monthly schedule)', 'IRS (EFTPS)', 'Monthly', monthlyDue(today, 15)],
    ['Form 941 quarterly return', 'IRS', 'Quarterly', quarterlyDue(today, 30, 1, [3, 6, 9, 12])],
    ['State unemployment wage report (Texas)', 'Texas Workforce Commission', 'Quarterly', quarterlyDue(today, 30, 1, [3, 6, 9, 12])],
    ['W-2 to employees & SSA', 'IRS / SSA', 'Annual', annualDue(today, 1, 31)],
    ['Form 940 FUTA return', 'IRS', 'Annual', annualDue(today, 1, 31)],
  ];
}
