# Restart PostgreSQL Service Script
Write-Host "Restarting PostgreSQL service..." -ForegroundColor Yellow

try {
    # Stop PostgreSQL
    Write-Host "Stopping PostgreSQL..." -ForegroundColor Cyan
    net stop postgresql-x64-18
    
    Start-Sleep -Seconds 3
    
    # Start PostgreSQL
    Write-Host "Starting PostgreSQL..." -ForegroundColor Cyan
    net start postgresql-x64-18
    
    Write-Host "✅ PostgreSQL restarted successfully!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
