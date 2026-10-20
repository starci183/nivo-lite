import { BREAKER_OPEN_MS, breakerAfter, breakerAllows, CLOSED } from "./circuit-breaker.policy"

describe("circuit-breaker.policy", () => {
    it("opens after five failures in the window, half-opens after the pause and closes on success", () => {
        let state = CLOSED
        for (let at = 0; at < 4; at += 1) state = breakerAfter(state, false, at * 1000)
        expect(state.openUntil).toBeNull()
        expect(breakerAllows(state, 5000)).toBe(true)
        state = breakerAfter(state, false, 5000)
        expect(state.openUntil).toBe(5000 + BREAKER_OPEN_MS)
        expect(breakerAllows(state, 6000)).toBe(false)
        expect(breakerAllows(state, 5000 + BREAKER_OPEN_MS)).toBe(true)
        const reopened = breakerAfter(state, false, 5000 + BREAKER_OPEN_MS)
        expect(reopened.openUntil).toBe(5000 + 2 * BREAKER_OPEN_MS)
        expect(breakerAfter(reopened, true, 0)).toBe(CLOSED)
    })

    it("forgets failures older than the window", () => {
        let state = CLOSED
        for (let at = 0; at < 4; at += 1) state = breakerAfter(state, false, at)
        state = breakerAfter(state, false, 120_000)
        expect(state).toEqual({ failures: [120_000], openUntil: null })
    })
})
