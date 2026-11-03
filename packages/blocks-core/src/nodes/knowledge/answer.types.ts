import type { NodeLocale } from "../node-schema.types"

/** A claim a reply may make only when an effect of the required kind was recorded in the turn. */
export interface ClaimRule {
    /** A short name for the claim. */
    readonly id: string
    /** The effect kind that must have been recorded for the reply to claim it. */
    readonly requires: string
    /** The phrases that make the claim, by language; accents and case do not matter. */
    readonly phrases: { readonly vi: ReadonlyArray<string>; readonly en: ReadonlyArray<string> }
}

/** The per-graph settings of the answer. */
export interface AnswerParams {
    /** The language of the neutral lines. */
    readonly locale: NodeLocale
    /** The claim rules, or null for the default ones. */
    readonly claims: ReadonlyArray<ClaimRule> | null
}

/** What the answer is written for. */
export interface AnswerInput {
    /** What the customer asked. */
    readonly question: string
    /** The effect kinds the turn recorded before this reply. */
    readonly recordedEffects: ReadonlyArray<string>
}

/** The reply and what the checks did to it. */
export interface AnswerOutput {
    /** The reply to send. */
    readonly reply: string
    /** True when the reply comes from the public documents; false for the neutral "no information" line. */
    readonly grounded: boolean
    /** True when a claim the turn did not back was taken out of the reply. */
    readonly rewritten: boolean
    /** The ids of the claims taken out. */
    readonly removedClaims: ReadonlyArray<string>
    /** The question the public documents could not answer, or null. */
    readonly knowledgeGap: string | null
}

/** A row of the knowledge kind as the read yields it. */
export interface DocumentRow {
    readonly id: string
    readonly title: string
    readonly body: string
    readonly visibility: string
}

/** The words of the answer in one language. */
export interface AnswerWords {
    /** The reply when the public documents do not answer. */
    readonly gap: string
    /** The reply when every sentence of the answer claimed something the turn did not do. */
    readonly neutral: string
}
