-- Trading Journal Database Schema
-- SQLite 3
-- Converted from PostgreSQL for integration with main system
-- Created: 2026-02-01

-- ============================================================================
-- NOTE: users และ mt5_accounts tables มีอยู่แล้วในระบบหลัก
-- เราจะสร้างเฉพาะตารางที่เฉพาะเจาะจงสำหรับ Trading Journal
-- ============================================================================

-- ============================================================================
-- TRADES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS journal_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- MT5 Trade Information
    mt5_ticket TEXT,
    mt5_position_id TEXT,
    
    -- Trade Details
    pair TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT', 'BUY', 'SELL')),
    volume REAL NOT NULL,
    
    -- Prices
    entry_price REAL NOT NULL,
    exit_price REAL,
    stop_loss REAL,
    take_profit REAL,
    
    -- Times (stored as ISO 8601 text: YYYY-MM-DD HH:MM:SS)
    open_time TEXT NOT NULL,
    close_time TEXT,
    trade_date TEXT NOT NULL,
    session TEXT,
    
    -- Financial
    profit_loss REAL,
    commission REAL DEFAULT 0.00,
    swap REAL DEFAULT 0.00,
    net_profit REAL,
    
    -- Status
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'PENDING')),
    
    -- User Notes
    notes TEXT,
    tags TEXT, -- JSON array as text
    
    -- Metadata
    source TEXT DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'MT5', 'IMPORT')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_journal_trades_account_id ON journal_trades(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_trades_user_id ON journal_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_trades_mt5_ticket ON journal_trades(mt5_ticket);
CREATE INDEX IF NOT EXISTS idx_journal_trades_status ON journal_trades(status);
CREATE INDEX IF NOT EXISTS idx_journal_trades_trade_date ON journal_trades(trade_date);
CREATE INDEX IF NOT EXISTS idx_journal_trades_pair ON journal_trades(pair);
CREATE INDEX IF NOT EXISTS idx_journal_trades_open_time ON journal_trades(open_time DESC);

-- Unique constraints for MT5 trades - prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_trades_mt5_ticket_unique 
ON journal_trades(account_id, mt5_ticket) WHERE mt5_ticket IS NOT NULL;

-- ============================================================================
-- SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS journal_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, setting_key)
);

-- Index for faster settings lookup
CREATE INDEX IF NOT EXISTS idx_journal_settings_user_id ON journal_settings(user_id);

-- ============================================================================
-- CUSTOM COLUMNS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS journal_custom_columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    column_name TEXT NOT NULL,
    column_label TEXT NOT NULL,
    column_type TEXT DEFAULT 'text' CHECK (column_type IN ('text', 'number', 'date', 'select')),
    column_options TEXT, -- JSON array as text
    is_visible INTEGER DEFAULT 1, -- SQLite uses INTEGER for boolean (0/1)
    display_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, column_name)
);

-- Index for custom columns
CREATE INDEX IF NOT EXISTS idx_journal_custom_columns_user_id ON journal_custom_columns(user_id);

-- ============================================================================
-- COMMAND HISTORY TABLE (for Terminal feature)
-- ============================================================================
CREATE TABLE IF NOT EXISTS journal_command_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    command TEXT NOT NULL,
    result TEXT,
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'pending')),
    executed_at TEXT DEFAULT (datetime('now'))
);

-- Index for command history
CREATE INDEX IF NOT EXISTS idx_journal_command_history_user_id ON journal_command_history(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_command_history_executed_at ON journal_command_history(executed_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp for trades
CREATE TRIGGER IF NOT EXISTS update_journal_trades_timestamp 
AFTER UPDATE ON journal_trades
BEGIN
    UPDATE journal_trades SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger to update updated_at timestamp for settings
CREATE TRIGGER IF NOT EXISTS update_journal_settings_timestamp 
AFTER UPDATE ON journal_settings
BEGIN
    UPDATE journal_settings SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger to update updated_at timestamp for custom columns
CREATE TRIGGER IF NOT EXISTS update_journal_custom_columns_timestamp 
AFTER UPDATE ON journal_custom_columns
BEGIN
    UPDATE journal_custom_columns SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger to auto-calculate net_profit
-- Note: In SQLite, we use a simpler approach with AFTER triggers
CREATE TRIGGER IF NOT EXISTS calculate_journal_trade_net_profit 
AFTER INSERT ON journal_trades
FOR EACH ROW
WHEN NEW.profit_loss IS NOT NULL AND NEW.net_profit IS NULL
BEGIN
    UPDATE journal_trades 
    SET net_profit = (
        COALESCE(NEW.profit_loss, 0) + 
        COALESCE(NEW.commission, 0) + 
        COALESCE(NEW.swap, 0)
    ) 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS calculate_journal_trade_net_profit_update 
AFTER UPDATE OF profit_loss, commission, swap ON journal_trades
FOR EACH ROW
WHEN NEW.profit_loss IS NOT NULL
BEGIN
    UPDATE journal_trades 
    SET net_profit = (
        COALESCE(NEW.profit_loss, 0) + 
        COALESCE(NEW.commission, 0) + 
        COALESCE(NEW.swap, 0)
    ) 
    WHERE id = NEW.id;
END;

-- ============================================================================
-- VIEWS (for reporting)
-- ============================================================================

-- View for trade summary by account
CREATE VIEW IF NOT EXISTS v_journal_account_stats AS
SELECT 
    t.account_id,
    COUNT(t.id) AS total_trades,
    SUM(CASE WHEN t.status = 'CLOSED' AND t.net_profit > 0 THEN 1 ELSE 0 END) AS winning_trades,
    SUM(CASE WHEN t.status = 'CLOSED' AND t.net_profit < 0 THEN 1 ELSE 0 END) AS losing_trades,
    SUM(CASE WHEN t.status = 'CLOSED' THEN t.net_profit ELSE 0 END) AS total_profit_loss,
    AVG(CASE WHEN t.status = 'CLOSED' AND t.net_profit > 0 THEN t.net_profit END) AS avg_win,
    AVG(CASE WHEN t.status = 'CLOSED' AND t.net_profit < 0 THEN t.net_profit END) AS avg_loss,
    MAX(t.net_profit) AS best_trade,
    MIN(t.net_profit) AS worst_trade,
    CAST(SUM(CASE WHEN t.status = 'CLOSED' AND t.net_profit > 0 THEN 1 ELSE 0 END) AS REAL) / 
        NULLIF(COUNT(CASE WHEN t.status = 'CLOSED' THEN 1 END), 0) * 100 AS win_rate
FROM journal_trades t
GROUP BY t.account_id;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
-- SQLite doesn't support procedural messages like PostgreSQL
-- Tables created:
-- - journal_trades: Main trades table
-- - journal_settings: User settings
-- - journal_custom_columns: Custom column definitions
-- - journal_command_history: Terminal command history
-- - v_journal_account_stats: Statistics view
