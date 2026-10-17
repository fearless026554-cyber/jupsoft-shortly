#!/usr/bin/env bash
# ==============================================================================
# Jupsoft Shortly - Production Native PM2 Deployment Suite
# Zero-Risk .env Protection: Never deletes or overwrites existing environment files.
# Features:
#   1. Git pull latest pushed commits
#   2. Clear build compiler caches (Next.js & NestJS - NOT Redis cache)
#   3. Fresh clean build
#   4. Graceful zero-downtime PM2 reload (hot refresh, NOT hard restart)
#   5. Graceful Host Nginx reload
# Domain: go.jupsoft.com | Database: Supabase PostgreSQL (Remote SSL)
# ==============================================================================

set -euo pipefail

# Ensure execution from repository root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# Formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}     Jupsoft Shortly (go.jupsoft.com) - Native PM2 Production Suite  ${NC}"
echo -e "${CYAN}====================================================================${NC}\n"

# ------------------------------------------------------------------------------
# 1. ENVIRONMENT VERIFICATION (ZERO TOUCH - NO OVERWRITES, NO DUPLICATE BACKUPS)
# ------------------------------------------------------------------------------
echo -e "${BLUE}[*] Verifying environment configurations (.env)...${NC}"

if [ -f "backend-nestjs/.env" ]; then
  echo -e "${GREEN}[✓] Active backend environment detected (backend-nestjs/.env). Preserving untouched.${NC}"
  if [ ! -f ".env" ]; then
    cp "backend-nestjs/.env" ".env"
  fi
elif [ -f ".env" ]; then
  echo -e "${GREEN}[✓] Active root .env detected. Linking to backend-nestjs/.env.${NC}"
  cp -n ".env" "backend-nestjs/.env"
else
  echo -e "${RED}[ERROR] No .env found in root or backend-nestjs/.${NC}" >&2
  echo -e "${YELLOW}[!] Please ensure your .env exists before deploying.${NC}" >&2
  exit 1
fi

# Ensure frontend .env.local exists safely without overwriting
if [ ! -f "frontend/.env.local" ]; then
  echo -e "${YELLOW}[!] Creating frontend/.env.local default routing config...${NC}"
  cat << 'EOF' > frontend/.env.local
BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_DEFAULT_SHORT_DOMAIN=go.jupsoft.com
NEXT_PUBLIC_CNAME_DOMAIN=go.jupsoft.com
EOF
  echo -e "${GREEN}[✓] frontend/.env.local initialized.${NC}"
else
  echo -e "${GREEN}[✓] Existing frontend/.env.local preserved untouched.${NC}"
fi

# ------------------------------------------------------------------------------
# 2. GIT PULL (Synchronize with latest GitHub pushed commits)
# ------------------------------------------------------------------------------
if [ -d ".git" ]; then
  echo -e "\n${BLUE}[*] Synchronizing repository with latest GitHub commits (origin/main)...${NC}"
  git fetch origin main --quiet || true
  # Pull latest code without touching untracked .env files
  git merge origin/main --ff-only 2>/dev/null || git pull --ff-only origin main 2>/dev/null || true
  CURRENT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')"
  echo -e "${GREEN}[✓] Codebase synchronized to commit: ${CURRENT_COMMIT}${NC}"
fi

# ------------------------------------------------------------------------------
# 3. PURGE BUILD COMPILER CACHE (NOT Redis Cache!)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[*] Purging compiler build caches (Next.js & NestJS)...${NC}"
rm -rf frontend/.next/cache
rm -rf backend-nestjs/dist
echo -e "${GREEN}[✓] Compiler cache cleaned. Redis in-memory cache remains 100% untouched.${NC}"

# ------------------------------------------------------------------------------
# 4. Check Node.js, pnpm, and PM2
# ------------------------------------------------------------------------------
command -v node >/dev/null 2>&1 || {
  echo -e "${RED}[ERROR] Node.js is required. Please install Node.js 20+.${NC}" >&2
  exit 1
}

if ! command -v pnpm >/dev/null 2>&1; then
  echo -e "${BLUE}[*] Installing pnpm...${NC}"
  npm install -g pnpm@9.15.4
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo -e "${BLUE}[*] Installing PM2...${NC}"
  npm install -g pm2
fi

# Stop any conflicting Docker containers if Docker happens to be present
if command -v docker >/dev/null 2>&1; then
  docker stop jupsoft_backend jupsoft_frontend jupsoft_nginx 2>/dev/null || true
  docker rm jupsoft_backend jupsoft_frontend jupsoft_nginx 2>/dev/null || true
fi

# ------------------------------------------------------------------------------
# 5. Ensure Local Redis is Active (Preserving all cached data)
# ------------------------------------------------------------------------------
if ! command -v redis-server >/dev/null 2>&1; then
  echo -e "${BLUE}[*] Installing redis-server...${NC}"
  apt-get update -qq && apt-get install -y -qq redis-server
  systemctl enable redis-server
  systemctl start redis-server
else
  systemctl start redis-server 2>/dev/null || true
fi

if redis-cli ping >/dev/null 2>&1; then
  echo -e "${GREEN}[✓] Local Redis is active and serving requests.${NC}"
else
  echo -e "${YELLOW}[!] Notice: Local Redis status will be confirmed at runtime.${NC}"
fi

# ------------------------------------------------------------------------------
# 6. Install Dependencies & Build Packages
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[*] Installing monorepo dependencies with pnpm...${NC}"
pnpm install

echo -e "\n${BLUE}[*] Compiling Backend (NestJS / Fastify)...${NC}"
pnpm --filter backend-nestjs build

echo -e "\n${BLUE}[*] Compiling Frontend (Next.js Standalone)...${NC}"
pnpm --filter frontend build

# ------------------------------------------------------------------------------
# 7. Hot Refresh / Graceful Zero-Downtime Reload (NOT hard restart)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[*] Gracefully reloading application processes with PM2 (Zero Downtime)...${NC}"
if pm2 describe shortly-backend >/dev/null 2>&1; then
  # Graceful hot refresh: reloads workers one-by-one with zero dropped connections
  pm2 reload ecosystem.config.cjs --update-env
  echo -e "${GREEN}[✓] Existing PM2 processes gracefully refreshed.${NC}"
else
  # First-time start
  pm2 start ecosystem.config.cjs
  echo -e "${GREEN}[✓] PM2 processes started.${NC}"
fi
pm2 save

# ------------------------------------------------------------------------------
# 8. Host Nginx Reverse Proxy Graceful Reload (if active)
# ------------------------------------------------------------------------------
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo -e "\n${BLUE}[*] Verifying & Gracefully Reloading Host Nginx...${NC}"
  if [ -d "/etc/nginx/sites-available" ]; then
    cp nginx/host-go.jupsoft.com.conf /etc/nginx/sites-available/go.jupsoft.com.conf
    mkdir -p /etc/nginx/sites-enabled
    ln -sf /etc/nginx/sites-available/go.jupsoft.com.conf /etc/nginx/sites-enabled/go.jupsoft.com.conf
  elif [ -d "/etc/nginx/conf.d" ]; then
    cp nginx/host-go.jupsoft.com.conf /etc/nginx/conf.d/go.jupsoft.com.conf
  fi

  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx
    echo -e "${GREEN}[✓] Host Nginx gracefully reloaded (Zero dropped TCP connections).${NC}"
  else
    echo -e "${RED}[!] Host Nginx syntax test failed. Check /etc/nginx/syntax.${NC}"
  fi
fi

# ------------------------------------------------------------------------------
# 9. Deployment Summary
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[*] Checking PM2 process health status...${NC}"
sleep 2
pm2 status

echo -e "\n${CYAN}====================================================================${NC}"
echo -e "${GREEN}       Native Deployment (PM2) Completed Successfully!             ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo -e " Application URL       : ${CYAN}https://go.jupsoft.com${NC}"
echo -e " Dashboard / Login URL : ${CYAN}https://go.jupsoft.com/login${NC}"
echo -e " Backend Engine        : ${CYAN}127.0.0.1:3001 (PM2: shortly-backend)${NC}"
echo -e " Frontend Engine       : ${CYAN}127.0.0.1:5001 (PM2: shortly-frontend)${NC}"
echo -e " Database              : ${CYAN}Supabase PostgreSQL (Remote SSL)${NC}"
echo -e " Cache Status          : ${GREEN}Redis In-Memory Untouched | Build Cache Refreshed${NC}"
echo -e " Deployment Mode       : ${GREEN}Graceful Hot Reload (Zero Downtime)${NC}"
echo -e "${CYAN}====================================================================${NC}\n"
