# Panduan Deploy harpitnas-api — Server Resource Terbatas

## Diagnosis error build

```
npm error Exit handler never called!
...
sh: tsc: not found
```

Urutan kejadian yang paling sering:

1. Proses `npm install` / `npm ci` **dibunuh paksa (SIGKILL)** oleh OOM killer
   karena container build kehabisan RAM — bukan error heap V8 biasa.
   npm tidak sempat cleanup → muncul bug CLI `Exit handler never called!`.
2. Karena instalasi terputus, `devDependencies` (termasuk `typescript`)
   tidak lengkap terpasang.
3. Step berikutnya (`npm run build` → `tsc`) gagal: `sh: tsc: not found`.

Penyebab lain yang sering muncul di PaaS:

- Platform menyuntik `NODE_ENV=production` saat **build** → `npm` mengabaikan
  `devDependencies` → TypeScript tidak terpasang.
- `NODE_OPTIONS=--max-old-space-size=...` di-set terlalu kecil **saat install**
  (membatasi proses npm sendiri, justru memicu OOM).

---

## Strategi deploy (pilih salah satu)

### Tier 1 — Image prebuilt via GitHub Actions → GHCR (paling direkomendasikan)

Build TypeScript & Docker image di **GitHub Actions** (RAM besar, gratis
untuk repo publik/privat dalam batas wajar). Platform hosting hanya
`docker pull` + run — **tidak build di server**.

1. Push repo ke GitHub (pastikan workflow `.github/workflows/docker-publish.yml` ikut).
2. Setelah workflow sukses, image ada di:
   ```
   ghcr.io/<username>/harpitnas-api:latest
   ```
3. Di platform hosting, pilih mode **Deploy from Docker Image** (bukan
   “Build from Dockerfile”), isi image di atas.
4. Jika package GHCR privat: buat Personal Access Token (`read:packages`)
   atau ubah visibility package ke Public (Settings → Package).

Cocok untuk: Back4app, Render, Railway, Fly.io, VPS, dll.

### Tier 2 — `Dockerfile.prebuilt` (platform wajib build dari Dockerfile)

Build di komputer lokal, commit folder `dist/`:

```bash
npm ci
npm run build              # -> folder dist/
git add -f dist/
cp Dockerfile.prebuilt Dockerfile
git add Dockerfile package-lock.json
git commit -m "build: precompiled dist untuk deploy ringan"
git push
```

Server hanya menjalankan `npm ci --omit=dev` untuk dependency produksi
(axios, cors, express, express-rate-limit, helmet, morgan) — **tidak ada
TypeScript di container**, risiko OOM sangat kecil.

Ulangi `npm run build` + commit `dist/` setiap ada perubahan di `src/`.
Kalau sering lupa, pakai **Tier 1** (otomatis via CI).

### Tier 3 — Build TypeScript langsung di server (paling berisiko)

Hanya jika Tier 1 dan Tier 2 tidak memungkinkan. `Dockerfile` multi-stage
sudah diperbaiki:

- `NODE_OPTIONS` **hanya** di tahap runtime (tidak membatasi `npm install`)
- `npm_config_include=dev` — jaring pengaman jika `NODE_ENV=production` disuntik saat build
- Retry npm untuk jaringan tidak stabil
- `npm ci --include=dev` jika lockfile ada

Di server dengan RAM sangat kecil (mis. 256 MB) opsi ini tetap rawan OOM.

---

## Railway tanpa Docker (alternatif)

Jika Docker build tetap gagal di Railway:

1. Settings service → **Builder: Nixpacks** (atau Railpack), **bukan Dockerfile**
2. Build Command: `npm ci && npm run build`
3. Start Command: `npm start`
4. Pastikan Node 20

Kadang lebih stabil daripada Docker di free tier.

---

## Checklist sebelum deploy

- [ ] `package-lock.json` versi sinkron dengan `package.json` (1.1.2)
- [ ] Pilih Tier 1 / 2 / 3 sesuai platform
- [ ] Env opsional: `PORT`, `NODE_ENV=production`, `CORS_ORIGIN`, `RATE_LIMIT_MAX`
- [ ] Health check path: `/health`

---

## Status fitur kode (sudah ada)

| Fitur | Status |
|-------|--------|
| Deteksi hari kecepit | ✅ |
| Cross-year boundary (31 Des / 1 Jan) | ✅ `getYearDataOptional` + merge map |
| Filter `?month=` & `?type=` | ✅ |
| Cache in-memory 1 jam | ✅ |
| Rate limit, Helmet, CORS | ✅ |
| Graceful shutdown | ✅ |

Tidak perlu mengubah logic API untuk masalah deploy ini.
