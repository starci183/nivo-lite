import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { RESOURCE_R1_HOURS_WHERE } from "@tests/fixtures/builders/booking-hours.builder"
import { BookingHoursService } from "./booking-hours.service"
import { BookingHourEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingHoursService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingHoursService)
}

describe("BookingHoursService", () => {
    describe("defaults", () => {
        it("opens a new resource with the default week in the caller's transaction", async () => {
            const own = mockEntityManager()
            const caller = mockEntityManager({ insert: [BookingHourEntity, {}] })
            const hours = await build(own)

            await expect(hours.defaults("ws-1", "r-1", caller)).resolves.toBeUndefined()

            expect(caller.insert.mock.calls).toEqual([
                [
                    BookingHourEntity,
                    [1, 2, 3, 4, 5, 6].map((weekday) => ({
                        workspaceId: "ws-1",
                        resourceId: "r-1",
                        weekday,
                        startTime: "09:00",
                        endTime: "18:00",
                    })),
                ],
            ])
            expect(own.insert).not.toHaveBeenCalled()
        })
    })

    describe("replace", () => {
        it("replaces the week with the given windows as parallel columns", async () => {
            const em = mockEntityManager({
                delete: [BookingHourEntity, {}],
                insert: [BookingHourEntity, {}],
            })
            const hours = await build(em)

            await hours.replace("ws-1", "r-1", [
                { weekday: 1, start: "09:00", end: "12:00" },
                { weekday: 2, start: "13:00", end: "18:00" },
            ])

            expect(em.delete.mock.calls).toEqual([[BookingHourEntity, RESOURCE_R1_HOURS_WHERE]])
            expect(em.insert.mock.calls).toEqual([
                [
                    BookingHourEntity,
                    [
                        { workspaceId: "ws-1", resourceId: "r-1", weekday: 1, startTime: "09:00", endTime: "12:00" },
                        { workspaceId: "ws-1", resourceId: "r-1", weekday: 2, startTime: "13:00", endTime: "18:00" },
                    ],
                ],
            ])
        })

        it("only clears the week when no window is given", async () => {
            const em = mockEntityManager({ delete: [BookingHourEntity, {}] })
            const hours = await build(em)

            await hours.replace("ws-1", "r-1", [])

            expect(em.delete.mock.calls).toEqual([[BookingHourEntity, RESOURCE_R1_HOURS_WHERE]])
            expect(em.insert).not.toHaveBeenCalled()
        })
    })
})
