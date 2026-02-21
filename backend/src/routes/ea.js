const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { queryOne } = require('../config/database');

/**
 * GET /api/ea/status
 * Get EA connection status
 */
router.get('/status', authenticate, async (req, res) => {
    try {
        // Check if there are any recent trades from MT5
        const recentTrade = await queryOne(
            `SELECT open_time FROM trades 
       WHERE account_id = $1 AND source = 'MT5'
       ORDER BY open_time DESC 
       LIMIT 1`,
            [req.user.accountId]
        );

        const lastSync = recentTrade ? recentTrade.open_time : null;
        const isConnected = lastSync && (new Date() - new Date(lastSync)) < 3600000; // Within 1 hour

        res.json({
            connected: isConnected,
            lastSync,
            accountId: req.user.accountId,
            accountNumber: req.user.accountNumber,
        });
    } catch (error) {
        console.error('❌ EA status error:', error);
        res.status(500).json({ error: 'Failed to get EA status' });
    }
});

/**
 * POST /api/ea/test
 * Test webhook endpoint
 */
router.post('/test', async (req, res) => {
    try {
        const { accountNumber } = req.body;

        if (!accountNumber) {
            return res.status(400).json({ error: 'Account number required for test' });
        }

        // Find account
        const account = await queryOne(
            'SELECT id, account_number, account_name FROM mt5_accounts WHERE account_number = $1',
            [accountNumber]
        );

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.json({
            success: true,
            message: 'Webhook connection successful',
            account: {
                id: account.id,
                number: account.account_number,
                name: account.account_name,
            },
        });
    } catch (error) {
        console.error('❌ EA test error:', error);
        res.status(500).json({ error: 'Webhook test failed' });
    }
});

module.exports = router;
