import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingHoursService } from "./booking-hours.service"
import { DELETE_SETUP_HOURS, INSERT_SETUP_DEFAULT_HOURS, INSERT_SETUP_HOURS } from "./persistence/booking-hours.sql"

const build = async () => {
    const em = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [BookingHoursService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { hours: moduleRef.get(BookingHoursService), em }
}

describe("BookingHoursService", () => {
    it("opens a new resource Monday through Saturday", async () => {
        const { hours, em } = await build()

        await expect(hours.defaults("ws-1", "resource-1")).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledWith(INSERT_SETUP_DEFAULT_HOURS, ["ws-1", "resource-1"])
    })

    it("replaces the weekly windows of a resource", async () => {
        const { hours, em } = await build()
        const rows = [{ weekday: 1, start: "09:00", end: "12:00" }]

        await expect(hours.replace("ws-1", "resource-1", rows)).resolves.toBeUndefined()

        expect(em.query).toHaveBeenNthCalledWith(1, DELETE_SETUP_HOURS, ["ws-1", "resource-1"])
        expect(em.query).toHaveBeenNthCalledWith(2, INSERT_SETUP_HOURS, [
            "ws-1",
            "resource-1",
            [1],
            ["09:00"],
            ["12:00"],
        ])
    })

    it("clears the windows when the replacement is empty", async () => {
        const { hours, em } = await build()

        await expect(hours.replace("ws-1", "resource-1", [])).resolves.toBeUndefined()

        expect(em.query.mock.calls).toEqual([[DELETE_SETUP_HOURS, ["ws-1", "resource-1"]]])
    })
})
