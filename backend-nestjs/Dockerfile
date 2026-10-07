# ==============================================================================
# Jupsoft Shortly - Backend NestJS Production Dockerfile
# Monorepo reproducible build with pinned dependencies, non-root security & healthcheck
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Compilation
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Pin corepack and pnpm version for reproducible builds
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy monorepo workspace manifests & lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend-nestjs/package.json ./backend-nestjs/

# Install dependencies strictly with frozen lockfile
RUN pnpm --filter backend-nestjs install --frozen-lockfile --ignore-scripts --prod=false

# Copy backend source code and build artifacts
COPY backend-nestjs ./backend-nestjs
RUN pnpm --filter backend-nestjs build

# ------------------------------------------------------------------------------
# Stage 2: Hardened Production Runtime
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install curl for reliable container health checking
RUN apk add --no-cache curl

# Enable pinned pnpm runtime
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy workspace manifests for production-only dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend-nestjs/package.json ./backend-nestjs/

# Install only production dependencies strictly from lockfile
RUN pnpm --filter backend-nestjs install --prod --frozen-lockfile --ignore-scripts

# Copy compiled backend distribution from builder stage
COPY --from=builder /app/backend-nestjs/dist ./backend-nestjs/dist

# Non-root user security: Use existing 'node' user or configure ownership
RUN chown -R node:node /app

WORKDIR /app/backend-nestjs

# Switch to unprivileged non-root user
USER node

EXPOSE 3000

# Container healthcheck testing /health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/main.js"]
