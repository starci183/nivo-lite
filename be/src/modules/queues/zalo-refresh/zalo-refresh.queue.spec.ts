import { ZALO_REFRESH_QUEUE, ZALO_REFRESH_SCHEDULER, isZaloRefreshPayload } from "./zalo-refresh.queue"

describe("zalo refresh queue", () => {
    it("renews every six hours a token that ends within seven hours", () => {
        expect(ZALO_REFRESH_QUEUE).toBe("zalo_refresh")
        expect(ZALO_REFRESH_SCHEDULER).toEqual({
            queue: "zalo_refresh",
            id: "zalo-refresh-tick",
            everyMs: 21_600_000,
            payload: { withinMs: 25_200_000 },
        })
    })

    it("accepts a numeric window and refuses the rest", () => {
        expect(isZaloRefreshPayload({ withinMs: 25_200_000 })).toBe(true)
        expect(isZaloRefreshPayload(null)).toBe(false)
        expect(isZaloRefreshPayload({})).toBe(false)
        expect(isZaloRefreshPayload({ withinMs: "1" })).toBe(false)
    })
})
