"use server";

import { revalidatePath } from "next/cache";
import { logEvidence } from "@/lib/core";
import { resumeWork, runWork, type EngineCtx } from "@/lib/engine";
import { requireManager, deciderOf } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Outcome } from "@/lib/types";
import {
  deleteReward, ensureProgram, loadMember, loadReward, reachOf, redeemedCount, saveProgram, saveReward, syncCustomersFromLeads, updateCustomer, type RewardEdit,
} from "@/lib/module-loyalty-core";
import { createCampaign, previewSegment, type SegmentPreview } from "@/lib/module-loyalty-promo";
import { getMemberDetail, type MemberDetail } from "@/lib/module-loyalty-queries";
import { REWARD_PRESETS, formatPoints, formatVndShort, redeemBlock, resolveSegment, type LoyaltyConfig } from "@/lib/module-loyalty-shared";

/* Loyalty workbench commands. The loyalty tables are written with the service role AFTER the member's role was checked; every action that reaches a customer
   or moves points still goes through the authority gate (runWork), exactly like the rest of NIVO. */

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};
const refresh = () => revalidatePath("/", "layout");

const ctxOf = async (): Promise<{ c: EngineCtx; session: Awaited<ReturnType<typeof getSession>> }> => {
  const session = await getSession();
  return { session, c: { db: supabaseAdmin(), ws: session.workspace.id, actor: session.userName, locale: "vi" } };
};

/* ------------------------------------------------------------------ programme */

/** The programme as the settings form shows it (any member may read it). */
export async function loadProgramAction(): Promise<Outcome<{ slug: string; name: string; enabled: boolean; config: LoyaltyConfig; rewards: Array<{ key: string; name: string }> }>> {
  return run(async () => {
    const { c } = await ctxOf();
    const p = await ensureProgram(c.db, c.ws);
    const rewards = ((await c.db.from("loyalty_rewards").select("key, name").eq("workspace_id", c.ws).eq("active", true).order("points_cost")).data ?? []) as Array<{ key: string; name: string }>;
    return { slug: p.slug, name: p.name, enabled: p.enabled, config: p.config, rewards };
  });
}

export async function saveProgramAction(input: { name?: string; enabled?: boolean; config?: LoyaltyConfig }): Promise<Outcome<{ saved: true }>> {
  return run(async () => {
    await requireManager();
    const { c } = await ctxOf();
    await saveProgram(c.db, c.ws, input);
    await logEvidence(c.db, c.ws, { kind: "loyalty.program_saved", actor: c.actor, summary: "Đã cập nhật chương trình khách hàng thân thiết." });
    refresh();
    return { saved: true as const };
  });
}

export async function syncMembersAction(): Promise<Outcome<{ created: number; linked: number }>> {
  return run(async () => {
    await requireManager();
    const { c } = await ctxOf();
    await ensureProgram(c.db, c.ws);
    const out = await syncCustomersFromLeads(c.db, c.ws);
    refresh();
    return out;
  });
}

/* ------------------------------------------------------------------ rewards */

export async function saveRewardAction(input: RewardEdit): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    await requireManager();
    const { c } = await ctxOf();
    const r = await saveReward(c.db, c.ws, input);
    refresh();
    return { id: r.id };
  });
}

export async function deleteRewardAction(id: string): Promise<Outcome<{ deleted: true }>> {
  return run(async () => {
    await requireManager();
    const { c } = await ctxOf();
    await deleteReward(c.db, c.ws, id);
    refresh();
    return { deleted: true as const };
  });
}

/** Start the catalogue from the data presets (resources/loyalty/reward-presets.json); existing rewards with the same key are left alone. */
export async function addPresetRewardsAction(): Promise<Outcome<{ added: number }>> {
  return run(async () => {
    await requireManager();
    const { c } = await ctxOf();
    let added = 0;
    for (const p of REWARD_PRESETS) {
      const exists = (await c.db.from("loyalty_rewards").select("id").eq("workspace_id", c.ws).eq("key", p.key).maybeSingle()).data;
      if (exists) continue;
      await saveReward(c.db, c.ws, { ...p, active: true });
      added += 1;
    }
    refresh();
    return { added };
  });
}

/* ------------------------------------------------------------------ members */

export async function loadMemberAction(id: string): Promise<Outcome<MemberDetail>> {
  return run(async () => {
    const d = await getMemberDetail(id);
    if (!d) throw new Error("Không tìm thấy khách này.");
    return d;
  });
}

export async function updateMemberAction(id: string, patch: { name?: string; birthday?: string | null; note?: string }): Promise<Outcome<{ saved: true }>> {
  return run(async () => {
    await requireManager();
    const { c } = await ctxOf();
    await updateCustomer(c.db, c.ws, id, patch);
    refresh();
    return { saved: true as const };
  });
}

/**
 * Manual correction of points: ALWAYS a decision (adjust_points is "ask"). A manager or owner doing it is the person who decides, so their own click is recorded as the
 * approval; a staff member's request waits for a manager. Returns "done" or "waiting".
 */
export async function adjustPointsAction(customerId: string, points: number, reason: string): Promise<Outcome<{ state: "done" | "waiting" }>> {
  return run(async () => {
    const { c, session } = await ctxOf();
    const m = await loadMember(c.db, c.ws, customerId);
    if (!m) throw new Error("Không tìm thấy khách này.");
    const pts = Math.round(points);
    if (!pts) throw new Error("Số điểm điều chỉnh phải khác 0.");
    if (!reason.trim()) throw new Error("Hãy ghi lý do điều chỉnh.");
    if (pts < 0 && m.points + pts < 0) throw new Error(`Khách chỉ có ${formatPoints(m.points)}, không trừ được ${formatPoints(-pts)}.`);
    const reach = await reachOf(c.db, c.ws, customerId);
    const item = await runWork(c, {
      action: "adjust_points", subject_type: "lead", subject_id: reach.leadId, lead_id: reach.leadId, origin: "live", dedupeKey: `adjust_points:${customerId}:${Date.now()}`, preset: true, noChain: true,
      seed: { summary: `${pts > 0 ? "Cộng" : "Trừ"} ${formatPoints(Math.abs(pts))} cho ${m.name}: ${reason.trim()}`, fields: { customer: m.name, customer_id: customerId, points: pts, reason: reason.trim().slice(0, 300) } },
    });
    let state: "done" | "waiting" = item.status === "done" ? "done" : "waiting";
    if (item.status === "waiting_decision" && (session.member.role === "owner" || session.member.role === "manager")) {
      const done = await resumeWork(c, item.id, "approved", {}, deciderOf(session.member), "Người chỉnh điểm cũng là người duyệt.");
      state = done.status === "done" ? "done" : "waiting";
    }
    refresh();
    return { state };
  });
}

/** Redeem a reward for a member from the workbench (at the counter): the same gate as a chat request (auto below the owner's limit, else a decision). */
export async function redeemForMemberAction(customerId: string, rewardId: string): Promise<Outcome<{ state: "done" | "waiting" | "failed"; summary: string }>> {
  return run(async () => {
    const { c } = await ctxOf();
    const [m, reward, program] = await Promise.all([loadMember(c.db, c.ws, customerId), loadReward(c.db, c.ws, rewardId), ensureProgram(c.db, c.ws)]);
    if (!m || !reward) throw new Error("Không tìm thấy khách hoặc phần quà này.");
    const block = redeemBlock(program.config, reward, { points: m.points, tierKey: m.tierKey, redeemedBefore: await redeemedCount(c.db, m.id, reward.id) });
    if (block) throw new Error(block);
    const reach = await reachOf(c.db, c.ws, customerId);
    const item = await runWork(c, {
      action: "redeem_reward", subject_type: "lead", subject_id: reach.leadId, lead_id: reach.leadId, origin: "live", dedupeKey: `redeem_reward:manual:${customerId}:${rewardId}:${Date.now()}`, preset: true, noChain: true,
      seed: {
        summary: `Đổi "${reward.name}" cho ${m.name} (${formatPoints(reward.pointsCost)}, trị giá ${formatVndShort(reward.valueVnd)})`, amount_vnd: reward.valueVnd,
        fields: { customer: m.name, customer_id: m.id, reward_id: reward.id, reward: reward.name, amount_vnd: reward.valueVnd, source: "workbench" },
      },
    });
    refresh();
    return { state: item.status === "done" ? "done" : item.status === "failed" ? "failed" : "waiting", summary: item.result?.summary ?? item.error ?? "Đang chờ bạn duyệt trong mục Chờ duyệt." };
  });
}

/* ------------------------------------------------------------------ promotions */

export async function previewSegmentAction(segment: unknown): Promise<Outcome<SegmentPreview>> {
  return run(async () => {
    const { c } = await ctxOf();
    return previewSegment(c.db, c.ws, resolveSegment(segment));
  });
}

/** "Gửi ưu đãi" for a segment: OpenClaw drafts the message, the gate (send_promo, ask by default) decides. Nothing is sent here. */
export async function createCampaignAction(input: { name: string; segment: unknown; brief: string }): Promise<Outcome<{ status: string; recipients: number; draft: string; generated: boolean; draftMs: number; reason: string | null }>> {
  return run(async () => {
    await requireManager();
    const { c, session } = await ctxOf();
    const out = await createCampaign(c, { name: input.name, segment: resolveSegment(input.segment), brief: input.brief, by: session.userName });
    refresh();
    return { status: out.status, recipients: out.recipients, draft: out.draft.text, generated: out.draft.generated, draftMs: out.draft.ms, reason: out.draft.reason };
  });
}
