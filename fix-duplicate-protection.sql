-- ============================================================================
-- FIX: Add Unique Constraint to Prevent Duplicate MT5 Trades
-- ============================================================================
-- This script adds a unique constraint on mt5_position_id to prevent
-- duplicate trades from being created during historical sync.
--
-- HOW TO RUN:
-- 1. Open pgAdmin
-- 2. Connect to PostgreSQL server
-- 3. Right-click on "trading_journal" database → Query Tool
-- 4. Copy and paste this entire script
-- 5. Press F5 or click Execute button
-- ============================================================================

-- Drop old constraint if exists
DROP INDEX IF EXISTS idx_trades_mt5_unique;

-- Create new unique constraints
-- 1. Unique constraint for mt5_ticket (already exists, recreating for safety)
DROP INDEX IF EXISTS idx_trades_mt5_ticket_unique;
CREATE UNIQUE INDEX idx_trades_mt5_ticket_unique 
ON trades(account_id, mt5_ticket) 
WHERE mt5_ticket IS NOT NULL;

-- 2. Unique constraint for mt5_position_id (NEW - prevents historical sync duplicates)
DROP INDEX IF EXISTS idx_trades_mt5_position_unique;
CREATE UNIQUE INDEX idx_trades_mt5_position_unique 
ON trades(account_id, mt5_position_id) 
WHERE mt5_position_id IS NOT NULL AND source = 'MT5';

-- Verify constraints created
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'trades' 
    AND (indexname LIKE '%mt5%' OR indexname LIKE '%unique%')
ORDER BY indexname;

-- Show current duplicate positions (if any)
SELECT 
    account_id,
    mt5_position_id,
    COUNT(*) as count,
    STRING_AGG(id::text, ', ') as trade_ids
FROM trades
WHERE mt5_position_id IS NOT NULL 
    AND source = 'MT5'
GROUP BY account_id, mt5_position_id
HAVING COUNT(*) > 1;
