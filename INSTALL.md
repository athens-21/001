# Trading Journal System - Installation Guide

Complete installation guide for the Trading Journal web application with MT5 integration.

## Prerequisites

Before installing, ensure you have the following software installed:

### Required Software

1. **Node.js** (v18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **PostgreSQL** (v12 or higher)
   - Download from: https://www.postgresql.org/download/
   - Remember your postgres user password during installation

3. **MetaTrader 5** (for trade sync)
   - Download from your broker or from: https://www.metatrader5.com/

4. **Git** (optional, for version control)
   - Download from: https://git-scm.com/

## Installation Steps

### Step 1: Database Setup

1. Open **pgAdmin** or **psql** command line
2. Create a new database named `trading_journal`:
   ```sql
   CREATE DATABASE trading_journal;
   ```

3. Navigate to the database schema file:
   ```bash
   cd "backend/database"
   ```

4. Run the schema creation script:
   ```bash
   psql -U postgres -d trading_journal -f schema.sql
   ```

5. Verify tables were created:
   ```sql
   \dt
   ```
   You should see: users, mt5_accounts, trades, settings, custom_columns, command_history

### Step 2: Backend Configuration

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Open `.env` file
   - Update database credentials if needed:
     ```
     DB_USER=postgres
     DB_PASSWORD=your_password_here
     ```

4. Test backend:
   ```bash
   npm run dev
   ```
   - Should start on http://localhost:3002
   - Press `Ctrl+C` to stop

### Step 3: Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Test frontend:
   ```bash
   npm run dev
   ```
   - Should start on http://localhost:5174
   - Press `Ctrl+C` to stop

### Step 4: MT5 EA Configuration

1. Copy the EA file:
   - Navigate to `mt5/` folder
   - Copy `JournalConnector.mq5`
   - Paste into MT5's `MQL5/Experts/` folder
     - Location: `C:\Users\<YourUsername>\AppData\Roaming\MetaQuotes\Terminal\<TerminalID>\MQL5\Experts\`

2. Compile the EA:
   - Open MetaEditor (F4 in MT5)
   - Open `JournalConnector.mq5`
   - Click Compile (F7)
   - Should compile without errors

3. Enable WebRequest:
   - In MT5, go to **Tools** → **Options** → **Expert Advisors**
   - Check "Allow WebRequest for listed URL"
   - Add: `http://127.0.0.1:3002`
   - Click OK

4. Attach EA to chart:
   - Drag `JournalConnector` from Navigator onto any chart
   - Enable "Allow automated trading" button in toolbar
   - EA should show smiley face emoji if running correctly

## Running the Application

### Option 1: Use Batch Files (Recommended for Windows)

Double-click **`START_ALL.bat`** in the root directory. This will:
- Start backend server on port 3002
- Start frontend server on port 5174
- Open two command windows

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## First Time Access

1. Open browser and go to: http://localhost:5174
2. You'll see the **Account Login** page
3. Enter your MT5 account number
4. Click **Login to Dashboard**
5. Your account will be created automatically and you'll see the dashboard

## MT5 Trade Sync

Once the EA is attached:
1. Open or close a trade in MT5
2. The EA will automatically send trade data to the backend
3. Refresh the dashboard to see the new trade
4. Trades appear in both Dashboard and Journal pages

## Troubleshooting

### Database Connection Failed
- Verify PostgreSQL is running
- Check credentials in `backend/.env`
- Ensure database `trading_journal` exists

### Backend Won't Start
- Check if port 3002 is already in use
- Run: `npm install` in backend folder
- Check console for error messages

### Frontend Won't Start
- Check if port 5174 is already in use
- Run: `npm install` in frontend folder
- Clear browser cache and try again

### EA Not Sending Trades
- Verify WebRequest URL is added in MT5 settings
- Check that backend is running
- Enable Debug Mode in EA parameters to see console logs
- Check MT5 Experts tab for error messages

### JWT Token Errors
- Clear localStorage in browser (F12 → Application → Local Storage → Clear)
- Re-login with your MT5 account number

## Port Configuration

If you need to change ports:

**Backend (default: 3002):**
- Edit `backend/.env` → `PORT=3002`
- Edit `mt5/JournalConnector.mq5` → `InpServerURL`
- Recompile EA in MetaEditor

**Frontend (default: 5174):**
- Edit `frontend/vite.config.js` → `server.port`
- Edit `backend/.env` → `CORS_ORIGIN`

## Security Note

⚠️ **This is a proof-of-concept system**
- Direct MT5 account login without password
- Not suitable for production use
- Implement proper authentication for production environments

## Next Steps

After installation:
1. ✅ Login with your MT5 account number
2. ✅ Configure account details in Settings
3. ✅ Attach EA to MT5 chart
4. ✅ Start trading and let it sync automatically
5. ✅ View analytics and performance metrics

## Support

For issues or questions:
- Check the FAQ in QUICK_START.md
- Review troubleshooting section above
- Check console logs for detailed error messages
