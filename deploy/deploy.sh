#!/usr/bin/env bash
# ==============================================================================
# Jupsoft Shortly (JLMP) - Enterprise Docker Deployment Suite
# Domain: go.jupsoft.com | Remote Database: Supabase PostgreSQL
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
echo -e "${CYAN}          Jupsoft Shortly - Production Deployment Suite             ${NC}"
echo -e "${CYAN}====================================================================${NC}\n"

# 1. Verify Docker & Compose
command -v docker >/dev/null 2>&1 || {
  echo -e "${RED}[ERROR] Docker is not installed. Please install Docker first.${NC}" >&2
  exit 1
}

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo -e "${RED}[ERROR] Neither 'docker compose' nor 'docker-compose' found.${NC}" >&2
  exit 1
fi

echo -e "${GREEN}[✓] Docker and Docker Compose detected.${NC}"

# 2. Check Repository Location & Git Remote
AUTH_TOKEN="${GITHUB_TOKEN:-${1:-}}"
if [ -n "$AUTH_TOKEN" ]; then
  AUTH_REPO_URL="https://${AUTH_TOKEN}@github.com/jupsoft-system/jupsoft-shortly.git"
else
  AUTH_REPO_URL="https://github.com/jupsoft-system/jupsoft-shortly.git"
fi

DEFAULT_DEPLOY_DIR="/var/www/go.jupsoft.com"
if [ -d "$DEFAULT_DEPLOY_DIR" ] && [ "$(pwd)" != "$DEFAULT_DEPLOY_DIR" ]; then
  cd "$DEFAULT_DEPLOY_DIR"
fi

echo -e "${BLUE}[*] Synchronizing repository files in $(pwd)...${NC}"
if [ -d ".git" ]; then
  git remote set-url origin "$AUTH_REPO_URL" 2>/dev/null || git remote add origin "$AUTH_REPO_URL"
  git fetch origin main --quiet || true
  git merge origin/main --ff-only 2>/dev/null || git pull --ff-only origin main 2>/dev/null || true
fi

# 3. Environment Verification (Zero-Touch - No Overwrites, No Duplicate Backups)
if [ -f ".env" ]; then
  echo -e "${GREEN}[✓] Using existing root .env.${NC}"
elif [ -f "backend-nestjs/.env" ]; then
  echo -e "${GREEN}[✓] Using existing backend-nestjs/.env.${NC}"
  cp "backend-nestjs/.env" ".env"
else
  echo -e "${RED}[ERROR] No .env found in root or backend-nestjs/.${NC}" >&2
  echo -e "${YELLOW}[!] Please provide your .env file before deploying.${NC}" >&2
  exit 1
fi

# Load environment variables safely
set -a
# shellcheck disable=SC1091
source .env
set +a

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@jupsoft.com}"
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo -e "${RED}[ERROR] ADMIN_PASSWORD environment variable is required. Set it in .env before deploying.${NC}" >&2
  exit 1
fi
DOMAIN_HOST="${DEFAULT_DOMAIN_HOST:-go.jupsoft.com}"

# 4. Optional Host Nginx Integration (for multi-website VPS servers)
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo -e "\n${YELLOW}[!] Host Nginx is active on this server. Configuring host reverse proxy for ${DOMAIN_HOST}...${NC}"
  if [ -d "/etc/nginx/sites-available" ]; then
    cp nginx/host-go.jupsoft.com.conf "/etc/nginx/sites-available/${DOMAIN_HOST}.conf"
    mkdir -p /etc/nginx/sites-enabled
    ln -sf "/etc/nginx/sites-available/${DOMAIN_HOST}.conf" "/etc/nginx/sites-enabled/${DOMAIN_HOST}.conf"
  elif [ -d "/etc/nginx/conf.d" ]; then
    cp nginx/host-go.jupsoft.com.conf "/etc/nginx/conf.d/${DOMAIN_HOST}.conf"
  fi

  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx
    echo -e "${GREEN}[✓] Host Nginx successfully configured and reloaded for ${DOMAIN_HOST}.${NC}"
  else
    echo -e "${RED}[!] Host Nginx test failed. Please review Nginx syntax.${NC}"
  fi
fi

# 5. Build & Launch Containers
echo -e "\n${BLUE}[*] Building and starting Docker services (backend, frontend, redis, nginx)...${NC}"
$COMPOSE_CMD up -d --build

# 6. Status & Summary
echo -e "\n${BLUE}[*] Checking container status...${NC}"
sleep 3
$COMPOSE_CMD ps

PUBLIC_URL="${BASE_URL:-https://${DOMAIN_HOST}}"

echo -e "\n${CYAN}====================================================================${NC}"
echo -e "${GREEN}             Deployment Completed Successfully!                     ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo -e " Application URL       : ${CYAN}${PUBLIC_URL}${NC}"
echo -e " Dashboard / Login URL : ${CYAN}${PUBLIC_URL}/login${NC}"
echo -e " Super Admin Email     : ${YELLOW}${ADMIN_EMAIL}${NC}"
echo -e " Primary Short Domain  : ${CYAN}${DOMAIN_HOST}${NC}"
echo -e " Database Host         : ${CYAN}Supabase (${PG_HOST:-remote})${NC}"
echo -e "${CYAN}====================================================================${NC}\n"
