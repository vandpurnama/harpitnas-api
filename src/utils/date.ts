/**
 * Utilitas tanggal (timezone-agnostic, menggunakan local Date constructor
 * dengan year/month/day agar tidak terpengaruh timezone server).
 */

/** Mapping hari deterministic — tidak bergantung pada locale system (penting di Alpine Docker) */
const DAY_NAMES_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

/** Mode minggu kerja */
export type Workweek = 'mon-fri' | 'mon-sat';

/**
 * Apakah tanggal termasuk akhir pekan, tergantung mode workweek.
 * - mon-fri: Sabtu + Minggu
 * - mon-sat: hanya Minggu
 */
export function isWeekend(date: Date, workweek: Workweek = 'mon-fri'): boolean {
  const day = date.getDay(); // 0 = Minggu, 6 = Sabtu
  if (workweek === 'mon-sat') {
    return day === 0; // hanya Minggu
  }
  return day === 0 || day === 6;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getMonthFromDateStr(dateStr: string): number {
  return Number(dateStr.split('-')[1]);
}

/** Nama hari dalam Bahasa Indonesia (deterministic, tanpa locale) */
export function getDayNameId(date: Date): string {
  return DAY_NAMES_ID[date.getDay()];
}

export function isValidMonth(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

export function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
}

export function isValidWorkweek(value: string): value is Workweek {
  return value === 'mon-fri' || value === 'mon-sat';
}
