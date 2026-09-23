import { YearHolidays, HolidayItem, KecepitDay } from '../types';
import {
  isWeekend,
  formatDate,
  addDays,
  getDayNameId,
  getMonthFromDateStr,
  Workweek,
} from '../utils/date';

/**
 * Gabungkan semua libur dari satu atau lebih YearHolidays ke dalam satu Map.
 */
function buildHolidayMap(...yearDatas: (YearHolidays | null | undefined)[]): Map<string, HolidayItem> {
  const map = new Map<string, HolidayItem>();
  for (const yd of yearDatas) {
    if (!yd) continue;
    for (const h of yd.national_holidays) {
      map.set(h.date, h);
    }
    for (const h of yd.joint_leave) {
      map.set(h.date, h);
    }
  }
  return map;
}

/**
 * Menghitung hari kecepit untuk satu tahun.
 *
 * Definisi:
 * Hari kecepit = hari kerja (bukan libur nasional/cuti bersama, bukan weekend)
 * yang kedua hari tetangganya (H-1 dan H+1) adalah non-kerja
 * (libur nasional, cuti bersama, atau akhir pekan).
 *
 * workweek:
 * - mon-fri (default): weekend = Sabtu + Minggu
 * - mon-sat: weekend = hanya Minggu (Sabtu dihitung hari kerja)
 *
 * Cross-year:
 * - prevYearData / nextYearData opsional dipakai untuk cek boundary
 *   (31 Des butuh 1 Jan tahun berikutnya, 1-2 Jan butuh 31 Des tahun sebelumnya).
 * - Jika data tetangga tidak tersedia, fallback ke isWeekend saja.
 */
export function hitungHariKecepit(
  yearData: YearHolidays,
  monthFilter?: number,
  prevYearData?: YearHolidays | null,
  nextYearData?: YearHolidays | null,
  workweek: Workweek = 'mon-fri'
): KecepitDay[] {
  const allHolidays = buildHolidayMap(prevYearData, yearData, nextYearData);

  const kecepitList: KecepitDay[] = [];
  const year = yearData.year;

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const dateStr = formatDate(d);

    // Skip jika hari ini libur atau weekend (sesuai workweek)
    if (allHolidays.has(dateStr) || isWeekend(d, workweek)) {
      continue;
    }

    if (monthFilter !== undefined) {
      const m = d.getMonth() + 1;
      if (m !== monthFilter) continue;
    }

    const prevDate = addDays(d, -1);
    const nextDate = addDays(d, 1);
    const prevStr = formatDate(prevDate);
    const nextStr = formatDate(nextDate);

    const prevIsHoliday = allHolidays.has(prevStr);
    const nextIsHoliday = allHolidays.has(nextStr);
    const prevNonWorking = prevIsHoliday || isWeekend(prevDate, workweek);
    const nextNonWorking = nextIsHoliday || isWeekend(nextDate, workweek);

    if (prevNonWorking && nextNonWorking) {
      const prevLabel = prevIsHoliday
        ? allHolidays.get(prevStr)!.name
        : 'Akhir Pekan';
      const nextLabel = nextIsHoliday
        ? allHolidays.get(nextStr)!.name
        : 'Akhir Pekan';

      kecepitList.push({
        date: dateStr,
        day: getDayNameId(d),
        name: 'Hari Kecepit',
        prevNonWorking: prevLabel,
        nextNonWorking: nextLabel,
        prevDate: prevStr,
        nextDate: nextStr,
      });
    }
  }

  return kecepitList;
}

/**
 * Filter daftar HolidayItem berdasarkan bulan dan/atau tipe.
 */
export function filterHolidays(
  yearData: YearHolidays,
  options: { month?: number; type?: 'national_holiday' | 'joint_leave' | 'all' } = {}
): {
  national_holidays: HolidayItem[];
  joint_leave: HolidayItem[];
  total_national: number;
  total_joint_leave: number;
} {
  const { month, type = 'all' } = options;

  let national = yearData.national_holidays;
  let joint = yearData.joint_leave;

  if (month !== undefined) {
    national = national.filter((h) => getMonthFromDateStr(h.date) === month);
    joint = joint.filter((h) => getMonthFromDateStr(h.date) === month);
  }

  if (type === 'national_holiday') {
    joint = [];
  } else if (type === 'joint_leave') {
    national = [];
  }

  return {
    national_holidays: national,
    joint_leave: joint,
    total_national: national.length,
    total_joint_leave: joint.length,
  };
}
