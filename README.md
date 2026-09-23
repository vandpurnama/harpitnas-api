# Harpitnas API

API backend **TypeScript** untuk menyajikan data kalender **libur nasional & cuti bersama Indonesia**, dilengkapi deteksi otomatis **hari kecepit**.

Data diambil dari repositori [vandpurnama/harpitnas](https://github.com/vandpurnama/harpitnas) (hasil scraping SKB 3 Menteri) dan di-cache di memori.

**Live demo:** https://harpitnas-api-production.up.railway.app

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey?logo=express)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Versi:** 1.2.0

---

## Fitur

- Proxy data JSON dari GitHub raw (tidak perlu scraping sendiri)
- In-memory cache 1 jam
- Deteksi **hari kecepit** (hari kerja yang diapit dua hari non-kerja)
- **Cross-year aware** — otomatis fetch tahun ±1 agar boundary 31 Des / 1 Jan akurat
- Filter bulan (`?month=3`) dan tipe libur (`?type=national_holiday|joint_leave`)
- Filter **workweek** (`?workweek=mon-fri|mon-sat`) untuk definisi hari kerja
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

**`GET /api/kalender/:year`**

| Parameter | Nilai | Default | Keterangan |
|-----------|-------|---------|------------|
| `month` | `1`–`12` | — | Filter per bulan |
| `type` | `national_holiday` \| `joint_leave` \| `all` | `all` | Filter tipe libur |

**`GET /api/kalender/:year/kecepit`**

| Parameter | Nilai | Default | Keterangan |
|-----------|-------|---------|------------|
| `month` | `1`–`12` | — | Filter per bulan |
| `workweek` | `mon-fri` \| `mon-sat` | `mon-fri` | Definisi hari kerja / weekend |

#### Arti `workweek`

| Nilai | Hari kerja | Weekend | Cocok untuk |
|-------|------------|---------|-------------|
| `mon-fri` | Senin–Jumat | Sabtu + Minggu | Kantor, PNS (default) |
| `mon-sat` | Senin–**Sabtu** | Hanya Minggu | Toko, pabrik, industri 6 hari |

---

## Contoh Request

Ganti base URL sesuai environment (lokal / production).

```bash
BASE="https://harpitnas-api-production.up.railway.app"

# Info API
curl -s "$BASE/" | jq

# Health
curl -s "$BASE/health" | jq

# Index tahun
curl -s "$BASE/api/kalender" | jq

# Semua libur 2026
curl -s "$BASE/api/kalender/2026" | jq

# Hanya libur nasional bulan Maret 2026
curl -s "$BASE/api/kalender/2026?month=3&type=national_holiday" | jq

# Hari kecepit 2026 (default: Senin–Jumat)
curl -s "$BASE/api/kalender/2026/kecepit" | jq

# Hari kecepit 2027 dengan workweek Senin–Sabtu
curl -s "$BASE/api/kalender/2027/kecepit?workweek=mon-sat" | jq

# Kecepit Januari 2027, Senin–Sabtu
curl -s "$BASE/api/kalender/2027/kecepit?workweek=mon-sat&month=1" | jq
```

### Contoh Response Kecepit

```json
{
  "year": 2027,
  "total_kecepit": 5,
  "kecepit_days": [
    {
      "date": "2027-01-04",
      "day": "Senin",
      "name": "Hari Kecepit",
      "prevNonWorking": "Akhir Pekan",
      "nextNonWorking": "Isra Mikraj Nabi Muhammad S.A.W.",
      "prevDate": "2027-01-03",
      "nextDate": "2027-01-05"
    }
  ],
  "filters": {
    "workweek": "mon-fri"
  }
}
```

Dengan `?workweek=mon-sat`, **2 Januari 2027 (Sabtu)** juga masuk daftar kecepit (diapit Tahun Baru + Minggu).

---

## Definisi Hari Kecepit

Hari **kerja** (bukan libur nasional/cuti bersama, bukan weekend sesuai `workweek`) yang **kedua tetangga** (H−1 dan H+1) adalah hari non-kerja (libur atau weekend).

Contoh (mode `mon-fri`):
- Senin diapit Minggu + Selasa libur
- Jumat diapit Kamis libur + Sabtu

Contoh tambahan (mode `mon-sat`):
- Sabtu diapit Jumat libur + Minggu

Algoritma mencatat `prevDate` / `nextDate` dan nama penyebab.  
**Cross-year**: otomatis memakai data tahun tetangga (jika tersedia) agar 31 Desember / 1 Januari akurat.

---

## Error Handling

| Situasi | Status | Response |
|---------|--------|----------|
| Tahun tidak valid | `400` | `"Tahun tidak valid (rentang 2000–2100)"` |
| `month` / `type` / `workweek` salah | `400` | Pesan validasi parameter |
| Data tahun tidak ada di repo | `404` | `"Data tidak ditemukan"` |
| GitHub down / timeout | `502` | `"Gagal mengambil data dari sumber (GitHub)"` |
| Tahun tetangga tidak ada (cross-year) | `200` | Tetap jalan, fallback ke weekend check |

---

## Instalasi & Menjalankan

### Lokal

```bash
git clone https://github.com/vandpurnama/harpitnas-api.git
cd harpitnas-api
npm install
npm run dev          # development
npm run build && npm start   # production
```

Server default: `http://localhost:3000`.

### Environment Variables

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `PORT` | `3000` | Port server |
| `NODE_ENV` | `development` | `production` di production |
| `CORS_ORIGIN` | `*` | Origin CORS |
| `RATE_LIMIT_MAX` | `200` | Max request / 15 menit / IP |
| `GITHUB_RAW_BASE` | URL harpitnas | Override base URL data (opsional) |

### Docker

```bash
docker build -t harpitnas-api .
docker run -d -p 3000:3000 -e NODE_ENV=production harpitnas-api
# atau
docker compose up -d --build
```

Panduan deploy resource terbatas: lihat [DEPLOY-GUIDE.md](./DEPLOY-GUIDE.md).

---

## Struktur Project

```
harpitnas-api/
├── src/
│   ├── index.ts
│   ├── types/
│   ├── routes/kalender.ts
│   ├── services/
│   │   ├── cache.ts
│   │   ├── github.ts
│   │   └── kecepit.ts
│   ├── middleware/errorHandler.ts
│   └── utils/date.ts
├── scripts/test-kecepit.ts
├── Dockerfile
├── Dockerfile.prebuilt
├── docker-compose.yml
└── README.md
```

---

## License

MIT

## Kredit

Data libur nasional & cuti bersama bersumber dari [vandpurnama/harpitnas](https://github.com/vandpurnama/harpitnas) (hasil scraping SKB 3 Menteri).
