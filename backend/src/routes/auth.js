const express = require('express');
const router = express.Router();
const { generateToken } = require('../middleware/auth');
const { queryOne, queryAll } = require('../config/database');

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';

/**
 * POST /api/auth/login
 * Login with MT5 account number
 */
router.post('/login', async (req, res) => {
    try {
        const { accountNumber } = req.body;

        if (!accountNumber) {
            return res.status(400).json({ error: 'Account number is required' });
        }

        // Find MT5 account
        let account = await queryOne(
            `SELECT id, user_id, account_number, account_name, broker, account_type, currency, current_balance
       FROM mt5_accounts 
       WHERE account_number = $1 AND is_active = true`,
            [accountNumber]
        );

        // If account doesn't exist, create it
        if (!account) {
            const result = await queryOne(
                `INSERT INTO mt5_accounts (user_id, account_number, account_name, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING id, user_id, account_number, account_name, broker, account_type, currency, current_balance`,
                [DEFAULT_USER_ID, accountNumber, `MT5 Account ${accountNumber}`]
            );
            account = result;
        }

        // Generate JWT token
        const token = generateToken(account.user_id, account.account_number, account.id);

        res.json({
            token,
            user: {
                id: account.user_id,
                accountId: account.id,
                accountNumber: account.account_number,
                accountName: account.account_name,
                broker: account.broker,
                accountType: account.account_type,
                currency: account.currency,
                balance: account.current_balance,
            },
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /api/auth/verify
 * Verify JWT token
 */
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const { verifyToken } = require('../middleware/auth');
        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Get account info
        const account = await queryOne(
            `SELECT id, user_id, account_number, account_name, broker, account_type, currency, current_balance
       FROM mt5_accounts 
       WHERE id = $1`,
            [decoded.accountId]
        );

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.json({
            valid: true,
            user: {
                id: account.user_id,
                accountId: account.id,
                accountNumber: account.account_number,
                accountName: account.account_name,
                broker: account.broker,
                accountType: account.account_type,
                currency: account.currency,
                balance: account.current_balance,
            },
        });
    } catch (error) {
        console.error('❌ Verify error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

/**
 * POST /api/auth/logout
 * Logout (client-side token removal)
 */
router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
