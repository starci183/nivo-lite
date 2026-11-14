import { monthStartMs, shopDayOf } from "./shop-time"

describe("shop time", () => {
    it("dates an instant by the shop calendar day, seven hours ahead of UTC", () => {
        expect(shopDayOf("2026-11-04T01:06:00.000Z")).toBe("2026-11-04")
        expect(shopDayOf("2026-11-04T18:30:00.000Z")).toBe("2026-11-05")
    })

    it("starts a month on the first day at midnight shop time, whatever the month it is asked for", () => {
        const now = new Date("2026-11-04T11:30:00.000Z")
        expect(new Date(monthStartMs(now, 0)).toISOString()).toBe("2026-10-31T17:00:00.000Z")
        expect(new Date(monthStartMs(now, 1)).toISOString()).toBe("2026-09-30T17:00:00.000Z")
        expect(new Date(monthStartMs(now, -1)).toISOString()).toBe("2026-11-30T17:00:00.000Z")
    })

    it("reads the month on the shop wall near the turn of the month", () => {
        const now = new Date("2026-10-31T18:00:00.000Z")
        expect(new Date(monthStartMs(now, 0)).toISOString()).toBe("2026-10-31T17:00:00.000Z")
    })
})
