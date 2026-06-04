// === Netlify Serverless Function — Express API Wrapper ===
// This file acts as the entry point for all /api/* requests on Netlify.
// Netlify Functions require a named "handler" export.

const serverless = require('serverless-http');
const path = require('path');

let cachedHandler = null;

exports.handler = async (event, context) => {
  // ⚠️ On Netlify/Lambda, only /tmp is writable.
  // We override DB_PATH by setting an env variable that db.js reads.
  // The better-sqlite3 database will be created in /tmp.
  if (!process.env.NETLIFY_DB_PATH) {
    process.env.NETLIFY_DB_PATH = '/tmp/fastbite.db';
  }

  // Make sure dotenv picks up the .env file from the project root
  require('dotenv').config({ path: path.resolve(__dirname, '..', '..', 'server', '.env') });

  // Cache the handler across warm invocations to avoid re-initializing Express
  if (!cachedHandler) {
    const app = require('../../server/server');
    cachedHandler = serverless(app);
  }

  // Forward the event to the wrapped handler
  return await cachedHandler(event, context);
};
