/**
 * How the ranked hits of one passage search are SPREAD over the documents they come from (Round W, D-W-3). A page of hits is small
 * (six by default) and one bulk document, cut into hundreds of passages that repeat the same names and codes (a stock sheet, an
 * order export, a long internal product text), filled whole pages: the catalogue passage that answers was ranked right behind them
 * and never shown, while a reader that sees only the public documents found it at once. The rank inside a document is kept; what
 * changes is that no document holds more than `DOCUMENT_RUN` places of a round before every other document with a hit had its turn.
 * Nothing is dropped: the hits a round passes over follow in the next rounds, so `next` still pages through every hit.
 * It reads ids and places only: what a passage says plays no part.
 */

/**
 * How many hits of one document a round takes before the other documents' hits: three, half of the default page of six. A page then
 * shows two documents or more whenever two have a hit, and a document still shows its three best passages first (the passage that
 * answers is often not the first of its document: sibling entries of one catalogue share most of the words). A bound chosen by
 * that reasoning, not measured: Round W run 2 measures it.
 */
export const DOCUMENT_RUN = 3

/** What the spread reads of one hit. */
export interface SpreadHit {
    /** The document the hit belongs to: the first part's id for a part of a long document, so its parts count as ONE document. */
    readonly document: string
    /** True when the passage holds every word of the query: such hits stay ahead of all the others (`exactFirst` of the retriever). */
    readonly complete: boolean
}

/** One group of hits (all complete, or all not) in rounds: each round takes, in ranked order, at most `run` hits of a document. */
const inRounds = <Hit>(hits: ReadonlyArray<Hit>, documentOf: (hit: Hit) => string, run: number): ReadonlyArray<Hit> => {
    const turn = new Map<string, number>()
    const rounds: Array<Array<Hit>> = []
    for (const hit of hits) {
        const document = documentOf(hit)
        const seen = turn.get(document) ?? 0
        turn.set(document, seen + 1)
        const round = Math.floor(seen / run)
        const held = rounds[round]
        if (held === undefined) rounds[round] = [hit]
        else held.push(hit)
    }
    return rounds.flat()
}

/**
 * The hits in the order they are served: the complete ones first and the others after them, as ranked, each group in rounds of at
 * most `run` hits per document. A permutation of `hits`: every hit once, the order inside one document unchanged.
 */
export const spreadByDocument = <Hit>(
    hits: ReadonlyArray<Hit>,
    read: (hit: Hit) => SpreadHit,
    run: number = DOCUMENT_RUN,
): ReadonlyArray<Hit> => {
    const size = Math.max(1, Math.trunc(run))
    const documentOf = (hit: Hit): string => read(hit).document
    return [
        ...inRounds(hits.filter((hit) => read(hit).complete), documentOf, size),
        ...inRounds(hits.filter((hit) => !read(hit).complete), documentOf, size),
    ]
}
