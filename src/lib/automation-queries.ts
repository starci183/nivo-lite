import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { googleCardFromRow } from "./google";
import { ACTION_DEPARTMENT, applyOperatingMode } from "./policy";
import { listModules } from "./module-registry";
import { minutesToHhmm, parseHours } from "./automation-hours";
import {
  RUN_STATUS, TRUST_THRESHOLD, isTemplateKey, resolveConfig,
  type AutomationCardView, type AutomationRunStatus, type AutomationRunView, type Capability, type ConnectionNeed, type Missing, type ModuleScope, type RunStep, type ShopContext, type TemplateDef, type TemplateKey,
} from "./automation-shared";
import { TEMPLATES, TEMPLATE_LIST } from "./automation-templates";
import type { FlowAction } from "./flow-types";

type Db = SupabaseClient;

export type PipelineRow = {
  id: string; workspace_id: string; template_key: string; name: string; module_key: ModuleScope | null; enabled: boolean; dismissed: boolean;
  config: Record<string, unknown>; body: string | null; body_version: number; template_version: number; based_on_context: number | null;
  approval_streak: number; trust_offered_at: string | null; auto_send: boolean; created_at: string; updated_at: string;
};

/* ------------------------------------------------------------------ the shop's context */

type Snapshot = { summary?: string; facts?: Array<{ text: string }>; gates?: Record<string, { evidence?: string }> };

type ActiveContexts = { installed: Array<ModuleScope>; versions: Partial<Record<ModuleScope, number>>; text: string; hoursText: string; operatingModes: Partial<Record<ModuleScope, string | null>> };

/** The active context versions of the workspace's installed modules: version number and all of its text. One request (the version rows are embedded). */
const activeContexts = async (db: Db, ws: string): Promise<ActiveContexts> => {
  const { data } = await db.from("module_installations").select(INSTALLATION_CONTEXT_SELECT).eq("workspace_id", ws).order("created_at");
  return contextsFrom((data ?? []) as unknown as Array<InstallationContextRow>);
};

type InstallationContextRow = { module_key: ModuleScope; operating_mode: string | null; ctx: { id: string; version: number; snapshot: Snapshot } | Array<{ id: string; version: number; snapshot: Snapshot }> | null };
const INSTALLATION_CONTEXT_SELECT = "module_key, operating_mode, ctx:module_context_versions!active_context_version_id(id, version, snapshot)";

/** The active contexts from installation rows already read (each with its active version embedded). */
const contextsFrom = (inst: ReadonlyArray<InstallationContextRow>): ActiveContexts => {
  const versions: Partial<Record<ModuleScope, number>> = {};
  const operatingModes: Partial<Record<ModuleScope, string | null>> = {};
  const parts: Array<string> = [];
  let hoursText = "";
  for (const i of inst) {
    if (!(i.module_key in operatingModes)) operatingModes[i.module_key] = i.operating_mode;
    const r = Array.isArray(i.ctx) ? i.ctx[0] : i.ctx;
    if (!r) continue;
    versions[i.module_key] = r.version;
    const s = r.snapshot ?? {};
    parts.push(s.summary ?? "", ...(s.facts ?? []).map((f) => f.text), ...Object.values(s.gates ?? {}).map((g) => g.evidence ?? ""));
    if (s.gates?.hours_sla?.evidence && !hoursText) hoursText = s.gates.hours_sla.evidence;
  }
  return { installed: inst.map((i) => i.module_key), versions, text: parts.join("\n"), hoursText, operatingModes };
};

/** The active context of the workspace as one text plus the version a template of `moduleKey` (null = workspace) is written from. */
export const loadContextFor = async (db: Db, ws: string, moduleKey: ModuleScope | null): Promise<{ text: string; version: number | null }> => {
  const ctx = await activeContexts(db, ws);
  const own = moduleKey ? (ctx.versions[moduleKey] ?? null) : (Object.values(ctx.versions).length ? Math.max(...Object.values(ctx.versions)) : null);
  return { text: ctx.text, version: own };
};

/** The shop's real context: name, opening hours (from the active chatbot context when it states them) and tone. Works with any client. */
export const loadShopContext = async (db: Db, ws: string, known?: ActiveContexts | Promise<ActiveContexts>): Promise<ShopContext & { readonly hoursRange: { from: number; to: number } | null }> => {
  const [workspace, authority, ctx] = await Promise.all([
    db.from("workspaces").select("name").eq("id", ws).maybeSingle(),
    db.from("authority").select("reply_style, brand_voice").eq("workspace_id", ws).maybeSingle(),
    known ?? activeContexts(db, ws),
  ]);
  return shopContextFrom((workspace.data as { name?: string } | null)?.name ?? null, authority.data as { reply_style?: string; brand_voice?: string } | null, ctx);
};

/** The shop context from rows already read. */
const shopContextFrom = (name: string | null, a: { reply_style?: string; brand_voice?: string } | null, ctx: ActiveContexts): ShopContext & { readonly hoursRange: { from: number; to: number } | null } => {
  const range = parseHours(ctx.hoursText) ?? parseHours(ctx.text.split("\n").find((l) => /giờ (làm việc|mở cửa)|mở cửa|opening hours|business hours/i.test(l) && parseHours(l)) ?? "");
  return {
    shop: name ?? "shop",
    hours: range ? `${minutesToHhmm(range.from)} - ${minutesToHhmm(range.to)}` : "",
    tone: (a?.brand_voice || a?.reply_style || "").trim(),
    hoursRange: range,
  };
};

const CAPABILITY_PATTERNS: Readonly<Record<Exclude<Capability, "has_opening_hours" | "has_due_dates">, RegExp>> = {
  has_deposits: /đặt cọc|tiền cọc|cọc trước|deposit/i,
  has_appointments: /đặt lịch|lịch hẹn|hẹn lịch|appointment|booking/i,
  sells_online: /shopee|lazada|tiktok ?shop|tiki\b|sàn thương mại/i,
  has_recurring_contracts: /hợp đồng|gia hạn|định kỳ|subscription|thuê bao/i,
  has_delivery: /giao hàng|vận chuyển|giao tận nơi|\bship\b|freight/i,
};
const DUE_PATTERN = /hạn thanh toán|thanh toán sau|công nợ|trả chậm|payment terms|net ?\d+|\d+ ngày.{0,20}thanh toán|thanh toán.{0,20}\d+ ngày/i;

/** True when some sentence of the text says the shop HAS the thing: a sentence that negates it ("Không có lịch hẹn") does not count. */
const NEGATION = /(không|chưa|chẳng|\bko\b|\bno\b|without)/i;
const affirms = (text: string, re: RegExp): boolean => text.split(/[\n.;]/).some((line) => re.test(line) && !NEGATION.test(line));

/** What the shop has, derived from its active contexts, its knowledge and its data (never asked directly). */
export const loadCapabilities = async (db: Db, ws: string, known?: ActiveContexts | Promise<ActiveContexts>): Promise<ReadonlySet<Capability>> => {
  const [ctx, knowledge, dueInvoices] = await Promise.all([
    known ?? activeContexts(db, ws),
    db.from("knowledge_sources").select("title, content").eq("workspace_id", ws).limit(60),
    db.from("invoices").select("id", { count: "exact", head: true }).eq("workspace_id", ws).not("due_at", "is", null),
  ]);
  return capabilitiesFrom(ctx, (knowledge.data ?? []) as Array<{ title: string; content: string }>, dueInvoices.count ?? 0);
};

/** The capabilities from rows already read: the active contexts, the knowledge sources and how many invoices carry a due date. */
const capabilitiesFrom = (ctx: ActiveContexts, knowledge: ReadonlyArray<{ title: string; content: string }>, dueInvoices: number): ReadonlySet<Capability> => {
  const text = [ctx.text, ...knowledge.map((k) => `${k.title}\n${k.content.slice(0, 3000)}`)].join("\n");
  const has = new Set<Capability>();
  for (const [cap, re] of Object.entries(CAPABILITY_PATTERNS)) if (affirms(text, re)) has.add(cap as Capability);
  if (ctx.installed.includes("booking")) has.add("has_appointments"); // the booking module IS the capability
  if (affirms(text, DUE_PATTERN) || dueInvoices > 0) has.add("has_due_dates");
  if (parseHours(ctx.hoursText) || text.split("\n").some((l) => /giờ (làm việc|mở cửa)|mở cửa|opening hours|business hours/i.test(l) && parseHours(l))) has.add("has_opening_hours");
  return has;
};

/** The owner's current mode for a gate action, with the department's operating mode applied (assist turns auto into ask). */
export const gateModeFor = async (db: Db, ws: string, action: FlowAction): Promise<"auto" | "ask" | "never"> => {
  const rule = (await db.from("authority_rules").select("mode").eq("workspace_id", ws).eq("action", action).maybeSingle()).data as { mode: "auto" | "ask" | "never" } | null;
  if (!rule) return "never";
  const inst = await db.from("module_installations").select("operating_mode").eq("workspace_id", ws).eq("module_key", ACTION_DEPARTMENT[action]).limit(1);
  return applyOperatingMode(rule, ((inst.data ?? [])[0] as { operating_mode?: string } | undefined)?.operating_mode)?.mode ?? "never";
};

/* ------------------------------------------------------------------ applicability */

const MODULE_LABEL: Readonly<Record<ModuleScope, { vi: string; en: string }>> = Object.fromEntries(listModules().map((m) => [m.key, { vi: m.name.vi, en: m.name.en }])) as Record<ModuleScope, { vi: string; en: string }>;
const CONNECTION_LABEL: Readonly<Record<ConnectionNeed, { vi: string; en: string }>> = {
  google: { vi: "kết nối Google", en: "a Google connection" },
  webhook: { vi: "kết nối n8n / webhook", en: "an n8n / webhook connection" },
  smtp: { vi: "Email gửi đi", en: "outgoing email" },
};
const CAPABILITY_LABEL: Readonly<Record<Capability, { vi: string; en: string }>> = {
  has_opening_hours: { vi: "giờ mở cửa trong thông tin cửa hàng", en: "opening hours in the shop information" },
  has_deposits: { vi: "chính sách đặt cọc", en: "a deposit policy" },
  has_due_dates: { vi: "hạn thanh toán (công nợ)", en: "payment terms" },
  has_appointments: { vi: "đặt lịch hẹn", en: "appointments" },
  sells_online: { vi: "bán trên sàn thương mại điện tử", en: "online marketplace sales" },
  has_recurring_contracts: { vi: "hợp đồng định kỳ", en: "recurring contracts" },
  has_delivery: { vi: "giao hàng", en: "delivery" },
};

type Facts = {
  installed: ReadonlyArray<ModuleScope>; capabilities: ReadonlySet<Capability>; hasChat: boolean;
  connections: ReadonlyArray<{ provider: string; status: string }>;
};

const loadFacts = async (db: Db, ws: string, known: ActiveContexts | Promise<ActiveContexts>): Promise<Facts> => {
  const [ctx, caps, conns, chatbot] = await Promise.all([
    known, loadCapabilities(db, ws, known),
    db.from("connections").select("provider, status").eq("workspace_id", ws).neq("status", "disconnected"),
    db.from("agents").select("id", { count: "exact", head: true }).eq("workspace_id", ws).in("module", ["chatbot", "booking"]).eq("status", "active"),
  ]);
  return factsFrom(ctx, caps, (conns.data ?? []) as Array<{ provider: string; status: string }>, chatbot.count ?? 0);
};

/** The facts templates are checked against, from rows already read. `chatAgents` = active chatbot / booking agents. */
const factsFrom = (ctx: ActiveContexts, caps: ReadonlySet<Capability>, connections: ReadonlyArray<{ provider: string; status: string }>, chatAgents: number): Facts => ({
  installed: ctx.installed, capabilities: caps, connections,
  hasChat: chatAgents > 0 || connections.some((c) => (c.provider === "telegram" || c.provider === "zalo_oa") && c.status !== "pending"),
});

/** Which requirements of a template the shop does not meet yet. */
export const missingFor = (def: TemplateDef, f: Facts): Array<Missing> => {
  const out: Array<Missing> = [];
  for (const m of def.requires.modules) if (!f.installed.includes(m)) out.push({ kind: "module", key: m, label: { vi: `module ${MODULE_LABEL[m].vi}`, en: `the ${MODULE_LABEL[m].en} module` }, href: `/modules/new?module=${m}` });
  for (const c of def.requires.channels) if (c === "customer_chat" && !f.hasChat) out.push({ kind: "channel", key: c, label: { vi: "một kênh chat với khách (website, Telegram hoặc Zalo)", en: "a customer chat channel (website, Telegram or Zalo)" }, href: "/connections" });
  for (const c of def.requires.connections) if (!f.connections.some((x) => x.provider === c)) out.push({ kind: "connection", key: c, label: CONNECTION_LABEL[c], href: c === "webhook" ? "/developers" : c === "smtp" ? "/connections?connect=smtp" : "/connections" });
  for (const cap of def.requires.capabilities) if (!f.capabilities.has(cap)) out.push({ kind: "capability", key: cap, label: CAPABILITY_LABEL[cap], href: "/knowledge" });
  return out;
};

/* ------------------------------------------------------------------ runs */

type RunRow = {
  id: string; pipeline_id: string; trigger_ref: string; status: AutomationRunStatus; steps: Array<RunStep & { workItemId?: string; message?: string }>; evidence: string | null;
  error: string | null; created_at: string; finished_at: string | null;
};

const RUN_COLUMNS = "id, pipeline_id, trigger_ref, status, steps, evidence, error, created_at, finished_at";

const summaryOf = (steps: ReadonlyArray<RunStep>, status: AutomationRunStatus): string => {
  const last = [...steps].reverse().find((s) => s.detail) ?? steps.at(-1);
  return last ? [last.label, last.detail].filter(Boolean).join(": ") : status;
};

export const toRunView = (r: RunRow, templateKey: TemplateKey): AutomationRunView => ({
  id: r.id, pipelineId: r.pipeline_id, templateKey, status: RUN_STATUS.includes(r.status) ? r.status : "failed", triggerRef: r.trigger_ref,
  summary: summaryOf(r.steps ?? [], r.status), steps: (r.steps ?? []).map(({ label, status, detail }) => ({ label, status, detail })),
  evidence: r.evidence, error: r.error, createdAt: r.created_at, finishedAt: r.finished_at,
  workItemId: (r.steps ?? []).find((s) => s.workItemId)?.workItemId ?? null,
  message: (r.steps ?? []).find((s) => s.message)?.message ?? null,
});

/** The latest runs of a workspace (optionally one template), newest first. */
export const loadRuns = async (db: Db, ws: string, opts: { readonly templateKey?: TemplateKey; readonly limit?: number } = {}): Promise<Array<AutomationRunView>> => {
  const pipelines = ((await db.from("automation_pipelines").select("id, template_key").eq("workspace_id", ws)).data ?? []) as Array<{ id: string; template_key: string }>;
  return runsOf(db, ws, pipelines, opts);
};

/** Runs for already-loaded pipelines (loadAutomations fetches both in the same wave and calls `runViews` itself). */
const runsOf = async (db: Db, ws: string, pipelines: ReadonlyArray<{ id: string; template_key: string }>, opts: { readonly templateKey?: TemplateKey; readonly limit?: number }): Promise<Array<AutomationRunView>> => {
  const keyOf = new Map(pipelines.filter((p) => isTemplateKey(p.template_key)).map((p) => [p.id, p.template_key]));
  let q = db.from("automation_runs").select(RUN_COLUMNS).eq("workspace_id", ws).order("created_at", { ascending: false }).limit(opts.limit ?? 30);
  if (opts.templateKey) {
    const id = [...keyOf].find(([, k]) => k === opts.templateKey)?.[0];
    if (!id) return [];
    q = q.eq("pipeline_id", id);
  }
  return ((await q).data ?? []).flatMap((r) => {
    const key = keyOf.get((r as RunRow).pipeline_id);
    return key ? [toRunView(r as RunRow, key)] : [];
  });
};

/* ------------------------------------------------------------------ the screen */

/** The context version a template's body is written from: its module's active version, or (workspace scope) the highest of the installed modules. */
const contextVersionFor = (def: TemplateDef, versions: Partial<Record<ModuleScope, number>>): number | null =>
  def.moduleKey ? (versions[def.moduleKey] ?? null) : (Object.values(versions).length ? Math.max(...Object.values(versions)) : null);

/** Every row the automations screen reads, as `automations_data` returns them. */
type AutomationsRaw = {
  installations: Array<InstallationContextRow>; pipelines: Array<PipelineRow>; runs: Array<RunRow>;
  google: { status: "pending" | "connected" | "error" | "disconnected"; last_error: string | null; public_meta: Record<string, string> | null } | null;
  knowledge: Array<{ title: string; content: string }>; due_invoices: number; connections: Array<{ provider: string; status: string }>; chat_agents: number;
  workspace_name: string | null; authority: { reply_style?: string; brand_voice?: string } | null; rules: Array<{ action: string; mode: "auto" | "ask" | "never" }>;
};

const automationsRaw = async (db: Db, ws: string): Promise<AutomationsRaw> => {
  const viaRpc = await db.rpc("automations_data", { ws });
  if (!viaRpc.error && viaRpc.data) return viaRpc.data as AutomationsRaw;
  console.error("automations_data failed, reading the screen one table at a time:", viaRpc.error?.message ?? "empty");
  const [inst, pipelines, runs, google, knowledge, due, conns, chat, workspace, authority, rules] = await Promise.all([
    db.from("module_installations").select(INSTALLATION_CONTEXT_SELECT).eq("workspace_id", ws).order("created_at"),
    db.from("automation_pipelines").select("*").eq("workspace_id", ws),
    db.from("automation_runs").select(RUN_COLUMNS).eq("workspace_id", ws).order("created_at", { ascending: false }).limit(80),
    db.from("connections").select("id, status, last_error, public_meta, name").eq("workspace_id", ws).eq("provider", "google").neq("status", "disconnected").order("created_at").limit(1),
    db.from("knowledge_sources").select("title, content").eq("workspace_id", ws).limit(60),
    db.from("invoices").select("id", { count: "exact", head: true }).eq("workspace_id", ws).not("due_at", "is", null),
    db.from("connections").select("provider, status").eq("workspace_id", ws).neq("status", "disconnected"),
    db.from("agents").select("id", { count: "exact", head: true }).eq("workspace_id", ws).in("module", ["chatbot", "booking"]).eq("status", "active"),
    db.from("workspaces").select("name").eq("id", ws).maybeSingle(),
    db.from("authority").select("reply_style, brand_voice").eq("workspace_id", ws).maybeSingle(),
    db.from("authority_rules").select("action, mode").eq("workspace_id", ws),
  ]);
  return {
    installations: (inst.data ?? []) as unknown as Array<InstallationContextRow>, pipelines: (pipelines.data ?? []) as Array<PipelineRow>, runs: (runs.data ?? []) as Array<RunRow>,
    google: ((google.data ?? [])[0] as AutomationsRaw["google"] | undefined) ?? null, knowledge: (knowledge.data ?? []) as AutomationsRaw["knowledge"], due_invoices: due.count ?? 0,
    connections: (conns.data ?? []) as AutomationsRaw["connections"], chat_agents: chat.count ?? 0, workspace_name: (workspace.data as { name?: string } | null)?.name ?? null,
    authority: authority.data as AutomationsRaw["authority"], rules: (rules.data ?? []) as AutomationsRaw["rules"],
  };
};

/** Everything the /automations screen (and a module's Settings section) needs: one card per template, the recent runs and the shop context for previews. */
export const loadAutomations = async (db: Db, ws: string): Promise<{ cards: Array<AutomationCardView>; runs: Array<AutomationRunView>; shop: ShopContext }> => {
  // ONE request (SQL function automations_data) returns every row below; the separate reads are the fallback.
  const raw = await automationsRaw(db, ws);
  const ctx = contextsFrom(raw.installations);
  const shopFull = shopContextFrom(raw.workspace_name, raw.authority, ctx);
  const facts = factsFrom(ctx, capabilitiesFrom(ctx, raw.knowledge, raw.due_invoices), raw.connections, raw.chat_agents);
  const google = googleCardFromRow(raw.google);
  const pipelines = { data: raw.pipelines };
  const runRows = { data: raw.runs };
  const rules = raw.rules;
  const gateFor = (action: FlowAction): "auto" | "ask" | "never" => {
    const rule = rules.find((r) => r.action === action) ?? null;
    if (!rule) return "never";
    return applyOperatingMode(rule, ctx.operatingModes[ACTION_DEPARTMENT[action] as ModuleScope])?.mode ?? "never";
  };
  const keyOf = new Map(((pipelines.data ?? []) as Array<PipelineRow>).filter((p) => isTemplateKey(p.template_key)).map((p) => [p.id, p.template_key]));
  const runs = ((runRows.data ?? []) as Array<RunRow>).flatMap((r) => {
    const key = keyOf.get(r.pipeline_id);
    return key ? [toRunView(r, key)] : [];
  });
  const rows = new Map(((pipelines.data ?? []) as Array<PipelineRow>).map((p) => [p.template_key, p]));
  const cards = TEMPLATE_LIST.map((def): AutomationCardView => {
    const row = rows.get(def.key);
    const mine = runs.filter((r) => r.templateKey === def.key);
    const config = resolveConfig(def, row?.config);
    const missing = missingFor(def, facts).map((m) => (m.kind === "connection" && m.key === "google" && google.state === "unavailable" ? m : m));
    const currentContext = contextVersionFor(def, ctx.versions);
    const gated = def.pack !== "core" && missing.some((m) => m.kind === "capability");
    return {
      key: def.key, def, pipelineId: row?.id ?? null, enabled: row?.enabled ?? false, dismissed: row?.dismissed ?? false, config,
      body: row?.body ?? null, bodyVersion: row?.body_version ?? 0, basedOnContext: row?.based_on_context ?? null, currentContext,
      bodyStale: Boolean(row?.body) && row?.based_on_context !== null && row?.based_on_context !== undefined && currentContext !== null && row.based_on_context !== currentContext,
      gate: def.authority.alwaysAsk ? "ask" : def.authority.action ? gateFor(def.authority.action) : null,
      missing, proposed: !gated, comingSoon: def.executor === "definition",
      lastRunAt: mine[0]?.createdAt ?? null, runCount: mine.length,
      trust: { streak: row?.approval_streak ?? 0, offered: Boolean(row?.trust_offered_at) && !(row?.auto_send), autoSend: row?.auto_send ?? false },
      ...(def.requires.connections.includes("google") ? { google: google.state, sheetUrl: google.sheetUrl ?? (typeof config.sheetUrl === "string" ? config.sheetUrl : null) } : {}),
    };
  });
  const { shop, hours, tone } = shopFull;
  return { cards, runs, shop: { shop, hours, tone } };
};

/**
 * Templates worth proposing for a module right after it is installed, or when its setup context shows a matching capability (a deposit policy suggests
 * the deposit pack). Never enables anything. `moduleKey: null` = the workspace-wide ones. Hook for the setup chat (src/lib/module-setup-ai.ts, owned by another lane):
 * after the context is applied, call this and show the keys as suggestions linking to /automations?focus=<key>.
 */
export const suggestAutomationsFor = async (db: Db, ws: string, moduleKey: ModuleScope | null): Promise<Array<{ key: TemplateKey; name: TemplateDef["name"]; reason: TemplateDef["description"] }>> => {
  const { cards } = await loadAutomations(db, ws);
  return cards
    .filter((c) => c.def.moduleKey === moduleKey && c.proposed && !c.comingSoon && !c.enabled && !c.dismissed && c.missing.length === 0)
    .map((c) => ({ key: c.key, name: c.def.name, reason: c.def.description }));
};

export const TRUST_AFTER = TRUST_THRESHOLD;
export const definitionOf = (key: string): TemplateDef | null => TEMPLATES[key] ?? null;
