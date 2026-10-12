// PORTED from src/lib/usage.ts + src/lib/usage-shared.ts (keep in sync by hand): the service-role half the knowledge jobs need.
// Same table (ai_usage_events), same RPC (ai_quota_status), same price table, same blocking rules, same owner notice (ai_usage_notices + messages).
// Differences: the database client is passed in (no supabaseAdmin()), and there is no AsyncLocalStorage scope: every call names its workspace.
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;

export type UsageKind = "chat_reply" | "setup" | "owner_chat" | "relay" | "embedding" | "engine" | "guide" | "brain" | "office_command";
export type UsageModule = string;

/* ------------------------------------------------------------------ prices */

/** USD per 1M tokens, used only when the provider returns no cost (same table as the web). */
const PRICES: ReadonlyArray<{ readonly match: string; readonly in: number; readonly out: number }> = [
  { match: "deepseek", in: 0.14, out: 0.28 },
  { match: "qwen3-embedding", in: 0.01, out: 0 },
  { match: "text-embedding-3-small", in: 0.02, out: 0 },
  { match: "text-embedding-3-large", in: 0.13, out: 0 },
];
const DEFAULT_PRICE = { in: 0.3, out: 1.2 };

export const priceOf = (model: string, promptTokens: number, completionTokens: number): number => {
  const p = PRICES.find((x) => model.toLowerCase().includes(x.match)) ?? DEFAULT_PRICE;
  return (promptTokens * p.in + completionTokens * p.out) / 1_000_000;
};

export const estimateTokens = (chars: number): number => Math.max(1, Math.ceil(chars / 3));

/* ------------------------------------------------------------------ recording */

export type ProviderUsage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number; cached_tokens?: number } | null | undefined;

export type UsageInput = {
  readonly workspaceId: string;
  readonly kind: UsageKind;
  readonly module: UsageModule;
  readonly model: string;
  readonly usage?: ProviderUsage;
  readonly promptChars?: number;
  readonly completionChars?: number;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Record one model call. Never throws (metering must not break the job). After the write the owner is told once at 80% and at 100%. */
export const recordUsage = async (db: Db, u: UsageInput): Promise<void> => {
  try {
    const prompt = num(u.usage?.prompt_tokens);
    const completion = num(u.usage?.completion_tokens);
    const total = num(u.usage?.total_tokens);
    const estimated = prompt === null && completion === null && total === null;
    const promptTokens = estimated ? estimateTokens(u.promptChars ?? 0) : prompt ?? Math.max(0, (total ?? 0) - (completion ?? 0));
    const completionTokens = estimated ? (u.completionChars ? estimateTokens(u.completionChars) : 0) : completion ?? Math.max(0, (total ?? 0) - promptTokens);
    const cost = num(u.usage?.cost) ?? priceOf(u.model, promptTokens, completionTokens);
    const { error } = await db.from("ai_usage_events").insert({
      workspace_id: u.workspaceId, kind: u.kind, module: u.module, model: u.model.slice(0, 120),
      prompt_tokens: Math.round(promptTokens), completion_tokens: Math.round(completionTokens), cost_usd: Number(cost.toFixed(8)), estimated,
    });
    if (error) {
      console.error("usage record failed:", error.message);
      return;
    }
    const s = await quotaStatus(db, u.workspaceId);
    if (s && s.level !== "ok") await notifyOwner(db, u.workspaceId, s);
  } catch (e) {
    console.error("usage record failed:", e instanceof Error ? e.message : String(e));
  }
};

/* ------------------------------------------------------------------ quota */

const WARN_AT = 0.8;
const CREDITS_PER_USD = 250;
const creditsOf = (costUsd: number): number => Math.round(costUsd * CREDITS_PER_USD * 100) / 100;

export type QuotaStatus = {
  readonly periodStart: string;
  readonly messagesUsed: number;
  readonly tokensUsed: number;
  readonly messagesLimit: number | null;
  readonly tokensLimit: number | null;
  readonly creditsUsed: number;
  readonly creditsLimit: number | null;
  readonly topupBalance: number;
  readonly messagesExceeded: boolean;
  readonly tokensExceeded: boolean;
  readonly creditsExceeded: boolean;
  readonly ratio: number;
  readonly level: "ok" | "warn" | "exceeded";
};

type StatusRow = {
  period_start: string; messages_used: number; tokens_used: number; cost_usd: number; messages_limit: number | null; tokens_limit: number | null;
  credits_used?: number | string | null; credits_limit?: number | string | null; topup_balance?: number | string | null;
};

const ratioOf = (used: number, limit: number | null): number => (limit === null ? 0 : limit <= 0 ? 1 : used / limit);
const creditRatioOf = (used: number, limit: number | null, topup: number): number => {
  if (limit === null) return 0;
  const pool = Math.max(used, limit) + topup;
  return pool <= 0 ? 1 : used / pool;
};

/** This month's use against the allowance. null when it cannot be read (metering then fails open, like the web). */
export const quotaStatus = async (db: Db, workspaceId: string): Promise<QuotaStatus | null> => {
  try {
    const { data, error } = await db.rpc("ai_quota_status", { p_workspace: workspaceId });
    if (error) {
      console.error("quota status failed:", error.message);
      return null;
    }
    const row = ((data ?? []) as Array<StatusRow>)[0];
    if (!row) return null;
    const messagesUsed = Number(row.messages_used);
    const tokensUsed = Number(row.tokens_used);
    const messagesLimit = row.messages_limit === null ? null : Number(row.messages_limit);
    const tokensLimit = row.tokens_limit === null ? null : Number(row.tokens_limit);
    const creditsUsed = row.credits_used == null ? creditsOf(Number(row.cost_usd)) : Number(row.credits_used);
    const creditsLimit = row.credits_limit == null ? null : Number(row.credits_limit);
    const topupBalance = row.topup_balance == null ? 0 : Math.max(0, Number(row.topup_balance));
    const mRatio = ratioOf(messagesUsed, messagesLimit);
    const tRatio = ratioOf(tokensUsed, tokensLimit);
    const cRatio = creditRatioOf(creditsUsed, creditsLimit, topupBalance);
    const messagesExceeded = messagesLimit !== null && mRatio >= 1;
    const tokensExceeded = tokensLimit !== null && tRatio >= 1;
    const creditsExceeded = creditsLimit !== null && creditsUsed >= creditsLimit && topupBalance <= 0;
    const ratio = Math.max(mRatio, tRatio, cRatio);
    return {
      periodStart: row.period_start, messagesUsed, tokensUsed, messagesLimit, tokensLimit, creditsUsed, creditsLimit, topupBalance,
      messagesExceeded, tokensExceeded, creditsExceeded, ratio,
      level: messagesExceeded || tokensExceeded || creditsExceeded ? "exceeded" : ratio >= WARN_AT ? "warn" : "ok",
    };
  } catch (e) {
    console.error("quota status failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
};

const CUSTOMER_FACING: ReadonlySet<UsageKind> = new Set(["chat_reply", "relay"]);

/** Before a model call: the status when the call must NOT be made, else null. Fails open. A small (non-bulk) embedding is never blocked. */
export const blockedBy = async (db: Db, workspaceId: string, kind: UsageKind, opts: { readonly bulk?: boolean } = {}): Promise<QuotaStatus | null> => {
  if (kind === "embedding" && !opts.bulk) return null;
  if (kind === "guide") return null;
  const s = await quotaStatus(db, workspaceId);
  if (!s) return null;
  const blocked = CUSTOMER_FACING.has(kind) ? s.level === "exceeded" : s.tokensExceeded || s.creditsExceeded;
  if (!blocked) return null;
  await notifyOwner(db, workspaceId, s);
  return s;
};

/* ------------------------------------------------------------------ owner notice */

const fmtN = (n: number) => new Intl.NumberFormat("vi-VN").format(n);

const noticeBody = (level: "warn" | "exceeded", s: QuotaStatus): string => {
  const use = [
    s.creditsLimit !== null ? `${fmtN(Math.round(s.creditsUsed))}/${fmtN(s.creditsLimit)} credit` : null,
    s.topupBalance > 0 ? `${fmtN(s.topupBalance)} credit nạp thêm còn lại` : null,
    s.messagesLimit !== null ? `${fmtN(s.messagesUsed)}/${fmtN(s.messagesLimit)} tin nhắn` : null,
    s.tokensLimit !== null ? `${fmtN(s.tokensUsed)}/${fmtN(s.tokensLimit)} token` : null,
  ].filter(Boolean).join(", ");
  return level === "warn"
    ? `Mức dùng AI tháng này đã đạt ${Math.round(s.ratio * 100)}% hạn mức (${use}). Khi hết hạn mức, chatbot sẽ chuyển câu hỏi của khách cho nhân viên thay vì tự trả lời. Nạp thêm credit hoặc nâng cấp gói tại Credit & gói (/billing).`
    : `Workspace đã dùng hết hạn mức AI của tháng này (${use}). Chatbot tạm dừng tự trả lời: khách nhận lời xác nhận lịch sự và câu hỏi được chuyển cho nhân viên. Nạp thêm credit hoặc nâng cấp gói tại Credit & gói (/billing) để chatbot hoạt động lại.`;
};

/** Post an Office notice ONCE per workspace, month and level (the notices table's primary key is the lock). */
const notifyOwner = async (db: Db, workspaceId: string, s: QuotaStatus): Promise<void> => {
  const level = s.level === "exceeded" ? "exceeded" : s.level === "warn" ? "warn" : null;
  if (!level) return;
  try {
    const { error } = await db.from("ai_usage_notices").insert({ workspace_id: workspaceId, period: s.periodStart, level });
    if (error) return; // 23505: already told this month
    await db.from("messages").insert({ workspace_id: workspaceId, author_kind: "system", author_name: "NIVO", body: noticeBody(level, s) });
  } catch (e) {
    console.error("usage notice failed:", e instanceof Error ? e.message : String(e));
  }
};
