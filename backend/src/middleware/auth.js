const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';

/**
 * Generate JWT token for account
 */
const generateToken = (userId, accountNumber, accountId) => {
    return jwt.sign(
        { userId, accountNumber, accountId },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

/**
 * Authentication middleware
 * Supports both JWT token and accountNumber fallback for EA webhooks
 */
const authenticate = async (req, res, next) => {
    try {
        // Try to get token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : null;

        if (token) {
            // Verify JWT token
            const decoded = verifyToken(token);
            if (!decoded) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }

            // Set user info in request
            req.user = {
                userId: decoded.userId,
                accountNumber: decoded.accountNumber,
                accountId: decoded.accountId,
            };

            return next();
        }

        // Fallback: Check for accountNumber in body (for EA webhooks)
        const { accountNumber } = req.body;
        if (accountNumber) {
            // Find account by account number
            const account = await queryOne(
                'SELECT id, user_id, account_number FROM mt5_accounts WHERE account_number = $1',
                [accountNumber]
            );

            if (!account) {
                return res.status(404).json({ error: 'MT5 account not found' });
            }

            // Set user info from account
            req.user = {
                userId: account.user_id,
                accountNumber: account.account_number,
                accountId: account.id,
            };

            return next();
        }

        // No authentication provided
        return res.status(401).json({ error: 'Authentication required' });
    } catch (error) {
        console.error('❌ Authentication error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

/**
 * Optional authentication middleware
 * Doesn't fail if no auth is provided, but sets user if available
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : null;

        if (token) {
            const decoded = verifyToken(token);
            if (decoded) {
                req.user = {
                    userId: decoded.userId,
                    accountNumber: decoded.accountNumber,
                    accountId: decoded.accountId,
                };
            }
        }

        next();
    } catch (error) {
        console.error('⚠️ Optional auth error:', error);
        next();
    }
};

module.exports = {
    generateToken,
    verifyToken,
    authenticate,
    optionalAuth,
};
