// Brazil payroll engine — 2026 (CLT). INSS progressive table (ceiling R$8,475.55), IRRF 2026 table with the
// Lei 15.270/2025 reduction (no tax up to R$5,000; tapering reduction to R$7,350), FGTS and employer charges.
import { r2, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: '2026 (INSS ceiling R$8,475.55; IRRF with Lei 15.270/2025)',
  inss: [[1621.00, 0.075], [2902.84, 0.09], [4354.27, 0.12], [8475.55, 0.14]],
  irrf: [[2428.80, 0, 0], [2826.65, 0.075, 182.16], [3751.05, 0.15, 394.16], [4664.68, 0.225, 675.49], [Infinity, 0.275, 908.73]],
  simplified: 607.20, dependent: 189.59,
  reducer: { fullUpTo: 5000, max: 312.89, taperUpTo: 7350, a: 978.62, b: 0.133145 },
  fgts: 0.08, employerInss: 0.20, rat: 0.02, thirdParties: 0.058,
  minimumWage: 1621.00,
};

export const REGIONS = [['SP', 'São Paulo'], ['RJ', 'Rio de Janeiro'], ['MG', 'Minas Gerais']];
export const PROFILE = [
  { key: 'cpf', label: 'CPF', type: 'text', default: '' },
  { key: 'dependents', label: 'Dependants for IRRF', type: 'number', default: 0 },
  { key: 'regime', label: 'Company tax regime', options: [['general', 'Lucro Real / Presumido'], ['simples', 'Simples Nacional']], default: 'general' },
];

export function inss(pay) {
  let t = 0, prev = 0;
  for (const [cap, rate] of RATES.inss) { if (pay > prev) t += (Math.min(pay, cap) - prev) * rate; prev = cap; }
  return r2(t);
}

export function irrf(gross, inssEE, dependents = 0) {
  const legal = inssEE + dependents * RATES.dependent;
  const base = Math.max(0, gross - Math.max(legal, RATES.simplified));
  const row = RATES.irrf.find(([cap]) => base <= cap);
  const tax = Math.max(0, base * row[1] - row[2]);
  const R = RATES.reducer;
  const red = gross <= R.fullUpTo ? Math.min(tax, R.max) : gross <= R.taperUpTo ? Math.max(0, Math.min(tax, R.a - R.b * gross)) : 0;
  return { base: r2(base), tax: r2(tax), reduction: r2(red), due: r2(Math.max(0, tax - red)) };
}

export function compute(e, ctx) {
  const g = e.gross, p = e.profile || {};
  const dim = 30, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const inssEE = inss(earned), ir = irrf(earned, inssEE, Number(p.dependents) || 0);
  const simples = p.regime === 'simples';
  const fgts = r2(earned * RATES.fgts), erInss = simples ? 0 : r2(earned * (RATES.employerInss + RATES.rat + RATES.thirdParties));
  const thirteenth = r2(earned / 12), vacation = r2(earned / 12 * (4 / 3));
  const deductions = [['INSS (7.5% – 14%)', inssEE], ['IRRF', ir.due]];
  const employer = [['FGTS 8%', fgts], [simples ? 'INSS patronal (in Simples DAS)' : 'INSS patronal + RAT + terceiros', erInss], ['13º salário accrual', thirteenth], ['Férias + 1/3 accrual', vacation], ['FGTS on accruals', r2((thirteenth + vacation) * RATES.fgts)]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'BRL', gross: g, earned,
    earnings: [['Salário base', r2(g)], [`Faltas (${lop} dia${lop === 1 ? '' : 's'})`, -lopDed], ['Horas extras (≥ 50%)', ot]],
    deductions, employer, totalDeductions, employerTotal, net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Gross', earned], ['INSS (progressive)', -inssEE], ['IRRF base (legal or simplified R$607.20)', ir.base], ['IRRF from table', ir.tax], ['Lei 15.270/2025 reduction', -ir.reduction], ['IRRF withheld', ir.due]],
    notes: ['No income tax on monthly pay up to R$5,000 from January 2026; partial reduction up to R$7,350.', '13th salary is paid in two instalments (by 30 November and 20 December).'],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {};
  out.push(check('CPF', p.cpf ? 'pass' : 'fail', p.cpf ? 'CPF on file.' : 'CPF is required for eSocial admission.', 'eSocial S-2200', true));
  out.push(check('Minimum wage', e.gross >= RATES.minimumWage ? 'pass' : 'fail', `R$${e.gross} vs national minimum R$${RATES.minimumWage}.`, 'Decreto salário mínimo 2026', true));
  out.push(check('Work card (CTPS digital)', 'info', 'Admission must be sent to eSocial before work starts.', 'CLT Art. 29'));
  if (ctx.weeklyHours != null) out.push(check('Hours ≤ 44 a week', ctx.weeklyHours <= 44 ? 'pass' : 'warn', `${ctx.weeklyHours.toFixed(1)} h; overtime max 2 h a day.`, 'CF Art. 7 XIII; CLT Art. 59'));
  return out;
}

export const policy = {
  'Working time': [['Hours', '8 h a day, 44 h a week'], ['Overtime', 'At least 50% premium; 100% on Sundays/holidays (by agreement)'], ['Night work', '20% premium (22:00 – 05:00)']],
  'Leave': [['Férias', '30 calendar days after 12 months, paid with a 1/3 bonus'], ['Sick leave', 'Employer pays first 15 days, then INSS'], ['Maternity / paternity', '120 days (180 in Empresa Cidadã) / 5 days (20)']],
  'Pay & tax': [['IRRF', 'Monthly table 7.5% – 27.5%; zero up to R$5,000 from 2026'], ['13º salário', 'One extra month a year in two instalments'], ['eSocial', 'All payroll events reported monthly (DCTFWeb)']],
  'Social security': [['INSS', '7.5% – 14% employee up to R$8,475.55; 20% employer'], ['FGTS', '8% employer to the worker’s account'], ['RAT / terceiros', '≈ 1% – 3% + 5.8%']],
  'Employment terms': [['Notice (aviso prévio)', '30 days + 3 days per year, up to 90'], ['Dismissal without cause', '40% FGTS fine'], ['Probation', 'Up to 90 days']],
};

export function calendar(today) {
  return [
    ['FGTS Digital', 'Caixa / MTE', 'Monthly', monthlyDue(today, 20)],
    ['DCTFWeb – INSS & IRRF (DARF)', 'Receita Federal', 'Monthly', monthlyDue(today, 20)],
    ['13º salário – 1st instalment', 'CLT / Lei 4.749', 'Annual', annualDue(today, 11, 30)],
    ['13º salário – 2nd instalment', 'CLT / Lei 4.749', 'Annual', annualDue(today, 12, 20)],
  ];
}
