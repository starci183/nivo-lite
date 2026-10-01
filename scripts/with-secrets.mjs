#!/usr/bin/env node
// Runs a command with the prototype's local secrets loaded from a file OUTSIDE the repository.
// File: $NIVO_PROTOTYPE_SECRETS (or ~/.nivo-prototype/secrets.env), KEY=VALUE per line.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const file = process.env.NIVO_PROTOTYPE_SECRETS || join(homedir(), ".nivo-prototype", "secrets.env");
if (!existsSync(file)) {
  console.error(`[with-secrets] missing ${file} — copy secrets.example.env there and fill it in.`);
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
