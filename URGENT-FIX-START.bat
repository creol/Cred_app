@echo off
color 0A
title URGENT FIX - Credentialing App
echo.
echo ============================================
echo    URGENT FIX - Starting Credentialing App
echo ============================================
echo.
echo [STEP 1] Killing any existing Node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /T 2 /NOBREAK > nul
echo.
echo [STEP 2] Navigating to correct directory...
cd /d "C:\Users\chris\Documents\Cred_app"
echo Current directory: %CD%
echo.
echo [STEP 3] Checking files...
if not exist package.json (
    echo ERROR: package.json not found!
    echo You are in: %CD%
    pause
    exit /b 1
)
echo ✓ package.json found
if not exist src\server.js (
    echo ERROR: src\server.js not found!
    pause
    exit /b 1
)
echo ✓ src\server.js found
if not exist "src\public\js\canva-import.js" (
    echo ERROR: canva-import.js missing!
    echo This file is needed for PNG/PDF import.
    pause
    exit /b 1
)
echo ✓ canva-import.js found
echo.
echo [STEP 4] Starting application...
echo ============================================
echo.
npm start
echo.
echo App stopped. Press any key to exit.
pause
