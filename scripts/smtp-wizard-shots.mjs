#!/usr/bin/env node
// Dev tool: screenshots every provider guide of the "Email gửi đi" wizard at 1440 and 390 wide.
// Run: node scripts/with-secrets.mjs node scripts/smtp-wizard-shots.mjs <outDir>   (needs a local dev server and the local ready owner account)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL || "http://localhost:3100";
const browser = await chromium.launch();
const choices = [
  ["google-workspace-app-password", "Google Workspace", null],
  ["google-workspace-relay", "Google Workspace", /Dịch vụ chuyển tiếp SMTP của Google/],
  ["gmail", "Gmail cá nhân", null],
  ["microsoft365", "Microsoft 365", null],
  ["zoho-custom-domain", "Zoho Mail", null],
  ["zoho-personal", "Zoho Mail", /@zohomail\.com/],
  ["vn-hosting", "Email hosting Việt Nam", null],
  ["relay-resend", "Dịch vụ gửi mail", null],
  ["relay-sendgrid", "Dịch vụ gửi mail", /SendGrid/],
  ["relay-ses", "Dịch vụ gửi mail", /Amazon SES/],
];
for (const width of [1440, 390]) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  await page.goto(`${base}/login`);
  await page.locator("nextjs-portal").evaluateAll((els) => els.forEach((e) => e.remove())).catch(() => {});
  await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.READY_OWNER_EMAIL);
  await page.locator('input[type="password"]').first().fill(process.env.READY_OWNER_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  const region = () => page.getByRole("region", { name: /Thêm kết nối/ });
  const shot = async (n) => { await page.waitForTimeout(350); await region().screenshot({ path: join(out, `${width}-${n}.png`) }); };
  for (const [name, provider, mode] of choices) {
    await page.goto(`${base}/connections`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Email gửi đi" }).first().scrollIntoViewIfNeeded();
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Email gửi đi", level: 2 }) }).first();
    await card.getByRole("button", { name: "Thêm kết nối" }).click();
    await region().getByText(provider, { exact: false }).first().click();
    if (mode) await region().getByText(mode).first().click();
    if (name === "google-workspace-app-password") await shot("1-provider");
    await region().getByRole("button", { name: "Tiếp tục" }).click();
    await shot(`2-guide-${name}`);
    await region().getByRole("button", { name: "Tiếp tục" }).click();
    await shot(`3-details-${name}`);
  }
  await page.close();
}
await browser.close();
console.log("done", out);
