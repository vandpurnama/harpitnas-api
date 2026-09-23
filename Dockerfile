# Multi-stage — TIER 3: build TypeScript langsung di server.
# Hanya pakai opsi ini kalau Tier 1 (image prebuilt via CI) atau
# Tier 2 (Dockerfile.prebuilt) tidak memungkinkan di platform kamu.
# Untuk server dengan RAM sangat terbatas, opsi ini PALING BERISIKO
# karena tahap "npm install" (devDependencies: typescript, ts-node,
# nodemon, @types/*) butuh RAM lebih besar daripada tahap runtime.
FROM node:20-alpine AS builder

WORKDIR /app

# PENTING: NODE_OPTIONS TIDAK di-set di sini.
# Membatasi heap V8 justru berisiko membuat proses npm sendiri
# (yang juga proses Node) kehabisan memori dan ter-kill paksa oleh
# kernel OOM killer -> memicu bug npm "Exit handler never called!"
# -> instalasi devDependencies (termasuk typescript) gagal diam-diam
# -> "tsc: not found" di step build.

ENV npm_config_fund=false
ENV npm_config_audit=false
ENV npm_config_update_notifier=false
# Jaring pengaman: paksa devDependencies TETAP terinstal walau ada
# variabel NODE_ENV=production yang disuntik platform saat build
# (penyebab umum lain dari "tsc: not found" di banyak PaaS).
ENV npm_config_include=dev
# Kurangi kegagalan akibat jaringan tidak stabil di server terbatas.
ENV npm_config_fetch_retries=5
ENV npm_config_fetch_retry_mintimeout=20000
ENV npm_config_fetch_retry_maxtimeout=120000

COPY package.json package-lock.json ./

# npm ci lebih ringan & deterministik daripada npm install (tidak
# melakukan resolusi dependency, cukup ikuti lockfile persis) -
# pakai itu kalau lockfile ada, fallback ke npm install kalau tidak.
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund --include=dev; \
    else \
      npm install --no-audit --no-fund --include=dev; \
    fi

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc

# Buang devDependencies SETELAH build selesai
RUN npm prune --omit=dev && npm cache clean --force

# ---------- Production ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Cap memori HANYA untuk proses runtime aplikasi, bukan proses build.
ENV NODE_OPTIONS="--max-old-space-size=192"

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN apk add --no-cache wget \
    && addgroup -g 1001 -S nodejs \
    && adduser -S harpitnas -u 1001 -G nodejs

USER harpitnas

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/index.js"]
