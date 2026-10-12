// Local dev stack for the engine + BullMQ job system.   npm run dev:stack   (from the repo root)
//   1. Redis in docker (container nivo-dev-redis, 127.0.0.1:56379, AOF on, named volume nivo-dev-redis).
//   2. The engine in watch mode (tsc --watch + node --watch dist/main.js) against the LOCAL Supabase stack.
// The engine env is generated from the local env file (secrets.env at the repo root, or NIVO_SECRETS=<path>): the Supabase URL and
// service role come from NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (npm run db:start prints them). Nothing is written to disk
// and no value is printed.
//   node engine/dev/stack.mjs            start everything (Ctrl+C stops the engine; Redis keeps running)
//   node engine/dev/stack.mjs --env      print the generated variable NAMES only
//   node engine/dev/stack.mjs --down     stop and remove the Redis container (data volume is kept)
//   node engine/dev/stack.mjs --redis    only make sure Redis is up
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const engineDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = join(engineDir, "..");
const REDIS_NAME = "nivo-dev-redis";
const REDIS_PORT = process.env.DEV_REDIS_PORT || "56379";
const arg = (f) => process.argv.includes(f);
const docker = (...a) => execFileSync("docker", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

if (arg("--down")) {
  try { docker("rm", "-f", REDIS_NAME); console.log(`[dev:stack] ${REDIS_NAME} removed (volume ${REDIS_NAME} kept)`); } catch { console.log("[dev:stack] nothing to remove"); }
  process.exit(0);
}

function ensureRedis() {
  let state = "";
  try { state = docker("inspect", "-f", "{{.State.Status}}", REDIS_NAME); } catch { /* not created yet */ }
  if (state === "running") return;
  if (state) docker("start", REDIS_NAME);
  else docker("run", "-d", "--name", REDIS_NAME, "--restart", "unless-stopped", "-p", `127.0.0.1:${REDIS_PORT}:6379`, "-v", `${REDIS_NAME}:/data`, "redis:7-alpine", "redis-server", "--appendonly", "yes");
  for (let i = 0; i < 20; i++) {
    try { if (docker("exec", REDIS_NAME, "redis-cli", "ping") === "PONG") return; } catch { /* starting */ }
    execFileSync(process.execPath, ["-e", "setTimeout(()=>{},500)"]);
  }
  throw new Error("redis did not answer PING");
}

function engineEnv() {
  const file = process.env.NIVO_SECRETS || join(repoDir, "secrets.env");
  if (!existsSync(file)) throw new Error(`missing ${file}: copy secrets.example.env to secrets.env (and run npm run db:start for the local keys)`);
  const f = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) f[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const url = f.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error("NEXT_PUBLIC_SUPABASE_URL must point at the LOCAL Supabase stack (http://127.0.0.1:<api port>): the dev stack never targets production");
  if (!f.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing in the env file (npm run db:status prints the local one)");
  const pick = (...keys) => keys.map((k) => f[k]).find(Boolean);
  const env = {
    SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: f.SUPABASE_SERVICE_ROLE_KEY,
    NIVO_BASE_URL: f.DEV_NIVO_BASE_URL || "http://localhost:3100",
    // At least 32 chars; must equal the web app's value when you run both. A fixed dev-only default keeps restarts stable.
    ENGINE_SHARED_SECRET: f.ENGINE_SHARED_SECRET || "dev-only-engine-shared-secret-0123456789abcdef",
    ENGINE_WORKER_ID: "dev-1",
    ENGINE_PORT: f.DEV_ENGINE_PORT || "8787",
    ENGINE_HOST: "127.0.0.1",
    REDIS_URL: `redis://127.0.0.1:${REDIS_PORT}`,
    OPENROUTER_API_KEY: pick("OPENROUTER_API_KEY", "DEEPSEEK_API_KEY"),
    EMBEDDING_API_KEY: pick("EMBEDDING_API_KEY"),
    EMBEDDING_MODEL: pick("EMBEDDING_MODEL"),
    EMBEDDING_BASE_URL: pick("EMBEDDING_BASE_URL"),
    CHANNEL_TOKEN_KEY: pick("CHANNEL_TOKEN_KEY"),
    GOOGLE_OAUTH_CLIENT_ID: pick("GOOGLE_OAUTH_CLIENT_ID", "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID"),
    GOOGLE_OAUTH_CLIENT_SECRET: pick("GOOGLE_OAUTH_CLIENT_SECRET", "SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET"),
  };
  return Object.fromEntries(Object.entries(env).filter(([, v]) => v));
}

ensureRedis();
console.log(`[dev:stack] redis up on 127.0.0.1:${REDIS_PORT}`);
if (arg("--redis")) process.exit(0);
const env = engineEnv();
if (arg("--env")) { console.log(Object.keys(env).join("\n")); process.exit(0); }

const bin = (name) => {
  for (const d of [join(engineDir, "node_modules", ".bin"), join(repoDir, "node_modules", ".bin")]) {
    const p = join(d, process.platform === "win32" ? `${name}.cmd` : name);
    if (existsSync(p)) return p;
  }
  throw new Error(`${name} not found: run npm ci in engine/`);
};
const run = (cmd, args, extra = {}) => spawn(cmd, args, { cwd: engineDir, stdio: "inherit", shell: process.platform === "win32" && cmd.endsWith(".cmd"), env: { ...process.env, ...extra } });

// Build once so dist/ exists, then keep tsc watching and let node restart the engine whenever dist/ changes.
execFileSync(bin("tsc"), ["-p", "tsconfig.build.json"], { cwd: engineDir, stdio: "inherit", shell: process.platform === "win32" });
const tsc = run(bin("tsc"), ["-p", "tsconfig.build.json", "--watch", "--preserveWatchOutput"]);
const node = run(process.execPath, ["--watch-path=dist", "dist/main.js"], env);
console.log(`[dev:stack] engine watching dist/ on http://127.0.0.1:${env.ENGINE_PORT} (healthz, readyz); Supabase ${env.SUPABASE_URL}`);
const stop = () => { tsc.kill(); node.kill(); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
node.on("exit", (c) => { tsc.kill(); process.exit(c ?? 0); });
