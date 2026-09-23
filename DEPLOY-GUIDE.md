# Panduan Deploy harpitnas-api

## Diagnosis error build (GitHub Actions / Railway / Back4app)

### Error 1: `npm error Exit handler never called!`

Penyebab yang sering:

1. **`package-lock.json` mengarah ke registry yang salah**  
   Lockfile yang di-generate di environment tertentu bisa berisi URL mirror
   internal (bukan `registry.npmjs.org`). Di GitHub Actions URL itu tidak
   reachable → npm hang ber menit-menit → crash.
2. OOM di container kecil (Back4app 256MB) saat install devDependencies.
3. Bug npm CLI saat proses di-kill paksa.

**Perbaikan di paket ini:**
- Semua `resolved` di lockfile memakai `https://registry.npmjs.org/`
- TypeScript di-pin ke `5.6.2` (exact, tanpa `^`)
- Workflow memakai `npm install` (bukan hanya `npm ci`) + verifikasi `tsc`

### Error 2: `TS5108: Option 'moduleResolution=node10' has been removed`

Penyebab: `typescript: "^5.6.2"` bisa ter-resolve ke TypeScript 6.x yang
menghapus `moduleResolution: "node"`.

**Perbaikan:**
- Pin `typescript: "5.6.2"`
- Hapus opsi `moduleResolution` usang dari `tsconfig.json`

---

## Strategi deploy

### Tier 1 — GitHub Actions → GHCR (direkomendasikan)

1. Push repo (pastikan workflow + lockfile terbaru ikut).
2. Tab **Actions** → tunggu workflow sukses.
3. Image: `ghcr.io/<username>/harpitnas-api:latest`
4. Di platform: **Deploy from Docker Image** (bukan build Dockerfile).
5. Jika package privat: PAT `read:packages` atau ubah visibility ke Public.

### Tier 2 — Prebuilt `dist/` + Dockerfile.prebuilt

```bash
npm install
npm run build
git add -f dist/
cp Dockerfile.prebuilt Dockerfile
git commit -m "build: precompiled dist" && git push
```

### Tier 3 — Build di server (berisiko di RAM kecil)

Pakai `Dockerfile` multi-stage. Hanya jika Tier 1/2 tidak memungkinkan.

### Railway tanpa Docker

- Builder: Nixpacks
- Build: `npm install && npm run build`
- Start: `npm start`
- Node 20

---

## Checklist

- [ ] `package-lock.json` resolved URL = `registry.npmjs.org` (bukan IP internal)
- [ ] `typescript` di package.json = `"5.6.2"` (tanpa `^`)
- [ ] Health check: `/health`
- [ ] Env opsional: `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `RATE_LIMIT_MAX`

## Fitur kode (sudah ada)

| Fitur | Status |
|-------|--------|
| Deteksi hari kecepit | ✅ |
| Cross-year (31 Des / 1 Jan) | ✅ |
| Filter month & type | ✅ |
| Cache, rate limit, helmet | ✅ |
