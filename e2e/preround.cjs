// E2E: Delegate pre-round between two people who both have Delegates. Run: node e2e/preround.cjs (servers up)
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const run = Date.now().toString(36);

async function signUpWithDelegate(page, name, stances) {
  await page.goto(`${BASE}/login`);
  await page.getByRole("textbox", { name: "Your name" }).fill(name);
  await page.getByRole("textbox", { name: "Email" }).fill(`${name.toLowerCase()}-${run}@e2e.local`);
  await page.getByLabel("I am 18 or older.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/onboarding/);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  for (const s of stances) await page.getByRole("button", { name: s, exact: true }).click();
  await page.getByRole("button", { name: /finish/ }).click();
  await page.getByRole("button", { name: "Create my Delegate" }).click();
  await page.waitForURL(`${BASE}/`);
}

(async () => {
  const browser = await chromium.launch();
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const b = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await signUpWithDelegate(a, "Mira", ["Disagree", "Agree", "Agree", "Agree", "Depends", "Agree", "Agree"]);
  await signUpWithDelegate(b, "Theo", ["Agree", "Disagree", "Disagree", "Agree", "Agree", "Disagree", "Disagree"]);

  await a.goto(`${BASE}/chambers/new?template=decision`);
  await a.getByPlaceholder("March trip").fill("Summer trip");
  await a.getByPlaceholder(/Where should we go/).fill("Where should we go on our summer trip, and how should we split the costs?");
  await a.getByRole("button", { name: "Create Chamber" }).click();
  await a.waitForURL(/chambers\/chm_/);
  const invite = await a.locator("div.font-mono").first().innerText();
  await b.goto(invite);
  await b.getByRole("button", { name: /Join as Theo/ }).click();
  await b.waitForURL(/chambers\/chm_/);

  // Start the pre-round
  await a.reload();
  await a.getByRole("button", { name: "Start a pre-round" }).click();
  await a.getByRole("button", { name: "Release to the group" }).waitFor({ timeout: 20000 });
  await shot(a, "10-preround-my-draft");

  // Theo cannot see Mira's opening yet
  await b.reload();
  await b.getByRole("button", { name: "Release to the group" }).waitFor({ timeout: 20000 });
  await a.getByRole("button", { name: "Release to the group" }).click();
  await b.reload();
  if ((await b.content()).includes("Reviewed and released by Mira")) throw new Error("Mira's opening leaked before simultaneous reveal");
  await b.getByRole("button", { name: "Release to the group" }).click();

  // Replies: both review, then everyone sees everything
  await b.getByText("Replies", { exact: true }).waitFor({ timeout: 20000 });
  await b.getByRole("button", { name: "Release to the group" }).click();
  await a.reload();
  await a.getByRole("button", { name: "Release to the group" }).click();
  await a.getByRole("button", { name: /Use my side as a starting point/ }).waitFor({ timeout: 10000 });
  await shot(a, "11-preround-revealed");
  await a.getByRole("button", { name: /Use my side as a starting point/ }).click();
  const composed = await a.getByPlaceholder(/Say what you think/).inputValue();
  if (!composed.includes("Mira")) throw new Error("Use-my-side did not fill the composer");

  console.log("Pre-round E2E OK");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}
