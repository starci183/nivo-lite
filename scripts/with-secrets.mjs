#!/usr/bin/env node
// Runs a command with the secrets loaded from the ONE secrets file: <repo>/secrets.env (gitignored).
// Override with NIVO_SECRETS=<path>. KEY=VALUE per line; comments and section headers are ignored.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.env.NIVO_SECRETS || join(repo, "secrets.env");
if (!existsSync(file)) {
  console.error(`[with-secrets] missing ${file}: copy secrets.example.env to secrets.env and fill it in.`);
  process.exit(1);
}
const env = { ...process.env };
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const [cmd, ...args] = process.argv.slice(2);
const child = spawn(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 1));
