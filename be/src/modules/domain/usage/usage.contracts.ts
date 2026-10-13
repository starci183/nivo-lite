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

/** This month's use of one module. */
export interface ModuleUsage {
    /** The module. */
    readonly module: string
    /** Model calls. */
    readonly calls: number
    /** Tokens. */
    readonly tokens: number
    /** Cost in USD. */
    readonly costUsd: number
    /** Credits spent. */
    readonly credits: number
}

/** The use of one day. */
export interface DailyUsage {
    /** The day, YYYY-MM-DD (Vietnam time). */
    readonly day: string
    /** Tokens. */
    readonly tokens: number
    /** Credits spent. */
    readonly credits: number
}

/** This month's figures for the billing card. */
export interface UsageSummary {
    /** The allowance status, or null when it cannot be read. */
    readonly status: QuotaLookup
    /** Use by module, the costliest first. */
    readonly byModule: ReadonlyArray<ModuleUsage>
    /** Use by day. */
    readonly daily: ReadonlyArray<DailyUsage>
}
