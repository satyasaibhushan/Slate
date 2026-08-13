import { createApp } from "../src/api.js";
import { ensureBootstrapApiKey, initDb } from "../src/db.js";
import { assertStorageConfigured } from "../src/storage.js";

// Vercel serverless entry. The Express app handles every route (see
// vercel.json rewrites). Init (schema + bootstrap key) runs once per warm
// instance; a failed init clears the memo so the next request retries instead
// of serving from a half-initialized instance forever.
const app = createApp();
let ready;

async function init() {
  assertStorageConfigured();
  await initDb();
  await ensureBootstrapApiKey();
}

export default async function handler(req, res) {
  ready ||= init().catch((error) => {
    ready = null;
    throw error;
  });
  await ready;
  return app(req, res);
}
