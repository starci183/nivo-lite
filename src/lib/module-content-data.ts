import "server-only";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import type { Cadence, ContentItem, ContentSettings, MediaRef, Pillar } from "./module-content-shared";
import { listCadence, listItems, listPillars, loadSettings } from "./module-content-store";

/** Everything the content workbench shows, read with the signed-in member's own session (RLS decides what they may see). */
export type VideoOption = { id: string; name: string; createdAt: string; durationMs: number | null };
export type QueueRow = { itemId: string; workItemId: string | null };

export type ContentWorkbenchData = {
  nowIso: string;
  workspaceId: string;
  canManage: boolean;
  items: ReadonlyArray<ContentItem>;
  pillars: ReadonlyArray<Pillar>;
  cadence: ReadonlyArray<Cadence>;
  settings: ContentSettings;
  /** work item id of each post waiting for approval, to decide it from the queue */
  queue: ReadonlyArray<QueueRow>;
  library: ReadonlyArray<MediaRef>;
  videos: ReadonlyArray<VideoOption>;
  /** storage path (or "video:<id>") -> short-lived URL to show it and to download it */
  urls: Record<string, { view: string; download: string }>;
  lastPlan: { month: string; ideas: number; ms: number | null; createdAt: string } | null;
};

const SIGN_SECONDS = 3600;

export const getContentWorkbench = async (): Promise<ContentWorkbenchData> => {
  const session = await getSession();
  const ws = session.workspace.id;
  const db = await supabaseServer();
  const [items, pillars, cadence, settings, planRes, videoRes, libRes] = await Promise.all([
    listItems(db, ws), listPillars(db, ws), listCadence(db, ws), loadSettings(db, ws),
    db.from("content_plans").select("month, idea_count, ai_ms, created_at").eq("workspace_id", ws).eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("video_renders").select("id, spec, output_path, duration_ms, created_at").eq("workspace_id", ws).eq("status", "done").order("created_at", { ascending: false }).limit(10),
    db.storage.from("media").list(ws, { limit: 30, sortBy: { column: "created_at", order: "desc" } }),
  ]);

  const library: Array<MediaRef> = (libRes.data ?? []).filter((f) => f.name && /\.(jpe?g|png|webp|mp4|mov|webm)$/i.test(f.name)).map((f) => ({ kind: "media" as const, path: `${ws}/${f.name}`, name: f.name.replace(/^[0-9a-f-]{36}-/i, "") }));
  const videoRows = (videoRes.data ?? []) as Array<{ id: string; spec: { title?: string } | null; output_path: string | null; duration_ms: number | null; created_at: string }>;
  const videos: Array<VideoOption> = videoRows.filter((v) => v.output_path).map((v) => ({ id: v.id, name: v.spec?.title?.trim() || "Video", createdAt: v.created_at, durationMs: v.duration_ms }));

  // Sign what is on screen: media referenced by items, the library, and the rendered videos.
  const mediaPaths = [...new Set([...items.flatMap((i) => i.media.filter((m) => m.kind === "media" && m.path).map((m) => m.path as string)), ...library.map((m) => m.path as string)])].slice(0, 80);
  const urls: ContentWorkbenchData["urls"] = {};
  if (mediaPaths.length) {
    const signed = await db.storage.from("media").createSignedUrls(mediaPaths, SIGN_SECONDS);
    for (const s of signed.data ?? []) {
      if (!s.signedUrl || !s.path) continue;
      const file = s.path.split("/").pop()?.replace(/^[0-9a-f-]{36}-/i, "") ?? "file";
      urls[s.path] = { view: s.signedUrl, download: `${s.signedUrl}${s.signedUrl.includes("?") ? "&" : "?"}download=${encodeURIComponent(file)}` };
    }
  }
  const wantedVideos = new Set(items.flatMap((i) => i.media.filter((m) => m.kind === "video_render" && m.id).map((m) => m.id as string)));
  for (const v of videoRows) {
    if (!v.output_path || (!wantedVideos.has(v.id) && !videos.some((x) => x.id === v.id))) continue;
    const signed = await db.storage.from("videos").createSignedUrl(v.output_path, SIGN_SECONDS);
    if (signed.data?.signedUrl) urls[`video:${v.id}`] = { view: signed.data.signedUrl, download: `${signed.data.signedUrl}&download=${encodeURIComponent(`${v.spec?.title?.trim() || "video"}.mp4`)}` };
  }

  const plan = planRes.data as { month: string; idea_count: number; ai_ms: number | null; created_at: string } | null;
  return {
    nowIso: new Date().toISOString(), workspaceId: ws, canManage: session.member.role === "owner" || session.member.role === "manager",
    items, pillars, cadence, settings,
    queue: items.filter((i) => i.status === "waiting_approval").map((i) => ({ itemId: i.id, workItemId: i.work_item_id })),
    library, videos, urls,
    lastPlan: plan ? { month: plan.month, ideas: plan.idea_count, ms: plan.ai_ms, createdAt: plan.created_at } : null,
  };
};
