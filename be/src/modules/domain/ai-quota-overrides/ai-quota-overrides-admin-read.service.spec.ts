import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AiQuotaOverridesAdminReadService } from "./ai-quota-overrides-admin-read.service"
import { AiQuotaOverrideEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AiQuotaOverridesAdminReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AiQuotaOverridesAdminReadService)
}

describe("AiQuotaOverridesAdminReadService", () => {
    it("reads the own credit allowance of a workspace", async () => {
        const row = Object.assign(new AiQuotaOverrideEntity(), { creditsLimit: "2000" })
        const em = mockEntityManager({ findOne: [AiQuotaOverrideEntity, row] })

        await expect((await build(em)).creditsOf("ws-1")).resolves.toEqual({ creditsLimit: "2000" })
        expect(em.findOne).toHaveBeenCalledWith(AiQuotaOverrideEntity, {
            select: { creditsLimit: true },
            where: { workspaceId: "ws-1" },
        })
    })

    it("answers undefined for a workspace without an override", async () => {
        const em = mockEntityManager({ findOne: [AiQuotaOverrideEntity, null] })

        await expect((await build(em)).creditsOf("ws-1")).resolves.toBeUndefined()
    })
})
