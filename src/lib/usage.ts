import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { supabaseAdmin } from "./supabase/admin";
import type { ModuleKey } from "./module-registry";

/**
 * AI usage metering and plan quotas: ONE place every model call goes through (deepseek.ts for chat, knowledge/embed.ts for
 * embeddings). A call is attributed to a workspace by the usage scope the entry point opened (`withUsage`); without a scope
 * nothing is recorded and nothing is blocked (scripts, tests).
 */

export type UsageKind = "chat_reply" | "setup" | "owner_chat" | "relay" | "embedding" | "engine";
export type UsageModule = ModuleKey | "setup" | "office" | "knowledge" | "other";
export type UsageScope = { readonly workspaceId: string; readonly kind?: UsageKind; readonly module?: UsageModule };

const store = new AsyncLocalStorage<UsageScope>();

/** Run `fn` with every model call inside it attributed to `scope.workspaceId` (optionally overriding the call's kind / module). */
export const withUsage = <T>(scope: UsageScope, fn: () => Promise<T>): Promise<T> => store.run(scope, fn);

/** The scope of the running request or job, if an entry point opened one. */
export const usageScope = (): UsageScope | undefined => store.getStore();

/* ------------------------------------------------------------------ prices */

/** USD per 1M tokens, used only when the provider returns no cost. TO_CONFIRM: approximate list prices, not a contract. */
const PRICES: ReadonlyArray<{ readonly match: string; readonly in: number; readonly out: number }> = [
  { match: "deepseek", in: 0.14, out: 0.28 },
  { match: "text-embedding-3-small", in: 0.02, out: 0 },
  { match: "text-embedding-3-large", in: 0.13, out: 0 },
];
const DEFAULT_PRICE = { in: 0.3, out: 1.2 };

/** Cost from the price table (USD). */
export const priceOf = (model: string, promptTokens: number, completionTokens: number): number => {
  const p = PRICES.find((x) => model.toLowerCase().includes(x.match)) ?? DEFAULT_PRICE;
  return (promptTokens * p.in + completionTokens * p.out) / 1_000_000;
};

/** Rough token count when the provider sent none (Vietnamese is about 3 characters per token). */
export const estimateTokens = (chars: number): number => Math.max(1, Math.ceil(chars / 3));

/* ------------------------------------------------------------------ recording */

/** cached_tokens: prompt tokens the provider served from its prompt cache (OpenRouter prompt_tokens_details.cached_tokens). Informational: not billed separately here. */
export type ProviderUsage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number; cached_tokens?: number } | null | undefined;

export type UsageInput = {
  readonly workspaceId: string;
  readonly kind: UsageKind;
  readonly module: UsageModule;
  readonly model: string;
  /** The provider's `usage` object when it sent one. */
  readonly usage?: ProviderUsage;
  /** Used to estimate tokens when `usage` is missing. */
  readonly promptChars?: number;
  readonly completionChars?: number;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/**
 * Record one model call. Never throws: metering must not break a reply. Cost is the provider's own (OpenRouter `usage.cost`)
 * when present, else the price table. After the write the month's level is checked and the owner is told once at 80% and at 100%.
 * Also the hook the engine callback uses (kind 'engine'): see `recordEngineUsage`.
 */
export const recordUsage = async (u: UsageInput): Promise<void> => {
  try {
    const prompt = num(u.usage?.prompt_tokens);
    const completion = num(u.usage?.completion_tokens);
    const total = num(u.usage?.total_tokens);
    const estimated = prompt === null && completion === null && total === null;
    const promptTokens = estimated ? estimateTokens(u.promptChars ?? 0) : prompt ?? Math.max(0, (total ?? 0) - (completion ?? 0));
    const completionTokens = estimated ? (u.completionChars ? estimateTokens(u.completionChars) : 0) : completion ?? Math.max(0, (total ?? 0) - promptTokens);
    const cost = num(u.usage?.cost) ?? priceOf(u.model, promptTokens, completionTokens);
    const { error } = await supabaseAdmin().from("ai_usage_events").insert({
      workspace_id: u.workspaceId, kind: u.kind, module: u.module, model: u.model.slice(0, 120),
      prompt_tokens: Math.round(promptTokens), completion_tokens: Math.round(completionTokens), cost_usd: Number(cost.toFixed(8)), estimated,
    });
    if (error) {
      console.error("usage record failed:", error.message);
      return;
    }
    const s = await quotaStatus(u.workspaceId);
    if (s && s.level !== "ok") await notifyOwner(u.workspaceId, s);
  } catch (e) {
    console.error("usage record failed:", e instanceof Error ? e.message : String(e));
  }
};

/**
 * Engine hook: the engine callback (OpenClaw worker result) calls this with the usage the worker reports, so engine work is
 * metered like inline calls. `usage` is the OpenAI-style object ({ prompt_tokens, completion_tokens, total_tokens, cost? }).
 */
export const recordEngineUsage = (a: { workspaceId: string; kind?: UsageKind; model?: string; module?: UsageModule; usage?: ProviderUsage; promptChars?: number; completionChars?: number }): Promise<void> =>
  recordUsage({ workspaceId: a.workspaceId, kind: a.kind ?? "engine", module: a.module ?? "other", model: a.model ?? "engine", usage: a.usage, promptChars: a.promptChars, completionChars: a.completionChars });

/* ------------------------------------------------------------------ quota */

export type QuotaLevel = "ok" | "warn" | "exceeded";

export type QuotaStatus = {
  readonly periodStart: string;
  readonly messagesUsed: number;
  readonly tokensUsed: number;
  readonly costUsd: number;
  /** null = unlimited */
  readonly messagesLimit: number | null;
  readonly tokensLimit: number | null;
  readonly fallbackReply: string | null;
  readonly messagesExceeded: boolean;
  readonly tokensExceeded: boolean;
  /** The larger of the two used/allowance ratios (0 when both are unlimited). */
  readonly ratio: number;
  readonly level: QuotaLevel;
};

import { WARN_AT } from "./usage-shared";

/** Default polite reply the customer gets when the workspace is over its allowance (configurable per workspace in ai_quota_overrides). */
export const DEFAULT_FALLBACK_REPLY = "Dạ em đã ghi nhận, nhân viên sẽ phản hồi anh/chị sớm ạ";

type StatusRow = { period_start: string; messages_used: number; tokens_used: number; cost_usd: number; messages_limit: number | null; tokens_limit: number | null; fallback_reply: string | null };

const ratioOf = (used: number, limit: number | null): number => (limit === null ? 0 : limit <= 0 ? 1 : used / limit);

/** This month's use against the allowance. null when it cannot be read (metering then fails open). */
export const quotaStatus = async (workspaceId: string): Promise<QuotaStatus | null> => {
  try {
    const { data, error } = await supabaseAdmin().rpc("ai_quota_status", { p_workspace: workspaceId });
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
    const mRatio = ratioOf(messagesUsed, messagesLimit);
    const tRatio = ratioOf(tokensUsed, tokensLimit);
    const messagesExceeded = messagesLimit !== null && mRatio >= 1;
    const tokensExceeded = tokensLimit !== null && tRatio >= 1;
    const ratio = Math.max(mRatio, tRatio);
    return {
      periodStart: row.period_start, messagesUsed, tokensUsed, costUsd: Number(row.cost_usd), messagesLimit, tokensLimit,
      fallbackReply: row.fallback_reply?.trim() || null, messagesExceeded, tokensExceeded, ratio,
      level: messagesExceeded || tokensExceeded ? "exceeded" : ratio >= WARN_AT ? "warn" : "ok",
    };
  } catch (e) {
    console.error("quota status failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
};

/** Thrown to non-customer callers (setup chat, owner chat, engine steps) when the workspace is over its allowance. */
export class QuotaExceededError extends Error {
  constructor(message: string, readonly status: QuotaStatus) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

const EXCEEDED_VI = "Workspace của bạn đã dùng hết hạn mức AI của tháng này, nên AI tạm dừng cho đến kỳ mới. Bạn có thể nâng cấp gói trong mục Thanh toán để dùng tiếp.";
const EXCEEDED_EN = "Your workspace has used up this month's AI allowance, so AI is paused until the next period. You can upgrade your plan in Billing to continue.";

export const exceededMessage = (locale: "vi" | "en"): string => (locale === "vi" ? EXCEEDED_VI : EXCEEDED_EN);

/** Customer-facing kinds stop when EITHER allowance is used up; everything else only when the token budget is. */
const CUSTOMER_FACING: ReadonlySet<UsageKind> = new Set(["chat_reply", "relay"]);

/**
 * Before a model call: the status when the call must NOT be made (over the allowance), else null. Fails open when the status
 * cannot be read. The owner is told once that the limit was reached.
 */
export const blockedBy = async (workspaceId: string, kind: UsageKind): Promise<QuotaStatus | null> => {
  if (kind === "embedding") return null; // cheap, and callers already fall back to full-text search
  const s = await quotaStatus(workspaceId);
  if (!s) return null;
  const blocked = CUSTOMER_FACING.has(kind) ? s.level === "exceeded" : s.tokensExceeded;
  if (!blocked) return null;
  await notifyOwner(workspaceId, s);
  return s;
};

/* ------------------------------------------------------------------ owner notice */

const fmtN = (n: number) => new Intl.NumberFormat("vi-VN").format(n);

const noticeBody = (level: "warn" | "exceeded", s: QuotaStatus): string => {
  const use = [
    s.messagesLimit !== null ? `${fmtN(s.messagesUsed)}/${fmtN(s.messagesLimit)} tin nhắn` : null,
    s.tokensLimit !== null ? `${fmtN(s.tokensUsed)}/${fmtN(s.tokensLimit)} token` : null,
  ].filter(Boolean).join(", ");
  return level === "warn"
    ? `Mức dùng AI tháng này đã đạt ${Math.round(s.ratio * 100)}% hạn mức (${use}). Khi hết hạn mức, chatbot sẽ chuyển câu hỏi của khách cho nhân viên thay vì tự trả lời. Xem chi tiết hoặc nâng cấp gói ở mục Thanh toán.`
    : `Workspace đã dùng hết hạn mức AI của tháng này (${use}). Chatbot tạm dừng tự trả lời: khách nhận lời xác nhận lịch sự và câu hỏi được chuyển cho nhân viên. Nâng cấp gói ở mục Thanh toán để chatbot hoạt động lại.`;
};

/** Post an Office notice ONCE per workspace, month and level (the notices table's primary key is the lock). */
const notifyOwner = async (workspaceId: string, s: QuotaStatus): Promise<void> => {
  const level = s.level === "exceeded" ? "exceeded" : s.level === "warn" ? "warn" : null;
  if (!level) return;
  try {
    const admin = supabaseAdmin();
    const { error } = await admin.from("ai_usage_notices").insert({ workspace_id: workspaceId, period: s.periodStart, level });
    if (error) return; // 23505: already told this month
    await admin.from("messages").insert({ workspace_id: workspaceId, author_kind: "system", author_name: "NIVO", body: noticeBody(level, s) });
  } catch (e) {
    console.error("usage notice failed:", e instanceof Error ? e.message : String(e));
  }
};

/* ------------------------------------------------------------------ billing page summary */

export type UsageSummary = {
  readonly status: QuotaStatus | null;
  readonly byModule: ReadonlyArray<{ readonly module: string; readonly calls: number; readonly tokens: number; readonly costUsd: number }>;
  readonly daily: ReadonlyArray<{ readonly day: string; readonly tokens: number }>;
};

/** This month's figures for the billing card. Call only after the caller was verified as owner | manager of the workspace. */
export const usageSummary = async (workspaceId: string): Promise<UsageSummary> => {
  const admin = supabaseAdmin();
  const status = await quotaStatus(workspaceId);
  const from = status?.periodStart ?? new Date().toISOString().slice(0, 8) + "01";
  const { data } = await admin.from("ai_usage_daily").select("day, module, calls, prompt_tokens, completion_tokens, cost_usd").eq("workspace_id", workspaceId).gte("day", from).order("day");
  const rows = (data ?? []) as Array<{ day: string; module: string; calls: number; prompt_tokens: number; completion_tokens: number; cost_usd: number }>;
  const mod = new Map<string, { module: string; calls: number; tokens: number; costUsd: number }>();
  const day = new Map<string, number>();
  for (const r of rows) {
    const tokens = Number(r.prompt_tokens) + Number(r.completion_tokens);
    const m = mod.get(r.module) ?? { module: r.module, calls: 0, tokens: 0, costUsd: 0 };
    m.calls += Number(r.calls);
    m.tokens += tokens;
    m.costUsd += Number(r.cost_usd);
    mod.set(r.module, m);
    day.set(r.day, (day.get(r.day) ?? 0) + tokens);
  }
  return { status, byModule: [...mod.values()].sort((a, b) => b.tokens - a.tokens), daily: [...day.entries()].map(([d, tokens]) => ({ day: d, tokens })) };
};
