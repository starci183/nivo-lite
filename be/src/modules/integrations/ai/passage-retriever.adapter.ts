import type { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager"
import { Document } from "@langchain/core/documents"
import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers"
import type { PassageVectorStore } from "./passage-vector-store.adapter"
import { FUSION_K, fuseRanks, type Fused } from "./rank-fusion.policy"
import type { NearPassage, PassageLeg, PassageMetadata, PassageSource, RetrievedPassage } from "./retrieval.contracts"

/** How many passages each leg is asked for: the pool the fusion ranks. */
export const RETRIEVER_POOL = 40

/**
 * What a place in the word leg is worth for a passage that holds every word of the query (`complete`), against 1 for any other place:
 * an exact match outranks every passage the meaning leg alone found, while a passage that holds only some of the words still competes
 * with them place for place (that is where meaning rescues a question asked in other words than the document's).
 */
export const COMPLETE_WORDS_WEIGHT = 2

/** What a passage retriever is built from. */
export interface PassageRetrieverFields extends BaseRetrieverInput {
    /** The caller's store, already scoped to its access lane. */
    readonly source: PassageSource
    /** The meaning leg, or null for a search by words alone (nothing is embedded, nothing is spent). */
    readonly store: PassageVectorStore | null
    /** How many passages each leg is asked for; `RETRIEVER_POOL` when absent. */
    readonly pool?: number
}

/**
 * The fused list with the passages that hold every word of the query FIRST, in the word leg's own order, then the others in fused order.
 * Fusion alone let the meaning leg reorder exact answers: among several passages that all hold the code and the words, one the meaning
 * leg also found outranked the word leg's first (brain walk 3: "SP-0154 hong gi" first by words, out of the top 6 in auto). Meaning
 * still decides among the passages that hold only some of the words, which is where it rescues a question asked in other words.
 */
const exactFirst = (fused: ReadonlyArray<Fused>, complete: ReadonlySet<string>): ReadonlyArray<Fused> => {
    const exact = fused.filter((entry) => complete.has(entry.id)).toSorted((left, right) => (left.ranks[0] ?? 0) - (right.ranks[0] ?? 0))
    return [...exact, ...fused.filter((entry) => !complete.has(entry.id))]
}

/** The legs that found a passage, from its ranks. */
const legsOf = (wordRank: number | null, meaningRank: number | null): ReadonlyArray<PassageLeg> => [
    ...(wordRank === null ? [] : (["words"] as const)),
    ...(meaningRank === null ? [] : (["meaning"] as const)),
]

/**
 * The hybrid passage search as a LangChain retriever (BE-AI-5): `invoke(query)` answers `Document`s, best first, whose text is the
 * passage and whose metadata is everything an agent cites (document id and title, position, last change, customer-ready) and how
 * the passage was found (legs, ranks, similarity, fused score). The word leg and the meaning leg run side by side over the store the
 * domain handed in, and are fused by reciprocal rank (`fuseRanks`): no score of one leg is compared with a score of the other; a word
 * hit that holds every word of the query counts `COMPLETE_WORDS_WEIGHT` times.
 *
 * The access lane is not an argument: workspace, audience and lens are fixed inside `source` when the domain builds the retriever,
 * so nothing passed to `invoke` can widen what comes back. Being a `Runnable`, it reports its start and its documents to the
 * callbacks of the run it is called in, and can be piped into a chain or called from a graph node as it is.
 */
export class PassageRetriever extends BaseRetriever<PassageMetadata> {
    /** The name LangChain shows for a run of it. */
    static override lc_name(): string {
        return "PassageRetriever"
    }

    /** Where LangChain files this retriever. */
    override lc_namespace: Array<string> = ["nivo", "retrievers", "passages"]

    private readonly source: PassageSource
    private readonly store: PassageVectorStore | null
    private readonly pool: number

    constructor(fields: PassageRetrieverFields) {
        super(fields)
        this.source = fields.source
        this.store = fields.store
        this.pool = fields.pool ?? RETRIEVER_POOL
    }

    /** The fused pool for a query, best first: at most twice the pool, each passage once. */
    override async _getRelevantDocuments(
        query: string,
        _run?: CallbackManagerForRetrieverRun,
    ): Promise<Array<Document<PassageMetadata>>> {
        const [words, near] = await Promise.all([
            this.source.byWords(query, this.pool),
            this.store === null ? Promise.resolve<ReadonlyArray<NearPassage>>([]) : this.store.near(query, this.pool),
        ])
        const complete = new Set(words.filter((passage) => passage.complete === true).map((passage) => passage.id))
        const fused = exactFirst(
            fuseRanks(
                [words.map((passage) => passage.id), near.map((passage) => passage.id)],
                FUSION_K,
                (list, id) => (list === 0 && complete.has(id) ? COMPLETE_WORDS_WEIGHT : 1),
            ),
            complete,
        )
        const found = new Map<string, RetrievedPassage>([...near, ...words].map((passage) => [passage.id, passage]))
        const similarity = new Map(near.map((passage) => [passage.id, passage.similarity]))
        const cites = await this.source.cites([...new Set([...found.values()].map((passage) => passage.documentId))])
        return fused.flatMap((entry): Array<Document<PassageMetadata>> => {
            const passage = found.get(entry.id)
            if (passage === undefined) return []
            const cite = cites.get(passage.documentId)
            const [wordRank = null, meaningRank = null] = entry.ranks
            return [
                new Document<PassageMetadata>({
                    id: passage.id,
                    pageContent: passage.content,
                    metadata: {
                        passageId: passage.id,
                        documentId: passage.documentId,
                        title: cite?.title ?? null,
                        updatedAt: cite?.updatedAt ?? null,
                        documentPassages: cite?.passages ?? null,
                        position: passage.position,
                        place: passage.place,
                        customerReady: passage.customerReady,
                        legs: legsOf(wordRank, meaningRank),
                        wordRank,
                        meaningRank,
                        similarity: similarity.get(passage.id) ?? null,
                        score: entry.score,
                    },
                }),
            ]
        })
    }
}
