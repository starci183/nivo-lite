import { Test } from "@nestjs/testing"
import { Brackets } from "typeorm"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { KnowledgeChunksService } from "./knowledge-chunks.service"
import type { ChunkDraft } from "./knowledge-chunks.contracts"
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
})

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [KnowledgeChunksService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(KnowledgeChunksService)
}

const drafts = (count: number, vector: string | null): Array<ChunkDraft> =>
    Array.from({ length: count }, (_, index) => ({ text: `p${index}`, vector }))

const passage = (ord: number, embedding: string | null, embeddingModel: string | null) => ({
    workspaceId: WS,
    sourceId: "s1",
    module: "chatbot",
    visibility: "internal",
    installationId: null,
    ord,
    content: "",
    embedding,
    embeddingModel,
})

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
                { ...passage(0, "[1]", "m1"), content: "p0" },
                { ...passage(1, "[1]", "m1"), content: "p1" },
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

            expect(tx.em.insert).toHaveBeenCalledWith(KnowledgeChunkEntity, [
                { ...passage(0, null, null), content: "p0" },
            ])
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
            const orders = tx.em.insert.mock.calls.map(([, rows]) =>
                Array.isArray(rows) ? rows.map((row) => row.ord) : [],
            )
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
            queueQueryBuilders(em, [{ getMany: [chunkOf({ embeddingModel: "m1" })] }])
            const service = await build(em)

            await expect(service.embeddedOf(WS, "s1")).resolves.toEqual([{ order: 0, text: "a", model: "m1" }])
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

            await service.setVectors({ workspaceId: WS, model: "m1", ids: ["c1"], vectors: ["[1]"] })

            expect(write?.callsOf("update")).toEqual([[]])
            const changes: unknown = write?.callsOf("set")[0]?.[0]
            const embedding: unknown =
                typeof changes === "object" && changes !== null ? Reflect.get(changes, "embedding") : undefined
            expect(typeof embedding === "function" ? embedding() : "").toContain("unnest(CAST(:ids AS uuid[])")
            expect(write?.callsOf("setParameters")).toEqual([[{ workspaceId: WS, ids: ["c1"], vectors: ["[1]"] }]])
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
            const scope = {
                where: (...args: Array<unknown>) => (conditions.push(args), scope),
                orWhere: (...args: Array<unknown>) => (conditions.push(args), scope),
            }
            for (const [brackets] of fake?.callsOf("andWhere") ?? [])
                if (brackets instanceof Brackets) brackets.whereFactory(scope as never)
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
