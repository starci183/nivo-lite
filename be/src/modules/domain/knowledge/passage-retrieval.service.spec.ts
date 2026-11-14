import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EMBEDDING_DIMENSIONS, PassageSearchService } from "@modules/domain/knowledge-chunks"
import type { PassageLens, StoredPassage } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourceCitesService } from "@modules/domain/knowledge-sources"
import { VECTOR_INDEX } from "@modules/integrations/qdrant"
import type { VectorIndex } from "@modules/integrations/qdrant"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { FakeVectorIndex } from "@tests/fixtures/builders/vector-sync.builder"

import { CHINH_SACH_GIAO_HANG_VI, GIO_MO_CUA_VI, PHI_SHIP_NOI_THANH_VI, PHI_SHIP_NOI_THANH_VI_2, SP_0123_35_000D_VI } from "@tests/fixtures/i18n/knowledge-spec.messages"
import { EmbeddingService } from "./embedding.service"
import { PassageRetrievalService } from "./passage-retrieval.service"

/** A hit of the word leg, as the passage search answers it. */
type WordHit = Awaited<ReturnType<PassageSearchService["byWords"]>>[number]
/** A hit of the meaning leg: a passage the vector index found, with its cosine distance (lower = nearer). */
interface MeaningHit extends StoredPassage {
    readonly distance: number
}
/** The cite of one document, as the cites service answers it. */
type SourceCite = NonNullable<ReturnType<Awaited<ReturnType<KnowledgeSourceCitesService["of"]>>["get"]>>

const WS = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const internal: PassageLens = { workspaceId: WS, module: "chatbot", audience: "internal", installationId: null }
const customer: PassageLens = { ...internal, audience: "customer" }
const VECTOR = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.01)

const stored = (id: string, order = 0, extra: Partial<StoredPassage> = {}): StoredPassage => ({
    id,
    sourceId: "s1",
    module: null,
    order,
    content: `text ${id}`,
    visibility: "public",
    customerReady: true,
    place: null,
    ...extra,
})
const word = (id: string, rank: number, complete = false): WordHit => ({ ...stored(id), rank, complete })
const meaning = (id: string, distance: number): MeaningHit => ({ ...stored(id), distance })

const cite = (id: string, passages: number): SourceCite => ({
    id,
    title: CHINH_SACH_GIAO_HANG_VI,
    updatedAt: "2026-11-02T03:00:00.000Z",
    passages,
    part: null,
    firstPartId: null,
})

/** The doubles of the layers a retrieval reads through. */
interface Doubles {
    readonly passages: ReturnType<typeof mock<PassageSearchService>>
    readonly cites: ReturnType<typeof mock<KnowledgeSourceCitesService>>
    readonly embeddings: ReturnType<typeof mock<EmbeddingService>>
}

/** Gives the doubles the answers every case starts from. */
const script = ({ passages, cites, embeddings }: Doubles): void => {
    passages.byIds.mockResolvedValue([])
    passages.byWords.mockResolvedValue([])
    passages.stretch.mockResolvedValue([])
    passages.one.mockResolvedValue(null)
    cites.of.mockResolvedValue(new Map([["s1", cite("s1", 5)]]))
    embeddings.configured.mockReturnValue(true)
    embeddings.model.mockReturnValue("m1@1536")
    embeddings.embed.mockResolvedValue([VECTOR])
}

/** The service over its vector index (the only meaning leg); the index double comes back to be scripted by the case. */
const build = async () => {
    const passages = mock<PassageSearchService>()
    const cites = mock<KnowledgeSourceCitesService>()
    const embeddings = mock<EmbeddingService>()
    const logger = mock<Logger>()
    script({ passages, cites, embeddings })
    const index = mock<VectorIndex>()
    index.search.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            PassageRetrievalService,
            { provide: PassageSearchService, useValue: passages },
            { provide: KnowledgeSourceCitesService, useValue: cites },
            { provide: EmbeddingService, useValue: embeddings },
            { provide: VECTOR_INDEX, useValue: index },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(PassageRetrievalService), passages, cites, embeddings, logger, index }
}

/** The world's vector index answers these passages, nearest first, and Postgres serves their rows back in the lens. */
const near = (world: Awaited<ReturnType<typeof build>>, hits: ReadonlyArray<MeaningHit>): void => {
    world.index.search.mockResolvedValue(hits.map((hit) => ({ id: hit.id, score: 1 - hit.distance })))
    world.passages.byIds.mockResolvedValue(hits.map(({ distance: _distance, ...row }) => row))
}

/** How many statements and model calls one call made. */
const spentOf = ({ passages, cites, embeddings }: Awaited<ReturnType<typeof build>>) => ({
    statements:
        passages.byWords.mock.calls.length +
        passages.stretch.mock.calls.length +
        passages.one.mock.calls.length +
        passages.byIds.mock.calls.length +
        cites.of.mock.calls.length,
    embeddings: embeddings.embed.mock.calls.length,
})

const registerSearchCases = () => {
    it("fuses words and meaning in the caller's lens: both legs first, one embedding booked to the workspace", async () => {
        const world = await build()
        world.passages.byWords.mockResolvedValue([word("code", 0.9), word("both", 0.4)])
        near(world, [meaning("near", 0.2), meaning("both", 0.3)])

        const found = await world.service.search(customer, {
            query: PHI_SHIP_NOI_THANH_VI,
            mode: "auto",
            limit: 6,
            after: 0,
        })

        expect(found.legs).toEqual(["meaning", "words"])
        expect(found.hits.map((hit) => [hit.id, hit.legs])).toEqual([
            ["both", ["words", "meaning"]],
            ["code", ["words"]],
            ["near", ["meaning"]],
        ])
        expect(found.hits[0]).toMatchObject({
            sourceId: "s1",
            title: CHINH_SACH_GIAO_HANG_VI,
            updatedAt: "2026-11-02T03:00:00.000Z",
            documentPassages: 5,
            order: 0,
            customerReady: true,
            content: "text both",
        })
        expect(found.next).toBeNull()
        // The lens is the caller's, unchanged, in every read; the query is trimmed; the words are ranked by default.
        expect(world.passages.byWords).toHaveBeenCalledWith(customer, {
            words: PHI_SHIP_NOI_THANH_VI_2,
            limit: 40,
            match: "ranked",
        })
        expect(world.index.search).toHaveBeenCalledWith("passage", { ...customer, model: "m1@1536", standing: "in_force" }, VECTOR, {
            limit: 40,
        })
        expect(world.embeddings.embed).toHaveBeenCalledWith({
            workspaceId: WS,
            texts: [PHI_SHIP_NOI_THANH_VI_2],
            timeoutMs: 2500,
            step: "search",
        })
        expect(world.cites.of).toHaveBeenCalledWith(WS, ["s1"])
        expect(spentOf(world)).toEqual({ statements: 3, embeddings: 1 })
    })

    it("spends nothing in words mode, and finds a code or a number without a vector", async () => {
        const world = await build()
        world.passages.byWords.mockResolvedValue([word("code", 0.9)])

        const found = await world.service.search(internal, {
            query: SP_0123_35_000D_VI,
            mode: "words",
            limit: 6,
            after: 0,
        })

        expect(found).toMatchObject({ legs: ["words"], hits: [{ id: "code", legs: ["words"], score: 0.5 }] })
        expect(world.passages.byWords).toHaveBeenCalledWith(internal, {
            words: SP_0123_35_000D_VI,
            limit: 40,
            match: "ranked",
        })
        expect(spentOf(world)).toEqual({ statements: 2, embeddings: 0 })
    })

}

const registerSearchRankingCases = () => {
    it("puts a passage holding every word above passages only near in meaning, and lets meaning compete with a partial word hit", async () => {
        const world = await build()
        // A customer's question: the word leg finds one passage holding all its words (complete) and one holding some of them.
        world.passages.byWords.mockResolvedValue([word("partial", 2.4), word("exact", 2.1, true)])
        near(world, [meaning("near1", 0.2), meaning("near2", 0.25), meaning("near3", 0.3)])

        const found = await world.service.search(internal, { query: "mau don nu khong no", mode: "auto", limit: 6, after: 0 })

        // exact: 2 / (60 + 2); partial: 1 / 61 = near1: 1 / 61 (tie by id); then near2, near3.
        expect(found.hits.map((hit) => hit.id)).toEqual(["exact", "near1", "partial", "near2", "near3"])
        // The answer says which hit holds every word: the tool tells the agent a search is weak when none does.
        expect(found.hits.map((hit) => hit.complete)).toEqual([true, false, false, false, false])
        expect(spentOf(world)).toEqual({ statements: 3, embeddings: 1 })
    })

    it("goes on with words when no vector can be had, and says which legs ran", async () => {
        const world = await build()
        world.embeddings.embed.mockResolvedValue(null)
        world.passages.byWords.mockResolvedValue([word("code", 0.9)])

        const found = await world.service.search(internal, { query: GIO_MO_CUA_VI, mode: "auto", limit: 6, after: 0 })

        expect(found.legs).toEqual(["words"])
        expect(world.index.search).not.toHaveBeenCalled()
    })

    it("does not embed when embeddings are not configured, and uses a vector the caller already made", async () => {
        const off = await build()
        off.embeddings.configured.mockReturnValue(false)
        await off.service.search(internal, { query: "ship", mode: "auto", limit: 6, after: 0 })
        expect(spentOf(off)).toEqual({ statements: 2, embeddings: 0 })

        const given = await build()
        given.embeddings.configured.mockReturnValue(false)
        await given.service.search(internal, { query: "ship", mode: "auto", limit: 6, after: 0, vector: VECTOR })
        expect(given.index.search).toHaveBeenCalledTimes(1)
        expect(given.embeddings.embed).not.toHaveBeenCalled()
    })

}

const registerSearchPagingCases = () => {
    it("pages through one stable order: the same query answers the same pages, with no hit twice and none lost", async () => {
        const world = await build()
        const ids = Array.from({ length: 25 }, (_, index) => `p${String(index).padStart(2, "0")}`)
        world.passages.byWords.mockResolvedValue(ids.map((id, index) => word(id, 1 - index / 100)))
        near(world, ids.toReversed().map((id, index) => meaning(id, index / 100)))
        const page = (after: number) =>
            world.service.search(internal, { query: "ship", mode: "auto", limit: 10, after })

        const [first, second, third, again] = [await page(0), await page(10), await page(20), await page(10)]

        expect([first.next, second.next, third.next]).toEqual([10, 20, null])
        const seen = [...first.hits, ...second.hits, ...third.hits].map((hit) => hit.id)
        expect(seen).toHaveLength(25)
        expect(new Set(seen).size).toBe(25)
        expect(again.hits.map((hit) => hit.id)).toEqual(second.hits.map((hit) => hit.id))
        // A place past the pool is an empty page, never an error.
        await expect(page(80)).resolves.toMatchObject({ hits: [], next: null })
    })

    it("D-W-3: one bulk document, its parts counted as one, never fills a page: the other documents' best hits come before its fourth", async () => {
        const world = await build()
        const of = (id: string, sourceId: string, rank: number): WordHit => ({ ...stored(id, 0, { sourceId }), rank, complete: false })
        // Six passages of one long internal document (two of its parts) outrank the one passage of the catalogue and of a letter.
        world.passages.byWords.mockResolvedValue([
            of("bulk-1", "bulk-part-1", 0.9),
            of("bulk-2", "bulk-part-2", 0.8),
            of("bulk-3", "bulk-part-1", 0.7),
            of("bulk-4", "bulk-part-2", 0.6),
            of("bulk-5", "bulk-part-1", 0.5),
            of("bulk-6", "bulk-part-2", 0.4),
            of("catalogue", "catalogue", 0.3),
            of("letter", "letters", 0.2),
        ])
        world.cites.of.mockResolvedValue(
            new Map([
                ["bulk-part-1", cite("bulk-part-1", 300)],
                ["bulk-part-2", { ...cite("bulk-part-2", 300), part: 2, firstPartId: "bulk-part-1" }],
                ["catalogue", cite("catalogue", 40)],
                ["letters", cite("letters", 60)],
            ]),
        )

        const first = await world.service.search(internal, { query: "code name", mode: "words", limit: 6, after: 0 })
        const second = await world.service.search(internal, { query: "code name", mode: "words", limit: 6, after: 6 })

        expect(first.hits.map((hit) => hit.id)).toEqual(["bulk-1", "bulk-2", "bulk-3", "catalogue", "letter", "bulk-4"])
        expect(first.next).toBe(6)
        // Nothing is dropped: the rest of the bulk document follows on the next page.
        expect(second.hits.map((hit) => hit.id)).toEqual(["bulk-5", "bulk-6"])
        expect(second.next).toBeNull()
    })

    it("finds nothing and runs nothing for a blank query", async () => {
        const world = await build()

        await expect(
            world.service.search(internal, { query: "   ", mode: "auto", limit: 6, after: 0 }),
        ).resolves.toEqual({
            legs: [],
            hits: [],
            next: null,
        })

        expect(spentOf(world)).toEqual({ statements: 0, embeddings: 0 })
    })

    it("costs the same three statements and one embedding whatever the workspace holds (200,000 passages)", async () => {
        const world = await build()
        // Each leg answers its own bounded pool however many passages match: the store never hands over more than it was asked for.
        const pool = (limit: number) => Array.from({ length: limit }, (_, index) => `p${index}`)
        world.passages.byWords.mockImplementation((_lens, query) =>
            Promise.resolve(pool(query.limit).map((id, index) => word(id, 1 / (index + 1)))),
        )
        world.index.search.mockImplementation((_kind, _scope, _vector, page) =>
            Promise.resolve(pool(page.limit).map((id, index) => ({ id: `m${id}`, score: 1 - index / 1000 }))),
        )
        world.passages.byIds.mockImplementation((_lens, ids) => Promise.resolve(ids.map((id) => stored(id))))
        const searches = 50

        for (let round = 0; round < searches; round += 1) {
            const found = await world.service.search(internal, {
                query: `ship ${round}`,
                mode: "auto",
                limit: 10,
                after: 0,
            })
            expect(found.hits).toHaveLength(10)
        }

        expect(spentOf(world)).toEqual({ statements: 3 * searches, embeddings: searches })
        expect(world.passages.byWords.mock.calls.every(([, query]) => query.limit === 40)).toBe(true)
        expect(world.index.search.mock.calls.every(([, , , page]) => page.limit === 40)).toBe(true)
        // The cite read names at most the documents of the pool: by primary key, never a listing of the workspace.
        expect(world.cites.of.mock.calls.every(([, ids]) => ids.length <= 80)).toBe(true)
    })
}

const registerReadCases = () => {
    it("reads a passage with its neighbours and says where to go on", async () => {
        const world = await build()
        world.passages.one.mockResolvedValue(stored("p2", 2))
        world.passages.stretch.mockImplementation((_lens, stretch) =>
            Promise.resolve(
                stretch.direction === "forward"
                    ? [stored("p2", 2), stored("p3", 3), stored("p4", 4)]
                    : [stored("p1", 1), stored("p0", 0)],
            ),
        )

        const read = await world.service.read(internal, { passageId: "p2", before: 1, after: 1 })

        expect(read).toMatchObject({
            sourceId: "s1",
            title: CHINH_SACH_GIAO_HANG_VI,
            documentPassages: 5,
            prev: 0,
            next: 4,
        })
        expect(read?.passages.map((passage) => passage.order)).toEqual([1, 2, 3])
        expect(world.passages.stretch).toHaveBeenCalledWith(internal, {
            sourceId: "s1",
            from: 2,
            direction: "forward",
            limit: 3,
        })
        expect(world.passages.stretch).toHaveBeenCalledWith(internal, {
            sourceId: "s1",
            from: 2,
            direction: "backward",
            limit: 2,
        })
        expect(spentOf(world)).toEqual({ statements: 4, embeddings: 0 })
    })

    it("stops at the first passage of a document: nothing before it", async () => {
        const world = await build()
        world.passages.one.mockResolvedValue(stored("p0", 0))
        world.passages.stretch.mockImplementation((_lens, stretch) =>
            Promise.resolve(stretch.direction === "forward" ? [stored("p0", 0), stored("p1", 1), stored("p2", 2)] : []),
        )

        const read = await world.service.read(internal, { passageId: "p0", before: 5, after: 1 })

        expect(read?.passages.map((passage) => passage.order)).toEqual([0, 1])
        expect(read).toMatchObject({ prev: null, next: 2 })
    })

}

const registerReadEdgeCases = () => {
    it("stops at the last passage of a document: nothing after it", async () => {
        const world = await build()
        world.passages.one.mockResolvedValue(stored("p4", 4))
        world.passages.stretch.mockImplementation((_lens, stretch) =>
            Promise.resolve(stretch.direction === "forward" ? [stored("p4", 4)] : [stored("p3", 3), stored("p2", 2)]),
        )

        const read = await world.service.read(internal, { passageId: "p4", before: 1, after: 5 })

        expect(read?.passages.map((passage) => passage.order)).toEqual([3, 4])
        expect(read).toMatchObject({ prev: 2, next: null })
    })

    it("pages through a document from a position, with no anchor read", async () => {
        const world = await build()
        world.passages.stretch.mockImplementation((_lens, stretch) =>
            Promise.resolve(stretch.direction === "forward" ? [stored("p3", 3), stored("p4", 4)] : [stored("p2", 2)]),
        )

        const read = await world.service.read(internal, { sourceId: "s1", at: 3, before: 0, after: 5 })

        expect(read?.passages.map((passage) => passage.order)).toEqual([3, 4])
        expect(read).toMatchObject({ prev: 2, next: null })
        expect(world.passages.one).not.toHaveBeenCalled()
        expect(spentOf(world)).toEqual({ statements: 3, embeddings: 0 })
    })

    it("answers null alike for a passage the lens does not hold, a document it holds nothing of, and a document that is gone", async () => {
        const world = await build()

        // A withheld or foreign passage: the anchor read (in the lens) finds nothing, and nothing else is read.
        await expect(world.service.read(customer, { passageId: "held", before: 1, after: 1 })).resolves.toBeNull()
        expect(world.passages.stretch).not.toHaveBeenCalled()
        expect(world.cites.of).not.toHaveBeenCalled()

        // An internal document, or a public one whose every passage is withheld: no served passage, so no cite is read at all.
        await expect(
            world.service.read(customer, { sourceId: "internal-doc", at: 0, before: 1, after: 1 }),
        ).resolves.toBeNull()
        expect(world.cites.of).not.toHaveBeenCalled()

        world.passages.stretch.mockResolvedValue([stored("p0", 0, { sourceId: "gone" })])
        await expect(world.service.read(internal, { sourceId: "gone", at: 0, before: 0, after: 0 })).resolves.toBeNull()
        await expect(world.service.read(internal, { before: 0, after: 0 })).resolves.toBeNull()
    })
}

const registerIndexCases = () => {
    it("asks the vector index inside the scope of the lens, then reads the rows back from Postgres in the lens", async () => {
        const world = await build()
        const { index } = world
        index.search.mockResolvedValue([
            { id: "near", score: 0.9 },
            { id: "both", score: 0.8 },
        ])
        world.passages.byWords.mockResolvedValue([word("both", 0.4)])
        world.passages.byIds.mockResolvedValue([stored("both"), stored("near")])

        const found = await world.service.search(customer, { query: "ship", mode: "auto", limit: 6, after: 0 })

        expect(found.hits.map((hit) => [hit.id, hit.legs])).toEqual([
            ["both", ["words", "meaning"]],
            ["near", ["meaning"]],
        ])
        // The scope is the lens and the model in use: the caller hands the index no filter.
        expect(index.search).toHaveBeenCalledWith(
            "passage",
            { ...customer, model: "m1@1536", standing: "in_force" },
            VECTOR,
            { limit: 40 },
        )
        expect(world.passages.byIds).toHaveBeenCalledWith(customer, ["near", "both"])
        // One index call and one Postgres read by ids for the meaning leg.
        expect(index.search).toHaveBeenCalledTimes(1)
        expect(spentOf(world)).toEqual({ statements: 3, embeddings: 1 })
    })

    it("searches inside the mandatory filters: never a point of another workspace, of another identity, or withheld from a customer", async () => {
        const index = new FakeVectorIndex()
        const passages = mock<PassageSearchService>()
        const cites = mock<KnowledgeSourceCitesService>()
        const embeddings = mock<EmbeddingService>()
        script({ passages, cites, embeddings })
        passages.byIds.mockImplementation((_lens, ids) => Promise.resolve(ids.map((id) => stored(id))))
        const mirror = { sourceId: "s1", module: null, installationId: null, isPublic: true, customerReady: true, inForce: true }
        index.put("passage", "mine", VECTOR, { ...mirror, workspaceId: WS, model: "m1@1536", textHash: "h" })
        index.put("passage", "theirs", VECTOR, { ...mirror, workspaceId: OTHER, model: "m1@1536", textHash: "h" })
        index.put("passage", "old-model", VECTOR, { ...mirror, workspaceId: WS, model: "old@1536", textHash: "h" })
        index.put("passage", "withheld", VECTOR, { ...mirror, workspaceId: WS, model: "m1@1536", textHash: "h", customerReady: false })
        const moduleRef = await Test.createTestingModule({
            providers: [
                PassageRetrievalService,
                { provide: PassageSearchService, useValue: passages },
                { provide: KnowledgeSourceCitesService, useValue: cites },
                { provide: EmbeddingService, useValue: embeddings },
                { provide: VECTOR_INDEX, useValue: index },
                { provide: LOGGER, useValue: mock<Logger>() },
            ],
        }).compile()
        const service = moduleRef.get(PassageRetrievalService)

        const forCustomer = await service.search(customer, { query: "ship", mode: "auto", limit: 6, after: 0 })
        const forTeam = await service.search(internal, { query: "ship", mode: "auto", limit: 6, after: 0 })

        expect(forCustomer.hits.map((hit) => hit.id)).toEqual(["mine"])
        expect(forTeam.hits.map((hit) => hit.id).toSorted()).toEqual(["mine", "withheld"])
        expect(passages.byIds.mock.calls.flatMap(([, ids]) => ids)).not.toContain("theirs")
    })

    it("never shows a point the index still holds but Postgres no longer serves: gone, superseded or withheld from customers", async () => {
        const world = await build()
        const { index } = world
        // The index lags: it still answers a deleted row, a passage withheld since, and a passage of another lens.
        index.search.mockResolvedValue([
            { id: "deleted", score: 0.99 },
            { id: "withheld", score: 0.98 },
            { id: "served", score: 0.5 },
        ])
        // Postgres, read in the customer lens, answers only the row it still serves.
        world.passages.byIds.mockResolvedValue([stored("served")])

        const found = await world.service.search(customer, { query: "ship", mode: "auto", limit: 6, after: 0 })

        expect(found.hits.map((hit) => hit.id)).toEqual(["served"])
        expect(JSON.stringify(found)).not.toMatch(/deleted|withheld/u)
    })

}

const registerIndexFailureCases = () => {
    it("answers by words alone and says so when the vector index does not answer: never an exception", async () => {
        const world = await build()
        const { index } = world
        index.search.mockRejectedValue(new Error("QDRANT_UNAVAILABLE"))

        const found = await world.service.search(customer, { query: "ship", mode: "auto", limit: 6, after: 0 })

        expect(found.legs).toEqual(["words"])
        expect(found.degraded).toBe("meaning_unavailable")
        expect(found.hits.every((hit) => hit.legs.includes("words"))).toBe(true)
        expect(world.passages.byIds).not.toHaveBeenCalled()
    })

    it("costs one index call and one read by ids per search whatever the collection holds (200,000 points)", async () => {
        const world = await build()
        const { index } = world
        index.search.mockImplementation((_kind, _scope, _vector, page) =>
            Promise.resolve(Array.from({ length: page.limit }, (_, at) => ({ id: `p${at}`, score: 1 - at / 100 }))),
        )
        world.passages.byIds.mockImplementation((_lens, ids) => Promise.resolve(ids.map((id) => stored(id))))
        const searches = 50

        for (let round = 0; round < searches; round += 1) {
            await world.service.search(internal, { query: `ship ${round}`, mode: "auto", limit: 10, after: 0 })
        }

        expect(index.search).toHaveBeenCalledTimes(searches)
        expect(world.passages.byIds).toHaveBeenCalledTimes(searches)
        expect(world.passages.byIds.mock.calls.every(([, ids]) => ids.length <= 40)).toBe(true)
        expect(spentOf(world)).toEqual({ statements: 3 * searches, embeddings: searches })
    })
}

describe("PassageRetrievalService", () => {
    describe("search", registerSearchCases)
    describe("search ranking", registerSearchRankingCases)
    describe("search paging", registerSearchPagingCases)
    describe("search through the vector index", registerIndexCases)
    describe("search when the vector index fails or is large", registerIndexFailureCases)
    describe("read", registerReadCases)
    describe("read at the edges of a document", registerReadEdgeCases)
})
