import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { audienceOf as registryAudience } from "../module-registry";
import type { ModuleKey } from "../modules-shared";
import { factsForView, searchFacts } from "../brain/facts";
import { factLine, type Fact } from "../brain/shared";
import { supabaseServer } from "../supabase/server";
import { withUsage } from "../usage";
import { embeddingModel, embedText, toVector } from "./embed";
import { READABLE_STATUSES, type Audience, type Passage, type Visibility } from "./shared";

/**
 * THE LENS: the one place that decides what an agent may read of the business knowledge (documents AND the second brain).
 * Every agent that puts business knowledge in a prompt or in its synced workspace goes through this file; nothing else may query
 * knowledge_sources, match_knowledge or the brain facts on behalf of an agent.
 *
 * Access table (module -> audience -> what it sees). Documents are knowledge_sources whose module is null (all modules) or the agent's own module.
 *
 *   module                                      audience   documents              brain facts
 *   chatbot, booking, loyalty                   customer   public                 public
 *   content, video (marketing: the output is    customer   public                 public
 *     published, whatever the registry says;
 *     see PUBLIC_ONLY_MODULES)
 *   sales, accounting, inventory, shifts,       internal   public + internal      public + internal + restricted
 *     hiring and every other internal module                                      (restricted ONLY when the fact lists the module)
 *
 * Narrowing: a caller may ask for a NARROWER view than its module has (lensFor's `audience: "customer"`): text that leaves the building
 * (a customer chat reply, a job ad, an offer letter, a supplier message) is written from the public view even by an internal module.
 * A lens can never be widened beyond what the registry and PUBLIC_ONLY_MODULES allow.
 *
 * Instances: a multi-instance type (one Chatbot per branch or Fanpage) reads the knowledge shared by every instance (installation_id null on
 * the document or the fact, the default) plus what is restricted to ITS instance (installation_id = its own). A lens without an instance
 * (a type-level caller) reads the shared knowledge only; instance-restricted documents and facts never reach another instance.
 * Embedding calls stay metered: lensPassages runs the query embedding inside withUsage, so credits are charged as before.
 */

type Db = SupabaseClient;

export type Lens = { readonly workspaceId: string; readonly module: ModuleKey; readonly audience: Audience; readonly installationId: string | null };

/**
 * Marketing modules publish what they write (social posts, videos), so they read PUBLIC knowledge only, whatever the module registry
 * says about their audience. Add a module here when its output is published or reaches people outside the business.
 */
const PUBLIC_ONLY_MODULES: ReadonlySet<ModuleKey> = new Set<ModuleKey>(["content", "video"]);

/**
 * The lens of one module in one workspace. `audience` can only narrow the view to "customer", never widen it. `installationId` scopes it
 * to one agent instance: the shared knowledge plus that instance's own (default: shared only).
 */
export const lensFor = (workspaceId: string, module: ModuleKey, opts: { readonly audience?: Audience; readonly installationId?: string | null } = {}): Lens => ({
  workspaceId, module, installationId: opts.installationId ?? null,
  audience: PUBLIC_ONLY_MODULES.has(module) || registryAudience(module) === "customer" || opts.audience === "customer" ? "customer" : "internal",
});

const dbOf = async (db?: Db): Promise<Db> => db ?? ((await supabaseServer()) as unknown as Db);

/* ------------------------------------------------------------------ documents */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The PostgREST filter of the documents a lens may read: of every module or its own, and shared by every instance or restricted to its own.
 * The instance id only ever comes from the lens (a uuid), never from user text.
 */
const sourceScope = (lens: Lens): string => {
  const own = lens.installationId && UUID.test(lens.installationId) ? lens.installationId : null;
  const modules = ["module.is.null", `module.eq.${lens.module}`];
  const instances = own ? ["installation_id.is.null", `installation_id.eq.${own}`] : ["installation_id.is.null"];
  return modules.flatMap((m) => instances.map((i) => `and(${m},${i})`)).join(",");
};

/** Defence in depth for a document row: the same rule as sourceScope, in code. */
const inLens = (lens: Lens, s: { readonly module: string | null; readonly installation_id?: string | null }): boolean =>
  (s.module === null || s.module === lens.module) && (!s.installation_id || s.installation_id === lens.installationId);

type MatchRow = { layer: "nivo" | "business"; id: string; source_id: string | null; module: string | null; kind: string; title: string; content: string; score: number; visibility: Visibility; topic: string | null };

/** Hybrid search over both layers (NIVO playbook and the business documents), filtered by the lens in SQL (match_knowledge). The query embedding is metered. */
export const lensPassages = async (lens: Lens, query: string, limit = 8, db?: Db): Promise<Array<Passage>> => {
  const client = await dbOf(db);
  const vector = query.trim() ? await withUsage({ workspaceId: lens.workspaceId }, () => embedText(query)) : null;
  const { data, error } = await client.rpc("match_knowledge", {
    p_workspace: lens.workspaceId, p_module: lens.module, p_query_embedding: vector ? toVector(vector) : null, p_query: query, p_limit: limit, p_audience: lens.audience,
    // Only vectors made by this same model are compared with the query vector (see 20261012100900_embedding-model.sql).
    p_query_model: vector ? embeddingModel() : null, p_installation: lens.installationId,
  });
  if (error) { console.error("match_knowledge failed:", error.message); return []; }
  return ((data ?? []) as Array<MatchRow>).map((r) => ({
    layer: r.layer, id: r.id, sourceId: r.source_id, module: r.module, kind: r.kind, title: r.title, content: r.content, score: r.score, visibility: r.visibility, topic: r.topic,
  }));
};

export type LensSource = { id: string; title: string; topic: string | null; kind: string; visibility: Visibility; content: string; module: string | null; installation_id: string | null; created_at: string; updated_at: string };

/** The whole documents the lens may read (indexed ones: ready or extracting_facts, oldest first), for a synced workspace or a standing brand context; use lensPassages for a question. */
export const lensSources = async (lens: Lens, limit = 200, db?: Db): Promise<Array<LensSource>> => {
  const client = await dbOf(db);
  let q = client.from("knowledge_sources").select("id, title, topic, kind, visibility, content, module, installation_id, created_at, updated_at")
    .eq("workspace_id", lens.workspaceId).in("status", READABLE_STATUSES).or(sourceScope(lens));
  if (lens.audience === "customer") q = q.eq("visibility", "public");
  const { data, error } = await q.order("created_at").limit(limit);
  if (error) throw new Error(error.message);
  // Defence in depth: the filters above are the rule; this keeps a mistake in them from becoming a leak.
  return ((data ?? []) as Array<LensSource>).filter((s) => inLens(lens, s) && (lens.audience === "internal" || s.visibility === "public"));
};

/* ------------------------------------------------------------------ brain facts */

/** The brain facts inside the lens (active, in force, visibleTo). With a query: the best matches (default 8); without: the whole view (default 500). */
export const lensFacts = async (lens: Lens, query?: string, limit?: number, db?: Db): Promise<Array<Fact>> => {
  const view = await factsForView(await dbOf(db), lens.workspaceId, lens.audience, lens.module, 500, lens.installationId);
  return query === undefined ? view.slice(0, limit ?? 500) : searchFacts(view, query, limit ?? 8);
};

/* ------------------------------------------------------------------ prompt block */

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * The text block an AI prompt gets for one question: the best matching brain facts, then the best matching business passages, inside a small
 * budget (characters). "" when nothing matched, so a caller can append it unconditionally. Never throws: a prompt without knowledge is still safe.
 */
export const lensBrief = async (lens: Lens, query: string, o: { readonly db?: Db; readonly factLimit?: number; readonly passageLimit?: number; readonly budget?: number } = {}): Promise<string> => {
  try {
    const [facts, passages] = await Promise.all([
      lensFacts(lens, query, o.factLimit ?? 5, o.db).catch(() => [] as Array<Fact>),
      lensPassages(lens, query, o.passageLimit ?? 4, o.db).catch(() => [] as Array<Passage>),
    ]);
    let left = o.budget ?? 1500;
    const take = (lines: Array<string>): Array<string> => {
      const out: Array<string> = [];
      for (const l of lines) { if (l.length > left) break; left -= l.length; out.push(l); }
      return out;
    };
    const f = take(facts.map((x) => `- ${factLine(x)}`));
    const p = take(passages.filter((x) => x.layer === "business").map((x) => `- ${x.title}: ${clip(x.content.replace(/\s+/g, " "), 400)}`));
    if (!f.length && !p.length) return "";
    return [
      "BUSINESS KNOWLEDGE (use only what is here; never invent a price, policy, date or promise that is not written):",
      f.length ? `Confirmed facts:\n${f.join("\n")}` : "", p.length ? `From the business documents:\n${p.join("\n")}` : "",
    ].filter(Boolean).join("\n");
  } catch (e) {
    console.error("lensBrief failed:", e instanceof Error ? e.message : String(e));
    return "";
  }
};

/* ------------------------------------------------------------------ keyword-only search */

/**
 * The business passages whose words match a question, WITHOUT the query embedding: no credits are spent. Used to check whether the knowledge
 * could answer at all (knowledge gaps), never to write a reply. Same lens filtering in SQL as lensPassages.
 */
export const lensPassagesText = async (lens: Lens, query: string, limit = 5, db?: Db): Promise<Array<Passage>> => {
  const client = await dbOf(db);
  const { data, error } = await client.rpc("match_knowledge", {
    p_workspace: lens.workspaceId, p_module: lens.module, p_query_embedding: null, p_query: query, p_limit: limit, p_audience: lens.audience, p_query_model: null,
    p_installation: lens.installationId,
  });
  if (error) { console.error("match_knowledge (text) failed:", error.message); return []; }
  return ((data ?? []) as Array<MatchRow>).filter((r) => r.layer === "business").map((r) => ({
    layer: r.layer, id: r.id, sourceId: r.source_id, module: r.module, kind: r.kind, title: r.title, content: r.content, score: r.score, visibility: r.visibility, topic: r.topic,
  }));
};

/* ------------------------------------------------------------------ summary (for the agent dashboard) */

/** What a lens can read, counted: the documents by visibility and the brain facts by scope. `internal` counts are 0 for a customer lens (it cannot read them). */
export type LensCounts = {
  readonly audience: Audience;
  readonly documents: { readonly public: number; readonly internal: number };
  readonly facts: { readonly public: number; readonly internal: number; readonly restricted: number };
};

const countSources = async (client: Db, lens: Lens, visibility: Visibility): Promise<number> => {
  const { count, error } = await client.from("knowledge_sources").select("id", { count: "exact", head: true })
    .eq("workspace_id", lens.workspaceId).in("status", READABLE_STATUSES).eq("visibility", visibility).or(sourceScope(lens));
  if (error) throw new Error(error.message);
  return count ?? 0;
};

/**
 * Count what the lens may read (same rule as lensSources / lensFacts: indexed documents (ready or extracting_facts) of all modules or this one, the facts in force for this
 * audience and module). Counts only, no text. Throws when the documents cannot be counted; the caller shows the region as failed.
 */
export const lensCounts = async (lens: Lens, db?: Db): Promise<LensCounts> => {
  const client = await dbOf(db);
  const [pub, internal, facts] = await Promise.all([
    countSources(client, lens, "public"),
    lens.audience === "internal" ? countSources(client, lens, "internal") : Promise.resolve(0),
    lensFacts(lens, undefined, undefined, client).catch(() => [] as Array<Fact>),
  ]);
  const byScope = (scope: Fact["scope"]): number => facts.filter((f) => f.scope === scope).length;
  return { audience: lens.audience, documents: { public: pub, internal }, facts: { public: byScope("public"), internal: byScope("internal"), restricted: byScope("restricted") } };
};
