import "server-only";
import { logEvidence } from "./core";
import type { EngineCtx, Performer } from "./engine";
import type { WorkItem } from "./flow-types";
import { markApproved, renderProject, type VideoCtx } from "./module-video-core";

/**
 * What happens once the authority gate lets a "Tạo video" action through (registered in module-performers.ts).
 *   render_draft   queue a draft render (default auto; assist mode downgrades it to a decision).
 *   publish_video  runs ONLY after the owner approved (max_mode "ask"). It marks the video approved and records the evidence. NIVO does not post it to
 *                  TikTok or Facebook: the owner downloads or shares the file, posts it, and presses "Tôi đã đăng xong" (the only way to `published`).
 * Kept free of engine runtime imports (types only): engine.ts imports module-performers.ts, which imports this file.
 */
const vctx = (c: EngineCtx, actor: string): VideoCtx => ({ db: c.db, ws: c.ws, userId: null, actor });
const field = (item: WorkItem, key: string): string => {
  const v = item.proposal?.fields?.[key];
  return typeof v === "string" ? v : "";
};

export const publishVideoPerformer: Performer = {
  prepare: async (_c, item) => ({ proposal: { ...item.proposal, summary: item.proposal?.summary ?? "", fields: item.proposal?.fields ?? {} } }),
  perform: async (c, item, _p, by) => {
    const projectId = field(item, "project_id");
    if (!projectId) throw new Error("Thiếu mã video.");
    const p = await markApproved(vctx(c, by.name), projectId, by.name);
    await logEvidence(c.db, c.ws, {
      work_item_id: item.id, kind: "video.approved", actor: by.name, summary: `${by.name} duyệt video «${p.title}»`,
      evidence: `Bản dựng ${p.render_id ?? ""}. Video đã sẵn sàng để tải và gửi; NIVO không tự đăng lên mạng xã hội.`,
    });
    return { summary: `Đã duyệt video «${p.title}». Bạn tải về hoặc gửi đi được rồi; NIVO không tự đăng.`, evidence: "reviewed", href: "/m/video/workbench" };
  },
};

export const renderDraftPerformer: Performer = {
  prepare: async (_c, item) => ({ proposal: { ...item.proposal, summary: item.proposal?.summary ?? "", fields: item.proposal?.fields ?? {} } }),
  perform: async (c, item, _p, by) => {
    const projectId = field(item, "project_id");
    if (!projectId) throw new Error("Thiếu mã video.");
    const view = await renderProject(vctx(c, by.name), projectId);
    return { summary: `Đã đưa video «${view.title}» vào hàng dựng.`, evidence: "captured", href: "/m/video/workbench", detail: view.render?.id ?? null };
  },
};
