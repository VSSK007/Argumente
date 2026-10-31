// E2E: close as understood → agree-to-disagree record signed by both → revisit with context. Live updates via tickets.
// Run: node e2e/lineage.cjs (servers up)
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const API = `${BASE}/api/v1`;
const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const run = Date.now().toString(36);

async function call(pathname, token, body) {
  const r = await fetch(API + pathname, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${pathname}: ${r.status} ${await r.text()}`);
  return r.json();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const a = await call("/auth/login", null, { email: `ana-${run}@e2e.local`, name: "Ana", is_adult: true });
  const t = await call("/auth/login", null, { email: `tom-${run}@e2e.local`, name: "Tom", is_adult: true });
  const ch = await call("/chambers", a.token, { template: "household", title: "Rent split", question: "Should rent be split by room size?" });
  await call(`/invites/${ch.invite_token}/accept`, t.token, {});
  await call(`/chambers/${ch.id}/intake`, a.token, { endorse: true, text: "Rent should be split by room size because I have the smallest room and pay the same as everyone." });
  await call(`/chambers/${ch.id}/intake`, t.token, { endorse: true, text: "Equal rent is fair because we all share the kitchen and living room equally." });
  await call(`/chambers/${ch.id}/advance`, a.token, { action: "analyze" });
  await sleep(1500);
  for (const u of [a, t]) {
    const v = await call(`/chambers/${ch.id}`, u.token);
    await call(`/restatements/${v.restatements.find((r) => r.is_mine).id}/accept`, u.token, {});
  }
  await sleep(1500);

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(`${BASE}/login`);
  await page.evaluate((tok) => localStorage.setItem("argumente.token", tok), a.token);
  await page.goto(`${BASE}/chambers/${ch.id}`);
  await page.getByText("live", { exact: false }).first().waitFor({ timeout: 10000 });

  await page.getByRole("button", { name: /Close: understood/ }).click();
  await page.getByText("Agree-to-disagree record").waitFor({ timeout: 10000 });
  const box = page.locator("textarea").last();
  await box.fill((await box.inputValue()) + "alternating who gets the big room each year, and reviewing in June.");
  await page.getByRole("button", { name: "Propose this record" }).click();
  await page.getByRole("button", { name: "Approve" }).click();

  // Tom approves from elsewhere; Ana's open page updates live (no reload)
  const v = await call(`/chambers/${ch.id}`, t.token);
  const item = v.agreement.items.find((i) => i.kind === "understanding");
  await call(`/agreement-items/${item.id}/decide`, t.token, { decision: "approve" });
  await page.getByText("✓ Tom").waitFor({ timeout: 5000 });
  await page.getByText("Agree-to-disagree record").scrollIntoViewIfNeeded();
  await shot(page, "13-agree-to-disagree");

  await page.getByRole("button", { name: "Revisit this with the same people" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith(ch.id));
  await page.getByText("Revisiting").waitFor();
  await page.getByText(/alternating who gets the big room/).waitFor();
  await shot(page, "14-revisit-context");

  console.log("Lineage E2E OK");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
}
