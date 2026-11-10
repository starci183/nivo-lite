import { runTotalsOf, toRunCallKind } from "./run-calls.mapper"

const ROW = {
    purpose: "accounting.match-payment:agent",
    calls: 2,
    max_try: 3,
    prompt_tokens: 16324,
    cached_tokens: 8064,
    completion_tokens: 6702,
    reasoning_tokens: 6300,
    duration_ms: 33500,
    slowest_ms: 27000,
    cost_usd: 0.0041,
    upstreams: ["Wafer", null, "DigitalOcean", "Wafer"],
    finish_reasons: ["stop", null],
    models: ["claude-sonnet-5-5", "deepseek/deepseek-v4.1-flash"],
    declared_models: ["auto"],
    model_providers: ["openrouter", "anthropic"],
    model_reasons: ["auto-step-up", "auto-light", null],
}

describe("toRunCallKind", () => {
    it("reads one call kind of a run: counts as whole numbers, the upstreams and finish reasons named once, sorted", () => {
        expect(toRunCallKind(ROW)).toEqual({
            stepKey: null,
            purpose: "accounting.match-payment:agent",
            calls: 2,
            // A row read before U1 names no tries: its answers are its tries.
            tries: 2,
            failedTries: 0,
            cacheWriteTokens: 0,
            failedPromptTokens: 0,
            failedCostUsd: 0,
            failures: [],
            workKinds: [],
            // 0.0041 USD / 0.00113 USD per credit, a fraction: never rounded up per call.
            credits: 3.628319,
            failedCredits: 0,
            maxTry: 3,
            promptTokens: 16324,
            cachedTokens: 8064,
            completionTokens: 6702,
            reasoningTokens: 6300,
            durationMs: 33500,
            slowestMs: 27000,
            costUsd: 0.0041,
            upstreams: ["DigitalOcean", "Wafer"],
            finishReasons: ["stop"],
            models: ["claude-sonnet-5-5", "deepseek/deepseek-v4.1-flash"],
            declaredModels: ["auto"],
            modelProviders: ["anthropic", "openrouter"],
            modelReasons: ["auto-light", "auto-step-up"],
        })
    })

    it("reads a kind whose calls told no try, no time and no upstream (rows booked before the facts were kept)", () => {
        expect(
            toRunCallKind({
                ...ROW,
                purpose: "engine",
                max_try: null,
                slowest_ms: null,
                upstreams: [null],
                finish_reasons: null,
            }),
        ).toMatchObject({ purpose: "engine", maxTry: null, slowestMs: null, upstreams: [], finishReasons: [] })
    })

    it("a step with failed tries: the answers and the tries apart, credits exact for each", () => {
        expect(
            toRunCallKind({
                ...ROW,
                step_key: "match",
                tries: 5,
                failed_tries: 3,
                failed_prompt_tokens: 24_000,
                failed_cost_usd: 0.048,
                failures: ["timeout", "provider", null],
            }),
        ).toMatchObject({
            stepKey: "match",
            calls: 2,
            tries: 5,
            failedTries: 3,
            failedCredits: 42.477876,
            failures: ["provider", "timeout"],
        })
    })
})

describe("runTotalsOf", () => {
    it("sums the steps of a run, then turns the exact cost into credits once (no rounding per call or per step)", () => {
        const step = toRunCallKind({ ...ROW, cost_usd: 0.000565 })
        const totals = runTotalsOf([step, step, step])

        // Three calls of half a credit each: 1.5 credits, where rounding each call up would bill 3.
        expect(totals).toMatchObject({ calls: 6, tries: 6, costUsd: 0.001695, credits: 1.5, failedCredits: 0 })
        expect(runTotalsOf([])).toMatchObject({ calls: 0, credits: 0, costUsd: 0 })
    })
})
