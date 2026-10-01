#!/usr/bin/env node
// Dev tool (not a test): POSTs a realistic SePay webhook payload to the local app.
// Usage: node scripts/sepay-simulate.mjs <order_code> [amount] [--id=<sepay id>] [--url=<webhook url>] [--key=<api key>] [--out]
//   --out sends transferType "out" (should be ignored). Reusing --id repeats a delivery (idempotency check).
// The API key comes from SEPAY_WEBHOOK_API_KEY in ~/.nivo-lite/secrets.env (or $NIVO_SECRETS).
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const [code, amountArg] = args.filter((a) => !a.startsWith("--"));
if (!code) {
  console.error("usage: node scripts/sepay-simulate.mjs <order_code> [amount] [--id=N] [--url=...] [--key=...] [--out]");
  process.exit(1);
}

const file = process.env.NIVO_SECRETS || join(homedir(), ".nivo-lite", "secrets.env");
const env = {};
if (existsSync(file)) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const key = flags.key || env.SEPAY_WEBHOOK_API_KEY;
const url = flags.url || "http://localhost:3100/api/sepay/webhook";
if (!key) {
  console.error("SEPAY_WEBHOOK_API_KEY is missing from " + file);
  process.exit(1);
}

const amount = Number(amountArg ?? 0);
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
const payload = {
  id: Number(flags.id ?? Date.now()),
  gateway: env.SEPAY_BANK_CODE || "MBBank",
  transactionDate: stamp,
  accountNumber: env.SEPAY_BANK_ACCOUNT || "0000000000",
  subAccount: null,
  code: null,
  content: `${code} chuyen tien`,
  transferType: flags.out ? "out" : "in",
  description: `BankAPINotify ${code} chuyen tien`,
  transferAmount: amount,
  referenceCode: `FT${Date.now()}`,
  accumulated: 0,
};

const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Apikey ${key}` }, body: JSON.stringify(payload) });
console.log(`${res.status} ${await res.text()}`);
console.log(`sent id=${payload.id} content="${payload.content}" amount=${amount}`);
process.exit(res.ok ? 0 : 1);
