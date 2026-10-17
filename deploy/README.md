# Enterprise Deployment Directory

This directory contains standardized deployment scripts and automation suites for Jupsoft Shortly.

## Options

### 1. Docker Compose (Standard Production - Recommended)
Standard multi-container architecture running backend (Fastify/NestJS), frontend (Next.js standalone), Redis 7, and Nginx reverse proxy.
```bash
# From repository root:
./deploy/deploy.sh
```

### 2. Native PM2 (No Docker)
Runs backend and frontend natively using PM2 process manager and local Redis server.
```bash
./deploy/deploy-pm2.sh
```

### 3. Windows PowerShell
Runs Docker compose from Windows workstations.
```powershell
.\deploy\deploy.ps1 -AdminPassword "YourStrongPassword2026!"
```

## Security Requirements
- Ensure `.env` is populated with production credentials before deployment.
- Never hardcode passwords or commit `.env` into version control.
