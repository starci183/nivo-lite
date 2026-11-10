/** What a model call was for. `guide` is paid by NIVO and never counts toward the allowance. */
export type UsageKind =
    | "chat_reply"
    | "setup"
    | "owner_chat"
    | "relay"
    | "embedding"
    | "engine"
    | "guide"
    | "brain"
    | "office_command"
    | "agent_work"

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
    /** Prompt tokens the provider served from its prompt cache; they are part of `prompt_tokens`. */
    readonly cached_tokens?: number
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
    /** The agent run the call was made for; absent, the run in scope (a step being executed) is used, else the call belongs to no run. */
    readonly runId?: string | undefined
    /** What the call was and how it went (its kind, hidden reasoning, time, try, upstream); absent books none of it. */
    readonly call?: UsageCallFacts | undefined
}

/** What one model call was and how it went, beside what it cost: what the run page shows per call kind. */
export interface UsageCallFacts {
    /** The call kind: `<node id>:<tag>` of a graph node's call (e.g. `accounting.match-payment:agent`); null for a fixed task. */
    readonly purpose: string | null
    /** The answer's tokens spent on hidden reasoning (a part of the completion tokens); null when the endpoint did not say. */
    readonly reasoningTokens: number | null
    /** The wall time of the try that answered, milliseconds; null when not measured. */
    readonly durationMs: number | null
    /** Which try of the call answered, from one: a 3 means two tries failed before it (failed tries are never booked). */
    readonly tryNumber: number | null
    /** The upstream of the endpoint that served the call (OpenRouter's `provider`); null when it did not say. */
    readonly upstream: string | null
    /** Why the model stopped (`stop`, `tool_calls`); null when it did not say. */
    readonly finishReason: string | null
    /** What a graph node's call declared (`auto` or a model id); absent for a fixed task of the app. */
    readonly declaredModel?: string | undefined
    /** The provider of the model that served the call (`anthropic`, `openrouter`); absent when not known. */
    readonly modelProvider?: string | undefined
    /** Why the call went to the model it went to (`auto-heavy`, `default-no-key`, ...); absent for a fixed task. */
    readonly modelReason?: string | undefined
}

/**
 * The model calls of one agent run, grouped by call kind, for the run page: where the run's time, prompt cache and hidden reasoning
 * went. Ordered by the first call of each kind.
 */
export interface RunCallKindUsage {
    /** The call kind (`<node id>:<tag>`), or the usage kind for a fixed task of the app. */
    readonly purpose: string
    /** The calls of this kind that answered (failed tries are never booked). */
    readonly calls: number
    /** The highest try number among them: above 1, some try of this kind failed before one answered. */
    readonly maxTry: number | null
    /** Prompt tokens of all the calls, cached ones included. */
    readonly promptTokens: number
    /** Prompt tokens served from the provider's prompt cache. */
    readonly cachedTokens: number
    /** Completion tokens, reasoning included. */
    readonly completionTokens: number
    /** The part of the completion tokens that was hidden reasoning. */
    readonly reasoningTokens: number
    /** The wall time of all the calls together, milliseconds (calls not measured count zero). */
    readonly durationMs: number
    /** The slowest call, milliseconds; null when none was measured. */
    readonly slowestMs: number | null
    /** The cost of the calls in USD. */
    readonly costUsd: number
    /** The upstreams that served them, sorted, without repeats. */
    readonly upstreams: ReadonlyArray<string>
    /** Why the model stopped, sorted, without repeats. */
    readonly finishReasons: ReadonlyArray<string>
    /** The models that served the calls, sorted, without repeats. */
    readonly models: ReadonlyArray<string>
    /** What the node declared (`auto` or a model id), sorted, without repeats; empty for a fixed task. */
    readonly declaredModels: ReadonlyArray<string>
    /** The providers of the models that served them, sorted, without repeats. */
    readonly modelProviders: ReadonlyArray<string>
    /** Why the calls went to those models, sorted, without repeats. */
    readonly modelReasons: ReadonlyArray<string>
}

/** The tokens and cost one call is booked with. */
export interface UsageFigures {
    /** Prompt tokens. */
    readonly promptTokens: number
    /** Completion tokens. */
    readonly completionTokens: number
    /** Prompt tokens served from the provider's prompt cache (part of the prompt tokens); zero when the provider did not say. */
    readonly cachedTokens: number
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
