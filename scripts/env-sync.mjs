#!/usr/bin/env node
// Pushes secrets.env to the GitHub environment "production":
//   ENGINE_ENV  the [engine] block (the VPS docker stack's .env)
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
const engine = sections.engine ?? [];
if (!engine.length) throw new Error("no [engine] block found in secrets.env");
const app = sections.app ?? [];
if (!app.length) throw new Error("no [app] block found in secrets.env");

const kv = (line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).replace(/^["']|["']$/g, "")];
const appMap = new Map(app.map(kv));
// Google OAuth keys are Supabase CLI config, not read by the app: do not ship them to the web host.
const WEB_SKIP = /^SUPABASE_AUTH_EXTERNAL_/;
const quote = (v) => (/[$#\s"]|\\/.test(v) && !v.includes("'") ? `'${v}'` : v);
const web = new Map([...appMap].filter(([k]) => !WEB_SKIP.test(k)));
web.set("NEXT_PUBLIC_SITE_URL", "https://nivo.vn");
const shared = engine.map(kv).find(([k]) => k === "ENGINE_SHARED_SECRET");
if (shared && shared[1]) web.set("ENGINE_SHARED_SECRET", shared[1]);
const webEnv = [...web].filter(([, v]) => v !== "").map(([k, v]) => `${k}=${quote(v)}`);

const buildArgs = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_DEMO_LOGIN"];
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
