import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { engineSecret, isOnline, lastEngineHeartbeat, queueDb } from "../engine-queue";
import { validateVideoSpec, VIDEOS_BUCKET, type RenderRow, type VideoSpec } from "./spec";

/**
 * The app-side client of the video renderer. Server code only (server actions, route handlers).
 *
 *   enqueueRender({ workspaceId, spec, createdBy })   validate + insert a `video_renders` row + put a `video.render` job on the queue
 *   getRender(db, workspaceId, id) / listRenders(db, workspaceId)   read rows (pass the member's own client: RLS lets members read their workspace)
 *   signedRenderUrls(db, row)                          1 h URLs for the MP4 (download or play) and the poster
 *
 * Authorisation: enqueueRender writes with the service role, so the CALLER must have checked that the user is a member of `workspaceId`
 * (the usual requireMember / session helper). Spec asset paths are pinned to that workspace by the validator, and the engine re-checks.
 */

export type EnqueueResult =
  | { readonly ok: true; readonly renderId: string; readonly engineOnline: boolean }
  | { readonly ok: false; readonly error: "invalid_spec"; readonly errors: ReadonlyArray<string> }
  | { readonly ok: false; readonly error: "engine_not_configured" | "too_many_open_renders" | "enqueue_failed"; readonly message?: string };

/** At most this many renders per workspace may be waiting or running (a render is minutes of CPU on a shared VPS). */
export const MAX_OPEN_RENDERS = 3;

export const enqueueRender = async (input: { readonly workspaceId: string; readonly spec: unknown; readonly createdBy: string | null }): Promise<EnqueueResult> => {
  const checked = validateVideoSpec(input.spec, { workspaceId: input.workspaceId });
  if (!checked.ok) return { ok: false, error: "invalid_spec", errors: checked.errors };
  const db = queueDb();
  if (!db || !engineSecret()) return { ok: false, error: "engine_not_configured" };

  const open = await db.from("video_renders").select("id", { count: "exact", head: true }).eq("workspace_id", input.workspaceId).in("status", ["queued", "rendering"]);
  if ((open.count ?? 0) >= MAX_OPEN_RENDERS) return { ok: false, error: "too_many_open_renders" };

  const ins = await db.from("video_renders").insert({ workspace_id: input.workspaceId, spec: checked.spec, created_by: input.createdBy }).select("id").single();
  if (ins.error || !ins.data) return { ok: false, error: "enqueue_failed", message: ins.error?.message };
  const renderId = (ins.data as { id: string }).id;

  const job = await db.rpc("engine_enqueue", { p_workspace: input.workspaceId, p_kind: "video.render", p_payload: { render_id: renderId }, p_dedupe_key: `video.render:${renderId}`, p_max_attempts: 2 });
  if (job.error) {
    await db.from("video_renders").update({ status: "failed", error: "could not queue", finished_at: new Date().toISOString() }).eq("id", renderId);
    return { ok: false, error: "enqueue_failed", message: job.error.message };
  }
  return { ok: true, renderId, engineOnline: isOnline(await lastEngineHeartbeat(db)) };
};

const COLUMNS = "id, workspace_id, spec, status, progress, stage, output_path, poster_path, duration_ms, size_bytes, error, meta, created_by, created_at, updated_at, started_at, finished_at";

export const getRender = async (db: SupabaseClient, workspaceId: string, id: string): Promise<RenderRow | null> => {
  const { data } = await db.from("video_renders").select(COLUMNS).eq("id", id).eq("workspace_id", workspaceId).maybeSingle();
  return (data as RenderRow | null) ?? null;
};

export const listRenders = async (db: SupabaseClient, workspaceId: string, limit = 20): Promise<ReadonlyArray<RenderRow>> => {
  const { data } = await db.from("video_renders").select(COLUMNS).eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(Math.min(Math.max(limit, 1), 100));
  return (data ?? []) as RenderRow[];
};

/**
 * Signed URLs for a finished render. `downloadAs` makes the browser save the file under that name instead of playing it.
 * With a member-scoped client the storage policy (videos_member_read) is the check; with the service role the caller must have verified membership.
 */
export const signedRenderUrls = async (db: SupabaseClient, row: Pick<RenderRow, "output_path" | "poster_path">, opts: { readonly expiresInSec?: number; readonly downloadAs?: string } = {}): Promise<{ readonly videoUrl: string | null; readonly posterUrl: string | null }> => {
  const ttl = opts.expiresInSec ?? 3600;
  const sign = async (path: string | null, download?: string): Promise<string | null> => {
    if (!path) return null;
    const { data } = await db.storage.from(VIDEOS_BUCKET).createSignedUrl(path, ttl, download ? { download } : undefined);
    return data?.signedUrl ?? null;
  };
  return { videoUrl: await sign(row.output_path, opts.downloadAs), posterUrl: await sign(row.poster_path) };
};

export type { RenderRow, VideoSpec };
