@echo off
title SafeRoute AI Safety Companion - Desktop Launcher
echo ========================================================
echo   🛡️ Launching SafeRoute AI Safety Companion Desktop App
echo ========================================================

cd /d "%~dp0"

echo [1/3] Starting FastAPI + MongoDB Backend Server (Port 3001)...
start "SafeRoute Backend" /min python -m uvicorn app.main:app --host 0.0.0.0 --port 3001 --dir backend_fastapi

echo [2/3] Starting Vite Frontend Server (Port 5174)...
start "SafeRoute Frontend" /min cmd /c "cd frontend && npx vite --port 5174"

echo [3/3] Opening Dedicated Native Desktop App Window...
timeout /t 3 /nobreak > nul

start msedge --app=http://localhost:5174/ || start chrome --app=http://localhost:5174/ || start http://localhost:5174/

echo.
echo ========================================================
echo   ✓ SafeRoute Desktop App is running!
echo   • App Link: http://localhost:5174/
echo ========================================================
