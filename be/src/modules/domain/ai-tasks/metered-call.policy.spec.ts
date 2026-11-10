import { meteredCallOf } from "./metered-call.policy"

const USAGE = { promptTokens: 8162, completionTokens: 2636, totalTokens: 10798, costUsd: 0.001, cachedTokens: 8064 }

describe("meteredCallOf", () => {
    it("books a node call's kind, its hidden reasoning, the try that answered and how that try was served", () => {
        expect(
            meteredCallOf("accounting.match-payment:agent", { ...USAGE, reasoningTokens: 2542 }, 2, {
                upstream: "Parasail",
                finishReason: "stop",
                durationMs: 7414,
            }),
        ).toEqual({
            purpose: "accounting.match-payment:agent",
            reasoningTokens: 2542,
            durationMs: 7414,
            tryNumber: 2,
            upstream: "Parasail",
            finishReason: "stop",
        })
    })

    it("books nulls for what nobody said: a fixed task has no kind, an endpoint may report no reasoning and no upstream", () => {
        expect(meteredCallOf(undefined, USAGE, 1, undefined)).toEqual({
            purpose: null,
            reasoningTokens: null,
            durationMs: null,
            tryNumber: 1,
            upstream: null,
            finishReason: null,
        })
    })
})
