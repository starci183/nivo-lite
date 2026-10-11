#!/usr/bin/env node
// Deletes every workspace except the ones kept (default: NIVO), with everything that hangs off them (the schema cascades;
// platform_audit and app_errors keep their rows with the workspace link cleared). Sign-in accounts are NOT deleted.
// Lists first and deletes only after you type the confirmation word. Permanent: there is no undo.
//   node scripts/with-secrets.mjs node scripts/prune-workspaces.mjs [--keep <workspaceId>]... [--no-default]
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";

const NIVO = "403f4a6e-306a-4ad0-9363-d304da760d50";
// --no-default drops the built-in NIVO id (for a local database, where it does not exist); then at least one --keep is required.
const keep = new Set(process.argv.includes("--no-default") ? [] : [NIVO]);
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === "--keep" && process.argv[i + 1]) keep.add(process.argv[++i]);

if (keep.size === 0) { console.error("Nothing to keep: pass --keep <workspaceId>."); process.exit(1); }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run through scripts/with-secrets.mjs)"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await db.from("workspaces").select("id, name, plan_code, status, created_at").order("created_at");
if (error) { console.error(error.message); process.exit(1); }
const kept = data.filter((w) => keep.has(w.id));
const doomed = data.filter((w) => !keep.has(w.id));
console.log(`Project ${new URL(url).host}`);
console.log("KEEP:");
for (const w of kept) console.log(`  ${w.name}  (${w.plan_code ?? "no plan"})  ${w.id}`);
if (kept.length !== keep.size) { console.error("A workspace to keep was not found. Nothing deleted."); process.exit(1); }
console.log(`DELETE (${doomed.length}):`);
for (const w of doomed) console.log(`  ${w.name}  (${w.plan_code ?? "no plan"}, ${w.status})  ${w.id}`);
if (doomed.length === 0) { console.log("Nothing to delete."); process.exit(0); }

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question(`Type XOA to permanently delete these ${doomed.length} workspaces: `)).trim();
rl.close();
if (answer !== "XOA") { console.log("Cancelled. Nothing deleted."); process.exit(0); }

let failed = 0;
for (const w of doomed) {
  const r = await db.from("workspaces").delete().eq("id", w.id);
  if (r.error) { failed++; console.error(`  FAILED ${w.name}: ${r.error.message}`); } else console.log(`  deleted ${w.name}`);
}
const left = (await db.from("workspaces").select("id", { count: "exact", head: true })).count;
console.log(`Done. ${doomed.length - failed} deleted, ${failed} failed, ${left} workspace(s) left.`);
process.exit(failed ? 1 : 0);
