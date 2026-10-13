import { RECENT_EVENTS, windowAt } from "./overview.policy"

const NOW = new Date("2026-10-13T03:00:00.000Z")

describe("overview policy", () => {
    it("reads the last 7 days and the founding offer at the given instant", () => {
        expect(RECENT_EVENTS).toBe(6)
        expect(windowAt(NOW)).toEqual({
            since7: "2026-10-06T03:00:00.000Z",
            foundingFrom: "2026-09-28T17:00:00.000Z",
            foundingTo: "2026-10-31T16:59:59.000Z",
        })
    })
})
