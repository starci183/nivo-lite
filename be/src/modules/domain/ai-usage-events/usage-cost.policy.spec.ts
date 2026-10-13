import { CREDIT_USD_VALUE, creditsOf, estimateTokens, figuresOf, priceOf } from "./usage-cost.policy"

describe("usage cost policy", () => {
    describe("priceOf", () => {
        it.each([
            ["DEEPSEEK-chat", 0.7],
            ["Qwen3-Embedding-8B", 0.01],
            ["text-embedding-3-small", 0.02],
            ["text-embedding-3-large", 0.13],
            ["another-model", 2.7],
        ])("prices a million prompt and two million completion tokens for %s", (model, cost) => {
            expect(priceOf(model, 1_000_000, 2_000_000)).toBe(cost)
        })
    })

    describe("estimateTokens", () => {
        it.each([
            [-3, 1],
            [0, 1],
            [1, 1],
            [3, 1],
            [4, 2],
            [9, 3],
        ])("estimates %i characters as %i tokens", (chars, tokens) => {
            expect(estimateTokens(chars)).toBe(tokens)
        })
    })

    describe("creditsOf", () => {
        it("converts dollars at 250 credits and rounds to two decimal places", () => {
            expect(CREDIT_USD_VALUE).toBe(0.00113)
            expect(creditsOf(0)).toBe(0)
            expect(creditsOf(1)).toBe(885)
            expect(creditsOf(0.123456)).toBe(110)
        })
    })

    describe("figuresOf", () => {
        const input = { model: "another-model", promptChars: 7, completionChars: 4 }

        it("estimates both counts and the model cost when the provider sends no usage", () => {
            expect(figuresOf({ ...input, model: "DeepSeek-chat" }, null)).toEqual({
                promptTokens: 3,
                completionTokens: 2,
                costUsd: 0.00000098,
                estimated: true,
            })
        })

        it("books at least one prompt token and no completion for an empty call", () => {
            expect(figuresOf({ ...input, promptChars: 0, completionChars: 0 }, {})).toEqual({
                promptTokens: 1,
                completionTokens: 0,
                costUsd: 0.0000003,
                estimated: true,
            })
        })

        it("uses provider counts and cost, rounding the cost to eight decimal places", () => {
            expect(
                figuresOf(input, { prompt_tokens: 100, completion_tokens: 50, total_tokens: 500, cost: 0.123456789 }),
            ).toEqual({ promptTokens: 100, completionTokens: 50, costUsd: 0.12345679, estimated: false })
        })

        it("keeps explicit zero counts and a zero provider cost", () => {
            expect(figuresOf(input, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost: 0 })).toEqual({
                promptTokens: 0,
                completionTokens: 0,
                costUsd: 0,
                estimated: false,
            })
        })

        it("rounds provider counts after calculating their price", () => {
            expect(figuresOf(input, { prompt_tokens: 4.4, completion_tokens: 2.6 })).toEqual({
                promptTokens: 4,
                completionTokens: 3,
                costUsd: 0.00000444,
                estimated: false,
            })
        })

        it("derives the prompt from the total and completion count", () => {
            expect(figuresOf(input, { total_tokens: 10, completion_tokens: 4 })).toEqual({
                promptTokens: 6,
                completionTokens: 4,
                costUsd: 0.0000066,
                estimated: false,
            })
        })

        it("derives the completion from the total and prompt count", () => {
            expect(figuresOf(input, { total_tokens: 10, prompt_tokens: 4 })).toEqual({
                promptTokens: 4,
                completionTokens: 6,
                costUsd: 0.0000084,
                estimated: false,
            })
        })

        it("assigns a lone total to the prompt", () => {
            expect(figuresOf(input, { total_tokens: 12 })).toEqual({
                promptTokens: 12,
                completionTokens: 0,
                costUsd: 0.0000036,
                estimated: false,
            })
        })

        it("does not estimate a missing count when another provider count is present", () => {
            expect(figuresOf(input, { prompt_tokens: 12 })).toEqual({
                promptTokens: 12,
                completionTokens: 0,
                costUsd: 0.0000036,
                estimated: false,
            })
            expect(figuresOf(input, { completion_tokens: 4 })).toEqual({
                promptTokens: 0,
                completionTokens: 4,
                costUsd: 0.0000048,
                estimated: false,
            })
        })

        it("clamps derived counts at zero when the total is smaller than a known count", () => {
            expect(figuresOf(input, { total_tokens: 2, completion_tokens: 4 })).toEqual({
                promptTokens: 0,
                completionTokens: 4,
                costUsd: 0.0000048,
                estimated: false,
            })
            expect(figuresOf(input, { total_tokens: 2, prompt_tokens: 12 })).toEqual({
                promptTokens: 12,
                completionTokens: 0,
                costUsd: 0.0000036,
                estimated: false,
            })
        })

        it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])(
            "estimates counts and cost when all provider figures are invalid (%p)",
            (invalid) => {
                expect(
                    figuresOf(input, {
                        prompt_tokens: invalid,
                        completion_tokens: invalid,
                        total_tokens: invalid,
                        cost: invalid,
                    }),
                ).toEqual({ promptTokens: 3, completionTokens: 2, costUsd: 0.0000033, estimated: true })
            },
        )

        it("keeps a provider cost even when its token counts must be estimated", () => {
            expect(figuresOf(input, { cost: 0.25 })).toEqual({
                promptTokens: 3,
                completionTokens: 2,
                costUsd: 0.25,
                estimated: true,
            })
        })
    })
})
