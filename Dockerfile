# ---------- Build stage ----------
# Optimasi untuk free tier rendah memori (256MB)
FROM node:20-alpine AS builder

WORKDIR /app

# Batasi memori Node saat install (penting di free tier)
ENV NODE_OPTIONS="--max-old-space-size=180"

COPY package.json package-lock.json* ./

# Install semua dependency (termasuk dev untuk tsc)
# --prefer-offline + --no-audit mengurangi beban
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript
RUN npm run build

# Hapus devDependencies setelah build (hemat ukuran image)
RUN npm prune --omit=dev && npm cache clean --force

# ---------- Production stage ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Salin hasil build + node_modules production dari builder
# (hindari npm install kedua yang boros memori)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# wget untuk healthcheck (opsional, boleh dihapus jika platform sudah punya healthcheck)
RUN apk add --no-cache wget \
    && addgroup -g 1001 -S nodejs \
    && adduser -S harpitnas -u 1001 -G nodejs

USER harpitnas

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/index.js"]
