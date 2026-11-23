// Indonesia payroll engine — 2026. PPh 21 (annualised progressive method used for the December reconciliation;
// monthly TER rates give the same annual total), BPJS Kesehatan and BPJS Ketenagakerjaan.
import { r2, slabTax, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: '2026 (PPh 21 under PMK 168/2023; BPJS)',
  tax: { slabs: [[60000000, 0.05], [250000000, 0.15], [500000000, 0.25], [5000000000, 0.30], [Infinity, 0.35]], ptkp: { 'TK/0': 54000000, 'K/0': 58500000, 'K/1': 63000000, 'K/2': 67500000, 'K/3': 72000000 }, jabatan: 0.05, jabatanMaxMonthly: 500000 },
  kesehatan: { ee: 0.01, er: 0.04, cap: 12000000 },
  jht: { ee: 0.02, er: 0.037 }, jp: { ee: 0.01, er: 0.02, cap: 10547400 }, jkk: 0.0024, jkm: 0.003,
};

export const REGIONS = [['JKT', 'DKI Jakarta'], ['JBR', 'West Java'], ['BLI', 'Bali']];
export const PROFILE = [
  { key: 'ptkp', label: 'PTKP status', options: [['TK/0', 'TK/0 single'], ['K/0', 'K/0 married'], ['K/1', 'K/1'], ['K/2', 'K/2'], ['K/3', 'K/3']], default: 'TK/0' },
  { key: 'npwp', label: 'NPWP / NIK', type: 'text', default: '' },
];

export function compute(e, ctx) {
  const g = e.gross, p = e.profile || {};
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const K = RATES.kesehatan, kesEE = r2(Math.min(earned, K.cap) * K.ee), kesER = r2(Math.min(earned, K.cap) * K.er);
  const jhtEE = r2(earned * RATES.jht.ee), jhtER = r2(earned * RATES.jht.er), jpBase = Math.min(earned, RATES.jp.cap), jpEE = r2(jpBase * RATES.jp.ee), jpER = r2(jpBase * RATES.jp.er);
  const jkk = r2(earned * RATES.jkk), jkm = r2(earned * RATES.jkm);
  const T = RATES.tax, bruto = earned + jkk + jkm + kesER;
  const jabatan = Math.min(bruto * T.jabatan, T.jabatanMaxMonthly);
  const nettoAnnual = (bruto - jabatan - jhtEE - jpEE) * 12, ptkp = T.ptkp[p.ptkp || 'TK/0'];
  const pkp = Math.max(0, Math.floor((nettoAnnual - ptkp) / 1000) * 1000);
  const pph = r2(slabTax(pkp, T.slabs) / 12);
  const deductions = [['PPh 21', pph], ['BPJS Kesehatan (1%)', kesEE], ['JHT (2%)', jhtEE], ['JP (1%)', jpEE]];
  const employer = [['BPJS Kesehatan (4%)', kesER], ['JHT (3.7%)', jhtER], ['JP (2%)', jpER], ['JKK (0.24%)', jkk], ['JKM (0.3%)', jkm], ['THR accrual (1 month a year)', r2(g / 12)]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'IDR', gross: g, earned,
    earnings: [['Gaji pokok', r2(g)], [`Unpaid leave (${lop})`, -lopDed], ['Lembur', ot]],
    deductions, employer, totalDeductions, employerTotal, net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Penghasilan bruto (incl. employer JKK, JKM, BPJS-K)', r2(bruto)], ['Biaya jabatan (5%, max Rp500,000)', -r2(jabatan)], ['Annual net income', r2(nettoAnnual)], [`PTKP ${p.ptkp || 'TK/0'}`, -ptkp], ['PKP', pkp], ['Monthly PPh 21 (annual ÷ 12)', pph]],
    notes: ['January–November withholding uses the TER table; December reconciles to this annual figure.', 'THR (religious holiday allowance) of one month’s pay is due 7 days before the holiday.'],
  };
}

export function checks(e) {
  const out = [], p = e.profile || {};
  out.push(check('NPWP / NIK', p.npwp ? 'pass' : 'warn', p.npwp ? 'Recorded.' : 'Record the NIK (used as NPWP) for Coretax e-Bupot.', 'UU HPP 2021'));
  out.push(check('Provincial minimum wage (UMP/UMK)', 'info', 'Check the 2026 UMK for the city.', 'PP 51/2023'));
  out.push(check('BPJS registration', 'info', 'Register all employees with BPJS Kesehatan and Ketenagakerjaan.', 'UU 24/2011'));
  return out;
}

export const policy = {
  'Working time': [['Hours', '40 a week (7 × 6 days or 8 × 5 days)'], ['Overtime', '1.5× first hour, 2× after; max 4 h a day, 18 a week'], ['Rest', '1 or 2 rest days a week']],
  'Leave': [['Annual leave', '12 working days after 12 months'], ['Sick leave', 'Paid with a medical certificate, tapering after 4 months'], ['Maternity', '3 months (up to 6 with conditions)']],
  'Pay & tax': [['PPh 21', 'TER monthly; progressive 5% – 35% in December'], ['THR', 'One month’s pay before the religious holiday'], ['e-Bupot', 'Withholding slips through Coretax']],
  'Social security': [['BPJS Kesehatan', '1% + 4% up to Rp12 million'], ['JHT / JP', '2% + 3.7% / 1% + 2% (JP capped)'], ['JKK / JKM', '0.24% – 1.74% / 0.3% employer']],
  'Employment terms': [['Contracts', 'PKWT fixed-term up to 5 years'], ['Severance', 'Severance + service pay per PP 35/2021'], ['Probation', 'Up to 3 months (permanent staff only)']],
};

export function calendar(today) {
  return [
    ['PPh 21 payment', 'DJP', 'Monthly', monthlyDue(today, 15)],
    ['PPh 21 return (SPT Masa)', 'DJP', 'Monthly', monthlyDue(today, 20)],
    ['BPJS contributions', 'BPJS', 'Monthly', monthlyDue(today, 10)],
    ['Form 1721-A1 to employees', 'DJP', 'Annual', annualDue(today, 1, 31)],
  ];
}
