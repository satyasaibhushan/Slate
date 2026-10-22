// Records the demo: real CLI commands run against a local Slate server and
// render in xterm.js, then the real web dashboard in Chromium.
// Usage: DEMO_DEPS=<dir with playwright + @xterm/xterm> node docs/demo/capture.mjs <scratch-dir>
// Run docs/demo/seed.sh <scratch-dir> first, with the same server env.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(process.env.DEMO_DEPS ?? ".", "node_modules", "x.js"));
const { chromium } = require("playwright");
const xtermDir = path.dirname(require.resolve("@xterm/xterm/package.json"));

const demoDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(demoDir, "../..");
const work = path.resolve(process.argv[2] ?? "");
const baseUrl = process.env.SLATE_PUBLIC_BASE_URL;
const apiKey = process.env.SLATE_BOOTSTRAP_API_KEY;
if (!fs.existsSync(path.join(work, "atlas")) || !baseUrl || !apiKey) {
  throw new Error("Run seed.sh first and export the server env (SLATE_PUBLIC_BASE_URL, SLATE_BOOTSTRAP_API_KEY).");
}

// `slate` on PATH points at this checkout's CLI, so the typed command is the one that runs.
const binDir = path.join(work, "bin");
fs.mkdirSync(binDir, { recursive: true });
fs.writeFileSync(path.join(binDir, "slate"), `#!/bin/sh\nexec node "${path.join(repoRoot, "bin/slate.js")}" "$@"\n`, { mode: 0o755 });
const shellEnv = {
  ...process.env,
  HOME: path.join(work, "home"),
  PATH: `${binDir}:${process.env.PATH}`,
  TERM: "xterm-256color",
  GIT_AUTHOR_NAME: "Demo Author",
  GIT_AUTHOR_EMAIL: "demo@example.test",
  GIT_COMMITTER_NAME: "Demo Author",
  GIT_COMMITTER_EMAIL: "demo@example.test"
};

const commands = [
  'slate upload rollout-plan.html --description "Q4 rollout for the platform review"',
  "sed -i 's/at risk/on track/; s/tag risk/tag/' rollout-plan.html && git commit -qam 'Mark EU cutover on track'",
  "slate upload rollout-plan.html",
  "clear",
  "slate list"
];

const size = { width: 1280, height: 720 };
const videoDir = path.join(work, "video");
fs.rmSync(videoDir, { recursive: true, force: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: size, recordVideo: { dir: videoDir, size } });
const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);

await page.setContent(`<!doctype html><html><head><style>
  ${fs.readFileSync(path.join(xtermDir, "css/xterm.css"), "utf8")}
  html,body{margin:0;height:100%;background:#15171c}
  #term{position:absolute;inset:28px 32px}
</style></head><body><div id="term"></div></body></html>`);
await page.addScriptTag({ content: fs.readFileSync(path.join(xtermDir, "lib/xterm.js"), "utf8") });
await page.evaluate(() => {
  const term = new window.Terminal({
    fontFamily: "DejaVu Sans Mono, monospace",
    fontSize: 17,
    lineHeight: 1.25,
    cols: 104,
    rows: 25,
    convertEol: true,
    theme: { background: "#15171c", foreground: "#e6e6e6", cursor: "#f2b48a" }
  });
  term.open(document.getElementById("term"));
  window.term = term;
});
const write = (text) => page.evaluate((t) => new Promise((done) => window.term.write(t, done)), text);
const prompt = () => write("\x1b[38;5;216m~/atlas\x1b[0m $ ");

await pause(400);
for (const command of commands) {
  await prompt();
  for (const char of command) {
    await write(char);
    await pause(22);
  }
  await pause(250);
  await write("\n");
  const output = execFileSync("bash", ["-c", `${command} 2>&1`], { cwd: path.join(work, "atlas"), env: shellEnv, encoding: "utf8" });
  await write(output);
  await pause(1400);
}
await prompt();
await pause(1200);

// The web dashboard, signed in with the same local demo key.
await page.goto(`${baseUrl}/login`);
await pause(600);
await page.locator('input[name="apiKey"]').pressSequentially(apiKey, { delay: 18 });
await pause(300);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/dashboard");
await pause(2600);
await page.locator(".row", { hasText: "Atlas search: Q4 rollout plan" }).getByRole("link", { name: "Details" }).click();
await page.waitForURL("**/dashboard/drafts/**");
await pause(2600);
const draftUrl = await page.locator("main p a[target=_blank]").first().getAttribute("href");
await page.goto(draftUrl);
await pause(2800);

await context.close();
const [video] = fs.readdirSync(videoDir);
fs.renameSync(path.join(videoDir, video), path.join(work, "raw.webm"));

// Poster: the dashboard at 2x for a crisp still.
const still = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
const stillPage = await still.newPage();
await stillPage.goto(`${baseUrl}/login`);
await stillPage.locator('input[name="apiKey"]').fill(apiKey);
await stillPage.getByRole("button", { name: "Sign in" }).click();
await stillPage.waitForURL("**/dashboard");
await stillPage.screenshot({ path: path.join(demoDir, "poster.png") });
await browser.close();
console.log(`raw video: ${path.join(work, "raw.webm")}`);
