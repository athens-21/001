@echo off
echo ========================================
echo   Trading Journal Frontend
echo ========================================
echo.

cd frontend

echo Checking for node_modules...
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting frontend on port 5174...
echo.
call npm run dev

pause
