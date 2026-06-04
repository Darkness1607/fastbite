const Database = require('better-sqlite3');
const path = require('path');

// === Database Path ===
// On Netlify (Lambda), the only writable directory is /tmp.
// The serverless function (netlify/functions/api.js) sets NETLIFY_DB_PATH
// to '/tmp/fastbite.db' during cold starts.
// Locally, the DB lives next to this file.
const DB_PATH = process.env.NETLIFY_DB_PATH || path.join(__dirname, 'fastbite.db');

let db;

function getDb() {
    if (!db) {
        // On serverless platforms, use MEMORY journal to avoid
        // filesystem permission issues in ephemeral environments.
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initTables();
    }
    return db;
}

function initTables() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT '',
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            item_id TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, item_id)
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            items TEXT NOT NULL,
            total REAL NOT NULL,
            address TEXT NOT NULL,
            status TEXT DEFAULT 'Completed',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);
}

module.exports = { getDb };