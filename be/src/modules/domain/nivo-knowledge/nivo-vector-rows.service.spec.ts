import { Test } from "@nestjs/testing"
import { mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import { passageTextHashOf } from "@modules/domain/knowledge-chunks"
import { PLATFORM_TENANT } from "@modules/integrations/qdrant"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { careKnowledgeRow, knowledgeRow, longKnowledgeRow } from "@tests/fixtures/builders/nivo-knowledge.builder"
import { NivoVectorRowsService, nivoEmbedTextOf } from "./nivo-vector-rows.service"
import { NivoKnowledgeItemEntity } from "./persistence/entities"

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [NivoVectorRowsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(NivoVectorRowsService)
}

describe("NivoVectorRowsService: the base knowledge declares itself an embedded row kind (tenant PLATFORM_TENANT)", () => {
    it("reads an item as a row of the platform tenant: wanted, in force, readable by everyone, core for every module", async () => {
        const core = knowledgeRow({ id: "n1" })
        const care = careKnowledgeRow()
        const service = await build(mockEntityManager({ find: [NivoKnowledgeItemEntity, [core, care]] }))

        const rows = await service.byIds(PLATFORM_TENANT, ["n1", "n2"])

        expect(rows.map((row) => [row.id, row.workspaceId, row.wanted, row.mirror.module, row.stamped])).toEqual([
            ["n1", PLATFORM_TENANT, true, null, false],
            ["n2", PLATFORM_TENANT, true, "chatbot", false],
        ])
        expect(rows[0]?.mirror).toMatchObject({ workspaceId: PLATFORM_TENANT, isPublic: true, customerReady: true, inForce: true })
        expect(rows[0]?.textHash).toBe(passageTextHashOf("Voice\n\nWarm."))
    })

    it("answers nothing for a workspace: no tenant but the platform owns an item", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.byIds("11111111-1111-4111-8111-111111111111", ["n1"])).resolves.toEqual([])
        await service.stamp("11111111-1111-4111-8111-111111111111", [{ id: "n1", textHash: "h" }], "m1")
        expect(em.find).not.toHaveBeenCalled()
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("is stamped only for the text the index accepted: an edited item is stale again", async () => {
        const text = nivoEmbedTextOf({ title: "Voice", body: "Warm." })
        const accepted = knowledgeRow({ embeddingModel: "m1", textHash: passageTextHashOf(text), indexedAt: new Date(0) })
        const edited = knowledgeRow({ id: "n3", body: "Warmer.", embeddingModel: "m1", textHash: passageTextHashOf(text), indexedAt: new Date(0) })
        const service = await build(mockEntityManager({ find: [NivoKnowledgeItemEntity, [accepted, edited]] }))

        const rows = await service.byIds(PLATFORM_TENANT, ["n1", "n3"])

        expect(rows.map((row) => [row.id, row.stamped, row.stampedModel])).toEqual([
            ["n1", true, "m1"],
            ["n3", false, "m1"],
        ])
    })

    it("embeds the title and body, cut at 8,000 characters", () => {
        expect(nivoEmbedTextOf(longKnowledgeRow(9000))).toBe(`T\n\n${"x".repeat(7997)}`)
    })

    it("stamps what the index accepted in one write (identity, hash, indexed_at), never a vector", async () => {
        const em = mockEntityManager()
        const [update] = queueQueryBuilders(em, [{ execute: {} }])
        const service = await build(em)

        await service.stamp(PLATFORM_TENANT, [], "m1")
        expect(em.createQueryBuilder).not.toHaveBeenCalled()

        await service.stamp(PLATFORM_TENANT, [{ id: "n1", textHash: "h1" }], "m1")
        expect(Object.keys(update?.callsOf("set")[0]?.[0] ?? {})).toEqual(["embeddingModel", "textHash", "indexedAt"])
        expect(update?.callsOf("setParameters")).toEqual([[{ ids: ["n1"], hashes: ["h1"] }]])
    })

    it("walks every item for the reconcile and names which ids still exist, all of the platform tenant", async () => {
        const em = mockEntityManager({ find: [NivoKnowledgeItemEntity, [knowledgeRow({ id: "n1" })]] })
        const [page] = queueQueryBuilders(em, [{ getMany: [knowledgeRow({ id: "n2" })] }])
        const service = await build(em)

        await expect(service.page("n1", 9999)).resolves.toMatchObject([{ id: "n2", workspaceId: PLATFORM_TENANT }])
        expect(page?.callsOf("where")).toEqual([["k.id > :afterId", { afterId: "n1" }]])
        expect(page?.callsOf("limit")).toEqual([[500]])
        await expect(service.wantedAmong(["n1", "gone"])).resolves.toEqual([{ id: "n1", workspaceId: PLATFORM_TENANT }])
        await expect(service.donors()).resolves.toEqual(new Map())
        await expect(service.ofSource()).resolves.toEqual([])
    })
})
