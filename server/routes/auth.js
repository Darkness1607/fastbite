const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { name, email, phone, password } = req.body;

    const db = getDb();

    try {
        // Check if email already exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
        }

        // Hash password
        const salt = bcrypt.genSaltSync(12);
        const password_hash = bcrypt.hashSync(password, salt);

        // Insert user
        const result = db.prepare(
            'INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)'
        ).run(name, email, phone || '', password_hash);

        const userId = result.lastInsertRowid;

        // Generate token
        const token = generateToken(userId, email);

        res.status(201).json({
            success: true,
            token,
            user: { id: userId, name, email, phone: phone || '', address: '' }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
    }
});

// POST /api/auth/login
router.post('/login', [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const db = getDb();

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password.' });
        }

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid email or password.' });
        }

        const token = generateToken(user.id, user.email);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                address: user.address
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
    }
});

// GET /api/auth/profile (protected)
router.get('/profile', authenticateToken, (req, res) => {
    const db = getDb();

    try {
        const user = db.prepare('SELECT id, name, email, phone, address, created_at FROM users WHERE id = ?').get(req.user.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        res.json({ success: true, user });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ success: false, error: 'Failed to load profile.' });
    }
});

// PUT /api/auth/profile (protected)
router.put('/profile', authenticateToken, [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { name, phone, address } = req.body;
    const db = getDb();

    try {
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (phone !== undefined) updates.phone = phone;
        if (address !== undefined) updates.address = address;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update.' });
        }

        const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);

        db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...values, req.user.userId);

        const user = db.prepare('SELECT id, name, email, phone, address, created_at FROM users WHERE id = ?').get(req.user.userId);

        res.json({ success: true, user });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ success: false, error: 'Failed to update profile.' });
    }
});

module.exports = router;