import { splitOf } from "./revenue.policy"

describe("splitOf", () => {
    it("gives the creator the percent rounded down and the platform the rest, so not a dong is lost", () => {
        expect(splitOf(1_000_000, 70)).toEqual({ creator: 700_000, platform: 300_000 })
        expect(splitOf(999, 70)).toEqual({ creator: 699, platform: 300 })
        expect(splitOf(1, 70)).toEqual({ creator: 0, platform: 1 })
    })

    it("handles a whole sale to either side", () => {
        expect(splitOf(500_000, 100)).toEqual({ creator: 500_000, platform: 0 })
        expect(splitOf(500_000, 0)).toEqual({ creator: 0, platform: 500_000 })
    })
})
