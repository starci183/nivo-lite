import type { ReasonedReview, RemedyText } from "@modules/domain/dossier-review"

/** A review, or null when the model was unavailable or its answer could not be read. */
export type OptionalReview = ReasonedReview | null

/** A draft, or null when the model was unavailable or its answer could not be read. */
export type OptionalRemedy = RemedyText | null

/** What a structured call answered, with the model and the tokens of every call it took. */
export interface ModelCallResult<T> {
    /** The parsed answer. */
    readonly value: T
    /** The model of the answer that was read. */
    readonly model: string
    /** Prompt tokens of all calls, or null when none reported any. */
    readonly promptTokens: number | null
    /** Completion tokens of all calls, or null when none reported any. */
    readonly completionTokens: number | null
}

/** A result of the structured call, or null when the model was unavailable or both answers were unreadable. */
export type OptionalCallResult<T> = ModelCallResult<T> | null
