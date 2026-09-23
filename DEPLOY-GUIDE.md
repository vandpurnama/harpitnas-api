# Panduan Deploy harpitnas-api — Server Resource Terbatas

## Diagnosis error build

```
npm error Exit handler never called!
...
sh: tsc: not found
```

Urutan kejadian:

1. Proses `npm install/ci` **dibunuh paksa (SIGKILL) oleh OOM killer**
   kernel karena container build kehabisan RAM — bukan error heap V8
   biasa. npm tidak sempat menyelesaikan cleanup-nya sendiri sehingga
   muncul bug CLI `Exit handler never called!`.
2. Karena instalasi terputus, `devDependencies` (termasuk `typescript`)
   tidak lengkap ter-install.
3. Step berikutnya (`npm run build` -> `tsc`) gagal karena binary
   `tsc` memang tidak ada: `sh: tsc: not found`.

**Cek tambahan sebelum lanjut:** bentuk log kamu (`if [ -f
package-lock.json ]; then npm ci; else npm install; fi`) khas
Nixpacks/Railpack (build otomatis Railway), bukan isi `Dockerfile`
di repo ini. Kemungkinan platform hosting **tidak memakai
`Dockerfile` custom sama sekali**. Buka pengaturan service di
platform kamu → cari opsi **Builder** → pastikan diset ke
`Dockerfile`, bukan auto-detect/Nixpacks. Kalau ini tidak dicek,
perbaikan apa pun di `Dockerfile` tidak akan pernah terpakai.

## Pilihan solusi (dari paling ringan di server)

### Tier 1 — Build di GitHub Actions, server tinggal pull image (PALING DIREKOMENDASIKAN)

Server tidak menjalankan build apa pun. Kompilasi TypeScript & build
image dilakukan gratis di runner GitHub (RAM jauh lebih besar).

1. Push project ini (sudah termasuk `.github/workflows/docker-publish.yml`)
   ke branch `main` di `vandpurnama/harpitnas-api`.
2. Actions otomatis jalan, menghasilkan image di:
   `ghcr.io/vandpurnama/harpitnas-api:latest`
3. Di platform hosting, pilih mode **"Deploy from Docker Image"**
   (bukan "Build from Dockerfile") dan isi image di atas. Kalau
   package GHCR privat, platform akan minta login — bikin Personal
   Access Token GitHub dengan scope `read:packages`, atau ubah
   visibility package ke Public via Settings di halaman package GitHub.

Cocok untuk: Back4app, Render, Railway, Fly.io, VPS mana pun yang
bisa `docker pull` + `docker run`.

### Tier 2 — `Dockerfile.prebuilt` (kalau platform WAJIB build dari Dockerfile)

```bash
npm ci
npm run build              # -> folder dist/
git add -f dist/
cp Dockerfile.prebuilt Dockerfile
git add Dockerfile package-lock.json
git commit -m "build: precompiled dist untuk deploy ringan"
git push
```

Server hanya menjalankan `npm ci --omit=dev` untuk 6 paket produksi
(axios, cors, express, express-rate-limit, helmet, morgan) — tidak
ada TypeScript sama sekali di container, resiko OOM sangat kecil.

Ingat: ulangi `npm run build` & commit ulang `dist/` setiap kali ada
perubahan di `src/`. Kalau lupa, Tier 1 lebih aman karena otomatis.

### Tier 3 — Tetap build TypeScript langsung di server

`Dockerfile` di paket ini sudah saya perbaiki dibanding versi lama:

- `NODE_OPTIONS` (pembatas memori) **dipindah** supaya hanya berlaku
  di tahap runtime, tidak lagi ikut membatasi proses `npm install`
  sendiri (yang justru bisa memicu ulang bug yang sama).
- `npm_config_include=dev` dipasang eksplisit — jaring pengaman kalau
  platform menyuntik `NODE_ENV=production` saat build (penyebab lain
  yang sangat umum untuk `tsc: not found` di banyak PaaS).
- Retry config npm (`fetch-retries`, dst.) ditambahkan untuk jaringan
  yang tidak stabil.
- Tetap pakai `npm ci` kalau lockfile ada (lebih hemat RAM daripada
  `npm install` karena tidak melakukan resolusi dependency).

Ini pilihan paling berisiko untuk server RAM sangat kecil — hanya
pakai kalau Tier 1 dan Tier 2 benar-benar tidak memungkinkan.

## Catatan lain (dari audit sebelumnya, belum diperbaiki)

Belum termasuk di paket ini — di luar topik error build kali ini,
tapi masih terbuka dari audit terakhir kalau mau dikerjakan lain waktu:

1. `hitungHariKecepit()` di `src/services/kecepit.ts` tidak memuat
   data libur tahun sebelum/sesudahnya, jadi deteksi kecepit di
   sekitar 31 Des/1 Jan bisa salah.
2. `scripts/test-kecepit.ts` berada di luar `rootDir` tsconfig — bisa
   memicu error TS6059 kalau dijalankan lewat `ts-node` langsung.

Beri tahu saya kalau mau saya perbaiki juga.

## Update — percobaan Tier 3 gagal lagi (timeout, bukan OOM lagi)

Log terbaru:
```
[builder 4/8] RUN if [ -f package-lock.json ]; ...
Build Failed: ... DeadlineExceeded: context deadline exceeded
```

Konfirmasi: platform kamu **memang** memakai `Dockerfile` custom
(logic `if/else`-nya persis dari file ini) — jadi bukan Nixpacks.
Tapi tahap install `devDependencies` (TypeScript dkk, ratusan paket
transitif) sekarang kena **batas waktu build**, bukan OOM lagi. Dua
kegagalan berbeda di tahap yang sama = builder platform ini memang
tidak sanggup untuk install devDependencies penuh, dari sisi RAM
maupun waktu.

**Kesimpulan: pakai Tier 2 (`Dockerfile.prebuilt`) sekarang.**
Langkah persis, jalankan di Termux kamu:

```bash
cd harpitnas-api
pkg install nodejs -y        # kalau belum ada nodejs di Termux
npm ci
npm run build                 # -> folder dist/ terbentuk
git add -f dist/
cp Dockerfile.prebuilt Dockerfile
git add Dockerfile package-lock.json
git commit -m "build: precompiled dist, Dockerfile ringan (fix timeout build)"
git push
```

Setelah ini, container di server platform HANYA menjalankan `npm ci
--omit=dev` untuk 6 paket produksi (tanpa TypeScript sama sekali) —
jauh lebih kecil kemungkinan kena OOM atau timeout lagi.

Retry config npm di `Dockerfile.prebuilt` juga sudah dikecilkan
(2x retry, timeout pendek) — sengaja supaya kalau memang gagal,
gagalnya cepat, bukan menghabiskan sisa waktu build platform.

Kalau Tier 2 masih tetap timeout/OOM meski cuma 6 paket ringan,
kemungkinan besar jaringan dari builder platform ke npm registry
memang sangat dibatasi (bukan soal ukuran dependency lagi) — solusi
satu-satunya yang pasti aman di titik itu adalah Tier 1 (image sudah
jadi dari GitHub Actions, server tidak install/compile apa pun).
