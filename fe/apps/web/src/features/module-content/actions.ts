"use server";

import { revalidatePath } from "next/cache";
import { drainAfter, engineCtx } from "@/lib/flow-ctx";
import { requireManager } from "@/lib/permissions";
import { supabaseServer } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import type { Outcome } from "@/lib/types";
import { draftItem, planMonth, quickDraft } from "@/lib/module-content-ai";
import { markPublished, requestPublish } from "@/lib/module-content-publish";
import {
  cleanHashtags, isContentChannel, parseMonth, PILLAR_PRESETS, CADENCE_PRESETS, type AutomationKey, type ContentChannel, type LinkRef, type MediaRef, type Variants,
} from "@/lib/module-content-shared";
import { addEvidence, ensurePillars, getItem, saveSettings } from "@/lib/module-content-store";
import { runContentTick } from "@/lib/module-content-tick";
import { supabaseAdmin } from "@/lib/supabase/admin";

/* Commands of the content workbench. Owner or manager only; every row is scoped to the signed-in workspace and RLS checks it again. */

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};
const refresh = () => revalidatePath("/", "layout");

const ctx = async () => {
  const member = await requireManager();
  const session = await getSession();
  return { ws: session.workspace.id, who: member.displayName, db: await supabaseServer() };
};

const channelsOf = (v: ReadonlyArray<string>): Array<ContentChannel> => {
  const out = [...new Set(v.filter(isContentChannel))];
  if (!out.length) throw new Error("Chọn ít nhất một kênh.");
  return out;
};

export type DraftSummary = { warnings: ReadonlyArray<string>; seconds: number; itemId: string };

/** "Lên kế hoạch tháng": one OpenClaw call -> ideas for the month. `ym` is yyyy-mm. */
export async function planMonthAction(ym: string): Promise<Outcome<{ ideas: number; seconds: number; skippedPast: number }>> {
  return run(async () => {
    const { ws, who, db } = await ctx();
    const p = parseMonth(ym);
    if (!p) throw new Error("Tháng không hợp lệ.");
    const r = await planMonth(db, ws, { y: p.y, m: p.m, actor: who });
    if (!r.ok) throw new Error(r.error);
    refresh();
    return { ideas: r.ideas, seconds: Math.round(r.ms / 1000), skippedPast: r.skippedPast };
  });
}

/** "Ý tưởng nhanh": a pasted topic becomes a post drafted for the chosen channels. */
export async function quickDraftAction(topic: string, channels: ReadonlyArray<string>): Promise<Outcome<DraftSummary>> {
  return run(async () => {
    const { ws, who, db } = await ctx();
    const r = await quickDraft(db, ws, topic, channelsOf(channels), who);
    if (!r.ok) throw new Error(r.error);
    refresh();
    return { warnings: r.warnings, seconds: Math.round(r.ms / 1000), itemId: r.item.id };
  });
}

/** Write (or rewrite) the channel variants of one item. */
export async function draftItemAction(id: string, hint?: string): Promise<Outcome<DraftSummary>> {
  return run(async () => {
    const { ws, who, db } = await ctx();
    const r = await draftItem(db, ws, id, who, { hint: hint?.trim() || undefined });
    if (!r.ok) throw new Error(r.error);
    refresh();
    return { warnings: r.warnings, seconds: Math.round(r.ms / 1000), itemId: id };
  });
}

export type NewItemInput = { title: string; scheduledAt: string | null; channels: ReadonlyArray<string>; pillarId: string | null };

export async function createItemAction(input: NewItemInput): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    const { ws, who, db } = await ctx();
    const title = input.title.trim();
    if (!title) throw new Error("Nhập tiêu đề hoặc ý tưởng của bài.");
    const { data, error } = await db.from("content_items").insert({
      workspace_id: ws, title: title.slice(0, 200), brief: "", channels: channelsOf(input.channels), pillar_id: input.pillarId, scheduled_at: input.scheduledAt, status: "idea", source: "manual", created_by: who,
      evidence: [{ at: new Date().toISOString(), kind: "created", by: who, text: "Tạo thủ công." }],
    }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Không tạo được bài.");
    refresh();
    return { id: (data as { id: string }).id };
  });
}

export type ItemPatch = {
  title?: string; brief?: string; pillarId?: string | null; channels?: ReadonlyArray<string>; scheduledAt?: string | null;
  variants?: Variants; hashtags?: ReadonlyArray<string>; links?: ReadonlyArray<LinkRef>; media?: ReadonlyArray<MediaRef>;
};

/** Edit an idea or a draft. Once a post is waiting for approval, approved or published its text is frozen: reopen it first. */
export async function saveItemAction(id: string, patch: ItemPatch): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    const { ws, who, db } = await ctx();
    const item = await getItem(db, ws, id);
    if (!item) throw new Error("Không tìm thấy bài này.");
    const open = item.status === "idea" || item.status === "draft";
    const row: Record<string, unknown> = {};
    if (patch.scheduledAt !== undefined && item.status !== "published") row.scheduled_at = patch.scheduledAt;
    if (patch.pillarId !== undefined && open) row.pillar_id = patch.pillarId;
    if (open) {
      if (patch.title !== undefined) { const t = patch.title.trim(); if (!t) throw new Error("Tiêu đề không được để trống."); row.title = t.slice(0, 200); }
      if (patch.brief !== undefined) row.brief = patch.brief.slice(0, 4000);
      if (patch.channels !== undefined) row.channels = channelsOf(patch.channels);
      if (patch.variants !== undefined) {
        const next: Variants = {};
        for (const [k, v] of Object.entries(patch.variants)) if (isContentChannel(k) && v) next[k] = { text: String(v.text ?? "").slice(0, 6000), hashtags: cleanHashtags(v.hashtags ?? []), note: String(v.note ?? "").slice(0, 600) };
        row.variants = next;
      }
      if (patch.hashtags !== undefined) row.hashtags = cleanHashtags(patch.hashtags);
      if (patch.links !== undefined) row.links = patch.links.filter((l) => /^https?:\/\//i.test(l.url)).slice(0, 10).map((l) => ({ url: l.url.trim(), label: (l.label ?? "").slice(0, 80) }));
      if (patch.media !== undefined) row.media = patch.media.slice(0, 10);
      if (row.variants !== undefined && item.status === "idea" && Object.values(row.variants as Variants).some((v) => v?.text)) { row.status = "draft"; row.drafted_at = new Date().toISOString(); }
    } else if (Object.keys(row).length === 0) {
      throw new Error("Bài đã gửi duyệt hoặc đã đăng nên không sửa nội dung được. Đưa về bản nháp để sửa.");
    }
    if (!Object.keys(row).length) return { id };
    const { error } = await db.from("content_items").update(row).eq("id", id).eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    if (open && (row.variants !== undefined || row.title !== undefined)) await addEvidence(db, ws, id, { kind: "edited", by: who, text: `${who} sửa nội dung.` });
    refresh();
    return { id };
  });
}

/** Drag on the calendar: only the date and time change. The time of day is kept unless a new one is given. */
export async function moveItemAction(id: string, scheduledAt: string): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    const { ws, who, db } = await ctx();
    if (Number.isNaN(Date.parse(scheduledAt))) throw new Error("Ngày giờ không hợp lệ.");
    const item = await getItem(db, ws, id);
    if (!item) throw new Error("Không tìm thấy bài này.");
    if (item.status === "published") throw new Error("Bài đã đăng, không đổi lịch được.");
    const { error } = await db.from("content_items").update({ scheduled_at: scheduledAt }).eq("id", id).eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    await addEvidence(db, ws, id, { kind: "rescheduled", by: who, text: `${who} đổi lịch đăng.` });
    refresh();
    return { id };
  });
}

type Transition = "skip" | "restore" | "reopen" | "delete";

/** skip: idea/draft/approved -> skipped; restore: skipped -> idea or draft; reopen: approved -> draft (needs approval again); delete: idea/draft/skipped only. */
export async function transitionItemAction(id: string, t: Transition): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    const { ws, who, db } = await ctx();
    const item = await getItem(db, ws, id);
    if (!item) throw new Error("Không tìm thấy bài này.");
    if (t === "delete") {
      if (!["idea", "draft", "skipped"].includes(item.status)) throw new Error("Chỉ xóa được ý tưởng, bản nháp hoặc bài đã bỏ qua.");
      const { error } = await db.from("content_items").delete().eq("id", id).eq("workspace_id", ws);
      if (error) throw new Error(error.message);
    } else {
      const next = t === "skip" ? (["idea", "draft", "approved"].includes(item.status) ? "skipped" : null)
        : t === "restore" ? (item.status === "skipped" ? (Object.values(item.variants).some((v) => v?.text) ? "draft" : "idea") : null)
        : item.status === "approved" ? "draft" : null;
      if (!next) throw new Error("Không đổi được trạng thái bài này từ trạng thái hiện tại.");
      const { error } = await db.from("content_items").update({ status: next, ...(t === "reopen" ? { approved_by: null, approved_at: null } : {}) }).eq("id", id).eq("workspace_id", ws);
      if (error) throw new Error(error.message);
      await addEvidence(db, ws, id, { kind: t, by: who, text: t === "skip" ? `${who} bỏ qua bài này.` : t === "restore" ? `${who} khôi phục bài.` : `${who} đưa bài về bản nháp (cần duyệt lại).` });
    }
    refresh();
    return { id };
  });
}

/** Send a draft for approval: the gate decides (publish_post is always "ask"); the decision shows in the queue and on Decisions. */
export async function submitForApprovalAction(id: string): Promise<Outcome<{ id: string; workItemId: string }>> {
  return run(async () => {
    await requireManager();
    const c = await engineCtx();
    const { workItem } = await requestPublish(c, id);
    drainAfter(c);
    refresh();
    return { id, workItemId: workItem.id };
  });
}

/** "Đánh dấu đã đăng": the owner posted it by hand; the link (or a note) is the evidence. */
export async function markPublishedAction(id: string, channel: string, url: string, how: string): Promise<Outcome<{ allDone: boolean }>> {
  return run(async () => {
    const { ws, who, db } = await ctx();
    if (!isContentChannel(channel)) throw new Error("Kênh không hợp lệ.");
    const r = await markPublished(db, ws, id, { channel, by: who, url, how });
    refresh();
    return r;
  });
}

/* ------------------------------------------------------------------ settings */

export type PillarInput = { id?: string; name: string; description: string; weight: number; active: boolean };

export async function savePillarsAction(rows: ReadonlyArray<PillarInput>): Promise<Outcome<{ n: number }>> {
  return run(async () => {
    const { ws, db } = await ctx();
    const clean = rows.map((r, i) => ({ id: r.id, name: r.name.trim().slice(0, 80), description: r.description.trim().slice(0, 300), weight: Math.max(0, Math.min(20, Math.round(r.weight))), active: r.active, sort: i })).filter((r) => r.name);
    const names = clean.map((r) => r.name.toLowerCase());
    if (new Set(names).size !== names.length) throw new Error("Hai chủ đề không được trùng tên.");
    const keep = clean.filter((r) => r.id).map((r) => r.id as string);
    const cur = await db.from("content_pillars").select("id").eq("workspace_id", ws);
    const drop = ((cur.data ?? []) as Array<{ id: string }>).map((r) => r.id).filter((x) => !keep.includes(x));
    if (drop.length) await db.from("content_pillars").delete().in("id", drop).eq("workspace_id", ws);
    for (const r of clean) {
      const body = { workspace_id: ws, name: r.name, description: r.description, weight: r.weight, active: r.active, sort: r.sort };
      const res = r.id ? await db.from("content_pillars").update(body).eq("id", r.id).eq("workspace_id", ws) : await db.from("content_pillars").insert(body);
      if (res.error) throw new Error(res.error.message);
    }
    refresh();
    return { n: clean.length };
  });
}

export async function applyPillarPresetsAction(): Promise<Outcome<{ n: number }>> {
  return run(async () => {
    const { ws, db } = await ctx();
    const rows = await ensurePillars(db, ws, PILLAR_PRESETS);
    refresh();
    return { n: rows.length };
  });
}

export type CadenceInput = { channel: string; postsPerWeek: number; days: ReadonlyArray<number>; time: string };

export async function saveCadenceAction(rows: ReadonlyArray<CadenceInput>): Promise<Outcome<{ n: number }>> {
  return run(async () => {
    const { ws, db } = await ctx();
    const clean = rows.filter((r) => isContentChannel(r.channel)).map((r) => {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)) throw new Error("Giờ đăng phải có dạng 19:30.");
      const days = [...new Set(r.days.filter((d) => d >= 1 && d <= 7))].sort();
      return { workspace_id: ws, channel: r.channel, posts_per_week: Math.max(0, Math.min(21, Math.round(r.postsPerWeek))), days, post_time: r.time };
    });
    const { error } = await db.from("content_cadence").upsert(clean, { onConflict: "workspace_id,channel" });
    if (error) throw new Error(error.message);
    const keep = clean.map((r) => r.channel);
    await db.from("content_cadence").delete().eq("workspace_id", ws).not("channel", "in", `(${keep.join(",")})`);
    refresh();
    return { n: clean.length };
  });
}

export async function applyCadencePresetsAction(): Promise<Outcome<{ n: number }>> {
  return saveCadenceAction(CADENCE_PRESETS.map((c) => ({ channel: c.channel, postsPerWeek: c.posts_per_week, days: c.days, time: c.time })));
}

export async function saveBrandAction(input: { brandVoice: string; avoid: string; cta: string; hashtags: string }): Promise<Outcome<{ ok: true }>> {
  return run(async () => {
    const { ws, db } = await ctx();
    await saveSettings(db, ws, { brand_voice: input.brandVoice.trim().slice(0, 1500), avoid: input.avoid.trim().slice(0, 1500), cta: input.cta.trim().slice(0, 300), hashtags: input.hashtags.split(/[\s,]+/).filter(Boolean).slice(0, 15) });
    refresh();
    return { ok: true as const };
  });
}

export async function setAutomationAction(key: AutomationKey, on: boolean): Promise<Outcome<{ key: AutomationKey; on: boolean }>> {
  return run(async () => {
    const { ws, db } = await ctx();
    if (!["today_reminder", "offer_draft", "weekly_summary"].includes(key)) throw new Error("Tự động không hợp lệ.");
    await saveSettings(db, ws, { automations: { [key]: on } as Record<AutomationKey, boolean> });
    refresh();
    return { key, on };
  });
}

/** "Chạy thử ngay": run the switched-on automations for this workspace once now, ignoring the time window (writes Office messages and drafts only). */
export async function runAutomationsNowAction(): Promise<Outcome<{ did: ReadonlyArray<string> }>> {
  return run(async () => {
    const { ws } = await ctx();
    const done = await runContentTick(supabaseAdmin(), { only: ws, force: true });
    refresh();
    return { did: done.map((d) => d.did) };
  });
}
