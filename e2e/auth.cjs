// E2E: magic-link sign-in, passkey registration + sign-in (virtual authenticator), sign-out, and the
// moderation queue (dev@demo.local is a moderator via ADMIN_EMAILS). Run: node e2e/auth.cjs (servers up)
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  // A virtual platform authenticator, so passkeys work headlessly
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });

  // ---- Magic link
  const email = `kim-${run}@e2e.local`;
  await page.goto(`${BASE}/login`);
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: /Your name/ }).fill("Kim");
  await page.getByLabel("I am 18 or older.").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByText("Check your email").waitFor();
  await page.screenshot({ path: path.join(SHOTS, "27-check-email.png") });
  await page.getByRole("link", { name: "Open sign-in link" }).click();
  await page.waitForURL(/onboarding/);
  if (page.url().includes("token=")) throw new Error("Token left in the address bar");
  await page.getByRole("button", { name: /Skip for now/ }).click();

  // ---- Add a passkey, sign out, sign back in with it
  await page.goto(`${BASE}/me`);
  await page.getByText("verified", { exact: true }).waitFor();
  await page.getByLabel("Passkey name").fill("Test laptop");
  await page.getByRole("button", { name: "Add a passkey" }).click();
  await page.getByText("🔑 Test laptop").waitFor();
  await page.screenshot({ path: path.join(SHOTS, "28-passkeys.png"), fullPage: true });
  await page.getByRole("button", { name: "Switch / sign out" }).click();
  await page.waitForURL(/login/);
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  const me = await page.evaluate(async () => (await fetch("/api/v1/me", { headers: { Authorization: `Bearer ${localStorage.getItem("argumente.token")}` } })).json());
  if (me.email !== email) throw new Error("Passkey signed in as the wrong person");

  // ---- Moderation: three reports auto-hide a statement; the moderator restores it in the UI
  const host = await call("/auth/login", null, { email: `host-${run}@e2e.local`, name: "Host", is_adult: true });
  const { slug } = await call("/topics", host.token, { question: `Moderation test topic ${run}?`, seed_statements: ["A statement someone will report", "A second statement"] });
  const st = (await call(`/topics/${slug}`)).statements[0];
  for (let i = 0; i < 3; i++) {
    const r = await call("/auth/login", null, { email: `rep${i}-${run}@e2e.local`, name: `R${i}`, is_adult: true });
    await call("/reports", r.token, { target_type: "statement", target_id: st.id, reason: "looks like spam" });
  }
  if ((await call(`/topics/${slug}`)).statements.some((s) => s.id === st.id)) throw new Error("Statement not auto-hidden");
  const mod = await call("/auth/login", null, { email: "dev@demo.local", name: "Dev", is_adult: true });
  if (!mod.user.is_admin) throw new Error("dev@demo.local is not a moderator; start the API with ADMIN_EMAILS=dev@demo.local");
  await page.evaluate((t) => localStorage.setItem("argumente.token", t), mod.token);
  await page.goto(`${BASE}/admin`);
  await page.getByText(`Moderation test topic ${run}?`).first().waitFor({ timeout: 60000 }).catch(async (e) => {
    await page.screenshot({ path: path.join(SHOTS, "debug-admin.png"), fullPage: true });
    console.log(await page.locator("main").innerText());
    throw e;
  });
  await page.screenshot({ path: path.join(SHOTS, "29-moderation.png") });
  const card = page.locator("div", { hasText: `Moderation test topic ${run}?` }).filter({ has: page.getByRole("button", { name: "Restore statement" }) }).last();
  await card.getByLabel("Note for the audit log").fill("Not spam");
  // Wait for the server to confirm the action (the note text is already on screen in the textarea).
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/resolve") && r.request().method() === "POST" && r.ok()),
    card.getByRole("button", { name: "Restore statement" }).click(),
  ]);
  if (!(await call(`/topics/${slug}`)).statements.some((s) => s.id === st.id)) throw new Error("Statement not restored");

  console.log("Auth & moderation E2E OK");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
