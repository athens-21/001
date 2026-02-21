const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { queryOne, queryAll, query } = require('../config/database');

/**
 * GET /api/accounts
 * Get all MT5 accounts for the user
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const accounts = await queryAll(
            `SELECT id, account_number, account_name, broker, account_type, currency, 
              initial_balance, current_balance, is_active, created_at
       FROM mt5_accounts 
       WHERE user_id = $1
       ORDER BY created_at DESC`,
            [req.user.userId]
        );

        res.json(accounts);
    } catch (error) {
        console.error('❌ Get accounts error:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

/**
 * GET /api/accounts/:id
 * Get specific account details
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const account = await queryOne(
            `SELECT * FROM mt5_accounts 
       WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.userId]
        );

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.json(account);
    } catch (error) {
        console.error('❌ Get account error:', error);
        res.status(500).json({ error: 'Failed to fetch account' });
    }
});

/**
 * POST /api/accounts/register
 * Register MT5 account (no authentication required - for EA webhook)
 */
router.post('/register', async (req, res) => {
    try {
        const {
            accountNumber,
            accountName,
            broker,
            accountType,
            currency,
            initialBalance,
            currentBalance
        } = req.body;

        if (!accountNumber) {
            return res.status(400).json({ error: 'Account number is required' });
        }

        // Check if account already exists
        const existing = await queryOne(
            'SELECT id, account_number FROM mt5_accounts WHERE account_number = $1',
            [accountNumber]
        );

        if (existing) {
            console.log(`✅ Account ${accountNumber} already registered`);
            return res.json({
                success: true,
                message: 'Account already registered',
                accountId: existing.id,
                accountNumber: existing.account_number
            });
        }

        // Create new account with default user
        const result = await queryOne(
            `INSERT INTO mt5_accounts 
       (user_id, account_number, account_name, broker, account_type, currency, initial_balance, current_balance, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING id, account_number, account_name`,
            [
                '00000000-0000-0000-0000-000000000001', // Default user
                accountNumber,
                accountName || `Account ${accountNumber}`,
                broker || 'Unknown',
                accountType || 'Live',
                currency || 'USD',
                initialBalance || 0,
                currentBalance || initialBalance || 0
            ]
        );

        console.log(`✅ Account registered: ${accountNumber} - ${result.account_name}`);

        res.status(201).json({
            success: true,
            message: 'Account registered successfully',
            accountId: result.id,
            accountNumber: result.account_number,
            accountName: result.account_name
        });
    } catch (error) {
        console.error('❌ Register account error:', error);
        res.status(500).json({ error: 'Failed to register account' });
    }
});

/**
 * GET /api/accounts/:id/stats
 * Get trading statistics for an account
 */
router.get('/:id/stats', authenticate, async (req, res) => {
    try {
        const stats = await queryOne(
            `SELECT 
        COUNT(*) as total_trades,
        SUM(CASE WHEN status = 'CLOSED' AND net_profit > 0 THEN 1 ELSE 0 END) as winning_trades,
        SUM(CASE WHEN status = 'CLOSED' AND net_profit < 0 THEN 1 ELSE 0 END) as losing_trades,
        SUM(CASE WHEN status = 'CLOSED' THEN net_profit ELSE 0 END) as total_profit_loss,
        AVG(CASE WHEN status = 'CLOSED' AND net_profit > 0 THEN net_profit END) as avg_win,
        AVG(CASE WHEN status = 'CLOSED' AND net_profit < 0 THEN net_profit END) as avg_loss,
        MAX(net_profit) as best_trade,
        MIN(net_profit) as worst_trade,
        SUM(CASE WHEN status = 'CLOSED' AND net_profit > 0 THEN net_profit ELSE 0 END) as gross_profit,
        ABS(SUM(CASE WHEN status = 'CLOSED' AND net_profit < 0 THEN net_profit ELSE 0 END)) as gross_loss
       FROM trades
       WHERE account_id = $1 AND user_id = $2`,
            [req.params.id, req.user.userId]
        );

        // Calculate derived metrics
        const totalTrades = parseInt(stats.total_trades) || 0;
        const winningTrades = parseInt(stats.winning_trades) || 0;
        const losingTrades = parseInt(stats.losing_trades) || 0;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

        const grossProfit = parseFloat(stats.gross_profit) || 0;
        const grossLoss = parseFloat(stats.gross_loss) || 0;
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

        const avgWin = parseFloat(stats.avg_win) || 0;
        const avgLoss = parseFloat(stats.avg_loss) || 0;
        const lossRate = totalTrades > 0 ? (losingTrades / totalTrades) * 100 : 0;
        const expectancy = (winRate / 100 * avgWin) - (lossRate / 100 * Math.abs(avgLoss));

        res.json({
            totalTrades,
            winningTrades,
            losingTrades,
            winRate: parseFloat(winRate.toFixed(2)),
            totalProfitLoss: parseFloat(stats.total_profit_loss) || 0,
            avgWin,
            avgLoss,
            bestTrade: parseFloat(stats.best_trade) || 0,
            worstTrade: parseFloat(stats.worst_trade) || 0,
            grossProfit,
            grossLoss,
            profitFactor: parseFloat(profitFactor.toFixed(2)),
            expectancy: parseFloat(expectancy.toFixed(2)),
        });
    } catch (error) {
        console.error('❌ Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

/**
 * PUT /api/accounts/:id
 * Update account details
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { account_name, broker, account_type, currency, current_balance } = req.body;

        const result = await queryOne(
            `UPDATE mt5_accounts 
       SET account_name = COALESCE($1, account_name),
           broker = COALESCE($2, broker),
           account_type = COALESCE($3, account_type),
           currency = COALESCE($4, currency),
           current_balance = COALESCE($5, current_balance)
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
            [account_name, broker, account_type, currency, current_balance, req.params.id, req.user.userId]
        );

        if (!result) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.json(result);
    } catch (error) {
        console.error('❌ Update account error:', error);
        res.status(500).json({ error: 'Failed to update account' });
    }
});

/**
 * POST /api/accounts/update-balance
 * Update account balance from MT5 EA
 */
router.post('/update-balance', async (req, res) => {
    try {
        const { accountNumber, currentBalance } = req.body;

        if (!accountNumber || currentBalance === undefined) {
            return res.status(400).json({ error: 'accountNumber and currentBalance are required' });
        }

        const result = await queryOne(
            `UPDATE mt5_accounts 
             SET current_balance = $1
             WHERE account_number = $2
             RETURNING *`,
            [currentBalance, accountNumber]
        );

        if (!result) {
            return res.status(404).json({ error: 'Account not found' });
        }

        console.log('💰 Balance updated for account:', accountNumber, '→ $' + currentBalance);
        res.json({ success: true, balance: currentBalance });
    } catch (error) {
        console.error('❌ Update balance error:', error);
        res.status(500).json({ error: 'Failed to update balance' });
    }
});

module.exports = router;
