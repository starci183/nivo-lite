import type { Locale } from "@modules/platform/i18n"

/** One message of a prompt. */
export interface ChatMessage {
    /** Who speaks. */
    readonly role: "system" | "user" | "assistant"
    /** What is said. */
    readonly content: string
    /** The pictures said with it, as addresses the model host can fetch. */
    readonly images?: ReadonlyArray<string>
    /** True on the last message of the stable part: where a model that takes explicit cache breakpoints gets one. */
    readonly cacheMark?: boolean
}

/** The lane of the Second Brain a drafting task reads: the module and agent instance that owns it, and who the text reaches. */
export interface AiTaskLane {
    /** The module whose knowledge is read. */
    readonly module: string
    /** The agent instance whose own notes are read too, or null for the shared knowledge only. */
    readonly installationId: string | null
    /** customer: public knowledge only; internal: the whole lane. */
    readonly audience: "customer" | "internal"
}

/** The workspace and language one prompt call acts for. The workspace names the job the call belongs to. */
export interface AiTaskScope {
    /** The workspace the text is written for. */
    readonly workspaceId: string
    /** The language of the generated text. */
    readonly locale: Locale
    /** Overrides the usage kind the call is metered under. */
    readonly kind?: string
    /** Overrides the usage module the call is metered under. */
    readonly module?: string
    /** The lane a drafting task retrieves business notes from; without it the task reads no notes. */
    readonly lane?: AiTaskLane
    /**
     * The model a graph node's call is declared with (the node's own, else blocks-core's for its step, else the default); absent for
     * a fixed task of the app, which keeps the endpoint's chat profile.
     */
    readonly model?: DeclaredModel | undefined
}

/** The model a graph node's call is declared with, and where the declaration came from. */
export interface DeclaredModel {
    /** `auto`, or a model id (an unknown id is booked as such and served by the default). */
    readonly model: string
    /** The step's weight as blocks-core declares it; Auto reads it. */
    readonly weight: "light" | "heavy"
    /** `node`: the graph's node names it (the shop's choice); `declared`: blocks-core's table; `default`: neither. */
    readonly source: "node" | "declared" | "default"
    /**
     * The most completion tokens one call of the step may produce, reasoning included, as blocks-core declares it beside the step's
     * model (`NodeModel.maxOutputTokens`): a bound on a runaway answer. Absent: the app's cap of node calls; the smaller one is sent.
     */
    readonly maxOutputTokens?: number | undefined
}

/** Which providers of the AI pool hold a key in this deployment (an explicit model of a provider without one fails loudly). */
export interface ConfiguredProviders {
    /** Anthropic: every chat model (Claude Sonnet 5.5, Claude Haiku 5.5). */
    readonly anthropic: boolean
    /** OpenRouter for chat: always false since 2026-11-11 (no OpenRouter chat); kept for the retired model's picker label. */
    readonly openrouter: boolean
}

/** One retrieval of business notes for a drafting task. */
export interface RecallRequest extends AiTaskLane {
    /** The workspace. */
    readonly workspaceId: string
    /** What the notes are looked up for. */
    readonly question: string
    /** The most passages wanted. */
    readonly limit: number
}

/** One business note found. */
export interface RecalledPassage {
    /** Where it comes from. */
    readonly title: string
    /** The text. */
    readonly content: string
}

/** One prompt as it is run and metered. */
export interface TextRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The prompt. */
    readonly messages: ReadonlyArray<ChatMessage>
    /** True when the answer must be one JSON object. */
    readonly json: boolean
    /** The usage kind. */
    readonly kind: string
    /** The usage module. */
    readonly module: string
    /** The call kind booked with the usage: the `purpose` of a graph node's call; absent for a fixed task of the app. */
    readonly purpose?: string | undefined
}

/** A prompt call's metering: the usage kind and module. */
export interface CallMeta {
    /** The usage kind. */
    readonly kind: string
    /** The usage module. */
    readonly module: string
}

/** One call of the model by a graph node: what it is for, how to answer and on what. */
export interface NodeAsk {
    /** `<node id>:<purpose>`; the namespace of the node is the usage module. */
    readonly purpose: string
    /** The node's instructions, the system message: the stable part of the call, the same text for the same agent, shop and step. */
    readonly instructions: string
    /**
     * How long the opening of `instructions` is that every call of the agent shares whatever the step (L1 craft + tools, L2 shop
     * values; agent-sdk `NodeModelRequest.sharedLength`): the stable part is sent as two system parts, each with a cache breakpoint,
     * so another step's first call reads the opening from the cache. Absent: one part, as before.
     */
    readonly sharedLength?: number | undefined
    /** Words that hold for this call only; they go after the stable part, never inside it. */
    readonly volatile?: string | undefined
    /** The reasoning the node asks a reasoning model for on this call; absent takes the default of node calls. */
    readonly reasoning?: "off" | "low" | "medium" | "high" | undefined
    /** What the node asks about, sent as JSON. */
    readonly input: unknown
    /** Pictures to look at, sent with the input as image parts of the user message. */
    readonly images?: ReadonlyArray<string> | undefined
}

/** What a metered run cost, in the meter's own shape. */
export interface MeteredRun {
    /** Prompt tokens. */
    readonly prompt_tokens: number
    /** Completion tokens. */
    readonly completion_tokens: number
    /** Prompt tokens served from a cache; the endpoint does not report them. */
    readonly cached_tokens: number
    /** Prompt tokens written to the provider's cache; absent when not told. */
    readonly cache_write_tokens?: number | undefined
    /** The provider cost. */
    readonly cost: number
    /** Who served the run. */
    readonly model: string | null
}

/** One generation as the meter books it. */
export interface MeterEntry {
    /** The workspace. */
    readonly workspaceId: string
    /** The usage kind. */
    readonly kind: string
    /** The usage module. */
    readonly module: string
    /** What the run cost. */
    readonly usage: MeteredRun | null
    /** The length of the generated text. */
    readonly completionChars: number
    /** What the call was and how it went: its kind, hidden reasoning, time, try, upstream and finish reason. */
    readonly call?: MeteredCall | undefined
    /** The model a call booked with no usage asked for (a failed try): what its estimate is priced at. */
    readonly model?: string | undefined
    /** The characters of the prompt, for a call booked with no usage (a failed try): the meter estimates its tokens from them. */
    readonly promptChars?: number | undefined
    /** Set for a FAILED try (`timeout`, `provider`, `length`, `empty`): booked estimated and priced, never billed. */
    readonly failure?: string | undefined
    /**
     * A failed try whose usage is the provider's OWN report (FX5: a try cut at the token limit whose reply carried its usage): booked
     * with those figures, not estimated; still never billed. Absent or false: the failed try is booked estimated.
     */
    readonly reported?: boolean | undefined
}

/** What one metered model call was and how it went, beside what it cost: the run page shows it per call kind. */
export interface MeteredCall {
    /** The call kind: the `purpose` of a graph node's call (`<node id>:<tag>`); null for a fixed task of the app. */
    readonly purpose: string | null
    /** The answer's tokens spent on hidden reasoning (a part of the completion tokens); null when the endpoint did not say. */
    readonly reasoningTokens: number | null
    /** The wall time of the try that answered, milliseconds; null when not timed. */
    readonly durationMs: number | null
    /** Which try of the call answered, from one. */
    readonly tryNumber: number
    /** The upstream of the endpoint that served it; null when it did not say. */
    readonly upstream: string | null
    /** Why the model stopped; null when it did not say. */
    readonly finishReason: string | null
    /** What the node declared (`auto` or a model id); absent for a fixed task of the app. */
    readonly declaredModel?: string | undefined
    /** The provider of the model that served the call (`anthropic`, `openrouter`); absent when not known. */
    readonly modelProvider?: string | undefined
    /** Why the call went to the model it went to (`model-choice.policy.ts`); absent for a fixed task. */
    readonly modelReason?: string | undefined
}

/** The sentence a workspace over its allowance is shown. */
export interface QuotaNotice {
    /** The sentence, in the asked language. */
    readonly message: string
}

/** A quota notice, or null when the workspace is within its allowance. */
export type OptionalQuotaNotice = QuotaNotice | null
