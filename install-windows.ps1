# Credentialing App - Windows PowerShell Installer
# Run this script in PowerShell (not Command Prompt)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Credentialing App - Windows Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "[WARNING] Not running as Administrator" -ForegroundColor Yellow
    Write-Host "Some operations may require elevated privileges" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Checking prerequisites..." -ForegroundColor Green
Write-Host ""

# Check if Git is installed
try {
    $gitVersion = git --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Git is installed: $gitVersion" -ForegroundColor Green
    } else {
        throw "Git not found"
    }
} catch {
    Write-Host "[ERROR] Git is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Git from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "After installation, restart this script" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Node.js is installed: $nodeVersion" -ForegroundColor Green
    } else {
        throw "Node.js not found"
    }
} catch {
    Write-Host "[ERROR] Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "After installation, restart this script" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] npm is installed: $npmVersion" -ForegroundColor Green
    } else {
        throw "npm not found"
    }
} catch {
    Write-Host "[ERROR] npm is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "After installation, restart this script" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if SumatraPDF exists
$sumatraPath = "$env:USERPROFILE\AppData\Local\SumatraPDF\SumatraPDF.exe"
if (Test-Path $sumatraPath) {
    Write-Host "[OK] SumatraPDF found at: $sumatraPath" -ForegroundColor Green
} else {
    Write-Host "[WARNING] SumatraPDF not found at expected location" -ForegroundColor Yellow
    Write-Host "Please install SumatraPDF to: $sumatraPath" -ForegroundColor Yellow
    Write-Host "Download from: https://www.sumatrapdfreader.org/download-free-pdf-viewer" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue without SumatraPDF? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Installation cancelled" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host ""
Write-Host "All prerequisites checked. Starting installation..." -ForegroundColor Green
Write-Host ""

# Check if repository already exists
if (Test-Path "Cred_app") {
    Write-Host "[INFO] Cred_app directory already exists" -ForegroundColor Yellow
    $overwrite = Read-Host "Overwrite existing installation? (y/n)"
    if ($overwrite -eq "y" -or $overwrite -eq "Y") {
        Write-Host "Removing existing installation..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force "Cred_app"
    } else {
        Write-Host "Installation cancelled" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host ""
Write-Host "Cloning repository..." -ForegroundColor Green
try {
    git clone https://github.com/creol/Cred_app.git
    if ($LASTEXITCODE -ne 0) {
        throw "Git clone failed"
    }
} catch {
    Write-Host "[ERROR] Failed to clone repository" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Changing to project directory..." -ForegroundColor Green
Set-Location "Cred_app"

Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Green
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed"
    }
} catch {
    Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Initializing application..." -ForegroundColor Green
try {
    npm run install-app
    if ($LASTEXITCODE -ne 0) {
        throw "Application initialization failed"
    }
} catch {
    Write-Host "[ERROR] Failed to initialize application" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the application:" -ForegroundColor White
Write-Host "1. Open PowerShell in this directory" -ForegroundColor White
Write-Host "2. Run: npm start" -ForegroundColor White
Write-Host "3. Open browser to: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "For troubleshooting, see README.md" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
