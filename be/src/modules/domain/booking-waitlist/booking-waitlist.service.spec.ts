import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingWaitlistService } from "./booking-waitlist.service"
import { CANCEL_SETUP_WAITLIST } from "./persistence/booking-waitlist.sql"

describe("BookingWaitlistService", () => {
    const build = async () => {
        const em = mockEntityManager()
        const moduleRef = await Test.createTestingModule({
            providers: [BookingWaitlistService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()
        return { service: moduleRef.get(BookingWaitlistService), em }
    }

    it("cancels one workspace-owned waitlist entry", async () => {
        const { service, em } = await build()
        const rows = [{ id: "wait-1" }]
        em.query.mockResolvedValue(rows)

        await expect(service.cancel("ws-1", "wait-1")).resolves.toEqual(rows)
        expect(em.query).toHaveBeenCalledWith(CANCEL_SETUP_WAITLIST, ["ws-1", "wait-1"])
    })
})
