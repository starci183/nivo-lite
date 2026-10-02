#!/usr/bin/env node
// Mirrors the module registry (resources/modules/<key>/module.json) into public.modules and public.authority_actions (upsert by key / action, service role).
// Run: npm run seed:modules   (secrets come from secrets.env through with-secrets.mjs). Run it after db push whenever a module.json changed.
// It never deletes: a module or action that is still referenced by workspaces must not disappear; stale rows are only reported.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "resources", "modules");
const dirs = readdirSync(root).filter((n) => !n.startsWith("_") && statSync(join(root, n)).isDirectory());
const mods = dirs.map((d) => JSON.parse(readFileSync(join(root, d, "module.json"), "utf8"))).sort((a, b) => a.order - b.order);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run through scripts/with-secrets.mjs)"); process.exit(1); }
const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

const now = new Date().toISOString();
const moduleRows = mods.map((m) => ({
  key: m.key, sort_order: m.order, status: m.status, category: m.category, audience: m.audience, knowledge_folder: m.knowledge_folder,
  workbench: m.workbench, default_operating_mode: m.default_operating_mode, definition: m, updated_at: now,
}));
const actionRows = mods.flatMap((m) => m.authority_actions.map((a, i) => ({
  action: a.action, module_key: m.key, sort_order: i, default_mode: a.mode, default_limit_vnd: a.limit_vnd, default_required_fields: a.required_fields,
  amount_limit: !!a.amount_limit, max_mode: a.max_mode ?? null, label: a.label,
})));

const m1 = await db.from("modules").upsert(moduleRows, { onConflict: "key" });
if (m1.error) { console.error("modules upsert failed:", m1.error.message); process.exit(1); }
const a1 = await db.from("authority_actions").upsert(actionRows, { onConflict: "action" });
if (a1.error) { console.error("authority_actions upsert failed:", a1.error.message); process.exit(1); }

const keys = new Set(mods.map((m) => m.key));
const actions = new Set(actionRows.map((a) => a.action));
const have = await db.from("modules").select("key");
const haveActions = await db.from("authority_actions").select("action");
const staleModules = (have.data ?? []).map((r) => r.key).filter((k) => !keys.has(k));
const staleActions = (haveActions.data ?? []).map((r) => r.action).filter((k) => !actions.has(k));
console.log(`seeded ${moduleRows.length} modules and ${actionRows.length} authority actions`, staleModules.length || staleActions.length ? { staleModules, staleActions } : "");
