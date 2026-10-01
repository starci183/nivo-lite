#!/usr/bin/env node
// Imports resources/n8n-templates/<key>.json into the n8n container on the VPS (idempotent: upsert by workflow name, so a re-run replaces
// the workflow of the same name instead of adding a copy), activates each one, and restarts n8n only when something was imported
// (the CLI writes the database; a running n8n registers webhooks at start). No n8n user account is needed or created.
//
//   node scripts/with-secrets.mjs node scripts/n8n-sync.mjs            sync to the VPS over SSH (VPS_HOST, VPS_USER, VPS_SSH_KEY)
//   node scripts/with-secrets.mjs node scripts/n8n-sync.mjs --dry-run  show what would change
//   node scripts/n8n-sync.mjs --local                                  talk to a local docker container (N8N_CONTAINER, default nivo-engine-n8n-1)
//   --no-restart                                                       skip the restart (activation then waits for the next n8n start)
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const local = args.has("--local");
const container = process.env.N8N_CONTAINER || "nivo-engine-n8n-1";
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "resources", "n8n-templates");

const expand = (p) => (p && p.startsWith("~") ? join(homedir(), p.slice(1)) : p);

/** Run a shell command in the n8n host (VPS over SSH, or this machine with --local). Returns stdout; throws on a non-zero exit. */
const sh = (command, input) => {
  let cmd;
  let argv;
  if (local) {
    cmd = process.platform === "win32" ? "bash" : "sh";
    argv = ["-c", command];
  } else {
    const host = process.env.VPS_HOST;
    const user = process.env.VPS_USER || "nivo";
    const key = expand(process.env.VPS_SSH_KEY || "~/.nivo-lite/vps_ed25519");
    if (!host) throw new Error("VPS_HOST is not set (use with-secrets.mjs, or --local)");
    const known = join(homedir(), ".nivo-lite", "vps_known_hosts");
    cmd = "ssh";
    argv = ["-i", key, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", ...(existsSync(known) ? ["-o", `UserKnownHostsFile=${known}`] : []), `${user}@${host}`, command];
  }
  const r = spawnSync(cmd, argv, { input, encoding: "utf8", maxBuffer: 20_000_000 });
  if (r.status !== 0) throw new Error(`${command.slice(0, 80)} failed (${r.status}): ${(r.stderr || r.stdout || "").slice(0, 400)}`);
  return r.stdout;
};

const files = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(".meta.json")).sort();
if (!files.length) throw new Error(`no workflows in ${dir}`);
const workflows = files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
for (const w of workflows) if (!w.name || !Array.isArray(w.nodes)) throw new Error(`a workflow in ${dir} has no name or nodes`);

// Existing workflows by name ("<id>|<name>" per line).
const listed = sh(`docker exec ${container} n8n list:workflow`).split("\n").map((l) => l.trim()).filter((l) => l.includes("|"));
const byName = new Map(listed.map((l) => { const i = l.indexOf("|"); return [l.slice(i + 1), l.slice(0, i)]; }));

const plan = workflows.map((w) => ({ w, id: byName.get(w.name) ?? null }));
for (const p of plan) console.log(`${p.id ? "update" : "create"}  ${p.w.name}${p.id ? `  (id ${p.id})` : ""}`);
if (dryRun) process.exit(0);

// One import call with every workflow, ids set so that an existing one is replaced.
const payload = JSON.stringify(plan.map(({ w, id }) => ({ ...w, ...(id ? { id } : {}), active: false })));
sh(`cat > /tmp/nivo-n8n-templates.json && docker cp /tmp/nivo-n8n-templates.json ${container}:/tmp/nivo-n8n-templates.json && rm /tmp/nivo-n8n-templates.json && docker exec ${container} n8n import:workflow --input=/tmp/nivo-n8n-templates.json`, payload);

// Activate (the import leaves them inactive), then restart n8n once so the production webhooks are registered.
const after = sh(`docker exec ${container} n8n list:workflow`).split("\n").map((l) => l.trim()).filter((l) => l.includes("|"));
const ids = new Map(after.map((l) => { const i = l.indexOf("|"); return [l.slice(i + 1), l.slice(0, i)]; }));
for (const { w } of plan) {
  const id = ids.get(w.name);
  if (!id) throw new Error(`workflow ${w.name} is missing after the import`);
  sh(`docker exec ${container} n8n update:workflow --id=${id} --active=true`);
  console.log(`active  ${w.name}  (id ${id})`);
}
if (!args.has("--no-restart")) {
  sh(`docker restart ${container}`);
  console.log("n8n restarted");
}
console.log("done");
