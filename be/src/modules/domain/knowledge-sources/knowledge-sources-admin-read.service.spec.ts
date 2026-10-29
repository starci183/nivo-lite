import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { KnowledgeSourcesAdminReadService } from "./knowledge-sources-admin-read.service"
import { KnowledgeSourceEntity } from "./persistence/entities"

describe("KnowledgeSourcesAdminReadService", () => {
    it("reads the kind and stage of the documents of a workspace, bounded", async () => {
        const source = Object.assign(new KnowledgeSourceEntity(), { kind: "faq", status: "ready" })
        const em = mockEntityManager({ find: [KnowledgeSourceEntity, [source]] })
        const moduleRef = await Test.createTestingModule({
            providers: [KnowledgeSourcesAdminReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()

        await expect(moduleRef.get(KnowledgeSourcesAdminReadService).stagesOf("ws-1", 5000)).resolves.toEqual([
            { kind: "faq", status: "ready" },
        ])
        expect(em.find).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            select: { kind: true, status: true },
            where: { workspaceId: "ws-1" },
            take: 5000,
        })
    })
})
