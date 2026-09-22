# Harpitnas API

API backend **TypeScript** untuk menyajikan data kalender **libur nasional & cuti bersama Indonesia**, dilengkapi deteksi otomatis **hari kecepit**.

Data diambil dari repositori [vandpurnama/harpitnas](https://github.com/vandpurnama/harpitnas) (hasil scraping SKB 3 Menteri) dan di-cache di memori.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey?logo=express)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Fitur

- Proxy data JSON dari GitHub raw (tidak perlu scraping sendiri)
- In-memory cache 1 jam
- Deteksi **hari kecepit** (hari kerja yang diapit dua hari non-kerja)
- **Cross-year aware** — otomatis fetch tahun ±1 agar boundary 31 Des / 1 Jan akurat
- Filter bulan (`?month=3`) dan tipe libur (`?type=national_holiday|joint_leave`)
- Rate limiting, Helmet, CORS, logging
- Health check endpoint
- Docker-ready (multi-stage build + docker-compose)
- TypeScript strict + struktur modular

---

## Endpoint

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/` | Info API & daftar endpoint |
| `GET` | `/health` | Health check + statistik cache |
| `GET` | `/api/kalender` | Index tahun yang tersedia |
| `GET` | `/api/kalender/:year` | Data libur + cuti bersama |
| `GET` | `/api/kalender/:year/kecepit` | Daftar hari kecepit |

### Query Parameters

**`/api/kalender/:year`**

| Parameter | Nilai | Keterangan |
|-----------|-------|------------|
| `month` | `1`–`12` | Filter per bulan |
| `type` | `national_holiday` \| `joint_leave` \| `all` | Filter tipe libur (default: `all`) |

**`/api/kalender/:year/kecepit`**

| Parameter | Nilai | Keterangan |
|-----------|-------|------------|
| `month` | `1`–`12` | Filter per bulan |

### Contoh Request

```bash
# Index tahun
curl https://your-api.example.com/api/kalender

# Semua libur 2026
curl https://your-api.example.com/api/kalender/2026

# Hanya libur nasional bulan Maret 2026
curl "https://your-api.example.com/api/kalender/2026?month=3&type=national_holiday"

# Hari kecepit 2026
curl https://your-api.example.com/api/kalender/2026/kecepit

# Hari kecepit bulan Maret 2026
curl "https://your-api.example.com/api/kalender/2026/kecepit?month=3"
```

### Contoh Response Kecepit

```json
{
  "year": 2026,
  "total_kecepit": 4,
  "kecepit_days": [
    {
      "date": "2026-02-16",
      "day": "Senin",
      "name": "Hari Kecepit",
      "prevNonWorking": "Akhir Pekan",
      "nextNonWorking": "Tahun Baru Imlek 2577 Kongzili",
      "prevDate": "2026-02-15",
      "nextDate": "2026-02-17"
    }
  ]
}
```

---

## Definisi Hari Kecepit

Hari kerja (bukan libur nasional/cuti bersama, bukan Sabtu/Minggu) yang **kedua tetangga** (H-1 dan H+1) adalah hari non-kerja (libur atau weekend).

Contoh klasik:
- Senin yang diapit Minggu (weekend) + Selasa (libur nasional)
- Jumat yang diapit Kamis (libur) + Sabtu (weekend)

Algoritma juga mencatat `prevDate` / `nextDate` dan nama penyebab untuk transparansi.  
**Cross-year**: otomatis memakai data tahun tetangga (jika tersedia) agar 31 Desember / 1 Januari terklasifikasi dengan benar.

---

## Instalasi & Menjalankan

### Lokal

```bash
# Clone
git clone https://github.com/USERNAME/harpitnas-api.git
cd harpitnas-api

# Install dependencies
npm install

# Development (hot reload)
npm run dev

# Production
npm run build
npm start

# Uji algoritma kecepit
npm run test:kecepit
# atau tahun tertentu
npx ts-node --transpile-only scripts/test-kecepit.ts 2027
```

Server default berjalan di `http://localhost:3000`.

### Environment Variables

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `PORT` | `3000` | Port server |
| `NODE_ENV` | `development` | `production` untuk mode production |
| `CORS_ORIGIN` | `*` | Origin yang diizinkan CORS |
| `RATE_LIMIT_MAX` | `200` | Max request per 15 menit per IP |
| `GITHUB_RAW_BASE` | URL default harpitnas | Override base URL data (opsional) |

Salin `.env.example` menjadi `.env` jika ingin mengubah nilai default.

---

## Docker

### Build & Run

```bash
docker build -t harpitnas-api .
docker run -d \
  --name harpitnas-api \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e RATE_LIMIT_MAX=300 \
  harpitnas-api
```

### Docker Compose

```bash
docker compose up -d --build
docker compose logs -f
docker compose down
```

---

## Struktur Project

```
harpitnas-api/
├── src/
│   ├── index.ts                 # Entry point Express + middleware
│   ├── types/
│   │   └── index.ts             # Interface TypeScript
│   ├── routes/
│   │   └── kalender.ts          # Route handlers + validasi query
│   ├── services/
│   │   ├── cache.ts             # In-memory cache (TTL 1 jam)
│   │   ├── github.ts            # Fetch + cache data dari GitHub
│   │   └── kecepit.ts           # Algoritma hari kecepit + filter
│   ├── middleware/
│   │   └── errorHandler.ts      # 404 & error handler
│   └── utils/
│       └── date.ts              # Helper tanggal (timezone-safe)
├── scripts/
│   └── test-kecepit.ts          # Script uji algoritma
├── Dockerfile                   # Multi-stage production build
├── docker-compose.yml
├── .dockerignore
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## Error Handling

| Situasi | Status | Response |
|---------|--------|----------|
| Tahun tidak valid | `400` | `"Tahun tidak valid (rentang 2000–2100)"` |
| Data tahun tidak ada di repo | `404` | `"Data tidak ditemukan"` |
| GitHub down / timeout | `502` | `"Gagal mengambil data dari sumber (GitHub)"` |
| Tahun tetangga tidak ada (cross-year) | `200` | Tetap jalan, fallback ke weekend check |

---

## Catatan Teknis

- Data sumber di-update otomatis oleh GitHub Actions di repositori [vandpurnama/harpitnas](https://github.com/vandpurnama/harpitnas). API ini hanya mem-proxy + menghitung kecepit.
- Cache in-memory hilang saat restart. Untuk produksi skala besar, ganti dengan Redis.
- Validasi tahun dibatasi 2000–2100.
- Rate limit default 200 req / 15 menit per IP.
- Di development tersedia `POST /admin/clear-cache`.

---

## Deploy Gratis (tanpa kartu kredit)

Rekomendasi platform free tier yang mendukung Node.js / Docker:

| Platform | Catatan |
|----------|---------|
| [Render](https://render.com) | Paling praktis. 750 jam/bulan, sleep setelah 15 menit idle |
| [Koyeb](https://www.koyeb.com) | Support Docker, free tier permanen |
| [Railway](https://railway.app) | Free plan + $1 credit/bulan |

Contoh deploy ke **Render**:
1. Push repo ke GitHub
2. New → Web Service → Connect repo
3. Build: `npm install && npm run build`
4. Start: `npm start`
5. Atau pilih **Docker**

---

## License

MIT

---

## Kredit

Data libur nasional & cuti bersama bersumber dari [vandpurnama/harpitnas](https://github.com/vandpurnama/harpitnas) (hasil scraping SKB 3 Menteri).
