import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import kalenderRouter from './routes/kalender';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { getCacheStats, clearCache } from './services/cache';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust first proxy (Nginx, Cloudflare, dll) agar rate-limit melihat IP asli
app.set('trust proxy', 1);

// ---------- Security & Middleware ----------
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'OPTIONS'],
  })
);
app.use(express.json());
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting — proteksi GitHub raw
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: Number(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request, coba lagi nanti' },
});
app.use('/api/', limiter);

// ---------- Health & Info ----------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cache: getCacheStats(), // hanya size, tidak expose URL
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Harpitnas API',
    version: '1.2.0',
    description: 'API kalender libur nasional & cuti bersama Indonesia + deteksi hari kecepit',
    endpoints: {
      'GET /api/kalender': 'Daftar tahun tersedia (index)',
      'GET /api/kalender/:year': 'Data libur + cuti bersama (support ?month=&type=)',
      'GET /api/kalender/:year/kecepit': 'Daftar hari kecepit (support ?month=&workweek=mon-fri|mon-sat)',
      'GET /health': 'Health check + cache stats',
    },
    source: 'https://github.com/vandpurnama/harpitnas',
  });
});

// Optional: clear cache (hanya non-production atau dengan secret)
if (NODE_ENV !== 'production') {
  app.post('/admin/clear-cache', (_req, res) => {
    clearCache();
    res.json({ message: 'Cache cleared' });
  });
}

// ---------- Routes ----------
app.use('/api/kalender', kalenderRouter);

// ---------- Error handlers ----------
app.use(notFoundHandler);
app.use(errorHandler);

// ---------- Start ----------
const server = app.listen(PORT, () => {
  console.log(`✅ Harpitnas API berjalan di http://localhost:${PORT}`);
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\n${signal} diterima, menutup server...`);
  server.close(() => {
    console.log('Server ditutup dengan bersih.');
    process.exit(0);
  });
  // Force exit jika belum selesai dalam 10 detik
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
