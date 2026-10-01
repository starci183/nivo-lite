import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveContext } from "../modules-core";
import { enqueueWorkspaceSync } from "../engine-queue";
import { gateEntry, MODULE_GATES, type ContextVersion, type ModuleKey } from "../modules-shared";
import { getSession } from "../session";
import { supabaseServer } from "../supabase/server";
import { chunkText } from "./chunk";
import { embedText, embedTexts, toVector } from "./embed";
import { withUsage } from "../usage";
import {
  KNOWLEDGE_SUGGESTIONS, MAX_SOURCE_CHARS, SOURCE_KINDS, suggestionTopic, suggestionsFor,
  type AddSourceInput, type Audience, type Citation, type KnowledgeChunk, type KnowledgeModule, type KnowledgeSource, type NivoItem, type NivoKind, type Passage, type Visibility,
} from "./shared";

export * from "./shared";

type Db = SupabaseClient;

type SourceRow = {
  id: string; workspace_id: string; module: ModuleKey | null; kind: KnowledgeSource["kind"]; topic: string | null; tags: Array<string> | null;
  visibility: Visibility; title: string; content: string; status: KnowledgeSource["status"]; error: string | null; chunk_count: number;
  created_by: string | null; created_at: string; updated_at: string;
};
const toSource = (r: SourceRow): KnowledgeSource => ({
  id: r.id, workspaceId: r.workspace_id, module: r.module, kind: r.kind, topic: r.topic, tags: r.tags ?? [], visibility: r.visibility, title: r.title,
  content: r.content, status: r.status, error: r.error, chunkCount: r.chunk_count, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
});
const fail = (error: { message: string } | null): void => { if (error) throw new Error(error.message); };

const ctx = async (): Promise<{ db: Db; ws: string; userId: string }> => {
  const session = await getSession();
  return { db: (await supabaseServer()) as unknown as Db, ws: session.workspace.id, userId: session.userId };
};

/* ------------------------------------------------------------------ business knowledge (workspace sources) */

/** Every source of the signed-in workspace, newest first, without the (long) content column's passages. */
export const listSources = async (): Promise<Array<KnowledgeSource>> => {
  const { db, ws } = await ctx();
  const { data, error } = await db.from("knowledge_sources").select("*").eq("workspace_id", ws).order("created_at", { ascending: false });
  fail(error);
  return ((data ?? []) as Array<SourceRow>).map(toSource);
};

export const getSource = async (id: string): Promise<{ source: KnowledgeSource; chunks: Array<KnowledgeChunk> } | null> => {
  const { db, ws } = await ctx();
  const { data, error } = await db.from("knowledge_sources").select("*").eq("workspace_id", ws).eq("id", id).maybeSingle();
  fail(error);
  if (!data) return null;
  const chunks = await db.from("knowledge_chunks").select("id, ord, content, embedding").eq("source_id", id).order("ord");
  fail(chunks.error);
  return {
    source: toSource(data as SourceRow),
    chunks: ((chunks.data ?? []) as Array<{ id: string; ord: number; content: string; embedding: unknown }>).map((c) => ({ id: c.id, ord: c.ord, content: c.content, hasEmbedding: c.embedding != null })),
  };
};

/** Topics already used in the workspace (the Thêm tri thức combobox suggests them). */
export const listTopics = async (): Promise<Array<string>> => {
  const { db, ws } = await ctx();
  const { data, error } = await db.from("knowledge_sources").select("topic").eq("workspace_id", ws).not("topic", "is", null);
  fail(error);
  return [...new Set(((data ?? []) as Array<{ topic: string }>).map((r) => r.topic.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
};

const cleanTags = (tags: ReadonlyArray<string> | undefined): Array<string> => [...new Set((tags ?? []).map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, 12);

/** Private/loopback hosts are never fetched for a URL source. */
const isPublicHost = (host: string): boolean =>
  !/^(localhost|0\.0\.0\.0|\[?::1\]?)$/i.test(host) && !/\.(local|internal|localhost)$/i.test(host) &&
  !/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);

const htmlToText = (html: string): string =>
  html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();

/** The text of a web page (http/https, public hosts, 10 seconds, 1 MB). */
export const fetchUrlText = async (raw: string): Promise<string> => {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new Error("Link không hợp lệ."); }
  if (!/^https?:$/.test(url.protocol) || !isPublicHost(url.hostname)) throw new Error("Chỉ lấy được liên kết công khai (http/https).");
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "NIVO-OS-Knowledge/1.0" }, redirect: "follow" });
  if (!res.ok) throw new Error(`Không mở được liên kết (${res.status}).`);
  const type = res.headers.get("content-type") ?? "";
  const body = (await res.text()).slice(0, 1_000_000);
  return (type.includes("html") ? htmlToText(body) : body).slice(0, MAX_SOURCE_CHARS);
};

/** Add a source and index it (chunk, embed, store). The row exists even when indexing fails (status failed + reason). */
export const addSource = async (input: AddSourceInput): Promise<KnowledgeSource> => {
  const { db, ws, userId } = await ctx();
  return addSourceFor(db, ws, userId, input);
};

/** The same with an explicit client and workspace (the public API, which has no session). `userId` null = added by an API key. */
export const addSourceFor = async (db: Db, ws: string, userId: string | null, input: AddSourceInput): Promise<KnowledgeSource> => {
  if (!SOURCE_KINDS.includes(input.kind)) throw new Error("Unknown kind");
  const title = input.title.trim().slice(0, 160);
  let content = input.content.trim();
  if (!title) throw new Error("Cần đặt tên cho nguồn tri thức.");
  if (input.kind === "url") content = await fetchUrlText(input.content);
  if (!content) throw new Error("Nội dung đang trống.");
  if (content.length > MAX_SOURCE_CHARS) throw new Error(`Nội dung dài quá ${MAX_SOURCE_CHARS.toLocaleString("vi-VN")} ký tự. Hãy tách thành nhiều nguồn.`);
  const { data, error } = await db.from("knowledge_sources").insert({
    workspace_id: ws, module: input.module ?? null, kind: input.kind, topic: input.topic?.trim().slice(0, 80) || null, tags: cleanTags(input.tags),
    visibility: input.visibility === "public" ? "public" : "internal", title, content, status: "pending", created_by: userId,
  }).select().single();
  fail(error);
  const source = toSource(data as SourceRow);
  const indexed = await indexRow(db, source);
  await enqueueWorkspaceSync(ws);
  return indexed;
};

export const deleteSource = async (id: string): Promise<void> => {
  const { db, ws } = await ctx();
  const { error } = await db.from("knowledge_sources").delete().eq("workspace_id", ws).eq("id", id);
  fail(error);
  await enqueueWorkspaceSync(ws);
};

/** Change the metadata of a source (title, topic, tags, module, visibility). Content changes go through reindexSource(id, content). */
export const updateSource = async (id: string, patch: Partial<Pick<AddSourceInput, "title" | "topic" | "tags" | "module" | "visibility">>): Promise<KnowledgeSource> => {
  const { db, ws } = await ctx();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title.trim().slice(0, 160) || "Không tên";
  if (patch.topic !== undefined) row.topic = patch.topic?.trim().slice(0, 80) || null;
  if (patch.tags !== undefined) row.tags = cleanTags(patch.tags);
  if (patch.module !== undefined) row.module = patch.module;
  if (patch.visibility !== undefined) row.visibility = patch.visibility === "public" ? "public" : "internal";
  const { data, error } = await db.from("knowledge_sources").update(row).eq("workspace_id", ws).eq("id", id).select().single();
  fail(error);
  if (patch.module !== undefined) await db.from("knowledge_chunks").update({ module: patch.module }).eq("source_id", id);
  await enqueueWorkspaceSync(ws);
  return toSource(data as SourceRow);
};

/**
 * Chunk and embed one source. Without embeddings (no key or provider error) the passages are stored with a null vector:
 * full-text search still finds them, and the source says so. Status goes indexing -> ready | failed.
 */
const indexRow = async (db: Db, source: KnowledgeSource): Promise<KnowledgeSource> => {
  await db.from("knowledge_sources").update({ status: "indexing", error: null, updated_at: new Date().toISOString() }).eq("id", source.id);
  try {
    const pieces = chunkText(source.content);
    if (pieces.length === 0) throw new Error("Không có nội dung để lập chỉ mục.");
    const vectors = await withUsage({ workspaceId: source.workspaceId }, () => embedTexts(pieces));
    const del = await db.from("knowledge_chunks").delete().eq("source_id", source.id);
    fail(del.error);
    const rows = pieces.map((content, ord) => ({
      workspace_id: source.workspaceId, source_id: source.id, module: source.module, visibility: source.visibility, ord, content,
      embedding: vectors ? toVector(vectors[ord] as Array<number>) : null,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      const ins = await db.from("knowledge_chunks").insert(rows.slice(i, i + 50));
      fail(ins.error);
    }
    const note = vectors ? null : "Chưa tạo được vector ngữ nghĩa; vẫn tìm được theo từ khóa.";
    const { data, error } = await db.from("knowledge_sources").update({ status: "ready", error: note, chunk_count: pieces.length, updated_at: new Date().toISOString() }).eq("id", source.id).select().single();
    fail(error);
    return toSource(data as SourceRow);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const { data } = await db.from("knowledge_sources").update({ status: "failed", error: message.slice(0, 400), updated_at: new Date().toISOString() }).eq("id", source.id).select().single();
    return data ? toSource(data as SourceRow) : { ...source, status: "failed", error: message };
  }
};

/** Re-chunk and re-embed a source (optionally after replacing its content). */
export const reindexSource = async (id: string, content?: string): Promise<KnowledgeSource> => {
  const { db, ws } = await ctx();
  if (content !== undefined) {
    const next = content.trim();
    if (!next) throw new Error("Nội dung đang trống.");
    if (next.length > MAX_SOURCE_CHARS) throw new Error("Nội dung quá dài.");
    const upd = await db.from("knowledge_sources").update({ content: next }).eq("workspace_id", ws).eq("id", id);
    fail(upd.error);
  }
  const { data, error } = await db.from("knowledge_sources").select("*").eq("workspace_id", ws).eq("id", id).maybeSingle();
  fail(error);
  if (!data) throw new Error("Not found");
  const indexed = await indexRow(db, toSource(data as SourceRow));
  await enqueueWorkspaceSync(ws);
  return indexed;
};

/* ------------------------------------------------------------------ retrieval */

type MatchRow = { layer: "nivo" | "business"; id: string; source_id: string | null; module: string | null; kind: string; title: string; content: string; score: number; visibility: Visibility; topic: string | null };

const matchWith = async (db: Db, a: { workspaceId: string; module: ModuleKey; query: string; limit: number; audience: Audience }): Promise<Array<Passage>> => {
  const vector = a.query.trim() ? await withUsage({ workspaceId: a.workspaceId }, () => embedText(a.query)) : null;
  const { data, error } = await db.rpc("match_knowledge", {
    p_workspace: a.workspaceId, p_module: a.module, p_query_embedding: vector ? toVector(vector) : null, p_query: a.query, p_limit: a.limit, p_audience: a.audience,
  });
  if (error) { console.error("match_knowledge failed:", error.message); return []; }
  return ((data ?? []) as Array<MatchRow>).map((r) => ({
    layer: r.layer, id: r.id, sourceId: r.source_id, module: r.module, kind: r.kind, title: r.title, content: r.content, score: r.score, visibility: r.visibility, topic: r.topic,
  }));
};

/** Hybrid search over both layers for the signed-in workspace. `audience: "customer"` returns only public business passages. */
export const searchKnowledge = async (module: ModuleKey, query: string, limit = 8, audience: Audience = "internal"): Promise<Array<Passage>> => {
  const { db, ws } = await ctx();
  return matchWith(db, { workspaceId: ws, module, query, limit, audience });
};

/* ------------------------------------------------------------------ NIVO base knowledge */

type NivoRow = { id: string; module: KnowledgeModule; slug: string; title: string; body: string; kind: NivoKind; version: number; updated_at: string };
const toNivo = (r: NivoRow): NivoItem => ({ id: r.id, module: r.module, slug: r.slug, title: r.title, body: r.body, kind: r.kind, version: r.version, updatedAt: r.updated_at });

export const listNivoKnowledge = async (): Promise<Array<NivoItem>> => {
  const { db } = await ctx();
  const { data, error } = await db.from("nivo_knowledge").select("id, module, slug, title, body, kind, version, updated_at").order("module").order("kind").order("slug");
  fail(error);
  return ((data ?? []) as Array<NivoRow>).map(toNivo);
};

/** Counts for the Setup card: NIVO base items of the module (+ core) and the workspace's ready sources. */
export const knowledgeCounts = async (module: ModuleKey): Promise<{ nivo: number; business: number; publicSources: number }> => {
  const { db, ws } = await ctx();
  const nivo = await db.from("nivo_knowledge").select("id", { count: "exact", head: true }).in("module", [module, "core"]);
  const ready = await db.from("knowledge_sources").select("id, visibility, module").eq("workspace_id", ws).eq("status", "ready");
  const rows = ((ready.data ?? []) as Array<{ visibility: Visibility; module: ModuleKey | null }>).filter((r) => r.module === null || r.module === module);
  return { nivo: nivo.count ?? 0, business: rows.length, publicSources: rows.filter((r) => r.visibility === "public").length };
};

const NIVO_BASE_KINDS: Array<NivoKind> = ["authority", "escalation", "tone"];
const baseCache = new Map<string, { at: number; items: Array<NivoItem> }>();

const nivoBase = async (db: Db, module: ModuleKey, kinds: ReadonlyArray<NivoKind>): Promise<Array<NivoItem>> => {
  const key = `${module}:${kinds.join(",")}`;
  const hit = baseCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.items;
  const { data } = await db.from("nivo_knowledge").select("id, module, slug, title, body, kind, version, updated_at").in("module", [module, "core"]).in("kind", [...kinds]).order("module", { ascending: false }).order("slug");
  const items = ((data ?? []) as Array<NivoRow>).map(toNivo);
  if (items.length) baseCache.set(key, { at: Date.now(), items });
  return items;
};

const trim = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, "")} ...`);
const stripMd = (text: string): string => text.replace(/^#{1,6}\s*/gm, "").replace(/\*\*/g, "").trim();

/* ------------------------------------------------------------------ agent context */

const contextLines = (v: ContextVersion, module: ModuleKey): string => {
  const gates = MODULE_GATES[module].map((g) => {
    const e = gateEntry(v.snapshot.gates, g.key);
    return e.evidence ? `- ${g.label_en}: ${e.evidence}` : "";
  }).filter(Boolean);
  const facts = v.snapshot.facts.map((f) => `- ${f.text}`);
  return [v.snapshot.summary, ...gates, ...facts].filter(Boolean).join("\n");
};

const activeContextOf = async (db: Db, workspaceId: string, module: ModuleKey, viaSession: boolean): Promise<ContextVersion | null> => {
  if (viaSession) return getActiveContext(module);
  const inst = await db.from("module_installations").select("active_context_version_id").eq("workspace_id", workspaceId).eq("module_key", module).maybeSingle();
  const id = (inst.data as { active_context_version_id: string | null } | null)?.active_context_version_id;
  if (!id) return null;
  const v = await db.from("module_context_versions").select("*").eq("id", id).maybeSingle();
  const r = v.data as { id: string; installation_id: string; version: number; snapshot: ContextVersion["snapshot"]; applied_by: string; applied_at: string } | null;
  return r ? { id: r.id, installationId: r.installation_id, version: r.version, snapshot: r.snapshot, appliedBy: r.applied_by, appliedAt: r.applied_at } : null;
};

/**
 * What an agent runs on, as one system-prompt block: NIVO base (authority, escalation, tone of the module and core, always),
 * the active module context version, the best matching business passages, and the best matching NIVO playbook passages.
 * `audience: "customer"` (customer-facing replies) only ever includes PUBLIC business knowledge; the filter is applied in SQL.
 * Safe when everything is empty: the result is then a short note that no knowledge is available. Pass `db` from a webhook (no session).
 */
export const buildAgentContext = async (a: { workspaceId: string; module: ModuleKey; query: string; audience?: Audience; db?: Db; limit?: number; scope?: "full" | "dynamic" }): Promise<{ system: string; citations: Array<Citation> }> => {
  const audience: Audience = a.audience ?? "internal";
  const viaSession = !a.db;
  const db = (a.db ?? ((await supabaseServer()) as unknown as Db));
  // "dynamic" = only what changes per question (retrieved passages): the base rules and the active context version already live in the agent's synced OpenClaw workspace.
  const dynamicOnly = a.scope === "dynamic";
  const citations: Array<Citation> = [];
  const parts: Array<string> = [];
  try {
    const [base, version, passages] = await Promise.all([
      dynamicOnly ? Promise.resolve([] as Array<NivoItem>) : nivoBase(db, a.module, NIVO_BASE_KINDS),
      dynamicOnly ? Promise.resolve(null) : activeContextOf(db, a.workspaceId, a.module, viaSession).catch(() => null),
      matchWith(db, { workspaceId: a.workspaceId, module: a.module, query: a.query, limit: a.limit ?? 8, audience }),
    ]);

    if (base.length) {
      let budget = 5200;
      const lines: Array<string> = [];
      for (const item of base) {
        const text = trim(stripMd(item.body), Math.min(900, budget));
        if (budget <= 0) break;
        budget -= text.length;
        lines.push(`## ${item.title}\n${text}`);
      }
      parts.push(`NIVO BASE RULES (always follow; they outrank everything below):\n${lines.join("\n\n")}`);
    }
    if (version) parts.push(`APPROVED MODULE CONTEXT (version ${version.version}, confirmed by the owner):\n${trim(contextLines(version, a.module), 3000)}`);

    const business = passages.filter((p) => p.layer === "business").slice(0, 5);
    const playbook = passages.filter((p) => p.layer === "nivo" && !NIVO_BASE_KINDS.includes(p.kind as NivoKind)).slice(0, 3);
    if (business.length) {
      parts.push(`BUSINESS KNOWLEDGE (the owner's own documents${audience === "customer" ? "; public information only" : ""}). Answer from this; never invent anything that is not here:\n${business.map((p, i) => `[B${i + 1}] ${p.topic ? `${p.topic} / ` : ""}${p.title}\n${trim(p.content, 900)}`).join("\n\n")}`);
      for (const p of business) citations.push({ layer: "business", id: p.id, sourceId: p.sourceId, title: p.title, topic: p.topic });
    } else {
      parts.push(`BUSINESS KNOWLEDGE: nothing relevant was found${audience === "customer" ? " in the public knowledge" : ""}. If the question needs facts, say a team member will confirm and hand over; do not guess.`);
    }
    if (playbook.length) {
      parts.push(`NIVO PLAYBOOK (how to work, relevant to this message):\n${playbook.map((p) => `- ${p.title}: ${trim(stripMd(p.content), 600)}`).join("\n")}`);
      for (const p of playbook) citations.push({ layer: "nivo", id: p.id, sourceId: null, title: p.title, topic: null });
    }
    for (const p of base) citations.push({ layer: "nivo", id: p.id, sourceId: null, title: p.title, topic: null });
  } catch (e) {
    console.error("buildAgentContext failed:", e instanceof Error ? e.message : String(e));
  }
  return { system: parts.join("\n\n"), citations: dedupe(citations) };
};

const dedupe = (list: Array<Citation>): Array<Citation> => {
  const seen = new Set<string>();
  return list.filter((c) => (seen.has(`${c.layer}:${c.id}`) ? false : (seen.add(`${c.layer}:${c.id}`), true)));
};

/* ------------------------------------------------------------------ suggestions */

export type SuggestionState = "dismissed" | "not_applicable";

/** What the workspace decided about each "Nên bổ sung" suggestion. */
export const listSuggestionStates = async (): Promise<Record<string, SuggestionState>> => {
  const { db, ws } = await ctx();
  const { data } = await db.from("knowledge_suggestion_state").select("suggestion_key, state").eq("workspace_id", ws);
  return Object.fromEntries(((data ?? []) as Array<{ suggestion_key: string; state: SuggestionState }>).map((r) => [r.suggestion_key, r.state]));
};

export const setSuggestionState = async (key: string, state: SuggestionState | null): Promise<void> => {
  const { db, ws, userId } = await ctx();
  if (!KNOWLEDGE_SUGGESTIONS.some((s) => s.key === key)) throw new Error("Unknown suggestion");
  if (state === null) {
    fail((await db.from("knowledge_suggestion_state").delete().eq("workspace_id", ws).eq("suggestion_key", key)).error);
    return;
  }
  fail((await db.from("knowledge_suggestion_state").upsert({ workspace_id: ws, suggestion_key: key, state, decided_by: userId, decided_at: new Date().toISOString() }).select()).error);
};

/** Suggestions still open: fitting the installed modules and business type, not dismissed or marked not applicable, no source on that topic yet. */
export const openSuggestions = async (installed: ReadonlyArray<ModuleKey>, locale: "vi" | "en"): Promise<Array<{ key: string; topic: string; hint: string; visibility: Visibility; modules: ReadonlyArray<ModuleKey> }>> => {
  const { db, ws } = await ctx();
  const [ws0, states, topics] = await Promise.all([
    db.from("workspaces").select("business_type").eq("id", ws).maybeSingle(),
    listSuggestionStates(),
    listTopics(),
  ]);
  const type = (ws0.data as { business_type: string | null } | null)?.business_type ?? null;
  const used = new Set(topics.map((t) => t.toLowerCase()));
  return suggestionsFor(installed, type)
    .filter((s) => !states[s.key] && !used.has(suggestionTopic(s, locale).toLowerCase()))
    .map((s) => ({ key: s.key, topic: suggestionTopic(s, locale), hint: locale === "vi" ? s.hint_vi : s.hint_en, visibility: s.visibility, modules: s.modules }));
};

/**
 * For the setup chat: the business knowledge at a glance, so the assistant checks it BEFORE asking anything, plus the passages
 * closest to the owner's message and the suggestions the owner marked not applicable (those checklist items count as covered).
 */
export const businessKnowledgeBrief = async (module: ModuleKey, message: string): Promise<{ text: string; sourceCount: number; notApplicable: Array<string> }> => {
  const { db, ws } = await ctx();
  const [sources, states, passages] = await Promise.all([
    db.from("knowledge_sources").select("title, topic, kind, visibility, content, status").eq("workspace_id", ws).in("status", ["ready"]).or(`module.is.null,module.eq.${module}`).order("created_at", { ascending: false }).limit(40),
    listSuggestionStates(),
    matchWith(db, { workspaceId: ws, module, query: message, limit: 6, audience: "internal" }),
  ]);
  const list = (sources.data ?? []) as Array<{ title: string; topic: string | null; kind: string; visibility: Visibility; content: string }>;
  const notApplicable = KNOWLEDGE_SUGGESTIONS.filter((s) => states[s.key]).map((s) => `${s.topic_en} (gates: ${s.gates.join(", ")})`);
  const lines = list.map((s) => `- ${s.topic ? `[${s.topic}] ` : ""}${s.title} (${s.kind}, ${s.visibility}): ${trim(s.content.replace(/\s+/g, " "), 160)}`);
  const hits = passages.filter((p) => p.layer === "business").slice(0, 4).map((p) => `- ${p.title}: ${trim(p.content.replace(/\s+/g, " "), 400)}`);
  const text = [
    lines.length ? `Business knowledge already added by the owner (${list.length} sources):\n${lines.join("\n")}` : "Business knowledge already added by the owner: (none yet)",
    hits.length ? `Passages closest to the owner's latest message:\n${hits.join("\n")}` : "",
    notApplicable.length ? `The owner marked these as not applicable or dismissed (treat the matching checklist items as covered; never ask about them):\n${notApplicable.map((n) => `- ${n}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  return { text, sourceCount: list.length, notApplicable };
};

/** The setup_checklist and authority knowledge of a module (+ core), as text for the setup assistant. */
export const setupKnowledgeText = async (module: ModuleKey): Promise<string> => {
  const db = (await supabaseServer()) as unknown as Db;
  const items = await nivoBase(db, module, ["setup_checklist", "authority"]);
  return items.map((i) => `## ${i.title}\n${trim(stripMd(i.body), 2400)}`).join("\n\n");
};
