import {
    AUTO_MODEL,
    AUTO_MODEL_OF_WEIGHT,
    DEEPSEEK_MODEL,
    DEFAULT_MODEL,
    MODEL_IDS,
    SONNET_MODEL,
    STRONGER_MODEL,
    isModelId,
    modelEntryOf,
} from "@nivo-lite/blocks-core"
import type { ModelId, ModelProvider } from "@nivo-lite/blocks-core"
import type { AiTarget } from "@modules/integrations/ai"
import { MODEL_PROFILES, profileWireOf } from "@modules/integrations/ai-gateway"
import type { ModelProfile } from "@modules/integrations/ai-gateway"
import type { ConfiguredProviders, DeclaredModel } from "./ai-tasks.contracts"

/**
 * Why a call went to the model it went to, as the metering books it and the run page shows it:
 * - `explicit`: the shop (or the graph) named this model on the node;
 * - `declared`: blocks-core declares this model for the node's step;
 * - `default`: the node names none and blocks-core declares none: Claude Sonnet 5.5;
 * - `default-no-key`: the same, but Anthropic holds no key, so the cheap model;
 * - `unknown-model`: the node names a model the vocabulary does not know, so the default (never silently: this is booked);
 * - `auto-light` / `auto-heavy`: Auto, by the step's declared weight;
 * - `auto-step-up`: Auto on a light step whose earlier try failed: the stronger model, inside the same three tries;
 * - `auto-other-provider`: Auto, but the provider of the model it wanted holds no key, so the other one;
 * - `auto-failover`: Auto, but the provider it wanted had no usable lane, and the router served the other model;
 * - `step-pinned`: a later turn of a step's agent loop, kept on the model of its first answer (a prompt cache is per model).
 */
export type ModelReason =
    | "explicit"
    | "declared"
    | "default"
    | "default-no-key"
    | "unknown-model"
    | "auto-light"
    | "auto-heavy"
    | "auto-step-up"
    | "auto-other-provider"
    | "auto-failover"
    | "step-pinned"

/** The model of one try of a node's call: what to ask the gateway for, which model that means, and why. */
export interface ModelChoice {
    /** The gateway profile and the body it accepts. */
    readonly target: AiTarget
    /** The model this choice means to be served (Auto's profile may serve the other one when this one's provider fails). */
    readonly intended: ModelId
    /** Why. */
    readonly reason: ModelReason
    /** What the node declared: `auto`, a model id, or the default's id when it named none. */
    readonly declared: string
    /** True for Auto: the router may serve the other model, which is then booked as `auto-failover`. */
    readonly auto: boolean
}

/** A choice, or the model a node named explicitly whose provider holds no key: that call fails loudly, it never switches. */
export type ModelChoiceResult =
    | { readonly ok: true; readonly choice: ModelChoice }
    | { readonly ok: false; readonly model: ModelId; readonly why: "not-configured" }

/** The profile that serves an explicit model and nothing else. */
const PROFILE_OF_MODEL: Readonly<Record<ModelId, ModelProfile>> = {
    [SONNET_MODEL]: MODEL_PROFILES.sonnet,
    [DEEPSEEK_MODEL]: MODEL_PROFILES.deepseek,
}

const targetOf = (profile: ModelProfile): AiTarget => ({ name: profile, ...profileWireOf(profile) })

/** True when the provider of the model holds a key. */
const configured = (model: ModelId, providers: ConfiguredProviders): boolean => {
    const provider = modelEntryOf(model)?.provider ?? null
    return provider !== null && providers[provider]
}

/** The other explicit model: the one Auto turns to when the provider of the one it wanted holds no key. */
const otherOf = (model: ModelId): ModelId => (model === SONNET_MODEL ? DEEPSEEK_MODEL : SONNET_MODEL)

/** Auto on one try: the weight's model (the stronger one after a failed try of a light step), on the profile that can fail over. */
const autoOf = (declared: DeclaredModel, tryNumber: number, providers: ConfiguredProviders): ModelChoice => {
    const stepUp = declared.weight === "light" && tryNumber > 1
    const heavy = stepUp || declared.weight === "heavy"
    const wanted = heavy ? STRONGER_MODEL : AUTO_MODEL_OF_WEIGHT[declared.weight]
    const own = configured(wanted, providers)
    const reason: ModelReason = !own ? "auto-other-provider" : stepUp ? "auto-step-up" : heavy ? "auto-heavy" : "auto-light"
    return {
        target: targetOf(heavy ? MODEL_PROFILES.autoHeavy : MODEL_PROFILES.autoLight),
        intended: own ? wanted : otherOf(wanted),
        reason,
        declared: AUTO_MODEL,
        auto: true,
    }
}

/** The default model, or the cheap one when Anthropic holds no key (said so in the reason). */
const defaultOf = (declared: string, providers: ConfiguredProviders, unknown: boolean): ModelChoice => {
    const own = configured(DEFAULT_MODEL, providers)
    const intended = own ? DEFAULT_MODEL : DEEPSEEK_MODEL
    const reason: ModelReason = unknown ? "unknown-model" : own ? "default" : "default-no-key"
    return { target: targetOf(PROFILE_OF_MODEL[intended]), intended, reason, declared, auto: false }
}

/**
 * The model of ONE try of a graph node's call. Pure, by rule, with no AI call: Auto gives a light step the cheap model and a heavy
 * step the strong one, steps a light step up to the strong model after a failed try (inside the same three tries), and asks a profile
 * the router can fail over within; an explicit model is asked on a profile that never falls back, and fails loudly when its provider
 * holds no key; the default (Sonnet) becomes the cheap model while Anthropic holds no key, and says so. `pinned` is the model a
 * step's agent loop answered its first turn with: every later turn of the step stays on it (the prompt cache is per model).
 */
export const modelChoiceOf = (
    declared: DeclaredModel,
    tryNumber: number,
    providers: ConfiguredProviders,
    pinned: ModelId | null = null,
): ModelChoiceResult => {
    if (pinned !== null) {
        const choice: ModelChoice = {
            target: targetOf(PROFILE_OF_MODEL[pinned]),
            intended: pinned,
            reason: "step-pinned",
            declared: declared.model,
            auto: false,
        }
        return { ok: true, choice }
    }
    if (declared.model === AUTO_MODEL) return { ok: true, choice: autoOf(declared, tryNumber, providers) }
    if (!isModelId(declared.model)) return { ok: true, choice: defaultOf(declared.model, providers, true) }
    if (declared.source === "default") return { ok: true, choice: defaultOf(declared.model, providers, false) }
    const model = declared.model
    if (!configured(model, providers)) return { ok: false, model, why: "not-configured" }
    const reason: ModelReason = declared.source === "node" ? "explicit" : "declared"
    return { ok: true, choice: { target: targetOf(PROFILE_OF_MODEL[model]), intended: model, reason, declared: model, auto: false } }
}

/** The explicit model a served model name is, or null: a provider may answer with the id or a dated form of it. */
export const servedModelOf = (served: string): ModelId | null =>
    MODEL_IDS.find((id) => served === id || served.startsWith(`${id}-`)) ?? null

/** What the meter books about the model of an answered try: what was declared, the provider that served it, and why. */
export interface ModelFacts {
    /** `auto`, a model id, or the default's id. */
    readonly declaredModel: string
    /** The provider of the model that served the call, as the vocabulary labels it; null for a model it does not know. */
    readonly modelProvider: ModelProvider | null
    /** Why; `auto-failover` when Auto's profile served the other model. */
    readonly modelReason: ModelReason
}

/** The facts of an answered try, given the model the endpoint said served it. */
export const modelFactsOf = (choice: ModelChoice, served: string): ModelFacts => {
    const model = servedModelOf(served)
    const failedOver = choice.auto && model !== null && model !== choice.intended
    return {
        declaredModel: choice.declared,
        modelProvider: modelEntryOf(model ?? choice.intended)?.provider ?? null,
        modelReason: failedOver ? "auto-failover" : choice.reason,
    }
}
