import type { BrainCritiqueQuery, BrainCritiqueSourcesQuery } from "@/modules/api"
import type {
    CritiqueChoiceView,
    CritiqueCompareRowView,
    CritiqueGroupView,
    CritiqueNoticeView,
    CritiquePointView,
    CritiqueQuoteView,
    DocumentReleaseView,
} from "@/modules/types"

/** What the critic read of one document. */
export type CritiqueData = BrainCritiqueQuery["brainCritique"]

/** One point of the critic as the API sends it. */
export type CritiquePointData = CritiqueData["points"][number]

/** One document the critic has a view of. */
export type CritiqueSourceData = BrainCritiqueSourcesQuery["brainCritiqueSources"][number]

/** The group of the text addressed to the AI: only the owner sees it, and it has no answer but "skip". */
export const NOT_SHOP_WORD_GROUP = "not_shop_word"

/** The words the mapping needs; the hook resolves them from the catalog so this file stays pure. */
export interface CritiqueWords {
    readonly group: (key: string) => string
    /** The word of a kind that shares its group with others (hearsay, no date); null for the kinds the group already names. */
    readonly kind: (key: string) => string | null
    readonly inForce: string
    readonly waiting: string
    readonly otherDocument: string
    readonly documentSays: string
}

/** Who reads the points: the owner answers and sees everything; a manager only reads and skips. */
export interface CritiqueViewer {
    readonly isOwner: boolean
}

/** The term of what the point is compared with: a truth in force, a proposal that waits, or another document's passage. */
const againstTermOf = (kind: string, words: CritiqueWords): string => {
    if (kind === "truth") return words.inForce
    return kind === "proposal" ? words.waiting : words.otherDocument
}

const compareRowsOf = (point: CritiquePointData, words: CritiqueWords): ReadonlyArray<CritiqueCompareRowView> | null => {
    const against = point.against
    if (against === null) return null
    const term = againstTermOf(against.kind, words)
    const own = point.quotes
        .filter((quote) => quote.role === "this")
        .map((quote, index) => ({
            id: `own-${index}`,
            term: words.documentSays,
            value: quote.text,
            meta: quote.placeLabel ?? null,
        }))
    return [{ id: "against", term, value: against.value, meta: against.sourceTitle ?? null }, ...own]
}

const quoteOf = (quote: CritiquePointData["quotes"][number], index: number): CritiqueQuoteView => ({
    id: `${index}`,
    text: quote.text,
    source: quote.role === "this" ? null : (quote.sourceTitle ?? null),
    place: quote.placeLabel ?? null,
})

const choiceOf = (choice: CritiquePointData["choices"][number]): CritiqueChoiceView => ({
    id: choice.id,
    label: choice.label,
    needsInput: choice.needsInput,
    inputHint: choice.inputHint ?? null,
})

/** One point as a row. A viewer who may not answer gets no choice button; the text addressed to the AI is shown as its quote, never as a title. */
export const critiquePointViewOf = (
    point: CritiquePointData,
    words: CritiqueWords,
    viewer: CritiqueViewer,
): CritiquePointView => {
    const compare = compareRowsOf(point, words)
    const isAddressed = point.group === NOT_SHOP_WORD_GROUP
    return {
        id: point.id,
        title: isAddressed ? words.group(point.group) : point.line,
        badge: isAddressed ? null : words.kind(point.kind),
        quotes: compare === null ? point.quotes.map((quote, index) => quoteOf(quote, index)) : [],
        compare,
        why: point.why,
        question: point.question,
        choices: viewer.isOwner ? point.choices.map((choice) => choiceOf(choice)) : [],
    }
}

/** The points a viewer sees: everything for the owner; for a manager not what is addressed to the AI. */
export const visibleCritiquePointsOf = (
    points: ReadonlyArray<CritiquePointData>,
    viewer: CritiqueViewer,
): ReadonlyArray<CritiquePointData> =>
    viewer.isOwner ? points : points.filter((point) => point.group !== NOT_SHOP_WORD_GROUP)

/** The points in the order the back end sorted them, one group per kind of doubt, the groups in order of their first point. */
export const critiqueGroupsOf = (
    points: ReadonlyArray<CritiquePointData>,
    words: CritiqueWords,
    viewer: CritiqueViewer,
): ReadonlyArray<CritiqueGroupView> => {
    const order: string[] = []
    const byGroup = new Map<string, CritiquePointView[]>()
    for (const point of visibleCritiquePointsOf(points, viewer)) {
        const list = byGroup.get(point.group)
        if (list === undefined) {
            order.push(point.group)
            byGroup.set(point.group, [critiquePointViewOf(point, words, viewer)])
        } else list.push(critiquePointViewOf(point, words, viewer))
    }
    return order.map((id) => ({ id, label: words.group(id), points: byGroup.get(id) ?? [] }))
}

/** The words of the one point the skeleton is drawn from. */
export interface CritiquePlaceholderWords {
    readonly group: string
    readonly title: string
    readonly quote: string
    readonly why: string
    readonly question: string
    readonly choices: readonly [string, string]
}

/** What the cards of the loading state draw: one group with one point of the shape of a loaded one. */
export const critiqueGroupsPlaceholderOf = (words: CritiquePlaceholderWords): ReadonlyArray<CritiqueGroupView> => [
    {
        id: "placeholder",
        label: words.group,
        points: [
            {
                id: "placeholder-point",
                title: words.title,
                badge: null,
                quotes: [{ id: "0", text: words.quote, source: null, place: null }],
                compare: null,
                why: words.why,
                question: words.question,
                choices: [
                    { id: "a", label: words.choices[0], needsInput: false, inputHint: null },
                    { id: "b", label: words.choices[1], needsInput: false, inputHint: null },
                ],
            },
        ],
    },
]

/** The words of the release card. */
export interface ReleaseWords {
    readonly readable: (count: number) => string
    readonly held: (count: number) => { readonly term: string; readonly value: string }
    readonly unreviewed: (count: number) => { readonly term: string; readonly value: string }
    readonly allServed: { readonly term: string; readonly value: string }
    readonly seePoints: (count: number) => string
    readonly release: string
    readonly confirm: (count: number) => NonNullable<DocumentReleaseView["release"]>["confirm"]
}

/** Who reads the release card and whether its command is running. */
export interface ReleaseViewer extends CritiqueViewer {
    readonly isReleasing: boolean
}

/** What customers may read of a document and what holds the rest: only the rows with a count; "all served" when nothing holds. */
export const documentReleaseViewOf = (
    data: CritiqueData,
    words: ReleaseWords,
    viewer: ReleaseViewer,
): DocumentReleaseView => {
    const { serving } = data
    const rows = [
        ...(serving.heldPassages > 0 ? [{ id: "held", ...words.held(serving.heldPassages) }] : []),
        ...(serving.unreviewedPassages > 0 ? [{ id: "unreviewed", ...words.unreviewed(serving.unreviewedPassages) }] : []),
    ]
    const open = data.counts.open
    return {
        title: data.title,
        readable: words.readable(Math.max(0, serving.totalPassages - serving.withheldPassages)),
        rows: rows.length === 0 ? [{ id: "all", ...words.allServed }] : rows,
        seePoints: open > 0 ? words.seePoints(open) : null,
        release:
            viewer.isOwner && serving.unreviewedPassages > 0
                ? {
                      label: words.release,
                      isPending: viewer.isReleasing,
                      confirm: words.confirm(serving.unreviewedPassages),
                  }
                : null,
    }
}

/** The words of the critic's notice. */
export interface CritiqueNoticeWords {
    readonly reading: { readonly title: string; readonly body: string }
    readonly failed: (reason: string | null) => { readonly title: string; readonly body: string }
    readonly retry: string
}

/** The review's state is a notice, never a skeleton: it reads, or it did not finish (with the reason in words). */
export const critiqueNoticeOf = (
    review: CritiqueData["review"],
    words: CritiqueNoticeWords,
    canRetry: boolean,
    isRetrying: boolean,
): CritiqueNoticeView | null => {
    if (review.state === "running" || review.state === "waiting") return { kind: "reading", ...words.reading, retry: null }
    if (review.state === "not_done")
        return {
            kind: "failed",
            ...words.failed(review.reason ?? null),
            retry: canRetry ? { label: words.retry, isPending: isRetrying } : null,
        }
    return null
}
