// Nigeria payroll engine — from 1 January 2026 (Nigeria Tax Act 2025, Nigeria Tax Administration Act 2025).
// Pension Reform Act 2014 · National Housing Fund Act · Employees' Compensation Act 2010 (NSITF) · ITF Act · National Minimum Wage Act 2024.
import { r2, slabTax, yearsBetween, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: '2026 (Nigeria Tax Act 2025, from 1 Jan 2026)',
  tax: {
    slabs: [[800000, 0], [3000000, 0.15], [12000000, 0.18], [25000000, 0.21], [50000000, 0.23], [Infinity, 0.25]],
    rentReliefShare: 0.20, rentReliefCap: 500000,
  },
  pension: { ee: 0.08, er: 0.10 },   // on basic + housing + transport
  nhf: 0.025,                        // on basic
  nsitf: 0.01, itf: 0.01,            // employer, on payroll
  structure: { basic: 0.50, housing: 0.25, transport: 0.15, other: 0.10 },
  minimumWage: 70000,                // ₦ per month
};

export const REGIONS = [['LA', 'Lagos'], ['FC', 'Abuja (FCT)'], ['RI', 'Rivers'], ['OG', 'Ogun']];
export const PROFILE = [
  { key: 'annual_rent', label: 'Annual rent paid (₦, for rent relief)', type: 'number', default: 0 },
  { key: 'nhf', label: 'National Housing Fund', options: [['yes', 'Contributes'], ['no', 'Exempt']], default: 'yes' },
  { key: 'tin', label: 'Tax ID (TIN)', type: 'text', default: '' },
  { key: 'pfa', label: 'Pension fund administrator (PFA)', type: 'text', default: '' },
];

export function compute(e, ctx) {
  const g = e.gross, S = RATES.structure, p = e.profile || {};
  const basic = g * S.basic, housing = g * S.housing, transport = g * S.transport, other = g - basic - housing - transport;
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const bht = basic + housing + transport;
  const penEE = r2(bht * RATES.pension.ee), penER = r2(bht * RATES.pension.er);
  const nhf = p.nhf === 'no' ? 0 : r2(basic * RATES.nhf);
  const rentRelief = Math.min(Number(p.annual_rent || 0) * RATES.tax.rentReliefShare, RATES.tax.rentReliefCap);
  const annualTaxable = Math.max(0, earned * 12 - penEE * 12 - nhf * 12 - rentRelief);
  const annualTax = r2(slabTax(annualTaxable, RATES.tax.slabs)), paye = r2(annualTax / 12);
  const deductions = [['PAYE (state IRS)', paye], ['Pension (EE 8%)', penEE], ['National Housing Fund (2.5%)', nhf]];
  const employer = [['Pension (ER 10%)', penER], ['NSITF (1%)', r2(earned * RATES.nsitf)], ['ITF (1%)', r2(earned * RATES.itf)]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'NGN', gross: g, earned,
    earnings: [['Basic (50%)', r2(basic)], ['Housing (25%)', r2(housing)], ['Transport (15%)', r2(transport)], ['Other allowances (10%)', r2(other)], [`Unpaid leave (${lop} day${lop === 1 ? '' : 's'})`, -lopDed], ['Overtime', ot]],
    deductions, employer, totalDeductions, employerTotal,
    net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Annual gross', r2(earned * 12)], ['Less pension (8%)', -r2(penEE * 12)], ['Less NHF', -r2(nhf * 12)], ['Less rent relief (20%, max ₦500,000)', -r2(rentRelief)],
      ['Annual taxable income', r2(annualTaxable)], ['Tax (0% on first ₦800,000, then 15% – 25%)', annualTax], ['Monthly PAYE (÷ 12)', paye]],
    notes: ['PAYE is paid to the State Internal Revenue Service where the employee lives.', 'The old consolidated relief allowance (CRA) was abolished by the Nigeria Tax Act 2025; rent relief replaces it.'],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {};
  out.push(check('Minimum wage', e.gross >= RATES.minimumWage ? 'pass' : 'fail', `₦${e.gross.toLocaleString('en-NG')} a month against the ₦70,000 national minimum.`, 'National Minimum Wage (Amendment) Act 2024', true));
  out.push(check('Tax ID', p.tin ? 'pass' : 'warn', p.tin ? `TIN ${p.tin}.` : 'Record the employee’s Tax ID (NIN-linked) for PAYE filing.', 'Nigeria Tax Administration Act 2025'));
  out.push(check('Pension fund administrator', p.pfa ? 'pass' : 'warn', p.pfa ? `PFA: ${p.pfa}.` : 'Record the employee’s PFA and RSA PIN.', 'Pension Reform Act 2014'));
  out.push(check('Rent relief evidence', Number(p.annual_rent) > 0 ? 'info' : 'pass', Number(p.annual_rent) > 0 ? 'Keep the tenancy agreement or rent receipts on file.' : 'No rent relief claimed.', 'Nigeria Tax Act 2025'));
  out.push(check('Annual leave', 'pass', 'Company policy exceeds the statutory 6 working days after 12 months.', 'Labour Act s.18'));
  const tenure = yearsBetween(e.doj, ctx.today);
  out.push(check('Notice period', 'info', tenure < 2 ? '1 week (3 months – 2 years’ service) unless the contract says more.' : tenure < 5 ? '2 weeks (2 – 5 years).' : '1 month (5 years or more).', 'Labour Act s.11'));
  return out;
}

export const policy = {
  'Working time': [['Hours', 'Set by contract or collective agreement; 40 hours a week is usual'], ['Overtime', 'As agreed by contract or collective agreement'], ['Rest', 'At least one rest day a week']],
  'Leave': [['Annual leave', 'At least 6 working days after 12 months (Labour Act); company policy usually 15 – 20'], ['Sick leave', 'Up to 12 working days a year with full pay, with a medical certificate'], ['Maternity', '12 weeks (Labour Act), at least 50% pay; many employers give 16 weeks full pay']],
  'Pay & tax': [['PAYE', '0% on first ₦800,000, then 15%, 18%, 21%, 23%, 25%'], ['Remittance', 'PAYE by the 10th of the next month to the State IRS'], ['Annual return', 'Employer annual return (Form H1) by 31 January']],
  'Social security': [['Pension', '8% employee + 10% employer on basic, housing and transport'], ['NHF', '2.5% of basic, employee'], ['NSITF / ITF', '1% each of payroll, employer-only']],
  'Employment terms': [['Notice', '1 day to 1 month by length of service, or longer by contract'], ['Redundancy', 'Notify unions; last-in, first-out; negotiate redundancy pay'], ['Contract', 'Written terms within 3 months of starting work']],
};

export function calendar(today) {
  return [
    ['PAYE remittance', 'State Internal Revenue Service', 'Monthly', monthlyDue(today, 10)],
    ['Pension contributions', 'PFA / PenCom', 'Monthly', monthlyDue(today, 7)],
    ['NHF contributions', 'Federal Mortgage Bank of Nigeria', 'Monthly', monthlyDue(today, 10)],
    ['NSITF contributions', 'NSITF', 'Monthly', monthlyDue(today, 16)],
    ['Employer annual return (Form H1)', 'State IRS', 'Annual', annualDue(today, 1, 31)],
    ['ITF annual contribution', 'Industrial Training Fund', 'Annual', annualDue(today, 4, 1)],
  ];
}
