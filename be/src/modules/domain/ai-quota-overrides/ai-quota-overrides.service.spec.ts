import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AiQuotaOverridesService } from "./ai-quota-overrides.service"
import { UPSERT_CREDITS_LIMIT } from "./persistence/ai-quota-overrides.sql"

const NOW = new Date("2026-10-12T00:00:00.000Z")

describe("AiQuotaOverridesService", () => {
    it.each([[5000], [null]])("writes the own credits limit %s with the instant", async (limit) => {
        const em = mockEntityManager({ query: [UPSERT_CREDITS_LIMIT, []] })
        const moduleRef = await Test.createTestingModule({
            providers: [
                AiQuotaOverridesService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
                { provide: CLOCK, useValue: new FakeClock(NOW) },
            ],
        }).compile()

        await moduleRef.get(AiQuotaOverridesService).setCreditsLimit("ws-1", limit)

        expect(em.query).toHaveBeenCalledWith(UPSERT_CREDITS_LIMIT, ["ws-1", limit, NOW])
    })
})
