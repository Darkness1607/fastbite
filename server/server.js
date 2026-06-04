const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const favoritesRoutes = require('./routes/favorites');
const ordersRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 3000;

// === Middleware ===
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// === Serve Static Frontend Files ===
// This lets you open http://localhost:3000 instead of index.html directly
app.use(express.static(path.join(__dirname, '..')));

// === API Routes ===
app.use('/api/auth', authRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/orders', ordersRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'FastBite API is running!', timestamp: new Date().toISOString() });
});

// === SPA Fallback: serve index.html for any unmatched route (except /api) ===
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', 'index.html'));
    }
});

// === Error Handler ===
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
});

// === Export for serverless (Netlify) ===
// When this module is required (not run directly), we export the app
// without starting the listener. The serverless function wrapper
// (netlify/functions/api.js) will handle invocation.
module.exports = app;

// === Start Server (local dev only) ===
// Only starts listening when this file is executed directly with `node server/server.js`
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🍔 FastBite API server running on http://localhost:${PORT}`);
        console.log(`📂 Open http://localhost:${PORT} in your browser to use the app`);
    });
}