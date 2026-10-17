import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { KnowledgeChunksService } from "./knowledge-chunks.service"
import type { ChunkDraft } from "./knowledge-chunks.contracts"
import {
    DELETE_CHUNKS,
    INSERT_CHUNKS,
    LIST_PASSAGES,
    SELECT_EMBEDDED_CHUNKS,
    SELECT_STALE_CHUNKS,
    UPDATE_CHUNK_VECTORS,
} from "./persistence/knowledge-chunks.sql"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [KnowledgeChunksService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(KnowledgeChunksService)
}

const drafts = (count: number, vector: string | null): Array<ChunkDraft> =>
    Array.from({ length: count }, (_, index) => ({ text: `p${index}`, vector }))

const write = (list: ReadonlyArray<ChunkDraft>) => ({
    workspaceId: WS,
    sourceId: "s1",
    module: "chatbot",
    visibility: "internal",
    model: "m1",
    drafts: list,
})

describe("KnowledgeChunksService", () => {
    describe("replace", () => {
        it("removes the old passages and stores the new ones with their vectors in one transaction", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [DELETE_CHUNKS, []],
                        [INSERT_CHUNKS, []],
                    ],
                }),
            )
            const service = await build(tx.em)

            await service.replace(write(drafts(2, "[1]")))

            expect(tx.em.query).toHaveBeenCalledWith(DELETE_CHUNKS, ["s1", WS])
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_CHUNKS, [
                WS,
                "s1",
                "chatbot",
                "internal",
                [0, 1],
                ["p0", "p1"],
                ["[1]", "[1]"],
                ["m1", "m1"],
            ])
            expect(tx.commits).toBe(1)
        })

        it("stores passages without a vector and without a model", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [DELETE_CHUNKS, []],
                        [INSERT_CHUNKS, []],
                    ],
                }),
            )
            const service = await build(tx.em)

            await service.replace(write(drafts(1, null)))

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_CHUNKS, [
                WS,
                "s1",
                "chatbot",
                "internal",
                [0],
                ["p0"],
                [null],
                [null],
            ])
        })
    })
})

describe("KnowledgeChunksService", () => {
    describe("replace", () => {
        it("inserts a long document in batches that keep the order", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [DELETE_CHUNKS, []],
                        [INSERT_CHUNKS, []],
                    ],
                }),
            )
            const service = await build(tx.em)

            await service.replace(write(drafts(120, "[1]")))

            const inserts = tx.em.query.mock.calls.filter(([statement]) => statement === INSERT_CHUNKS)
            expect(inserts).toHaveLength(3)
            expect(tx.em.query).toHaveBeenCalledWith(
                INSERT_CHUNKS,
                expect.arrayContaining([Array.from({ length: 20 }, (_, index) => 100 + index)]),
            )
            expect(tx.em.query).toHaveBeenCalledWith(
                INSERT_CHUNKS,
                expect.arrayContaining([Array.from({ length: 50 }, (_, index) => 50 + index)]),
            )
        })

        it("only clears the old passages of a source with no passage", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [DELETE_CHUNKS, []] }))
            const service = await build(tx.em)

            await service.replace(write([]))

            expect(tx.em.query).not.toHaveBeenCalledWith(INSERT_CHUNKS, expect.anything())
        })
    })

    describe("passagesOf", () => {
        it("returns the ordered passage content and embedding flags for the requested source", async () => {
            const em = mockEntityManager({
                query: [
                    LIST_PASSAGES,
                    [
                        { id: "c1", ord: 0, content: "Tea", has_embedding: true },
                        { id: "c2", ord: 1, content: "Coffee", has_embedding: false },
                    ],
                ],
            })
            const service = await build(em)

            await expect(service.passagesOf(WS, "s1")).resolves.toEqual([
                { id: "c1", order: 0, content: "Tea", hasEmbedding: true },
                { id: "c2", order: 1, content: "Coffee", hasEmbedding: false },
            ])

            expect(em.query).toHaveBeenCalledWith(LIST_PASSAGES, [WS, "s1"])
        })
    })

    describe("embeddedOf", () => {
        it("names the columns of the stored passages", async () => {
            const service = await build(
                mockEntityManager({
                    query: [SELECT_EMBEDDED_CHUNKS, [{ ord: 0, content: "a", embedding_model: "m1" }]],
                }),
            )

            await expect(service.embeddedOf(WS, "s1")).resolves.toEqual([{ order: 0, text: "a", model: "m1" }])
        })
    })
})

describe("KnowledgeChunksService", () => {
    describe("stale", () => {
        it("names the passages that need a vector of the model", async () => {
            const em = mockEntityManager({ query: [SELECT_STALE_CHUNKS, [{ id: "c1", content: "a" }]] })
            const service = await build(em)

            await expect(service.stale(WS, "m1", 32)).resolves.toEqual([{ id: "c1", text: "a" }])

            expect(em.query).toHaveBeenCalledWith(SELECT_STALE_CHUNKS, [WS, "m1", 32])
        })
    })

    describe("setVectors", () => {
        it("gives the passages their vectors", async () => {
            const em = mockEntityManager({ query: [UPDATE_CHUNK_VECTORS, []] })
            const service = await build(em)

            await service.setVectors({ workspaceId: WS, model: "m1", ids: ["c1"], vectors: ["[1]"] })

            expect(em.query).toHaveBeenCalledWith(UPDATE_CHUNK_VECTORS, [WS, ["c1"], ["[1]"], "m1"])
        })
    })
})
