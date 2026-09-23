import { Router, Request, Response, NextFunction } from 'express';
import { getIndexData, getYearData, getYearDataOptional } from '../services/github';
import { hitungHariKecepit, filterHolidays } from '../services/kecepit';
import { isValidYear, isValidMonth, isValidWorkweek, Workweek } from '../utils/date';
import { KecepitResponse } from '../types';

const router = Router();

/**
 * GET /api/kalender
 * Mengembalikan index.json (daftar tahun yang tersedia)
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const index = await getIndexData();
    res.set('Cache-Control', 'public, max-age=300');
    res.json(index);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/kalender/:year
 * Query opsional:
 *   - month=1..12   → filter bulan
 *   - type=national_holiday|joint_leave|all  (default: all)
 */
router.get('/:year', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const year = Number(req.params.year);
    if (!isValidYear(year)) {
      res.status(400).json({ error: 'Tahun tidak valid (rentang 2000–2100)' });
      return;
    }

    const monthParam = req.query.month ? Number(req.query.month) : undefined;
    if (monthParam !== undefined && !isValidMonth(monthParam)) {
      res.status(400).json({ error: 'Parameter month harus 1–12' });
      return;
    }

    const typeParam = (req.query.type as string) || 'all';
    if (!['national_holiday', 'joint_leave', 'all'].includes(typeParam)) {
      res.status(400).json({
        error: 'Parameter type harus salah satu: national_holiday, joint_leave, all',
      });
      return;
    }

    const yearData = await getYearData(year);

    res.set('Cache-Control', 'public, max-age=300');

    if (monthParam === undefined && typeParam === 'all') {
      res.json(yearData);
      return;
    }

    const filtered = filterHolidays(yearData, {
      month: monthParam,
      type: typeParam as 'national_holiday' | 'joint_leave' | 'all',
    });

    res.json({
      year: yearData.year,
      source: yearData.source,
      scraped_at: yearData.scraped_at,
      ...filtered,
      filters: {
        month: monthParam ?? null,
        type: typeParam,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/kalender/:year/kecepit
 * Query opsional:
 *   - month=1..12
 *   - workweek=mon-fri|mon-sat  (default: mon-fri)
 *       mon-fri → weekend = Sabtu+Minggu (standar kantor)
 *       mon-sat → weekend = hanya Minggu (Sabtu = hari kerja)
 *
 * Cross-year: otomatis fetch tahun ±1 (jika tersedia).
 */
router.get('/:year/kecepit', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const year = Number(req.params.year);
    if (!isValidYear(year)) {
      res.status(400).json({ error: 'Tahun tidak valid (rentang 2000–2100)' });
      return;
    }

    const monthParam = req.query.month ? Number(req.query.month) : undefined;
    if (monthParam !== undefined && !isValidMonth(monthParam)) {
      res.status(400).json({ error: 'Parameter month harus 1–12' });
      return;
    }

    const workweekRaw = (req.query.workweek as string) || 'mon-fri';
    if (!isValidWorkweek(workweekRaw)) {
      res.status(400).json({
        error: 'Parameter workweek harus mon-fri atau mon-sat',
      });
      return;
    }
    const workweek: Workweek = workweekRaw;

    const [yearData, prevYearData, nextYearData] = await Promise.all([
      getYearData(year),
      getYearDataOptional(year - 1),
      getYearDataOptional(year + 1),
    ]);

    const kecepit = hitungHariKecepit(
      yearData,
      monthParam,
      prevYearData,
      nextYearData,
      workweek
    );

    res.set('Cache-Control', 'public, max-age=300');

    const response: KecepitResponse = {
      year,
      total_kecepit: kecepit.length,
      kecepit_days: kecepit,
      filters: {
        workweek,
        ...(monthParam !== undefined ? { month: monthParam } : {}),
      },
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
