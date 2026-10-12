import "server-only";
import { resumeWork, runWork, type Decider, type EngineCtx, type WorkSpec } from "./engine";
import type { WorkItem } from "./flow-types";
import { projectRow } from "./module-video-core";
import { estimateScriptSeconds, readScript } from "./module-video-shared";

/**
 * "Tạo video" through the authority gate. Two actions (resources/modules/video/module.json):
 *   render_draft   queue a draft render. Default auto, but a module in assist mode downgrades it to ask.
 *   publish_video  the owner's approval of a finished video. max_mode "ask": it NEVER runs without a person; after the approval the video is `approved`
 *                  (download and share are unlocked). NIVO does not post it to TikTok/Facebook: the owner posts the file and marks it published.
 * Work items use subject_type "video_project" (the table accepts any lower_snake subject since migration 20261009100000).
 */
const SUBJECT = "video_project" as WorkSpec["subject_type"];

/* ------------------------------------------------------------------ entry points */

/** Ask the gate to render a draft (the gate decides: auto, or a decision for the owner). */
export const requestRender = async (c: EngineCtx, projectId: string): Promise<WorkItem> => {
  const p = await projectRow(c, projectId);
  return runWork(c, {
    action: "render_draft", subject_type: SUBJECT, subject_id: projectId, origin: "live", preset: true, noChain: true,
    dedupeKey: `render_draft:${projectId}:v${p.version}`,
    seed: { summary: `Dựng bản nháp video «${p.title}»`, fields: { project_id: projectId, title: p.title, aspect: p.aspect } },
  });
};

/**
 * "Duyệt và đăng": the owner approves a finished video. The request goes through the publish_video gate (always "ask": a decision is recorded for the person),
 * and the owner's click is that decision (the same resumeWork the Office buttons call). Returns the finished work item.
 */
export const approveVideo = async (c: EngineCtx, projectId: string, by: Decider): Promise<WorkItem> => {
  const p = await projectRow(c, projectId);
  if (!p.render_id) throw new Error("Video chưa có bản dựng.");
  if (p.status !== "ready") throw new Error(p.status === "approved" || p.status === "published" ? "Video này đã được duyệt rồi." : "Video chưa dựng xong nên chưa duyệt được.");
  const base = `publish_video:${projectId}:${p.render_id}`;
  const prior = ((await c.db.from("work_items").select("*").eq("workspace_id", c.ws).eq("action", "publish_video").like("dedupe_key", `${base}%`).order("created_at", { ascending: false })).data ?? []) as Array<WorkItem>;
  let item = prior.find((i) => i.status === "waiting_decision") ?? null;
  if (!item) {
    const scenes = readScript(p.script);
    item = await runWork(c, {
      action: "publish_video", subject_type: SUBJECT, subject_id: projectId, origin: "live", preset: true, noChain: true,
      dedupeKey: prior.length ? `${base}:${prior.length + 1}` : base,
      seed: {
        summary: `Duyệt video «${p.title}» (${p.aspect}, khoảng ${estimateScriptSeconds(scenes)} giây)`,
        draft: scenes.map((s, i) => `${i + 1}. ${s.caption}${s.voiceover ? ` — ${s.voiceover}` : ""}`).join("\n"),
        fields: { project_id: projectId, render_id: p.render_id, title: p.title },
      },
    });
  }
  if (item.status === "done") return item;
  if (item.status !== "waiting_decision") throw new Error(item.error ?? "Không gửi duyệt được video này.");
  return resumeWork(c, item.id, "approved", {}, by, "Chủ duyệt video sau khi xem bản dựng.");
};

