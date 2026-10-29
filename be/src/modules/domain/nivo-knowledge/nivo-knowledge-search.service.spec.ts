import { Test } from "@nestjs/testing"
import { mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { NivoKnowledgeSearchService } from "./nivo-knowledge-search.service"

const hit = { id: "n1", module: "core", kind: "tone", title: "Voice", content: "Warm.", score: 0.4 }

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [NivoKnowledgeSearchService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(NivoKnowledgeSearchService)
}

describe("NivoKnowledgeSearchService", () => {
    describe("search", () => {
        it("scores the module folder and core by vector and words and answers the best hits", async () => {
            const em = mockEntityManager()
            const [fake] = queueQueryBuilders(em, [{ getRawMany: [hit] }])
            const service = await build(em)

            await expect(
                service.search({ module: "sales", vector: "[1,2]", model: "m1", tsquery: "a | b", limit: 100 }),
            ).resolves.toEqual([hit])

            expect(fake?.callsOf("where")).toEqual([["k.module IN (:...modules)", { modules: ["sales", "core"] }]])
            expect(fake?.callsOf("setParameters")).toEqual([[{ vector: "[1,2]", model: "m1", tsquery: "a | b" }]])
            expect(fake?.callsOf("orderBy")).toEqual([["score", "DESC"]])
            expect(fake?.callsOf("limit")).toEqual([[40]])
        })

        it("keeps at least one hit and searches nothing when the query has neither a vector nor words", async () => {
            const em = mockEntityManager()
            const [fake] = queueQueryBuilders(em, [{ getRawMany: [] }])
            const service = await build(em)

            await service.search({ module: "sales", vector: null, model: null, tsquery: "a", limit: 0 })
            await expect(
                service.search({ module: "sales", vector: "[1]", model: null, tsquery: null, limit: 5 }),
            ).resolves.toEqual([])

            expect(fake?.callsOf("limit")).toEqual([[1]])
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        })
    })
})
