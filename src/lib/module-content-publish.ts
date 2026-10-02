import "server-only";
import { logEvidence } from "./core";
import { runWork, type EngineCtx, type Performer } from "./engine";
import type { WorkItem } from "./flow-types";
import { channelLabel, channelRule, type ContentChannel, type PublishedMark } from "./module-content-shared";
import { addEvidence, getItem, type Db } from "./module-content-store";

/**
 * Publishing a post. `publish_post` is an authority action capped at "ask" (resources/modules/content/module.json: max_mode "ask"), so it never runs alone:
 *   1. requestPublish   the owner sends a draft for approval -> a work item that waits in the decision queue (the item becomes waiting_approval)
 *   2. performer.perform  runs ONLY after a person approved that work item -> the item becomes approved ("Đăng" actions unlock)
 *   3. markPublished    the owner pastes the post themselves (copy-ready text, downloaded media) and records where, with a link or a note as evidence
 * No social network is called from here. Zalo OA has no broadcast/article function in src/lib/zalo*.ts (only customer-service messages inside the
 * 48-hour window), so every channel is copy-ready; real API posting is out of scope ("Sắp có").
 */

const fieldOf = (item: WorkItem, k: string): string => {
  const v = item.proposal?.fields?.[k];
  return typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
};

export const publishPerformer: Performer = {
  prepare: async (_c, item) => ({ proposal: item.proposal }),
  perform: async (c, item, p, by) => {
    const id = fieldOf(item, "content_item_id");
    const post = await getItem(c.db, c.ws, id);
    if (!post) throw new Error("Không tìm thấy bài đã gửi duyệt.");
    if (post.status !== "waiting_approval") throw new Error("Bài này không còn ở trạng thái chờ duyệt.");
    // The approval card lets the owner edit the draft: that edit lands on the first channel's text, so what was approved is what is stored.
    const first = post.channels[0];
    const variants = { ...post.variants };
    if (p.draft && first && variants[first] && p.draft !== variants[first]!.text) variants[first] = { ...variants[first]!, text: p.draft };
    const at = new Date().toISOString();
    const { error } = await c.db.from("content_items").update({ status: "approved", approved_by: by.name, approved_at: at, variants, work_item_id: item.id }).eq("id", id).eq("workspace_id", c.ws);
    if (error) throw new Error(error.message);
    await addEvidence(c.db, c.ws, id, { kind: "approved", by: by.name, text: `${by.name} đã duyệt bài (quyết định ${item.id}).` });
    return { summary: `Đã duyệt bài: ${post.title}`, evidence: "reviewed", lead_id: null, detail: p.draft ?? null, href: "/m/content/workbench?tab=queue" };
  },
  onReject: async (c, item, _p, by) => {
    const id = fieldOf(item, "content_item_id");
    if (!id) return;
    await c.db.from("content_items").update({ status: "draft" }).eq("id", id).eq("workspace_id", c.ws).eq("status", "waiting_approval");
    await addEvidence(c.db, c.ws, id, { kind: "rejected", by: by.name, text: `${by.name} chưa duyệt bài, đưa về bản nháp để sửa.` });
  },
};

/** Send a draft for approval. The gate decides (always "ask"); the result tells where the work item stands. */
export const requestPublish = async (c: EngineCtx, itemId: string): Promise<{ workItem: WorkItem }> => {
  const item = await getItem(c.db, c.ws, itemId);
  if (!item) throw new Error("Không tìm thấy bài này.");
  if (item.status !== "draft") throw new Error(item.status === "idea" ? "Hãy soạn bài trước khi gửi duyệt." : "Bài này đã gửi duyệt hoặc đã đăng.");
  const missing = item.channels.filter((ch) => !item.variants[ch]?.text.trim());
  if (missing.length) throw new Error(`Chưa có nội dung cho ${missing.map(channelLabel).join(", ")}. Soạn hoặc bỏ kênh đó.`);
  const rounds = item.evidence.filter((e) => e.kind === "submitted").length;
  const first = item.channels[0];
  const wi = await runWork(c, {
    action: "publish_post", subject_type: "inbound", subject_id: item.id, origin: "live", preset: true, noChain: true,
    dedupeKey: `publish_post:${item.id}:${rounds + 1}`,
    seed: {
      summary: `Đăng bài "${item.title}" lên ${item.channels.map(channelLabel).join(", ")}`,
      draft: item.variants[first]?.text ?? "",
      fields: { content_item_id: item.id, channels: item.channels.join(","), scheduled_at: item.scheduled_at ?? "" },
    },
  });
  if (wi.status === "failed") throw new Error(wi.error ?? "Không gửi duyệt được.");
  const { error } = await c.db.from("content_items").update({ status: wi.status === "done" ? "approved" : "waiting_approval", work_item_id: wi.id }).eq("id", item.id).eq("workspace_id", c.ws).eq("status", "draft");
  if (error) throw new Error(error.message);
  await addEvidence(c.db, c.ws, item.id, { kind: "submitted", by: c.actor, text: `${c.actor} gửi duyệt (quyết định ${wi.id}).` });
  return { workItem: wi };
};

export type PublishMark = { channel: ContentChannel; by: string; url?: string; how?: string; at?: string };

/**
 * "Đánh dấu đã đăng": the owner posted it by hand. Needs an approved item; the proof (link or a note) is kept on the item and in the events log.
 * When every channel of the item is marked, the item becomes published.
 */
export const markPublished = async (db: Db, ws: string, itemId: string, m: PublishMark): Promise<{ allDone: boolean }> => {
  const item = await getItem(db, ws, itemId);
  if (!item) throw new Error("Không tìm thấy bài này.");
  if (item.status !== "approved" && item.status !== "published") throw new Error("Chỉ đánh dấu đã đăng cho bài đã được duyệt.");
  if (!item.channels.includes(m.channel)) throw new Error("Bài này không có kênh đó.");
  const url = (m.url ?? "").trim();
  const how = (m.how ?? "").trim() || "Đăng tay";
  if (url && !/^https?:\/\//i.test(url)) throw new Error("Đường dẫn bài đăng phải bắt đầu bằng http:// hoặc https://.");
  const at = m.at ?? new Date().toISOString();
  const mark: PublishedMark = { at, by: m.by, url, how };
  const published = { ...item.published, [m.channel]: mark };
  const allDone = item.channels.every((ch) => published[ch]);
  const { error } = await db.from("content_items").update({ published, ...(allDone ? { status: "published", published_at: at } : {}) }).eq("id", itemId).eq("workspace_id", ws).in("status", ["approved", "published"]);
  if (error) throw new Error(error.message);
  await addEvidence(db, ws, itemId, { kind: "published", by: m.by, text: `${m.by} đánh dấu đã đăng lên ${channelRule(m.channel).label}${url ? `: ${url}` : ` (${how})`}.`, at });
  await logEvidence(db, ws, { kind: "content.published", actor: m.by, summary: `Đã đăng "${item.title}" lên ${channelRule(m.channel).label}`, evidence: url || how });
  return { allDone };
};
