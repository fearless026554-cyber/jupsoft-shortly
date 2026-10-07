# ==============================================================================
# Jupsoft Shortly - Frontend Next.js Production Dockerfile
# Monorepo reproducible build with build-time NEXT_PUBLIC_ inlining, non-root security & healthcheck
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Compilation
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Pin corepack and pnpm version for reproducible builds
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy monorepo workspace manifests & lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/

# Install dependencies including build-time devDependencies (Tailwind, PostCSS, TypeScript)
RUN pnpm --filter frontend install --frozen-lockfile --ignore-scripts --prod=false

# Copy frontend source code
COPY frontend ./frontend

# Build-time environment variables inlined by Next.js Turbopack / Webpack
ARG NEXT_PUBLIC_DEFAULT_SHORT_DOMAIN
ARG NEXT_PUBLIC_CNAME_DOMAIN
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

ENV NEXT_PUBLIC_DEFAULT_SHORT_DOMAIN=$NEXT_PUBLIC_DEFAULT_SHORT_DOMAIN
ENV NEXT_PUBLIC_CNAME_DOMAIN=$NEXT_PUBLIC_CNAME_DOMAIN
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NODE_ENV=production

# Build Next.js standalone application
RUN pnpm --filter frontend build

# ------------------------------------------------------------------------------
# Stage 2: Hardened Production Runtime (Standalone)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5000
ENV HOSTNAME="0.0.0.0"

# Copy standalone distribution from builder stage
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

# Non-root user security: Configure permissions for default unprivileged node user
RUN chown -R node:node /app

WORKDIR /app/frontend

# Switch to unprivileged non-root user
USER node

EXPOSE 5000

# Container healthcheck verifying Next.js HTTP server responsiveness
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/login > /dev/null || exit 1

CMD ["node", "server.js"]
