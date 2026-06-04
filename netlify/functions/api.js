// === Netlify Serverless Function — Express API Wrapper ===
// This file acts as the entry point for all /api/* requests on Netlify.
// Netlify Functions require a named "handler" export.

const serverless = require('serverless-http');
const path = require('path');

let cachedHandler = null;

exports.handler = async (event, context) => {
  try {
    // ⚠️ On Netlify/Lambda, only /tmp is writable.
    // We point the database to /tmp so sql.js can persist there.
    if (!process.env.NETLIFY_DB_PATH) {
      process.env.NETLIFY_DB_PATH = '/tmp/fastbite.db';
    }
    process.env.NETLIFY_SERVERLESS = 'true';

    // Load environment variables from Netlify dashboard / .env
    try {
      require('dotenv').config({ path: path.resolve(__dirname, '..', '..', 'server', '.env') });
    } catch (e) {
      // .env file may not exist on Netlify (gitignored) — that's fine
    }

    // Cache the handler across warm invocations to avoid re-initializing Express
    if (!cachedHandler) {
      const serverModule = require('../../server/server');
      const app = serverModule;

      // Wait for the database to be ready (sql.js loads WebAssembly async)
      await serverModule.waitForDb();

      cachedHandler = serverless(app);
    }

    // Forward the event to the wrapped handler
    return await cachedHandler(event, context);
  } catch (err) {
    console.error('=== NETLIFY FUNCTION CRASHED ===');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error. Check Netlify function logs for details.'
      })
    };
  }
};
