import { firstResponseMinutes, medianOf, responseMedianOf, shopDayStartOf } from "./metrics"

describe("medianOf", () => {
    it("is null for no values", () => {
        expect(medianOf([])).toBeNull()
    })

    it("takes the middle of an odd count and the mean of the two middle ones of an even count", () => {
        expect(medianOf([5, 1, 3])).toBe(3)
        expect(medianOf([4, 1, 2, 3])).toBe(2.5)
    })

    it("does not reorder the list it was given", () => {
        const values = [3, 1, 2]
        medianOf(values)
        expect(values).toEqual([3, 1, 2])
    })
})

describe("firstResponseMinutes", () => {
    it("is the time from the first customer line to the first agent line after it", () => {
        expect(
            firstResponseMinutes([
                { role: "agent", at: "2026-11-05T00:59:00.000Z" },
                { role: "user", at: "2026-11-05T01:00:00.000Z" },
                { role: "system", at: "2026-11-05T01:00:30.000Z" },
                { role: "agent", at: "2026-11-05T01:03:00.000Z" },
            ]),
        ).toBe(3)
    })

    it("is null without a customer line or without an agent line after it", () => {
        expect(firstResponseMinutes([{ role: "agent", at: "2026-11-05T01:00:00.000Z" }])).toBeNull()
        expect(firstResponseMinutes([{ role: "user", at: "2026-11-05T01:00:00.000Z" }])).toBeNull()
    })
})

describe("responseMedianOf", () => {
    it("rounds the median to two decimals and is null for none", () => {
        expect(responseMedianOf([1, 2.333])).toBe(1.67)
        expect(responseMedianOf([])).toBeNull()
    })
})

describe("shopDayStartOf", () => {
    const VN = "Asia/Ho_Chi_Minh"

    it("is 17:00 UTC of the day before for an instant after midnight in Vietnam", () => {
        expect(new Date(shopDayStartOf(Date.parse("2026-11-05T02:00:00.000Z"), VN)).toISOString()).toBe(
            "2026-11-04T17:00:00.000Z",
        )
    })

    it("stays on the same Vietnam day until 17:00 UTC", () => {
        expect(new Date(shopDayStartOf(Date.parse("2026-11-04T16:59:00.000Z"), VN)).toISOString()).toBe(
            "2026-11-03T17:00:00.000Z",
        )
    })

    it("a workspace in another zone starts its day at its own midnight, summer time included", () => {
        expect(new Date(shopDayStartOf(Date.parse("2026-11-05T02:00:00.000Z"), "Europe/Berlin")).toISOString()).toBe(
            "2026-11-04T23:00:00.000Z",
        )
        expect(new Date(shopDayStartOf(Date.parse("2026-07-05T02:00:00.000Z"), "Europe/Berlin")).toISOString()).toBe(
            "2026-07-04T22:00:00.000Z",
        )
        expect(new Date(shopDayStartOf(Date.parse("2026-11-05T02:00:00.000Z"), "America/New_York")).toISOString()).toBe(
            "2026-11-04T05:00:00.000Z",
        )
    })
})
