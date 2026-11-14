import type { ConfiguredProviders, DeclaredModel } from "./ai-tasks.contracts"
import { modelChoiceOf, modelFactsOf, servedModelOf } from "./model-choice.policy"
import type { ModelChoice, ModelChoiceResult } from "./model-choice.policy"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const SONNET = "claude-sonnet-5-5"
const HAIKU = "claude-haiku-5-5"
const DEEPSEEK = "deepseek/deepseek-v4.1-flash"
const CLAUDE: ConfiguredProviders = { anthropic: true, openrouter: false }
const NO_ANTHROPIC: ConfiguredProviders = { anthropic: false, openrouter: false }
/** The Claude-only wire every chat profile has now: no temperature, no forced tool call, no OpenRouter fields. */
const CLAUDE_WIRE = { sampling: false, forcedToolChoice: false, upstreamFields: false }

const auto = (weight: DeclaredModel["weight"]): DeclaredModel => ({ model: "auto", weight, source: "declared" })

const chosen = (result: ModelChoiceResult): ModelChoice => {
    if (!result.ok) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: `not chosen: ${result.model}` } })
    return result.choice
}

/** The profile, the model meant and the reason of a choice: what a spec reads. */
const brief = (result: ModelChoiceResult) => {
    const choice = chosen(result)
    return { profile: choice.target.name, intended: choice.intended, reason: choice.reason }
}

describe("modelChoiceOf: Auto, by rule, Claude only", () => {
    it("gives a light step Haiku and a heavy step Sonnet, each on the profile that can fail over within Claude", () => {
        expect(brief(modelChoiceOf(auto("light"), 1, CLAUDE))).toEqual({ profile: "auto-light", intended: HAIKU, reason: "auto-light" })
        expect(brief(modelChoiceOf(auto("heavy"), 1, CLAUDE))).toEqual({ profile: "auto-heavy", intended: SONNET, reason: "auto-heavy" })
    })

    it("steps a light step up to Sonnet after a failed try, inside the same three tries", () => {
        expect(brief(modelChoiceOf(auto("light"), 2, CLAUDE))).toEqual({
            profile: "auto-heavy",
            intended: SONNET,
            reason: "auto-step-up",
        })
        expect(brief(modelChoiceOf(auto("light"), 3, CLAUDE)).reason).toBe("auto-step-up")
        expect(brief(modelChoiceOf(auto("heavy"), 2, CLAUDE)).reason).toBe("auto-heavy")
    })

    it("fails loudly with no Anthropic key: no other vendor serves it", () => {
        expect(modelChoiceOf(auto("heavy"), 1, NO_ANTHROPIC)).toEqual({ ok: false, model: SONNET, why: "not-configured" })
        expect(modelChoiceOf(auto("light"), 1, NO_ANTHROPIC)).toEqual({ ok: false, model: HAIKU, why: "not-configured" })
    })

    it("sends Auto the Claude body: no temperature, no forced tool call, no OpenRouter fields", () => {
        expect(chosen(modelChoiceOf(auto("light"), 1, CLAUDE)).target).toEqual({ name: "auto-light", ...CLAUDE_WIRE })
        expect(chosen(modelChoiceOf(auto("heavy"), 1, CLAUDE)).target).toEqual({ name: "auto-heavy", ...CLAUDE_WIRE })
    })
})

describe("modelChoiceOf: an explicit model never switches", () => {
    it("asks the profile of that model alone, on every try", () => {
        const sonnet: DeclaredModel = { model: SONNET, weight: "light", source: "node" }
        const haiku: DeclaredModel = { model: HAIKU, weight: "heavy", source: "node" }
        for (const tryNumber of [1, 2, 3]) {
            expect(brief(modelChoiceOf(sonnet, tryNumber, CLAUDE))).toEqual({ profile: "sonnet", intended: SONNET, reason: "explicit" })
            expect(brief(modelChoiceOf(haiku, tryNumber, CLAUDE))).toEqual({ profile: "haiku", intended: HAIKU, reason: "explicit" })
        }
        expect(chosen(modelChoiceOf(sonnet, 1, CLAUDE)).target).toEqual({ name: "sonnet", ...CLAUDE_WIRE })
        expect(chosen(modelChoiceOf(haiku, 1, CLAUDE)).target).toEqual({ name: "haiku", ...CLAUDE_WIRE })
    })

    it("refuses a Claude model named on the node while Anthropic holds no key: the call fails loudly", () => {
        expect(modelChoiceOf({ model: SONNET, weight: "heavy", source: "node" }, 1, NO_ANTHROPIC)).toEqual({
            ok: false,
            model: SONNET,
            why: "not-configured",
        })
    })
})

describe("modelChoiceOf: a retired model (DeepSeek flash) on a stored graph", () => {
    const stored: DeclaredModel = { model: DEEPSEEK, weight: "heavy", source: "node" }

    it("does not crash: it runs on the cheap tier (Haiku, Sonnet behind it) and is booked retired-model", () => {
        expect(brief(modelChoiceOf(stored, 1, CLAUDE))).toEqual({ profile: "auto-light", intended: HAIKU, reason: "retired-model" })
        expect(chosen(modelChoiceOf(stored, 1, CLAUDE)).target).toEqual({ name: "auto-light", ...CLAUDE_WIRE })
        expect(chosen(modelChoiceOf(stored, 1, CLAUDE)).declared).toBe(DEEPSEEK)
    })

    it("keeps its reason when the cheap tier's profile served Sonnet", () => {
        expect(modelFactsOf(chosen(modelChoiceOf(stored, 1, CLAUDE)), SONNET).modelReason).toBe("retired-model")
    })

    it("fails loudly with no Anthropic key", () => {
        expect(modelChoiceOf(stored, 1, NO_ANTHROPIC)).toEqual({ ok: false, model: HAIKU, why: "not-configured" })
    })
})

describe("modelChoiceOf: the default and what nobody declared", () => {
    const DEFAULT: DeclaredModel = { model: SONNET, weight: "heavy", source: "default" }

    it("is Sonnet once Anthropic holds a key", () => {
        expect(brief(modelChoiceOf(DEFAULT, 1, CLAUDE))).toEqual({ profile: "sonnet", intended: SONNET, reason: "default" })
    })

    it("fails loudly while Anthropic holds no key (it no longer becomes DeepSeek)", () => {
        expect(modelChoiceOf(DEFAULT, 1, NO_ANTHROPIC)).toEqual({ ok: false, model: SONNET, why: "not-configured" })
    })

    it("books an unknown model as such and serves the default", () => {
        expect(brief(modelChoiceOf({ model: "gpt-9", weight: "light", source: "node" }, 1, CLAUDE))).toEqual({
            profile: "sonnet",
            intended: SONNET,
            reason: "unknown-model",
        })
    })
})

describe("modelChoiceOf: the turns of one step", () => {
    it("keeps every later turn on the model of the step's first answer, even an Auto step on a retry", () => {
        expect(brief(modelChoiceOf(auto("light"), 2, CLAUDE, HAIKU))).toEqual({
            profile: "haiku",
            intended: HAIKU,
            reason: "step-pinned",
        })
    })
})

describe("modelFactsOf", () => {
    it("books what was declared, the provider of the served model and why", () => {
        expect(modelFactsOf(chosen(modelChoiceOf(auto("heavy"), 1, CLAUDE)), SONNET)).toEqual({
            declaredModel: "auto",
            modelProvider: "anthropic",
            modelReason: "auto-heavy",
        })
    })

    it("books an Auto call the router served with the other Claude model as a failover", () => {
        expect(modelFactsOf(chosen(modelChoiceOf(auto("heavy"), 1, CLAUDE)), HAIKU)).toEqual({
            declaredModel: "auto",
            modelProvider: "anthropic",
            modelReason: "auto-failover",
        })
    })

    it("reads a dated form of a model id as that model", () => {
        expect(servedModelOf("claude-sonnet-5-5-20261101")).toBe(SONNET)
        expect(servedModelOf("claude-haiku-5-5")).toBe(HAIKU)
        expect(servedModelOf("work")).toBeNull()
    })
})
