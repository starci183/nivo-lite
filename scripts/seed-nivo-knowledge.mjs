#!/usr/bin/env node
// Seeds NIVO base knowledge from resources/nivo-knowledge/<knowledge folder>/<slug>.md into public.nivo_knowledge (upsert by slug, service role).
// Run: npm run seed:knowledge   (secrets come from ~/.nivo-lite/secrets.env through with-secrets.mjs)
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "resources", "nivo-knowledge");
// The module folders come from the registry (resources/modules/<key>/module.json knowledge_folder); "core" is shared by every module.
const modulesDir = join(dirname(root), "modules");
const MODULES = ["core", ...readdirSync(modulesDir).filter((n) => !n.startsWith("_") && statSync(join(modulesDir, n)).isDirectory()).map((n) => JSON.parse(readFileSync(join(modulesDir, n, "module.json"), "utf8")).knowledge_folder)];
const KINDS = ["playbook", "authority", "escalation", "setup_checklist", "tone"];

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
});

const parse = (file) => {
  const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const meta = Object.fromEntries(m[1].split("\n").map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2].trim().replace(/^["']|["']$/g, "")]));
  const rel = relative(root, file).split(sep);
  const module = rel[0];
  const slug = basename(file, ".md");
  if (!MODULES.includes(module)) throw new Error(`${file}: unknown module folder "${module}"`);
  if (!KINDS.includes(meta.kind)) throw new Error(`${file}: bad kind "${meta.kind}"`);
  if (!meta.title) throw new Error(`${file}: missing title`);
  return { module, slug, title: meta.title, kind: meta.kind, version: Number(meta.version) || 1, body: m[2].trim() };
};

const embedAll = async (texts) => {
  const key = process.env.EMBEDDING_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const base = (process.env.EMBEDDING_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const model = process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small";
  const out = [];
  for (let i = 0; i < texts.length; i += 16) {
    const res = await fetch(`${base}/embeddings`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, input: texts.slice(i, i + 16).map((t) => t.slice(0, 8000)) }),
    });
    if (!res.ok) { console.error(`embeddings provider ${res.status}`); return null; }
    const j = await res.json();
    const rows = [...(j.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (rows.length !== Math.min(16, texts.length - i) || rows.some((r) => r.embedding?.length !== 1536)) { console.error("embeddings: unexpected shape"); return null; }
    out.push(...rows.map((r) => r.embedding));
  }
  return out;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run through scripts/with-secrets.mjs)"); process.exit(1); }
const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

const items = walk(root).sort().map(parse);
const slugs = new Set();
for (const i of items) { if (slugs.has(i.slug)) throw new Error(`duplicate slug ${i.slug}`); slugs.add(i.slug); }

const vectors = await embedAll(items.map((i) => `${i.title}\n\n${i.body}`));
const now = new Date().toISOString();
const rows = items.map((i, n) => ({ ...i, embedding: vectors ? `[${vectors[n].join(",")}]` : null, updated_at: now }));
const { error } = await db.from("nivo_knowledge").upsert(rows, { onConflict: "slug" });
if (error) { console.error("upsert failed:", error.message); process.exit(1); }

// Items that no longer exist in resources/ are removed so the database mirrors the folder.
const existing = await db.from("nivo_knowledge").select("id, slug");
const stale = (existing.data ?? []).filter((r) => !slugs.has(r.slug)).map((r) => r.id);
if (stale.length) await db.from("nivo_knowledge").delete().in("id", stale);

const byModule = {};
for (const i of items) byModule[i.module] = (byModule[i.module] ?? 0) + 1;
console.log(`seeded ${items.length} NIVO knowledge items`, byModule, `| embeddings: ${vectors ? "generated" : "NOT generated (no key or provider error); full-text only"}`, `| removed stale: ${stale.length}`);
