// E2E: notifications (bell + inbox), feedback at close, metrics for moderators, legal pages, security headers.
// Run: node e2e/ops.cjs (servers up; API needs ADMIN_EMAILS=dev@demo.local)
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const API = `${BASE}/api/v1`;
const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const run = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(p, token, body) {
  const r = await fetch(API + p, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`);
  return r.json();
}

(async () => {
  // Security headers (CSP, framing, nosniff) on a normal page
  const res = await fetch(`${BASE}/login`);
  for (const h of ["content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy"])
    if (!res.headers.get(h)) throw new Error(`Missing security header: ${h}`);
  if (!res.headers.get("content-security-policy").includes("frame-ancestors 'none'")) throw new Error("CSP lacks frame-ancestors");
  if (res.headers.get("x-powered-by")) throw new Error("x-powered-by should be off");
  // Runtime API proxy and the signing keys
  const keys = await (await fetch(`${BASE}/.well-known/argumente-keys.json`)).json();
  if (!keys.keys?.[0]?.x) throw new Error("Signing keys not reachable through the proxy");

  const a = await call("/auth/login", null, { email: `oa-${run}@e2e.local`, name: "Olu", is_adult: true });
  const b = await call("/auth/login", null, { email: `ob-${run}@e2e.local`, name: "Pia", is_adult: true });
  const ch = await call("/chambers", a.token, { template: "household", title: "Dishes rota", question: "How should we share the washing up?" });
  await call(`/invites/${ch.invite_token}/accept`, b.token, {});
  await call(`/chambers/${ch.id}/intake`, a.token, { endorse: true, text: "We should alternate days because that's the simplest rule. I hate keeping score." });
  await call(`/chambers/${ch.id}/intake`, b.token, { endorse: true, text: "A rota by who cooks is fairer because the cook shouldn't also clean. I work late on Thursdays." });
  await call(`/chambers/${ch.id}/advance`, a.token, { action: "analyze" });
  await sleep(1500);

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(`${BASE}/login`);
  await page.evaluate((t) => localStorage.setItem("argumente.token", t), b.token);

  // Pia has nudges: bell shows a badge, inbox lists them with no private words
  await page.goto(`${BASE}/`);
  await page.getByRole("link", { name: /Inbox, \d+ unread/ }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(SHOTS, "30-bell.png") });
  await page.getByRole("link", { name: /Inbox, \d+ unread/ }).click();
  await page.getByText("Your turn: is this what you mean?").waitFor();
  const inboxText = await page.locator("main").innerText();
  if (/simplest rule|keeping score|work late/.test(inboxText)) throw new Error("Inbox leaked someone's words");
  await page.screenshot({ path: path.join(SHOTS, "31-inbox.png"), fullPage: true });
  await page.getByRole("button", { name: "Mark all read" }).click();
  await page.getByRole("link", { name: "Inbox", exact: true }).waitFor();

  // Finish the Chamber, then feedback
  for (const u of [a, b]) {
    const v = await call(`/chambers/${ch.id}`, u.token);
    await call(`/restatements/${v.restatements.find((r) => r.is_mine).id}/accept`, u.token, {});
  }
  await sleep(1500);
  await call(`/chambers/${ch.id}/advance`, a.token, { action: "close_understood" });
  await page.goto(`${BASE}/chambers/${ch.id}`);
  await page.getByText("Was this useful?").waitFor({ timeout: 15000 });
  await page.getByRole("radio", { name: "4 of 5" }).click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByLabel("Anything else?").fill("The rota idea was new to us.");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await page.getByText("Thanks for the feedback").waitFor();

  // Moderator sees aggregate metrics
  const mod = await call("/auth/login", null, { email: "dev@demo.local", name: "Dev", is_adult: true });
  await page.evaluate((t) => localStorage.setItem("argumente.token", t), mod.token);
  await page.goto(`${BASE}/admin`);
  await page.getByText("Metrics (aggregates only)").waitFor({ timeout: 30000 });
  await page.getByText("Where Chambers drop off").waitFor();
  const adminText = await page.locator("main").innerText();
  if (/simplest rule|keeping score|alternate days/.test(adminText)) throw new Error("Metrics leaked Chamber content");
  await page.screenshot({ path: path.join(SHOTS, "32-metrics.png"), fullPage: true });

  // Legal pages are public and linked from the footer
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`${BASE}/privacy`);
  await anon.getByRole("heading", { name: "Privacy" }).waitFor();
  await anon.getByText("Who can see what").waitFor();
  await anon.getByRole("link", { name: "Terms" }).first().click();
  await anon.getByRole("heading", { name: "Terms of use" }).waitFor();

  console.log("Ops E2E OK");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
