import "server-only";
import { hhmmToMinutes, vnClock } from "./automation-hours";
import { runWork } from "./engine";
import { composeAndSend, engineCtxFor, loadLead, str, type Db, type Executor, type RunCtx, type RunResult } from "./automation-runs";
import type { PipelineRow } from "./automation-queries";
import type { PipelineConfig, TemplateDef } from "./automation-shared";
import { loadLedger, loadMember, loadMembers, loadProgram, loadReward, reachOf, type Program } from "./module-loyalty-core";
import { expiringSoon, formatPoints, tierOf, type Member } from "./module-loyalty-shared";

/**
 * The four loyalty automations (resources/automation-templates/loyalty_*.json), run by the same engine as every other automation (automation-engine.ts):
 *   loyalty_birthday   on the customer's birthday: the gift points (award_points through the gate) and a greeting
 *   loyalty_tier_up    when a purchase lifts the customer to a higher tier (fired by the award_points performer)
 *   loyalty_expiring   points that expire within the warning window
 *   loyalty_winback    a customer who has not bought for the number of days of THEIR tier (higher tiers are invited back sooner)
 * Every message goes through composeAndSend: the owner's rule for `send_promo` decides whether it leaves by itself or waits as a decision. Nothing is sent here directly.
 */
const skipped = (detail: string): RunResult => ({ status: "skipped", steps: [{ label: "Bỏ qua", status: "skipped", detail }] });

const dmy = (iso: string): string => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

type Target = { member: Member; leadId: string; conversationId: string; program: Program };

/** The customer, their lead and the conversation a message to them leaves on; or the reason there is none. */
const targetOf = async (x: RunCtx, customerId: string): Promise<Target | string> => {
  const [member, program] = await Promise.all([loadMember(x.db, x.ws, customerId), loadProgram(x.db, x.ws)]);
  if (!member || !program) return "Không tìm thấy khách trong chương trình.";
  const r = await reachOf(x.db, x.ws, customerId);
  if (!r.leadId || !r.conversationId) return `${member.name} chưa có cuộc trò chuyện nào để NIVO nhắn lại.`;
  if (r.handledBy) return `Đang có nhân viên trực tiếp trả lời ${member.name}.`;
  return { member, leadId: r.leadId, conversationId: r.conversationId, program };
};

const send = async (x: RunCtx, t: Target, a: { dedupe: string; summary: string; caseNote: string; vars: Record<string, string>; forceAsk?: boolean }): Promise<RunResult> => {
  const lead = await loadLead(x.db, x.ws, t.leadId);
  if (!lead) return skipped("Không tìm thấy khách.");
  return composeAndSend(x, {
    action: "send_promo", lead, conversationId: t.conversationId, dedupe: a.dedupe, summary: a.summary, caseNote: a.caseNote, forceAsk: a.forceAsk,
    vars: { ten_khach: t.member.name, diem: t.member.points.toLocaleString("vi-VN"), hang: tierOf(t.program.config, t.member.tierKey)?.name ?? "", ...a.vars },
  });
};

/** Template: birthday gift and greeting. */
export const loyaltyBirthday: Executor = async (x, p) => {
  const customerId = str(p.customer_id);
  const t = await targetOf(x, customerId);
  const steps: RunResult["steps"][number][] = [];
  const bd = (typeof t === "string" ? null : t.program.config.birthday) ?? (await loadProgram(x.db, x.ws))?.config.birthday;
  const member = typeof t === "string" ? await loadMember(x.db, x.ws, customerId) : t.member;
  if (!member || !bd?.enabled) return skipped("Quà sinh nhật đang tắt hoặc không tìm thấy khách.");
  let gift = "";
  if (bd.points > 0) {
    const item = await runWork(engineCtxFor(x), {
      action: "award_points", subject_type: "lead", subject_id: null, lead_id: null, origin: "live", dedupeKey: `award_points:birthday:${customerId}:${str(p.year)}`, preset: true, noChain: true,
      seed: { summary: `Tặng ${formatPoints(bd.points)} sinh nhật cho ${member.name}`, fields: { customer: member.name, customer_id: customerId, mode: "bonus", points: bd.points, ref: `birthday:${customerId}:${str(p.year)}`, reason: "Quà sinh nhật" } },
    });
    steps.push({ label: item.status === "done" ? `Đã cộng ${formatPoints(bd.points)} điểm thưởng sinh nhật` : `Điểm thưởng sinh nhật: ${item.status === "waiting_decision" ? "chờ bạn duyệt" : item.status}`, status: item.status === "done" ? "done" : item.status === "waiting_decision" ? "waiting" : "failed", workItemId: item.id });
    gift = `${formatPoints(bd.points)} thưởng vào tài khoản điểm`;
  }
  const reward = bd.rewardKey ? (await x.db.from("loyalty_rewards").select("id").eq("workspace_id", x.ws).eq("key", bd.rewardKey).maybeSingle()).data as { id: string } | null : null;
  const rw = reward ? await loadReward(x.db, x.ws, reward.id) : null;
  if (rw) gift = `${gift ? `${gift}, ` : ""}bạn có thể dùng điểm đổi "${rw.name}"`;
  if (!gift) gift = bd.note || "lời chúc tốt đẹp nhất";
  if (typeof t === "string") return { status: steps.length ? "done" : "skipped", steps: [...steps, { label: "Bỏ qua tin nhắn", status: "skipped", detail: t }] };
  const sent = await send(x, t, { dedupe: `birthday:${customerId}:${str(p.year)}`, summary: `Chúc mừng sinh nhật ${t.member.name}`, caseNote: `Hôm nay là sinh nhật của khách. Quà: ${gift}.`, vars: { uu_dai: gift } });
  return { ...sent, steps: [...steps, ...sent.steps] };
};

/** Template: the customer reached a higher tier. */
export const loyaltyTierUp: Executor = async (x, p) => {
  const t = await targetOf(x, str(p.customer_id));
  if (typeof t === "string") return skipped(t);
  const tier = tierOf(t.program.config, str(p.tier_key));
  if (!tier) return skipped("Hạng này không còn trong chương trình.");
  return send(x, t, { dedupe: `tier:${t.member.id}:${tier.key}`, summary: `Chúc mừng ${t.member.name} lên hạng ${tier.name}`, caseNote: `Khách vừa lên hạng ${tier.name}. Quyền lợi: ${tier.benefit}`, vars: { hang: tier.name, uu_dai: tier.benefit } });
};

/** Template: points about to expire. */
export const loyaltyExpiring: Executor = async (x, p) => {
  const t = await targetOf(x, str(p.customer_id));
  if (typeof t === "string") return skipped(t);
  const points = Number(p.points) || 0;
  if (points <= 0) return skipped("Không còn điểm nào sắp hết hạn.");
  return send(x, t, {
    dedupe: `expiring:${t.member.id}:${str(p.first_at).slice(0, 10)}`, summary: `Báo ${t.member.name} có ${formatPoints(points)} sắp hết hạn`,
    caseNote: `Khách có ${formatPoints(points)} sắp hết hạn vào ${dmy(str(p.first_at))}.`, vars: { diem: points.toLocaleString("vi-VN"), han: dmy(str(p.first_at)) },
  });
};

/** Template: invite a customer back (always asks the owner), tied to the customer's tier. */
export const loyaltyWinback: Executor = async (x, p) => {
  const t = await targetOf(x, str(p.customer_id));
  if (typeof t === "string") return skipped(t);
  const offer = str(x.config.offer) || "ưu đãi dành riêng cho bạn";
  return send(x, t, {
    dedupe: str(p.dedupe), summary: `Mời ${t.member.name} quay lại`, forceAsk: true,
    caseNote: `Khách hạng ${tierOf(t.program.config, t.member.tierKey)?.name ?? ""} đã ${str(p.days)} ngày chưa quay lại. Ưu đãi: ${offer}.`, vars: { uu_dai: offer },
  });
};

export const LOYALTY_EXECUTORS: Readonly<Record<string, Executor>> = {
  loyalty_birthday: loyaltyBirthday, loyalty_tier_up: loyaltyTierUp, loyalty_expiring: loyaltyExpiring, loyalty_winback: loyaltyWinback,
};

/* ------------------------------------------------------------------ scans (the minute tick) */

type Loaded = { p: PipelineRow; def: TemplateDef; config: PipelineConfig };
export type Trigger = (dedupe: string, ref: string, payload: Record<string, unknown>) => Promise<void>;

const memberCache = new Map<string, { at: number; value: Promise<Array<Member>> }>();
const membersOf = (db: Db, ws: string, now: Date): Promise<Array<Member>> => {
  const hit = memberCache.get(ws);
  if (hit && now.getTime() - hit.at < 30_000) return hit.value;
  const value = loadMembers(db, ws);
  memberCache.set(ws, { at: now.getTime(), value });
  return value;
};

const BATCH = 8;

/** Which loyalty customers does this template's trigger apply to right now? Starts at most BATCH runs per tick. */
export const scanLoyalty = async (db: Db, l: Loaded, now: Date, trigger: Trigger): Promise<number> => {
  const ws = l.p.workspace_id;
  const program = await loadProgram(db, ws);
  if (!program?.enabled) return 0;
  const clock = vnClock(now);
  // Messages only go out inside the allowed hours (Vietnam time), like every promotion.
  if (clock.minute < hhmmToMinutes(program.config.promo.hourFrom) || clock.minute >= hhmmToMinutes(program.config.promo.hourTo)) return 0;
  const members = await membersOf(db, ws, now);
  let started = 0;
  if (l.def.key === "loyalty_birthday") {
    if (!program.config.birthday.enabled) return 0;
    const mmdd = clock.day.slice(5);
    for (const m of members) {
      if (started >= BATCH) break;
      if (!m.birthday || m.birthday.slice(5) !== mmdd) continue;
      await trigger(`birthday:${m.id}:${clock.day.slice(0, 4)}`, m.id, { customer_id: m.id, year: clock.day.slice(0, 4) });
      started += 1;
    }
    return started;
  }
  if (l.def.key === "loyalty_expiring") {
    const horizon = new Date(now.getTime() + program.config.expiry.warnDays * 86_400_000).toISOString();
    if (program.config.expiry.months <= 0) return 0;
    const rows = ((await db.from("loyalty_ledger").select("customer_id").eq("workspace_id", ws).eq("kind", "earn").gt("expires_at", now.toISOString()).lte("expires_at", horizon).limit(500)).data ?? []) as Array<{ customer_id: string }>;
    for (const id of [...new Set(rows.map((r) => r.customer_id))]) {
      if (started >= BATCH) break;
      const e = expiringSoon(await loadLedger(db, ws, id, 2000), now, program.config.expiry.warnDays);
      if (e.points <= 0 || !e.firstAt) continue;
      await trigger(`expiring:${id}:${e.firstAt.slice(0, 10)}`, id, { customer_id: id, points: e.points, first_at: e.firstAt });
      started += 1;
    }
    return started;
  }
  if (l.def.key === "loyalty_winback") {
    const month = clock.day.slice(0, 7);
    const cands = members.filter((m) => m.visits > 0 && m.lastVisitAt);
    const due = cands.filter((m) => {
      const days = tierOf(program.config, m.tierKey)?.winbackDays ?? 60;
      return now.getTime() - Date.parse(m.lastVisitAt as string) >= days * 86_400_000;
    });
    if (!due.length) return 0;
    const prior = ((await db.from("automation_runs").select("trigger_ref, status, created_at").eq("pipeline_id", l.p.id).in("trigger_ref", due.map((m) => m.id)).limit(2000)).data ?? []) as Array<{ trigger_ref: string; status: string; created_at: string }>;
    for (const m of due) {
      if (started >= BATCH) break;
      const days = tierOf(program.config, m.tierKey)?.winbackDays ?? 60;
      const mine = prior.filter((r) => r.trigger_ref === m.id);
      if (mine.some((r) => ["waiting_approval", "queued", "running"].includes(r.status))) continue;
      if (mine.some((r) => r.status !== "skipped" && r.status !== "failed" && now.getTime() - Date.parse(r.created_at) < days * 86_400_000)) continue;
      await trigger(`winback:${m.id}:${month}`, m.id, { customer_id: m.id, dedupe: `winback:${m.id}:${month}`, days: Math.floor((now.getTime() - Date.parse(m.lastVisitAt as string)) / 86_400_000) });
      started += 1;
    }
    return started;
  }
  return 0;
};

