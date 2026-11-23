// France payroll engine — 2026 (approximate). Main employee and employer social contributions on the 2026 PASS,
// CSG/CRDS, and withholding (prélèvement à la source) at the neutral rate unless a personal rate is set.
import { r2, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: '2026 (PMSS €4,005; SMIC €1,867.02)',
  pmss: 4005, smic: 1867.02,
  ee: { oldAgeCapped: 0.069, oldAge: 0.004, agircT1: 0.0315, agircT2: 0.0864, cegT1: 0.0086, cegT2: 0.0108, cet: 0.0014, csgBase: 0.9825, csgDeductible: 0.068, csgNonDeductible: 0.029 },
  er: { health: 0.13, oldAgeCapped: 0.0855, oldAge: 0.0211, family: 0.0525, accident: 0.022, unemployment: 0.04, ags: 0.0025, agircT1: 0.0472, agircT2: 0.1295, cegT1: 0.0129, cegT2: 0.0162, cet: 0.0021, fnal: 0.001, csa: 0.003, training: 0.0168 },
  // Neutral-rate grid (monthly, metropolitan France): [upper bound of taxable net, rate]
  neutral: [[1620, 0], [1683, 0.005], [1791, 0.013], [1911, 0.021], [2042, 0.029], [2151, 0.035], [2294, 0.041], [2714, 0.053], [3107, 0.075], [3539, 0.099], [3983, 0.119], [4648, 0.138], [5574, 0.158], [6974, 0.179], [8711, 0.20], [12091, 0.24], [16376, 0.28], [25706, 0.33], [55062, 0.38], [Infinity, 0.43]],
};

export const REGIONS = [['IDF', 'Île-de-France'], ['ARA', 'Auvergne-Rhône-Alpes'], ['PAC', 'Provence-Alpes-Côte d’Azur']];
export const PROFILE = [
  { key: 'pas_rate', label: 'Personal withholding rate % (blank = neutral)', type: 'text', default: '' },
  { key: 'status', label: 'Status', options: [['non_cadre', 'Non-cadre'], ['cadre', 'Cadre']], default: 'non_cadre' },
  { key: 'nir', label: 'Social security number (NIR)', type: 'text', default: '' },
];

export function compute(e, ctx) {
  const g = e.gross, p = e.profile || {};
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const P = RATES.pmss, t1 = Math.min(earned, P), t2 = Math.max(0, Math.min(earned, 8 * P) - P);
  const E = RATES.ee, R = RATES.er;
  const eeSocial = r2(t1 * (E.oldAgeCapped + E.agircT1 + E.cegT1) + earned * E.oldAge + t2 * (E.agircT2 + E.cegT2) + (earned > P ? earned * E.cet : 0));
  const csgBase = earned * E.csgBase, csgD = r2(csgBase * E.csgDeductible), csgN = r2(csgBase * E.csgNonDeductible);
  const taxableNet = r2(earned - eeSocial - csgD);
  const personal = parseFloat(String(p.pas_rate || '').replace(',', '.'));
  const rate = Number.isFinite(personal) ? personal / 100 : RATES.neutral.find(([cap]) => taxableNet <= cap)[1];
  const pas = r2(taxableNet * rate);
  const healthRate = earned <= 2.5 * RATES.smic ? 0.07 : R.health, familyRate = earned <= 3.5 * RATES.smic ? 0.0345 : R.family;
  const erSocial = r2(earned * (healthRate + R.oldAge + familyRate + R.accident + R.unemployment + R.ags + R.fnal + R.csa + R.training) + t1 * (R.oldAgeCapped + R.agircT1 + R.cegT1) + t2 * (R.agircT2 + R.cegT2) + (earned > P ? earned * R.cet : 0));
  const deductions = [['Social contributions (pension, Agirc-Arrco)', eeSocial], ['CSG deductible 6.8%', csgD], ['CSG/CRDS non-deductible 2.9%', csgN], [`Prélèvement à la source (${(rate * 100).toFixed(1)}%${Number.isFinite(personal) ? '' : ' neutral'})`, pas]];
  const employer = [['Employer social contributions', erSocial]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'EUR', gross: g, earned,
    earnings: [['Salaire de base', r2(g)], [`Absences (${lop})`, -lopDed], ['Heures supplémentaires (+25% / +50%)', ot]],
    deductions, employer, totalDeductions, employerTotal, net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Gross', earned], ['Tranche 1 (≤ PMSS €4,005)', r2(t1)], ['Tranche 2', r2(t2)], ['Employee social contributions', eeSocial], ['Net taxable (net imposable)', taxableNet], ['Withholding rate', `${(rate * 100).toFixed(1)}%`]],
    notes: ['Approximate: mutuelle, prévoyance, APEC and the general reduction of employer contributions (RGDU) are not applied.', 'Use the employee’s personal rate from DGFiP (via DSN) instead of the neutral rate when available.'],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {};
  out.push(check('Social security number (NIR)', p.nir ? 'pass' : 'fail', p.nir ? 'Recorded.' : 'NIR required for the DPAE and DSN.', 'Code de la sécurité sociale', true));
  out.push(check('SMIC', e.gross >= RATES.smic ? 'pass' : 'fail', `€${e.gross} vs SMIC €${RATES.smic} (35 h).`, 'Code du travail L3231-2', true));
  out.push(check('DPAE', 'info', 'Pre-hiring declaration to URSSAF before the first day.', 'L1221-10'));
  if (ctx.weeklyHours != null) out.push(check('35-hour week', ctx.weeklyHours <= 35 ? 'pass' : 'warn', `${ctx.weeklyHours.toFixed(1)} h; hours above 35 are paid overtime (+25% / +50%).`, 'L3121-27'));
  return out;
}

export const policy = {
  'Working time': [['Legal week', '35 hours; overtime +25% (36–43 h), +50% after'], ['Maximum', '10 h a day, 48 h a week'], ['Right to disconnect', 'Policy required (50+ staff)']],
  'Leave': [['Congés payés', '2.5 days per month = 5 weeks (30 jours ouvrables)'], ['Sick leave', 'Social security daily allowance after 3 waiting days; employer top-up after 1 year'], ['Maternity / paternity', '16 weeks / 28 days']],
  'Pay & tax': [['Withholding', 'Prélèvement à la source; DGFiP rate via DSN'], ['DSN', 'Monthly social declaration by the 5th or 15th'], ['Payslip', 'Simplified payslip format (bulletin clarifié)']],
  'Social security': [['Employee', '≈ 21% – 23% of gross incl. CSG/CRDS'], ['Employer', '≈ 25% – 45% before reductions'], ['Ceiling', 'PMSS €4,005 a month (2026)']],
  'Employment terms': [['Notice', '1 – 3 months by collective agreement'], ['Severance', '¼ month per year (10 years), ⅓ after'], ['Probation', '2 months (employees) to 4 months (cadres), renewable once']],
};

export function calendar(today) {
  return [
    ['DSN (50+ staff)', 'URSSAF / net-entreprises', 'Monthly', monthlyDue(today, 5)],
    ['DSN (under 50 staff)', 'URSSAF / net-entreprises', 'Monthly', monthlyDue(today, 15)],
    ['Withholding tax payment', 'DGFiP', 'Monthly', monthlyDue(today, 15)],
    ['Training & apprenticeship taxes (annual balance)', 'URSSAF', 'Annual', annualDue(today, 5, 5)],
  ];
}
