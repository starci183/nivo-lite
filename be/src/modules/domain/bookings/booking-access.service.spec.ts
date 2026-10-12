import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingAccessService } from "./booking-access.service"
import { BookingsErrorCode } from "./errors/bookings.error"
import { SELECT_MEMBER_ROLE } from "./persistence/booking-model.sql"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingAccessService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingAccessService)
}

describe("BookingAccessService", () => {
    describe("requireMember", () => {
        it("lets any active member of the workspace in", async () => {
            const entityManager = mockEntityManager({ query: [SELECT_MEMBER_ROLE, [{ role: "staff" }]] })
            const access = await build(entityManager)

            await expect(access.requireMember("ws-1", "user-1")).resolves.toBeUndefined()

            expect(entityManager.query).toHaveBeenCalledWith(SELECT_MEMBER_ROLE, ["ws-1", "user-1"])
        })

        it("refuses a caller who is no active member", async () => {
            const access = await build(mockEntityManager({ query: [SELECT_MEMBER_ROLE, []] }))

            await expect(access.requireMember("ws-1", "user-1")).rejects.toMatchObject({
                code: BookingsErrorCode.Forbidden,
            })
        })
    })

    describe("requireManager", () => {
        it("lets an owner and a manager in", async () => {
            const owner = await build(mockEntityManager({ query: [SELECT_MEMBER_ROLE, [{ role: "owner" }]] }))
            const manager = await build(mockEntityManager({ query: [SELECT_MEMBER_ROLE, [{ role: "manager" }]] }))

            await expect(owner.requireManager("ws-1", "user-1")).resolves.toBeUndefined()
            await expect(manager.requireManager("ws-1", "user-1")).resolves.toBeUndefined()
        })

        it("refuses staff and strangers", async () => {
            const staff = await build(mockEntityManager({ query: [SELECT_MEMBER_ROLE, [{ role: "staff" }]] }))
            const stranger = await build(mockEntityManager({ query: [SELECT_MEMBER_ROLE, []] }))

            await expect(staff.requireManager("ws-1", "user-1")).rejects.toMatchObject({
                code: BookingsErrorCode.Forbidden,
            })
            await expect(stranger.requireManager("ws-1", "user-1")).rejects.toMatchObject({
                code: BookingsErrorCode.Forbidden,
            })
        })
    })
})
