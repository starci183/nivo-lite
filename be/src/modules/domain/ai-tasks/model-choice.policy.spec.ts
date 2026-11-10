import type { ConfiguredProviders, DeclaredModel } from "./ai-tasks.contracts"
import { modelChoiceOf, modelFactsOf, servedModelOf } from "./model-choice.policy"
import type { ModelChoice, ModelChoiceResult } from "./model-choice.policy"

const SONNET = "claude-sonnet-5-5"
const DEEPSEEK = "deepseek/deepseek-v4.1-flash"
const BOTH: ConfiguredProviders = { anthropic: true, openrouter: true }
const NO_ANTHROPIC: ConfiguredProviders = { anthropic: false, openrouter: true }

const auto = (weight: DeclaredModel["weight"]): DeclaredModel => ({ model: "auto", weight, source: "declared" })

const chosen = (result: ModelChoiceResult): ModelChoice => {
    if (!result.ok) throw new Error(`not chosen: ${result.model}`)
    return result.choice
}

/** The profile, the model meant and the reason of a choice: what a spec reads. */
const brief = (result: ModelChoiceResult) => {
    const choice = chosen(result)
    return { profile: choice.target.name, intended: choice.intended, reason: choice.reason }
}

describe("modelChoiceOf: Auto, by rule", () => {
    it("gives a light step the cheap model and a heavy step Sonnet, each on the profile that can fail over", () => {
        expect(brief(modelChoiceOf(auto("light"), 1, BOTH))).toEqual({ profile: "auto-light", intended: DEEPSEEK, reason: "auto-light" })
        expect(brief(modelChoiceOf(auto("heavy"), 1, BOTH))).toEqual({ profile: "auto-heavy", intended: SONNET, reason: "auto-heavy" })
    })

    it("steps a light step up to Sonnet after a failed try, inside the same three tries", () => {
        expect(brief(modelChoiceOf(auto("light"), 2, BOTH))).toEqual({
            profile: "auto-heavy",
            intended: SONNET,
            reason: "auto-step-up",
        })
        expect(brief(modelChoiceOf(auto("light"), 3, BOTH)).reason).toBe("auto-step-up")
        expect(brief(modelChoiceOf(auto("heavy"), 2, BOTH)).reason).toBe("auto-heavy")
    })

    it("uses the other provider when the one it wants holds no key, and says so", () => {
        expect(brief(modelChoiceOf(auto("heavy"), 1, NO_ANTHROPIC))).toEqual({
            profile: "auto-heavy",
            intended: DEEPSEEK,
            reason: "auto-other-provider",
        })
        expect(brief(modelChoiceOf(auto("light"), 1, NO_ANTHROPIC)).reason).toBe("auto-light")
    })

    it("sends Auto a body both providers accept: no temperature, no forced tool call, the upstream's own fields", () => {
        expect(chosen(modelChoiceOf(auto("light"), 1, BOTH)).target).toEqual({
            name: "auto-light",
            sampling: false,
            forcedToolChoice: false,
            upstreamFields: true,
        })
    })
})

describe("modelChoiceOf: an explicit model never switches", () => {
    it("asks the profile of that model alone, on every try", () => {
        const sonnet: DeclaredModel = { model: SONNET, weight: "light", source: "node" }
        for (const tryNumber of [1, 2, 3]) {
            expect(brief(modelChoiceOf(sonnet, tryNumber, BOTH))).toEqual({ profile: "sonnet", intended: SONNET, reason: "explicit" })
        }
        expect(chosen(modelChoiceOf(sonnet, 1, BOTH)).target).toEqual({
            name: "sonnet",
            sampling: false,
            forcedToolChoice: false,
            upstreamFields: false,
        })
    })

    it("keeps today's body for the cheap model named explicitly", () => {
        const deepseek: DeclaredModel = { model: DEEPSEEK, weight: "heavy", source: "declared" }

        expect(brief(modelChoiceOf(deepseek, 2, BOTH))).toEqual({ profile: "deepseek", intended: DEEPSEEK, reason: "declared" })
        expect(chosen(modelChoiceOf(deepseek, 1, BOTH)).target).toMatchObject({ sampling: true, forcedToolChoice: true })
    })

    it("refuses Sonnet named on the node while Anthropic holds no key: the call fails loudly, it never becomes the cheap model", () => {
        expect(modelChoiceOf({ model: SONNET, weight: "heavy", source: "node" }, 1, NO_ANTHROPIC)).toEqual({
            ok: false,
            model: SONNET,
            why: "not-configured",
        })
    })
})

describe("modelChoiceOf: the default and what nobody declared", () => {
    const DEFAULT: DeclaredModel = { model: SONNET, weight: "heavy", source: "default" }

    it("is Sonnet once Anthropic holds a key", () => {
        expect(brief(modelChoiceOf(DEFAULT, 1, BOTH))).toEqual({ profile: "sonnet", intended: SONNET, reason: "default" })
    })

    it("is the cheap model while Anthropic holds no key, and says so (boot and every node keep working)", () => {
        expect(brief(modelChoiceOf(DEFAULT, 1, NO_ANTHROPIC))).toEqual({
            profile: "deepseek",
            intended: DEEPSEEK,
            reason: "default-no-key",
        })
    })

    it("books an unknown model as such and serves the default", () => {
        expect(brief(modelChoiceOf({ model: "gpt-9", weight: "light", source: "node" }, 1, NO_ANTHROPIC))).toEqual({
            profile: "deepseek",
            intended: DEEPSEEK,
            reason: "unknown-model",
        })
    })
})

describe("modelChoiceOf: the turns of one step", () => {
    it("keeps every later turn on the model of the step's first answer, even an Auto step on a retry", () => {
        expect(brief(modelChoiceOf(auto("light"), 2, BOTH, DEEPSEEK))).toEqual({
            profile: "deepseek",
            intended: DEEPSEEK,
            reason: "step-pinned",
        })
    })
})

describe("modelFactsOf", () => {
    it("books what was declared, the provider of the served model and why", () => {
        expect(modelFactsOf(chosen(modelChoiceOf(auto("heavy"), 1, BOTH)), SONNET)).toEqual({
            declaredModel: "auto",
            modelProvider: "anthropic",
            modelReason: "auto-heavy",
        })
    })

    it("books an Auto call the router served with the other model as a failover", () => {
        expect(modelFactsOf(chosen(modelChoiceOf(auto("heavy"), 1, BOTH)), DEEPSEEK)).toEqual({
            declaredModel: "auto",
            modelProvider: "openrouter",
            modelReason: "auto-failover",
        })
    })

    it("reads a dated form of a model id as that model", () => {
        expect(servedModelOf("claude-sonnet-5-5-20261101")).toBe(SONNET)
        expect(servedModelOf("work")).toBeNull()
    })
})
