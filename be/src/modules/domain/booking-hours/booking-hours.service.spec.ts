import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingHoursService } from "./booking-hours.service"
import { DELETE_SETUP_HOURS, INSERT_SETUP_DEFAULT_HOURS, INSERT_SETUP_HOURS } from "./persistence/booking-hours.sql"

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
            const caller = mockEntityManager({ query: [INSERT_SETUP_DEFAULT_HOURS, []] })
            const hours = await build(own)

            await expect(hours.defaults("ws-1", "r-1", caller)).resolves.toBeUndefined()

            expect(caller.query.mock.calls).toEqual([[INSERT_SETUP_DEFAULT_HOURS, ["ws-1", "r-1"]]])
            expect(own.query).not.toHaveBeenCalled()
        })
    })

    describe("replace", () => {
        it("replaces the week with the given windows as parallel columns", async () => {
            const em = mockEntityManager({
                query: [
                    [DELETE_SETUP_HOURS, []],
                    [INSERT_SETUP_HOURS, []],
                ],
            })
            const hours = await build(em)

            await hours.replace("ws-1", "r-1", [
                { weekday: 1, start: "09:00", end: "12:00" },
                { weekday: 2, start: "13:00", end: "18:00" },
            ])

            expect(em.query.mock.calls).toEqual([
                [DELETE_SETUP_HOURS, ["ws-1", "r-1"]],
                [INSERT_SETUP_HOURS, ["ws-1", "r-1", [1, 2], ["09:00", "13:00"], ["12:00", "18:00"]]],
            ])
        })

        it("only clears the week when no window is given", async () => {
            const em = mockEntityManager({ query: [DELETE_SETUP_HOURS, []] })
            const hours = await build(em)

            await hours.replace("ws-1", "r-1", [])

            expect(em.query.mock.calls).toEqual([[DELETE_SETUP_HOURS, ["ws-1", "r-1"]]])
        })
    })
})
