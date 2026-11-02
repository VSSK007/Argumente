// Quality gate: accessibility (axe, WCAG 2.2 AA) on every page, visual regression of /design,
// and a JavaScript budget (production builds only: PERF_BUDGET=1).
// Run: node e2e/quality.cjs   ·   refresh visual baselines: UPDATE_BASELINES=1 node e2e/quality.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const API = `${BASE}/api/v1`;
const BASELINES = path.join(__dirname, "baselines");
const SHOTS = path.join(__dirname, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });
const run = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const AXE = require.resolve("axe-core/axe.min.js");
const HIDE_DEV = "nextjs-portal{display:none!important}";

async function call(p, token, body, method) {
  const r = await fetch(API + p, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function axeAudit(page, label) {
  await page.addScriptTag({ path: AXE });
  const res = await page.evaluate(async () =>
    // eslint-disable-next-line no-undef
    axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }),
  );
  const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const minor = res.violations.filter((v) => !bad.includes(v));
  for (const v of minor) console.log(`  ~ ${label}: ${v.id} (${v.impact}) ×${v.nodes.length}`);
  return bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.help}\n      e.g. ${v.nodes[0]?.target?.join(" ")}`);
}

async function visual(page, name) {
  if (process.platform !== "linux") return console.log(`  (visual check ${name} skipped: baselines are Linux renders)`);
  const actualBuf = await page.screenshot({ fullPage: true, animations: "disabled" });
  const file = path.join(BASELINES, `${name}.png`);
  fs.writeFileSync(path.join(SHOTS, `visual-${name}.png`), actualBuf);
  if (!fs.existsSync(file) || process.env.UPDATE_BASELINES === "1") {
    fs.writeFileSync(file, actualBuf);
    return console.log(`  baseline written: ${name}`);
  }
  const { default: pixelmatch } = await import("pixelmatch");
  const a = PNG.sync.read(fs.readFileSync(file));
  const b = PNG.sync.read(actualBuf);
  if (a.width !== b.width || a.height !== b.height) return `${name}: size changed ${a.width}x${a.height} → ${b.width}x${b.height}`;
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  const ratio = n / (a.width * a.height);
  if (ratio > 0.002) {
    fs.writeFileSync(path.join(SHOTS, `visual-${name}-diff.png`), PNG.sync.write(diff));
    return `${name}: ${(ratio * 100).toFixed(2)}% of pixels differ (see e2e/screenshots/visual-${name}-diff.png; UPDATE_BASELINES=1 if intended)`;
  }
  console.log(`  visual ${name}: ${(ratio * 100).toFixed(3)}% diff, ok`);
}

(async () => {
  // ---- data
  const a = await call("/auth/login", null, { email: `qa-${run}@e2e.local`, name: "Quinn", is_adult: true });
  const b = await call("/auth/login", null, { email: `qb-${run}@e2e.local`, name: "Robin", is_adult: true });
  const d = await call("/delegates", a.token, {
    name: "Quinn's Delegate",
    methodology: "socratic",
    answers: [{ statement: "Plans made in advance should only change if everyone agrees", stance: "agree", topic: "time", scope_type: "PUBLIC" }],
  });
  const ch = await call("/chambers", a.token, { template: "household", title: "Guests", question: "How often can partners stay over in the flat?" });
  await call(`/invites/${ch.invite_token}/accept`, b.token, {});
  await call(`/chambers/${ch.id}/intake`, a.token, { endorse: true, text: "Partners staying three nights a week is basically an extra flatmate who doesn't pay rent." });
  await call(`/chambers/${ch.id}/intake`, b.token, { endorse: true, text: "It feels controlling to put a number on it. I respect the space and clean up after us." });
  await call(`/chambers/${ch.id}/advance`, a.token, { action: "analyze" });
  await sleep(1200);
  for (const u of [a, b]) {
    const v = await call(`/chambers/${ch.id}`, u.token);
    await call(`/restatements/${v.restatements.find((r) => r.is_mine).id}/accept`, u.token, {});
  }
  await sleep(1200);
  for (const u of [a, b]) await call(`/chambers/${ch.id}/publish/consent`, u.token, { consent: true });
  const slug = (await call(`/chambers/${ch.id}`, a.token)).publication.slug;

  const browser = await chromium.launch();
  const failures = [];
  const ctx = async (token, viewport = { width: 1280, height: 900 }) => {
    const c = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const p = await c.newPage();
    await p.goto(`${BASE}/login`);
    if (token) await p.evaluate((t) => localStorage.setItem("argumente.token", t), token);
    else await p.evaluate(() => localStorage.clear());
    return p;
  };

  // ---- accessibility
  console.log("Accessibility (WCAG 2.2 AA, serious/critical fail):");
  const anon = await ctx(null);
  for (const [label, url, wait] of [
    ["landing", "/", "Watch the 60-second demo"],
    ["login", "/login", "Email me a sign-in link"],
    ["verify", "/auth/verify", "That link didn"],
    ["public map", `/m/${slug}`, "Where each person stands"],
    ["commons", "/commons", "Commons"],
    ["topics", "/topics", "Where does everyone actually stand?"],
    ["design", "/design", "Argumenté components"],
  ]) {
    await anon.goto(BASE + url);
    await anon.getByText(wait).first().waitFor();
    failures.push(...(await axeAudit(anon, label)));
  }
  const topics = await call("/topics");
  if (topics.length) {
    await anon.goto(`${BASE}/topics/${topics[0].slug}`);
    await anon.getByText("How people group").waitFor();
    failures.push(...(await axeAudit(anon, "topic")));
  }
  const page = await ctx(a.token);
  for (const [label, url, wait] of [
    ["today", "/", "Hello, Quinn."],
    ["me", "/me", "Memory Inspector"],
    ["spar", "/spar", "Start sparring"],
    ["profile", `/d/${d.handle}`, "Delegate of Quinn"],
    ["new chamber", "/chambers/new", "Create Chamber"],
    ["chamber · now", `/chambers/${ch.id}`, "The Understanding Map is ready"],
  ]) {
    await page.goto(BASE + url);
    await page.getByText(wait).first().waitFor({ timeout: 15000 });
    failures.push(...(await axeAudit(page, label)));
  }
  for (const tab of ["Understanding Map", "Argument graph", "Timeline"]) {
    await page.getByRole("tab", { name: tab }).click();
    await sleep(300);
    failures.push(...(await axeAudit(page, `chamber · ${tab.toLowerCase()}`)));
  }
  const mod = await call("/auth/login", null, { email: "dev@demo.local", name: "Dev", is_adult: true });
  if (mod.user.is_admin) {
    const mp = await ctx(mod.token);
    await mp.goto(`${BASE}/admin`);
    await mp.getByRole("heading", { name: "Audit log" }).waitFor({ timeout: 30000 });
    failures.push(...(await axeAudit(mp, "moderation")));
  }
  const guest = await ctx(b.token);
  await guest.goto(`${BASE}/onboarding`);
  await guest.getByText("Who represents you?").waitFor();
  failures.push(...(await axeAudit(guest, "onboarding")));

  // ---- visual regression on the deterministic design gallery
  console.log("Visual regression (/design):");
  for (const [name, viewport] of [
    ["design-desktop", { width: 1280, height: 900 }],
    ["design-mobile", { width: 390, height: 844 }],
  ]) {
    const p = await ctx(null, viewport);
    await p.goto(`${BASE}/design`);
    await p.addStyleTag({ content: HIDE_DEV });
    await p.getByText("Argumenté components").waitFor();
    await p.evaluate(() => document.fonts.ready);
    const r = await visual(p, name);
    // VISUAL_SOFT=1 (CI): other machines may render fonts slightly differently, so warn instead of failing.
    if (r && process.env.VISUAL_SOFT === "1") console.log(`  ! ${r}`);
    else if (r) failures.push(r);
  }

  // ---- JS budget (meaningful only for production builds)
  if (process.env.PERF_BUDGET === "1") {
    console.log("JavaScript budget (production):");
    const p = await ctx(a.token);
    for (const url of ["/", `/chambers/${ch.id}`, `/m/${slug}`]) {
      await p.goto(BASE + url, { waitUntil: "networkidle" });
      const kb = await p.evaluate(() =>
        Math.round(performance.getEntriesByType("resource").filter((e) => e.initiatorType === "script" || e.name.endsWith(".js")).reduce((s, e) => s + (e.transferSize || e.encodedBodySize || 0), 0) / 1024),
      );
      const budget = 350;
      console.log(`  ${url}: ${kb} KB of JS (budget ${budget} KB)`);
      if (kb > budget) failures.push(`${url}: ${kb} KB of JavaScript exceeds the ${budget} KB budget`);
    }
  }

  await browser.close();
  if (failures.length) {
    console.error("\nQuality gate FAILED:\n  - " + failures.join("\n  - "));
    process.exit(1);
  }
  console.log("Quality gate OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
