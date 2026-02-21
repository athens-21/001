const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { queryOne, queryAll, query } = require('../config/database');

/**
 * GET /api/journal/trades
 * Get all trades for the authenticated account
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { status, pair, startDate, endDate, limit = 100, offset = 0 } = req.query;

        let queryText = `
      SELECT * FROM trades 
      WHERE account_id = $1
    `;
        const params = [req.user.accountId];
        let paramCount = 1;

        // Add filters
        if (status) {
            paramCount++;
            queryText += ` AND status = $${paramCount}`;
            params.push(status);
        }

        if (pair) {
            paramCount++;
            queryText += ` AND pair = $${paramCount}`;
            params.push(pair);
        }

        if (startDate) {
            paramCount++;
            queryText += ` AND trade_date >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            queryText += ` AND trade_date <= $${paramCount}`;
            params.push(endDate);
        }

        queryText += ` ORDER BY open_time DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);

        const trades = await queryAll(queryText, params);
        res.json(trades);
    } catch (error) {
        console.error('❌ Get trades error:', error);
        res.status(500).json({ error: 'Failed to fetch trades' });
    }
});

/**
 * GET /api/journal/trades/:id
 * Get specific trade
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const trade = await queryOne(
            'SELECT * FROM trades WHERE id = $1 AND account_id = $2',
            [req.params.id, req.user.accountId]
        );

        if (!trade) {
            return res.status(404).json({ error: 'Trade not found' });
        }

        res.json(trade);
    } catch (error) {
        console.error('❌ Get trade error:', error);
        res.status(500).json({ error: 'Failed to fetch trade' });
    }
});

/**
 * POST /api/journal/trades
 * Create new trade (manual or via MT5 EA webhook)
 * Supports accountNumber authentication for webhook
 */
router.post('/', async (req, res) => {
    try {
        const { accountNumber } = req.body;

        // Authenticate via token or accountNumber
        let userId, accountId;

        if (req.headers.authorization) {
            // Authenticated via JWT
            const { authenticate } = require('../middleware/auth');
            await new Promise((resolve, reject) => {
                authenticate(req, res, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            userId = req.user.userId;
            accountId = req.user.accountId;
        } else if (accountNumber) {
            // Authenticate via accountNumber (EA webhook)
            const account = await queryOne(
                'SELECT id, user_id FROM mt5_accounts WHERE account_number = $1',
                [accountNumber]
            );

            if (!account) {
                return res.status(404).json({ error: 'MT5 account not found' });
            }

            userId = account.user_id;
            accountId = account.id;
        } else {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const {
            event, // ORDER_OPEN or ORDER_CLOSE
            mt5Ticket,
            pair,
            direction,
            volume,
            entryPrice,
            exitPrice,
            stopLoss,
            takeProfit,
            profitLoss,
            commission,
            swap,
            openTime,
            closeTime,
            tradeDate,
            session,
            notes,
            tags,
            positionId,
        } = req.body;

        // Handle MT5 EA events
        if (event === 'ORDER_OPEN') {
            // Create or update trade as OPEN
            const existingTrade = mt5Ticket ? await queryOne(
                'SELECT id FROM trades WHERE mt5_ticket = $1 AND account_id = $2',
                [mt5Ticket, accountId]
            ) : null;

            if (existingTrade) {
                // Update existing trade
                const result = await queryOne(
                    `UPDATE trades SET
            pair = $1, direction = $2, volume = $3, entry_price = $4,
            stop_loss = $5, take_profit = $6, open_time = $7, 
            trade_date = $8, session = $9, status = 'OPEN', source = 'MT5'
           WHERE id = $10
           RETURNING *`,
                    [pair, direction, volume, entryPrice, stopLoss, takeProfit,
                        openTime, tradeDate, session, existingTrade.id]
                );
                return res.status(200).json(result);
            } else {
                // Create new OPEN trade
                const result = await queryOne(
                    `INSERT INTO trades (
            account_id, user_id, mt5_ticket, mt5_position_id, pair, direction, volume,
            entry_price, stop_loss, take_profit, open_time, trade_date, session,
            status, source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'OPEN', 'MT5')
          RETURNING *`,
                    [accountId, userId, mt5Ticket, positionId, pair, direction, volume,
                        entryPrice, stopLoss, takeProfit, openTime, tradeDate, session]
                );
                return res.status(201).json(result);
            }
        } else if (event === 'ORDER_CLOSE') {
            // Find and update OPEN trade to CLOSED
            // Use positionId to find the trade (since close deal has different ticket)
            const existingTrade = positionId ? await queryOne(
                'SELECT id FROM trades WHERE mt5_position_id = $1 AND account_id = $2 AND status = $3',
                [positionId, accountId, 'OPEN']
            ) : null;

            if (existingTrade) {
                // Update to CLOSED
                const result = await queryOne(
                    `UPDATE trades SET
            exit_price = $1, close_time = $2, profit_loss = $3,
            commission = $4, swap = $5, status = 'CLOSED'
           WHERE id = $6
           RETURNING *`,
                    [exitPrice, closeTime, profitLoss, commission || 0, swap || 0, existingTrade.id]
                );
                return res.status(200).json(result);
            } else {
                // No matching OPEN trade found - skip this CLOSE event
                // Historical sync will handle it properly later
                console.log(`⚠️ Skipping ORDER_CLOSE for position ${positionId} - no matching OPEN trade found (will be synced via historical sync)`);
                return res.status(200).json({ 
                    message: 'CLOSE event skipped - no matching OPEN trade',
                    positionId: positionId,
                    note: 'Will be handled by historical sync'
                });
            }
        } else {
            // Manual trade creation
            const result = await queryOne(
                `INSERT INTO trades (
          account_id, user_id, pair, direction, volume, entry_price, exit_price,
          stop_loss, take_profit, open_time, close_time, trade_date, session,
          profit_loss, commission, swap, notes, tags, status, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'MANUAL')
        RETURNING *`,
                [accountId, userId, pair, direction, volume, entryPrice, exitPrice,
                    stopLoss, takeProfit, openTime, closeTime, tradeDate, session,
                    profitLoss, commission, swap, notes, tags, exitPrice ? 'CLOSED' : 'OPEN']
            );
            return res.status(201).json(result);
        }
    } catch (error) {
        console.error('❌ Create trade error:', error);
        res.status(500).json({ error: 'Failed to create trade' });
    }
});

/**
 * PUT /api/journal/trades/:id
 * Update existing trade
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const {
            pair, direction, volume, entry_price, exit_price,
            stop_loss, take_profit, open_time, close_time, trade_date,
            session, profit_loss, commission, swap, notes, tags, status
        } = req.body;

        const result = await queryOne(
            `UPDATE trades SET
        pair = COALESCE($1, pair),
        direction = COALESCE($2, direction),
        volume = COALESCE($3, volume),
        entry_price = COALESCE($4, entry_price),
        exit_price = COALESCE($5, exit_price),
        stop_loss = COALESCE($6, stop_loss),
        take_profit = COALESCE($7, take_profit),
        open_time = COALESCE($8, open_time),
        close_time = COALESCE($9, close_time),
        trade_date = COALESCE($10, trade_date),
        session = COALESCE($11, session),
        profit_loss = COALESCE($12, profit_loss),
        commission = COALESCE($13, commission),
        swap = COALESCE($14, swap),
        notes = COALESCE($15, notes),
        tags = COALESCE($16, tags),
        status = COALESCE($17, status)
      WHERE id = $18 AND account_id = $19
      RETURNING *`,
            [pair, direction, volume, entry_price, exit_price, stop_loss, take_profit,
                open_time, close_time, trade_date, session, profit_loss, commission, swap,
                notes, tags, status, req.params.id, req.user.accountId]
        );

        if (!result) {
            return res.status(404).json({ error: 'Trade not found' });
        }

        res.json(result);
    } catch (error) {
        console.error('❌ Update trade error:', error);
        res.status(500).json({ error: 'Failed to update trade' });
    }
});

/**
 * DELETE /api/journal/trades/:id
 * Delete trade
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const result = await query(
            'DELETE FROM trades WHERE id = $1 AND account_id = $2',
            [req.params.id, req.user.accountId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Trade not found' });
        }

        res.json({ message: 'Trade deleted successfully' });
    } catch (error) {
        console.error('❌ Delete trade error:', error);
        res.status(500).json({ error: 'Failed to delete trade' });
    }
});

/**
 * DELETE /api/journal/trades
 * Bulk delete trades
 */
router.delete('/', authenticate, async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Trade IDs required' });
        }

        const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
        const result = await query(
            `DELETE FROM trades WHERE account_id = $1 AND id IN (${placeholders})`,
            [req.user.accountId, ...ids]
        );

        res.json({
            message: 'Trades deleted successfully',
            deletedCount: result.rowCount
        });
    } catch (error) {
        console.error('❌ Bulk delete error:', error);
        res.status(500).json({ error: 'Failed to delete trades' });
    }
});

/**
 * POST /api/journal/trades/sync
 * Sync multiple trades from MT5 (for initial sync or recovery)
 * Supports accountNumber authentication
 */
router.post('/sync', async (req, res) => {
    try {
        const { accountNumber, trades } = req.body;

        if (!accountNumber) {
            return res.status(400).json({ error: 'Account number required' });
        }

        if (!trades || !Array.isArray(trades) || trades.length === 0) {
            return res.status(400).json({ error: 'Trades array required' });
        }

        // Find account by accountNumber
        const account = await queryOne(
            'SELECT id, user_id FROM mt5_accounts WHERE account_number = $1',
            [accountNumber]
        );

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        let syncedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const trade of trades) {
            try {
                const {
                    ticket, pair, direction, volume, entryPrice, exitPrice,
                    stopLoss, takeProfit, openTime, closeTime, tradeDate, session,
                    profitLoss, grossProfit, netProfit, commission, swap, notes, tags
                } = trade;

                if (!ticket) {
                    errorCount++;
                    continue;
                }

                // Check if trade already exists
                const existing = await queryOne(
                    'SELECT id FROM trades WHERE mt5_ticket = $1 AND account_id = $2',
                    [ticket, account.id]
                );

                // Use UPSERT to prevent duplicates
                // If mt5_ticket exists, update; otherwise insert
                await query(
                    `INSERT INTO trades (
                        account_id, user_id, mt5_ticket, mt5_position_id, pair, direction, volume,
                        entry_price, exit_price, stop_loss, take_profit,
                        open_time, close_time, trade_date, session,
                        profit_loss, net_profit, commission, swap,
                        notes, tags, status, source
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, 'MT5')
                    ON CONFLICT (account_id, mt5_ticket) 
                    WHERE mt5_ticket IS NOT NULL
                    DO UPDATE SET
                        exit_price = COALESCE(EXCLUDED.exit_price, trades.exit_price),
                        close_time = COALESCE(EXCLUDED.close_time, trades.close_time),
                        profit_loss = COALESCE(EXCLUDED.profit_loss, trades.profit_loss),
                        net_profit = COALESCE(EXCLUDED.net_profit, trades.net_profit),
                        commission = COALESCE(EXCLUDED.commission, trades.commission),
                        swap = COALESCE(EXCLUDED.swap, trades.swap),
                        status = CASE WHEN EXCLUDED.exit_price IS NOT NULL THEN 'CLOSED' ELSE trades.status END,
                        updated_at = CURRENT_TIMESTAMP`,
                    [account.id, account.user_id, ticket, ticket, pair, direction, volume,
                        entryPrice, exitPrice, stopLoss, takeProfit, openTime, closeTime,
                        tradeDate, session, profitLoss || netProfit, netProfit,
                        commission, swap, notes, tags, exitPrice ? 'CLOSED' : 'OPEN']
                );
                syncedCount++;
            } catch (tradeError) {
                console.error('❌ Error syncing trade:', tradeError);
                errorCount++;
            }
        }

        console.log(`✅ Sync completed for account ${accountNumber}: ${syncedCount} synced, ${skippedCount} skipped, ${errorCount} errors`);

        res.json({
            message: 'Sync completed',
            syncedCount,
            skippedCount,
            errorCount,
            totalProcessed: trades.length
        });
    } catch (error) {
        console.error('❌ Sync error:', error);
        res.status(500).json({ error: 'Failed to sync trades' });
    }
});

// Delete all MT5 trades (for testing/reset)
router.delete('/clear-mt5', async (req, res) => {
    try {
        const result = await query("DELETE FROM trades WHERE source = 'MT5'");
        console.log(`🗑️ Deleted ${result.rowCount} MT5 trades`);
        res.json({ 
            message: 'MT5 trades cleared', 
            deletedCount: result.rowCount 
        });
    } catch (error) {
        console.error('❌ Clear error:', error);
        res.status(500).json({ error: 'Failed to clear trades' });
    }
});

module.exports = router;
