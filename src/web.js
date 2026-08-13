import express from "express";
import { config } from "./config.js";
import { findApiKeyByToken, pool } from "./db.js";
import { newInternalId } from "./ids.js";
import { clientIp } from "./client-ip.js";
import { createRateLimiter } from "./rate-limit.js";
import { randomToken, sha256 } from "./crypto.js";
import { getAccountDraftWithVersions, listAccountDrafts } from "./drafts.js";
import { getDraftIdFromHost, getRequestBaseUrl } from "./public-url.js";
import { clearSessionCookie, createSessionCookie, readSession } from "./web-auth.js";
import {
  renderAuthError,
  renderCliAuth,
  renderCliAuthKey,
  renderDashboard,
  renderDraftDetail,
  renderLogin
} from "./render-web.js";

// Server-rendered web UI: API-key login, the drafts dashboard, and the
// /cli/auth key page. Sign-in is a paste-your-API-key form — no external
// identity provider. Apex-domain only when draft subdomains are configured.
export function registerWebRoutes(app) {
  const web = [onlyApex, requireConfigured];
  const loginRateLimit = createRateLimiter({
    windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 900_000),
    max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10),
    keyPrefix: "login",
    key: (req) => clientIp(req) || "anonymous"
  });
  const keyMintRateLimit = createRateLimiter({
    windowMs: Number(process.env.KEY_MINT_RATE_LIMIT_WINDOW_MS || 3_600_000),
    max: Number(process.env.KEY_MINT_RATE_LIMIT_MAX || 10),
    keyPrefix: "key-mint",
    key: (req) => readSession(req)?.accountId || clientIp(req) || "anonymous"
  });
  const formBody = express.urlencoded({ extended: false, limit: "4kb" });

  app.get("/login", ...web, (req, res) => {
    if (readSession(req)) {
      return res.redirect(safeNextPath(req.query.next));
    }
    res.type("html").send(renderLogin({ next: safeNextPath(req.query.next) }));
  });

  app.post("/login", ...web, formBody, loginRateLimit, async (req, res, next) => {
    try {
      const submitted = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
      const nextPath = safeNextPath(req.body?.next);
      const apiKey = submitted ? await findApiKeyByToken(submitted) : null;

      if (!apiKey) {
        return res
          .status(401)
          .type("html")
          .send(renderLogin({ next: nextPath, error: "That API key was not recognized." }));
      }

      res.append(
        "Set-Cookie",
        createSessionCookie({ accountId: apiKey.account_id, accountName: apiKey.account_name })
      );
      res.redirect(nextPath);
    } catch (error) {
      next(error);
    }
  });

  app.post("/auth/sign-out", onlyApex, (req, res) => {
    res.append("Set-Cookie", clearSessionCookie());
    res.redirect("/");
  });

  app.get("/dashboard", ...web, async (req, res, next) => {
    try {
      const session = readSession(req);
      if (!session) {
        return res.redirect("/login?next=%2Fdashboard");
      }
      const drafts = await listAccountDrafts(session.accountId, {
        requestBaseUrl: getRequestBaseUrl(req)
      });
      res.type("html").send(renderDashboard({ session, drafts }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/dashboard/drafts/:draftId", ...web, async (req, res, next) => {
    try {
      const session = readSession(req);
      if (!session) {
        return res.redirect("/login?next=%2Fdashboard");
      }
      const result = await getAccountDraftWithVersions(session.accountId, req.params.draftId, {
        requestBaseUrl: getRequestBaseUrl(req)
      });
      if (!result) return next();
      res.type("html").send(
        renderDraftDetail({
          session,
          draft: result.draft,
          versions: result.versions
        })
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/cli/auth", ...web, async (req, res, next) => {
    try {
      const session = readSession(req);
      if (!session) {
        return res.redirect("/login?next=%2Fcli%2Fauth");
      }
      res.type("html").send(
        renderCliAuth({
          session,
          keys: await listAccountApiKeys(session.accountId)
        })
      );
    } catch (error) {
      next(error);
    }
  });

  // Mints a fresh named key for the signed-in account and shows it once.
  // POST + SameSite=Lax session cookie keeps cross-site requests out.
  app.post("/cli/auth/keys", ...web, formBody, keyMintRateLimit, async (req, res, next) => {
    try {
      const session = readSession(req);
      if (!session) {
        return res.redirect("/login?next=%2Fcli%2Fauth");
      }

      const token = `sl_${randomToken(32)}`;
      const keyName = `CLI · ${new Date().toISOString().slice(0, 10)}`;
      await pool.query(
        "INSERT INTO api_keys (id, account_id, name, key_hash) VALUES ($1, $2, $3, $4)",
        [newInternalId(), session.accountId, keyName, sha256(token)]
      );

      res.type("html").send(
        renderCliAuthKey({ session, token, keyName })
      );
    } catch (error) {
      next(error);
    }
  });

  app.post("/cli/auth/keys/:apiKeyId/revoke", ...web, formBody, async (req, res, next) => {
    try {
      const session = readSession(req);
      if (!session) {
        return res.redirect("/login?next=%2Fcli%2Fauth");
      }
      await pool.query(
        `
          UPDATE api_keys
          SET revoked_at = now()
          WHERE id = $1 AND account_id = $2 AND revoked_at IS NULL
        `,
        [req.params.apiKeyId, session.accountId]
      );
      res.redirect("/cli/auth");
    } catch (error) {
      next(error);
    }
  });
}

async function listAccountApiKeys(accountId) {
  const result = await pool.query(
    `
      SELECT id, name, created_at, last_used_at
      FROM api_keys
      WHERE account_id = $1 AND revoked_at IS NULL
      ORDER BY created_at DESC
    `,
    [accountId]
  );
  return result.rows;
}

function requireConfigured(req, res, next) {
  if (!config.sessionSecret) {
    return res
      .status(503)
      .type("html")
      .send(
        renderAuthError({
          message: "Web sign-in is not configured on this deployment (SLATE_SESSION_SECRET)."
        })
      );
  }
  next();
}

function onlyApex(req, res, next) {
  const draftId = getDraftIdFromHost({
    publicBaseUrl: config.publicBaseUrl,
    host: req.hostname || req.get("host")
  });
  if (draftId) return next("route");
  next();
}

// Only allow same-site relative paths as post-login destinations, so the
// `next` param can never become an open redirect.
function safeNextPath(value) {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  return value;
}
