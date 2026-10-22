# Slate

Private-by-default static HTML draft publishing for agents. An agent uploads a
finished HTML page, gets back a stable URL, and can push new versions to the
same URL later. Drafts are only readable by their owner (API key or web
session) unless explicitly uploaded with `--public`.

![Slate CLI uploading a draft twice, then the dashboard and the published page](docs/demo/demo.gif)

The real CLI and web dashboard running against a local server with fictional
drafts. [Watch the WebM](docs/demo/demo.webm) or see the
[still](docs/demo/poster.png). Live site: <https://slate.bhushan.fun>.

I built it so the HTML reports and plans my agents write have one link I can
reopen after every revision, without making them public by accident.

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

## Tech stack

- Node 20+, Express 5, server-rendered HTML (no frontend build)
- Postgres via `pg`, schema created on boot
- S3 or any S3-compatible store for draft HTML (`@aws-sdk/client-s3`)
- `parse5` for upload validation, `commander` for the CLI
- Vercel serverless function in production (`api/index.js`)

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

## Reproduce the demo

The demo runs the real server, CLI, and dashboard with throwaway local
services and the fictional drafts in `docs/demo/drafts/`. Needs Docker and
Node 20+.

```
npm install
docker run -d --name slate-demo-pg -e POSTGRES_PASSWORD=demo -e POSTGRES_DB=slate -p 127.0.0.1:55432:5432 postgres:16-alpine
docker run -d --name slate-demo-s3 -p 127.0.0.1:59090:9090 adobe/s3mock
curl -X PUT http://127.0.0.1:59090/slate-demo

export DATABASE_URL=postgres://postgres:demo@127.0.0.1:55432/slate
export SLATE_BOOTSTRAP_API_KEY=sl_demo_local_only_key SLATE_SESSION_SECRET=demo-only
export SLATE_PUBLIC_BASE_URL=http://localhost:3911 PORT=3911
export S3_ACCESS_KEY_ID=demo S3_SECRET_ACCESS_KEY=demo S3_BUCKET_NAME=slate-demo
export S3_REGION=us-east-1 S3_ENDPOINT=http://127.0.0.1:59090
npm start &

npm install --prefix /tmp/slate-demo-deps playwright @xterm/xterm
npx --prefix /tmp/slate-demo-deps playwright install chromium
docs/demo/seed.sh /tmp/slate-demo/work
DEMO_DEPS=/tmp/slate-demo-deps node docs/demo/capture.mjs /tmp/slate-demo/work
docs/demo/encode.sh /tmp/slate-demo/work
```

`seed.sh` uploads two drafts through the CLI with an isolated `HOME`, so your
real `~/.slate` is never touched. `capture.mjs` types and runs each CLI
command for real, prints its actual output in xterm.js, then signs in to the
dashboard. It writes `docs/demo/poster.png`; `encode.sh` writes
`demo.webm` and `demo.gif`. The landing page at `/` plays the same files from
`/demo/poster.png` and `/demo/demo.webm`.

## Status and limitations

- Version 0.1.0. Runs in production at <https://slate.bhushan.fun>.
- One account, seeded from `SLATE_BOOTSTRAP_API_KEY`. Extra keys can be
  minted from `/cli/auth`, but there is no multi-user sign-up.
- Drafts are static. Scripts, forms, iframes, and cross-origin requests are
  rejected on upload and blocked by the serving CSP.
- Uploads are capped at 512 KiB by default (`MAX_HTML_BYTES`).
- The CLI is not published to npm. Install from this repo (`npm link`).

## License

MIT. Original work copyright (c) 2026 t3dotgg (see LICENSE); modifications
copyright (c) 2026 Satya Sai Bhushan.
