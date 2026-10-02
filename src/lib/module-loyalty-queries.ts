import "server-only";
import { getSession } from "./session";
import { supabaseAdmin } from "./supabase/admin";
import { loadCampaigns, type CampaignView } from "./module-loyalty-promo";
import {
  ensureProgram, loadLedger, loadMember, loadMembers, loadRewards, reachOf, redeemedCount, type Reach,
} from "./module-loyalty-core";
import {
  expiringSoon, nextTier, redeemBlock, tierOf, type LedgerRow, type LoyaltyConfig, type Member, type Reward,
} from "./module-loyalty-shared";

/**
 * What the loyalty workbench (/m/loyalty/workbench) and the settings card read. Server only: it uses the service role, scoped to the signed-in member's workspace
 * (the loyalty tables are readable by members and writable only by the server).
 */
export type LoyaltyStats = {
  members: number;
  /** Members who bought in the last 90 days. */
  active90d: number;
  pointsOutstanding: number;
  earned30d: number;
  redeemed30d: number;
  expired30d: number;
  redemptions30d: number;
  /** Spend of members in the last 30 days (earn rows with the purchase amount). */
  spend30d: number;
  /** Cash value of the rewards given in the last 30 days. */
  rewardValue30d: number;
  promosSent30d: number;
  birthdaysThisMonth: number;
  tierCounts: Array<{ key: string; name: string; count: number }>;
};

export type PendingItem = {
  id: string; action: "award_points" | "redeem_reward" | "send_promo" | "adjust_points"; summary: string; draft: string; reason: string | null;
  amountVnd: number | null; createdAt: string; customer: string;
};

export type LoyaltyWorkbenchData = {
  program: { slug: string; name: string; enabled: boolean; config: LoyaltyConfig };
  stats: LoyaltyStats;
  members: Array<Member>;
  rewards: Array<Reward>;
  campaigns: Array<CampaignView>;
  pending: Array<PendingItem>;
  canManage: boolean;
  nowIso: string;
};

const DAY = 86_400_000;
const LOYALTY_ACTIONS = ["award_points", "redeem_reward", "send_promo", "adjust_points"] as const;

export const computeStats = (members: ReadonlyArray<Member>, ledger: ReadonlyArray<{ kind: string; points: number; amount_vnd: number | null; occurred_at: string }>, config: LoyaltyConfig, promosSent30d: number, now: Date): LoyaltyStats => {
  const since = now.getTime() - 30 * DAY;
  const recent = ledger.filter((l) => Date.parse(l.occurred_at) >= since);
  const month = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", month: "numeric" }).format(now));
  return {
    members: members.length,
    active90d: members.filter((m) => m.lastVisitAt && now.getTime() - Date.parse(m.lastVisitAt) <= 90 * DAY).length,
    pointsOutstanding: members.reduce((n, m) => n + m.points, 0),
    earned30d: recent.filter((l) => l.kind === "earn").reduce((n, l) => n + l.points, 0),
    redeemed30d: recent.filter((l) => l.kind === "redeem").reduce((n, l) => n - l.points, 0),
    expired30d: recent.filter((l) => l.kind === "expire").reduce((n, l) => n - l.points, 0),
    redemptions30d: recent.filter((l) => l.kind === "redeem").length,
    spend30d: recent.filter((l) => l.kind === "earn").reduce((n, l) => n + Number(l.amount_vnd ?? 0), 0),
    rewardValue30d: recent.filter((l) => l.kind === "redeem").reduce((n, l) => n + Number(l.amount_vnd ?? 0), 0),
    promosSent30d,
    birthdaysThisMonth: members.filter((m) => m.birthday && Number(m.birthday.slice(5, 7)) === month).length,
    tierCounts: config.tiers.map((t) => ({ key: t.key, name: t.name, count: members.filter((m) => m.tierKey === t.key).length })),
  };
};

export const getLoyaltyWorkbench = async (): Promise<LoyaltyWorkbenchData> => {
  const session = await getSession();
  const ws = session.workspace.id;
  const db = supabaseAdmin();
  const now = new Date();
  const program = await ensureProgram(db, ws);
  const since30 = new Date(now.getTime() - 30 * DAY).toISOString();
  const [members, rewards, campaigns, ledger, sends, items] = await Promise.all([
    loadMembers(db, ws),
    loadRewards(db, ws),
    loadCampaigns(db, ws, 20),
    db.from("loyalty_ledger").select("kind, points, amount_vnd, occurred_at").eq("workspace_id", ws).gte("occurred_at", since30).limit(5000),
    db.from("loyalty_sends").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "sent").gte("sent_at", since30),
    db.from("work_items").select("id, action, proposal, reason, created_at").eq("workspace_id", ws).eq("status", "waiting_decision").in("action", [...LOYALTY_ACTIONS]).order("created_at", { ascending: false }).limit(50),
  ]);
  const stats = computeStats(members, (ledger.data ?? []) as Array<{ kind: string; points: number; amount_vnd: number | null; occurred_at: string }>, program.config, sends.count ?? 0, now);
  const pending = ((items.data ?? []) as Array<{ id: string; action: PendingItem["action"]; proposal: { summary?: string; draft?: string; amount_vnd?: number | null; fields?: Record<string, unknown> }; reason: string | null; created_at: string }>).map((r) => ({
    id: r.id, action: r.action, summary: r.proposal.summary ?? "", draft: r.proposal.draft ?? "", reason: r.reason, amountVnd: typeof r.proposal.amount_vnd === "number" ? r.proposal.amount_vnd : null,
    createdAt: r.created_at, customer: String(r.proposal.fields?.customer ?? ""),
  }));
  return {
    program: { slug: program.slug, name: program.name, enabled: program.enabled, config: program.config },
    stats, members, rewards, campaigns, pending, canManage: session.member.role === "owner" || session.member.role === "manager", nowIso: now.toISOString(),
  };
};

export type MemberDetail = {
  member: Member;
  ledger: Array<LedgerRow>;
  reach: Reach;
  tierName: string | null;
  nextTier: { name: string; missingVnd: number } | null;
  expiring: { points: number; firstAt: string | null };
  rewards: Array<{ reward: Reward; block: string | null }>;
};

/** One member with the ledger timeline and what they can redeem now. Null when the id is not in the signed-in workspace. */
export const getMemberDetail = async (id: string): Promise<MemberDetail | null> => {
  const session = await getSession();
  const ws = session.workspace.id;
  const db = supabaseAdmin();
  const [member, program, rewards] = await Promise.all([loadMember(db, ws, id), ensureProgram(db, ws), loadRewards(db, ws, true)]);
  if (!member) return null;
  const [ledger, reach] = await Promise.all([loadLedger(db, ws, id, 200), reachOf(db, ws, id)]);
  const cfg = program.config;
  const next = nextTier(cfg, member.lifetimeSpendVnd);
  const checks: MemberDetail["rewards"] = [];
  for (const r of rewards) checks.push({ reward: r, block: redeemBlock(cfg, r, { points: member.points, tierKey: member.tierKey, redeemedBefore: await redeemedCount(db, id, r.id) }) });
  return {
    member, ledger, reach, tierName: tierOf(cfg, member.tierKey)?.name ?? null, nextTier: next ? { name: next.tier.name, missingVnd: next.missingVnd } : null,
    expiring: cfg.expiry.months > 0 ? expiringSoon(await loadLedger(db, ws, id, 2000), new Date(), cfg.expiry.warnDays) : { points: 0, firstAt: null }, rewards: checks,
  };
};
