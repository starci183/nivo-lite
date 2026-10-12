// Local dev stack for the engine and its background jobs.   npm run dev:stack   (from the repo root)
// The engine runs in watch mode (tsc --watch + node --watch dist/main.js) against the LOCAL Supabase stack, whose Postgres also holds the job
// queues (pgmq, supabase/migrations/20261025110000_pgmq_transport.sql): nothing else to start.
// The engine env is generated from the local env file (secrets.env at the repo root, or NIVO_SECRETS=<path>): the Supabase URL and
// service role come from NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (npm run db:start prints them). Nothing is written to disk
// and no value is printed. ENGINE_WORKER_ENABLED / JOBS_ENABLED from the file (or the shell) are passed through, so a local run can keep
// the old engine_jobs worker (OpenClaw, channel health checks) off.
//   node engine/dev/stack.mjs            start the engine (Ctrl+C stops it)
//   node engine/dev/stack.mjs --env      print the generated variable NAMES only
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const engineDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = join(engineDir, "..");
const arg = (f) => process.argv.includes(f);

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
    ENGINE_PORT: process.env.DEV_ENGINE_PORT || f.DEV_ENGINE_PORT || "8787",
    ENGINE_HOST: "127.0.0.1",
    ENGINE_WORKER_ENABLED: process.env.ENGINE_WORKER_ENABLED ?? f.ENGINE_WORKER_ENABLED,
    JOBS_ENABLED: process.env.JOBS_ENABLED ?? f.JOBS_ENABLED,
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
