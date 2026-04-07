# ── Stage 1: Build ────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --frozen-lockfile

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ── Stage 2: Production image ──────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root
RUN addgroup -S veramed && adduser -S veramed -G veramed

WORKDIR /app

# Copy only production artifacts
COPY --from=builder --chown=veramed:veramed /app/dist        ./dist
COPY --from=builder --chown=veramed:veramed /app/node_modules ./node_modules
COPY --from=builder --chown=veramed:veramed /app/package.json ./
COPY --from=builder --chown=veramed:veramed /app/prisma      ./prisma

# Create logs directory
RUN mkdir -p logs && chown veramed:veramed logs

USER veramed

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]
