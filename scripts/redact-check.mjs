// Self-check for the error redaction (src/lib/redact.ts). Run: node scripts/redact-check.mjs   (no secrets needed; exits 1 on any leak)
import { redactString, redactValue, safeRequestFacts, REDACTED } from "../src/lib/redact.ts";

const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const bot = "123456789:AAH3k9s8d7f6g5h4j3k2l1m0n9b8v7c6x5z";
const hex = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
const b64 = "dGhpcy1pcy1hLXZlcnktbG9uZy1iYXNlNjQtc2VjcmV0LXZhbHVlLTEyMzQ1Ng";
const secrets = [jwt, bot, hex, b64, "s3cr3t-webhook-value", "hunter2hunter2", "sbp_abcdef0123456789abcdef0123456789abcd"];

const leaks = [];
const check = (name, value) => {
  const text = JSON.stringify(value);
  for (const s of secrets) if (text.includes(s)) leaks.push(`${name}: leaked ${s.slice(0, 12)}...`);
};

// strings: messages and stacks
check("jwt in message", redactString(`request failed with ${jwt}`));
check("bot token in url", redactString(`fetch https://api.telegram.org/bot${bot}/sendMessage failed`));
check("bearer", redactString(`401 Authorization: Bearer ${jwt}`));
check("apikey scheme", redactString(`Apikey ${hex} rejected`));
check("name=value in url", redactString("GET /hook?token=s3cr3t-webhook-value&x=1"));
check("json credential", redactString('{"password":"hunter2hunter2","ok":true}'));
check("long hex", redactString(`signature mismatch ${hex}`));
check("long base64", redactString(`key ${b64} not accepted`));
check("stack", redactString(`Error: boom\n    at handler (file.ts:1:1)\n    at fetch (https://x.test/?api_key=${hex})`));

// nested ctx at any depth, headers, arrays
check("nested ctx", redactValue({
  route: "/api/telegram/abc",
  headers: { "x-telegram-bot-api-secret-token": "s3cr3t-webhook-value", authorization: `Bearer ${jwt}`, cookie: "sb=hunter2hunter2" },
  deep: { a: { b: { c: { botToken: bot, note: `see ${jwt}`, list: [{ apiKey: hex }, `plain ${b64}`] } } } },
  service_role: jwt,
}));

// raw bodies are never stored: only size + chosen safe fields
const facts = safeRequestFacts(JSON.stringify({ message: { text: "hello", from: { id: 1 } }, token: bot }), { updateId: 42, secret: "s3cr3t-webhook-value" });
check("request facts", facts);
if (facts.bodyBytes < 10 || "body" in facts) leaks.push("request facts: must carry the size and no body");

// things that must survive
const keep = redactString("src/lib/telegram-inbound.ts:93 handleTelegramUpdate failed for connection 9228425a-a798-4755-b732-d92332f930b9");
if (!keep.includes("telegram-inbound.ts:93") || !keep.includes("9228425a-a798-4755-b732-d92332f930b9")) leaks.push(`over-redaction: ${keep}`);
const kept = redactValue({ route: "/api/sepay/webhook", status: 500, nested: { ok: true } });
if (kept.route !== "/api/sepay/webhook" || kept.status !== 500) leaks.push("over-redaction: plain ctx changed");
if (redactValue({ token: "x" }).token !== REDACTED) leaks.push("secret key not redacted");

if (leaks.length) {
  console.error(`FAIL\n${leaks.join("\n")}`);
  process.exit(1);
}
console.log("redaction ok: 9 string cases, nested ctx, headers, request facts, over-redaction guards");
