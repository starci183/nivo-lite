/** What a model call was for. `guide` is paid by NIVO and never counts toward the allowance. */
export type UsageKind =
    "chat_reply" | "setup" | "owner_chat" | "relay" | "embedding" | "engine" | "guide" | "brain" | "office_command"

/** How far a workspace is through its allowance. */
export type QuotaLevel = "ok" | "warn" | "exceeded"

/** The usage object a provider sends back (OpenAI style), every field optional. */
export interface ProviderUsage {
    /** Prompt tokens. */
    readonly prompt_tokens?: number
    /** Completion tokens. */
    readonly completion_tokens?: number
    /** Total tokens. */
    readonly total_tokens?: number
    /** The provider's own cost in USD. */
    readonly cost?: number
}

/** One model call to record. */
export interface UsageInput {
    /** The workspace the call is attributed to. */
    readonly workspaceId: string
    /** What the call was for. */
    readonly kind: UsageKind
    /** The module the call belongs to (a module key, or setup, office, knowledge, other). */
    readonly module: string
    /** The model that answered. */
    readonly model: string
    /** The provider usage object, when it sent one. */
    readonly usage: ProviderUsage | null
    /** Prompt characters, used to estimate tokens when the provider sent no usage. */
    readonly promptChars: number
    /** Completion characters, used to estimate tokens when the provider sent no usage. */
    readonly completionChars: number
}

/** The tokens and cost one call is booked with. */
export interface UsageFigures {
    /** Prompt tokens. */
    readonly promptTokens: number
    /** Completion tokens. */
    readonly completionTokens: number
    /** Cost in USD. */
    readonly costUsd: number
    /** True when the provider sent no usage and the tokens were estimated. */
    readonly estimated: boolean
}

/** This month's use of one workspace against its allowance. */
export interface QuotaStatus {
    /** First day of the month (Vietnam time), YYYY-MM-DD. */
    readonly periodStart: string
    /** Customer replies this month. */
    readonly messagesUsed: number
    /** Model tokens this month. */
    readonly tokensUsed: number
    /** Model cost this month in USD. */
    readonly costUsd: number
    /** The message allowance; null is unlimited. */
    readonly messagesLimit: number | null
    /** The token allowance; null is unlimited. */
    readonly tokensLimit: number | null
    /** The reply a customer gets when the workspace is over its allowance, or null for the default. */
    readonly fallbackReply: string | null
    /** Credits spent this month. */
    readonly creditsUsed: number
    /** This month's allowance including the credits carried over; null is unlimited. */
    readonly creditsLimit: number | null
    /** Credits carried over from last month. */
    readonly creditsCarried: number
    /** Top-up credits still spendable. */
    readonly topupBalance: number
    /** The message allowance is used up. */
    readonly messagesExceeded: boolean
    /** The token allowance is used up. */
    readonly tokensExceeded: boolean
    /** The credits (allowance and top-ups) are used up. */
    readonly creditsExceeded: boolean
    /** The largest used/allowance ratio; 0 when every allowance is unlimited. */
    readonly ratio: number
    /** The overall level. */
    readonly level: QuotaLevel
}

/** A status, or null when it cannot be read (metering then fails open). */
export type QuotaLookup = QuotaStatus | null

/** One day's model use for a module, excluding the free guide. */
export interface DailyModuleUsage {
    /** The day in Vietnam time, YYYY-MM-DD. */
    readonly day: string
    /** The module or shared usage bucket. */
    readonly module: string
    /** Number of model calls. */
    readonly calls: number
    /** Prompt and completion tokens. */
    readonly tokens: number
    /** Model cost in USD. */
    readonly costUsd: number
}

/** One module's use in the current month. */
export interface ModuleUsage {
    /** The module or shared usage bucket. */
    readonly module: string
    /** Number of model calls. */
    readonly calls: number
    /** Prompt and completion tokens. */
    readonly tokens: number
    /** Model cost in USD. */
    readonly costUsd: number
    /** Credits consumed. */
    readonly credits: number
}

/** One day's use in the current month. */
export interface DailyUsage {
    /** The day in Vietnam time, YYYY-MM-DD. */
    readonly day: string
    /** Prompt and completion tokens. */
    readonly tokens: number
    /** Credits consumed. */
    readonly credits: number
}

/** The monthly quota and the use grouped for the billing card. */
export interface UsageSummary {
    /** The quota when the workspace has one. */
    readonly status: QuotaLookup
    /** Modules, ordered by credits consumed. */
    readonly byModule: ReadonlyArray<ModuleUsage>
    /** Days in chronological order. */
    readonly daily: ReadonlyArray<DailyUsage>
}

/** One row of ai_quota_status as the policy reads it: numbers are numbers and the period is YYYY-MM-DD. */
export interface QuotaFigures {
    /** First day of the month, YYYY-MM-DD. */
    readonly period_start: string
    /** Customer replies this month. */
    readonly messages_used: number
    /** Model tokens this month. */
    readonly tokens_used: number
    /** Model cost this month in USD. */
    readonly cost_usd: number
    /** The message allowance; null is unlimited. */
    readonly messages_limit: number | null
    /** The token allowance; null is unlimited. */
    readonly tokens_limit: number | null
    /** The workspace's own fallback reply, or null. */
    readonly fallback_reply: string | null
    /** Credits spent this month, or null when the function does not report it. */
    readonly credits_used: number | null
    /** The credit allowance; null is unlimited. */
    readonly credits_limit: number | null
    /** Credits carried over, or null. */
    readonly credits_carried: number | null
    /** Top-up credits left, or null. */
    readonly topup_balance: number | null
}

/** A figure the driver answers as a number or as text. */
type Figure = number | string

/** One row of ai_quota_status as the driver answers it: bigint and numeric columns arrive as text and the period as a date. */
export interface QuotaRecord {
    /** First day of the month. */
    readonly period_start: Date | string
    /** Customer replies this month. */
    readonly messages_used: Figure
    /** Model tokens this month. */
    readonly tokens_used: Figure
    /** Model cost this month in USD. */
    readonly cost_usd: Figure
    /** The message allowance; null is unlimited. */
    readonly messages_limit: Figure | null
    /** The token allowance; null is unlimited. */
    readonly tokens_limit: Figure | null
    /** The workspace's own fallback reply, or null. */
    readonly fallback_reply: string | null
    /** Credits spent this month, or null. */
    readonly credits_used: Figure | null
    /** The credit allowance; null is unlimited. */
    readonly credits_limit: Figure | null
    /** Credits carried over, or null. */
    readonly credits_carried: Figure | null
    /** Top-up credits left, or null. */
    readonly topup_balance: Figure | null
}
