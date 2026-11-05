// E2E: public topic — start it, vote in the browser, see opinion groups, take a divisive statement to a Chamber.
// Run: node e2e/topics.cjs (servers up)
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const API = `${BASE}/api/v1`;
const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const run = Date.now().toString(36);

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
  const browser = await chromium.launch();
  const host = await call("/auth/login", null, { email: `host-${run}@e2e.local`, name: "Host", is_adult: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(`${BASE}/login`);
  await page.evaluate((t) => localStorage.setItem("argumente.token", t), host.token);

  // Start a topic in the UI
  await page.goto(`${BASE}/topics/new`);
  await page.getByPlaceholder("How should flatmates split rent?").fill(`Should cities ban cars from their centres? (${run})`);
  await page.getByPlaceholder(/Rent should follow room size/).fill(
    ["Car-free centres make streets safer", "Banning cars hurts people with disabilities", "Shops lose customers without parking", "Public transport must improve first", "Cities belong to pedestrians"].join("\n"),
  );
  await page.getByRole("button", { name: "Start the topic" }).click();
  await page.waitForURL(/topics\/should-cities/);
  const slug = page.url().split("/topics/")[1];

  // Seven other people vote (two camps + one mixed), via the API
  const t = await call(`/topics/${slug}`);
  const camps = [[1, -1, -1, 1, 1], [-1, 1, 1, 1, -1]];
  for (let i = 0; i < 7; i++) {
    const u = await call("/auth/login", null, { email: `v${i}-${run}@e2e.local`, name: `V${i}`, is_adult: true });
    for (const [k, st] of t.statements.entries()) await call(`/topic-statements/${st.id}/vote`, u.token, { vote: camps[i % 2][k] });
  }

  // The host votes in the browser, one statement at a time
  await page.reload();
  for (let k = 0; k < 5; k++) {
    await page.getByText("What do you think?").waitFor();
    await page.getByRole("button", { name: k % 2 ? "Disagree" : "Agree", exact: true }).click();
    await page.waitForTimeout(250);
  }
  await page.getByText("You’ve voted on everything").waitFor();
  await page.getByText("Group A").first().waitFor({ timeout: 10000 });
  await page.getByText("Where the groups split").waitFor();
  await page.getByText("What every group agrees on").waitFor();
  await page.screenshot({ path: path.join(SHOTS, "26-topic-landscape.png"), fullPage: true });
  if (await page.getByText("you", { exact: true }).count() < 1) throw new Error("Host's own group not marked");

  // Public, logged-out view: aggregates only, no names
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`${BASE}/topics/${slug}`);
  await anon.getByText("Sign in").first().waitFor();
  const visible = await anon.locator("main").innerText();
  if (/\bV[0-6]\b/.test(visible) || visible.includes("Host")) throw new Error("A voter name leaked into the public topic page");

  // Divisive statement → private Chamber, prefilled
  await page.getByRole("link", { name: /Take this to a private Chamber/ }).first().click();
  await page.waitForURL(/chambers\/new/);
  const q = await page.getByRole("textbox", { name: /The question/ }).inputValue();
  if (!q.includes("In particular")) throw new Error("Chamber not prefilled from the divisive statement");

  console.log("Topics E2E OK");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
