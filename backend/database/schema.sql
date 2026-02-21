-- Trading Journal Database Schema
-- PostgreSQL 12+
-- Created: 2026-01-08

-- Drop existing tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS command_history CASCADE;
DROP TABLE IF EXISTS custom_columns CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS mt5_accounts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create default user with specific UUID
INSERT INTO users (id, username, email, password_hash, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'default',
    'default@tradingjournal.local',
    NULL,
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- MT5 ACCOUNTS TABLE
-- ============================================================================
CREATE TABLE mt5_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_number BIGINT UNIQUE NOT NULL,
    account_name VARCHAR(100),
    broker VARCHAR(100),
    account_type VARCHAR(50) DEFAULT 'DEMO',
    currency VARCHAR(10) DEFAULT 'USD',
    initial_balance DECIMAL(15, 2) DEFAULT 0.00,
    current_balance DECIMAL(15, 2) DEFAULT 0.00,
    api_secret VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster account lookup
CREATE INDEX idx_mt5_accounts_user_id ON mt5_accounts(user_id);
CREATE INDEX idx_mt5_accounts_account_number ON mt5_accounts(account_number);

-- ============================================================================
-- TRADES TABLE
-- ============================================================================
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES mt5_accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- MT5 Trade Information
    mt5_ticket BIGINT,
    mt5_position_id BIGINT,
    
    -- Trade Details
    pair VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
    volume DECIMAL(10, 2) NOT NULL,
    
    -- Prices
    entry_price DECIMAL(20, 5) NOT NULL,
    exit_price DECIMAL(20, 5),
    stop_loss DECIMAL(20, 5),
    take_profit DECIMAL(20, 5),
    
    -- Times
    open_time TIMESTAMP WITH TIME ZONE NOT NULL,
    close_time TIMESTAMP WITH TIME ZONE,
    trade_date DATE NOT NULL,
    session VARCHAR(20),
    
    -- Financial
    profit_loss DECIMAL(15, 2),
    commission DECIMAL(15, 2) DEFAULT 0.00,
    swap DECIMAL(15, 2) DEFAULT 0.00,
    net_profit DECIMAL(15, 2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'PENDING')),
    
    -- User Notes
    notes TEXT,
    tags TEXT[], -- Array of tags
    
    -- Metadata
    source VARCHAR(20) DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'MT5', 'IMPORT')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_trades_account_id ON trades(account_id);
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_mt5_ticket ON trades(mt5_ticket);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_trade_date ON trades(trade_date);
CREATE INDEX idx_trades_pair ON trades(pair);
CREATE INDEX idx_trades_open_time ON trades(open_time DESC);

-- Unique constraints for MT5 trades - prevent duplicates
CREATE UNIQUE INDEX idx_trades_mt5_ticket_unique ON trades(account_id, mt5_ticket) WHERE mt5_ticket IS NOT NULL;
CREATE UNIQUE INDEX idx_trades_mt5_position_unique ON trades(account_id, mt5_position_id) WHERE mt5_position_id IS NOT NULL AND source = 'MT5';

-- ============================================================================
-- SETTINGS TABLE
-- ============================================================================
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, setting_key)
);

-- Index for faster settings lookup
CREATE INDEX idx_settings_user_id ON settings(user_id);

-- ============================================================================
-- CUSTOM COLUMNS TABLE
-- ============================================================================
CREATE TABLE custom_columns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    column_name VARCHAR(100) NOT NULL,
    column_label VARCHAR(100) NOT NULL,
    column_type VARCHAR(20) DEFAULT 'text' CHECK (column_type IN ('text', 'number', 'date', 'select')),
    column_options TEXT[], -- For select type
    is_visible BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, column_name)
);

-- Index for custom columns
CREATE INDEX idx_custom_columns_user_id ON custom_columns(user_id);

-- ============================================================================
-- COMMAND HISTORY TABLE (for Terminal feature)
-- ============================================================================
CREATE TABLE command_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    result TEXT,
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'error', 'pending')),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for command history
CREATE INDEX idx_command_history_user_id ON command_history(user_id);
CREATE INDEX idx_command_history_executed_at ON command_history(executed_at DESC);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mt5_accounts_updated_at BEFORE UPDATE ON mt5_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_columns_updated_at BEFORE UPDATE ON custom_columns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate net_profit before insert/update
CREATE OR REPLACE FUNCTION calculate_net_profit()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.profit_loss IS NOT NULL THEN
        NEW.net_profit = COALESCE(NEW.profit_loss, 0) + COALESCE(NEW.commission, 0) + COALESCE(NEW.swap, 0);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-calculate net_profit
CREATE TRIGGER calculate_trade_net_profit BEFORE INSERT OR UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION calculate_net_profit();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default settings for default user
INSERT INTO settings (user_id, setting_key, setting_value, setting_type)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'theme', 'bloomberg', 'string'),
    ('00000000-0000-0000-0000-000000000001', 'timezone', 'UTC', 'string'),
    ('00000000-0000-0000-0000-000000000001', 'currency_format', 'USD', 'string')
ON CONFLICT (user_id, setting_key) DO NOTHING;

-- ============================================================================
-- VIEWS (Optional - for reporting)
-- ============================================================================

-- View for trade summary by account
CREATE OR REPLACE VIEW v_account_stats AS
SELECT 
    a.id AS account_id,
    a.account_number,
    a.account_name,
    COUNT(t.id) AS total_trades,
    SUM(CASE WHEN t.status = 'CLOSED' AND t.net_profit > 0 THEN 1 ELSE 0 END) AS winning_trades,
    SUM(CASE WHEN t.status = 'CLOSED' AND t.net_profit < 0 THEN 1 ELSE 0 END) AS losing_trades,
    SUM(CASE WHEN t.status = 'CLOSED' THEN t.net_profit ELSE 0 END) AS total_profit_loss,
    AVG(CASE WHEN t.status = 'CLOSED' AND t.net_profit > 0 THEN t.net_profit END) AS avg_win,
    AVG(CASE WHEN t.status = 'CLOSED' AND t.net_profit < 0 THEN t.net_profit END) AS avg_loss,
    MAX(t.net_profit) AS best_trade,
    MIN(t.net_profit) AS worst_trade
FROM mt5_accounts a
LEFT JOIN trades t ON a.id = t.account_id
GROUP BY a.id, a.account_number, a.account_name;

-- ============================================================================
-- GRANTS (Optional - adjust based on your user setup)
-- ============================================================================

-- Grant permissions to postgres user (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Trading Journal Database Schema Created Successfully!';
    RAISE NOTICE '📊 Tables: users, mt5_accounts, trades, settings, custom_columns, command_history';
    RAISE NOTICE '👤 Default User ID: 00000000-0000-0000-0000-000000000001';
    RAISE NOTICE '🔧 Views: v_account_stats';
END $$;
