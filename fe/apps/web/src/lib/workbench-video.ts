import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDITS_PER_USD } from "./usage-shared";

/**
 * Video workbench figures (read side), the four numbers of the agent dashboard ribbon, over video_projects and ai_usage_events.
 * Credits: the AI calls tagged module "video" (the script writer) priced like every other credit (cost_usd x CREDITS_PER_USD).
 * The render itself runs on the engine and is not metered in credits, so it is not in that figure.
 */
type Db = SupabaseClient;

export type VideoFigures = {
  /** Projects whose video is being rendered now, and projects whose script is still being written. */
  readonly rendering: number;
  readonly scripting: number;
  /** Rendered and not published yet: waiting for approval (ready) plus approved. */
  readonly readyToPublish: number;
  readonly approved: number;
  /** Projects published in the last 30 days (by published_at). */
  readonly published30: number;
  /** Credits the AI calls of the video module spent in the last 30 days, rounded to a whole credit. */
  readonly credits30: number;
};

const DAY_MS = 86_400_000;
const USAGE_ROW_LIMIT = 5000;

export const getVideoFigures = async (db: Db, ws: string): Promise<VideoFigures> => {
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const projects = (status: string) => db.from("video_projects").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", status);
  const [rendering, scripting, ready, approved, published, usage] = await Promise.all([
    projects("rendering"), projects("scripting"), projects("ready"), projects("approved"),
    projects("published").gte("published_at", since),
    db.from("ai_usage_events").select("cost_usd").eq("workspace_id", ws).eq("module", "video").gte("created_at", since).limit(USAGE_ROW_LIMIT),
  ]);
  for (const r of [rendering, scripting, ready, approved, published, usage]) if (r.error) throw new Error(r.error.message);
  const usd = ((usage.data ?? []) as Array<{ cost_usd: number | string }>).reduce((n, r) => n + Number(r.cost_usd), 0);
  return {
    rendering: rendering.count ?? 0, scripting: scripting.count ?? 0,
    readyToPublish: (ready.count ?? 0) + (approved.count ?? 0), approved: approved.count ?? 0,
    published30: published.count ?? 0, credits30: Math.round(usd * CREDITS_PER_USD),
  };
};
