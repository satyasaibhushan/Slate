# Slate

Private-by-default static HTML draft publishing for agents. An agent uploads a
finished HTML page, gets back a stable URL, and can push new versions to the
same URL later. Drafts are only readable by their owner (API key or web
session) unless explicitly uploaded with `--public`.

Slate is a fork of [postplan](https://github.com/t3dotgg/postplan) by t3dotgg
(MIT). Differences from upstream:

- **Private-by-default serving.** Draft URLs require the owner's API key
  (`Authorization: Bearer …`) or a signed-in web session. Upload with
  `--public` to make a draft readable by anyone with the URL.
- **No identity broker.** Web sign-in is paste-an-API-key; accounts come from a
  single bootstrap key. No OAuth, no third-party dependency.
- **CLI verbs for the full lifecycle**: `upload`, `list`, `disable`, `delete`.
- Deploys as a Vercel serverless function (also runs as a plain Node server).

## How it works

- A **draft** is a stable container: ID, title, description, visibility, repo
  link, and a pointer to its current version.
- Every upload creates an immutable **version**. Re-uploading the same file
  updates the same draft (the CLI remembers file → draft mappings in
  `~/.slate/drafts.json`).
- Serving returns the uploaded HTML byte-for-byte with a strict CSP (no
  scripts, no cross-origin requests, no forms).
- Uploads are validated: no external/module scripts, no inline event handlers,
  no `javascript:` URLs, no forms, no iframes/embeds, no meta-refresh.

## CLI

```
slate auth set <api-key>       # save a key (or: slate auth login)
slate whoami                   # verify credentials
slate upload ./plan.html --description "Q3 roadmap"
slate upload ./plan.html       # again = new version, same URL
slate upload ./plan.html --new # force a separate new draft
slate upload ./plan.html --public
slate list
slate disable <draft-id>       # stop serving a draft
slate delete <draft-id>        # soft-delete a draft
```

Env overrides: `SLATE_API_URL`, `SLATE_API_KEY`.

Reading a private draft without the CLI:

```
curl -H "Authorization: Bearer $SLATE_API_KEY" https://slate.bhushan.fun/d/<draft-id>/raw
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string (use the pooled string on Neon) |
| `SLATE_BOOTSTRAP_API_KEY` | yes | Seeds the single account + API key on boot |
| `SLATE_PUBLIC_BASE_URL` | yes | e.g. `https://slate.bhushan.fun` (path-based draft URLs) |
| `SLATE_SESSION_SECRET` | for web UI | HMAC secret for dashboard session cookies |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | yes | S3 credentials |
| `S3_BUCKET_NAME` | yes | Bucket for draft HTML objects |
| `S3_REGION` | yes | Bucket region |
| `S3_ENDPOINT` | S3-compatible only | Leave unset for real AWS S3 |
| `MAX_HTML_BYTES` | no | Upload size cap (default 512 KiB) |

The `AWS_*` equivalents (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_S3_BUCKET_NAME`, `AWS_DEFAULT_REGION`, `AWS_ENDPOINT_URL`) also work as
fallbacks, but on Vercel you must use the `S3_*` names — the Lambda runtime
injects its own `AWS_*` credentials and Vercel reserves those names.

## Deploy (Vercel)

1. Import the repo into Vercel. No build step; `api/index.js` +
   `vercel.json` route everything through the Express app.
2. Set the environment variables above.
3. Add `slate.bhushan.fun` as a custom domain and create the CNAME it asks for.

## Local development

```
npm install
DATABASE_URL=... SLATE_BOOTSTRAP_API_KEY=... SLATE_PUBLIC_BASE_URL=http://localhost:3000 \
S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... S3_BUCKET_NAME=... S3_REGION=... \
npm run dev
```

The schema is created/migrated automatically on boot.

## License

MIT. Original work copyright (c) 2026 t3dotgg (see LICENSE); modifications
copyright (c) 2026 Satya Sai Bhushan.
