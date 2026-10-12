import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EngineJob } from "../engine-queue";
import { VIDEOS_BUCKET } from "./spec";

/**
 * The app's half of the `video.render` job, called by the signed engine routes (src/app/api/engine/[op]/route.ts). Same rules as the other
 * engine functions: the render is the JOB's own (payload.render_id inside the job's workspace), never an id taken from the request body.
 *
 *   POST /api/engine/video-input   { job_id }                                              -> videoInput
 *   POST /api/engine/callback      { job_id, op: "video.progress", progress, stage }       -> videoCallback
 *   POST /api/engine/callback      { job_id, op: "video.result", output_path, poster_path, duration_ms, size_bytes, meta }
 *   POST /api/engine/callback      { job_id, op: "video.error", reason }
 */

export type VideoCallbackBody =
  | { readonly op: "video.progress"; readonly progress: number; readonly stage: string }
  | { readonly op: "video.result"; readonly output_path: string; readonly poster_path: string; readonly duration_ms: number; readonly size_bytes: number; readonly meta: Record<string, unknown> }
  | { readonly op: "video.error"; readonly reason: string };

const renderIdOf = (job: EngineJob): string => {
  const v = job.payload.render_id;
  if (typeof v !== "string" || !/^[0-9a-f-]{36}$/i.test(v)) throw new Error("job payload has no render_id");
  return v;
};

/** What the engine needs to render: the spec of this job's row. Marks the row `rendering`. A row that is already done/failed is reported as such (the engine then skips the job). */
export const videoInput = async (db: SupabaseClient, job: EngineJob) => {
  const id = renderIdOf(job);
  const { data, error } = await db.from("video_renders").select("id, workspace_id, status, spec").eq("id", id).eq("workspace_id", job.workspace_id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("render not found");
  const row = data as { id: string; workspace_id: string; status: string; spec: unknown };
  if (row.status === "queued" || row.status === "rendering") {
    await db.from("video_renders").update({ status: "rendering", started_at: new Date().toISOString(), error: null }).eq("id", id).in("status", ["queued", "rendering"]);
  }
  return { render_id: row.id, workspace_id: row.workspace_id, status: row.status, spec: row.spec };
};

const int = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null);

export const videoCallback = async (db: SupabaseClient, job: EngineJob, body: VideoCallbackBody): Promise<{ applied: boolean }> => {
  const id = renderIdOf(job);
  const ws = job.workspace_id;
  const open = ["queued", "rendering"];
  if (body.op === "video.progress") {
    const progress = int(body.progress, 0, 99) ?? 0;
    const { data } = await db.from("video_renders").update({ status: "rendering", progress, stage: String(body.stage).slice(0, 20) }).eq("id", id).eq("workspace_id", ws).in("status", open).lt("progress", progress + 1).select("id").maybeSingle();
    return { applied: data !== null };
  }
  if (body.op === "video.error") {
    const { data } = await db.from("video_renders").update({ status: "failed", error: String(body.reason).slice(0, 300), finished_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", ws).in("status", open).select("id").maybeSingle();
    return { applied: data !== null };
  }
  // video.result: the files must sit in this render's own folder of the `videos` bucket, and must exist.
  const prefix = `${ws}/${id}/`;
  if (!body.output_path.startsWith(prefix) || !body.poster_path.startsWith(prefix) || /\.\./.test(body.output_path + body.poster_path)) throw new Error("output outside the render folder");
  const dir = await db.storage.from(VIDEOS_BUCKET).list(`${ws}/${id}`);
  const names = new Set((dir.data ?? []).map((f) => f.name));
  if (!names.has(body.output_path.slice(prefix.length))) throw new Error("output file is not in Storage");
  const { data } = await db
    .from("video_renders")
    .update({
      status: "done", progress: 100, stage: null, output_path: body.output_path, poster_path: names.has(body.poster_path.slice(prefix.length)) ? body.poster_path : null,
      duration_ms: int(body.duration_ms, 0, 3_600_000), size_bytes: int(body.size_bytes, 0, 2 ** 31), error: null,
      meta: body.meta && typeof body.meta === "object" ? body.meta : {}, finished_at: new Date().toISOString(),
    })
    .eq("id", id).eq("workspace_id", ws).in("status", open).select("id").maybeSingle();
  return { applied: data !== null };
};

/** Parses the `video.*` callback out of an untrusted body; null when it is not one. */
export const readVideoCallback = (body: Record<string, unknown>): VideoCallbackBody | null => {
  if (body.op === "video.progress") return { op: "video.progress", progress: Number(body.progress), stage: typeof body.stage === "string" ? body.stage : "" };
  if (body.op === "video.error") return { op: "video.error", reason: typeof body.reason === "string" ? body.reason : "error" };
  if (body.op === "video.result" && typeof body.output_path === "string" && typeof body.poster_path === "string") {
    return { op: "video.result", output_path: body.output_path, poster_path: body.poster_path, duration_ms: Number(body.duration_ms), size_bytes: Number(body.size_bytes), meta: body.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? (body.meta as Record<string, unknown>) : {} };
  }
  return null;
};
