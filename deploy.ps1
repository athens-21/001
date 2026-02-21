# Trading Journal - Deployment Script
# PowerShell script for deploying to D:\TDJTT

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Trading Journal - Deployment Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$SOURCE_DIR = "C:\Users\kaewp\Downloads\New TJ"
$BACKEND_SOURCE = "$SOURCE_DIR\backend_python"
$FRONTEND_SOURCE = "$SOURCE_DIR\frontend\dist"
$TARGET_DIR = "D:\TDJTT\3406v3"
$BACKEND_TARGET = "$TARGET_DIR\app\routes\trading_journal"
$FRONTEND_TARGET = "$TARGET_DIR\static\trading-journal"

# Step 1: Validate Source Files
Write-Host "[1/6] Validating source files..." -ForegroundColor Yellow

if (-not (Test-Path $BACKEND_SOURCE)) {
    Write-Host "ERROR: Backend source not found: $BACKEND_SOURCE" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $FRONTEND_SOURCE)) {
    Write-Host "WARNING: Frontend build not found. Building now..." -ForegroundColor Yellow
    Set-Location "$SOURCE_DIR\frontend"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Frontend build failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host "SUCCESS: Source files validated" -ForegroundColor Green
Write-Host ""

# Step 2: Create Target Directories
Write-Host "[2/6] Creating target directories..." -ForegroundColor Yellow

if (-not (Test-Path $TARGET_DIR)) {
    Write-Host "ERROR: Target directory not found: $TARGET_DIR" -ForegroundColor Red
    exit 1
}

New-Item -Path $BACKEND_TARGET -ItemType Directory -Force | Out-Null
New-Item -Path $FRONTEND_TARGET -ItemType Directory -Force | Out-Null

Write-Host "SUCCESS: Directories created" -ForegroundColor Green
Write-Host ""

# Step 3: Deploy Backend
Write-Host "[3/6] Deploying Python backend..." -ForegroundColor Yellow

robocopy $BACKEND_SOURCE $BACKEND_TARGET /E /XO /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) {
    Write-Host "ERROR: Backend deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: Backend deployed" -ForegroundColor Green
Write-Host ""

# Step 4: Deploy Frontend
Write-Host "[4/6] Deploying frontend..." -ForegroundColor Yellow

robocopy $FRONTEND_SOURCE $FRONTEND_TARGET /E /XO /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) {
    Write-Host "ERROR: Frontend deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: Frontend deployed" -ForegroundColor Green
Write-Host ""

# Step 5: Initialize Database
Write-Host "[5/6] Initializing database..." -ForegroundColor Yellow

$DB_PATH = "$TARGET_DIR\data\accounts.db"
if (-not (Test-Path $DB_PATH)) {
    Write-Host "WARNING: Database not found at: $DB_PATH" -ForegroundColor Yellow
} else {
    Set-Location $BACKEND_TARGET
    python database.py
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Database initialization failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "SUCCESS: Database initialized" -ForegroundColor Green
}
Write-Host ""

# Step 6: Verify Deployment
Write-Host "[6/6] Verifying deployment..." -ForegroundColor Yellow

$files_to_check = @(
    "$BACKEND_TARGET\__init__.py",
    "$BACKEND_TARGET\database.py",
    "$BACKEND_TARGET\schema.sql",
    "$BACKEND_TARGET\routes\accounts.py",
    "$BACKEND_TARGET\routes\trades.py",
    "$BACKEND_TARGET\routes\analytics.py",
    "$BACKEND_TARGET\routes\settings.py",
    "$FRONTEND_TARGET\index.html"
)

$all_ok = $true
foreach ($file in $files_to_check) {
    if (Test-Path $file) {
        $filename = Split-Path $file -Leaf
        Write-Host "  [OK] $filename" -ForegroundColor Green
    } else {
        $filename = Split-Path $file -Leaf
        Write-Host "  [MISSING] $filename" -ForegroundColor Red
        $all_ok = $false
    }
}

Write-Host ""

# Summary
if ($all_ok) {
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "SUCCESS: Deployment Complete!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Edit app_factory.py" -ForegroundColor White
    Write-Host "   - from app.routes.trading_journal import init_trading_journal" -ForegroundColor Gray
    Write-Host "   - init_trading_journal(app)" -ForegroundColor Gray
    Write-Host "2. Add route /trading-journal" -ForegroundColor White
    Write-Host "3. Restart server" -ForegroundColor White
    Write-Host "4. Visit http://localhost:5000/trading-journal" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "ERROR: Deployment Failed" -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "Some files are missing." -ForegroundColor Yellow
    exit 1
}
