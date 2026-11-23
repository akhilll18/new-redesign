// Germany payroll engine — 2026. Income tax by the §32a EStG 2026 tariff (annualised; tax class I or III),
// solidarity surcharge, optional church tax, and social insurance with 2026 ceilings.
import { r2, clamp, monthlyDue, annualDue, check } from './common.js';

export const RATES = {
  effective: '2026 (EStG §32a 2026; BBG RV/AV €8,450, KV/PV €5,812.50)',
  ceilings: { rv: 8450, kv: 5812.5 },
  rv: 0.186, av: 0.026, kv: 0.146, kvExtra: 0.029, pv: 0.036, pvChildless: 0.006, insolvency: 0.0015, u1u2: 0.03,
  soli: { rate: 0.055, freeUpTo: 20350, taper: 0.119 },
  werbung: 1230, sonder: 36,
  minimumWage: 13.90,
};

export const REGIONS = [['BE', 'Berlin'], ['BY', 'Bavaria'], ['HE', 'Hesse'], ['NW', 'North Rhine-Westphalia']];
export const PROFILE = [
  { key: 'tax_class', label: 'Tax class (Steuerklasse)', options: [['1', 'I'], ['3', 'III'], ['4', 'IV']], default: '1' },
  { key: 'church', label: 'Church tax', options: [['no', 'No'], ['yes', 'Yes']], default: 'no' },
  { key: 'children', label: 'Children (for care insurance)', type: 'number', default: 0 },
  { key: 'tax_id', label: 'Tax ID (Steuer-ID)', type: 'text', default: '' },
];

/** Income tax 2026, §32a EStG (one person). */
export function tariff(zve) {
  const x = Math.floor(Math.max(0, zve));
  if (x <= 12348) return 0;
  if (x <= 17799) { const y = (x - 12348) / 10000; return Math.floor((914.51 * y + 1400) * y); }
  if (x <= 69878) { const z = (x - 17799) / 10000; return Math.floor((173.10 * z + 2397) * z + 1034.87); }
  if (x <= 277825) return Math.floor(0.42 * x - 11135.63);
  return Math.floor(0.45 * x - 19470.38);
}

export function compute(e, ctx) {
  const g = e.gross, p = e.profile || {};
  const dim = ctx.daysInMonth, lop = Math.min(ctx.lopDays || 0, dim);
  const lopDed = r2(g / dim * lop), ot = r2(ctx.otPay || 0), earned = r2(g - lopDed + ot);
  const C = RATES.ceilings, rvBase = Math.min(earned, C.rv), kvBase = Math.min(earned, C.kv);
  const childless = !(Number(p.children) > 0);
  const kids = clamp(Number(p.children) || 0, 0, 5), pvReduce = kids >= 2 ? (kids - 1) * 0.0025 : 0;
  const rvEE = r2(rvBase * RATES.rv / 2), avEE = r2(rvBase * RATES.av / 2);
  const kvEE = r2(kvBase * (RATES.kv + RATES.kvExtra) / 2), pvEE = r2(kvBase * (RATES.pv / 2 + (childless ? RATES.pvChildless : 0) - pvReduce));
  const cls = p.tax_class || '1';
  const vorsorge = (rvEE + kvEE * 0.96 + pvEE) * 12;                        // simplified Vorsorgepauschale
  const zve = Math.max(0, earned * 12 - RATES.werbung - RATES.sonder - vorsorge);
  const annualTax = cls === '3' ? 2 * tariff(zve / 2) : tariff(zve);
  const S = RATES.soli, freeUpTo = cls === '3' ? S.freeUpTo * 2 : S.freeUpTo;
  const soliAnnual = annualTax <= freeUpTo ? 0 : Math.min(annualTax * S.rate, (annualTax - freeUpTo) * S.taper);
  const lst = r2(annualTax / 12), soli = r2(soliAnnual / 12), church = p.church === 'yes' ? r2(lst * (e.region === 'BY' ? 0.08 : 0.09)) : 0;
  const deductions = [['Lohnsteuer', lst], ['Solidaritätszuschlag', soli], ['Kirchensteuer', church], ['Rentenversicherung 9.3%', rvEE], ['Arbeitslosenversicherung 1.3%', avEE], ['Krankenversicherung 7.3% + ½ Zusatzbeitrag', kvEE], [`Pflegeversicherung${childless ? ' (incl. childless surcharge)' : ''}`, pvEE]];
  const employer = [['Rentenversicherung 9.3%', rvEE], ['Arbeitslosenversicherung 1.3%', avEE], ['Krankenversicherung', r2(kvBase * (RATES.kv + RATES.kvExtra) / 2)], ['Pflegeversicherung 1.8%', r2(kvBase * RATES.pv / 2)], ['Insolvenzgeld 0.15%', r2(rvBase * RATES.insolvency)], ['U1/U2 levies (approx.)', r2(earned * RATES.u1u2 * 0.4)]];
  const totalDeductions = r2(deductions.reduce((s, x) => s + x[1], 0)), employerTotal = r2(employer.reduce((s, x) => s + x[1], 0));
  return {
    currency: 'EUR', gross: g, earned,
    earnings: [['Grundgehalt', r2(g)], [`Unbezahlte Tage (${lop})`, -lopDed], ['Überstunden', ot]],
    deductions, employer, totalDeductions, employerTotal, net: r2(earned - totalDeductions), cost: r2(earned + employerTotal),
    steps: [['Annual gross', r2(earned * 12)], ['Less Werbungskosten & Sonderausgaben', -(RATES.werbung + RATES.sonder)], ['Less Vorsorgepauschale (approx.)', -r2(vorsorge)], ['Taxable income (zvE)', r2(zve)], [`Income tax, class ${cls === '3' ? 'III (splitting)' : cls === '4' ? 'IV' : 'I'}`, annualTax], ['Soli (only above the exemption)', r2(soliAnnual)], ['Monthly Lohnsteuer', lst]],
    notes: ['Annualised estimate; the official BMF Programmablaufplan gives cent-exact monthly values.', 'Average health-insurance Zusatzbeitrag 2026 (2.9%) used; each fund sets its own.'],
  };
}

export function checks(e, ctx) {
  const out = [], p = e.profile || {};
  out.push(check('Steuer-ID & ELStAM', p.tax_id ? 'pass' : 'fail', p.tax_id ? 'Tax ID on file; retrieve ELStAM.' : 'Tax ID needed to retrieve the tax class (ELStAM); otherwise class VI applies.', 'EStG §39', true));
  out.push(check('Minimum wage', e.gross / (40 * 4.33) >= RATES.minimumWage ? 'pass' : 'fail', `≈ €${(e.gross / (40 * 4.33)).toFixed(2)} per hour vs €${RATES.minimumWage}.`, 'MiLoG 2026', true));
  if (ctx.weeklyHours != null) out.push(check('Working time', ctx.weeklyHours <= 48 ? 'pass' : 'fail', `${ctx.weeklyHours.toFixed(1)} h; average 8 h a day (max 10).`, 'ArbZG §3'));
  out.push(check('Time recording', 'info', 'Working time must be recorded (BAG ruling 2022).', 'ArbSchG §3'));
  return out;
}

export const policy = {
  'Working time': [['Hours', '8 h a day, up to 10 if the 6-month average is 8'], ['Rest', '11 hours between shifts; Sundays off'], ['Records', 'Working time must be recorded']],
  'Leave': [['Annual leave', '20 days (5-day week) minimum; 24 Werktage'], ['Sick pay', 'Full pay for 6 weeks, then Krankengeld'], ['Parental', 'Up to 3 years Elternzeit; Mutterschutz 14 weeks']],
  'Pay & tax': [['Income tax', '§32a tariff 14% – 45%; classes I – VI'], ['Soli', 'Only for higher incomes (above ≈ €20,350 tax)'], ['Church tax', '8% (BY, BW) or 9% of income tax']],
  'Social security': [['Pension', '18.6% shared, ceiling €8,450'], ['Health', '14.6% + Zusatzbeitrag shared, ceiling €5,812.50'], ['Care / unemployment', '3.6% (+0.6% childless) / 2.6%']],
  'Employment terms': [['Notice', '4 weeks, rising to 7 months with service (BGB §622)'], ['Probation', 'Up to 6 months, 2 weeks’ notice'], ['Works council', 'Co-determination on HR systems (BetrVG §87)']],
};

export function calendar(today) {
  return [
    ['Lohnsteuer-Anmeldung', 'Finanzamt', 'Monthly', monthlyDue(today, 10)],
    ['Social insurance contributions', 'Krankenkassen', 'Monthly', monthlyDue(today, 25)],
    ['Annual DEÜV report', 'Krankenkassen', 'Annual', annualDue(today, 2, 15)],
  ];
}
