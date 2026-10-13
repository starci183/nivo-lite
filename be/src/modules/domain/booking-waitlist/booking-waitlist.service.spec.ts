import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingWaitlistService } from "./booking-waitlist.service"
import { CANCEL_SETUP_WAITLIST } from "./persistence/booking-waitlist.sql"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingWaitlistService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingWaitlistService)
}

describe("BookingWaitlistService", () => {
    describe("cancel", () => {
        it("cancels an entry of the workspace and answers its id", async () => {
            const em = mockEntityManager({ query: [CANCEL_SETUP_WAITLIST, [{ id: "w-1" }]] })
            const waitlist = await build(em)

            await expect(waitlist.cancel("ws-1", "w-1")).resolves.toEqual([{ id: "w-1" }])
            expect(em.query).toHaveBeenCalledWith(CANCEL_SETUP_WAITLIST, ["ws-1", "w-1"])
        })

        it("answers nothing for an entry of another workspace, through the caller's manager", async () => {
            const own = mockEntityManager()
            const caller = mockEntityManager({ query: [CANCEL_SETUP_WAITLIST, []] })
            const waitlist = await build(own)

            await expect(waitlist.cancel("ws-1", "w-9", caller)).resolves.toEqual([])
            expect(own.query).not.toHaveBeenCalled()
        })
    })
})
