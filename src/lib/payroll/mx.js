// Mexico payroll engine — 2026. ISR (Art. 96 LISR monthly tariff, 2026 update), Subsidio para el Empleo 2026,
// IMSS worker quotas, employer IMSS / INFONAVIT / SAR (approximate) and state payroll tax (ISN).
import { r2, yearsBetween, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: '2026 (ISR Annex 8 RMF 2026, UMA 2026)',
  isr: [[0.01, 0, 0.0192], [844.60, 16.22, 0.064], [7168.52, 420.95, 0.1088], [12598.03, 1011.68, 0.16], [14644.65, 1339.14, 0.1792], [17533.65, 1856.84, 0.2136], [35362.84, 5665.16, 0.2352], [55736.69, 10457.09, 0.30], [106410.51, 25659.23, 0.32], [141880.67, 37009.69, 0.34], [425642.00, 133488.54, 0.35]],
  subsidy: { amount: 535.65, incomeLimit: 11492.66 },
  uma: 117.31,                       // daily, 2026
  minimumWageDaily: 315.04,
  imssEE: { excess: 0.004, cash: 0.0025, pensioners: 0.00375, disability: 0.00625, retirement: 0.01125 },
  imssER: { fixed: 0.204, excess: 0.011, cash: 0.007, pensioners: 0.0105, disability: 0.0175, nursery: 0.01, risk: 0.0054355, sar: 0.02, cesantia: 0.07, infonavit: 0.05 },
  isn: { CMX: 0.04, NLE: 0.03, JAL: 0.02 },
};

export const REGIONS = [['CMX', 'Ciudad de México'], ['NLE', 'Nuevo León'], ['JAL', 'Jalisco']];
export const PROFILE = [
  { key: 'rfc', label: 'RFC', type: 'text', default: '' },
  { key: 'curp', label: 'CURP', type: 'text', default: '' },
  { key: 'nss', label: 'IMSS number (NSS)', type: 'text', default: '' },
];

export function isrMonthly(base) {
  const row = [...RATES.isr].reverse().find(([lo]) => base >= lo);
  return row ? r2(row[1] + (base - row[0]) * row[2]) : 0;
}

export function compute(e, ctx) {
  const g = e.gross, region = e.region || 'CMX';
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const days = 30.4, sbcDaily = Math.min(earned / days * 1.0493, RATES.uma * 25);   // integrated daily wage: aguinaldo 15 d + prima vacacional 25% of 12 d
  const sbc = sbcDaily * days, excessBase = Math.max(0, sbcDaily - 3 * RATES.uma) * days;
  const E = RATES.imssEE, imssEE = r2(excessBase * E.excess + sbc * (E.cash + E.pensioners + E.disability + E.retirement));
  const isr = isrMonthly(earned), subsidy = earned <= RATES.subsidy.incomeLimit ? Math.min(isr, RATES.subsidy.amount) : 0, isrNet = r2(Math.max(0, isr - subsidy));
  const R = RATES.imssER;
  const imssER = r2(RATES.uma * days * R.fixed + excessBase * R.excess + sbc * (R.cash + R.pensioners + R.disability + R.nursery + R.risk));
  const sar = r2(sbc * R.sar), ces = r2(sbc * R.cesantia), inf = r2(sbc * R.infonavit), isn = r2(earned * (RATES.isn[region] ?? 0.03));
  const prov = r2(g / 30 * 15 / 12 + g / 30 * 12 * 0.25 / 12);
  const deductions = [['ISR (after Subsidio para el Empleo)', isrNet], ['IMSS worker quotas', imssEE]];
  const employer = [['IMSS employer quotas', imssER], ['SAR retirement 2%', sar], ['Cesantía y vejez (approx.)', ces], ['INFONAVIT 5%', inf], [`State payroll tax (${region})`, isn], ['Aguinaldo + prima vacacional accrual', prov]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'MXN', gross: g, earned,
    earnings: [['Sueldo', r2(g)], [`Faltas (${lop})`, -lopDed], ['Horas extra (2× / 3×)', ot]],
    deductions, employer, totalDeductions, employerTotal, net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Monthly taxable income', earned], ['ISR from Art. 96 tariff', isr], ['Subsidio para el Empleo', -r2(subsidy)], ['ISR withheld', isrNet], ['SBC (integrated daily wage)', r2(sbcDaily)], ['UMA 2026 (daily)', RATES.uma]],
    notes: ['Employer cesantía y vejez rises each year to 2030 by salary band; 7% is an approximation.', 'Aguinaldo (15 days, by 20 December) and prima vacacional (25%) are accrued as employer cost.', 'Profit sharing (PTU, 10%) is paid by May and is not included.'],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {};
  out.push(check('RFC and CURP', p.rfc && p.curp ? 'pass' : 'fail', p.rfc && p.curp ? 'Recorded.' : 'RFC and CURP are needed for CFDI payroll receipts.', 'CFF Art. 27, 29', true));
  out.push(check('IMSS registration', p.nss ? 'pass' : 'warn', p.nss ? `NSS ${p.nss}.` : 'Register the worker with IMSS before the first day (IDSE).', 'Ley del Seguro Social Art. 15'));
  out.push(check('Minimum wage', e.gross / 30 >= RATES.minimumWageDaily ? 'pass' : 'fail', `MX$${(e.gross / 30).toFixed(2)} a day vs MX$${RATES.minimumWageDaily}.`, 'CONASAMI 2026', true));
  out.push(check('Vacation (Vacaciones Dignas)', 'pass', `${yearsBetween(e.doj, ctx.today) < 1 ? 12 : 12 + 2 * Math.min(4, Math.floor(yearsBetween(e.doj, ctx.today)))} days for this tenure.`, 'LFT Art. 76'));
  out.push(check('Outsourcing (REPSE)', 'info', 'Specialised services must be registered in REPSE.', 'LFT Art. 15'));
  return out;
}

export const policy = {
  'Working time': [['Hours', '48 a week (day shift); 40-hour week being phased in by law reform'], ['Overtime', 'Double pay for the first 9 h a week, triple after'], ['Rest', 'One paid rest day a week; Sunday premium 25%']],
  'Leave': [['Vacation', '12 days after year one, +2 a year to 20, then +2 every 5 years'], ['Vacation premium', '25% of vacation pay'], ['Maternity / paternity', '12 weeks (IMSS) / 5 working days']],
  'Pay & tax': [['ISR', 'Monthly tariff 1.92% – 35%; Subsidio para el Empleo MX$535.65 up to MX$11,492.66'], ['CFDI', 'Electronic payroll receipt for every payment'], ['Aguinaldo', 'At least 15 days’ pay by 20 December']],
  'Social security': [['IMSS', 'Worker ≈ 2.4% of SBC; employer ≈ 20%'], ['INFONAVIT', '5% employer'], ['ISN', 'State payroll tax 2% – 4%']],
  'Employment terms': [['Termination', 'Unjustified dismissal: 3 months + 20 days per year + seniority premium'], ['Probation', 'Up to 30 days (180 for managers)'], ['PTU', '10% profit sharing paid by May']],
};

export function calendar(today) {
  return [
    ['ISR withholding (declaración mensual)', 'SAT', 'Monthly', monthlyDue(today, 17)],
    ['IMSS quotas (SUA)', 'IMSS', 'Monthly', monthlyDue(today, 17)],
    ['State payroll tax (ISN)', 'State treasury', 'Monthly', monthlyDue(today, 17)],
    ['Aguinaldo payment', 'LFT Art. 87', 'Annual', annualDue(today, 12, 20)],
  ];
}
