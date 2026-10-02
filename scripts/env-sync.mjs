#!/usr/bin/env node
// Pushes the [engine] block of secrets.env to the GitHub environment secret ENGINE_ENV (the VPS stack's .env).
// Usage: node scripts/env-sync.mjs            -> updates the secret (needs gh logged in)
//        node scripts/env-sync.mjs --check    -> only prints how many variables would be pushed
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const text = readFileSync(process.env.NIVO_SECRETS || join(repo, "secrets.env"), "utf8");
const block = [];
let inEngine = false;
for (const line of text.split(/\r?\n/)) {
  if (/^# -+ \[/.test(line)) inEngine = line.includes("[engine]");
  else if (inEngine && /^[A-Z0-9_]+=/.test(line)) block.push(line);
}
if (!block.length) throw new Error("no [engine] block found in secrets.env");
if (process.argv.includes("--check")) {
  console.log(`[env-sync] ${block.length} engine variables ready (not pushed)`);
} else {
  execFileSync("gh", ["secret", "set", "ENGINE_ENV", "--env", "production", "--repo", "starci183/nivo-lite"], { input: block.join("\n") + "\n", stdio: ["pipe", "inherit", "inherit"] });
  console.log(`[env-sync] ENGINE_ENV updated (${block.length} variables). Re-run the "Deploy engine" workflow to apply.`);
}
