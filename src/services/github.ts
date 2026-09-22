import axios, { AxiosError } from 'axios';
import { getFromCache, setCache } from './cache';
import { IndexData, YearHolidays } from '../types';

const GITHUB_RAW_BASE =
  process.env.GITHUB_RAW_BASE ||
  'https://raw.githubusercontent.com/vandpurnama/harpitnas/main/kalender';

const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam

async function fetchWithCache<T>(url: string): Promise<T> {
  const cached = getFromCache<T>(url);
  if (cached !== null) {
    return cached;
  }

  try {
    const { data } = await axios.get<T>(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': 'harpitnas-api/1.1 (https://github.com/vandpurnama/harpitnas)',
        Accept: 'application/json',
      },
    });
    setCache(url, data, CACHE_TTL_MS);
    return data;
  } catch (err) {
    const error = err as AxiosError;
    if (error.response?.status === 404) {
      throw Object.assign(new Error('NOT_FOUND'), { status: 404 });
    }
    throw Object.assign(new Error('UPSTREAM_ERROR'), {
      status: 502,
      cause: error.message,
    });
  }
}

export async function getIndexData(): Promise<IndexData> {
  const url = `${GITHUB_RAW_BASE}/index.json`;
  return fetchWithCache<IndexData>(url);
}

export async function getYearData(year: number): Promise<YearHolidays> {
  const url = `${GITHUB_RAW_BASE}/holidays-${year}.json`;
  return fetchWithCache<YearHolidays>(url);
}

/**
 * Ambil data tahun tanpa melempar error jika 404.
 * Berguna untuk cross-year boundary (tahun tetangga mungkin belum ada).
 */
export async function getYearDataOptional(year: number): Promise<YearHolidays | null> {
  try {
    return await getYearData(year);
  } catch (err: any) {
    if (err?.status === 404 || err?.message === 'NOT_FOUND') {
      return null;
    }
    throw err;
  }
}
