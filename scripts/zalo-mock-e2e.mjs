#!/usr/bin/env node
// Dev tool (not a unit test): runs the whole Zalo OA connection against a FAKE Zalo (token, send, user detail) and a local app.
//   node scripts/with-secrets.mjs node scripts/zalo-mock-e2e.mjs [outDir]
// It starts the mock Zalo, starts the app (next dev) with ZALO_OAUTH_BASE / ZALO_API_BASE pointing at it, then:
//   1. drives the real wizard in a browser (app keys -> OA secret -> "Kết nối Zalo OA" OAuth with PKCE -> back in NIVO),
//   2. posts signed webhooks (bad signature, good, duplicate msg_id), sees "Đã nhận tin từ <tên>",
//   3. binds the chatbot agent and lets the customer pipeline answer through the fake send endpoint,
//   4. proves token refresh (lazy, single-use under concurrency, the protected cron route) and the 48h reply window.
// Needs the local Supabase, the secrets file (READY_OWNER_*), Playwright's chromium. Prints PASS/FAIL per check, exits 1 on any FAIL.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const outDir = process.argv[2] || join(process.cwd(), ".zalo-e2e");
mkdirSync(outDir, { recursive: true });
const APP_PORT = Number(process.env.E2E_PORT || 3190);
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT || 4590);
const BASE = `http://localhost:${APP_PORT}`;
const MOCK = `http://127.0.0.1:${MOCK_PORT}`;
const APP_ID = "7770001112223";
const APP_SECRET = "mock-app-secret-0123456789";
const OA_SECRET = "mock-oa-secret-abcdefghij";
const OA_ID = "9988776655";
const sha256 = (s, enc = "hex") => createHash("sha256").update(s).digest(enc);

/* ------------------------------------------------------------------ the fake Zalo */
const zalo = {
  codes: new Map(), validAccess: new Set(), refreshToken: null, n: 0,
  refreshGrants: 0, badRefresh: 0, codeGrants: 0, pkceFailures: 0, sends: [], lookups: 0, authFails: 0, expiresIn: 3600, refreshDelayMs: 0,
};
const mock = createServer(async (req, res) => {
  const url = new URL(req.url, MOCK);
  const body = await new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c).toString())); });
  const json = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (url.pathname === "/v4/oa/permission") {
    const redirect = url.searchParams.get("redirect_uri");
    const code = `code-${++zalo.n}`;
    zalo.codes.set(code, url.searchParams.get("code_challenge"));
    const back = new URL(redirect);
    back.searchParams.set("code", code); back.searchParams.set("oa_id", OA_ID); back.searchParams.set("state", url.searchParams.get("state"));
    res.writeHead(302, { location: back.toString() }); return res.end();
  }
  if (url.pathname === "/v4/oa/access_token") {
    const form = new URLSearchParams(body);
    if (req.headers.secret_key !== APP_SECRET || form.get("app_id") !== APP_ID) { zalo.authFails += 1; return json({ error: -14003, error_name: "Invalid secret_key" }); }
    const issue = () => {
      const at = `at-${++zalo.n}`; zalo.validAccess.add(at); zalo.refreshToken = `rt-${++zalo.n}`;
      return { access_token: at, refresh_token: zalo.refreshToken, expires_in: String(zalo.expiresIn) };
    };
    if (form.get("grant_type") === "authorization_code") {
      const challenge = zalo.codes.get(form.get("code"));
      if (!challenge || sha256(form.get("code_verifier") ?? "", "base64url") !== challenge) { zalo.pkceFailures += 1; return json({ error: -14014, error_name: "Invalid code" }); }
      zalo.codes.delete(form.get("code")); zalo.codeGrants += 1;
      return json(issue());
    }
    if (form.get("grant_type") === "refresh_token") {
      if (zalo.refreshDelayMs) await new Promise((r) => setTimeout(r, zalo.refreshDelayMs));
      if (form.get("refresh_token") !== zalo.refreshToken) { zalo.badRefresh += 1; return json({ error: -14014, error_name: "Invalid refresh token", error_description: "refresh token used or expired" }); }
      zalo.refreshGrants += 1;
      return json(issue());
    }
    return json({ error: -1 });
  }
  if (url.pathname === "/v3.0/oa/message/cs") {
    if (!zalo.validAccess.has(req.headers.access_token)) return json({ error: -216, message: "Access token is invalid" });
    const m = JSON.parse(body);
    zalo.sends.push({ to: m.recipient?.user_id, text: m.message?.text });
    return json({ error: 0, message: "Success", data: { message_id: `m-${zalo.sends.length}`, user_id: m.recipient?.user_id } });
  }
  if (url.pathname === "/v3.0/oa/user/detail") {
    if (!zalo.validAccess.has(req.headers.access_token)) return json({ error: -216, message: "Access token is invalid" });
    zalo.lookups += 1;
    const id = JSON.parse(url.searchParams.get("data")).user_id;
    return json({ error: 0, message: "Success", data: { user_id: id, display_name: `Khách Mock ${id.slice(-3)}` } });
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => mock.listen(MOCK_PORT, "127.0.0.1", r));

/* ------------------------------------------------------------------ helpers */
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 60_000, step = 700) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(step); } return null; };
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const key = Buffer.from(process.env.CHANNEL_TOKEN_KEY, "base64");
const decrypt = (stored) => { const b = Buffer.from(stored, "base64"); const d = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8"); };
const readSecret = async (id) => { const { data } = await admin.from("connection_secrets").select("ciphertext, token_expires_at, refresh_lock_until").eq("connection_id", id).single(); return { ...JSON.parse(decrypt(data.ciphertext)), expiresAt: data.token_expires_at, lock: data.refresh_lock_until }; };
const webhook = (id, event, { sign = true, signature } = {}) => {
  const raw = JSON.stringify(event);
  const mac = signature ?? `mac=${sha256(`${APP_ID}${raw}${event.timestamp}${OA_SECRET}`)}`;
  return fetch(`${BASE}/api/connections/zalo/${id}`, { method: "POST", headers: { "content-type": "application/json", ...(sign ? { "x-zevent-signature": mac } : {}) }, body: raw })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
};
let seq = 0;
const textEvent = (userId, text, msgId = `msg-${Date.now()}-${++seq}`) => ({
  app_id: APP_ID, user_id_by_app_id: `u-${userId}`, event_name: "user_send_text", timestamp: String(Date.now()),
  sender: { id: userId }, recipient: { id: OA_ID }, message: { msg_id: msgId, text },
});

/* ------------------------------------------------------------------ the app */
console.log(`starting the app on ${BASE} (next dev) with the fake Zalo at ${MOCK}`);
const app = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "dev", "-p", String(APP_PORT)], {
  env: { ...process.env, NEXT_PUBLIC_SITE_URL: BASE, ZALO_OAUTH_BASE: MOCK, ZALO_API_BASE: MOCK },
  stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32",
});
const appLog = [];
app.stdout.on("data", (d) => appLog.push(String(d)));
app.stderr.on("data", (d) => appLog.push(String(d)));
const stop = async () => {
  mock.close();
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(app.pid), "/T", "/F"]);
  else app.kill("SIGTERM");
};
let browser;
try {
  const up = await until(async () => fetch(`${BASE}/login`).then((r) => r.status < 500).catch(() => false), 120_000, 1500);
  if (!up) throw new Error("the app did not start");

  /* ---------------------------------------------- 1. the wizard in a browser */
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.READY_OWNER_EMAIL);
  await page.locator('input[type="password"]').first().fill(process.env.READY_OWNER_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90_000 });
  await page.goto(`${BASE}/connections`, { waitUntil: "networkidle" });
  const wiz = () => page.getByRole("region", { name: /Thêm kết nối/ });
  const shot = async (n) => { await page.waitForTimeout(400); await page.screenshot({ path: join(outDir, `zalo-${n}.png`), fullPage: true }); };
  await page.getByRole("button", { name: "Thêm kết nối" }).last().click();
  await wiz().getByLabel("Tên kết nối").fill(`Zalo mock ${Date.now() % 100000}`);
  await wiz().getByLabel("App ID").fill(APP_ID);
  await wiz().getByLabel("App secret").fill(APP_SECRET);
  await shot("1-app");
  await wiz().getByRole("button", { name: "Tiếp tục" }).click();
  await wiz().getByText("Official Account Callback URL").waitFor();
  const { data: created } = await admin.from("connections").select("id, workspace_id, status, public_meta").eq("provider", "zalo_oa").order("created_at", { ascending: false }).limit(1).single();
  const id = created.id;
  const ws = created.workspace_id;
  const shown = await wiz().innerText();
  check("wizard shows the callback and webhook URLs to copy", shown.includes(`${BASE}/api/connections/zalo/oauth/callback`) && shown.includes(`${BASE}/api/connections/zalo/${id}`));
  check("the connection starts pending with its keys stored encrypted", created.status === "pending" && (await readSecret(id)).appSecret === APP_SECRET);
  await shot("2-follow");
  const pre = await webhook(id, textEvent("5550001", "trước khi lưu OA secret"));
  check("a webhook before the OA Secret Key is saved is refused (fails closed)", pre.status === 401, `status ${pre.status}`);
  await wiz().getByLabel("OA Secret Key").fill(OA_SECRET);
  await wiz().getByRole("button", { name: "Lưu OA Secret Key" }).click();
  await wiz().getByRole("button", { name: "Kết nối Zalo OA" }).waitFor();
  await shot("3-authorize");
  await wiz().getByRole("button", { name: "Kết nối Zalo OA" }).click();
  await page.waitForURL((u) => u.pathname === "/connections" && u.searchParams.get("zalo") === "ok", { timeout: 60_000 });
  await page.getByText("Đang chờ tin nhắn đầu tiên").waitFor({ timeout: 30_000 });
  await shot("4-verify-waiting");
  const afterOauth = await readSecret(id);
  const { data: connAfter } = await admin.from("connections").select("public_meta").eq("id", id).single();
  check("OAuth with PKCE: code exchanged once, tokens stored encrypted", zalo.codeGrants === 1 && zalo.pkceFailures === 0 && afterOauth.accessToken?.startsWith("at-") && afterOauth.refreshToken === zalo.refreshToken);
  check("the OA id from the callback is kept", connAfter.public_meta.oa_id === OA_ID);
  check("access token expiry is stored (about 1 hour)", afterOauth.expiresAt && Math.abs(Date.parse(afterOauth.expiresAt) - Date.now() - 3_600_000) < 120_000, afterOauth.expiresAt);
  const replayState = await fetch(`${BASE}/api/connections/zalo/oauth/callback?code=code-x&state=${id}.deadbeef`, { redirect: "manual" });
  check("a callback with a wrong state (or no session) never connects", !(replayState.headers.get("location") ?? "").includes("zalo=ok"), replayState.headers.get("location") ?? "");

  /* ---------------------------------------------- 2. inbound: signature, name, dedupe */
  const bad = await webhook(id, textEvent("5550001", "giả mạo"), { signature: `mac=${"0".repeat(64)}` });
  const none = await webhook(id, textEvent("5550001", "không chữ ký"), { sign: false });
  check("bad and missing signatures are refused", bad.status === 401 && none.status === 401, `${bad.status}/${none.status}`);
  const first = textEvent("5550001", "Chào shop, bên mình có áo size M không?", "msg-first-1");
  const r1 = await webhook(id, first);
  check("a signed user_send_text is accepted (no chatbot bound yet: stored, not answered)", r1.status === 200 && r1.body.reason === "no_agent", JSON.stringify(r1.body));
  await page.getByText("Đã nhận tin từ Khách Mock 001").waitFor({ timeout: 20_000 }).then(() => check("the wizard says \"Đã nhận tin từ <tên>\"", true), () => check("the wizard says \"Đã nhận tin từ <tên>\"", false));
  await shot("5-verify-received");
  const { data: c1 } = await admin.from("connections").select("status, first_event").eq("id", id).single();
  check("the connection became connected with the first event", c1.status === "connected" && c1.first_event?.content === "Khách Mock 001", JSON.stringify(c1.first_event));

  // Bind the Chatbot agent through the wizard's last step.
  await wiz().getByRole("button", { name: "Tiếp tục" }).click();
  await shot("6-agent");
  await wiz().getByRole("button", { name: "Xong" }).click();
  await page.waitForTimeout(1500);
  const { data: bound } = await admin.from("agent_connections").select("agent_id, purpose").eq("connection_id", id);
  check("the Chatbot agent is bound to the connection", bound?.length === 1 && bound[0].purpose === "inbound_chat");

  /* ---------------------------------------------- 3. the chatbot answers through the gate */
  const sendsBefore = zalo.sends.length;
  const q = textEvent("5550002", "Chào shop, cho mình hỏi giờ mở cửa với ạ", "msg-q-1");
  const r2 = await webhook(id, q);
  check("a message for a bound connection runs the customer pipeline", r2.status === 200 && r2.body.handled === true, JSON.stringify(r2.body));
  const { data: conv } = await admin.from("agent_conversations").select("id, channel, connection_id, external_id, visitor_name").eq("workspace_id", ws).eq("connection_id", id).eq("external_id", "5550002").maybeSingle();
  check("the conversation is on channel zalo with connection_id set", conv?.channel === "zalo" && conv.connection_id === id && conv.visitor_name === "Khách Mock 002");
  const sent = await until(() => zalo.sends.length > sendsBefore, 20_000, 300);
  check("the reply left through Zalo (fake send endpoint)", Boolean(sent) && zalo.sends.at(-1).to === "5550002", zalo.sends.at(-1)?.text?.slice(0, 60));
  const dup = await webhook(id, q);
  const { count: userMsgs } = await admin.from("agent_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id).eq("role", "user");
  check("the same msg_id again is dropped (dedupe)", dup.body.reason === "duplicate" && userMsgs === 1, `${JSON.stringify(dup.body)} userMsgs=${userMsgs}`);
  const { data: lastAgent } = await admin.from("agent_messages").select("delivery_status").eq("conversation_id", conv.id).eq("role", "agent").order("created_at", { ascending: false }).limit(1);
  check("the delivered reply is marked sent", lastAgent?.[0]?.delivery_status === "sent", String(lastAgent?.[0]?.delivery_status));

  /* ---------------------------------------------- 4. token refresh */
  const setExpiry = (ms) => admin.from("connection_secrets").update({ token_expires_at: new Date(Date.now() + ms).toISOString() }).eq("connection_id", id);
  await setExpiry(-1000);
  const refreshBefore = zalo.refreshGrants;
  await webhook(id, textEvent("5550003", "ai đó đang xem?", "msg-lazy-1"));
  const lazy = await readSecret(id);
  check("lazy refresh on use: an expired token is refreshed, the new pair stored", zalo.refreshGrants === refreshBefore + 1 && lazy.refreshToken === zalo.refreshToken && Date.parse(lazy.expiresAt) > Date.now() + 3_000_000);

  await setExpiry(-1000);
  zalo.refreshDelayMs = 700;
  const grantsBefore = zalo.refreshGrants;
  const badBefore = zalo.badRefresh;
  const burst = await Promise.all(["5550011", "5550012", "5550013", "5550014", "5550015"].map((u) => webhook(id, textEvent(u, "đồng thời", `msg-burst-${u}`))));
  zalo.refreshDelayMs = 0;
  check("single-use refresh token under concurrency: exactly one refresh, none rejected", zalo.refreshGrants === grantsBefore + 1 && zalo.badRefresh === badBefore && burst.every((b) => b.status === 200), `grants +${zalo.refreshGrants - grantsBefore}, rejected +${zalo.badRefresh - badBefore}`);
  check("the refresh lease is released afterwards", (await readSecret(id)).lock === null);

  const cronSecret = sha256(`zalo-cron:${process.env.SUPABASE_SERVICE_ROLE_KEY}`);
  const noAuth = await fetch(`${BASE}/api/connections/zalo/refresh`, { method: "POST" });
  const wrongAuth = await fetch(`${BASE}/api/connections/zalo/refresh`, { method: "POST", headers: { authorization: "Bearer nope" } });
  check("the cron route refuses calls without the bearer", noAuth.status === 401 && wrongAuth.status === 401);
  await setExpiry(2 * 3_600_000);
  const cronBefore = zalo.refreshGrants;
  const cron = await fetch(`${BASE}/api/connections/zalo/refresh`, { method: "POST", headers: { authorization: `Bearer ${cronSecret}` } }).then((r) => r.json());
  check("the cron route refreshes a token that ends within 7 hours", cron.ok && zalo.refreshGrants === cronBefore + 1 && cron.refreshed >= 1, JSON.stringify(cron));
  await setExpiry(2 * 3_600_000);
  const stale = await readSecret(id);
  await admin.from("connection_secrets").update({ ciphertext: (() => { const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", key, iv); const body = Buffer.concat([c.update(JSON.stringify({ ...stale, expiresAt: undefined, lock: undefined, refreshToken: "rt-revoked" }), "utf8"), c.final()]); return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64"); })() }).eq("connection_id", id);
  const cronBad = await fetch(`${BASE}/api/connections/zalo/refresh`, { method: "POST", headers: { authorization: `Bearer ${cronSecret}` } }).then((r) => r.json());
  const { data: broken } = await admin.from("connections").select("status, last_error").eq("id", id).single();
  check("a revoked refresh token marks the connection as needing reconnect", cronBad.failed >= 1 && broken.status === "error" && /kết nối lại/i.test(broken.last_error ?? ""), `${broken.status}: ${broken.last_error}`);
  // Reconnect through OAuth again (the "Kết nối lại" path) and carry on.
  await page.goto(`${BASE}/connections?zalo=denied&id=${id}`, { waitUntil: "networkidle" });
  await wiz().getByRole("button", { name: /Kết nối Zalo OA|Kết nối lại/ }).first().click();
  await page.waitForURL((u) => u.searchParams.get("zalo") === "ok", { timeout: 60_000 });
  const { data: healed } = await admin.from("connections").select("status, last_error").eq("id", id).single();
  check("reconnecting through OAuth heals the connection", healed.status === "connected" && !healed.last_error, healed.status);

  /* ---------------------------------------------- 5. the 48-hour reply window */
  await admin.from("agent_messages").update({ created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() }).eq("conversation_id", conv.id).eq("role", "user");
  await page.goto(`${BASE}/m/chatbot/workbench`, { waitUntil: "networkidle" });
  await page.getByText("Khách Mock 002").first().click();
  await page.getByRole("button", { name: "Tiếp quản hội thoại" }).first().click();
  const composer = page.getByPlaceholder("Nhập câu trả lời cho khách");
  await composer.waitFor();
  const sendsAtWindow = zalo.sends.length;
  await composer.fill("Dạ shop mở cửa 8h-21h ạ");
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await page.getByText("Quá hạn cửa sổ trả lời của Zalo").first().waitFor({ timeout: 20_000 }).then(() => check("past the window the reply is shown as failed with \"Quá hạn cửa sổ trả lời của Zalo\"", true), () => check("past the window the reply is shown as failed with the reason", false));
  await shot("7-window-expired");
  const { data: failedMsg } = await admin.from("agent_messages").select("delivery_status, delivery_error").eq("conversation_id", conv.id).eq("body", "Dạ shop mở cửa 8h-21h ạ").single();
  check("nothing was sent to Zalo and the message records the reason", zalo.sends.length === sendsAtWindow && failedMsg.delivery_status === "failed" && failedMsg.delivery_error === "zalo_window_expired", JSON.stringify(failedMsg));
  await admin.from("agent_messages").update({ created_at: new Date().toISOString() }).eq("conversation_id", conv.id).eq("role", "user");
  await composer.fill("Dạ shop mở cửa 8h-21h ạ (gửi lại)");
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  const resent = await until(() => zalo.sends.some((s) => s.text.includes("gửi lại")), 20_000, 300);
  check("inside the window a human reply is delivered", Boolean(resent));
} catch (e) {
  console.error("ERROR", e instanceof Error ? e.stack : e);
  results.push(false);
  console.error("--- last app log lines ---\n" + appLog.join("").split("\n").slice(-25).join("\n"));
} finally {
  await browser?.close().catch(() => null);
  await stop();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
