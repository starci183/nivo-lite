#!/usr/bin/env node
// Pushes secrets.env to the GitHub environment "production":
//   ENGINE_ENV  the [engine] block (the VPS docker stack's .env) + REDIS_URL (default redis://redis:6379) and the app keys the jobs need
//   WEB_ENV     the server-side [app] keys (+ ENGINE_SHARED_SECRET), NEXT_PUBLIC_SITE_URL forced to https://nivo.vn (the web container's runtime env_file)
//   WEB_NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY / _DEMO_LOGIN  build args baked into the client bundle (public values, kept as secrets for one place to manage)
// Usage: node scripts/env-sync.mjs            -> updates the secrets (needs gh logged in)
//        node scripts/env-sync.mjs --check    -> only prints how many variables would be pushed
//        node scripts/env-sync.mjs --write-web <file>  -> writes the WEB_ENV content to a local file (manual bootstrap of ~/nivo-web/.env)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const text = readFileSync(process.env.NIVO_SECRETS || join(repo, "secrets.env"), "utf8");
const sections = {};
let current = "";
for (const line of text.split(/\r?\n/)) {
  const head = line.match(/^# -+ \[(\w+)\]/);
  if (head) current = head[1];
  else if (current && /^[A-Z0-9_]+=/.test(line)) (sections[current] ||= []).push(line);
}
const engineBlock = sections.engine ?? [];
if (!engineBlock.length) throw new Error("no [engine] block found in secrets.env");
const app = sections.app ?? [];
if (!app.length) throw new Error("no [app] block found in secrets.env");

const kv = (line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).replace(/^["']|["']$/g, "")];

// The knowledge job handlers (BullMQ workers on the VPS) need the same keys the web app uses to read and embed documents. Values that
// live in [app] are inherited when the [engine] block does not set them, so each secret is kept in ONE place. Only the mapping is here.
const engineMap = new Map(engineBlock.map(kv));
const appMap0 = new Map(app.map(kv));
const ENGINE_DEFAULTS = { REDIS_URL: "redis://redis:6379", EMBEDDING_MODEL: "qwen/qwen3-embedding-8b", EMBEDDING_BASE_URL: "https://openrouter.ai/api/v1" };
const ENGINE_FROM_APP = {
  CHANNEL_TOKEN_KEY: ["CHANNEL_TOKEN_KEY"],
  GOOGLE_OAUTH_CLIENT_ID: ["GOOGLE_OAUTH_CLIENT_ID", "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID"],
  GOOGLE_OAUTH_CLIENT_SECRET: ["GOOGLE_OAUTH_CLIENT_SECRET", "SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET"],
  EMBEDDING_API_KEY: ["EMBEDDING_API_KEY"],
  OPENROUTER_API_KEY: ["OPENROUTER_API_KEY", "DEEPSEEK_API_KEY"], // the app's DEEPSEEK_API_KEY is an OpenRouter key
};
for (const [k, v] of Object.entries(ENGINE_DEFAULTS)) if (!engineMap.get(k)) engineMap.set(k, v);
for (const [k, sources] of Object.entries(ENGINE_FROM_APP)) {
  if (engineMap.get(k)) continue;
  const found = sources.map((n) => appMap0.get(n)).find(Boolean);
  if (found) engineMap.set(k, found);
}
const ENGINE_REQUIRED = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ENGINE_SHARED_SECRET", "REDIS_URL", "OPENROUTER_API_KEY", "CHANNEL_TOKEN_KEY", "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"];
const missing = ENGINE_REQUIRED.filter((k) => !engineMap.get(k));
if (missing.length) console.warn(`[env-sync] WARNING: ENGINE_ENV has no value for: ${missing.join(", ")} (names only; the knowledge jobs need them)`);
const engine = [...engineMap].filter(([, v]) => v !== "").map(([k, v]) => `${k}=${v}`);
const appMap = new Map(app.map(kv));

// The engine runs the BullMQ background jobs (docs/JOBS.md): it needs Redis (the compose service "redis" unless the [engine] block says
// otherwise) and the app keys the knowledge jobs use. Each is taken from the [app] block only when the [engine] block does not set it.
const engineKeys = new Set(engine.map((l) => kv(l)[0]));
if (!engineKeys.has("REDIS_URL")) engine.push("REDIS_URL=redis://redis:6379");
for (const k of ["CHANNEL_TOKEN_KEY", "EMBEDDING_MODEL", "EMBEDDING_BASE_URL", "EMBEDDING_API_KEY"]) {
  if (!engineKeys.has(k) && appMap.get(k)) engine.push(`${k}=${appMap.get(k)}`);
}
// Google OAuth (Drive reads with the stored grant): the app's GOOGLE_OAUTH_* or, as for WEB_ENV below, the Supabase Google client.
const googleId = appMap.get("GOOGLE_OAUTH_CLIENT_ID") || appMap.get("SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID");
const googleSecret = appMap.get("GOOGLE_OAUTH_CLIENT_SECRET") || appMap.get("SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET");
if (!engineKeys.has("GOOGLE_OAUTH_CLIENT_ID") && googleId) engine.push(`GOOGLE_OAUTH_CLIENT_ID=${googleId}`);
if (!engineKeys.has("GOOGLE_OAUTH_CLIENT_SECRET") && googleSecret) engine.push(`GOOGLE_OAUTH_CLIENT_SECRET=${googleSecret}`);
// Google OAuth keys are Supabase CLI config, not read by the app: do not ship them to the web host.
const WEB_SKIP = /^SUPABASE_AUTH_EXTERNAL_/;
const quote = (v) => (/[$#\s"]|\\/.test(v) && !v.includes("'") ? `'${v}'` : v);
const web = new Map([...appMap].filter(([k]) => !WEB_SKIP.test(k)));
// The same Google OAuth client also serves the app's own Google features (Sheets connector, Drive read grant): ship it under the
// app's names unless secrets.env sets GOOGLE_OAUTH_* explicitly.
if (!web.get("GOOGLE_OAUTH_CLIENT_ID") && appMap.get("SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID")) web.set("GOOGLE_OAUTH_CLIENT_ID", appMap.get("SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID"));
if (!web.get("GOOGLE_OAUTH_CLIENT_SECRET") && appMap.get("SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET")) web.set("GOOGLE_OAUTH_CLIENT_SECRET", appMap.get("SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET"));
// The Picker's public client id is the same client id (public by nature).
if (!appMap.get("NEXT_PUBLIC_GOOGLE_CLIENT_ID")) appMap.set("NEXT_PUBLIC_GOOGLE_CLIENT_ID", web.get("GOOGLE_OAUTH_CLIENT_ID") ?? "");
web.set("NEXT_PUBLIC_SITE_URL", "https://nivo.vn");
const shared = engine.map(kv).find(([k]) => k === "ENGINE_SHARED_SECRET");
if (shared && shared[1]) web.set("ENGINE_SHARED_SECRET", shared[1]);
const webEnv = [...web].filter(([, v]) => v !== "").map(([k, v]) => `${k}=${quote(v)}`);

const buildArgs = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_DEMO_LOGIN", "NEXT_PUBLIC_GOOGLE_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_PICKER_API_KEY", "NEXT_PUBLIC_GOOGLE_APP_ID"];
for (const k of buildArgs.slice(0, 2)) if (!appMap.get(k)) throw new Error(`${k} missing in the [app] block`);

const wi = process.argv.indexOf("--write-web");
if (wi > 0) {
  writeFileSync(process.argv[wi + 1], webEnv.join("\n") + "\n", { mode: 0o600 });
  console.log(`[env-sync] wrote ${webEnv.length} web variables to ${process.argv[wi + 1]}`);
} else if (process.argv.includes("--check")) {
  console.log(`[env-sync] ${engine.length} engine variables, ${webEnv.length} web variables, ${buildArgs.length} build args ready (not pushed)`);
} else {
  const set = (name, value) =>
    execFileSync("gh", ["secret", "set", name, "--env", "production", "--repo", "starci183/nivo-lite"], { input: value, stdio: ["pipe", "inherit", "inherit"] });
  set("ENGINE_ENV", engine.join("\n") + "\n");
  console.log(`[env-sync] ENGINE_ENV updated (${engine.length} variables). Re-run the "Deploy engine" workflow to apply.`);
  set("WEB_ENV", webEnv.join("\n") + "\n");
  console.log(`[env-sync] WEB_ENV updated (${webEnv.length} variables). Re-run the "Deploy web" workflow to apply.`);
  for (const k of buildArgs) set(`WEB_${k}`, appMap.get(k) ?? "");
  console.log(`[env-sync] ${buildArgs.length} web build-arg secrets updated.`);
}
