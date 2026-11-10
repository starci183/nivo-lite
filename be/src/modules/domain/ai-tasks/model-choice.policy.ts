import {
    AUTO_MODEL,
    AUTO_MODEL_OF_WEIGHT,
    CHEAP_MODEL,
    DEFAULT_MODEL,
    HAIKU_MODEL,
    MODEL_IDS,
    SONNET_MODEL,
    STRONGER_MODEL,
    isModelId,
    isRetiredModel,
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
 * - `default-no-key`: (old rows only) the default while Anthropic held no key, served by DeepSeek; now that call fails loudly;
 * - `unknown-model`: the node names a model the vocabulary does not know, so the default (never silently: this is booked);
 * - `retired-model`: the node still names a retired model (DeepSeek flash): the cheap tier (`CHEAP_MODEL`) on Claude;
 * - `auto-light` / `auto-heavy`: Auto, by the step's declared weight;
 * - `auto-step-up`: Auto on a light step whose earlier try failed: the stronger model, inside the same three tries;
 * - `auto-other-provider`: (old rows only) Auto turned to the other vendor; with Claude only, a missing key now fails loudly;
 * - `auto-failover`: Auto, but the provider it wanted had no usable lane, and the router served the other model;
 * - `step-pinned`: a later turn of a step's agent loop, kept on the model of its first answer (a prompt cache is per model).
 */
export type ModelReason =
    | "explicit"
    | "declared"
    | "default"
    | "default-no-key"
    | "unknown-model"
    | "retired-model"
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
    [HAIKU_MODEL]: MODEL_PROFILES.haiku,
}

const targetOf = (profile: ModelProfile): AiTarget => ({ name: profile, ...profileWireOf(profile) })

/** True when the provider of the model holds a key. */
const configured = (model: ModelId, providers: ConfiguredProviders): boolean => {
    const provider = modelEntryOf(model)?.provider ?? null
    return provider !== null && providers[provider]
}

/** The loud failure of a model whose provider holds no key: no call is made, nothing switches vendor. */
const notConfigured = (model: ModelId): ModelChoiceResult => ({ ok: false, model, why: "not-configured" })

/** Why Auto chose its model: the step up after a failed try, else the step's weight. */
const autoReasonOf = (stepUp: boolean, heavy: boolean): ModelReason => {
    if (stepUp) return "auto-step-up"
    return heavy ? "auto-heavy" : "auto-light"
}

/** Auto on one try: the weight's model (the stronger one after a failed try of a light step), on the profile that can fail over. */
const autoOf = (declared: DeclaredModel, tryNumber: number, providers: ConfiguredProviders): ModelChoiceResult => {
    const stepUp = declared.weight === "light" && tryNumber > 1
    const heavy = stepUp || declared.weight === "heavy"
    const wanted = heavy ? STRONGER_MODEL : AUTO_MODEL_OF_WEIGHT[declared.weight]
    if (!configured(wanted, providers)) return notConfigured(wanted)
    const choice: ModelChoice = {
        target: targetOf(heavy ? MODEL_PROFILES.autoHeavy : MODEL_PROFILES.autoLight),
        intended: wanted,
        reason: autoReasonOf(stepUp, heavy),
        declared: AUTO_MODEL,
        auto: true,
    }
    return { ok: true, choice }
}

/** The default model (Sonnet); with no Anthropic key the call fails loudly (it used to become DeepSeek: retired). */
const defaultOf = (declared: string, providers: ConfiguredProviders, unknown: boolean): ModelChoiceResult => {
    if (!configured(DEFAULT_MODEL, providers)) return notConfigured(DEFAULT_MODEL)
    const reason: ModelReason = unknown ? "unknown-model" : "default"
    return { ok: true, choice: { target: targetOf(PROFILE_OF_MODEL[DEFAULT_MODEL]), intended: DEFAULT_MODEL, reason, declared, auto: false } }
}

/** A retired model a stored node still names: the cheap tier on Claude (its profile may serve Sonnet), booked `retired-model`. */
const retiredOf = (declared: string, providers: ConfiguredProviders): ModelChoiceResult => {
    if (!configured(CHEAP_MODEL, providers)) return notConfigured(CHEAP_MODEL)
    const choice: ModelChoice = {
        target: targetOf(MODEL_PROFILES.autoLight),
        intended: CHEAP_MODEL,
        reason: "retired-model",
        declared,
        auto: false,
    }
    return { ok: true, choice }
}

/**
 * The model of ONE try of a graph node's call. Pure, by rule, with no AI call: Auto gives a light step the cheap model and a heavy
 * step the strong one, steps a light step up to the strong model after a failed try (inside the same three tries), and asks a profile
 * the router can fail over within; an explicit model is asked on a profile that never falls back, and fails loudly when its provider
 * holds no key; so do Auto and the default (Claude only: nothing switches vendor); a retired model (DeepSeek flash) runs on the
 * cheap tier and says so. `pinned` is the model a
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
    if (declared.model === AUTO_MODEL) return autoOf(declared, tryNumber, providers)
    if (isRetiredModel(declared.model)) return retiredOf(declared.model, providers)
    if (!isModelId(declared.model)) return defaultOf(declared.model, providers, true)
    if (declared.source === "default") return defaultOf(declared.model, providers, false)
    const model = declared.model
    if (!configured(model, providers)) return notConfigured(model)
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
