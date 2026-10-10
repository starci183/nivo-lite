#!/usr/bin/env node
// Connect Telegram, SePay or Zalo OA to a workspace from the terminal, one at a time, exactly as the /connections wizard stores them:
// a `connections` row + an AES-256-GCM `connection_secrets` row (CHANNEL_TOKEN_KEY), optionally bound to the workspace's agents.
// Secrets are typed with hidden input and never written to disk or printed (the one exception: the SePay API key NIVO generates,
// which must be pasted into SePay).
//   node scripts/with-secrets.mjs node scripts/connect-channel.mjs [telegram|sepay|zalo]
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CHANNEL_TOKEN_KEY, NEXT_PUBLIC_SITE_URL (the Supabase project these point at is the one written to).
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

const env = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`Missing ${k} (run through scripts/with-secrets.mjs)`); process.exit(1); }
  return v;
};
const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const db = createClient(supabaseUrl, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const KEY = Buffer.from(env("CHANNEL_TOKEN_KEY"), "base64");
if (KEY.length !== 32) { console.error("CHANNEL_TOKEN_KEY must be 32 bytes, base64"); process.exit(1); }
const SITE = env("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");
const PUBLIC_HTTPS = /^https:\/\//.test(SITE) && !/\/\/(localhost|127\.|\[::1\])/.test(SITE);

/* ------------------------------------------------------------------ same primitives as src/lib/channels.ts */
const encryptSecret = (plain) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
};
const randomSecret = () => randomBytes(32).toString("hex");
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const webhookUrlFor = (provider, id) =>
  provider === "telegram" ? `${SITE}/api/telegram/${id}` : `${SITE}/api/connections/${provider === "zalo_oa" ? "zalo" : provider}/${id}`;
const PURPOSE = { "chatbot:telegram": "inbound_chat", "chatbot:zalo_oa": "inbound_chat", "accounting:sepay": "bank_feed" };

/* ------------------------------------------------------------------ prompts */
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
// Lines are queued so piped input works as well as typing; while `muted`, typed characters are not echoed.
let muted = false;
rl._writeToOutput = (s) => { if (!muted) process.stdout.write(s); };
const lines = [];
const waiting = [];
rl.on("line", (l) => (waiting.length ? waiting.shift()(l) : lines.push(l)));
let closed = false;
rl.on("close", () => { closed = true; while (waiting.length) waiting.shift()(null); });
const nextLine = () => new Promise((res) => (lines.length ? res(lines.shift()) : closed ? res(null) : waiting.push(res)));
const readAnswer = async () => {
  const l = await nextLine();
  if (l === null) fail("Het input.");
  return l.trim();
};
const ask = async (q, def = "") => {
  process.stdout.write(def ? `${q} [${def}]: ` : `${q}: `);
  return (await readAnswer()) || def;
};
const askSecret = async (q) => {
  process.stdout.write(`${q} (an khi go): `);
  muted = true;
  try { return await readAnswer(); } finally { muted = false; process.stdout.write("\n"); }
};
const choose = async (q, options) => {
  options.forEach((o, i) => console.log(`  ${i + 1}. ${o.label}`));
  for (;;) {
    const n = Number(await ask(q, "1"));
    if (n >= 1 && n <= options.length) return options[n - 1].value;
    console.log("  Chon mot so trong danh sach.");
  }
};
const yes = async (q, def = "y") => /^y/i.test(await ask(`${q} (y/n)`, def));
const fail = (msg) => { throw new Error(msg); };
const ok = (r, what) => { if (r.error) fail(`${what}: ${r.error.message}`); return r.data; };

/* ------------------------------------------------------------------ shared steps */
const pickWorkspace = async () => {
  const rows = ok(await db.from("workspaces").select("id, name, status, owner_id, created_at").order("created_at", { ascending: false }).limit(30), "workspaces");
  if (!rows.length) fail("Chua co workspace nao.");
  console.log(`\nWorkspace tren ${new URL(supabaseUrl).host}:`);
  return choose("Chon workspace", rows.map((w) => ({ label: `${w.name}  (${w.status})  ${w.id}`, value: w })));
};

const createConnection = async (ws, provider, name, meta, ciphertext, webhookSecret, opts = {}) => {
  const row = ok(await db.from("connections").insert({
    workspace_id: ws.id, provider, name, status: opts.status ?? "connected", environment: opts.environment ?? "live", created_by: ws.owner_id, public_meta: meta,
  }).select("id").single(), "connections");
  const saved = await db.from("connection_secrets").insert({ connection_id: row.id, ciphertext, webhook_secret: webhookSecret });
  if (saved.error) { await db.from("connections").delete().eq("id", row.id); fail(`connection_secrets: ${saved.error.message}`); }
  return row.id;
};

const bindAgents = async (ws, connectionId, provider) => {
  const agents = ok(await db.from("agents").select("id, name, module").eq("workspace_id", ws.id), "agents")
    .filter((a) => PURPOSE[`${a.module}:${provider}`]);
  if (!agents.length) { console.log("  (Chua co agent phu hop de gan; gan sau o trang Ket noi.)"); return; }
  if (!(await yes(`Gan kenh nay cho agent: ${agents.map((a) => a.name).join(", ")}?`))) return;
  ok(await db.from("agent_connections").insert(agents.map((a) => ({
    agent_id: a.id, connection_id: connectionId, workspace_id: ws.id, purpose: PURPOSE[`${a.module}:${provider}`],
  }))), "agent_connections");
  console.log("  Da gan agent.");
};

const tg = async (token, method, body = {}) => {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => null);
  if (!out?.ok) fail(`Telegram ${method}: ${out?.description ?? res.status}`);
  return out.result;
};

/* ------------------------------------------------------------------ providers */
const telegram = async (ws) => {
  console.log("\nTELEGRAM: nhan /newbot cho @BotFather, roi dan token bot vao day.");
  const name = await ask("Ten ket noi", "Bot Telegram");
  const token = await askSecret("Bot token");
  if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) fail("Token khong dung dang 123456:ABC...");
  const me = await tg(token, "getMe");
  const taken = ok(await db.from("connections").select("id").eq("provider", "telegram").eq("public_meta->>bot_id", String(me.id)).neq("status", "disconnected").limit(1), "connections");
  if (taken.length) fail(`Bot @${me.username} dang duoc mot ket noi khac dung.`);
  const secret = randomSecret();
  const id = await createConnection(ws, "telegram", name, { bot_id: String(me.id), bot_username: me.username ?? "" }, encryptSecret(token), secret);
  if (PUBLIC_HTTPS) {
    try {
      await tg(token, "setWebhook", { url: webhookUrlFor("telegram", id), secret_token: secret, allowed_updates: ["message"] });
      console.log(`  Da dang ky webhook: ${webhookUrlFor("telegram", id)}`);
    } catch (e) {
      await db.from("connections").update({ status: "error", last_error: e.message, updated_at: new Date().toISOString() }).eq("id", id);
      fail(`Luu ket noi nhung dang ky webhook loi: ${e.message}`);
    }
  } else console.log(`  ${SITE} khong phai https cong khai: chua dang ky webhook.`);
  console.log(`  OK: bot @${me.username} -> ket noi ${id}`);
  await bindAgents(ws, id, "telegram");
  console.log("  Kiem tra: nhan bot mot tin, agent Chatbot phai tra loi.");
};

const sepay = async (ws) => {
  console.log("\nSEPAY: NIVO tao API Key; thay dan URL + API Key vao trang Webhook cua SePay.");
  const environment = await choose("Moi truong", [{ label: "Thu nghiem (Test Mode)", value: "test" }, { label: "Chinh thuc", value: "live" }]);
  const name = await ask("Ten ket noi", "SePay");
  const bankCode = (await ask("Ma ngan hang (vd VCB, MB, TCB, ACB, BIDV)")).toUpperCase();
  const account = (await ask("So tai khoan")).replace(/\s+/g, "");
  const holder = (await ask("Ten chu tai khoan (khong dau)")).toUpperCase();
  if (!/^\d{6,20}$/.test(account)) fail("So tai khoan phai la 6-20 chu so.");
  if (!bankCode || !holder) fail("Thieu ma ngan hang hoac ten chu tai khoan.");
  const apiKey = `nivo_${randomSecret()}`;
  const id = await createConnection(ws, "sepay", name, { bank_code: bankCode, account_masked: `•••• ${account.slice(-4)}`, account_holder: holder },
    encryptSecret(apiKey), sha256(apiKey), { status: "pending", environment });
  await bindAgents(ws, id, "sepay");
  const dash = environment === "test" ? "https://my.sepay.vn/testmode/webhook" : "https://my.sepay.vn/webhook";
  console.log(`
  Mo ${dash} -> Them webhook:
    Ten webhook       : NIVO · ${name}
    URL nhan webhook  : ${webhookUrlFor("sepay", id)}
    Loai giao dich    : Tien vao      Dinh dang: JSON      Tu dong gui lai: bat
    Tai khoan         : ${bankCode} ${account}
    Kieu xac thuc     : API Key
    API Key           : ${apiKey}
  Luu xong, ${environment === "test" ? "vao Giao dich > Mo phong giao dich 2.000d" : "chuyen mot khoan nho that"}. Ket noi chuyen sang 'connected' khi NIVO nhan duoc giao dich dau tien.
  (Xem lai API Key bat cu luc nao o trang Ket noi.)`);
};

const zalo = async (ws) => {
  console.log("\nZALO OA: can App ID + App Secret (developers.zalo.me > Cai dat chung) va OA Secret Key (trang Webhook).");
  const name = await ask("Ten ket noi", "Zalo OA");
  const appId = await ask("App ID");
  const appSecret = await askSecret("App Secret");
  if (!/^\d{6,30}$/.test(appId) || appSecret.length < 8) fail("App ID phai la chu so, App Secret it nhat 8 ky tu.");
  const oaSecret = await askSecret("OA Secret Key (Enter de bo qua, nhap sau o trang Ket noi)");
  if (oaSecret && (oaSecret.length < 8 || oaSecret.length > 200)) fail("OA Secret Key khong hop le.");
  const id = await createConnection(ws, "zalo_oa", name, { app_id: appId }, encryptSecret(JSON.stringify({ appId, appSecret, oaSecret })), randomSecret(), { status: "pending" });
  await bindAgents(ws, id, "zalo_oa");
  console.log(`
  Trong ung dung Zalo (developers.zalo.me):
    Official Account > Callback URL : ${SITE}/api/connections/zalo/oauth/callback
    Official Account > Quyen        : quan ly tin nhan, thong tin nguoi quan tam, gui tin tu van
    Webhook URL                     : ${webhookUrlFor("zalo_oa", id)}
    Webhook > su kien               : bat user_send_text va follow
  Buoc cuoi PHAI lam tren trinh duyet (Zalo can chu OA dong y): dang nhap ${SITE}/connections bang owner/manager,
  mo ket noi '${name}' va bam Ket noi Zalo OA.${oaSecret ? "" : " Nho dan OA Secret Key o do."}`);
};

/* ------------------------------------------------------------------ main */
const PROVIDERS = { telegram, sepay, zalo };
try {
  console.log(`NIVO connect-channel  ->  ${new URL(supabaseUrl).host}  (site ${SITE})`);
  const ws = await pickWorkspace();
  let next = process.argv[2];
  for (;;) {
    const provider = PROVIDERS[next] ? next : await choose("Ket noi gi", [
      { label: "Telegram", value: "telegram" }, { label: "SePay", value: "sepay" }, { label: "Zalo OA", value: "zalo" },
    ]);
    try { await PROVIDERS[provider](ws); } catch (e) { console.error(`  LOI: ${e.message}`); }
    next = undefined;
    if (!(await yes("\nNhap ket noi khac?", "n"))) break;
  }
} catch (e) {
  console.error(`LOI: ${e.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
