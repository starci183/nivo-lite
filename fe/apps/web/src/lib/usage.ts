import "server-only"
import { AsyncLocalStorage } from "node:async_hooks"
import { supabaseAdmin } from "./supabase/admin"
import type { ModuleKey } from "./module-registry"

/**
 * AI usage metering and plan quotas: ONE place every model call goes through (deepseek.ts for chat, knowledge/embed.ts for
 * embeddings). A call is attributed to a workspace by the usage scope the entry point opened (`withUsage`); without a scope
 * nothing is recorded and nothing is blocked (scripts, tests).
 */

/**
 * `guide` is the in-app navigation assistant: NIVO pays for it, so it is metered but never blocked and never counts toward the allowance.
 * `brain` is the second brain's own work (reading facts out of documents): charged to the workspace's credits like any non-customer call.
 */
export type UsageKind =
    "chat_reply" | "setup" | "owner_chat" | "relay" | "embedding" | "engine" | "guide" | "brain" | "office_command"
export type UsageModule = ModuleKey | "setup" | "office" | "knowledge" | "other"
export type UsageScope = { readonly workspaceId: string; readonly kind?: UsageKind; readonly module?: UsageModule }

const store = new AsyncLocalStorage<UsageScope>()

/** Run `fn` with every model call inside it attributed to `scope.workspaceId` (optionally overriding the call's kind / module). */
export const withUsage = <T>(scope: UsageScope, fn: () => Promise<T>): Promise<T> => store.run(scope, fn)

/** The scope of the running request or job, if an entry point opened one. */
export const usageScope = (): UsageScope | undefined => store.getStore()

/* ------------------------------------------------------------------ prices */

/** USD per 1M tokens, used only when the provider returns no cost. TO_CONFIRM: approximate list prices, not a contract. */
const PRICES: ReadonlyArray<{ readonly match: string; readonly in: number; readonly out: number }> = [
    { match: "deepseek", in: 0.14, out: 0.28 },
    { match: "qwen3-embedding", in: 0.01, out: 0 },
    { match: "text-embedding-3-small", in: 0.02, out: 0 },
    { match: "text-embedding-3-large", in: 0.13, out: 0 },
]
const DEFAULT_PRICE = { in: 0.3, out: 1.2 }

/** Cost from the price table (USD). */
export const priceOf = (model: string, promptTokens: number, completionTokens: number): number => {
    const p = PRICES.find((x) => model.toLowerCase().includes(x.match)) ?? DEFAULT_PRICE
    return (promptTokens * p.in + completionTokens * p.out) / 1_000_000
}

/** Rough token count when the provider sent none (Vietnamese is about 3 characters per token). */
export const estimateTokens = (chars: number): number => Math.max(1, Math.ceil(chars / 3))

/* ------------------------------------------------------------------ recording */

/** cached_tokens: prompt tokens the provider served from its prompt cache (OpenRouter prompt_tokens_details.cached_tokens). Informational: not billed separately here. */
export type ProviderUsage =
    | {
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          cost?: number
          cached_tokens?: number
      }
    | null
    | undefined

export type UsageInput = {
    readonly workspaceId: string
    readonly kind: UsageKind
    readonly module: UsageModule
    readonly model: string
    /** The provider's `usage` object when it sent one. */
    readonly usage?: ProviderUsage
    /** Used to estimate tokens when `usage` is missing. */
    readonly promptChars?: number
    readonly completionChars?: number
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null)

/**
 * Record one model call. Never throws: metering must not break a reply. Cost is the provider's own (OpenRouter `usage.cost`)
 * when present, else the price table. After the write the month's level is checked and the owner is told once at 80% and at 100%.
 * Also the hook the engine callback uses (kind 'engine'): see `recordEngineUsage`.
 */
export const recordUsage = async (u: UsageInput): Promise<void> => {
    try {
        const prompt = num(u.usage?.prompt_tokens)
        const completion = num(u.usage?.completion_tokens)
        const total = num(u.usage?.total_tokens)
        const estimated = prompt === null && completion === null && total === null
        const promptTokens = estimated
            ? estimateTokens(u.promptChars ?? 0)
            : (prompt ?? Math.max(0, (total ?? 0) - (completion ?? 0)))
        const completionTokens = estimated
            ? u.completionChars
                ? estimateTokens(u.completionChars)
                : 0
            : (completion ?? Math.max(0, (total ?? 0) - promptTokens))
        const cost = num(u.usage?.cost) ?? priceOf(u.model, promptTokens, completionTokens)
        const { error } = await supabaseAdmin()
            .from("ai_usage_events")
            .insert({
                workspace_id: u.workspaceId,
                kind: u.kind,
                module: u.module,
                model: u.model.slice(0, 120),
                prompt_tokens: Math.round(promptTokens),
                completion_tokens: Math.round(completionTokens),
                cost_usd: Number(cost.toFixed(8)),
                estimated,
            })
        if (error) {
            console.error("usage record failed:", error.message)
            return
        }
        const s = await quotaStatus(u.workspaceId)
        if (s && s.level !== "ok") await notifyOwner(u.workspaceId, s)
    } catch (e) {
        console.error("usage record failed:", e instanceof Error ? e.message : String(e))
    }
}

/**
 * Engine hook: the engine callback (OpenClaw worker result) calls this with the usage the worker reports, so engine work is
 * metered like inline calls. `usage` is the OpenAI-style object ({ prompt_tokens, completion_tokens, total_tokens, cost? }).
 */
export const recordEngineUsage = (a: {
    workspaceId: string
    kind?: UsageKind
    model?: string
    module?: UsageModule
    usage?: ProviderUsage
    promptChars?: number
    completionChars?: number
}): Promise<void> =>
    recordUsage({
        workspaceId: a.workspaceId,
        kind: a.kind ?? "engine",
        module: a.module ?? "other",
        model: a.model ?? "engine",
        usage: a.usage,
        promptChars: a.promptChars,
        completionChars: a.completionChars,
    })

/* ------------------------------------------------------------------ quota */

export type QuotaLevel = "ok" | "warn" | "exceeded"

export type QuotaStatus = {
    readonly periodStart: string
    readonly messagesUsed: number
    readonly tokensUsed: number
    readonly costUsd: number
    /** null = unlimited */
    readonly messagesLimit: number | null
    readonly tokensLimit: number | null
    readonly fallbackReply: string | null
    /** Credits spent this month (model cost x CREDITS_PER_USD) and the allowance (null = unlimited). */
    readonly creditsUsed: number
    /** This month's allowance including the credits carried from last month (Pro, Max). */
    readonly creditsLimit: number | null
    /** Credits carried from last month (0 when the plan does not roll over). */
    readonly creditsCarried: number
    /** Top-up credits still spendable now (after the part of this month's overage that is already spent; see credit_topups). */
    readonly topupBalance: number
    readonly messagesExceeded: boolean
    readonly tokensExceeded: boolean
    readonly creditsExceeded: boolean
    /** The largest used/allowance ratio (0 when every allowance is unlimited). */
    readonly ratio: number
    readonly level: QuotaLevel
}

import { WARN_AT, creditsOf } from "./usage-shared"

/** Default polite reply the customer gets when the workspace is over its allowance (configurable per workspace in ai_quota_overrides). */
export const DEFAULT_FALLBACK_REPLY = "Dạ em đã ghi nhận, nhân viên sẽ phản hồi anh/chị sớm ạ"

type StatusRow = {
    period_start: string
    messages_used: number
    tokens_used: number
    cost_usd: number
    messages_limit: number | null
    tokens_limit: number | null
    fallback_reply: string | null
    credits_used?: number | string | null
    credits_limit?: number | string | null
    credits_carried?: number | string | null
    topup_balance?: number | string | null
}

const ratioOf = (used: number, limit: number | null): number => (limit === null ? 0 : limit <= 0 ? 1 : used / limit)

/**
 * Credits are one pool: the allowance first, then the top-ups. The pool is the allowance (or the use, once past it) plus the top-up
 * credits still left, so the ratio reaches 1 only when the allowance is used up AND no top-up credit is left.
 */
const creditRatioOf = (used: number, limit: number | null, topup: number): number => {
    if (limit === null) return 0
    const pool = Math.max(used, limit) + topup
    return pool <= 0 ? 1 : used / pool
}

/** This month's use against the allowance. null when it cannot be read (metering then fails open). */
export const quotaStatus = async (workspaceId: string): Promise<QuotaStatus | null> => {
    try {
        const { data, error } = await supabaseAdmin().rpc("ai_quota_status", { p_workspace: workspaceId })
        if (error) {
            console.error("quota status failed:", error.message)
            return null
        }
        const row = ((data ?? []) as Array<StatusRow>)[0]
        if (!row) return null
        const messagesUsed = Number(row.messages_used)
        const tokensUsed = Number(row.tokens_used)
        const messagesLimit = row.messages_limit === null ? null : Number(row.messages_limit)
        const tokensLimit = row.tokens_limit === null ? null : Number(row.tokens_limit)
        const costUsd = Number(row.cost_usd)
        const creditsUsed = row.credits_used == null ? creditsOf(costUsd) : Number(row.credits_used)
        const creditsLimit = row.credits_limit == null ? null : Number(row.credits_limit)
        const creditsCarried = row.credits_carried == null ? 0 : Number(row.credits_carried)
        const topupBalance = row.topup_balance == null ? 0 : Math.max(0, Number(row.topup_balance))
        const mRatio = ratioOf(messagesUsed, messagesLimit)
        const tRatio = ratioOf(tokensUsed, tokensLimit)
        const cRatio = creditRatioOf(creditsUsed, creditsLimit, topupBalance)
        const messagesExceeded = messagesLimit !== null && mRatio >= 1
        const tokensExceeded = tokensLimit !== null && tRatio >= 1
        const creditsExceeded = creditsLimit !== null && creditsUsed >= creditsLimit && topupBalance <= 0
        const ratio = Math.max(mRatio, tRatio, cRatio)
        return {
            periodStart: row.period_start,
            messagesUsed,
            tokensUsed,
            costUsd,
            messagesLimit,
            tokensLimit,
            fallbackReply: row.fallback_reply?.trim() || null,
            creditsUsed,
            creditsLimit,
            creditsCarried,
            topupBalance,
            messagesExceeded,
            tokensExceeded,
            creditsExceeded,
            ratio,
            level:
                messagesExceeded || tokensExceeded || creditsExceeded ? "exceeded" : ratio >= WARN_AT ? "warn" : "ok",
        }
    } catch (e) {
        console.error("quota status failed:", e instanceof Error ? e.message : String(e))
        return null
    }
}

/** Thrown to non-customer callers (setup chat, owner chat, engine steps) when the workspace is over its allowance. */
export class QuotaExceededError extends Error {
    constructor(
        message: string,
        readonly status: QuotaStatus,
    ) {
        super(message)
        this.name = "QuotaExceededError"
    }
}

const EXCEEDED_VI =
    "Workspace của bạn đã dùng hết hạn mức AI của tháng này, nên AI tạm dừng cho đến kỳ mới. Bạn có thể nạp thêm credit hoặc nâng cấp gói tại Credit & gói (/billing) để dùng tiếp."
const EXCEEDED_EN =
    "Your workspace has used up this month's AI allowance, so AI is paused until the next period. You can top up credits or upgrade your plan in Credits & plan (/billing) to continue."

export const exceededMessage = (locale: "vi" | "en"): string => (locale === "vi" ? EXCEEDED_VI : EXCEEDED_EN)

/** Customer-facing kinds stop when ANY allowance is used up; everything else when the credits (or a legacy token budget) are. */
const CUSTOMER_FACING: ReadonlySet<UsageKind> = new Set(["chat_reply", "relay"])

/**
 * Before a model call: the status when the call must NOT be made (over the allowance), else null. Fails open when the status
 * cannot be read. The owner is told once that the limit was reached.
 */
export const blockedBy = async (
    workspaceId: string,
    kind: UsageKind,
    opts: { readonly bulk?: boolean } = {},
): Promise<QuotaStatus | null> => {
    // Embedding one query or one small document is cheap and callers fall back to full-text search, so it is never blocked; a BULK embedding
    // (a very large document, a re-embed batch) is real spend and stops with the credits.
    if (kind === "embedding" && !opts.bulk) return null
    if (kind === "guide") return null // paid by NIVO, outside the workspace allowance
    const s = await quotaStatus(workspaceId)
    if (!s) return null
    const blocked = CUSTOMER_FACING.has(kind) ? s.level === "exceeded" : s.tokensExceeded || s.creditsExceeded
    if (!blocked) return null
    await notifyOwner(workspaceId, s)
    return s
}

/* ------------------------------------------------------------------ owner notice */

const fmtN = (n: number) => new Intl.NumberFormat("vi-VN").format(n)

const noticeBody = (level: "warn" | "exceeded", s: QuotaStatus): string => {
    const use = [
        s.creditsLimit !== null ? `${fmtN(Math.round(s.creditsUsed))}/${fmtN(s.creditsLimit)} credit` : null,
        s.topupBalance > 0 ? `${fmtN(s.topupBalance)} credit nạp thêm còn lại` : null,
        s.messagesLimit !== null ? `${fmtN(s.messagesUsed)}/${fmtN(s.messagesLimit)} tin nhắn` : null,
        s.tokensLimit !== null ? `${fmtN(s.tokensUsed)}/${fmtN(s.tokensLimit)} token` : null,
    ]
        .filter(Boolean)
        .join(", ")
    return level === "warn"
        ? `Mức dùng AI tháng này đã đạt ${Math.round(s.ratio * 100)}% hạn mức (${use}). Khi hết hạn mức, chatbot sẽ chuyển câu hỏi của khách cho nhân viên thay vì tự trả lời. Nạp thêm credit hoặc nâng cấp gói tại Credit & gói (/billing).`
        : `Workspace đã dùng hết hạn mức AI của tháng này (${use}). Chatbot tạm dừng tự trả lời: khách nhận lời xác nhận lịch sự và câu hỏi được chuyển cho nhân viên. Nạp thêm credit hoặc nâng cấp gói tại Credit & gói (/billing) để chatbot hoạt động lại.`
}

/** Post an Office notice ONCE per workspace, month and level (the notices table's primary key is the lock). */
const notifyOwner = async (workspaceId: string, s: QuotaStatus): Promise<void> => {
    const level = s.level === "exceeded" ? "exceeded" : s.level === "warn" ? "warn" : null
    if (!level) return
    try {
        const admin = supabaseAdmin()
        const { error } = await admin
            .from("ai_usage_notices")
            .insert({ workspace_id: workspaceId, period: s.periodStart, level })
        if (error) return // 23505: already told this month
        await admin
            .from("messages")
            .insert({
                workspace_id: workspaceId,
                author_kind: "system",
                author_name: "NIVO",
                body: noticeBody(level, s),
            })
    } catch (e) {
        console.error("usage notice failed:", e instanceof Error ? e.message : String(e))
    }
}
