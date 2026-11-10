import { callColumnsOf } from "./call-facts.policy"

const FIGURES = { promptTokens: 8162, completionTokens: 2636, cachedTokens: 8064, costUsd: 0.001, estimated: false }
const CALL = {
    purpose: "accounting.match-payment:agent",
    reasoningTokens: 2542,
    durationMs: 7414,
    tryNumber: 2,
    upstream: "Parasail",
    finishReason: "stop",
}

describe("callColumnsOf", () => {
    it("books what the call was and how it went", () => {
        expect(callColumnsOf(CALL, FIGURES)).toEqual(CALL)
    })

    it("books none of it for a call that told nothing", () => {
        expect(callColumnsOf(undefined, FIGURES)).toEqual({
            purpose: null,
            reasoningTokens: 0,
            durationMs: null,
            tryNumber: null,
            upstream: null,
            finishReason: null,
        })
    })

    it("keeps the hidden reasoning within the completion it was written with, and books none for an estimated call", () => {
        expect(callColumnsOf({ ...CALL, reasoningTokens: 9000 }, FIGURES).reasoningTokens).toBe(2636)
        expect(callColumnsOf(CALL, { ...FIGURES, estimated: true }).reasoningTokens).toBe(0)
        expect(callColumnsOf({ ...CALL, reasoningTokens: null }, FIGURES).reasoningTokens).toBe(0)
    })

    it("fits the columns: texts trimmed and cut, empty text and an out-of-range try or a negative time not booked", () => {
        const columns = callColumnsOf(
            { ...CALL, purpose: ` ${"p".repeat(250)} `, upstream: "  ", finishReason: "x".repeat(50), tryNumber: 11, durationMs: -1 },
            FIGURES,
        )

        expect(columns.purpose).toBe("p".repeat(200))
        expect(columns.upstream).toBeNull()
        expect(columns.finishReason).toBe("x".repeat(40))
        expect(columns.tryNumber).toBeNull()
        expect(columns.durationMs).toBeNull()
        expect(callColumnsOf({ ...CALL, tryNumber: 0 }, FIGURES).tryNumber).toBeNull()
        expect(callColumnsOf({ ...CALL, durationMs: 1234.6 }, FIGURES).durationMs).toBe(1235)
    })
})
