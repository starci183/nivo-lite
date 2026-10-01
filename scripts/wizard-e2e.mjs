#!/usr/bin/env node
// Dev tool (not a test): drives the SePay connection wizard in the local app, screenshots every step, and sends the webhook.
// Run through with-secrets:  node scripts/with-secrets.mjs node scripts/wizard-e2e.mjs <outDir> <width> [env=test|live]
import { createDecipheriv } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [outDir, widthArg = "1440", envArg = "test"] = process.argv.slice(2);
const width = Number(widthArg);
const base = process.env.BASE_URL || "http://localhost:3100";
mkdirSync(outDir, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const decrypt = (stored) => {
  const buf = Buffer.from(stored, "base64");
  const d = createDecipheriv("aes-256-gcm", Buffer.from(process.env.CHANNEL_TOKEN_KEY, "base64"), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 } })).newPage();
const shot = async (name) => { await page.waitForTimeout(500); const w = page.getByRole("region", { name: /Thêm kết nối/ });
  await (await w.count() ? w : page).screenshot({ path: join(outDir, `${width}-${name}.png`) }); console.log("shot", name); };

await page.goto(`${base}/login`);
await page.locator("nextjs-portal").evaluateAll((els) => els.forEach((e) => e.remove())).catch(() => {});
await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.READY_OWNER_EMAIL);
await page.locator('input[type="password"]').first().fill(process.env.READY_OWNER_PASSWORD);
await page.locator('button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });

await page.goto(`${base}/connections`, { waitUntil: "networkidle" });
await shot("0-list");
await page.getByRole("button", { name: "Thêm kết nối" }).first().click();
await shot("1-env");
if (envArg === "live") await page.getByText("Chính thức", { exact: true }).first().click();
await page.getByRole("region", { name: /Thêm kết nối/ }).getByRole("button", { name: "Tiếp tục" }).click();
await page.getByLabel("Tên kết nối").fill(`Wizard ${envArg} ${Date.now() % 100000}`);
await page.getByRole("button", { name: /Ngân hàng/ }).first().click();
await page.getByRole("option", { name: /MB Bank/ }).click();
await page.getByLabel("Số tài khoản").fill("0123456789");
await page.getByLabel("Chủ tài khoản").fill("NGUYEN VAN A");
await shot("2-account");
await page.getByRole("region", { name: /Thêm kết nối/ }).getByRole("button", { name: "Tiếp tục" }).click();
await page.getByText("Làm theo trên SePay").first().waitFor();
await shot("3-follow");
await page.getByRole("button", { name: "Tôi đã làm xong" }).click();
await page.getByText("Đang chờ giao dịch đầu tiên").waitFor();
await shot("4-verify-waiting");

// The connection exists now; bind the accounting agent (as the last step would) and let SePay "send" a credit.
const { data: conns } = await admin.from("connections").select("id, workspace_id, status, environment").eq("provider", "sepay").order("created_at", { ascending: false }).limit(1);
const conn = conns[0];
console.log("connection", conn.id, conn.status, conn.environment);
const { data: agent } = await admin.from("agents").select("id").eq("workspace_id", conn.workspace_id).eq("module", "accounting").eq("status", "active").limit(1).single();
await admin.from("agent_connections").upsert({ agent_id: agent.id, connection_id: conn.id, workspace_id: conn.workspace_id, purpose: "bank_feed" });
const { data: sec } = await admin.from("connection_secrets").select("ciphertext").eq("connection_id", conn.id).single();
const apiKey = decrypt(sec.ciphertext);
const hit = (id, key = apiKey) => fetch(`${base}/api/connections/sepay/${conn.id}`, {
  method: "POST", headers: { "content-type": "application/json", authorization: `Apikey ${key}` },
  body: JSON.stringify({ id, gateway: "MBBank", transactionDate: "2026-10-03 10:00:00", accountNumber: "0123456789", transferType: "in", transferAmount: 2000, content: `NIVO TEST ${id}`, accumulated: 0 }),
}).then(async (r) => `${r.status} ${await r.text()}`);
console.log("bad key ->", await hit(1, "wrong"));
const eventId = 900000 + (Date.now() % 100000);
console.log("webhook ->", await hit(eventId));
console.log("repeat  ->", await hit(eventId));

await page.getByText("Đã nhận giao dịch").waitFor({ timeout: 15_000 });
await shot("5-verify-received");
await page.getByRole("region", { name: /Thêm kết nối/ }).getByRole("button", { name: "Tiếp tục" }).click();
await shot("6-agent");
await page.getByRole("button", { name: "Xong" }).click();
await page.waitForTimeout(1500);
await shot("7-list-after");

const { data: after } = await admin.from("connections").select("status, environment, first_event").eq("id", conn.id).single();
console.log("after", JSON.stringify(after));
const { data: ev } = await admin.from("inbound_events").select("origin, amount_vnd, channel, dedupe_key").eq("workspace_id", conn.workspace_id).like("dedupe_key", `%sepay:${eventId}%`);
console.log("inbound_events", JSON.stringify(ev));
await browser.close();
