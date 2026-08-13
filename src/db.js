import pg from "pg";
import { config, requireEnv } from "./config.js";
import { sha256 } from "./crypto.js";
import { newInternalId } from "./ids.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: requireEnv("DATABASE_URL", config.databaseUrl)
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      title TEXT NOT NULL,
      description TEXT,
      visibility TEXT NOT NULL DEFAULT 'private',
      current_version_id TEXT,
      repo_org TEXT,
      repo_name TEXT,
      repo_host TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ,
      disabled_at TIMESTAMPTZ,
      disabled_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS draft_versions (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL REFERENCES drafts(id),
      version_number INTEGER NOT NULL,
      object_key TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by_api_key_id TEXT NOT NULL REFERENCES api_keys(id),
      source_ip TEXT,
      user_agent TEXT,
      cli_version TEXT,
      git_branch TEXT,
      git_commit_sha TEXT,
      git_commit_subject TEXT,
      git_dirty BOOLEAN,
      original_filename TEXT,
      request_id TEXT,
      has_inline_script BOOLEAN,
      external_image_hosts JSONB,
      ci_run_url TEXT,
      ci_actor TEXT,
      UNIQUE (draft_id, version_number)
    );

    CREATE TABLE IF NOT EXISTS upload_events (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL REFERENCES drafts(id),
      draft_version_id TEXT REFERENCES draft_versions(id),
      api_key_id TEXT NOT NULL REFERENCES api_keys(id),
      event_type TEXT NOT NULL,
      source_ip TEXT,
      user_agent TEXT,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS draft_versions_draft_id_idx ON draft_versions(draft_id);
    CREATE INDEX IF NOT EXISTS upload_events_draft_id_idx ON upload_events(draft_id);
    CREATE INDEX IF NOT EXISTS drafts_account_id_idx ON drafts(account_id);

    -- Backfill for databases created before a column was introduced.
    ALTER TABLE drafts ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
  `);
}

export async function ensureBootstrapApiKey() {
  if (!config.bootstrapApiKey) return;

  const accountId = "acct_bootstrap";
  const apiKeyId = "key_bootstrap";
  const keyHash = sha256(config.bootstrapApiKey);

  await pool.query(
    `
      INSERT INTO accounts (id, name)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET updated_at = now()
    `,
    [accountId, "Bootstrap Account"]
  );

  await pool.query(
    `
      INSERT INTO api_keys (id, account_id, name, key_hash)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE
        SET key_hash = EXCLUDED.key_hash,
            name = EXCLUDED.name,
            revoked_at = NULL
    `,
    [apiKeyId, accountId, "Bootstrap API Key", keyHash]
  );
}

export async function findApiKeyByToken(token) {
  const keyHash = sha256(token);
  const result = await pool.query(
    `
      SELECT api_keys.id, api_keys.account_id, api_keys.name, accounts.name AS account_name
      FROM api_keys
      JOIN accounts ON accounts.id = api_keys.account_id
      WHERE api_keys.key_hash = $1
        AND api_keys.revoked_at IS NULL
      LIMIT 1
    `,
    [keyHash]
  );

  const apiKey = result.rows[0] || null;
  if (apiKey) {
    await pool.query("UPDATE api_keys SET last_used_at = now() WHERE id = $1", [apiKey.id]);
  }
  return apiKey;
}

export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await work(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function newEventId() {
  return newInternalId();
}
