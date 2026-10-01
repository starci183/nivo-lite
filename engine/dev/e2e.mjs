// End-to-end proof against the LOCAL Supabase stack, with a FAKE OpenClaw gateway and a FAKE model API (no external call except one
// harmless Telegram sendMessage with a fake token, which the app already treats as "delivery failed, message still stored").
//   prerequisites: local Supabase up, migrations applied, `node scripts/with-secrets.mjs npx next build` done at the repo root,
//                  `npm run build` done in /engine.
//   run:           cd engine && node dev/e2e.mjs
// It creates a throwaway workspace (deleted at the end, cascades everything), starts the mock gateway, the mock model, the app
// (next start on :3100) and the engine worker, then proves: enqueue -> claim -> mock reply -> callback -> gate, the tool bridge and its
// isolation, both fallbacks (gateway silent, gateway down), connection.health, and concurrent claims.
// Secrets are read from the same file the app uses (NIVO_SECRETS or ~/.nivo-lite/secrets.env) and are never printed.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, createWriteStream } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const engineDir = join(here, "..");
const repoDir = join(engineDir, "..");

const secretsFile = process.env.NIVO_SECRETS || join(homedir(), ".nivo-lite", "secrets.env");
if (!existsSync(secretsFile)) throw new Error(`missing ${secretsFile}`);
const fileEnv = {};
for (const line of readFileSync(secretsFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) fileEnv[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const supabaseUrl = fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = fileEnv.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in the secrets file");

const rand = (n = 24) => randomBytes(n).toString("hex");
const ports = { app: 3100, engine: 8788, gateway: 18889, model: 18890 };
const secrets = { engine: rand(32), gateway: rand(16), telegram: rand(12) };
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (label, fn, timeoutMs = 60_000, everyMs = 400) => {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for: ${label}`);
    await sleep(everyMs);
  }
};

const children = [];
const launch = (name, cmd, args, env, cwd) => {
  const log = createWriteStream(join(tmpdir(), `nivo-e2e-${name}.log`));
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  children.push({ name, child });
  return child;
};
const stop = (name) => {
  const i = children.findIndex((c) => c.name === name);
  if (i >= 0) { children[i].child.kill(); children.splice(i, 1); }
};

const appEnv = {
  ...fileEnv,
  ENGINE_SHARED_SECRET: secrets.engine,
  TELEGRAM_WEBHOOK_SECRET: secrets.telegram,
  TELEGRAM_BOT_TOKEN: "0:e2e-fake-token", // the app would otherwise send to the real bot
  DEEPSEEK_API_KEY: "e2e-stub", DEEPSEEK_BASE_URL: `http://127.0.0.1:${ports.model}`, DEEPSEEK_MODEL: "stub",
  EMBEDDING_BASE_URL: `http://127.0.0.1:${ports.model}`,
  NEXT_TELEMETRY_DISABLED: "1",
};
const engineEnv = {
  SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: serviceKey, NIVO_BASE_URL: `http://127.0.0.1:${ports.app}`,
  ENGINE_SHARED_SECRET: secrets.engine, ENGINE_PORT: String(ports.engine), ENGINE_WORKER_ID: "e2e-worker", ENGINE_POLL_MS: "400",
  OPENCLAW_GATEWAY_URL: `ws://127.0.0.1:${ports.gateway}`, OPENCLAW_GATEWAY_TOKEN: secrets.gateway, OPENCLAW_TURN_TIMEOUT_MS: "6000",
  ENGINE_SHUTDOWN_GRACE_MS: "3000",
};
const tokenFile = join(tmpdir(), "nivo-e2e-last-tool-token.txt");
const startGateway = () => launch("gateway", process.execPath, [join(here, "mock-openclaw.mjs")], { MOCK_OPENCLAW_PORT: String(ports.gateway), OPENCLAW_GATEWAY_TOKEN: secrets.gateway, MOCK_TOKEN_FILE: tokenFile }, engineDir);

let ws = null;
const cleanup = async () => {
  for (const c of children.splice(0)) c.child.kill();
  if (ws) await db.from("workspaces").delete().eq("id", ws);
  await db.from("engine_jobs").delete().like("kind", "test.%");
};

const telegramUpdate = (chatId, updateId, text) => fetch(`http://127.0.0.1:${ports.app}/api/telegram`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secrets.telegram },
  body: JSON.stringify({ update_id: updateId, message: { message_id: updateId, chat: { id: chatId }, from: { first_name: "E2E" }, text } }),
});

/** Send one customer message and wait for its chat.turn job to leave the queue. */
let seq = Date.now() % 1_000_000_000;
const customerSays = async (text) => {
  const before = new Date().toISOString();
  const id = ++seq;
  const res = await telegramUpdate(777001, id, text); // one chat = one conversation
  if (!res.ok) throw new Error(`telegram route answered ${res.status}`);
  const job = await until(`chat.turn job for "${text.slice(0, 30)}"`, async () => {
    const { data } = await db.from("engine_jobs").select("*").eq("workspace_id", ws).eq("kind", "chat.turn").gte("created_at", before).order("created_at", { ascending: false }).limit(1);
    const j = data?.[0];
    return j && ["done", "failed"].includes(j.status) ? j : null;
  }, 45_000);
  return job;
};
const conversationMessages = async (conversationId) => (await db.from("agent_messages").select("role, body").eq("conversation_id", conversationId).order("created_at")).data ?? [];
const evidence = async (kind) => (await db.from("events").select("kind, actor, summary").eq("workspace_id", ws).eq("kind", kind)).data ?? [];

const main = async () => {
  if (!existsSync(join(engineDir, "dist", "main.js"))) throw new Error("run `npm run build` in /engine first");
  if (!existsSync(join(repoDir, ".next", "BUILD_ID"))) throw new Error("run `node scripts/with-secrets.mjs npx next build` at the repo root first");

  // ---- a throwaway workspace with a chatbot that is switched to the OpenClaw processor
  const { data: anyWs } = await db.from("workspaces").select("owner_id").limit(1).single();
  const w = await db.from("workspaces").insert({ owner_id: anyWs.owner_id, name: "ENGINE E2E (temporary)" }).select("id").single();
  if (w.error) throw new Error(`workspace: ${w.error.message}`);
  ws = w.data.id;
  const agent = await db.from("agents").insert({ workspace_id: ws, module: "chatbot", name: "E2E Bot", handle: "chatbot", role: "Chatbot", instructions: "Answer politely.", knowledge: "Giờ mở cửa 9:00-20:00 mỗi ngày." }).select("id").single();
  if (agent.error) throw new Error(`agent: ${agent.error.message}`);
  await db.from("module_installations").insert({ workspace_id: ws, module_key: "chatbot", agent_id: agent.data.id, status: "live", live_enabled: true, settings: { processor: "openclaw" } });
  await db.from("connections").insert({ workspace_id: ws, provider: "telegram", name: "E2E failing bot", status: "error", last_error: "token revoked" });
  console.log(`workspace ${ws.slice(0, 8)} created`);

  // ---- start everything
  launch("model", process.execPath, [join(here, "mock-model.mjs")], { MOCK_MODEL_PORT: String(ports.model) }, engineDir);
  startGateway();
  launch("app", process.execPath, [join(repoDir, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(ports.app)], { ...appEnv, TELEGRAM_WORKSPACE_ID: ws }, repoDir);
  launch("engine", process.execPath, [join(engineDir, "dist", "main.js")], engineEnv, engineDir);
  await until("app", async () => (await fetch(`http://127.0.0.1:${ports.app}/login`).catch(() => null))?.ok, 90_000, 1000);
  await until("engine /healthz", async () => (await fetch(`http://127.0.0.1:${ports.engine}/healthz`).catch(() => null))?.ok, 30_000);
  await until("engine heartbeat", async () => (await db.from("engine_workers").select("worker_id").eq("worker_id", "e2e-worker")).data?.length, 15_000);
  const health = await (await fetch(`http://127.0.0.1:${ports.engine}/healthz`)).json();
  check("engine /healthz is up and reports its worker", health.status === "ok" && health.worker.workerId === "e2e-worker");

  // ---- A. happy path: enqueue -> claim -> mock reply -> callback -> gate
  const a = await customerSays("Spa mở cửa lúc mấy giờ ạ?");
  check("A  chat.turn job completed through OpenClaw", a.status === "done" && a.result?.path === "openclaw", `status=${a.status} path=${a.result?.path} attempts=${a.attempts}`);
  const convId = (await db.from("agent_conversations").select("id").eq("workspace_id", ws).limit(1).single()).data.id;
  const aMsgs = await conversationMessages(convId);
  check("A  the reply was recorded as an agent message (through the app, not the engine)", aMsgs.some((m) => m.role === "agent" && m.body.includes("Mock OpenClaw")));
  check("A  evidence: engine.reply logged by the app", (await evidence("engine.reply")).length === 1);
  check("A  evidence: the tool call went through the bridge (knowledge.search)", (await evidence("engine.tool.knowledge.search")).length >= 1);
  check("A  one customer message produced exactly one agent reply", aMsgs.filter((m) => m.role === "agent").length === 1);

  // ---- B. the engine only PROPOSES: a discount is over authority and must wait for the owner
  const b = await customerSays("Cho mình xin giảm giá được không?");
  check("B  chat.turn done (needs_human proposal)", b.status === "done" && b.result?.path === "openclaw");
  const bMsgs = await conversationMessages(convId);
  check("B  the customer never saw the proposed discount", !bMsgs.some((m) => m.role === "agent" && m.body.includes("giảm 10%")));
  const waiting = (await db.from("work_items").select("status, proposal").eq("workspace_id", ws).eq("action", "reply_customer")).data ?? [];
  check("B  a reply_customer item is waiting for the owner with the proposed answer", waiting.some((x) => x.status === "waiting_decision" && JSON.stringify(x.proposal).includes("giảm 10%")), `items=${waiting.map((x) => x.status).join(",")}`);

  // ---- C. tool bridge isolation (internal endpoint, per-job token)
  const noToken = await fetch(`http://127.0.0.1:${ports.engine}/tools/knowledge.search`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "x", workspace_id: ws }) });
  const badToken = await fetch(`http://127.0.0.1:${ports.engine}/tools/knowledge.search`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer aaaa.bbbb" }, body: "{}" });
  const replayed = await fetch(`http://127.0.0.1:${ports.engine}/tools/knowledge.search`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${existsSync(tokenFile) ? readFileSync(tokenFile, "utf8").trim() : "none"}` }, body: "{}" });
  check("C  tool call without a token is refused", noToken.status === 401);
  check("C  tool call with a forged token is refused", badToken.status === 401);
  check("C  a token is not usable after its job ended", replayed.status === 401);
  const forged = await fetch(`http://127.0.0.1:${ports.app}/api/engine/context`, { method: "POST", headers: { "content-type": "application/json", "x-engine-timestamp": String(Date.now()), "x-engine-signature": "00".repeat(32) }, body: JSON.stringify({ job_id: a.id }) });
  check("C  the app refuses an unsigned engine call", forged.status === 401);

  // ---- E. gateway answers nothing: timeout -> direct-model fallback
  const e = await customerSays("mock-silent hãy im lặng");
  check("E  OpenClaw silent: job done via direct_fallback", e.status === "done" && e.result?.path === "direct_fallback", `path=${e.result?.path} reason=${String(e.result?.reason).slice(0, 60)}`);
  check("E  the customer still got an answer (direct model)", (await conversationMessages(convId)).some((m) => m.role === "agent" && m.body.includes("Direct model (stub)")));

  // ---- D. gateway down: connection refused -> direct-model fallback
  stop("gateway");
  await sleep(500);
  const d = await customerSays("Bên mình có gửi xe không?");
  check("D  gateway down: job done via direct_fallback", d.status === "done" && d.result?.path === "direct_fallback", `reason=${String(d.result?.reason).slice(0, 80)}`);
  check("D  evidence: engine.fallback logged", (await evidence("engine.fallback")).length >= 2);

  // ---- F. connection.health (scheduled by pg_cron in real life; here the same function is called)
  const sched = await db.rpc("engine_schedule_connection_health");
  const health1 = await until("connection.health job", async () => {
    const { data } = await db.from("engine_jobs").select("*").eq("workspace_id", ws).eq("kind", "connection.health").in("status", ["done", "failed"]).limit(1);
    return data?.[0];
  }, 20_000);
  const conn = (await db.from("connections").select("public_meta").eq("workspace_id", ws).single()).data;
  check("F  connection.health ran and marked the failing connection", health1.status === "done" && conn.public_meta?.health?.state === "failing", `scheduled=${sched.data} state=${conn.public_meta?.health?.state}`);
  await db.rpc("engine_schedule_connection_health");
  const mine = (await db.from("engine_jobs").select("id").eq("workspace_id", ws).eq("kind", "connection.health")).data ?? [];
  check("F  a second tick does not enqueue another job for the same workspace", mine.length === 1, `jobs=${mine.length}`);

  // ---- G. concurrent claims never hand one job to two workers
  for (let i = 0; i < 8; i++) await db.rpc("engine_enqueue", { p_workspace: ws, p_kind: "test.claim", p_payload: {}, p_dedupe_key: `test.claim:${i}:${rand(4)}` });
  const claims = await Promise.all(["w1", "w2", "w3", "w4"].map((w) => db.rpc("engine_claim_jobs", { p_worker: w, p_kinds: ["test.claim"], p_limit: 5, p_lease_seconds: 30 })));
  const ids = claims.flatMap((c) => (c.data ?? []).map((j) => j.id));
  check("G  8 jobs, 4 racing workers: each job claimed exactly once", ids.length === 8 && new Set(ids).size === 8, `claimed=${ids.length} unique=${new Set(ids).size}`);
  const names = ["w1", "w2", "w3", "w4"];
  const winner = claims.findIndex((c) => (c.data ?? []).length > 0);
  const one = claims[winner].data[0];
  const failed = await db.rpc("engine_fail_job", { p_job: one.id, p_worker: names[winner], p_error: "boom" });
  const requeued = (await db.from("engine_jobs").select("status, run_at, attempts").eq("id", one.id).single()).data;
  check("G  a failed attempt is retried later with backoff", failed.data === "queued" && Date.parse(requeued.run_at) > Date.now(), `status=${failed.data} attempts=${requeued.attempts}`);

  // ---- H. the worker presence the settings card reads (engine_status() is for signed-in members; the app guard reads the table)
  const hb = (await db.from("engine_workers").select("last_heartbeat_at").eq("worker_id", "e2e-worker").single()).data;
  check("H  the worker heartbeat is fresh in engine_workers", hb && Date.now() - Date.parse(hb.last_heartbeat_at) < 20_000, `age=${hb ? Math.round((Date.now() - Date.parse(hb.last_heartbeat_at)) / 1000) : "?"}s`);
};

try {
  await main();
} catch (e) {
  results.push(false);
  console.error("FAIL  e2e aborted:", e instanceof Error ? e.message : e);
} finally {
  await cleanup();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed${failed ? `, ${failed} FAILED` : ""}. Logs: ${tmpdir()}/nivo-e2e-*.log`);
process.exit(failed ? 1 : 0);
