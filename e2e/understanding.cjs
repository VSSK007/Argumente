// E2E: landing demo, Steelman Exchange, crux what-if, evidence board, Position Record.
// Run: node e2e/understanding.cjs (servers up)
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const API = `${BASE}/api/v1`;
const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const run = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(p, token, body, method) {
  const r = await fetch(API + p, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`);
  return r.json();
}
const shot = (page, name, full = true) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full });
async function asUser(browser, token, viewport = { width: 1280, height: 900 }) {
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.goto(`${BASE}/login`);
  await page.evaluate((t) => (t ? localStorage.setItem("argumente.token", t) : localStorage.clear()), token);
  return page;
}

(async () => {
  const browser = await chromium.launch();

  // ---- Landing page + guided demo (logged out)
  const visitor = await asUser(browser, null);
  await visitor.goto(`${BASE}/`);
  await visitor.getByText("Watch the 60-second demo").waitFor();
  await shot(visitor, "21-landing", false);
  await visitor.locator("#demo").scrollIntoViewIfNeeded();
  for (let k = 0; k < 7; k++) await visitor.getByRole("button", { name: "Next step" }).click();
  await visitor.getByText("Agree, or honestly agree to disagree").waitFor();
  await visitor.getByRole("button", { name: "Step 7: Understanding Score" }).click();
  await visitor.getByText("Ana understood Tom").waitFor();
  await sleep(1500);
  await visitor.locator("#demo").screenshot({ path: path.join(SHOTS, "22-demo-score.png") });

  // ---- Data: two people at the Restatement stage
  const a = await call("/auth/login", null, { email: `ana-${run}@e2e.local`, name: "Ana", is_adult: true });
  const t = await call("/auth/login", null, { email: `tom-${run}@e2e.local`, name: "Tom", is_adult: true });
  await call("/delegates", a.token, { name: "Juniper", methodology: "pragmatist", answers: [] });
  const ch = await call("/chambers", a.token, { template: "household", title: "Rent split", question: "Should rent be split by room size?" });
  await call(`/invites/${ch.invite_token}/accept`, t.token, {});
  await call(`/chambers/${ch.id}/intake`, a.token, { endorse: true, text: "Rent should be split by room size because I have the smallest room and pay the same. It feels unfair every month." });
  await call(`/chambers/${ch.id}/intake`, t.token, { endorse: true, text: "Equal rent is fair because we all share the kitchen and living room equally. The flat is 60% shared space." });
  await call(`/chambers/${ch.id}/advance`, a.token, { action: "analyze" });
  await sleep(1200);

  // ---- Steelman Exchange: Ana writes, Tom rates in the browser
  const ana = await asUser(browser, a.token);
  await ana.goto(`${BASE}/chambers/${ch.id}`);
  await ana.getByRole("button", { name: "Skip", exact: true }).click();
  await ana.getByLabel("Your steelman").fill("Tom isn't defending a perk: the rent mostly buys rooms we share equally, so splitting by bedroom size overweights the smallest part.");
  await ana.getByRole("button", { name: /Send to Tom to rate/ }).click();
  await ana.getByText("Waiting for Tom to rate it.").waitFor();

  const tom = await asUser(browser, t.token);
  await tom.goto(`${BASE}/chambers/${ch.id}`);
  await tom.getByRole("button", { name: "Skip", exact: true }).click();
  await tom.getByText("Ana tried to put your view in their words").waitFor();
  await tom.getByRole("radio", { name: "5 of 5" }).click();
  await tom.getByLabel("What's missing").fill("Honestly better than I put it.");
  await tom.getByRole("button", { name: "Rate", exact: true }).click();
  await ana.getByText("Accepted by Tom").waitFor({ timeout: 5000 }); // arrives live
  await ana.getByText("Accepted by Tom").scrollIntoViewIfNeeded();
  await shot(ana, "23-steelman-accepted", false);

  // ---- To the Map; confirm cruxes; what-if + evidence board
  for (const u of [a, t]) {
    const v = await call(`/chambers/${ch.id}`, u.token);
    for (const c of v.cruxes.filter((c) => c.is_mine)) await call(`/cruxes/${c.id}/confirm`, u.token, { confirmed: true });
    await call(`/restatements/${v.restatements.find((r) => r.is_mine).id}/accept`, u.token, {});
  }
  await ana.getByRole("tab", { name: "Understanding Map" }).click({ timeout: 15000 });
  await ana.getByText("What if…").waitFor();
  await ana.locator("label", { hasText: "Suppose it’s not true" }).first().click();
  await ana.getByText(/said this would change/).first().waitFor();
  await ana.getByLabel("What it shows").fill("Floor plan: shared rooms are 58% of the flat");
  await ana.getByLabel("Link (optional)").fill("https://example.org/floorplan");
  await ana.getByRole("button", { name: "Add to the board" }).click();
  await tom.getByRole("tab", { name: "Understanding Map" }).click();
  await tom.getByText("Floor plan: shared rooms are 58% of the flat").waitFor({ timeout: 5000 });
  await ana.getByText("What if…").scrollIntoViewIfNeeded();
  await shot(ana, "24-whatif-evidence", false);

  // ---- Close, record a change of mind, see it on Me and (opted-in) public profile
  await call(`/chambers/${ch.id}/advance`, a.token, { action: "close_understood" });
  await ana.getByRole("tab", { name: "Now" }).click();
  await ana.getByLabel("What changed your mind").fill("I thought equal rent was obviously unfair. Shared space matters more than I admitted.", { timeout: 10000 });
  await ana.getByText("Show on my public profile").click();
  await ana.getByRole("button", { name: "Add to my record" }).click();
  await ana.getByText("Added to your Position Record").waitFor();
  await ana.goto(`${BASE}/me`);
  await ana.getByText("Where you’ve changed your mind").waitFor();
  await ana.getByText("Show my record on my Delegate’s public profile").click();
  await sleep(500);
  const handle = (await call("/delegates/me", a.token)).handle;
  await tom.goto(`${BASE}/d/${handle}`);
  await tom.getByText("How Ana handles disagreement").waitFor();
  await tom.getByText("Shared space matters more than I admitted").waitFor();
  if ((await tom.content()).includes("Rent split")) throw new Error("Public record leaked the Chamber title");
  await shot(tom, "25-public-record", false);

  console.log("Understanding E2E OK");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
