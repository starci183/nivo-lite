#!/usr/bin/env node
// Mirrors the automation catalogue resources/automation-templates/<key>.json into public.automation_templates (upsert by key, service role).
// The app itself loads the same JSON files at build time; the table lets the database and reports know the catalogue and its versions.
// Run: npm run seed:automations   (secrets come from ~/.nivo-lite/secrets.env through with-secrets.mjs)
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "resources", "automation-templates");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("[seed:automations] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (run through scripts/with-secrets.mjs).");
  process.exit(1);
}

// Module keys come from the registry (resources/modules/<key>/module.json), not a hard-coded list.
const MODULES = readdirSync(resolve(dirname(fileURLToPath(import.meta.url)), "..", "resources", "modules"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const n8nRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "resources", "n8n-templates");
const files = [
  ...readdirSync(root).filter((f) => f.endsWith(".json")).map((f) => ({ dir: root, f, expected: f })),
  ...readdirSync(n8nRoot).filter((f) => f.endsWith(".meta.json")).map((f) => ({ dir: n8nRoot, f, expected: f.replace(/\.meta\.json$/, ".json").replace(/\.json$/, "") + ".json" })),
];
const rows = files.map(({ dir, f }) => {
  const d = JSON.parse(readFileSync(join(dir, f), "utf8"));
  if (f.replace(/(\.meta)?\.json$/, "") !== d.key) throw new Error(`${f}: key "${d.key}" must match the file name`);
  if (d.moduleKey !== null && !MODULES.includes(d.moduleKey)) throw new Error(`${f}: bad moduleKey ${d.moduleKey}`);
  for (const k of ["name", "description", "trigger", "requires", "settings", "contentMode", "guardrails", "variables", "authority", "defaults"]) {
    if (d[k] === undefined) throw new Error(`${f}: missing "${k}"`);
  }
  return { key: d.key, version: d.version ?? 1, module_key: d.moduleKey, pack: d.pack ?? "core", executor: d.executor ?? "implemented", definition: d, updated_at: new Date().toISOString() };
});

const db = createClient(url, key, { auth: { persistSession: false } });
const { error } = await db.from("automation_templates").upsert(rows, { onConflict: "key" });
if (error) {
  console.error("[seed:automations]", error.message);
  process.exit(1);
}
console.log(`[seed:automations] ${rows.length} templates synced: ${rows.map((r) => r.key).join(", ")}`);
