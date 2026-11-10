import { toRunCallKind } from "./run-calls.mapper"

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
            purpose: "accounting.match-payment:agent",
            calls: 2,
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
            toRunCallKind({ ...ROW, purpose: "engine", max_try: null, slowest_ms: null, upstreams: [null], finish_reasons: null }),
        ).toMatchObject({ purpose: "engine", maxTry: null, slowestMs: null, upstreams: [], finishReasons: [] })
    })
})
