import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' } satisfies ApiError);
}

export function errorHandler(
  err: Error & { status?: number; cause?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[ERROR]', err.message, err.cause || '');

  const status = err.status || 500;
  const body: ApiError = {
    error:
      status === 404
        ? err.message === 'NOT_FOUND'
          ? 'Data tidak ditemukan'
          : err.message
        : status === 502
          ? 'Gagal mengambil data dari sumber (GitHub)'
          : 'Terjadi kesalahan internal server',
  };

  if (process.env.NODE_ENV !== 'production' && err.cause) {
    body.details = String(err.cause);
  }

  res.status(status).json(body);
}
