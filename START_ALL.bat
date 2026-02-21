@echo off
echo ========================================
echo   Trading Journal - Starting All Services
echo ========================================
echo.

echo Starting both backend and frontend servers...
echo Backend: http://localhost:3002
echo Frontend: http://localhost:5174
echo.

start "Trading Journal Backend" cmd /k "START_BACKEND.bat"
timeout /t 5 >nul
start "Trading Journal Frontend" cmd /k "START_FRONTEND.bat"

echo.
echo ========================================
echo   Servers are starting in separate windows
echo ========================================
echo.
echo Press any key to close this window...
pause
