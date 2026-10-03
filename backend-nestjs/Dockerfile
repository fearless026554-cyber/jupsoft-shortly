FROM node:20-alpine AS builder

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json ./
RUN pnpm install --ignore-scripts

# Copy source code and build
COPY . .
RUN pnpm build

# Production image
FROM node:20-alpine

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json ./
RUN pnpm install --prod --ignore-scripts

COPY --from=builder /app/dist ./dist

# Start the application
CMD ["node", "dist/main.js"]
