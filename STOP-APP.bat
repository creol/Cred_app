@echo off
echo Attempting to stop Credentialing App...
taskkill /F /IM node.exe >nul 2>&1
echo.
REM Check if any node processes are still running
tasklist /FI "IMAGENAME eq node.exe" | findstr /I "node.exe" >nul
if %errorlevel% equ 0 (
    echo Node.js processes might still be running.
    echo You may need to manually close the PowerShell window where the app was started,
    echo or use Task Manager (Ctrl+Shift+Esc) to end "Node.js JavaScript Runtime" tasks.
) else (
    echo Credentialing App stopped successfully.
    echo Port 3000 should now be free.
)
echo.
pause