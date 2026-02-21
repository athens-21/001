# Trading Journal - Quick Start Guide

Fast-track guide for experienced developers.

## Prerequisites
- Node.js 18+
- PostgreSQL 12+
- MT5 installed

## Setup (5 minutes)

```bash
# 1. Create database
psql -U postgres
CREATE DATABASE trading_journal;
\q

# 2. Run schema
cd backend/database
psql -U postgres -d trading_journal -f schema.sql

# 3. Install & run backend
cd ../../backend
npm install
npm run dev
# Backend: http://localhost:3002

# 4. Install & run frontend (new terminal)
cd frontend
npm install
npm run dev
# Frontend: http://localhost:5174
```

## MT5 EA Setup

1. Copy `mt5/JournalConnector.mq5` to MT5's `MQL5/Experts/`
2. Compile in MetaEditor (F7)
3. MT5: Tools → Options → Expert Advisors → Allow WebRequest → Add `http://127.0.0.1:3002`
4. Attach EA to chart

## Quick Commands

```bash
# Start all services
START_ALL.bat

# Backend only
START_BACKEND.bat

# Frontend only
START_FRONTEND.bat
```

## Usage

1. Open http://localhost:5174
2. Enter MT5 account number
3. Login → Dashboard loads
4. Attach EA → Trades sync automatically

## Config Files

- Backend: `backend/.env`
- Frontend: `frontend/vite.config.js`
- EA: `mt5/JournalConnector.mq5` (line 11)

## Ports

- Backend: 3002
- Frontend: 5174
- Database: 5432 (PostgreSQL default)

## Common Issues

**Port conflict**
```bash
# Change in backend/.env and frontend/vite.config.js
```

**DB connection failed**
```bash
# Check credentials in backend/.env
```

**EA not syncing**
```bash
# Verify WebRequest URL in MT5 settings
# Check backend is running
```

## Default Credentials

- Database: `postgres / postgres`
- JWT Secret: Check `backend/.env`

## API Endpoints

- Auth: `POST /api/auth/login`
- Trades: `GET/POST /api/journal/trades`
- Accounts: `GET /api/accounts`
- Stats: `GET /api/accounts/:id/stats`

## Theme

Bloomberg Terminal (single theme)
- Dark navy background (#0A0E27)
- Orange accent (#F7931A)
- Professional financial terminal layout

## Architecture

```
MT5 EA → Backend API → PostgreSQL
       ↑
    Frontend (React)
```

Done! 🚀
