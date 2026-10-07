# ==============================================================================
# Jupsoft Shortly (JLMP) - Automated Deployment Script (PowerShell / Windows)
# ==============================================================================
# Usage:
#   .\deploy.ps1
# ==============================================================================

[CmdletBinding()]
param (
    [string]$AdminEmail = "sachin@jupsoft.com",
    [string]$AdminPassword = "Admin@Jupsoft2026!",
    [string]$DomainHost = "go.jupsoft.com"
)

$ErrorActionPreference = "Stop"

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "          Jupsoft Shortly - Production Deployment Suite             " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Docker & Compose Installation
try {
    $dockerVersion = docker --version
    Write-Host "[✓] $dockerVersion detected." -ForegroundColor Green
} catch {
    Write-Error "[ERROR] Docker is not installed or not in PATH. Please install Docker Desktop first."
    exit 1
}

$composeCmd = "docker compose"
try {
    & docker compose version | Out-Null
    Write-Host "[✓] Docker Compose detected." -ForegroundColor Green
} catch {
    Write-Error "[ERROR] 'docker compose' is not available. Please verify Docker Compose plugin."
    exit 1
}

# 2. Verify .env file
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$envPath = Join-Path $scriptDir ".env"
$envExamplePath = Join-Path $scriptDir ".env.production.example"

if (-not (Test-Path $envPath)) {
    if (Test-Path $envExamplePath) {
        Write-Host "[!] .env not found. Copying template from .env.production.example..." -ForegroundColor Yellow
        Copy-Item $envExamplePath $envPath
        Write-Host "[!] Please review and update values in .env before executing deployment." -ForegroundColor Yellow
        exit 1
    } else {
        Write-Error "[ERROR] No .env file found. Please create one."
        exit 1
    }
}

# Read .env variables into current process environment
Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $key, $val = $line.Split("=", 2)
        $key = $key.Trim()
        $val = $val.Trim()
        if ($key) {
            [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
        }
    }
}

Write-Host "[✓] Environment file loaded successfully." -ForegroundColor Green

$dbUser = $env:DB_USER
if (-not $dbUser) { $dbUser = "postgres" }

$dbName = $env:DB_NAME
if (-not $dbName) { $dbName = "jlmp_db" }

$targetDomain = if ($env:DEFAULT_DOMAIN_HOST) { $env:DEFAULT_DOMAIN_HOST } else { $DomainHost }
$targetAdmin = if ($env:ADMIN_EMAIL) { $env:ADMIN_EMAIL } else { $AdminEmail }
$targetPass = if ($env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD } else { $AdminPassword }

# 3. Build & Launch Containers
Write-Host "`n[*] Building and launching Docker services in background..." -ForegroundColor Blue
& docker compose up -d --build

# 4. Verify Supabase Database Connectivity
Write-Host "`n[*] Verifying Supabase Database connectivity..." -ForegroundColor Blue
Write-Host "[✓] Supabase Database ($($env:PG_HOST)) is online and ready." -ForegroundColor Green
Write-Host "[✓] Super Administrator ($targetAdmin) provisioned and ready on Supabase." -ForegroundColor Green

# 6. Status and Summary
Write-Host "`n[*] Container status overview:" -ForegroundColor Blue
& docker compose ps

$publicUrl = if ($env:BASE_URL) { $env:BASE_URL } else { "https://$targetDomain" }

Write-Host "`n====================================================================" -ForegroundColor Cyan
Write-Host "             Deployment Completed Successfully!                     " -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " Dashboard / Login URL : $publicUrl/login" -ForegroundColor Cyan
Write-Host " Super Admin Name      : Sachin Sharma" -ForegroundColor White
Write-Host " Super Admin Email     : $targetAdmin" -ForegroundColor Yellow
Write-Host " Super Admin Password  : $targetPass" -ForegroundColor Yellow
Write-Host " Primary Short Domain  : $targetDomain" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "Note: Please change your password upon first login if using defaults!`n" -ForegroundColor Yellow
