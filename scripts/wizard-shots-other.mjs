#!/usr/bin/env node
// Dev tool: screenshots the payOS / Casso / Telegram wizard steps. Run through with-secrets: node scripts/wizard-shots-other.mjs <outDir>
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL || "http://localhost:3100";
const browser = await chromium.launch();
for (const width of [1440, 390]) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  await page.goto(`${base}/login`);
  await page.locator("nextjs-portal").evaluateAll((els) => els.forEach((e) => e.remove())).catch(() => {});
  await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.READY_OWNER_EMAIL);
  await page.locator('input[type="password"]').first().fill(process.env.READY_OWNER_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  const region = () => page.getByRole("region", { name: /Thêm kết nối/ });
  const shot = async (n) => { await page.waitForTimeout(400); await region().screenshot({ path: join(out, `${width}-${n}.png`) }); };
  const next = (label = "Tiếp tục") => region().getByRole("button", { name: label }).click();
  for (const [i, name] of [[1, "payos"], [2, "casso"], [3, "telegram"]]) {
    await page.goto(`${base}/connections`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Thêm kết nối" }).nth(i).click();
    await shot(`${name}-1`);
    await next();
    await shot(`${name}-2`);
    if (name === "telegram") continue;
    await region().getByLabel("Tên kết nối").fill("Kiểm tra");
    if (name === "casso") {
      await region().getByRole("button", { name: /Ngân hàng/ }).first().click();
      await page.getByRole("option", { name: /Vietcombank/ }).click();
      await region().getByLabel("Số tài khoản").fill("0011223344");
      await region().getByLabel("Chủ tài khoản").fill("NGUYEN VAN B");
    }
    await next();
    await region().getByText("Làm theo trên").first().waitFor();
    await shot(`${name}-3`);
  }
  await page.close();
}
await browser.close();
