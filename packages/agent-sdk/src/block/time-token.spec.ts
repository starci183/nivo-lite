import { TIME_TOKENS, isTimeToken, timeWindowOf } from "./time-token"

/** Thursday 2026-11-05, 15:30 UTC. */
const NOW = new Date("2026-11-05T15:30:00.000Z")

describe("isTimeToken", () => {
    it("is true for each token and false for anything else", () => {
        expect(TIME_TOKENS.every((token) => isTimeToken(token))).toBe(true)
        expect(isTimeToken("$other")).toBe(false)
        expect(isTimeToken("today")).toBe(false)
        expect(isTimeToken(4)).toBe(false)
    })
})

describe("timeWindowOf", () => {
    it("names the UTC day of the instant", () => {
        expect(timeWindowOf("$today", NOW)).toEqual({
            from: "2026-11-05T00:00:00.000Z",
            to: "2026-11-06T00:00:00.000Z",
        })
    })

    it("names the week from Monday to the next Monday", () => {
        expect(timeWindowOf("$thisWeek", NOW)).toEqual({
            from: "2026-11-02T00:00:00.000Z",
            to: "2026-11-09T00:00:00.000Z",
        })
    })

    it("keeps a Sunday in the week that began on the Monday before it", () => {
        expect(timeWindowOf("$thisWeek", new Date("2026-11-08T23:59:59.000Z"))).toEqual({
            from: "2026-11-02T00:00:00.000Z",
            to: "2026-11-09T00:00:00.000Z",
        })
        expect(timeWindowOf("$thisWeek", new Date("2026-11-09T00:00:00.000Z")).from).toBe("2026-11-09T00:00:00.000Z")
    })

    it("names the calendar month, rolling over the year in December", () => {
        expect(timeWindowOf("$thisMonth", NOW)).toEqual({
            from: "2026-11-01T00:00:00.000Z",
            to: "2026-12-01T00:00:00.000Z",
        })
        expect(timeWindowOf("$thisMonth", new Date("2026-12-31T12:00:00.000Z")).to).toBe("2027-01-01T00:00:00.000Z")
    })
})
