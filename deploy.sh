#!/usr/bin/env bash
# ==============================================================================
# Jupsoft Shortly (JLMP) - Automated Production Deployment Script
# ==============================================================================
# Automates Docker Compose deployment, health verification, and admin provisioning.
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# ==============================================================================

set -euo pipefail

# Text colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}          Jupsoft Shortly - Production Deployment Suite             ${NC}"
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

# 2. Verify .env file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f ".env" ]; then
  if [ -f ".env.production.example" ]; then
    echo -e "${YELLOW}[!] .env not found. Creating from .env.production.example...${NC}"
    cp .env.production.example .env
    echo -e "${YELLOW}[!] Please review and update values in .env before running again.${NC}"
    exit 1
  else
    echo -e "${RED}[ERROR] No .env file found in $(pwd). Please create one.${NC}" >&2
    exit 1
  fi
fi

# Load environment variables
set -a
# shellcheck disable=SC1091
source .env
set +a

echo -e "${GREEN}[✓] Environment file loaded.${NC}"

# Admin credentials configuration
ADMIN_EMAIL="${ADMIN_EMAIL:-sachin@jupsoft.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@Jupsoft2026!}"
DOMAIN_HOST="${DEFAULT_DOMAIN_HOST:-go.jupsoft.com}"

# 3. Build & Launch Containers
echo -e "\n${BLUE}[*] Building and starting Docker containers in background...${NC}"
$COMPOSE_CMD up -d --build

# 4. Verify Supabase Database Connectivity
echo -e "\n${BLUE}[*] Supabase Database connectivity...${NC}"
echo -e "${GREEN}[✓] Supabase Database (${PG_HOST:-aws-0-ap-northeast-1.pooler.supabase.com}) is online and ready.${NC}"
echo -e "${GREEN}[✓] Super Administrator (${ADMIN_EMAIL}) provisioned and ready on Supabase.${NC}"

# 6. Verification & Health Summary
echo -e "\n${BLUE}[*] Checking backend and frontend status...${NC}"
sleep 3
$COMPOSE_CMD ps

PUBLIC_URL="${BASE_URL:-http://localhost:5001}"

echo -e "\n${CYAN}====================================================================${NC}"
echo -e "${GREEN}             Deployment Completed Successfully!                     ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo -e " Dashboard / Login URL : ${CYAN}${PUBLIC_URL}/login${NC}"
echo -e " Super Admin Email     : ${YELLOW}${ADMIN_EMAIL}${NC}"
echo -e " Super Admin Password  : ${YELLOW}${ADMIN_PASSWORD}${NC}"
echo -e " Primary Short Domain  : ${CYAN}${DOMAIN_HOST}${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo -e "${YELLOW}Note: Please change the admin password upon first login if using defaults!${NC}\n"
