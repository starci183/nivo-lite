#!/usr/bin/env node
// Build-time module registry: reads resources/modules/<key>/module.json and writes src/lib/module-registry.generated.ts
// (typed, pure data, no runtime file reads, shared by client and server). Runs from postinstall, predev, prebuild and pretypecheck.
// Run by hand after editing a module.json:  npm run gen:modules
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modulesDir = join(root, "resources", "modules");
const knowledgeDir = join(root, "resources", "nivo-knowledge");
const out = join(root, "src", "lib", "module-registry.generated.ts");

const fail = (msg) => { console.error(`gen-module-registry: ${msg}`); process.exit(1); };
const readJson = (file) => { try { return JSON.parse(readFileSync(file, "utf8")); } catch (e) { return fail(`${file}: ${e.message}`); } };

const iconSrc = readFileSync(join(root, "src", "ui", "leaves", "Icon", "index.tsx"), "utf8");
const iconBlock = iconSrc.match(/export type IconName =([\s\S]*?);\r?\n/)?.[1] ?? "";
const ICONS = new Set([...iconBlock.matchAll(/"([A-Za-z0-9]+)"/g)].map((m) => m[1]));

const categories = readJson(join(modulesDir, "_categories.json"));
const categoryKeys = new Set(categories.map((c) => c.key));
const bilingual = (v, where) => { if (!v || typeof v.vi !== "string" || typeof v.en !== "string" || !v.vi || !v.en) fail(`${where}: needs non-empty vi and en`); };
const LOC = ["vi", "en"];

const dirs = readdirSync(modulesDir).filter((n) => !n.startsWith("_") && statSync(join(modulesDir, n)).isDirectory());
const defs = dirs.map((dir) => {
  const file = join(modulesDir, dir, "module.json");
  if (!existsSync(file)) fail(`${dir}: module.json missing`);
  const m = readJson(file);
  const at = `modules/${dir}/module.json`;
  if (m.key !== dir) fail(`${at}: key "${m.key}" must equal the folder name`);
  if (!/^[a-z][a-z0-9]{1,23}$/.test(m.key)) fail(`${at}: key must be short lowercase ASCII`);
  if (typeof m.order !== "number") fail(`${at}: order (number) is required`);
  for (const f of ["name", "short_name", "description"]) bilingual(m[f], `${at} ${f}`);
  for (const l of LOC) if (!Array.isArray(m.points?.[l]) || !m.points[l].length) fail(`${at}: points.${l} must be a non-empty array`);
  if (typeof m.purpose !== "string" || !m.purpose) fail(`${at}: purpose (English, one line for the setup prompt) is required`);
  if (!ICONS.has(m.icon)) fail(`${at}: icon "${m.icon}" is not an IconName of src/ui`);
  if (typeof m.glyph !== "string") fail(`${at}: glyph (svg path) is required`);
  if (!existsSync(join(root, "public", m.mascot))) fail(`${at}: mascot ${m.mascot} not found in public/`);
  if (!categoryKeys.has(m.category)) fail(`${at}: unknown category "${m.category}"`);
  if (!["stable", "early"].includes(m.status)) fail(`${at}: status must be stable | early`);
  if (!["customer", "internal"].includes(m.audience)) fail(`${at}: audience must be customer | internal`);
  if (!["assist", "autopilot"].includes(m.default_operating_mode)) fail(`${at}: default_operating_mode must be assist | autopilot`);
  if (!existsSync(join(knowledgeDir, m.knowledge_folder))) fail(`${at}: knowledge folder resources/nivo-knowledge/${m.knowledge_folder} not found`);
  if (m.workbench !== null && typeof m.workbench !== "string") fail(`${at}: workbench must be a string key or null`);
  if (m.settings_extras !== null && typeof m.settings_extras !== "string") fail(`${at}: settings_extras must be a string key or null`);
  if (!Array.isArray(m.requires?.capabilities) || !Array.isArray(m.requires?.connections)) fail(`${at}: requires.{capabilities,connections} must be arrays`);
  if (!Array.isArray(m.connection_providers)) fail(`${at}: connection_providers must be an array`);
  for (const f of ["summary", "capabilities", "role", "instructions"]) if (!m.agent?.[f]) fail(`${at}: agent.${f} is required`);
  if (!m.agent.name || !m.agent.handle) fail(`${at}: agent.name and agent.handle are required`);
  if (!Array.isArray(m.gates) || !m.gates.length) fail(`${at}: gates must be a non-empty array`);
  const gateKeys = new Set();
  for (const g of m.gates) {
    for (const f of ["key", "label_vi", "label_en", "hint_vi", "hint_en"]) if (typeof g[f] !== "string" || !g[f]) fail(`${at}: gate ${g.key ?? "?"} needs ${f}`);
    if (gateKeys.has(g.key)) fail(`${at}: duplicate gate ${g.key}`);
    gateKeys.add(g.key);
  }
  if (!Array.isArray(m.authority_actions) || !m.authority_actions.length) fail(`${at}: authority_actions must be a non-empty array`);
  for (const a of m.authority_actions) {
    if (!/^[a-z][a-z0-9_]{2,40}$/.test(a.action)) fail(`${at}: bad action key "${a.action}"`);
    bilingual(a.label, `${at} action ${a.action} label`);
    if (!["auto", "ask", "never"].includes(a.mode)) fail(`${at}: action ${a.action} mode`);
    if (a.limit_vnd !== null && typeof a.limit_vnd !== "number") fail(`${at}: action ${a.action} limit_vnd`);
    if (!Array.isArray(a.required_fields)) fail(`${at}: action ${a.action} required_fields`);
    if (a.max_mode !== undefined && !["ask", "never"].includes(a.max_mode)) fail(`${at}: action ${a.action} max_mode`);
  }
  return m;
}).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));

const seenActions = new Map();
for (const m of defs) for (const a of m.authority_actions) {
  if (seenActions.has(a.action)) fail(`action "${a.action}" is declared by both ${seenActions.get(a.action)} and ${m.key}`);
  seenActions.set(a.action, m.key);
}

for (const m of defs) for (const a of m.authority_actions) for (const n of a.next ?? []) if (!seenActions.has(n)) fail(`modules/${m.key}: action ${a.action} chains to unknown action ${n}`);

const norm = (m) => ({
  key: m.key, order: m.order, name: m.name, shortName: m.short_name, description: m.description, points: m.points, purpose: m.purpose,
  icon: m.icon, glyph: m.glyph, mascot: m.mascot, category: m.category, status: m.status, audience: m.audience,
  includedWithWorkspace: !!m.included_with_workspace, available: !!m.available,
  knowledgeFolder: m.knowledge_folder, workbench: m.workbench, settingsExtras: m.settings_extras,
  requires: m.requires, connectionProviders: m.connection_providers, defaultOperatingMode: m.default_operating_mode,
  agent: m.agent,
  gates: m.gates,
  authorityActions: m.authority_actions.map((a) => ({
    action: a.action, label: a.label, mode: a.mode, limitVnd: a.limit_vnd, requiredFields: a.required_fields,
    amountLimit: !!a.amount_limit, maxMode: a.max_mode ?? null, note: a.note ?? "", next: a.next ?? [],
  })),
});
const list = defs.map(norm);
const labels = { dept: { en: {}, vi: {} }, module: { en: {}, vi: {} }, action: { en: {}, vi: {} } };
for (const m of defs) for (const l of LOC) {
  labels.dept[l][`dept_${m.key}`] = m.short_name[l];
  labels.module[l][`module_${m.key}`] = m.name[l];
  for (const a of m.authority_actions) labels.action[l][`action_${a.action}`] = a.label[l];
}

const lit = (v) => JSON.stringify(v, null, 2);
const src = `// GENERATED by scripts/gen-module-registry.mjs from resources/modules/*/module.json. Do not edit; do not commit (gitignored).
// Regenerate with: npm run gen:modules   (it also runs in postinstall, predev, prebuild and pretypecheck)

export const MODULE_KEYS = ${JSON.stringify(list.map((m) => m.key))} as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const ACTION_KEYS = ${JSON.stringify([...seenActions.keys()])} as const;
export type ActionKey = (typeof ACTION_KEYS)[number];

export type Bilingual = { readonly vi: string; readonly en: string };
export type BilingualList = { readonly vi: ReadonlyArray<string>; readonly en: ReadonlyArray<string> };
export type ModuleStatus = "stable" | "early";
export type ModuleAudience = "customer" | "internal";
export type ModuleCategoryKey = ${categories.map((c) => JSON.stringify(c.key)).join(" | ")};
export type RegistryGate = { readonly key: string; readonly label_vi: string; readonly label_en: string; readonly hint_vi: string; readonly hint_en: string };
export type RegistryAction = {
  readonly action: ActionKey; readonly label: Bilingual; readonly mode: "auto" | "ask" | "never"; readonly limitVnd: number | null;
  readonly requiredFields: ReadonlyArray<string>; readonly amountLimit: boolean; readonly maxMode: "ask" | "never" | null; readonly note: string; readonly next: ReadonlyArray<ActionKey>;
};
export type ModuleDef = {
  readonly key: ModuleKey; readonly order: number; readonly name: Bilingual; readonly shortName: Bilingual; readonly description: Bilingual; readonly points: BilingualList; readonly purpose: string;
  readonly icon: string; readonly glyph: string; readonly mascot: string; readonly category: ModuleCategoryKey; readonly status: ModuleStatus; readonly audience: ModuleAudience;
  readonly includedWithWorkspace: boolean; readonly available: boolean; readonly knowledgeFolder: string;
  readonly workbench: string | null; readonly settingsExtras: string | null;
  readonly requires: { readonly capabilities: ReadonlyArray<string>; readonly connections: ReadonlyArray<string> };
  readonly connectionProviders: ReadonlyArray<string>; readonly defaultOperatingMode: "assist" | "autopilot";
  readonly agent: { readonly name: string; readonly handle: string; readonly summary: Bilingual; readonly capabilities: BilingualList; readonly role: Bilingual; readonly instructions: Bilingual };
  readonly gates: ReadonlyArray<RegistryGate>;
  readonly authorityActions: ReadonlyArray<RegistryAction>;
};
export type ModuleCategory = { readonly key: ModuleCategoryKey; readonly label: Bilingual };

export const MODULE_CATEGORIES: ReadonlyArray<ModuleCategory> = ${lit(categories)};

export const MODULE_REGISTRY: Readonly<Record<ModuleKey, ModuleDef>> = ${lit(Object.fromEntries(list.map((m) => [m.key, m])))} as Readonly<Record<ModuleKey, ModuleDef>>;

/** Labels of every module and action, shaped as dictionary entries so the i18n dictionaries can spread them (literal keys keep the dictionaries type-checked). */
export const REGISTRY_DEPT_LABELS = ${lit(labels.dept)} as const; // dept_<key>: "Sales AI"
export const REGISTRY_MODULE_LABELS = ${lit(labels.module)} as const; // module_<key>: "Bán hàng"
export const REGISTRY_ACTION_LABELS = ${lit(labels.action)} as const; // action_<action>: "Xuất hóa đơn"
`;
writeFileSync(out, src);
console.log(`gen-module-registry: ${list.length} modules, ${seenActions.size} actions -> src/lib/module-registry.generated.ts`);
