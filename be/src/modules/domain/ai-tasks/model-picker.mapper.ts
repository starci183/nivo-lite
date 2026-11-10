import { DEFAULT_MODEL, MODEL_ENTRIES, NODE_MODELS } from "@nivo-lite/blocks-core"
import type { Locale } from "@modules/platform/i18n"
import type { ConfiguredProviders } from "./ai-tasks.contracts"

/** One choice of the node drawer's model picker. */
export interface ModelPickerChoice {
    /** What the node stores: `auto` or a model id. */
    readonly id: string
    /** The name shown, in the asked language. */
    readonly label: string
    /** The line under the name, in the asked language. */
    readonly hint: string
    /** The provider of an explicit model (`anthropic`, `openrouter`); null for Auto. */
    readonly provider: string | null
    /** The provider's chip text (`Anthropic`, `OpenRouter`); null for Auto. */
    readonly providerLabel: string | null
    /** False while the provider holds no key in this deployment: an explicit choice of it would fail every call. Auto is always true. */
    readonly available: boolean
}

/** What blocks-core declares for one node step that calls AI: the drawer's preselected choice when the node names none. */
export interface ModelPickerNode {
    /** The node step id (`accounting.match-payment`). */
    readonly nodeId: string
    /** `auto` or a model id. */
    readonly model: string
    /** `light` or `heavy`: what Auto reads. */
    readonly weight: string
}

/** The node drawer's model picker: the choices in order, the default model, and what each AI node step declares. */
export interface ModelPicker {
    /** Auto first, then the explicit models strongest first. */
    readonly choices: ReadonlyArray<ModelPickerChoice>
    /** The model of a node that declares none (and is not in `nodes`). */
    readonly defaultModel: string
    /** Every node step that calls AI, by id. A step not listed calls no AI: the drawer shows no picker for it. */
    readonly nodes: ReadonlyArray<ModelPickerNode>
}

/** The picker in a language, with each explicit model available only while its provider holds a key. */
export const modelPickerOf = (locale: Locale, providers: ConfiguredProviders): ModelPicker => ({
    choices: MODEL_ENTRIES.filter((entry) => entry.selectable).map((entry) => ({
        id: entry.id,
        label: entry.label[locale],
        hint: entry.hint[locale],
        provider: entry.provider,
        providerLabel: entry.providerLabel,
        available: entry.provider === null || providers[entry.provider],
    })),
    defaultModel: DEFAULT_MODEL,
    nodes: Object.entries(NODE_MODELS)
        .map(([nodeId, row]) => ({ nodeId, model: row.model, weight: row.weight }))
        .sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
})
