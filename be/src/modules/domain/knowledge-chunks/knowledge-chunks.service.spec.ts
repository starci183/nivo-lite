import { Test } from "@nestjs/testing"
import { Brackets, In, MoreThanOrEqual, Not } from "typeorm"
import type { WhereExpressionBuilder } from "typeorm"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { KnowledgeChunksService } from "./knowledge-chunks.service"
import type { ChunkDraft } from "./knowledge-chunks.contracts"
import { passageHashOf } from "./passage-hash.policy"
import { KnowledgeChunkEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"

const chunkOf = builder<KnowledgeChunkEntity>({
    id: "c1",
    workspaceId: WS,
    sourceId: "s1",
    module: "chatbot",
    ord: 0,
    content: "a",
    embedding: null,
    fts: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    visibility: "internal",
    embeddingModel: null,
    installationId: null,
    contentHash: null,
    placeKind: null,
    placeLabel: null,
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
})

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [KnowledgeChunksService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(KnowledgeChunksService)
}

const drafts = (count: number, vector: string | null): Array<ChunkDraft> =>
    Array.from({ length: count }, (_, index) => ({ text: `p${index}`, vector }))

const passage = (ord: number, embedding: string | null, embeddingModel: string | null, content = "") => ({
    workspaceId: WS,
    sourceId: "s1",
    module: "chatbot",
    visibility: "internal",
    installationId: null,
    ord,
    content,
    embedding,
    embeddingModel,
    contentHash: embeddingModel === null ? null : passageHashOf(content, embeddingModel),
    placeKind: null,
    placeLabel: null,
})

/** The order numbers of the rows an insert was given. */
const ordsOf = (rows: unknown): Array<number> =>
    Array.isArray(rows)
        ? rows.flatMap((row: unknown) => (isRecord(row) && typeof row.ord === "number" ? [row.ord] : []))
        : []

const write = (list: ReadonlyArray<ChunkDraft>) => ({
    workspaceId: WS,
    sourceId: "s1",
    module: "chatbot",
    visibility: "internal",
    installationId: null,
    model: "m1",
    drafts: list,
})

describe("KnowledgeChunksService", () => {
    describe("replace", () => {
        it("removes the old passages and stores the new ones with their vectors in one transaction", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    delete: [KnowledgeChunkEntity, { affected: 3 }],
                    insert: [KnowledgeChunkEntity, {}],
                }),
            )
            const service = await build(tx.em)

            await service.replace(write(drafts(2, "[1]")))

            expect(tx.em.delete).toHaveBeenCalledWith(KnowledgeChunkEntity, { sourceId: "s1", workspaceId: WS })
            expect(tx.em.insert).toHaveBeenCalledWith(KnowledgeChunkEntity, [
                passage(0, "[1]", "m1", "p0"),
                passage(1, "[1]", "m1", "p1"),
            ])
            expect(tx.commits).toBe(1)
        })

        it("stores passages without a vector and without a model", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    delete: [KnowledgeChunkEntity, { affected: 0 }],
                    insert: [KnowledgeChunkEntity, {}],
                }),
            )
            const service = await build(tx.em)

            await service.replace(write(drafts(1, null)))

            expect(tx.em.insert).toHaveBeenCalledWith(KnowledgeChunkEntity, [passage(0, null, null, "p0")])
        })
    })
})

describe("KnowledgeChunksService", () => {
    describe("replace", () => {
        it("inserts a long document in batches that keep the order", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    delete: [KnowledgeChunkEntity, { affected: 0 }],
                    insert: [KnowledgeChunkEntity, {}],
                }),
            )
            const service = await build(tx.em)

            await service.replace(write(drafts(120, "[1]")))

            expect(tx.em.insert).toHaveBeenCalledTimes(3)
            const orders = tx.em.insert.mock.calls.map(([, rows]) => ordsOf(rows))
            expect(orders[2]).toEqual(Array.from({ length: 20 }, (_, index) => 100 + index))
            expect(orders[1]).toEqual(Array.from({ length: 50 }, (_, index) => 50 + index))
        })

        it("only clears the old passages of a source with no passage", async () => {
            const tx = fakeTransaction(mockEntityManager({ delete: [KnowledgeChunkEntity, { affected: 2 }] }))
            const service = await build(tx.em)

            await service.replace(write([]))

            expect(tx.em.delete).toHaveBeenCalledTimes(1)
            expect(tx.em.insert).not.toHaveBeenCalled()
        })
    })

    describe("passagesOf", () => {
        it("returns the ordered passage content and embedding flags for the requested source", async () => {
            const em = mockEntityManager()
            const list = queueQueryBuilders(em, [
                {
                    getRawMany: [
                        { id: "c1", ord: 0, content: "Tea", hasEmbedding: true },
                        { id: "c2", ord: 1, content: "Coffee", hasEmbedding: false },
                    ],
                },
            ])[0]
            const service = await build(em)

            await expect(service.passagesOf(WS, "s1")).resolves.toEqual([
                { id: "c1", order: 0, content: "Tea", hasEmbedding: true },
                { id: "c2", order: 1, content: "Coffee", hasEmbedding: false },
            ])

            expect(list?.callsOf("where")).toEqual([
                ["c.workspaceId = :workspaceId AND c.sourceId = :sourceId", { workspaceId: WS, sourceId: "s1" }],
            ])
            expect(list?.callsOf("limit")).toEqual([[500]])
        })
    })

    describe("embeddedOf", () => {
        it("names the columns of the stored passages", async () => {
            const em = mockEntityManager()
            queueQueryBuilders(em, [
                { getMany: [Object.assign(chunkOf(), { embeddingModel: "m1", contentHash: "h" })] },
            ])
            const service = await build(em)

            await expect(service.embeddedOf(WS, "s1")).resolves.toEqual([
                { id: "c1", order: 0, text: "a", hash: "h", model: "m1" },
            ])
        })
    })
})

describe("KnowledgeChunksService", () => {
    describe("stale", () => {
        it("names the passages that need a vector of the model", async () => {
            const em = mockEntityManager()
            const read = queueQueryBuilders(em, [{ getMany: [chunkOf()] }])[0]
            const service = await build(em)

            await expect(service.stale(WS, "m1", 32)).resolves.toEqual([{ id: "c1", text: "a" }])

            expect(read?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: WS, model: "m1" })
            expect(read?.callsOf("limit")).toEqual([[32]])
        })
    })

    describe("setVectors", () => {
        it("gives the passages their vectors", async () => {
            const em = mockEntityManager()
            const write = queueQueryBuilders(em, [{ execute: {} }])[0]
            const service = await build(em)

            await service.setVectors({ workspaceId: WS, model: "m1", ids: ["c1"], vectors: ["[1]"], hashes: ["h"] })

            expect(write?.callsOf("update")).toEqual([[]])
            expect(evaluatedValues(write?.callsOf("set")[0]?.[0])).toEqual({
                embedding:
                    '(SELECT t.embedding::extensions.vector FROM unnest(CAST(:ids AS uuid[]), CAST(:vectors AS text[])) AS t(id, embedding) WHERE t.id = "knowledge_chunks"."id")',
                embeddingModel: "m1",
                contentHash:
                    '(SELECT t.hash FROM unnest(CAST(:ids AS uuid[]), CAST(:hashes AS text[])) AS t(id, hash) WHERE t.id = "knowledge_chunks"."id")',
            })
            expect(write?.callsOf("setParameters")).toEqual([
                [{ workspaceId: WS, ids: ["c1"], vectors: ["[1]"], hashes: ["h"] }],
            ])
        })
    })
})

describe("KnowledgeChunksService", () => {
    describe("search", () => {
        const raw = {
            id: "c1",
            sourceId: "s1",
            module: "chatbot",
            content: "a",
            score: 0.4,
            visibility: "public",
            ord: 3,
        }
        const hit = {
            id: "c1",
            sourceId: "s1",
            module: "chatbot",
            content: "a",
            score: 0.4,
            visibility: "public",
            order: 3,
        }
        const query = {
            workspaceId: WS,
            module: "chatbot",
            audience: "internal" as const,
            installationId: "i1",
            vector: "[1,2]",
            model: "m1",
            tsquery: "a | b",
            limit: 100,
        }

        it("filters by the lens in SQL and answers the best passages", async () => {
            const em = mockEntityManager()
            const [fake] = queueQueryBuilders(em, [{ getRawMany: [raw] }])
            const service = await build(em)

            await expect(service.search(query)).resolves.toEqual([hit])

            expect(fake?.callsOf("where")).toEqual([[{ workspaceId: WS }]])
            expect(fake?.callsOf("andWhere")).toHaveLength(3)
            const conditions: Array<unknown> = []
            const scope = mock<WhereExpressionBuilder>()
            scope.where.mockImplementation((...args: Array<unknown>) => (conditions.push(args), scope))
            scope.orWhere.mockImplementation((...args: Array<unknown>) => (conditions.push(args), scope))
            for (const [brackets] of fake?.callsOf("andWhere") ?? [])
                if (brackets instanceof Brackets) brackets.whereFactory(scope)
            expect(conditions).toEqual([
                ["c.module IS NULL"],
                ["c.module = :module", { module: "chatbot" }],
                ["c.installationId IS NULL"],
                ["c.installationId = :installationId", { installationId: "i1" }],
            ])
            expect(fake?.callsOf("setParameters")).toEqual([[{ vector: "[1,2]", model: "m1", tsquery: "a | b" }]])
            expect(fake?.callsOf("orderBy")).toEqual([["score", "DESC"]])
            expect(fake?.callsOf("limit")).toEqual([[40]])
        })

        it("shows public passages only to the customer audience", async () => {
            const em = mockEntityManager()
            const [fake] = queueQueryBuilders(em, [{ getRawMany: [] }])
            const service = await build(em)

            await service.search({ ...query, audience: "customer", limit: 0 })

            expect(fake?.callsOf("andWhere")).toContainEqual([{ visibility: "public" }])
            expect(fake?.callsOf("limit")).toEqual([[1]])
        })

        it("searches nothing when the query has neither a vector of a model nor words", async () => {
            const em = mockEntityManager()
            const service = await build(em)

            await expect(service.search({ ...query, model: null, tsquery: null })).resolves.toEqual([])
            await expect(service.search({ ...query, vector: null, tsquery: null })).resolves.toEqual([])

            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
})

describe("KnowledgeChunksService holds", () => {
    it("is false for a source with no passages", async () => {
        const em = mockEntityManager()
        em.exists.mockResolvedValueOnce(false)

        await expect((await build(em)).holds(WS, "s1", "m1")).resolves.toBe(false)

        expect(em.exists).toHaveBeenCalledTimes(1)
    })

    it("is true for any passage when no model is in use", async () => {
        const em = mockEntityManager()
        em.exists.mockResolvedValueOnce(true)

        await expect((await build(em)).holds(WS, "s1", null)).resolves.toBe(true)

        expect(em.exists).toHaveBeenCalledTimes(1)
    })

    it("is false when a passage has no vector of the model, and true when none lacks it", async () => {
        const em = mockEntityManager()
        em.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(true)
        await expect((await build(em)).holds(WS, "s1", "m1")).resolves.toBe(false)

        em.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        await expect((await build(em)).holds(WS, "s1", "m1")).resolves.toBe(true)
    })
})

describe("KnowledgeChunksService passagesOfSources", () => {
    it("reads the first passages of each source in one bounded query, by source then order", async () => {
        const em = mockEntityManager()
        const read = queueQueryBuilders(em, [{ getMany: [Object.assign(chunkOf(), { content: "Tea" })] }])[0]
        const service = await build(em)

        await expect(service.passagesOfSources(WS, ["s1", "s2"], 40)).resolves.toEqual([
            { id: "c1", sourceId: "s1", order: 0, text: "Tea" },
        ])

        expect(read?.callsOf("select")).toEqual([[["c.id", "c.sourceId", "c.ord", "c.content"]]])
        expect(read?.callsOf("where")).toEqual([
            [
                "c.workspaceId = :workspaceId AND c.sourceId IN (:...sourceIds) AND c.ord < :perSource",
                { workspaceId: WS, sourceIds: ["s1", "s2"], perSource: 40 },
            ],
        ])
        expect(read?.callsOf("orderBy")).toEqual([["c.sourceId", "ASC"]])
        expect(read?.callsOf("addOrderBy")).toEqual([["c.ord", "ASC"]])
        expect(read?.callsOf("limit")).toEqual([[80]])
    })

    it("caps the read and reads nothing without sources", async () => {
        const em = mockEntityManager()
        const read = queueQueryBuilders(em, [{ getMany: [] }])[0]
        const service = await build(em)

        await expect(service.passagesOfSources(WS, [], 40)).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        await service.passagesOfSources(
            WS,
            Array.from({ length: 300 }, (_, index) => `s${index}`),
            40,
        )
        expect(read?.callsOf("limit")).toEqual([[10_000]])
    })
})

describe("KnowledgeChunksService keep", () => {
    const anyOrder: unknown = expect.anything()

    const placed = (orders: ReadonlyArray<number>, vector: string | null) =>
        orders.map((order) => ({ text: `p${order}`, vector, order }))

    it("replaces only the passages of the orders it is given and leaves the others", async () => {
        const tx = fakeTransaction(
            mockEntityManager({ delete: [KnowledgeChunkEntity, { affected: 1 }], insert: [KnowledgeChunkEntity, {}] }),
        )
        const service = await build(tx.em)

        await service.keep({ ...write([]), drafts: placed([32, 33], "[1]") })

        expect(tx.em.delete).toHaveBeenCalledTimes(1)
        expect(tx.em.delete).toHaveBeenCalledWith(KnowledgeChunkEntity, {
            sourceId: "s1",
            workspaceId: WS,
            ord: anyOrder,
        })
        expect(tx.em.insert).toHaveBeenCalledWith(KnowledgeChunkEntity, [
            passage(32, "[1]", "m1", "p32"),
            passage(33, "[1]", "m1", "p33"),
        ])
        expect(tx.commits).toBe(1)
    })

    it("stores a passage without a vector with no model", async () => {
        const tx = fakeTransaction(
            mockEntityManager({ delete: [KnowledgeChunkEntity, { affected: 0 }], insert: [KnowledgeChunkEntity, {}] }),
        )
        const service = await build(tx.em)

        await service.keep({ ...write([]), drafts: placed([4], null) })

        expect(tx.em.insert).toHaveBeenCalledWith(KnowledgeChunkEntity, [passage(4, null, null, "p4")])
    })

    it("writes nothing for no passage", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const service = await build(tx.em)

        await service.keep({ ...write([]), drafts: [] })

        expect(tx.em.delete).not.toHaveBeenCalled()
        expect(tx.em.insert).not.toHaveBeenCalled()
    })

    it("stores the hash of the text and model with a vector, and none without", async () => {
        const tx = fakeTransaction(
            mockEntityManager({ delete: [KnowledgeChunkEntity, { affected: 0 }], insert: [KnowledgeChunkEntity, {}] }),
        )
        const service = await build(tx.em)

        await service.keep({ ...write([]), drafts: [...placed([1], "[1]"), ...placed([2], null)] })

        expect(tx.em.insert).toHaveBeenCalledWith(KnowledgeChunkEntity, [
            expect.objectContaining({ ord: 1, contentHash: passageHashOf("p1", "m1") }),
            expect.objectContaining({ ord: 2, contentHash: null }),
        ])
    })
})

describe("KnowledgeChunksService arrange", () => {
    it("only removes the passages past the end when nothing moves", async () => {
        const tx = fakeTransaction(mockEntityManager({ delete: [KnowledgeChunkEntity, { affected: 2 }] }))
        const service = await build(tx.em)

        await service.arrange({ workspaceId: WS, sourceId: "s1", moves: [], count: 5 })

        expect(tx.em.delete).toHaveBeenCalledTimes(1)
        expect(tx.em.delete).toHaveBeenCalledWith(KnowledgeChunkEntity, {
            sourceId: "s1",
            workspaceId: WS,
            ord: MoreThanOrEqual(5),
        })
        expect(tx.commits).toBe(1)
    })

    it("clears where moved passages land, moves them by id, and trims last so a moved passage is not lost", async () => {
        const tx = fakeTransaction(mockEntityManager({ delete: [KnowledgeChunkEntity, { affected: 1 }] }))
        const move = queueQueryBuilders(tx.em, [{ execute: {} }])[0]
        const service = await build(tx.em)

        await service.arrange({
            workspaceId: WS,
            sourceId: "s1",
            moves: [
                { id: "c7", order: 1 },
                { id: "c8", order: 2 },
            ],
            count: 3,
        })

        expect(tx.em.delete).toHaveBeenNthCalledWith(1, KnowledgeChunkEntity, {
            sourceId: "s1",
            workspaceId: WS,
            ord: In([1, 2]),
            id: Not(In(["c7", "c8"])),
        })
        expect(move?.callsOf("setParameters")).toEqual([[{ workspaceId: WS, ids: ["c7", "c8"], orders: [1, 2] }]])
        expect(evaluatedValues(move?.callsOf("set")[0]?.[0])).toEqual({
            ord: '(SELECT t.ord FROM unnest(CAST(:ids AS uuid[]), CAST(:orders AS integer[])) AS t(id, ord) WHERE t.id = "knowledge_chunks"."id")',
        })
        expect(tx.em.delete).toHaveBeenLastCalledWith(KnowledgeChunkEntity, {
            sourceId: "s1",
            workspaceId: WS,
            ord: MoreThanOrEqual(3),
        })
    })
})

describe("KnowledgeChunksService place", () => {
    it("writes the place of each order on the stored passages and reads it back by passage id", async () => {
        const row = Object.assign(chunkOf(), { placeKind: "sheet", placeLabel: "Gia" })
        const em = mockEntityManager({ find: [KnowledgeChunkEntity, [row, Object.assign(chunkOf(), { id: "c2" })]] })
        const update = queueQueryBuilders(em, [{ execute: {} }])[0]
        const service = await build(em)
        await service.place({
            workspaceId: WS,
            sourceId: "s1",
            places: [{ order: 0, place: { kind: "sheet", label: "Gia" } }],
        })

        expect(update?.callsOf("setParameters")).toEqual([
            [{ workspaceId: WS, sourceId: "s1", orders: [0], kinds: ["sheet"], labels: ["Gia"] }],
        ])
        await expect(service.placesOf(WS, ["c1", "c2"])).resolves.toEqual(
            new Map([["c1", { kind: "sheet", label: "Gia" }]]),
        )
    })
})
