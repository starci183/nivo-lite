import { takeToken } from "./poll-bucket.policy"

const limits = { ratePerSecond: 2, burst: 3, concurrency: 1 }
const NOW = 1_000_000

describe("takeToken", () => {
    it("lets a bucket never seen burst, then spends its tokens one at a time", () => {
        const first = takeToken(undefined, NOW, limits)
        const second = takeToken(first.state, NOW, limits)
        const third = takeToken(second.state, NOW, limits)

        expect([first.allowed, second.allowed, third.allowed]).toEqual([true, true, true])
        expect(third.state.tokens).toBe(0)
    })

    it("denies the call after the burst and says how long until a token is back", () => {
        const empty = { tokens: 0, at: NOW }

        const denied = takeToken(empty, NOW, limits)

        expect(denied).toEqual({ allowed: false, waitMs: 500, state: { tokens: 0, at: NOW } })
    })

    it("refills at the rate of the provider", () => {
        const allowed = takeToken({ tokens: 0, at: NOW }, NOW + 500, limits)

        expect(allowed.allowed).toBe(true)
        expect(allowed.state.tokens).toBeCloseTo(0)
    })

    it("never holds more than the burst however long it was idle", () => {
        const taken = takeToken({ tokens: 0, at: NOW }, NOW + 3_600_000, limits)

        expect(taken.state.tokens).toBe(2)
    })

    it("waits only for the missing part of a token", () => {
        const denied = takeToken({ tokens: 0.5, at: NOW }, NOW, limits)

        expect(denied.waitMs).toBe(250)
    })

    it("does not refill backwards when the clock reads earlier", () => {
        const taken = takeToken({ tokens: 1, at: NOW }, NOW - 5_000, limits)

        expect(taken.state.tokens).toBe(0)
        expect(taken.allowed).toBe(true)
    })
})
