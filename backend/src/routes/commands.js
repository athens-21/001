const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { queryOne, queryAll } = require('../config/database');

/**
 * GET /api/commands
 * Get command history
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const commands = await queryAll(
            `SELECT * FROM command_history 
       WHERE user_id = $1 
       ORDER BY executed_at DESC 
       LIMIT 100`,
            [req.user.userId]
        );

        res.json(commands);
    } catch (error) {
        console.error('❌ Get commands error:', error);
        res.status(500).json({ error: 'Failed to fetch commands' });
    }
});

/**
 * POST /api/commands
 * Execute and save command
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { command } = req.body;

        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }

        // For now, just save the command (actual execution is placeholder)
        const result = await queryOne(
            `INSERT INTO command_history (user_id, command, result, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [req.user.userId, command, 'Command logged (execution not implemented)', 'success']
        );

        res.status(201).json(result);
    } catch (error) {
        console.error('❌ Execute command error:', error);
        res.status(500).json({ error: 'Failed to execute command' });
    }
});

module.exports = router;
