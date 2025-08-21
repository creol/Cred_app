@echo off
echo Stopping any existing Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
echo.
echo Changing directory to the application root...
cd /d "%~dp0"
echo.
echo Starting Credentialing App...
npm start
echo.
echo Credentialing App is running. Open http://localhost:3000 in your browser.
pause