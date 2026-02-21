const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { queryOne, queryAll, query } = require('../config/database');

/**
 * GET /api/settings
 * Get all settings for user
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const settings = await queryAll(
            'SELECT setting_key, setting_value, setting_type FROM settings WHERE user_id = $1',
            [req.user.userId]
        );

        // Convert to key-value object
        const settingsObj = {};
        settings.forEach(s => {
            let value = s.setting_value;
            if (s.setting_type === 'number') value = parseFloat(value);
            if (s.setting_type === 'boolean') value = value === 'true';
            if (s.setting_type === 'json') value = JSON.parse(value);
            settingsObj[s.setting_key] = value;
        });

        res.json(settingsObj);
    } catch (error) {
        console.error('❌ Get settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

/**
 * PUT /api/settings
 * Update settings (upsert)
 */
router.put('/', authenticate, async (req, res) => {
    try {
        const settings = req.body;

        for (const [key, value] of Object.entries(settings)) {
            let settingValue = value;
            let settingType = 'string';

            if (typeof value === 'number') settingType = 'number';
            else if (typeof value === 'boolean') settingType = 'boolean';
            else if (typeof value === 'object') {
                settingType = 'json';
                settingValue = JSON.stringify(value);
            }

            await query(
                `INSERT INTO settings (user_id, setting_key, setting_value, setting_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, setting_key) 
         DO UPDATE SET setting_value = $3, setting_type = $4`,
                [req.user.userId, key, String(settingValue), settingType]
            );
        }

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('❌ Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

module.exports = router;
