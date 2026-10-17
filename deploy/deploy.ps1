# ==============================================================================
# Jupsoft Shortly (JLMP) - Windows Automated Deployment Script
# ==============================================================================

[CmdletBinding()]
param (
    [string]$AdminEmail = "admin@jupsoft.com",
    [string]$AdminPassword = "",
    [string]$DomainHost = "go.jupsoft.com"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
Set-Location $repoRoot

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

# 2. Environment Verification (Zero-Touch - No Overwrites, No Duplicate Backups)
$envPath = Join-Path $repoRoot ".env"
$backendEnvPath = Join-Path $repoRoot "backend-nestjs\.env"

if (Test-Path $envPath) {
    Write-Host "[✓] Using existing root .env." -ForegroundColor Green
} elseif (Test-Path $backendEnvPath) {
    Write-Host "[✓] Using existing backend-nestjs\.env." -ForegroundColor Green
    Copy-Item $backendEnvPath $envPath -Force
} else {
    Write-Error "[ERROR] No .env file found in root or backend-nestjs\. Please provide a valid .env before deploying."
    exit 1
}

# Read .env variables into process environment
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

$targetDomain = if ($env:DEFAULT_DOMAIN_HOST) { $env:DEFAULT_DOMAIN_HOST } else { $DomainHost }
$targetAdmin = if ($env:ADMIN_EMAIL) { $env:ADMIN_EMAIL } else { $AdminEmail }
$targetPass = if ($env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD } else { $AdminPassword }

if (-not $targetPass) {
    Write-Error "[ERROR] ADMIN_PASSWORD is required. Please pass -AdminPassword or set ADMIN_PASSWORD in .env"
    exit 1
}

# 3. Build & Launch Containers
Write-Host "`n[*] Building and launching Docker services in background..." -ForegroundColor Blue
& docker compose up -d --build

# 4. Status and Summary
Write-Host "`n[*] Container status overview:" -ForegroundColor Blue
& docker compose ps

$publicUrl = if ($env:BASE_URL) { $env:BASE_URL } else { "https://$targetDomain" }

Write-Host "`n====================================================================" -ForegroundColor Cyan
Write-Host "             Deployment Completed Successfully!                     " -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " Dashboard / Login URL : $publicUrl/login" -ForegroundColor Cyan
Write-Host " Super Admin Email     : $targetAdmin" -ForegroundColor Yellow
Write-Host " Primary Short Domain  : $targetDomain" -ForegroundColor Cyan
Write-Host "====================================================================`n" -ForegroundColor Cyan
