/** Tipe data dari repositori vandpurnama/harpitnas */

export interface HolidayItem {
  date: string; // YYYY-MM-DD
  day: string;
  name: string;
  type: 'national_holiday' | 'joint_leave';
}

export interface YearHolidays {
  year: number;
  source: string;
  scraped_at: string;
  national_holidays: HolidayItem[];
  joint_leave: HolidayItem[];
  total_national: number;
  total_joint_leave: number;
}

export interface YearIndexEntry {
  file: string;
  total_national: number;
  total_joint_leave: number;
  source_pdf?: string;
  source_sha256?: string;
  scraped_at?: string;
  complete: boolean;
}

export interface IndexData {
  years: Record<string, YearIndexEntry>;
  latest_year: number;
  next_check_after: string;
  updated_at?: string;
}

/** Response hari kecepit */
export interface KecepitDay {
  date: string;
  day: string;
  name: string;
  prevNonWorking: string;
  nextNonWorking: string;
  prevDate: string;
  nextDate: string;
}

export interface KecepitResponse {
  year: number;
  total_kecepit: number;
  kecepit_days: KecepitDay[];
  filters?: {
    month?: number;
  };
}

/** Query filter umum */
export interface CalendarQuery {
  month?: number; // 1-12
  type?: 'national_holiday' | 'joint_leave' | 'all';
}

export interface ApiError {
  error: string;
  details?: string;
}
