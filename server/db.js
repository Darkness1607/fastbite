// === Database Layer — sql.js (pure JS SQLite) ===
// Replaces better-sqlite3 which fails on Netlify Lambda due to GLIBC mismatch.
// sql.js is a WebAssembly build of SQLite — no native addons, works everywhere.

const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.NETLIFY_DB_PATH || path.join(__dirname, 'fastbite.db');
const IS_SERVERLESS = !!process.env.NETLIFY_SERVERLESS || !!process.env.NETLIFY_DB_PATH;

let db = null;
let SQL_MODULE = null;

// ---------------------------------------------------------------------------
// Statement wrapper — mimics better-sqlite3's statement API on top of sql.js
// ---------------------------------------------------------------------------
class Statement {
  constructor(sqlJsDb, sql) {
    this._db = sqlJsDb;
    this._sql = sql;
  }

  /** Fetch a single row as an object (undefined if no row). */
  get(...params) {
    const stmt = this._db.prepare(this._sql);
    if (params.length > 0) stmt.bind(params);
    let result;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  }

  /** Fetch all matching rows as an array of objects. */
  all(...params) {
    const stmt = this._db.prepare(this._sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  /** Execute an INSERT / UPDATE / DELETE statement. */
  run(...params) {
    const stmt = this._db.prepare(this._sql);
    if (params.length > 0) stmt.bind(params);
    stmt.step();
    stmt.free();

    // Query last insert rowid
    let lastInsertRowid = 0;
    const ridStmt = this._db.prepare('SELECT last_insert_rowid() AS id');
    if (ridStmt.step()) {
      lastInsertRowid = ridStmt.getAsObject().id;
    }
    ridStmt.free();

    const result = {
      lastInsertRowid,
      changes: this._db.getRowsModified(),
    };

    // Persist to disk for local development
    if (!IS_SERVERLESS) persistToDisk();

    return result;
  }
}

// ---------------------------------------------------------------------------
// Database wrapper
// ---------------------------------------------------------------------------
class DatabaseWrapper {
  constructor(sqlJsDb) {
    this._db = sqlJsDb;
  }

  prepare(sql) {
    return new Statement(this._db, sql);
  }

  exec(sql) {
    this._db.run(sql);
  }
}

// ---------------------------------------------------------------------------
// Persist the in-memory database to disk (local dev only)
// ---------------------------------------------------------------------------
function persistToDisk() {
  try {
    const data = db._db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Failed to persist database to disk:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Initialisation (must be called once at startup — async because sql.js
// needs to fetch and compile its WebAssembly module)
// ---------------------------------------------------------------------------
async function initDb() {
  if (db) return db;

  const initSqlJs = require('sql.js');
  SQL_MODULE = await initSqlJs();

  let sqlJsDb;
  if (!IS_SERVERLESS && fs.existsSync(DB_PATH)) {
    // Local dev — load existing database from disk
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlJsDb = new SQL_MODULE.Database(fileBuffer);
    console.log(`📂 Loaded existing database from ${DB_PATH}`);
  } else {
    // Create a fresh in-memory database
    sqlJsDb = new SQL_MODULE.Database();
    console.log(`🗄️  Created new database (${IS_SERVERLESS ? 'in-memory /tmp' : DB_PATH})`);
  }

  db = new DatabaseWrapper(sqlJsDb);

  // Create tables
  createTables();

  if (!IS_SERVERLESS) {
    try { db.exec('PRAGMA journal_mode = WAL'); } catch (_) { /* ignore */ }
    try { db.exec('PRAGMA foreign_keys = ON'); } catch (_) { /* ignore */ }
  }

  return db;
}

// ---------------------------------------------------------------------------
// getDb — synchronous accessor (only callable after initDb has resolved)
// ---------------------------------------------------------------------------
function getDb() {
  if (!db) {
    throw new Error(
      'Database not initialised — call initDb() before using getDb().'
    );
  }
  return db;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
function createTables() {
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

module.exports = { getDb, initDb };