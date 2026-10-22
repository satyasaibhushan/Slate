export function renderHome({ publicBaseUrl }) {
  return htmlPage({
    title: "Slate",
    head: `<style>${landingStyles}</style>`,
    body: `
      <main class="landing">
        <header class="landing-nav">
          <span class="wordmark">Slate</span>
          <nav><a href="/dashboard">My drafts</a><a href="/cli/auth">CLI setup</a></nav>
        </header>
        <section class="hero">
          <h1>Publish an HTML page to a private URL. Update it in place.</h1>
          <p class="lede">An agent uploads a finished page and gets a stable link. Uploading the same file again adds a version at the same URL. Only the owner can read it unless it goes up with <code>--public</code>.</p>
          <pre class="command"><span>$</span> slate upload ./plan.html</pre>
        </section>
        <figure class="preview">
          <video src="/demo/demo.webm" poster="/demo/poster.png" autoplay muted loop playsinline aria-label="The Slate CLI uploading a draft twice, then the drafts dashboard, version history, and the published page"></video>
          <figcaption>The real CLI and dashboard running against a local server with fictional drafts.</figcaption>
        </figure>
        <footer class="landing-foot">
          <span>Health: <a href="/healthz">/healthz</a></span>
          <span>Public base URL: ${escapeHtml(publicBaseUrl || "not configured")}</span>
          <a href="https://github.com/satyasaibhushan/Slate">Source on GitHub</a>
        </footer>
      </main>
    `
  });
}

const landingStyles = `
  body { background: #20252b; color: #eceae4; }
  .landing { max-width: 1120px; margin: 0 auto; padding: 0 28px 56px; }
  .landing a { color: inherit; }
  .landing-nav { display: flex; justify-content: space-between; align-items: center; padding: 26px 0; }
  .wordmark { font: 600 22px/1 "Iowan Old Style", Charter, Georgia, serif; letter-spacing: .01em; }
  .landing-nav nav { display: flex; gap: 22px; font-size: 15px; }
  .landing-nav nav a { color: #b9bcc0; text-decoration: none; }
  .landing-nav nav a:hover { color: #fff; }
  .hero { max-width: 760px; margin: 56px auto 40px; text-align: center; }
  .hero h1 { font: 500 clamp(34px, 5vw, 54px)/1.08 "Iowan Old Style", Charter, Georgia, serif; letter-spacing: -.01em; margin: 0 0 20px; }
  .landing .lede { color: #b9bcc0; font-size: 18px; margin: 0 auto 28px; max-width: 640px; }
  .lede code { color: #f2c6a6; }
  .landing .command { display: inline-block; margin: 0; padding: 12px 18px; background: #161a1f; border: 1px solid #3a4048; border-radius: 8px; color: #eceae4; font: 15px/1.4 ui-monospace, "SF Mono", Menlo, monospace; }
  .command span { color: #f2b48a; margin-right: 8px; }
  .preview { margin: 0; }
  .preview video { display: block; width: 100%; aspect-ratio: 16 / 9; border-radius: 12px; border: 1px solid #3a4048; background: #15171c; box-shadow: 0 40px 90px rgba(0, 0, 0, .45); }
  .preview figcaption { color: #8d9298; font-size: 14px; text-align: center; margin-top: 14px; }
  .landing-foot { display: flex; flex-wrap: wrap; gap: 8px 24px; justify-content: center; margin-top: 56px; color: #8d9298; font-size: 14px; }
`;

export function renderNotFound() {
  return htmlPage({
    title: "Draft not found",
    body: `
      <main class="home">
        <h1>Draft not found</h1>
        <p>The requested draft is unavailable.</p>
      </main>
    `
  });
}

export function renderUnauthorized({ loginUrl }) {
  return htmlPage({
    title: "Private draft",
    body: `
      <main class="home">
        <h1>Private draft</h1>
        <p>This draft is private. Send the owner's API key as a Bearer token, or sign in.</p>
        <pre>curl -H "Authorization: Bearer &lt;api-key&gt;" &lt;this-url&gt;</pre>
        <p><a href="${escapeHtml(loginUrl)}">Sign in to view</a></p>
      </main>
    `
  });
}

function htmlPage({ title, body, head = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      background: #f8fafc;
      color: #111827;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .home {
      max-width: 760px;
      margin: 64px auto;
      padding: 0 20px;
    }

    h1 {
      margin: 0 0 12px;
      font-size: 40px;
      line-height: 1.1;
    }

    p {
      color: #374151;
      font-size: 17px;
      line-height: 1.6;
    }

    pre {
      overflow-x: auto;
      padding: 14px;
      border: 1px solid #d1d5db;
      background: #ffffff;
      border-radius: 6px;
    }
  </style>
  ${head}
</head>
<body>${body}</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
