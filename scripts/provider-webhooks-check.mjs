#!/usr/bin/env node
// Dev tool (not a test): creates throw-away payOS and Casso connections in the LOCAL database and posts correctly signed webhooks.
// Run: node scripts/with-secrets.mjs node scripts/provider-webhooks-check.mjs
import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) { console.error("local only"); process.exit(1); }
const base = process.env.BASE_URL || "http://localhost:3100";
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const encrypt = (plain) => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(process.env.CHANNEL_TOKEN_KEY, "base64"), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
};
const { data: ws } = await admin.from("workspaces").select("id").limit(1).single();
const make = async (provider, creds) => {
  const { data } = await admin.from("connections").insert({ workspace_id: ws.id, provider, name: `check ${provider}`, status: "pending", environment: "live" }).select("id").single();
  await admin.from("connection_secrets").insert({ connection_id: data.id, ciphertext: encrypt(JSON.stringify(creds)), webhook_secret: randomBytes(8).toString("hex") });
  return data.id;
};
const post = async (path, body, headers = {}) => { const r = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }); return `${r.status} ${await r.text()}`; };

// payOS
const checksumKey = randomBytes(16).toString("hex");
const pid = await make("payos", { clientId: "client-check", apiKey: "api-check-key", checksumKey });
const data = { orderCode: 4242, amount: 2000, description: "NIVO payos check", accountNumber: "0123", reference: `REF${Date.now()}`, transactionDateTime: "2026-10-03 10:00:00", currency: "VND", paymentLinkId: "pl1", code: "00", desc: "success", counterAccountBankId: null };
const sig = createHmac("sha256", checksumKey).update(Object.keys(data).sort().map((k) => `${k}=${data[k] ?? ""}`).join("&")).digest("hex");
console.log("payos good ->", await post(`/api/connections/payos/${pid}`, { code: "00", desc: "success", success: true, data, signature: sig }));
console.log("payos repeat ->", await post(`/api/connections/payos/${pid}`, { code: "00", desc: "success", success: true, data, signature: sig }));
console.log("payos bad sig ->", await post(`/api/connections/payos/${pid}`, { code: "00", success: true, data, signature: "00" }));
console.log("payos sample ->", await post(`/api/connections/payos/${pid}`, { code: "00", success: true, data: { orderCode: 123, amount: 3000 }, signature: "x" }));
// Casso webhook V2
const key = randomBytes(24).toString("hex");
const cid = await make("casso", { secureKey: key });
const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, typeof o[k] === "object" && o[k] !== null ? sortKeys(o[k]) : o[k]]));
const body = { error: 0, data: { id: Date.now(), reference: "FT1", description: "casso check", amount: 2000, runningBalance: 1, transactionDateTime: "2026-10-03 10:00:00", accountNumber: "0123", bankName: "MBBank", bankAbbreviation: "MBB", virtualAccountNumber: "", virtualAccountName: "", counterAccountName: "", counterAccountNumber: "", counterAccountBankId: "", counterAccountBankName: "" } };
const t = String(Date.now());
const v1 = createHmac("sha512", key).update(`${t}.${JSON.stringify(sortKeys(body))}`).digest("hex");
console.log("casso good ->", await post(`/api/connections/casso/${cid}`, body, { "x-casso-signature": `t=${t},v1=${v1}` }));
console.log("casso repeat ->", await post(`/api/connections/casso/${cid}`, body, { "x-casso-signature": `t=${t},v1=${v1}` }));
console.log("casso bad sig ->", await post(`/api/connections/casso/${cid}`, body, { "x-casso-signature": `t=${t},v1=${"0".repeat(128)}` }));
console.log("casso legacy token ->", await post(`/api/connections/casso/${cid}`, { error: 0, data: [{ id: 1, description: "v1", amount: 5000 }] }, { "secure-token": key }));
const { data: rows } = await admin.from("connections").select("provider, status, first_event").in("id", [pid, cid]);
console.log(JSON.stringify(rows));
await admin.from("connections").delete().in("id", [pid, cid]);
