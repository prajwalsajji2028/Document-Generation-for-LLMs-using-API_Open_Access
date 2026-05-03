# ── Build stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Copy source
COPY . .

# Run tests during build to catch regressions
RUN npm test

# Prune dev dependencies
RUN npm prune --production

# ── Production stage ───────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Security: run as non-root
RUN addgroup -g 1001 -S docxforge && \
    adduser -S docxforge -u 1001 -G docxforge

# Copy production artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src

# Environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    REDIS_HOST=redis \
    REDIS_PORT=6379

EXPOSE 3000

USER docxforge

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/v1/health || exit 1

CMD ["node", "src/server.js"]
