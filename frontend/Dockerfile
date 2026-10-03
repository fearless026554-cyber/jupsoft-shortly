FROM node:20-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Check if Next.js telemetry is disabled
ENV NEXT_TELEMETRY_DISABLED 1

COPY package.json ./
RUN pnpm install

COPY . .
RUN pnpm build

FROM node:20-alpine

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 5000
ENV PORT 5000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
