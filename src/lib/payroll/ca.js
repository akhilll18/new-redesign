// Canada payroll engine — 2026 (CRA T4032, January 2026). Federal tax + Ontario provincial tax, CPP/CPP2, EI.
// Annualised method: monthly pay × 12, credits at the lowest rate, ÷ 12.
import { r2, slabTax, yearsBetween, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: '2026 (CRA T4032, from 1 Jan 2026)',
  federal: { slabs: [[58523, 0.14], [117045, 0.205], [181440, 0.26], [258482, 0.29], [Infinity, 0.33]], bpa: 16452, employmentAmount: 1501, low: 0.14 },
  ontario: { slabs: [[53891, 0.0505], [107785, 0.0915], [150000, 0.1116], [220000, 0.1216], [Infinity, 0.1316]], bpa: 12989, low: 0.0505 },
  cpp: { rate: 0.0595, base: 0.0495, exemption: 3500, ympe: 74600, cpp2: 0.04, yampe: 85000 },
  ei: { ee: 0.0163, erMultiplier: 1.4, mie: 68900 },
  ehtOntario: 0.0195,                // Employer Health Tax (exempt on the first $1M of payroll for eligible employers)
  minimumWageOntario: 17.6,          // C$ per hour from 1 Oct 2025
  weekHours: 44,
};

export const REGIONS = [['ON', 'Ontario']];
export const PROFILE = [
  { key: 'sin', label: 'Social Insurance Number (SIN)', type: 'text', default: '' },
  { key: 'td1', label: 'TD1 claim', options: [['basic', 'Basic personal amount'], ['none', 'Claim code 0']], default: 'basic' },
];

export function compute(e, ctx) {
  const g = e.gross, p = e.profile || {};
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot), A = earned * 12;
  const C = RATES.cpp, cppBaseWage = Math.max(0, Math.min(A, C.ympe) - C.exemption);
  const cppAnnual = cppBaseWage * C.rate, cpp2Annual = Math.max(0, Math.min(A, C.yampe) - C.ympe) * C.cpp2;
  const cppEnhanced = cppBaseWage * (C.rate - C.base) + cpp2Annual;          // deductible from income
  const cppCreditBase = cppBaseWage * C.base;                                  // credit at lowest rate
  const eiAnnual = Math.min(A, RATES.ei.mie) * RATES.ei.ee;
  const taxable = A - cppEnhanced;
  const claim = p.td1 === 'none' ? 0 : 1;
  const F = RATES.federal, O = RATES.ontario;
  const fedTax = Math.max(0, slabTax(taxable, F.slabs) - F.low * (claim * F.bpa + cppCreditBase + eiAnnual + Math.min(F.employmentAmount, A)));
  const onTax = Math.max(0, slabTax(taxable, O.slabs) - O.low * (claim * O.bpa + cppCreditBase + eiAnnual));
  const fed = r2(fedTax / 12), prov = r2(onTax / 12), cpp = r2((cppAnnual + cpp2Annual) / 12), ei = r2(eiAnnual / 12);
  const deductions = [['Federal income tax', fed], ['Ontario income tax', prov], ['CPP + CPP2', cpp], ['EI premium (1.63%)', ei]];
  const employer = [['CPP + CPP2 (employer match)', cpp], ['EI (1.4 × employee)', r2(ei * RATES.ei.erMultiplier)], ['Ontario Employer Health Tax 1.95%', r2(earned * RATES.ehtOntario)]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'CAD', gross: g, earned,
    earnings: [['Salary', r2(g)], [`Unpaid leave (${lop} day${lop === 1 ? '' : 's'})`, -lopDed], ['Overtime (1.5× after 44 h)', ot]],
    deductions, employer, totalDeductions, employerTotal, net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Annual pay', r2(A)], ['Less enhanced CPP & CPP2 (deduction)', -r2(cppEnhanced)], ['Taxable income', r2(taxable)], ['Federal tax after 14% credits', r2(fedTax)], ['Ontario tax after 5.05% credits', r2(onTax)], ['CPP pensionable earnings (YMPE $74,600)', r2(Math.min(A, C.ympe))], ['EI insurable earnings (max $68,900)', r2(Math.min(A, RATES.ei.mie))]],
    notes: ['Ontario surtax and Ontario Health Premium are not included; payroll software adds them for higher incomes.', 'EHT is exempt on the first $1M of annual Ontario payroll for eligible private employers.'],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {};
  out.push(check('Social Insurance Number', p.sin ? 'pass' : 'fail', p.sin ? 'SIN on file.' : 'Collect the SIN within 3 days of starting work.', 'Employment Insurance Regulations s.85', true));
  out.push(check('Minimum wage (Ontario)', e.gross / (40 * 52 / 12) >= RATES.minimumWageOntario ? 'pass' : 'fail', `≈ C$${(e.gross / (40 * 52 / 12)).toFixed(2)} per hour vs C$${RATES.minimumWageOntario}.`, 'Employment Standards Act 2000', true));
  if (ctx.weeklyHours != null) out.push(check('Overtime after 44 h', ctx.weeklyHours <= RATES.weekHours ? 'pass' : 'warn', `${ctx.weeklyHours.toFixed(1)} h; 1.5× after 44 hours a week.`, 'ESA 2000, Part VIII'));
  out.push(check('Vacation', 'pass', `${yearsBetween(e.doj, ctx.today) >= 5 ? '3 weeks and 6%' : '2 weeks and 4%'} vacation pay minimum; company policy is higher.`, 'ESA 2000, Part XI'));
  return out;
}

export const policy = {
  'Working time': [['Hours', '8 a day / 48 a week maximum (Ontario); overtime 1.5× after 44 hours'], ['Breaks', '30 minutes after 5 hours'], ['Right to disconnect', 'Written policy for employers with 25+ staff (Ontario)']],
  'Leave': [['Vacation', '2 weeks (4% pay); 3 weeks (6%) after 5 years'], ['Sick leave', '3 unpaid days a year (Ontario)'], ['Parental', 'Up to 18 months; EI maternity/parental benefits']],
  'Pay & tax': [['Tax', 'Federal 14% – 33% plus provincial; TD1 claim codes'], ['Remittance', 'Source deductions by the 15th of next month (regular remitter)'], ['Year end', 'T4 slips and summary by end of February']],
  'Social security': [['CPP', '5.95% each up to YMPE $74,600 (+ CPP2 4% to $85,000)'], ['EI', '1.63% employee; employer 1.4×'], ['EHT', 'Ontario Employer Health Tax 0.98% – 1.95%']],
  'Employment terms': [['Notice', '1 week per year of service, up to 8 weeks (Ontario)'], ['Severance', '1 week per year (max 26) for large employers, 5+ years’ service'], ['Records', 'Record of Employment (ROE) within 5 days of an interruption']],
};

export function calendar(today) {
  return [
    ['Source deductions remittance (PD7A)', 'Canada Revenue Agency', 'Monthly', monthlyDue(today, 15)],
    ['Ontario EHT instalment', 'Ontario Ministry of Finance', 'Monthly', monthlyDue(today, 15)],
    ['T4 slips & summary', 'CRA', 'Annual', annualDue(today, 2, 28)],
  ];
}
