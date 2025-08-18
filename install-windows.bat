@echo off
echo ========================================
echo Credentialing App - Windows Installer
echo ========================================
echo.

echo Checking prerequisites...
echo.

REM Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in PATH
    echo Please install Git from: https://git-scm.com/download/win
    echo After installation, restart this script
    pause
    exit /b 1
) else (
    echo [OK] Git is installed
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from: https://nodejs.org/
    echo After installation, restart this script
    pause
    exit /b 1
) else (
    echo [OK] Node.js is installed
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in PATH
    echo Please install Node.js from: https://nodejs.org/
    echo After installation, restart this script
    pause
    exit /b 1
) else (
    echo [OK] npm is installed
)

REM Check if SumatraPDF exists
if not exist "%USERPROFILE%\AppData\Local\SumatraPDF\SumatraPDF.exe" (
    echo [WARNING] SumatraPDF not found at expected location
    echo Please install SumatraPDF to: %USERPROFILE%\AppData\Local\SumatraPDF\SumatraPDF.exe
    echo Download from: https://www.sumatrapdfreader.org/download-free-pdf-viewer
    echo.
    set /p continue="Continue without SumatraPDF? (y/n): "
    if /i not "%continue%"=="y" (
        echo Installation cancelled
        pause
        exit /b 1
    )
) else (
    echo [OK] SumatraPDF found
)

echo.
echo All prerequisites checked. Starting installation...
echo.

REM Check if repository already exists
if exist "Cred_app" (
    echo [INFO] Cred_app directory already exists
    set /p overwrite="Overwrite existing installation? (y/n): "
    if /i "%overwrite%"=="y" (
        echo Removing existing installation...
        rmdir /s /q Cred_app
    ) else (
        echo Installation cancelled
        pause
        exit /b 1
    )
)

echo.
echo Cloning repository...
git clone https://github.com/creol/Cred_app.git
if %errorlevel% neq 0 (
    echo [ERROR] Failed to clone repository
    pause
    exit /b 1
)

echo.
echo Changing to project directory...
cd Cred_app

echo.
echo Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Initializing application...
npm run install-app
if %errorlevel% neq 0 (
    echo [ERROR] Failed to initialize application
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation completed successfully!
echo ========================================
echo.
echo To start the application:
echo 1. Open PowerShell in this directory
echo 2. Run: npm start
echo 3. Open browser to: http://localhost:3000
echo.
echo For troubleshooting, see README.md
echo.
pause
