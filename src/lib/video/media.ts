import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET, MEDIA_MAX_BYTES, MEDIA_MIME } from "./spec";

/**
 * The asset upload contract (images, videos, logos for renders). Bucket `media`: private, 50 MB per file, MIME allow-list (spec.ts MEDIA_MIME),
 * object path "<workspace_id>/<uuid>-<safe name>". RLS (migration 20261006200000): any workspace member may read and upload under their own
 * workspace folder; managers may delete; nobody reads another workspace. The engine reads with the service role and only inside the job's workspace.
 *
 * Two ways to upload, both end with a `path` that goes into a render spec (scene.background.src or brand.logo):
 *   A. Browser, with the member's own session (RLS enforces the folder):
 *        const r = checkMediaFile(file); const path = buildMediaPath(ws, file.name);
 *        await supabase.storage.from("media").upload(path, file, { contentType: file.type });
 *   B. Server-issued one-shot upload URL (a server action verified membership, then):
 *        const { path, token } = await createMediaUpload(serviceDb, ws, file);
 *        await supabase.storage.from("media").uploadToSignedUrl(path, token, file);
 */

export type MediaFileInfo = { readonly name: string; readonly type: string; readonly size: number };
export type MediaCheck = { readonly ok: true; readonly kind: "image" | "video" } | { readonly ok: false; readonly error: "empty" | "too_large" | "unsupported_type" };

export const checkMediaFile = (f: MediaFileInfo): MediaCheck => {
  if (f.size <= 0) return { ok: false, error: "empty" };
  if (f.size > MEDIA_MAX_BYTES) return { ok: false, error: "too_large" };
  if (!(MEDIA_MIME as ReadonlyArray<string>).includes(f.type)) return { ok: false, error: "unsupported_type" };
  return { ok: true, kind: f.type.startsWith("video/") ? "video" : "image" };
};

const safeName = (name: string): string => {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) : "";
  const stem = (dot > 0 ? name.slice(0, dot) : name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "file";
  return ext ? `${stem}.${ext}` : stem;
};

/** "<workspace_id>/<uuid>-<ascii name>.<ext>": unique, URL-safe, inside the workspace folder. */
export const buildMediaPath = (workspaceId: string, filename: string): string => `${workspaceId}/${crypto.randomUUID()}-${safeName(filename)}`;

/** One-shot upload ticket for path B (service-role client; the caller has already checked workspace membership). */
export const createMediaUpload = async (db: SupabaseClient, workspaceId: string, file: MediaFileInfo): Promise<{ readonly path: string; readonly token: string } | { readonly error: string }> => {
  const check = checkMediaFile(file);
  if (!check.ok) return { error: check.error };
  const path = buildMediaPath(workspaceId, file.name);
  const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "no upload url" };
  return { path, token: data.token };
};

/** A short-lived URL to show an uploaded asset (preview). Use a member-scoped client: RLS then decides who may see it. */
export const signedMediaUrl = async (db: SupabaseClient, path: string, expiresInSec = 3600): Promise<string | null> => {
  const { data } = await db.storage.from(MEDIA_BUCKET).createSignedUrl(path, expiresInSec);
  return data?.signedUrl ?? null;
};
