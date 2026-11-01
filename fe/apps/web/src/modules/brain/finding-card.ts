import type { EvidencePlaceView, FindingAction, FindingEvidenceView, FindingView } from "./finding-view"
import type { RowTone } from "./findings"

/** Words taken from a document, with the document they come from and what the words are. */
export interface FindingQuoteView {
    readonly id: string
    /** The document the words come from. */
    readonly source: string
    /** What the words are (the label of the evidence); absent when it adds nothing. */
    readonly byline: string | undefined
    readonly text: string
}

/** One thing a reader can do from a finding card: a command on the finding, or a way to a destination. */
export interface FindingCardActionView {
    readonly id: string
    readonly label: string
    readonly intent: "commit" | "neutral" | "dismiss"
    /** Where the action leads, for an upload; null for a command. */
    readonly href: string | null
    /** The command it runs on the finding; null for a destination. */
    readonly command: FindingAction | null
    /** What a confirmation records: which document the owner said is right; null for the other commands. */
    readonly note: string | null
}

/** One finding as a card of the queue, already worded. */
export interface FindingCardView {
    readonly id: string
    readonly kind: { readonly label: string; readonly tone: RowTone }
    /** The dossier it is filed under, and where that leads; null for a finding of the whole set. */
    readonly dossier: { readonly label: string; readonly href: string } | null
    readonly title: string
    readonly detail: string
    /** The badges after the kind: how serious, AI, and that the owner's answer still waits for a document. */
    readonly badges: ReadonlyArray<{ readonly id: string; readonly label: string; readonly tone: RowTone }>
    /** What was decided on it and who has it, as one muted line; null when nothing was. */
    readonly meta: string | null
    readonly quotes: ReadonlyArray<FindingQuoteView>
    readonly actions: ReadonlyArray<FindingCardActionView>
}

/** The most quotes a card sets side by side. */
const MAX_QUOTES = 2

/** The evidence that has words to show: its quote, else the fact it rests on. */
const wordsOf = (one: FindingEvidenceView): string | null => one.quote ?? one.factLine

/** Says a place in words ("Trang 3"); the words come from the message catalog, so the caller gives them. */
export type PlaceWords = (place: EvidencePlaceView) => string

/** What a quote is and where in its document it sits, as one line; absent when it has neither. */
export const bylineOf = (one: FindingEvidenceView, placeWords: PlaceWords): string | undefined => {
    const parts = [one.sourceTitle === null ? null : one.label, one.place === null ? null : placeWords(one.place)]
    const kept = parts.filter((part): part is string => part !== null)
    return kept.length === 0 ? undefined : kept.join(" · ")
}

/** The quotes of a finding, at most two, each with its document and the page, slide or sheet it sits at. */
export const quotesOf = (finding: FindingView, placeWords: PlaceWords): ReadonlyArray<FindingQuoteView> =>
    finding.evidence
        .flatMap((one, index): ReadonlyArray<FindingQuoteView> => {
            const text = wordsOf(one)
            if (text === null) return []
            return [
                {
                    id: `${finding.id}-${index}`,
                    source: one.sourceTitle ?? one.label,
                    byline: bylineOf(one, placeWords),
                    text,
                },
            ]
        })
        .slice(0, MAX_QUOTES)

/**
 * The documents an owner can say is right: a contradiction that is still open and has two documents to choose between. The
 * choice does not close the finding, since a document that is wrong still has to change.
 */
export const confirmSidesOf = (finding: FindingView): ReadonlyArray<string> => {
    if (finding.kind !== "contradiction" || finding.status !== "open") return []
    const sources = finding.evidence.flatMap((one) =>
        wordsOf(one) === null || one.sourceTitle === null ? [] : [one.sourceTitle],
    )
    const distinct = sources.filter((source, index) => sources.indexOf(source) === index)
    return distinct.length >= 2 ? distinct.slice(0, MAX_QUOTES) : []
}

/** Whether the owner has confirmed the finding and a document still has to change, so it stays in the queue. */
export const needsDocumentOf = (finding: FindingView): boolean =>
    finding.status === "confirmed" && (finding.remedyAction === "upload" || finding.remedyAction === "draft")
