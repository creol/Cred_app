@echo off
title Credentialing App v1.1.0 Launcher
echo.
echo ================================================
echo    CREDENTIALING APP v1.1.0 LAUNCHER
echo ================================================
echo.

REM Stop any existing Node.js processes
echo [1/4] Stopping any existing Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /T 2 /NOBREAK > nul

REM Navigate to correct directory
echo [2/4] Navigating to application directory...
cd /d "%~dp0"
if not exist "package.json" (
    echo ERROR: package.json not found!
    echo Make sure this script is in the Cred_app folder.
    pause
    exit /b 1
)

REM Check if we're in the right place
echo [3/4] Verifying application files...
if not exist "src\server.js" (
    echo ERROR: src\server.js not found!
    echo This doesn't appear to be the Cred_app directory.
    pause
    exit /b 1
)

echo [4/4] Starting Credentialing App v1.1.0...
echo.
echo ================================================
echo  🚀 STARTING SERVER - Watch for version info
echo ================================================
echo.

REM Start the application
npm start

echo.
echo ================================================
echo  App stopped. Press any key to exit.
echo ================================================
pause