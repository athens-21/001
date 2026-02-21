const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { queryOne, queryAll, query } = require('../config/database');

/**
 * GET /api/columns
 * Get custom columns configuration
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const columns = await queryAll(
            `SELECT * FROM custom_columns 
       WHERE user_id = $1 
       ORDER BY display_order ASC`,
            [req.user.userId]
        );

        res.json(columns);
    } catch (error) {
        console.error('❌ Get columns error:', error);
        res.status(500).json({ error: 'Failed to fetch columns' });
    }
});

/**
 * POST /api/columns
 * Create new custom column
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { column_name, column_label, column_type, column_options, is_visible, display_order } = req.body;

        const result = await queryOne(
            `INSERT INTO custom_columns 
       (user_id, column_name, column_label, column_type, column_options, is_visible, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [req.user.userId, column_name, column_label, column_type, column_options, is_visible, display_order]
        );

        res.status(201).json(result);
    } catch (error) {
        console.error('❌ Create column error:', error);
        res.status(500).json({ error: 'Failed to create column' });
    }
});

/**
 * PUT /api/columns/:id
 * Update custom column
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { column_label, is_visible, display_order } = req.body;

        const result = await queryOne(
            `UPDATE custom_columns 
       SET column_label = COALESCE($1, column_label),
           is_visible = COALESCE($2, is_visible),
           display_order = COALESCE($3, display_order)
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
            [column_label, is_visible, display_order, req.params.id, req.user.userId]
        );

        if (!result) {
            return res.status(404).json({ error: 'Column not found' });
        }

        res.json(result);
    } catch (error) {
        console.error('❌ Update column error:', error);
        res.status(500).json({ error: 'Failed to update column' });
    }
});

/**
 * DELETE /api/columns/:id
 * Delete custom column
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const result = await query(
            'DELETE FROM custom_columns WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Column not found' });
        }

        res.json({ message: 'Column deleted successfully' });
    } catch (error) {
        console.error('❌ Delete column error:', error);
        res.status(500).json({ error: 'Failed to delete column' });
    }
});

module.exports = router;
