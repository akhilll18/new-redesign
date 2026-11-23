// Singapore payroll engine — CPF rates and ceilings from 1 January 2026.
// No income tax withholding for residents (assessed annually via IRAS; employer files IR8A through AIS).
import { r2, clamp, ageAt, yearsBetween, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: 'From 1 Jan 2026',
  cpf: {
    owCeiling: 8000, annualCeiling: 102000,
    // [age up to, employer, employee] for Citizens / SPRs from 3rd year, wages above $750
    bands: [[55, 0.17, 0.20], [60, 0.16, 0.18], [65, 0.125, 0.125], [70, 0.09, 0.075], [Infinity, 0.075, 0.05]],
    pr1: [0.04, 0.05], pr2: [0.09, 0.15],          // graduated rates for SPRs in year 1 and 2 (age 55 and below)
  },
  sdl: { rate: 0.0025, min: 2, max: 11.25 },
  epMinimumSalary: 5600,
  partIVWorkmanLimit: 4500, partIVNonWorkmanLimit: 2600,
  maxWeekHours: 44,
};

export const REGIONS = [['SG', 'Singapore']];
export const PROFILE = [
  { key: 'residency', label: 'Residency', options: [['citizen', 'Citizen'], ['pr3', 'PR (3rd year+)'], ['pr2', 'PR (2nd year)'], ['pr1', 'PR (1st year)'], ['ep', 'Employment Pass']], default: 'citizen' },
];

export function cpf(wage, age, residency) {
  if (residency === 'ep' || wage <= 750) return { er: 0, ee: 0, total: 0, rates: [0, 0] };
  const C = RATES.cpf, w = Math.min(wage, C.owCeiling);
  let rates = C.bands.find(b => age <= b[0]).slice(1);
  if (age <= 55 && residency === 'pr1') rates = C.pr1;
  if (age <= 55 && residency === 'pr2') rates = C.pr2;
  const total = Math.round(w * (rates[0] + rates[1])), ee = Math.floor(w * rates[1]);
  return { er: total - ee, ee, total, rates, wage: w };
}

export function compute(e, ctx) {
  const g = e.gross, p = e.profile || {}, residency = p.residency || 'citizen';
  const age = ageAt(e.dob, ctx.period + '-01'), c = cpf(g, age, residency);
  const sdl = r2(clamp(g * RATES.sdl.rate, RATES.sdl.min, RATES.sdl.max));
  const deductions = [['CPF (employee)', c.ee]];
  const employer = [['CPF (employer)', c.er], ['Skills Development Levy 0.25%', sdl]];
  return {
    currency: 'SGD', gross: g, earned: g,
    earnings: [['Salary (ordinary wages)', g]], deductions, employer, totalDeductions: c.ee, employerTotal: r2(c.er + sdl),
    net: r2(g - c.ee), cost: r2(g + c.er + sdl),
    steps: [['Residency', residency], ['Age for CPF', age], ['Wages subject to CPF (OW ceiling S$8,000)', r2(c.wage || 0)],
      ['Rates employer / employee', `${(c.rates[0] * 100).toFixed(1)}% / ${(c.rates[1] * 100).toFixed(1)}%`], ['Total CPF (rounded)', c.total], ['Employee share (rounded down)', c.ee], ['Employer share = total − employee', c.er]],
    notes: ['No income tax is withheld; residents are assessed annually by IRAS.', residency === 'ep' ? 'Employment Pass holders do not contribute to CPF.' : 'CPF applies (Citizen / PR).'],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {}, residency = p.residency, tenure = yearsBetween(e.doj, ctx.today);
  out.push(check('Residency recorded', residency ? 'pass' : 'warn', residency ? `Residency: ${residency}.` : 'Record residency to apply CPF correctly (defaulting to Citizen).', 'CPF Act'));
  if (residency === 'ep') out.push(check('EP qualifying salary', e.gross >= RATES.epMinimumSalary ? 'pass' : 'fail', `S$${e.gross} vs S$${RATES.epMinimumSalary} minimum (higher for financial services and older candidates).`, 'Employment of Foreign Manpower Act'));
  const statutoryLeave = Math.min(14, 7 + Math.floor(Math.max(0, tenure)));
  out.push(check('Annual leave', 'pass', `Statutory ${statutoryLeave} days at ${tenure.toFixed(1)} yrs service; company gives 14.`, 'Employment Act, s 88A'));
  out.push(check('Employment Act Part IV', e.gross <= RATES.partIVNonWorkmanLimit ? 'warn' : 'pass',
    e.gross <= RATES.partIVNonWorkmanLimit ? 'Covered by Part IV: overtime 1.5× beyond 44 h/week applies.' : 'Not covered by Part IV hours and overtime rules.', 'Employment Act, Part IV'));
  out.push(check('Self-help group fund', residency === 'ep' ? 'info' : 'warn', residency === 'ep' ? 'Not applicable.' : 'CDAC / ECF / MBMF / SINDA deductions are not configured.', 'CPF Act, s 57'));
  out.push(check('Itemised payslip & KETs', 'info', 'Issue itemised payslips and Key Employment Terms within 14 days of starting.', 'Employment Act, s 95, 95A'));
  return out;
}

export const policy = {
  'Working time': [['Normal hours', '44 hours a week'], ['Overtime', '1.5× for Part IV employees, capped at 72 hours a month']],
  'Leave': [['Annual leave', '7 days in year 1, +1 a year to 14 (company 14)'], ['Sick leave', '14 days outpatient, 60 days hospitalisation'], ['Maternity', '16 weeks government-paid (eligible mothers)']],
  'Pay & tax': [['Pay cycle', 'Monthly, within 7 days of the period end'], ['Income tax', 'No withholding for residents; employer files IR8A by 1 March']],
  'Social security': [['CPF', '37% total (17% employer, 20% employee) up to age 55, on wages up to S$8,000'], ['Skills Development Levy', '0.25% of wages, S$2–S$11.25 a month']],
  'Employment terms': [['Key Employment Terms', 'In writing within 14 days'], ['Notice', 'As per contract; 1 day to 4 weeks by service if unstated']],
};

export function calendar(today) {
  return [
    ['CPF & SDL contributions', 'CPF Board', 'Monthly', monthlyDue(today, 14)],
    ['IR8A via Auto-Inclusion Scheme', 'IRAS', 'Annual', annualDue(today, 3, 1)],
  ];
}
