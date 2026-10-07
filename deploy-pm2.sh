#!/usr/bin/env bash
# ==============================================================================
# Jupsoft Shortly - Production PM2 Native Deployment (No Docker)
# Domain: go.jupsoft.com | Database: Supabase PostgreSQL (Remote SSL)
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}     Jupsoft Shortly (go.jupsoft.com) - Native PM2 Production Suite  ${NC}"
echo -e "${CYAN}====================================================================${NC}\n"

# 1. Stop any conflicting Docker containers if running
if command -v docker >/dev/null 2>&1; then
  echo -e "${BLUE}[*] Stopping existing Docker containers for Shortly...${NC}"
  docker stop jupsoft_backend jupsoft_frontend jupsoft_nginx 2>/dev/null || true
  docker rm jupsoft_backend jupsoft_frontend jupsoft_nginx 2>/dev/null || true
fi

# 2. Check Node.js and PM2
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

# 3. Ensure local Redis is active
if ! command -v redis-server >/dev/null 2>&1; then
  echo -e "${BLUE}[*] Installing redis-server...${NC}"
  apt-get update -qq && apt-get install -y -qq redis-server
  systemctl enable redis-server
  systemctl start redis-server
else
  systemctl start redis-server 2>/dev/null || true
fi

if redis-cli ping >/dev/null 2>&1; then
  echo -e "${GREEN}[✓] Local Redis is active.${NC}"
else
  echo -e "${YELLOW}[!] Warning: Redis ping returned unexpected status.${NC}"
fi

# 4. Synchronize repository files
AUTH_TOKEN="${GITHUB_TOKEN:-${1:-}}"
if [ -n "$AUTH_TOKEN" ]; then
  AUTH_REPO_URL="https://${AUTH_TOKEN}@github.com/fearless026554-cyber/jupsoft-shortly.git"
else
  AUTH_REPO_URL="https://github.com/fearless026554-cyber/jupsoft-shortly.git"
fi

DEPLOY_DIR="/var/www/go.jupsoft.com"
if [ -d "$DEPLOY_DIR" ]; then
  cd "$DEPLOY_DIR"
fi

echo -e "${BLUE}[*] Pulling latest updates from GitHub...${NC}"
if [ -d ".git" ]; then
  git remote set-url origin "$AUTH_REPO_URL" 2>/dev/null || git remote add origin "$AUTH_REPO_URL"
  git fetch origin main --quiet
  git reset --hard origin/main --quiet
fi

# 5. Ensure .env file with Supabase credentials
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}[!] Creating .env from production template...${NC}"
  cp .env.production.example .env
fi

# Copy .env to backend-nestjs/.env so backend picks it up directly
cp .env backend-nestjs/.env

# Update REDIS_HOST in backend to 127.0.0.1 for native execution
sed -i 's/REDIS_HOST=redis/REDIS_HOST=127.0.0.1/g' backend-nestjs/.env || true
sed -i 's/REDIS_PORT=6380/REDIS_PORT=6379/g' backend-nestjs/.env || true
sed -i 's/PORT=3000/PORT=3001/g' backend-nestjs/.env || true

# 6. Install dependencies and compile
echo -e "${BLUE}[*] Installing packages with pnpm...${NC}"
pnpm install

echo -e "${BLUE}[*] Compiling Backend (NestJS)...${NC}"
pnpm --filter backend-nestjs build

echo -e "${BLUE}[*] Compiling Frontend (Next.js)...${NC}"
pnpm --filter frontend build

# 7. Start/Restart services via PM2
echo -e "${BLUE}[*] Launching services with PM2...${NC}"
pm2 delete shortly-backend 2>/dev/null || true
pm2 delete shortly-frontend 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

# 8. Reload Host Nginx
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo -e "${BLUE}[*] Verifying Host Nginx...${NC}"
  if [ -f "/etc/nginx/sites-available/go.jupsoft.com" ]; then
    ln -sf /etc/nginx/sites-available/go.jupsoft.com /etc/nginx/sites-enabled/go.jupsoft.com
    nginx -t >/dev/null 2>&1 && systemctl reload nginx
    echo -e "${GREEN}[✓] Host Nginx reloaded successfully.${NC}"
  fi
fi

# 9. Health Status
echo -e "\n${BLUE}[*] Checking PM2 process status...${NC}"
sleep 2
pm2 status

echo -e "\n${CYAN}====================================================================${NC}"
echo -e "${GREEN}       Native Deployment (PM2) Completed Successfully!             ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo -e " Application URL       : ${CYAN}https://go.jupsoft.com${NC}"
echo -e " Dashboard / Login URL : ${CYAN}https://go.jupsoft.com/login${NC}"
echo -e " Super Admin Email     : ${YELLOW}sachin@jupsoft.com${NC}"
echo -e " Backend Port          : ${CYAN}127.0.0.1:3001 (PM2: shortly-backend)${NC}"
echo -e " Frontend Port         : ${CYAN}127.0.0.1:5001 (PM2: shortly-frontend)${NC}"
echo -e " Database              : ${CYAN}Supabase Cloud PostgreSQL (Remote SSL)${NC}"
echo -e "${CYAN}====================================================================${NC}\n"
