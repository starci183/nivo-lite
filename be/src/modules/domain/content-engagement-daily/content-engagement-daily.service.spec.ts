import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentEngagementDailyService } from "./content-engagement-daily.service"
import { LIST_ENGAGEMENT_DAYS, UPSERT_ENGAGEMENT_DAYS } from "./persistence/content-engagement-daily.sql"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ContentEngagementDailyService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(ContentEngagementDailyService)
}

describe("ContentEngagementDailyService", () => {
    it("upserts the reported days in one statement", async () => {
        const em = mockEntityManager({ query: [UPSERT_ENGAGEMENT_DAYS, []] })
        const service = await build(em)
        const days = [{ day: "2026-10-12", reach: 100, engagements: 10 }]

        await expect(service.upsert("ws-1", "facebook", days)).resolves.toBe(1)
        expect(em.query).toHaveBeenCalledWith(UPSERT_ENGAGEMENT_DAYS, ["ws-1", "facebook", JSON.stringify(days)])
    })

    it("writes nothing for no days", async () => {
        const service = await build(mockEntityManager())

        await expect(service.upsert("ws-1", "facebook", [])).resolves.toBe(0)
    })

    it("lists the rows between two days", async () => {
        const rows = [{ channel: "facebook", day: "2026-10-12", reach: 1, engagements: 2, messages: 0 }]
        const em = mockEntityManager({ query: [LIST_ENGAGEMENT_DAYS, rows] })
        const service = await build(em)

        await expect(service.between("ws-1", "2026-10-05", "2026-10-19")).resolves.toEqual(rows)
    })
})
