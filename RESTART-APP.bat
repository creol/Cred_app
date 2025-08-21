@echo off
echo Restarting Credentialing App...
taskkill /F /IM node.exe >nul 2>&1
Timeout /T 2 /NOBREAK > nul
cd /d "%~dp0"
npm start
echo.
echo App restarted. Open http://localhost:3000
pause