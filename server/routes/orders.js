const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/orders (protected)
router.get('/', authenticateToken, (req, res) => {
    const db = getDb();

    try {
        const orders = db.prepare(
            'SELECT id, items, total, address, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC'
        ).all(req.user.userId);

        const parsed = orders.map(order => ({
            ...order,
            items: JSON.parse(order.items)
        }));

        res.json({ success: true, orders: parsed });
    } catch (err) {
        console.error('Get orders error:', err);
        res.status(500).json({ success: false, error: 'Failed to load order history.' });
    }
});

// POST /api/orders (protected) — Create a new order
// Read env vars at invocation time (not module load) so Netlify dashboard vars are picked up
function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  if (!token || !chatId) {
    console.log('⚠️ Telegram env vars not set. Check Netlify dashboard → Environment variables.');
    console.log(`   TELEGRAM_BOT_TOKEN is ${token ? '✅ set' : '❌ missing'}`);
    console.log(`   TELEGRAM_CHAT_ID is ${chatId ? '✅ set' : '❌ missing'}`);
  }
  return { token, chatId };
}

router.post('/', authenticateToken, [
    body('items').isArray({ min: 1 }).withMessage('Cart must have at least one item'),
    body('total').isFloat({ min: 0.01 }).withMessage('Total must be a positive number'),
    body('address').trim().notEmpty().withMessage('Delivery address is required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { items, total, address, customerName, customerPhone } = req.body;
    const db = getDb();

    try {
        // Save order to database
        const result = db.prepare(
            'INSERT INTO orders (user_id, items, total, address) VALUES (?, ?, ?, ?)'
        ).run(req.user.userId, JSON.stringify(items), total, address);

        // Send Telegram notification (fire and forget — don't block the response)
        sendTelegramNotification(req.user, items, total, address, customerName, customerPhone).catch(e => {
          console.error('Telegram notification failed (non-blocking):', e.message);
        });

        res.status(201).json({
            success: true,
            order: {
                id: result.lastInsertRowid,
                items,
                total,
                address,
                status: 'Completed',
                created_at: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('Create order error:', err);
        res.status(500).json({ success: false, error: 'Failed to place order.' });
    }
});

// DELETE /api/orders/clear (protected)
router.delete('/clear', authenticateToken, (req, res) => {
    const db = getDb();

    try {
        db.prepare('DELETE FROM orders WHERE user_id = ?').run(req.user.userId);
        res.json({ success: true, message: 'Order history cleared.' });
    } catch (err) {
        console.error('Clear orders error:', err);
        res.status(500).json({ success: false, error: 'Failed to clear order history.' });
    }
});

// Helper: Send Telegram notification
async function sendTelegramNotification(user, items, total, address, customerName, customerPhone) {
    const { token, chatId } = getTelegramConfig();
    if (!token || !chatId) {
        console.log('⚠️ Telegram notification skipped — env vars missing');
        return;
    }

    try {
        let message = '🍔 *New Fast Food Order!*\n\n';
        message += `👤 *Customer:* ${customerName || user.name}\n`;
        message += `📞 *Phone:* ${customerPhone || ''}\n`;
        message += `📍 *Delivery:* ${address}\n\n`;
        message += '*--- Order Details ---*\n';

        items.forEach(item => {
            message += `▪️ ${item.quantity}x ${item.name} - $${(item.price * item.quantity).toFixed(2)}\n`;
        });

        message += `\n💰 *Total: $${total.toFixed(2)}*`;

        const url = `https://api.telegram.org/bot${token}/sendMessage`;

        console.log(`📨 Sending Telegram notification to chat ${chatId}...`);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'unknown');
            console.error(`❌ Telegram API error (${response.status}): ${errorBody}`);
        } else {
            console.log('✅ Telegram notification sent successfully');
        }
    } catch (err) {
        console.error('Telegram notification error:', err);
    }
}

module.exports = router;