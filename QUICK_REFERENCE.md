# Trading Journal - Quick Reference
## คำสั่งสำหรับใช้งานบ่อย

### 🚀 Deployment

```powershell
# Deploy ทั้งหมดด้วย script เดียว
cd "C:\Users\kaewp\Downloads\New TJ"
.\deploy.ps1

# หรือทำทีละขั้นตอน:

# 1. Build frontend
cd frontend
npm run build

# 2. Deploy backend
robocopy "backend_python" "D:\TDJTT\3406v3\app\routes\trading_journal" /E

# 3. Deploy frontend
robocopy "frontend\dist" "D:\TDJTT\3406v3\static\trading-journal" /E

# 4. Initialize database
cd "D:\TDJTT\3406v3\app\routes\trading_journal"
python database.py
```

### 🔧 Integration in Main App

**File**: `D:\TDJTT\3406v3\app\core\app_factory.py`

```python
# Add import
from app.routes.trading_journal import init_trading_journal

# Add after other blueprints
init_trading_journal(app)
```

**File**: `D:\TDJTT\3406v3\app\routes\ui_routes.py` (or equivalent)

```python
from flask import send_from_directory

@app.route('/trading-journal')
@login_required
def trading_journal():
    return send_from_directory('static/trading-journal', 'index.html')

@app.route('/trading-journal/<path:path>')
@login_required
def trading_journal_assets(path):
    return send_from_directory('static/trading-journal', path)
```

### 📊 Database Tables

```sql
-- Main tables created:
journal_trades             -- Trading records
journal_settings          -- User preferences
journal_custom_columns    -- Custom column definitions
journal_command_history   -- Terminal commands (optional)
v_journal_account_stats   -- Statistics view
```

### 🌐 API Endpoints

#### Accounts
```
GET    /api/trading-journal/accounts
GET    /api/trading-journal/accounts/:id
GET    /api/trading-journal/accounts/:id/stats
POST   /api/trading-journal/accounts/register
PUT    /api/trading-journal/accounts/:id
POST   /api/trading-journal/accounts/update-balance
```

#### Trades
```
GET    /api/trading-journal/trades
GET    /api/trading-journal/trades/:id
POST   /api/trading-journal/trades
PUT    /api/trading-journal/trades/:id
DELETE /api/trading-journal/trades/:id
POST   /api/trading-journal/trades/bulk-delete
POST   /api/trading-journal/trades/sync
DELETE /api/trading-journal/trades/clear-mt5
```

#### Analytics
```
GET    /api/trading-journal/analytics/summary
GET    /api/trading-journal/analytics/by-pair
GET    /api/trading-journal/analytics/by-date
GET    /api/trading-journal/analytics/performance
```

#### Settings
```
GET    /api/trading-journal/settings
PUT    /api/trading-journal/settings
GET    /api/trading-journal/settings/columns
POST   /api/trading-journal/settings/columns
PUT    /api/trading-journal/settings/columns/:id
DELETE /api/trading-journal/settings/columns/:id
```

### 🧪 Testing

```powershell
# Test backend standalone
cd "C:\Users\kaewp\Downloads\New TJ\backend_python"
python -m flask run --port 5001

# Test frontend dev server
cd "C:\Users\kaewp\Downloads\New TJ\frontend"
npm run dev

# Test database
python
>>> import sqlite3
>>> conn = sqlite3.connect('path/to/accounts.db')
>>> cursor = conn.cursor()
>>> cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'journal_%'")
>>> print(cursor.fetchall())
```

### 📝 MT5 EA Configuration

**File**: `JournalConnector.mq5`

```cpp
// Update API endpoint
string serverUrl = "http://localhost:5000/api/trading-journal";
// or your production URL
```

### 🐛 Common Issues

**Issue**: 401 Unauthorized  
**Fix**: Login through main system first

**Issue**: Database not found  
**Fix**: Check DB_PATH in all route files

**Issue**: Module not found  
**Fix**: Ensure backend_python copied to app/routes/trading_journal

**Issue**: Frontend 404  
**Fix**: 
1. Check npm run build completed
2. Check files copied to static/trading-journal
3. Check route /trading-journal registered

### 📂 File Structure

```
D:\TDJTT\3406v3\
├── app\
│   └── routes\
│       └── trading_journal\          ← Backend Python
│           ├── __init__.py
│           ├── database.py
│           ├── schema.sql
│           └── routes\
│               ├── accounts.py
│               ├── trades.py
│               ├── analytics.py
│               └── settings.py
│
├── static\
│   └── trading-journal\              ← Frontend Build
│       ├── index.html
│       └── assets\
│
└── data\
    └── accounts.db                   ← SQLite Database
```

### 🔐 Authentication

- Uses session-based auth from main system
- No JWT tokens
- `withCredentials: true` in axios
- Session cookie automatically sent with requests

### ⚡ Quick Commands

```powershell
# Redeploy backend only
robocopy "C:\Users\kaewp\Downloads\New TJ\backend_python" "D:\TDJTT\3406v3\app\routes\trading_journal" /E

# Redeploy frontend only
cd "C:\Users\kaewp\Downloads\New TJ\frontend"
npm run build
robocopy "dist" "D:\TDJTT\3406v3\static\trading-journal" /E

# Reinitialize database (safe - uses IF NOT EXISTS)
cd "D:\TDJTT\3406v3\app\routes\trading_journal"
python database.py

# Run main server
cd "D:\TDJTT\3406v3"
python run.py
```

### 📖 Documentation

- Full guide: `INTEGRATION_GUIDE.md`
- This file: `QUICK_REFERENCE.md`
- Original plan: See user's request

### ✅ Checklist

- [ ] Backend deployed
- [ ] Frontend built and deployed
- [ ] Database initialized
- [ ] app_factory.py updated
- [ ] UI routes added
- [ ] Server restarted
- [ ] Access http://localhost:5000/trading-journal
- [ ] Test login
- [ ] Test account list
- [ ] Test trade creation
- [ ] MT5 EA configured
- [ ] Test MT5 sync

---

**Version**: 1.0.0  
**Date**: 2026-02-01  
**Status**: Ready for deployment
