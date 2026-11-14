import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { knowledgeChunkOf } from "@tests/fixtures/builders/knowledge-chunks.builder"
import { passageTextHashOf } from "./passage-hash.policy"
import { PassageVectorRowsService } from "./passage-vector-rows.service"
import { KnowledgeChunkEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [PassageVectorRowsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(PassageVectorRowsService)
}

describe("PassageVectorRowsService", () => {
    it("reads the passages of one workspace by id as rows that want a point, mirroring what the index filters by", async () => {
        const row = knowledgeChunkOf({ id: "c1", visibility: "public", customerReady: false, content: "Open 8 to 21" })
        const em = mockEntityManager({ find: [KnowledgeChunkEntity, [row]] })
        const service = await build(em)

        const rows = await service.byIds(WS, ["c1", "c1"])

        expect(em.find).toHaveBeenCalledWith(KnowledgeChunkEntity, { where: { workspaceId: WS, id: In(["c1"]) }, take: 1 })
        expect(rows).toEqual([
            {
                id: "c1",
                workspaceId: WS,
                wanted: true,
                text: "Open 8 to 21",
                textHash: passageTextHashOf("Open 8 to 21"),
                mirror: {
                    workspaceId: WS,
                    sourceId: "s1",
                    module: "chatbot",
                    installationId: null,
                    isPublic: true,
                    customerReady: false,
                    inForce: true,
                },
                stamped: false,
                stampedModel: null,
            },
        ])
    })

    it("reads nothing for no ids", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.byIds(WS, [])).resolves.toEqual([])
        await expect(service.wantedAmong([])).resolves.toEqual([])

        expect(em.find).not.toHaveBeenCalled()
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("reads a document's passages in reading order, bounded", async () => {
        const em = mockEntityManager({ find: [KnowledgeChunkEntity, [knowledgeChunkOf({ indexedAt: new Date(0), embeddingModel: "m1" })]] })
        const service = await build(em)

        const rows = await service.ofSource(WS, "s1")

        expect(em.find).toHaveBeenCalledWith(KnowledgeChunkEntity, {
            where: { workspaceId: WS, sourceId: "s1" },
            order: { ord: "ASC" },
            take: 2000,
        })
        expect(rows.map((row) => [row.id, row.stamped, row.stampedModel])).toEqual([["c1", true, "m1"]])
    })

    it("reads a page of every passage after a cursor, bounded between 1 and 500", async () => {
        const em = mockEntityManager()
        const [first, second] = queueQueryBuilders(em, [{ getMany: [knowledgeChunkOf()] }, { getMany: [] }])
        const service = await build(em)

        await expect(service.page("c0", 9999)).resolves.toHaveLength(1)
        await service.page(null, 0)

        expect(first?.callsOf("where")).toEqual([["c.id > :afterId", { afterId: "c0" }]])
        expect(first?.callsOf("limit")).toEqual([[500]])
        expect(second?.callsOf("where")).toEqual([])
        expect(second?.callsOf("limit")).toEqual([[1]])
    })

})

describe("PassageVectorRowsService (the existing passages and the stamp)", () => {
    it("names which of the ids exist, whatever workspace", async () => {
        const em = mockEntityManager({ find: [KnowledgeChunkEntity, [knowledgeChunkOf({ id: "c1" })]] })
        const service = await build(em)

        await expect(service.wantedAmong(["c1", "c2"])).resolves.toEqual([{ id: "c1", workspaceId: WS }])
    })

    it("adopts nothing across a re-upload", async () => {
        const service = await build(mockEntityManager())

        await expect(service.donors()).resolves.toEqual(new Map())
    })

    it("stamps the accepted passages in one write, and writes nothing for none", async () => {
        const em = mockEntityManager()
        const [update] = queueQueryBuilders(em, [{ execute: {} }])
        const service = await build(em)

        await service.stamp(WS, [], "m1")
        expect(em.createQueryBuilder).not.toHaveBeenCalled()

        await service.stamp(WS, [{ id: "c1", textHash: "h1" }, { id: "c2", textHash: "h2" }], "m1")

        expect(update?.callsOf("setParameters")).toEqual([[{ workspaceId: WS, model: "m1", ids: ["c1", "c2"] }]])
        // Postgres records what the index accepted (the identity and when); it never writes or clears a vector.
        expect(Object.keys(update?.callsOf("set")[0]?.[0] ?? {})).toEqual(["embeddingModel", "indexedAt"])
        expect(update?.callsOf("execute")).toHaveLength(1)
    })
})
