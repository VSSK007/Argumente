// End-to-end browser test of the core loop with two people in separate browser contexts.
// Requires the API on :8000 and web on :3000 (./scripts/dev.sh). Run: node e2e/flow.cjs
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const run = Date.now().toString(36);

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function login(page, name, next = "") {
  await page.goto(`${BASE}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByRole("textbox", { name: "Your name" }).fill(name);
  await page.getByRole("textbox", { name: "Email" }).fill(`${name.toLowerCase()}-${run}@e2e.local`);
  await page.getByLabel("I am 18 or older.").check();
  await page.getByRole("button", { name: "Continue" }).click();
}

(async () => {
  const browser = await chromium.launch();
  const alice = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const bob = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(); // mobile

  // --- Alice: sign in and create a Delegate
  await login(alice, "Alice");
  await alice.waitForURL(/onboarding/);
  await alice.getByRole("button", { name: "Next", exact: true }).click();
  await alice.getByRole("button", { name: "Next", exact: true }).click();
  for (const stance of ["Disagree", "Agree", "Agree", "Agree", "Depends", "Agree", "Agree"]) {
    await alice.getByRole("button", { name: stance, exact: true }).click();
  }
  await alice.getByRole("button", { name: /finish/ }).click();
  await shot(alice, "01-delegate-summary");
  await alice.getByRole("button", { name: "Create my Delegate" }).click();
  await alice.waitForURL(`${BASE}/`);

  // --- Alice: create a Chamber
  await alice.goto(`${BASE}/chambers/new?template=decision`);
  await alice.getByPlaceholder("March trip").fill("Spring trip");
  await alice.getByPlaceholder(/Where should we go/).fill("Where should we go this spring, and what should we spend?");
  await alice.getByRole("button", { name: "Create Chamber" }).click();
  await alice.waitForURL(/chambers\/chm_/);
  const invite = await alice.locator("div.font-mono").first().innerText();

  // --- Bob: join via invite link as a guest (no Delegate)
  await login(bob, "Bob", new URL(invite).pathname);
  await bob.waitForURL(/join/);
  await bob.getByRole("button", { name: /Join as Bob/ }).click();
  await bob.waitForURL(/chambers\/chm_/);
  await bob.getByPlaceholder(/Say what you think/).fill(
    "My budget is 500 euros max because I'm saving for a deposit. I want somewhere new to explore, not a beach week.",
  );
  await bob.getByRole("button", { name: "Endorse & submit" }).click();
  await bob.getByText("In your own words").waitFor();
  await shot(bob, "02-bob-intake-mobile");

  // --- Alice: Delegate draft, edit, endorse
  await alice.getByRole("button", { name: /Draft with my Delegate/ }).click();
  await alice.getByText("Draft", { exact: true }).waitFor();
  await shot(alice, "03-alice-delegate-draft");
  const box = alice.getByPlaceholder(/Say what you think/);
  await box.fill((await box.inputValue()) + " I want to rest because work has been exhausting, so a slow city break suits me.");
  await alice.getByRole("button", { name: "Endorse & submit" }).click();
  await alice.getByRole("button", { name: "Ask the Mediator to read" }).click();

  // --- Restatement gate
  await alice.getByRole("heading", { name: "Is this what you mean?" }).waitFor({ timeout: 20000 });
  await alice.getByText("live", { exact: false }).first().waitFor({ timeout: 10000 });
  await shot(alice, "04-restatement-gate");
  await bob.reload();
  await bob.getByRole("button", { name: "Not quite" }).click();
  await bob.getByPlaceholder(/What did it get wrong/).fill("The budget is the main thing, not the novelty");
  await bob.getByRole("button", { name: "Ask the Mediator to revise" }).click();
  await bob.getByText("Version 2").waitFor({ timeout: 20000 });
  await bob.getByRole("button", { name: "Yes, that’s me" }).click();
  await alice.getByRole("button", { name: "Yes, that’s me" }).click();

  // --- Understanding Map
  await alice.getByText("Where each person stands").waitFor({ timeout: 20000 });
  await shot(alice, "05-understanding-map");
  await alice.getByRole("button", { name: "Explore options" }).click();
  await alice.getByText("What you’re agreeing to").waitFor({ timeout: 20000 });
  await alice.getByPlaceholder(/Propose an item/).fill("Porto, 4 nights, max €500 each, one slow day in the middle");
  await alice.getByRole("button", { name: "Propose item" }).click();
  await alice.getByRole("button", { name: "Approve" }).click();
  // Bob's open page receives Alice's proposed item live, with no reload
  await bob.getByRole("button", { name: "Approve" }).click({ timeout: 10000 });
  await bob.getByText("Agreed, and approved by everyone.").waitFor({ timeout: 10000 });
  await shot(bob, "06-agreed-mobile");

  // --- Publish with consent from both
  await alice.reload();
  await alice.getByRole("button", { name: "I consent to publishing this Map" }).click();
  await bob.getByRole("button", { name: "I consent to publishing this Map" }).click();
  await bob.getByText("Published:").waitFor({ timeout: 10000 });
  const href = await bob.locator('a[href^="/m/"]').first().getAttribute("href");
  const pub = await (await browser.newContext()).newPage();
  await pub.goto(`${BASE}${href}`);
  await pub.getByText("Where each person stands").waitFor();
  const body = await pub.content();
  if (body.includes("Alice") || body.includes("Bob")) throw new Error("Public map leaked a real name");
  await shot(pub, "07-public-map-anonymized");

  // --- Spar
  await alice.goto(`${BASE}/spar`);
  await alice.getByPlaceholder(/Remote work/).fill("Cities should ban cars from their centres because it makes streets safer.");
  await alice.getByRole("button", { name: "Start sparring" }).click();
  await alice.waitForURL(/spar\/spr_/);
  await alice.getByPlaceholder(/Defend, refine/).fill("Fair point, but the safety data from Oslo and Pontevedra is strong.");
  await alice.getByRole("button", { name: "Respond" }).click();
  await alice.getByRole("button", { name: /Finish/ }).click();
  await alice.getByText("Robustness report").waitFor();
  await shot(alice, "08-spar-report");

  // --- After closing, Alice's Delegate suggests what it learned; nothing is kept until she says so
  await alice.goto(`${BASE}/me`);
  await alice.getByText(/Learned \d+ thing/).waitFor({ timeout: 15000 });
  await shot(alice, "09a-learned-review");
  await alice.getByRole("button", { name: "Keep", exact: true }).first().click();

  // --- Memory Inspector shows the Chamber-scoped position
  await alice.goto(`${BASE}/me`);
  await alice.getByText("Chamber · Spring trip").waitFor();
  await shot(alice, "09-memory-inspector");

  console.log("E2E OK. Screenshots in", SHOTS);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
