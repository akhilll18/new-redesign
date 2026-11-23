// India payroll engine — FY 2026-27 (tax year from 1 April 2026, Income-tax Act 2025, new regime).
import { r2, slabTax, yearsBetween, monthlyDue, quarterlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: 'Tax year 2026-27 (from 1 Apr 2026)',
  tax: {
    standardDeduction: 75000,
    slabs: [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]],
    rebateUpTo: 1200000, cess: 0.04,
  },
  pf: { rate: 0.12, wageCeiling: 15000, eps: 0.0833, edli: 0.005, admin: 0.005 },
  esi: { ee: 0.0075, er: 0.0325, wageLimit: 21000 },
  gratuityProvision: 0.0481,
  wageRuleMinShare: 0.5,       // Code on Wages: basic + DA ≥ 50% of total remuneration
  bonusWageLimit: 21000,
  otMultiplier: 2,
  maxWeekHours: 48,
};

export const REGIONS = [['TG', 'Telangana'], ['KA', 'Karnataka'], ['MH', 'Maharashtra']];
export const PROFILE = [];   // work state (region) is the only local setting

/** Professional tax per month by state (February instalment differs in KA and MH). */
export function professionalTax(state, gross, gender, period) {
  const feb = period.slice(5, 7) === '02';
  switch (state) {
    case 'TG': return gross <= 15000 ? 0 : gross <= 20000 ? 150 : 200;
    case 'KA': return gross >= 25000 ? (feb ? 300 : 200) : 0;
    case 'MH':
      if (gender === 'F') return gross <= 25000 ? 0 : (feb ? 300 : 200);
      return gross <= 7500 ? 0 : gross <= 10000 ? 175 : (feb ? 300 : 200);
    default: return null;
  }
}

/** Labour Welfare Fund by state: [employee, employer, deduction months]. Telangana and Karnataka yearly (December),
 *  Maharashtra half-yearly (June and December). Rates are kept in one place so a rule update changes them everywhere. */
export const LWF = {
  TG: { ee: 2, er: 5, months: ['12'], label: 'Telangana LWF (yearly, December)' },
  KA: { ee: 50, er: 100, months: ['12'], label: 'Karnataka LWF (yearly, December)' },
  MH: { ee: 25, er: 75, months: ['06', '12'], label: 'Maharashtra LWF (June and December)', low: { upTo: 3000, ee: 6, er: 18 } },
};
export function labourWelfareFund(state, gross, period) {
  const r = LWF[state];
  if (!r || !r.months.includes(period.slice(5, 7))) return { ee: 0, er: 0, due: false, label: r?.label || 'No LWF for this state' };
  const low = r.low && gross <= r.low.upTo;
  return { ee: low ? r.low.ee : r.ee, er: low ? r.low.er : r.er, due: true, label: r.label };
}

export function incomeTax(annual) {
  const T = RATES.tax, taxable = Math.max(0, annual - T.standardDeduction);
  const slab = slabTax(taxable, T.slabs);
  let rebate = 0;
  if (taxable <= T.rebateUpTo) rebate = slab;
  else if (slab > taxable - T.rebateUpTo) rebate = slab - (taxable - T.rebateUpTo);   // marginal relief
  const after = slab - rebate;
  const sur = taxable > 1e7 ? after * 0.15 : taxable > 5e6 ? after * 0.10 : 0;
  const cess = (after + sur) * T.cess;
  return { annual, taxable, slab, rebate, sur, cess, total: Math.round(after + sur + cess) };
}

export function compute(e, ctx) {
  const g = e.gross, basic = g * 0.5, hra = basic * 0.4, special = g - basic - hra;
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim), paid = dim - lop;
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot + (ctx.bonus || 0) + (ctx.commission || 0) + (ctx.hourlyPay || 0));
  const P = RATES.pf, pfWage = Math.min(basic * paid / dim, P.wageCeiling);
  const pfEE = Math.round(pfWage * P.rate), pfER = pfEE, eps = Math.round(pfWage * P.eps), epf = pfER - eps;
  const edli = r2(pfWage * P.edli), admin = r2(pfWage * P.admin);
  const esiOn = g <= RATES.esi.wageLimit;
  const esiEE = esiOn ? Math.ceil(earned * RATES.esi.ee) : 0, esiER = esiOn ? Math.ceil(earned * RATES.esi.er) : 0;
  const pt = professionalTax(e.region, g, e.g, ctx.period) ?? 0;
  const tx = incomeTax(g * 12), tds = Math.round(tx.total / 12);
  const grat = r2(basic * RATES.gratuityProvision);
  const lwf = labourWelfareFund(e.region, g, ctx.period);
  const bonus = r2(ctx.bonus || 0), commission = r2(ctx.commission || 0), hourly = r2(ctx.hourlyPay || 0);
  const deductions = [['Provident fund (EE 12%)', pfEE], ['ESI (EE 0.75%)', esiEE], ['Professional tax', pt], ['Income tax (TDS)', tds], ['Labour welfare fund (EE)', lwf.ee]];
  const employer = [['EPF (ER 3.67%)', epf], ['EPS pension (ER 8.33%)', eps], ['EDLI 0.5%', edli], ['PF admin 0.5%', admin], ['ESI (ER 3.25%)', esiER], ['Labour welfare fund (ER)', lwf.er], ['Gratuity provision 4.81%', grat]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'INR', gross: g, earned,
    earnings: [['Basic (50%)', r2(basic)], ['HRA (40% of basic)', r2(hra)], ['Special allowance', r2(special)], [`LOP (${lop} day${lop === 1 ? '' : 's'})`, -lopDed], ['Overtime (2×)', ot], ...(hourly ? [['Hourly pay', hourly]] : []), ...(bonus ? [['Bonus', bonus]] : []), ...(commission ? [['Commission', commission]] : [])],
    deductions, employer, totalDeductions, employerTotal,
    net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Annual gross', tx.annual], ['Standard deduction', -RATES.tax.standardDeduction], ['Taxable income', tx.taxable], ['Tax on slabs', tx.slab],
      ['Rebate / marginal relief', -tx.rebate], ['Surcharge', tx.sur], ['Cess 4%', tx.cess], ['Annual tax', tx.total], ['Monthly TDS (÷ 12)', tds],
      ['PF wage (capped ₹15,000)', r2(pfWage)], ['Days paid', paid]],
    notes: [esiOn ? 'Covered by ESI (gross ≤ ₹21,000).' : 'Not covered by ESI (gross above ₹21,000).', `Professional tax state: ${e.region || 'not set'}.`, lwf.due ? `${lwf.label}: ₹${lwf.ee} employee + ₹${lwf.er} employer this month.` : `${lwf.label}: not due this month.`],
  };
}

export function checks(e, ctx) {
  const out = [], g = e.gross, basic = g * 0.5, tenure = yearsBetween(e.doj, ctx.today);
  out.push(check('Wage definition (basic ≥ 50%)', basic / g >= RATES.wageRuleMinShare ? 'pass' : 'fail',
    `Basic is ${Math.round(basic / g * 100)}% of total pay.`, 'Code on Wages, 2019'));
  out.push(check('Professional tax state set', professionalTax(e.region, g, e.g, ctx.period) === null ? 'fail' : 'pass',
    e.region ? `Deducting under ${e.region} slabs.` : 'Choose the work state so the right slab applies.', 'State PT Acts', true));
  out.push(check('PF coverage', 'pass', `PF on wage of ₹${Math.min(basic, 15000).toLocaleString('en-IN')} (ceiling ₹15,000).`, 'EPF & MP Act / Code on Social Security'));
  out.push(check('ESI coverage', 'pass', g <= RATES.esi.wageLimit ? 'Covered: deduct 0.75% and pay 3.25%.' : 'Above ₹21,000: not covered.', 'ESI Act / Code on Social Security'));
  out.push(check('Statutory bonus', g <= RATES.bonusWageLimit ? 'warn' : 'pass',
    g <= RATES.bonusWageLimit ? 'Eligible for annual bonus of 8.33%–20%; make sure it is provided for.' : 'Pay is above the bonus eligibility limit.', 'Payment of Bonus / Code on Wages'));
  out.push(check('Gratuity eligibility', 'info', tenure >= 5 ? `Eligible (${tenure.toFixed(1)} yrs service).` : `Eligible after 5 years (now ${tenure.toFixed(1)} yrs); 1 year for fixed-term staff.`, 'Code on Social Security, 2020'));
  if (ctx.weeklyHours != null) out.push(check('Weekly hours ≤ 48', ctx.weeklyHours <= RATES.maxWeekHours ? 'pass' : 'fail', `${ctx.weeklyHours.toFixed(1)} h scheduled or worked in the latest week.`, 'OSH Code / Shops & Establishments Act'));
  out.push(check('Labour welfare fund', LWF[e.region] ? 'pass' : 'info', LWF[e.region] ? `${LWF[e.region].label}: ₹${LWF[e.region].ee} employee + ₹${LWF[e.region].er} employer.` : 'No LWF configured for this work state.', 'State Labour Welfare Fund Acts'));
  out.push(check('Minimum wage', 'info', 'Confirm pay meets the current state notification for this role’s skill category.', 'Code on Wages'));
  return out;
}

export const policy = {
  'Working time': [['Maximum hours', '48 hours a week, 9 hours a day'], ['Overtime', 'Twice the ordinary rate for eligible staff (company: grades P1–P2)'], ['Weekly off', 'At least one day a week']],
  'Leave': [['Earned leave', 'Company 18 days a year (1.5 / month); statute: 1 day per 20 days worked'], ['Casual / sick leave', '12 + 12 days a year (company)'], ['Maternity', '26 weeks paid'], ['Carry forward', 'Up to 30 EL days; excess encashed at basic ÷ 26']],
  'Pay & tax': [['Pay cycle', 'Monthly, credited by the 7th'], ['Income tax', 'New regime, Income-tax Act 2025; TDS monthly'], ['Professional tax', 'By work state (Telangana, Karnataka, Maharashtra configured)'], ['Labour welfare fund', 'Telangana ₹2 + ₹5 and Karnataka ₹50 + ₹100 yearly; Maharashtra ₹25 + ₹75 in June and December']],
  'Social security': [['Provident fund', '12% employee + 12% employer on wages up to ₹15,000'], ['ESI', '0.75% + 3.25% when gross ≤ ₹21,000'], ['Gratuity', '15 days’ wages per year of service after 5 years']],
  'Employment terms': [['Probation', '6 months (company)'], ['Notice', '30 days during probation, 60 days after (company)'], ['Wage rule', 'Basic + DA at least 50% of total pay']],
};

export function calendar(today) {
  return [
    ['TDS deposit (salary)', 'Income Tax Dept', 'Monthly', monthlyDue(today, 7)],
    ['PF ECR & payment', 'EPFO', 'Monthly', monthlyDue(today, 15)],
    ['ESI contribution', 'ESIC', 'Monthly', monthlyDue(today, 15)],
    ['Professional tax (Telangana)', 'Telangana CTD', 'Monthly', monthlyDue(today, 10)],
    ['Form 24Q TDS return', 'Income Tax Dept', 'Quarterly', quarterlyDue(today, 31, 1, [6, 9, 12]) ],
    ['Form 16 to employees', 'Income Tax Dept', 'Annual', annualDue(today, 6, 15)],
    ['Labour welfare fund (Telangana)', 'Telangana Labour Welfare Board', 'Annual', annualDue(today, 1, 31)],
    ['Labour welfare fund (Karnataka)', 'Karnataka Labour Welfare Board', 'Annual', annualDue(today, 1, 15)],
    ['Labour welfare fund (Maharashtra)', 'Maharashtra Labour Welfare Board', 'Half-yearly', annualDue(today, 7, 15) < annualDue(today, 1, 15) ? annualDue(today, 7, 15) : annualDue(today, 1, 15)],
  ];
}
