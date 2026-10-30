import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AiQuotaOverridesService } from "./ai-quota-overrides.service"
import { AiQuotaOverrideEntity } from "./persistence/entities"

describe("AiQuotaOverridesService", () => {
    it.each([
        [5000, "5000"],
        [null, null],
    ])("writes the own credits limit %s", async (limit, stored) => {
        const em = mockEntityManager({ upsert: [AiQuotaOverrideEntity, {}] })
        const moduleRef = await Test.createTestingModule({
            providers: [AiQuotaOverridesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()

        await expect(moduleRef.get(AiQuotaOverridesService).setCreditsLimit("ws-1", limit)).resolves.toBeUndefined()

        expect(em.upsert.mock.calls).toEqual([
            [AiQuotaOverrideEntity, { workspaceId: "ws-1", creditsLimit: stored }, ["workspaceId"]],
        ])
    })
})
