const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/favorites (protected)
router.get('/', authenticateToken, (req, res) => {
    const db = getDb();

    try {
        const favorites = db.prepare('SELECT item_id FROM favorites WHERE user_id = ?').all(req.user.userId);
        const itemIds = favorites.map(f => f.item_id);
        res.json({ success: true, favorites: itemIds });
    } catch (err) {
        console.error('Get favorites error:', err);
        res.status(500).json({ success: false, error: 'Failed to load favorites.' });
    }
});

// POST /api/favorites/toggle (protected)
router.post('/toggle', authenticateToken, [
    body('itemId').notEmpty().withMessage('Item ID is required'),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { itemId } = req.body;
    const db = getDb();

    try {
        const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND item_id = ?').get(req.user.userId, itemId);

        if (existing) {
            // Remove favorite
            db.prepare('DELETE FROM favorites WHERE user_id = ? AND item_id = ?').run(req.user.userId, itemId);
            res.json({ success: true, favorited: false, message: 'Removed from favorites.' });
        } else {
            // Add favorite
            db.prepare('INSERT INTO favorites (user_id, item_id) VALUES (?, ?)').run(req.user.userId, itemId);
            res.json({ success: true, favorited: true, message: 'Added to favorites!' });
        }
    } catch (err) {
        console.error('Toggle favorite error:', err);
        res.status(500).json({ success: false, error: 'Failed to toggle favorite.' });
    }
});

module.exports = router;