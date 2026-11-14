import { Injectable, Optional } from "@nestjs/common"
import {
    EMBEDDING_DIMENSIONS,
    PassageSearchService,
    toVector,
    type PassageLens,
    type StoredPassage,
} from "@modules/domain/knowledge-chunks"
import { KnowledgeSourceCitesService, type SourceCite } from "@modules/domain/knowledge-sources"
import {
    MeteredEmbeddings,
    PassageRetriever,
    PassageVectorStore,
    RETRIEVER_POOL,
    topScoreOf,
    type EmbedTexts,
    type NearPassage,
    type PassageLeg,
    type PassageSource,
    type RetrievedPassage,
} from "@modules/integrations/ai"
import { InjectVectorIndex, type VectorIndex } from "@modules/integrations/qdrant"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { EmbeddingService } from "./embedding.service"
import { KnowledgeLogEvent } from "./knowledge.log-events"
import type {
    OptionalPassageRead,
    PassageFound,
    PassageReadRequest,
    PassageSearchAnswer,
    PassageSearchRequest,
} from "./passage-retrieval.contracts"
import { spreadByDocument } from "./passage-spread.policy"

/** The longest query that is searched. */
const QUERY_MAX_CHARS = 300

/** How long the embedding of a query may take before the search goes on with words alone. */
const EMBED_TIMEOUT_MS = 2500

/** The most hits one page answers. */
const PAGE_MAX = 40

/** The most passages a read takes on each side of its anchor. */
const SIDE_MAX = 5

/** The best fused score: first place in both legs. A hit's relevance is its share of it. */
const TOP_SCORE = topScoreOf(2)

/** A stored passage as the retriever takes it. */
const retrievedOf = (passage: StoredPassage): RetrievedPassage => ({
    id: passage.id,
    documentId: passage.sourceId,
    position: passage.order,
    content: passage.content,
    customerReady: passage.customerReady,
    place: passage.place,
})

/** A count inside 0 and the most. */
const within = (wanted: number, most: number): number => Math.max(0, Math.min(Math.trunc(wanted), most))

@Injectable()
/**
 * Finds and reads the passages of a business's documents ON DEMAND, the way a code assistant reads a big repository: search by words
 * and by meaning, look at ranked hits, read one with its neighbours, page through a document, search again. Nothing is stuffed into a
 * prompt beforehand.
 *
 * The search is LangChain's retriever (`PassageRetriever`, BE-AI-5) built per call over this capability's own statements, bound to
 * ONE lens: the workspace, the reader's module and instance and its audience are fixed in the functions handed to the retriever, so
 * a customer-facing reader gets only public passages the trust gate released and nothing in a query can change that. The query is
 * embedded through the metered `EmbeddingService` (`MeteredEmbeddings`), once per search, and never when the mode is `words`.
 *
 * A search is three bounded statements whatever the workspace holds (word leg, meaning leg, cites by primary key); a read is at most
 * four (the anchor, forward, backward, the cite). The ranked hits are served spread over their documents (`spreadByDocument`): one
 * bulk document never fills a page.
 */
export class PassageRetrievalService {
    constructor(
        private readonly passages: PassageSearchService,
        private readonly cites: KnowledgeSourceCitesService,
        private readonly embeddings: EmbeddingService,
        @Optional() @InjectVectorIndex() private readonly index: VectorIndex | null,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** One page of the passages of the lens that answer a query, best first; a blank query finds nothing and spends nothing. */
    async search(lens: PassageLens, request: PassageSearchRequest): Promise<PassageSearchAnswer> {
        const query = request.query.trim().slice(0, QUERY_MAX_CHARS)
        if (query === "") return { legs: [], hits: [], next: null }
        const stored = new Map<string, StoredPassage>()
        const keep = <Hit extends StoredPassage>(hits: ReadonlyArray<Hit>): ReadonlyArray<Hit> => {
            for (const hit of hits) stored.set(hit.id, hit)
            return hits
        }
        const ran = new Set<PassageLeg>(["words"])
        const complete = new Set<string>()
        const state = { meaningDown: false }
        const cited = new Map<string, SourceCite>()
        const source: PassageSource = {
            // Ranked unless the caller asks otherwise: a question in a customer's words still finds the passage that holds most of
            // them, and a passage holding all of them is counted first by the fusion (`complete`).
            byWords: async (words, limit) =>
                keep(await this.passages.byWords(lens, { words, limit, match: request.match ?? "ranked" })).map((hit) => {
                    if (hit.complete) complete.add(hit.id)
                    return { ...retrievedOf(hit), complete: hit.complete }
                }),
            byVector: async (vector, limit) => {
                ran.add("meaning")
                if (this.index != null) {
                    // THE READ SWITCH: with a vector index bound the meaning leg reads it; without one, the pgvector statement below.
                    // An index that does not answer is no failure of the search: the word leg stands and the answer says so.
                    const near = await this.nearInIndex(this.index, lens, vector, limit, keep).catch((cause: unknown) => {
                        this.logger.error(KnowledgeLogEvent.IndexUnavailable, cause, { workspaceId: lens.workspaceId })
                        return null
                    })
                    if (near !== null) return near
                    ran.delete("meaning")
                    state.meaningDown = true
                    return []
                }
                const model = this.embeddings.model()
                const near = keep(await this.passages.byMeaning(lens, { vector: toVector(vector), model, limit }))
                return near.map((hit) => ({ ...retrievedOf(hit), similarity: 1 - hit.distance }))
            },
            cites: async (documentIds) => {
                const read = await this.cites.of(lens.workspaceId, documentIds)
                for (const [id, cite] of read) cited.set(id, cite)
                return read
            },
        }
        const retriever = new PassageRetriever({
            source,
            store: this.meaningOf(lens, request, source),
            pool: RETRIEVER_POOL,
            tags: ["nivo.tool.brain.passage.search"],
        })
        const documents = await retriever.invoke(query)
        const ranked = documents.flatMap(({ metadata, pageContent }): ReadonlyArray<PassageFound> => {
            const passage = stored.get(metadata.passageId)
            // A passage whose document is gone between the two reads is no hit: it has nothing to cite.
            if (passage === undefined || metadata.title === null || metadata.updatedAt === null) return []
            return [
                {
                    id: passage.id,
                    sourceId: passage.sourceId,
                    title: metadata.title,
                    updatedAt: metadata.updatedAt,
                    documentPassages: metadata.documentPassages ?? 0,
                    order: passage.order,
                    place: passage.place,
                    module: passage.module,
                    visibility: passage.visibility,
                    customerReady: passage.customerReady,
                    legs: metadata.legs,
                    score: Math.min(1, metadata.score / TOP_SCORE),
                    complete: complete.has(passage.id),
                    content: pageContent,
                },
            ]
        })
        // No document fills a page: the parts of one long document count as one (`passage-spread.policy.ts`).
        const found = spreadByDocument(ranked, (hit) => ({
            document: cited.get(hit.sourceId)?.firstPartId ?? hit.sourceId,
            complete: hit.complete === true,
        }))
        const from = within(request.after, found.length)
        const to = from + Math.max(1, within(request.limit, PAGE_MAX))
        return {
            legs: [...ran].toSorted((left, right) => left.localeCompare(right)),
            hits: found.slice(from, to),
            next: to < found.length ? to : null,
            ...(state.meaningDown ? { degraded: "meaning_unavailable" as const } : {}),
        }
    }

    /**
     * A stretch of one document in reading order: the named passage with its neighbours, or the passages from a position. Null when the
     * lens holds nothing of it: a missing id, a document of another lens, and for a customer reader a document none of whose passages
     * is served, all alike.
     */
    async read(lens: PassageLens, request: PassageReadRequest): Promise<OptionalPassageRead> {
        const anchor = request.passageId === undefined ? null : await this.passages.one(lens, request.passageId)
        if (request.passageId !== undefined && anchor === null) return null
        const sourceId = anchor?.sourceId ?? request.sourceId
        if (sourceId === undefined) return null
        const at = Math.max(0, Math.trunc(anchor?.order ?? request.at ?? 0))
        const before = within(request.before, SIDE_MAX)
        const after = within(request.after, SIDE_MAX)
        const [forward, backward] = await Promise.all([
            this.passages.stretch(lens, { sourceId, from: at, direction: "forward", limit: after + 2 }),
            this.passages.stretch(lens, { sourceId, from: at, direction: "backward", limit: before + 1 }),
        ])
        if (forward.length === 0 && backward.length === 0) return null
        const cite = (await this.cites.of(lens.workspaceId, [sourceId])).get(sourceId)
        if (cite === undefined) return null
        const stretch = [...backward.slice(0, before).toReversed(), ...forward.slice(0, after + 1)]
        return {
            sourceId,
            title: cite.title,
            updatedAt: cite.updatedAt,
            documentPassages: cite.passages,
            passages: stretch.map((passage) => ({
                id: passage.id,
                order: passage.order,
                place: passage.place,
                customerReady: passage.customerReady,
                content: passage.content,
            })),
            prev: backward[before]?.order ?? null,
            next: forward[after + 1]?.order ?? null,
        }
    }

    /**
     * The meaning leg through the vector index (one index call, one Postgres read): the index answers ids and scores inside the scope
     * built from the lens, then the rows are read back from Postgres IN THE LENS and only those are kept, in the index's order. A point
     * whose row is gone, moved or no longer served to a customer is dropped here: the index may lag, it never decides what is read.
     */
    private async nearInIndex(
        index: VectorIndex,
        lens: PassageLens,
        vector: ReadonlyArray<number>,
        limit: number,
        keep: (hits: ReadonlyArray<StoredPassage>) => ReadonlyArray<StoredPassage>,
    ): Promise<ReadonlyArray<NearPassage>> {
        const matches = await index.search(
            "passage",
            { ...lens, model: this.embeddings.model(), standing: "in_force" },
            vector,
            { limit },
        )
        const rows = new Map(
            keep(
                await this.passages.byIds(
                    lens,
                    matches.map((match) => match.id),
                ),
            ).map((row) => [row.id, row]),
        )
        return matches.flatMap((match): ReadonlyArray<NearPassage> => {
            const row = rows.get(match.id)
            return row === undefined ? [] : [{ ...retrievedOf(row), similarity: match.score }]
        })
    }

    /**
     * The meaning leg of one search, or null when the search is by words alone: the mode says so, or there is neither a vector the
     * caller already made nor a way to embed. The query is embedded through the metered service, charged to the lens's workspace.
     */
    private meaningOf(
        lens: PassageLens,
        request: PassageSearchRequest,
        source: PassageSource,
    ): PassageVectorStore | null {
        if (request.mode === "words") return null
        const given = request.vector?.length === EMBEDDING_DIMENSIONS ? request.vector : null
        if (given === null && !this.embeddings.configured()) return null
        const embed: EmbedTexts = (texts) =>
            given === null
                ? this.embeddings.embed({
                      workspaceId: lens.workspaceId,
                      texts,
                      timeoutMs: request.embedTimeoutMs ?? EMBED_TIMEOUT_MS,
                      step: "search",
                  })
                : Promise.resolve(texts.map(() => given))
        return new PassageVectorStore(new MeteredEmbeddings(embed), source.byVector)
    }
}
