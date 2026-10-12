import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { vnParts, vnToIso } from "./module-content-shared";

/**
 * Content workbench figures (read side), the four numbers of the agent dashboard ribbon, counted in the database over content_items and content_pillars.
 * A post counts as published when every channel of it is marked posted (status "published"), the same rule the workbench uses.
 */
type Db = SupabaseClient;

export type ContentFigures = {
  /** Posts in status waiting_approval. */
  readonly awaitingApproval: number;
  /** Posts published in the last 30 days (by published_at). */
  readonly published30: number;
  /** The nearest approved post still ahead of now: when, and its title. Null when nothing approved is scheduled. */
  readonly next: { readonly at: string; readonly title: string } | null;
  /** Active pillars with at least one planned post (not skipped) scheduled this month, and how many active pillars there are. */
  readonly pillars: { readonly covered: number; readonly total: number };
};

const DAY_MS = 86_400_000;

export const getContentFigures = async (db: Db, ws: string): Promise<ContentFigures> => {
  const now = new Date();
  const here = vnParts(now);
  const monthFrom = vnToIso(here.y, here.m, 1);
  const monthTo = vnToIso(here.m === 12 ? here.y + 1 : here.y, here.m === 12 ? 1 : here.m + 1, 1);
  const [waiting, published, next, pillars, month] = await Promise.all([
    db.from("content_items").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "waiting_approval"),
    db.from("content_items").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "published").gte("published_at", new Date(now.getTime() - 30 * DAY_MS).toISOString()),
    db.from("content_items").select("title, scheduled_at").eq("workspace_id", ws).eq("status", "approved").gte("scheduled_at", now.toISOString()).order("scheduled_at", { ascending: true }).limit(1),
    db.from("content_pillars").select("id").eq("workspace_id", ws).eq("active", true),
    db.from("content_items").select("pillar_id").eq("workspace_id", ws).neq("status", "skipped").not("pillar_id", "is", null).gte("scheduled_at", monthFrom).lt("scheduled_at", monthTo).limit(2000),
  ]);
  for (const r of [waiting, published, next, pillars, month]) if (r.error) throw new Error(r.error.message);
  const active = ((pillars.data ?? []) as Array<{ id: string }>).map((p) => p.id);
  const used = new Set(((month.data ?? []) as Array<{ pillar_id: string }>).map((i) => i.pillar_id));
  const first = ((next.data ?? []) as Array<{ title: string; scheduled_at: string }>)[0];
  return {
    awaitingApproval: waiting.count ?? 0,
    published30: published.count ?? 0,
    next: first ? { at: first.scheduled_at, title: first.title } : null,
    pillars: { covered: active.filter((id) => used.has(id)).length, total: active.length },
  };
};
