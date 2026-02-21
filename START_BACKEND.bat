@echo off
echo ========================================
echo   Trading Journal Backend Server
echo ========================================
echo.

cd backend

echo Checking for node_modules...
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting backend server on port 3002...
echo.
call npm run dev

pause
