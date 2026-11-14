import type { GenerationWork, RunUsage } from "./ai-generations.contracts"
import type { Locale } from "@modules/platform/i18n"

/** What the plan allowance says about a workspace that is over it. */
export interface QuotaBlock {
    /** The sentence to show the person, in the asked language. */
    readonly message: string
}

/** A quota block, or null when the workspace is within its allowance. */
export type OptionalQuotaBlock = QuotaBlock | null

/** One metered generation. */
export interface GenerationUsageRecord {
    /** The workspace. */
    readonly workspaceId: string
    /** The usage kind. */
    readonly kind: string
    /** The usage module. */
    readonly module: string
    /** What the run cost, or null. */
    readonly usage: RunUsage | null
    /** The length of the generated text. */
    readonly completionChars: number
    /** The length of the prompt, for a run that reported no usage: the estimate then has something to count. */
    readonly promptChars?: number
    /** The agent run the generation was made for, when it was made for one. */
    readonly runId?: string
    /** The work the generation was asked for (the caller's work scope, carried through the queue); absent books none. */
    readonly work?: GenerationWork | undefined
    /** The model a record with no usage asked for (a failed try); absent books `unknown`. */
    readonly model?: string | undefined
    /** Set for a FAILED try (`timeout`, `no_answer`): never billed (U1); booked estimated from `promptChars` unless `reported`. */
    readonly failure?: string | undefined
    /** A failed try booked with the provider's own figures (a try cut at its cap reports its usage): not estimated, still never billed. */
    readonly reported?: boolean | undefined
}

/**
 * The plan allowance and the usage meter. The billing lane (L09) implements it over domain/usage; the app root binds it to the
 * token `AI_GENERATIONS_USAGE`.
 */
export interface UsageGate {
    /** The block when the workspace has used its allowance for the kind. */
    blockedBy(workspaceId: string, kind: string, locale: Locale): Promise<OptionalQuotaBlock>
    /** Meters one finished generation. */
    record(entry: GenerationUsageRecord): Promise<void>
}
