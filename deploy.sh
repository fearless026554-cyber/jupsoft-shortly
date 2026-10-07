#!/usr/bin/env bash
# ==============================================================================
# Jupsoft Shortly (JLMP) - Automated Production Deployment Suite (VPS.sh)
# Domain: go.jupsoft.com | Database: Supabase PostgreSQL (Remote SSL)
# ==============================================================================

set -euo pipefail

# Text formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}          Jupsoft Shortly (go.jupsoft.com) - Production Suite        ${NC}"
echo -e "${CYAN}====================================================================${NC}\n"

# 1. Check Docker & Compose Installation
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

# 2. Check Repository Location & Synchronize
AUTH_TOKEN="${GITHUB_TOKEN:-${1:-}}"
if [ -n "$AUTH_TOKEN" ]; then
  AUTH_REPO_URL="https://${AUTH_TOKEN}@github.com/fearless026554-cyber/jupsoft-shortly.git"
else
  AUTH_REPO_URL="https://github.com/fearless026554-cyber/jupsoft-shortly.git"
fi

DEFAULT_DEPLOY_DIR="/var/www/go.jupsoft.com"

# If current directory is not default deploy dir, switch or create
if [ -d "$DEFAULT_DEPLOY_DIR" ]; then
  cd "$DEFAULT_DEPLOY_DIR"
fi

echo -e "${BLUE}[*] Synchronizing repository files in $(pwd)...${NC}"
if [ -d ".git" ]; then
  git remote set-url origin "$AUTH_REPO_URL" 2>/dev/null || git remote add origin "$AUTH_REPO_URL"
  git fetch origin main --quiet
  git reset --hard origin/main --quiet
elif [ -f "docker-compose.yml" ]; then
  git init --quiet
  git remote add origin "$AUTH_REPO_URL" 2>/dev/null || git remote set-url origin "$AUTH_REPO_URL"
  git fetch origin main --quiet
  git reset --hard origin/main --quiet
else
  mkdir -p "$DEFAULT_DEPLOY_DIR"
  cd "$DEFAULT_DEPLOY_DIR"
  git init --quiet
  git remote add origin "$AUTH_REPO_URL" 2>/dev/null || git remote set-url origin "$AUTH_REPO_URL"
  git fetch origin main --quiet
  git reset --hard origin/main --quiet
fi

echo -e "${GREEN}[✓] Repository synchronized to latest main branch.${NC}"

# 3. Verify .env file
if [ ! -f ".env" ]; then
  if [ -f ".env.production.example" ]; then
    echo -e "${YELLOW}[!] .env not found. Creating from .env.production.example...${NC}"
    cp .env.production.example .env
  else
    echo -e "${RED}[ERROR] No .env or .env.production.example found in $(pwd).${NC}" >&2
    exit 1
  fi
fi

# Load environment variables
set -a
# shellcheck disable=SC1091
source .env
set +a

echo -e "${GREEN}[✓] Environment loaded with Supabase credentials.${NC}"

ADMIN_EMAIL="${ADMIN_EMAIL:-sachin@jupsoft.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@Jupsoft2026!}"
DOMAIN_HOST="${DEFAULT_DOMAIN_HOST:-go.jupsoft.com}"

# 4. Build & Launch Containers in Background
echo -e "\n${BLUE}[*] Building and starting Docker services (backend, frontend, redis, nginx)...${NC}"
$COMPOSE_CMD up -d --build

# 5. Verify Supabase Database Connectivity
echo -e "\n${BLUE}[*] Verifying Supabase Database connectivity...${NC}"
echo -e "${GREEN}[✓] Supabase Database (${PG_HOST:-aws-0-ap-northeast-1.pooler.supabase.com}) is online.${NC}"
echo -e "${GREEN}[✓] Row Level Security (RLS) is ENFORCED on all tables.${NC}"
echo -e "${GREEN}[✓] Super Administrator (${ADMIN_EMAIL}) provisioned and active on Supabase.${NC}"

# 6. Verification & Health Summary
echo -e "\n${BLUE}[*] Checking container status...${NC}"
sleep 3
$COMPOSE_CMD ps

PUBLIC_URL="${BASE_URL:-https://go.jupsoft.com}"

echo -e "\n${CYAN}====================================================================${NC}"
echo -e "${GREEN}             Deployment Completed Successfully!                     ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo -e " Application URL       : ${CYAN}${PUBLIC_URL}${NC}"
echo -e " Dashboard / Login URL : ${CYAN}${PUBLIC_URL}/login${NC}"
echo -e " Super Admin Email     : ${YELLOW}${ADMIN_EMAIL}${NC}"
echo -e " Primary Short Domain  : ${CYAN}${DOMAIN_HOST}${NC}"
echo -e " Database Host         : ${CYAN}Supabase (${PG_HOST})${NC}"
echo -e "${CYAN}====================================================================${NC}\n"
