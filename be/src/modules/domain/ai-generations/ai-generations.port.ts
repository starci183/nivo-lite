import type { RunUsage } from "@modules/integrations/openclaw"
import type { Locale } from "@modules/platform/i18n"

/** What the plan allowance says about a workspace that is over it. */
export interface QuotaBlock {
    /** The sentence to show the person, in the asked language. */
    readonly message: string
}

/** A quota block, or null when the workspace is within its allowance. */
export type OptionalQuotaBlock = QuotaBlock | null

/** One metered generation. */
export interface UsageRecord {
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
}

/**
 * The plan allowance and the usage meter. The billing lane (L09) implements it over domain/usage; the app root binds it to the
 * token `AI_GENERATIONS_USAGE`.
 */
export interface UsageGate {
    /** The block when the workspace has used its allowance for the kind. */
    blockedBy(workspaceId: string, kind: string, locale: Locale): Promise<OptionalQuotaBlock>
    /** Meters one finished generation. */
    record(entry: UsageRecord): Promise<void>
}
