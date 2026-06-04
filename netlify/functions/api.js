// === Netlify Serverless Function — Express API Wrapper ===
// This file acts as the entry point for all /api/* requests on Netlify.

const serverless = require('serverless-http');
const path = require('path');

// Tell Node.js to resolve modules from the project root
// (serverless-http + express need to find the same modules as the local app)
module.exports = async (event, context) => {
  // ⚠️ On Netlify/Lambda, only /tmp is writable.
  // We override DB_PATH by setting an env variable that db.js reads.
  // The better-sqlite3 database will be created in /tmp.
  if (!process.env.NETLIFY_DB_PATH) {
    process.env.NETLIFY_DB_PATH = '/tmp/fastbite.db';
  }

  // Make sure dotenv picks up the .env file from the project root
  require('dotenv').config({ path: path.resolve(__dirname, '..', '..', 'server', '.env') });

  // Import the Express app AFTER env is configured
  const app = require('../../server/server');

  // Wrap Express with serverless-http
  const handler = serverless(app);

  // Forward the event to the wrapped handler
  return await handler(event, context);
};
