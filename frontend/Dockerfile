# ── Stage 1: Dependencies ─────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile

# ── Stage 2: Builder ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Accept build args for env vars baked at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STRIPE_PK
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STRIPE_PK=$NEXT_PUBLIC_STRIPE_PK

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Enable Next.js standalone output for minimal image
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: Runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public           ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["node", "server.js"]
