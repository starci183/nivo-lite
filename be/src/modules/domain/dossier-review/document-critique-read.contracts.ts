import type { CriticAnswer } from "./document-critic.contracts"

/** A quote as the page shows it, with the page / slide / sheet its passage sits on when the reader gave one. */
export interface CritiqueQuoteView {
    /** The words, verbatim. */
    readonly text: string
    /** page, slide or sheet, when the reader gave the place. */
    readonly placeKind: string | null
    /** The page or slide number, or the sheet name. */
    readonly placeLabel: string | null
    /** The model-free hash of the passage. */
    readonly chunkHash: string | null
    /** The stored passage, when it is one of this document. */
    readonly passageId: string | null
    /** The document it comes from. */
    readonly sourceTitle: string | null
    /** This document, or another one / the value in use. */
    readonly role: "this" | "other"
    /** The fact it backs, when any. */
    readonly factId: string | null
}

/** Why passages of a document are withheld from customers, as codes the web words (`brainCritique.serving.reason.<code>`). */
export const SERVING_REASONS = ["open_points", "unreviewed"] as const
/** One reason. */
export type ServingReason = (typeof SERVING_REASONS)[number]

/** The points of a document by state. */
export interface CritiqueCounts {
    /** Still to see. */
    readonly open: number
    /** Open and high. */
    readonly high: number
    /** Answered by the founder. */
    readonly answered: number
    /** Skipped. */
    readonly skipped: number
    /** No longer in the document. */
    readonly gone: number
}

/** The founder's answer as it is recorded on a point. */
export interface RecordedDecision {
    /** The answer. */
    readonly answer: CriticAnswer
    /** The fact the answer filed or kept. */
    readonly proposalFactId: string | null
    /** Who answered (user id). */
    readonly by: string
    /** The display name of who answered: the truths the answer settles are decided by that person. */
    readonly byName?: string
    /** A note kept on the point. */
    readonly note: string | null
}
