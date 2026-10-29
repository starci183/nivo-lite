import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingHoursReadService } from "./booking-hours-read.service"
import { BookingHourEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingHoursReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingHoursReadService)
}

describe("BookingHoursReadService", () => {
    it("lists the weekly windows of a workspace, at most 2000", async () => {
        const rows = [{ resourceId: "r-1", weekday: 1, startTime: "09:00", endTime: "18:00" }]
        const em = mockEntityManager({ find: [BookingHourEntity, rows] })
        const hours = await build(em)

        await expect(hours.week("ws-1")).resolves.toEqual(rows)

        expect(em.find.mock.calls).toEqual([[BookingHourEntity, { where: { workspaceId: "ws-1" }, take: 2000 }]])
    })
})
