"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { engineCtx } from "@/lib/flow-ctx";
import { getCurrentMember, requireRole } from "@/lib/members";
import type { Aspect } from "@/lib/video/spec";
import {
  archiveProject, beginScripting, createProject, duplicateProject, getProject, listMedia, listProjects, markPublished, mediaTicket, renderProject, runScripting, saveBrand,
  shareToOwner, sourceChoices, updateProject, type NewProject, type ProjectPatch, type VideoCtx,
} from "@/lib/module-video-core";
import { approveVideo } from "@/lib/module-video-work";
import type { Brand, MediaItem, ProjectView, SourceChoice } from "@/lib/module-video-shared";
import { deciderOf } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Outcome } from "@/lib/types";

/**
 * Server actions of the "Tạo video" workbench. Reads: any member of the workspace. Writes, rendering, approval and sharing: owner or manager.
 * The service-role client is used only after the session says which workspace the person belongs to; every query is scoped by that workspace.
 */
const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

const readCtx = async (): Promise<VideoCtx> => {
  const m = await getCurrentMember();
  return { db: supabaseAdmin(), ws: m.workspaceId, userId: m.userId, actor: m.displayName };
};
const writeCtx = async (): Promise<VideoCtx> => {
  const m = await requireRole(["owner", "manager"]);
  return { db: supabaseAdmin(), ws: m.workspaceId, userId: m.userId, actor: m.displayName };
};

export type Snapshot = {
  readonly projects: ReadonlyArray<ProjectView>;
  readonly brand: Brand;
  readonly sources: ReadonlyArray<SourceChoice>;
  readonly media: ReadonlyArray<MediaItem>;
};

export const listVideos = async (): Promise<Outcome<ReadonlyArray<ProjectView>>> => run(async () => listProjects(await readCtx()));
export const pollVideo = async (id: string): Promise<Outcome<ProjectView>> => run(async () => getProject(await readCtx(), id));
export const refreshMedia = async (): Promise<Outcome<ReadonlyArray<MediaItem>>> => run(async () => listMedia(await readCtx()));
export const refreshSources = async (): Promise<Outcome<ReadonlyArray<SourceChoice>>> => run(async () => sourceChoices(await readCtx()));

export const createVideo = async (input: NewProject): Promise<Outcome<ProjectView>> => run(async () => createProject(await writeCtx(), input));
export const updateVideo = async (id: string, patch: ProjectPatch): Promise<Outcome<ProjectView>> => run(async () => updateProject(await writeCtx(), id, patch));
export const duplicateVideo = async (id: string): Promise<Outcome<ProjectView>> => run(async () => duplicateProject(await writeCtx(), id));
export const archiveVideo = async (id: string, archived: boolean): Promise<Outcome<null>> => run(async () => { await archiveProject(await writeCtx(), id, archived); return null; });

/** Start writing the script. It takes up to a minute, so it finishes after this response; the screen polls pollVideo until the status leaves "scripting". */
export const scriptVideo = async (id: string): Promise<Outcome<ProjectView>> =>
  run(async () => {
    const c = await writeCtx();
    if (await beginScripting(c, id)) {
      after(async () => {
        try {
          await runScripting(c, id);
        } catch (e) {
          console.error("video script failed:", e instanceof Error ? e.message : e);
        }
      });
    }
    return getProject(c, id);
  });

export const renderVideo = async (id: string): Promise<Outcome<ProjectView>> => run(async () => renderProject(await writeCtx(), id));

/** "Duyệt và đăng": the publish_video gate always asks; the owner's click is the decision. */
export const approveVideoAction = async (id: string): Promise<Outcome<ProjectView>> =>
  run(async () => {
    const c = await engineCtx();
    await requireRole(["owner", "manager"]);
    await approveVideo(c, id, deciderOf(c.session.member));
    revalidatePath("/", "layout");
    return getProject({ db: supabaseAdmin(), ws: c.ws, userId: c.session.userId, actor: c.actor }, id);
  });

export const markVideoPublished = async (id: string): Promise<Outcome<ProjectView>> => run(async () => markPublished(await writeCtx(), id));
export const shareVideo = async (id: string): Promise<Outcome<{ office: boolean; telegram: boolean }>> => run(async () => shareToOwner(await writeCtx(), id));

export const saveBrandKit = async (brand: Brand): Promise<Outcome<Brand>> => run(async () => saveBrand(await writeCtx(), brand));

/** Ticket for uploading one file straight from the browser to the `media` bucket (the render lane's helper). */
export const uploadTicket = async (file: { name: string; type: string; size: number }): Promise<Outcome<{ path: string; token: string }>> =>
  run(async () => {
    const t = await mediaTicket(await writeCtx(), file);
    if ("error" in t) throw new Error(t.error === "too_large" ? "Tệp lớn quá (tối đa 50 MB)." : t.error === "unsupported_type" ? "Chỉ nhận ảnh JPG, PNG, WebP hoặc video MP4, MOV, WebM." : "Không tải được tệp này.");
    return t;
  });

export type { Aspect };
