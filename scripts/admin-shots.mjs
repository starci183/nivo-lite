// Logs in as READY_OWNER_EMAIL and screenshots the /admin pages. Run: node scripts/with-secrets.mjs node scripts/admin-shots.mjs <baseUrl> <outDir>
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const base = (process.argv[2] ?? "http://localhost:3190").replace(/\/$/, "");
const out = process.argv[3] ?? `${process.env.TEMP}/admin-shots`;
mkdirSync(out, { recursive: true });
const email = process.env.READY_OWNER_EMAIL;
const password = process.env.READY_OWNER_PASSWORD;
if (!email || !password) throw new Error("READY_OWNER_EMAIL / READY_OWNER_PASSWORD missing");

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const shot = async (name, full = true) => { await page.screenshot({ path: `${out}/${name}.png`, fullPage: full }); console.log("shot", name, page.url()); };

await page.goto(`${base}/login`);
await page.fill("#login-email", email);
await page.fill("#login-password", password);
await page.click("button[type=submit]");
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });

await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
await shot("1-workspaces");
await page.goto(`${base}/admin?f=attention`, { waitUntil: "networkidle" });
await shot("2-workspaces-attention");

await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
const first = page.locator("tbody a").first();
if (await first.count()) {
  await first.click();
  await page.waitForURL(/\/admin\/[0-9a-f-]{36}/);
  await page.waitForLoadState("networkidle");
  await shot("3-workspace-detail");
  await page.getByRole("button", { name: "Extend", exact: true }).click();
  await shot("4-confirm-extend", false);
}
await page.goto(`${base}/admin/health`, { waitUntil: "networkidle" });
await shot("5-health");
await browser.close();
