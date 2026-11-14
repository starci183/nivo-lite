import { Test } from "@nestjs/testing"
import { mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import { PLATFORM_TENANT, VECTOR_INDEX, type VectorPayload } from "@modules/integrations/qdrant"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { FakeVectorIndex } from "@tests/fixtures/builders/vector-sync.builder"
import { NivoKnowledgeLogEvent } from "./nivo-knowledge.log-events"
import { NivoKnowledgeSearchService } from "./nivo-knowledge-search.service"

const line = (id: string, module: string, rank: number | string) => ({ id, module, kind: "tone", title: `T ${id}`, content: "Warm.", rank })

/** The mirror of a base-knowledge item's point: the platform tenant, public, in force; core = every module (null). */
const mirror = (module: string | null, over: Partial<VectorPayload> = {}): VectorPayload => ({
    workspaceId: PLATFORM_TENANT,
    sourceId: null,
    module,
    installationId: null,
    isPublic: true,
    customerReady: true,
    inForce: true,
    model: "m1",
    textHash: "h",
    ...over,
})

const build = async (em: ReturnType<typeof mockEntityManager>, index = new FakeVectorIndex()) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            NivoKnowledgeSearchService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: VECTOR_INDEX, useValue: index },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(NivoKnowledgeSearchService), index, logger }
}

describe("NivoKnowledgeSearchService: the base knowledge by meaning (the index) and by words (fts)", () => {
    it("asks the index inside the platform tenant and the reader's module (core included), reads those rows and the word hits, scores both halves", async () => {
        const index = new FakeVectorIndex()
        index.put("base", "near", [1, 0], mirror("sales"))
        index.put("base", "core", [0.9, 0.1], mirror(null))
        index.put("base", "other-module", [1, 0], mirror("hiring"))
        index.put("base", "a-workspace", [1, 0], mirror("sales", { workspaceId: "ws-1" }))
        index.put("base", "old-model", [1, 0], mirror("sales", { model: "m0" }))
        const em = mockEntityManager()
        const [read] = queueQueryBuilders(em, [{ getRawMany: [line("near", "sales", 0), line("core", "core", "0.5"), line("words", "sales", 1)] }])
        const { service } = await build(em, index)

        const hits = await service.search({ module: "sales", vector: [1, 0], model: "m1", tsquery: "a | b", limit: 100 })

        // 0.7 x similarity + 0.3 x the word rank (capped at 1).
        expect(hits.map((hit) => [hit.id, Number(hit.score.toFixed(3))])).toEqual([
            ["core", Number((0.7 * (0.9 / Math.hypot(0.9, 0.1)) + 0.15).toFixed(3))],
            ["near", 0.7],
            ["words", 0.3],
        ])
        expect(read?.callsOf("where")).toEqual([["k.module IN (:...modules)", { modules: ["sales", "core"] }]])
        // Only the points inside the mandatory filters are read back: never a workspace's, another module's or another model's.
        expect(read?.callsOf("setParameters")).toEqual([[{ tsquery: "a | b", near: ["near", "core"] }]])
    })

    it("keeps at least one hit, and searches nothing when the query has neither a vector nor words", async () => {
        const em = mockEntityManager()
        const [read] = queueQueryBuilders(em, [{ getRawMany: [line("w", "core", 1), line("x", "core", 0.5)] }])
        const { service } = await build(em)

        await expect(service.search({ module: "sales", vector: null, model: null, tsquery: "a", limit: 0 })).resolves.toHaveLength(1)
        await expect(service.search({ module: "sales", vector: [1], model: null, tsquery: null, limit: 5 })).resolves.toEqual([])

        expect(read?.callsOf("andWhere")).toHaveLength(1)
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })

    it("answers by words alone when the index does not answer, and logs it", async () => {
        const index = new FakeVectorIndex()
        index.down = true
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawMany: [line("words", "sales", 1)] }])
        const { service, logger } = await build(em, index)

        await expect(service.search({ module: "sales", vector: [1, 0], model: "m1", tsquery: "a", limit: 5 })).resolves.toMatchObject([
            { id: "words", score: 0.3 },
        ])
        expect(logger.error).toHaveBeenCalledWith(NivoKnowledgeLogEvent.IndexUnavailable, expect.any(Error), { module: "sales" })
    })
})
