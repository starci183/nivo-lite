import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanHashtags, DEFAULT_SETTINGS, isContentChannel, isContentStatus, type Cadence, type ContentItem, type ContentSettings, type EvidenceLine, type Pillar, type Variants } from "./module-content-shared";

/** Reads and small writes of the content module's own tables. Every function takes the client and the workspace, so the owner's session (RLS) and the service role (tick, scripts) use the same code. */
export type Db = SupabaseClient;

const fail = (e: { message: string } | null): void => { if (e) throw new Error(e.message); };

/** DB row -> typed item (jsonb columns are trusted to the shapes this module writes; unknown values are dropped). */
export const toItem = (r: Record<string, unknown>): ContentItem => {
  const arr = (v: unknown): Array<unknown> => (Array.isArray(v) ? v : []);
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const channels = arr(r.channels).filter(isContentChannel);
  return {
    id: String(r.id), workspace_id: String(r.workspace_id), plan_id: (r.plan_id as string | null) ?? null, title: String(r.title ?? ""), brief: String(r.brief ?? ""),
    pillar_id: (r.pillar_id as string | null) ?? null, channels: channels.length ? channels : ["facebook"], scheduled_at: (r.scheduled_at as string | null) ?? null,
    status: isContentStatus(r.status) ? r.status : "idea", variants: obj(r.variants) as Variants, hashtags: arr(r.hashtags).map(String),
    media: arr(r.media) as ContentItem["media"], links: arr(r.links) as ContentItem["links"], holiday_key: (r.holiday_key as string | null) ?? null,
    evidence: arr(r.evidence) as ContentItem["evidence"], published: obj(r.published) as ContentItem["published"], work_item_id: (r.work_item_id as string | null) ?? null,
    drafted_at: (r.drafted_at as string | null) ?? null, approved_by: (r.approved_by as string | null) ?? null, approved_at: (r.approved_at as string | null) ?? null,
    published_at: (r.published_at as string | null) ?? null, source: (r.source as ContentItem["source"]) ?? "manual", created_by: String(r.created_by ?? ""),
    created_at: String(r.created_at), updated_at: String(r.updated_at),
  };
};

export const listPillars = async (db: Db, ws: string): Promise<Array<Pillar>> => {
  const { data, error } = await db.from("content_pillars").select("*").eq("workspace_id", ws).order("sort").order("created_at");
  fail(error);
  return (data ?? []) as Array<Pillar>;
};

export const listCadence = async (db: Db, ws: string): Promise<Array<Cadence>> => {
  const { data, error } = await db.from("content_cadence").select("*").eq("workspace_id", ws).order("channel");
  fail(error);
  return (data ?? []) as Array<Cadence>;
};

export const loadSettings = async (db: Db, ws: string): Promise<ContentSettings> => {
  const { data, error } = await db.from("content_settings").select("*").eq("workspace_id", ws).maybeSingle();
  fail(error);
  const d = DEFAULT_SETTINGS(ws);
  if (!data) return d;
  const row = data as Partial<ContentSettings>;
  return {
    workspace_id: ws, brand_voice: row.brand_voice ?? "", avoid: row.avoid ?? "", cta: row.cta ?? "", hashtags: row.hashtags ?? [],
    automations: { ...d.automations, ...(row.automations ?? {}) }, marks: row.marks ?? {},
  };
};

export const saveSettings = async (db: Db, ws: string, patch: Partial<Omit<ContentSettings, "workspace_id">>): Promise<void> => {
  const cur = await loadSettings(db, ws);
  const next = {
    workspace_id: ws, brand_voice: patch.brand_voice ?? cur.brand_voice, avoid: patch.avoid ?? cur.avoid, cta: patch.cta ?? cur.cta,
    hashtags: cleanHashtags(patch.hashtags ?? cur.hashtags), automations: { ...cur.automations, ...(patch.automations ?? {}) }, marks: { ...cur.marks, ...(patch.marks ?? {}) },
  };
  const { error } = await db.from("content_settings").upsert(next, { onConflict: "workspace_id" });
  fail(error);
};

export const listItems = async (db: Db, ws: string, range?: { from: string; to: string }): Promise<Array<ContentItem>> => {
  let q = db.from("content_items").select("*").eq("workspace_id", ws);
  if (range) q = q.gte("scheduled_at", range.from).lt("scheduled_at", range.to);
  const { data, error } = await q.order("scheduled_at", { ascending: true, nullsFirst: false }).limit(500);
  fail(error);
  return ((data ?? []) as Array<Record<string, unknown>>).map(toItem);
};

export const getItem = async (db: Db, ws: string, id: string): Promise<ContentItem | null> => {
  const { data, error } = await db.from("content_items").select("*").eq("id", id).eq("workspace_id", ws).maybeSingle();
  fail(error);
  return data ? toItem(data as Record<string, unknown>) : null;
};

/** Append one evidence line (who did what, and what proves it) to an item. */
export const addEvidence = async (db: Db, ws: string, id: string, line: Omit<EvidenceLine, "at"> & { at?: string }): Promise<void> => {
  const item = await getItem(db, ws, id);
  if (!item) return;
  const next = [...item.evidence, { at: line.at ?? new Date().toISOString(), kind: line.kind, by: line.by, text: line.text }].slice(-60);
  const { error } = await db.from("content_items").update({ evidence: next }).eq("id", id).eq("workspace_id", ws);
  fail(error);
};

/** Pillars to start from when a workspace has none: the presets from resources/content/pillar-presets.json. */
export const ensurePillars = async (db: Db, ws: string, presets: ReadonlyArray<{ name: string; description: string; weight: number }>): Promise<Array<Pillar>> => {
  const cur = await listPillars(db, ws);
  if (cur.length) return cur;
  const { error } = await db.from("content_pillars").insert(presets.map((p, i) => ({ workspace_id: ws, name: p.name, description: p.description, weight: p.weight, sort: i })));
  fail(error);
  return listPillars(db, ws);
};
