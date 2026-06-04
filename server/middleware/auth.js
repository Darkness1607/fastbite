const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fastbite-dev-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(userId, email) {
    return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ success: false, error: 'Invalid or expired token. Please log in again.' });
        }
        req.user = decoded; // { userId, email }
        next();
    });
}

module.exports = { generateToken, authenticateToken, JWT_SECRET };