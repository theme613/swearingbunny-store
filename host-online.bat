@echo off
title swearingbunny Store - Host Online
cd /d "%~dp0"
echo ========================================================
echo Starting swearingbunny Store & Public HTTPS Tunnel...
echo ========================================================
echo.

:: Start Node.js server in the background if not already running
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% neq 0 (
  start /b node server.mjs
  timeout /t 2 /nobreak >nul
)

:: Start Cloudflare Tunnel
echo.
echo Creating public live HTTPS link...
echo.
cloudflared.exe tunnel --url http://127.0.0.1:3000
pause
