import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { SourceCategoriesService } from "./source-categories.service"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async (em: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SourceCategoriesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(SourceCategoriesService), members }
}

describe("SourceCategoriesService categories", () => {
    it("groups the documents of the workspace by topic and turns the sums into numbers", async () => {
        const em = mockEntityManager()
        const fakes = queueQueryBuilders(em, [
            {
                getRawMany: [
                    { topic: "LEGAL FILES", documents: "22", bytes: "41234567", folder: 1 },
                    { topic: "Notes", documents: "2", bytes: "10", folder: null },
                    { topic: "bad row", documents: "1" },
                    null,
                ],
            },
        ])
        const { service, members } = await build(em)

        await expect(service.categories("u1", WS)).resolves.toEqual([
            { topic: "LEGAL FILES", order: 1, documentCount: 22, sizeBytes: 41234567 },
            { topic: "Notes", order: null, documentCount: 2, sizeBytes: 10 },
        ])
        expect(members.require).toHaveBeenCalledWith("u1", WS)
        expect(em.createQueryBuilder).toHaveBeenCalledWith(KnowledgeSourceEntity, "s")
        expect(fakes[0]?.callsOf("where")).toEqual([
            ["s.workspaceId = :workspaceId AND s.topic IS NOT NULL", { workspaceId: WS }],
        ])
        expect(fakes[0]?.callsOf("groupBy")).toEqual([["s.topic"]])
    })
})

describe("SourceCategoriesService dossierCounts", () => {
    it("counts the documents that name a dossier reference by tag or by the number their title starts with", async () => {
        const em = mockEntityManager()
        const fakes = queueQueryBuilders(em, [
            {
                getRawMany: [
                    { topic: "LEGAL FILES", ref: "1", documents: "6" },
                    { topic: "LEGAL FILES", ref: 2, documents: "1" },
                    { topic: "x", ref: "3" },
                    "nope",
                ],
            },
        ])
        const { service, members } = await build(em)

        await expect(service.dossierCounts("u1", WS)).resolves.toEqual([
            { topic: "LEGAL FILES", ref: "1", documentCount: 6 },
        ])
        expect(members.require).toHaveBeenCalledWith("u1", WS)
        const [where] = fakes[0]?.callsOf("where") ?? []
        expect(where?.[0]).toContain("'^dossier:0*([0-9]+)$'")
        expect(where?.[0]).toContain("IS NOT NULL")
        expect(where?.[1]).toEqual({ workspaceId: WS })
        expect(fakes[0]?.callsOf("addGroupBy")).toEqual([["ref"]])
    })
})
