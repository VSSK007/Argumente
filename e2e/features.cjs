// E2E: tabs (Map / Argument graph / Timeline), private ranking, Decision Replay, Rehearsal Room.
// Run: node e2e/features.cjs (servers up)
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
async function shot(page, name, full = true) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full });
}
async function asUser(browser, token, viewport = { width: 1280, height: 900 }) {
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.goto(`${BASE}/login`);
  await page.evaluate((t) => localStorage.setItem("argumente.token", t), token);
  return page;
}

(async () => {
  const a = await call("/auth/login", null, { email: `lena-${run}@e2e.local`, name: "Lena", is_adult: true });
  const p = await call("/auth/login", null, { email: `paul-${run}@e2e.local`, name: "Paul", is_adult: true });
  const ch = await call("/chambers", a.token, { template: "decision", title: "Savings", question: "Should we spend our savings on a big trip or keep them?" });
  await call(`/invites/${ch.invite_token}/accept`, p.token, {});
  await call(`/chambers/${ch.id}/intake`, a.token, { endorse: true, text: "We should take the trip because we've been saying next year for five years. It feels like we never put ourselves first." });
  await call(`/chambers/${ch.id}/intake`, p.token, { endorse: true, text: "Our emergency fund is only two months of expenses. I'd feel anxious spending it, because a job loss would hit us hard." });
  await call(`/chambers/${ch.id}/advance`, a.token, { action: "analyze" });
  await sleep(1200);
  for (const u of [a, p]) {
    const v = await call(`/chambers/${ch.id}`, u.token);
    await call(`/restatements/${v.restatements.find((r) => r.is_mine).id}/accept`, u.token, {});
  }
  await sleep(1200);

  const browser = await chromium.launch();
  const page = await asUser(browser, a.token);
  await page.goto(`${BASE}/chambers/${ch.id}`);
  await page.getByText("The Understanding Map is ready").waitFor({ timeout: 15000 });
  await shot(page, "15-now-banner", false);

  // Tabs
  await page.getByRole("tab", { name: "Argument graph" }).click();
  await page.locator("svg[role=img]").waitFor();
  await shot(page, "16-argument-graph");
  await page.getByRole("tab", { name: "Timeline" }).click();
  await page.getByText("Restatement gate", { exact: true }).waitFor();
  await shot(page, "17-timeline");
  await page.getByRole("tab", { name: "Now" }).click();

  // Private ranking
  await page.getByRole("button", { name: "Explore options", exact: true }).click();
  await page.getByText("Rank the Mediator’s options").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /Move .* down/ }).first().click();
  await page.getByRole("button", { name: "Submit my ranking" }).click();
  await page.getByText("Waiting for: Paul").waitFor();
  const v = await call(`/chambers/${ch.id}`, p.token);
  if (v.ranking.mine !== null || JSON.stringify(v).includes('"mine":[')) throw new Error("Lena's ranking leaked to Paul");
  await call(`/chambers/${ch.id}/ranking`, p.token, { order: v.options.map((_, i) => i) });
  await page.getByText("How the options landed").waitFor({ timeout: 5000 }); // arrives live
  await shot(page, "18-ranking-results");
  await page.getByRole("button", { name: "Propose as an agreement item" }).first().click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  const v2 = await call(`/chambers/${ch.id}`, p.token);
  await call(`/agreement-items/${v2.agreement.items[0].id}/decide`, p.token, { decision: "approve" });
  await page.getByText("Agreed, and approved by everyone.").waitFor({ timeout: 5000 });

  // Decision Replay: seal, revisit, see both
  await page.getByLabel("Your prediction").fill("We'll go, and we'll rebuild the fund within a year.");
  await page.getByRole("button", { name: "Seal my prediction" }).click();
  await page.getByText(/Your sealed prediction/).waitFor();
  await call(`/chambers/${ch.id}/prediction`, p.token, { text: "We'll dip into the fund before summer.", confidence: 75 });
  await page.getByRole("button", { name: "Revisit this with the same people" }).click();
  await page.getByText("Decision Replay: what you each expected").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Partly", exact: true }).click();
  await page.getByText("≈ partly right").waitFor({ timeout: 5000 });
  await shot(page, "19-decision-replay", false);

  // Rehearsal Room
  const handle = (await call("/delegates", p.token, {
    name: "Paul's Delegate",
    methodology: "pragmatist",
    answers: [{ statement: "An emergency fund should cover six months of expenses", stance: "agree", topic: "money", scope_type: "PUBLIC" }],
  })).handle;
  await call("/delegates/me", p.token, { allow_rehearsal: true }, "PATCH");
  await page.goto(`${BASE}/d/${handle}`);
  await page.getByPlaceholder("What do you want to talk to them about?").fill("Should we spend part of our savings on a trip?");
  await page.getByRole("button", { name: "Start rehearsing" }).click();
  await page.waitForURL(/spar\/spr_/);
  await page.getByPlaceholder("Say what you’d say to them.").fill("Two months of savings is enough if we budget carefully, and the trip matters for us.");
  await page.getByRole("button", { name: "Respond" }).click();
  await page.getByText(/Delegate of Paul/).first().waitFor();
  await page.getByRole("button", { name: /Finish/ }).click();
  await page.getByText("Robustness report").waitFor();
  await shot(page, "20-rehearsal");

  console.log("Features E2E OK");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
