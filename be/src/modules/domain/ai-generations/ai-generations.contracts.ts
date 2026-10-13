import type { RunUsage } from "@modules/integrations/openclaw"
import type { Locale } from "@modules/platform/i18n"

/** Who speaks a line of a generation prompt. */
export type GenMessageRole = "system" | "user" | "assistant"

/** One line of the prompt of a generation. */
export interface GenMessage {
    /** Who speaks it. */
    readonly role: GenMessageRole
    /** The text. */
    readonly content: string
}

/** What shape the generated text must have: plain text or one JSON object (the caller still parses it). */
export type ResponseFormat = "text" | "json"

/** What a caller asks the agent engine to write. */
export interface GenerateParams {
    /** The workspace the text is written for. */
    readonly workspaceId: string
    /** What the text is for (setup_chat, owner_chat, relay, classify_lead...): evidence and the usage page group by it. */
    readonly purpose: string
    /** The prompt: system instructions, the dialogue so far and the input as the last line. */
    readonly messages: ReadonlyArray<GenMessage>
    /** Text or one JSON object. */
    readonly responseFormat: ResponseFormat
    /** How long the caller waits, ms (default 45 s, between 5 s and 120 s). Past it the generation is cancelled. */
    readonly timeoutMs?: number
    /** The usage kind the metering records the text under. */
    readonly kind: string
    /** The usage module the metering records the text under. */
    readonly module: string
    /** The language of the sentence a failure carries; Vietnamese when absent. */
    readonly locale?: Locale
}

/** The generation a fenced job may run, or null when usage or engine availability requires its fallback. */
export type PreparedGenerationId = string | null

/** A generation that produced text. */
export interface GenerationSuccess {
    /** Discriminant of the success half. */
    readonly ok: true
    /** The generated text. */
    readonly output: string
    /** The ai_generations row. */
    readonly generationId: string
    /** Milliseconds from the start of the run to each named mark. */
    readonly timings: Readonly<Record<string, number>>
    /** What the run cost, or null when the gateway reported none. */
    readonly usage: RunUsage | null
}

/** Why a generation did not produce text. */
export type GenerationFailureReason = "quota" | "engine_offline" | "timeout" | "error" | "not_configured"

/** A generation that did not produce text. */
export interface GenerationFailure {
    /** Discriminant of the failure half. */
    readonly ok: false
    /** Why. */
    readonly reason: GenerationFailureReason
    /** The sentence to show, already in the request language. */
    readonly message: string
}

/** The result of one generation. */
export type GenerationOutcome = GenerationSuccess | GenerationFailure

/** The prompt and the limits stored with a queued generation. */
export interface GenerationInput {
    /** The prompt lines. */
    readonly messages: ReadonlyArray<GenMessage>
    /** Text or JSON. */
    readonly responseFormat: ResponseFormat
    /** The deadline of the caller, ms. */
    readonly timeoutMs: number
}

/** A queued generation as the runner reads it. */
export interface QueuedGeneration {
    /** The ai_generations row. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** What the text is for. */
    readonly purpose: string
    /** The usage module. */
    readonly module: string
    /** The usage kind. */
    readonly usageKind: string
    /** The status of the row. */
    readonly status: string
    /** The prompt and limits. */
    readonly input: GenerationInput
}

/** The part of a generation row the caller polls. */
export interface GenerationProgress {
    /** queued, running, done, error or cancelled. */
    readonly status: string
    /** The text, when the run is done. */
    readonly text: string | null
    /** The usage the run reported. */
    readonly usage: RunUsage | null
    /** The marks the run reported. */
    readonly timings: Readonly<Record<string, number>>
}

/** A generation's progress, or null when the row is gone. */
export type OptionalGenerationProgress = GenerationProgress | null

/** What the runner did with a queued generation: text written, failure written, or the row was no longer waiting. */
export type GenerationRunStatus = "done" | "error" | "dropped"

/** What waiting for a generation ended with. */
export type PollVerdict =
    | { readonly kind: "done"; readonly text: string; readonly progress: GenerationProgress }
    | { readonly kind: "failed" }
    | { readonly kind: "timeout" }

/** What the run of a turn on the gateway produced: the text and its cost, or the reason there is none. */
export interface TurnAttempt {
    /** The text, or null when the run failed. */
    readonly text: string | null
    /** The usage the run reported. */
    readonly usage: RunUsage | null
    /** The marks of the run. */
    readonly timings: Readonly<Record<string, number>>
    /** Why there is no text; an empty text when there is one. */
    readonly reason: string
}
