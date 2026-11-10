import type { Bilingual } from "@nivo-lite/agent-sdk/module"

/**
 * The models a graph node's AI calls may use (owner, 2026-11-10: "chọn model trong từng node; mặc định sonnet; phát triển auto
 * mode"). NIVO names a model or Auto; which provider, key and failover serve it is the AI router's, never a branch of NIVO.
 */

/** Auto: the engine picks the model of each call by the step's weight, by rule, with no extra AI call. */
export const AUTO_MODEL: "auto" = "auto"

/** Claude Sonnet 5.5, on Anthropic directly: the strong model, and the default of a node that declares none. */
export const SONNET_MODEL: "claude-sonnet-5-5" = "claude-sonnet-5-5"

/** DeepSeek V4.1 flash, through OpenRouter: the fast, cheap model of light steps. */
export const DEEPSEEK_MODEL: "deepseek/deepseek-v4.1-flash" = "deepseek/deepseek-v4.1-flash"

/** One explicit model. */
export type ModelId = typeof SONNET_MODEL | typeof DEEPSEEK_MODEL

/** The ids of the explicit models, strongest first. */
export const MODEL_IDS: readonly [typeof SONNET_MODEL, typeof DEEPSEEK_MODEL] = [SONNET_MODEL, DEEPSEEK_MODEL]

/** What a node may name: Auto or one explicit model. */
export type ModelChoice = typeof AUTO_MODEL | ModelId

/**
 * How much a step weighs, as blocks-core declares it: `light` (classify, route, a short reply to a customer or the team) or `heavy`
 * (a decision about money, a record of money, a report). Auto gives a light step the cheap model and a heavy one the strong model.
 */
export type StepWeight = "light" | "heavy"

/** The provider that serves a model, as the picker labels it. It is a label: NIVO never branches on it. */
export type ModelProvider = "anthropic" | "openrouter"

/** One entry of the picker. */
export interface ModelEntry {
    /** What a node stores: `auto` or the model id. */
    readonly id: ModelChoice
    /** The name shown. */
    readonly label: Bilingual
    /** One line under the name. */
    readonly hint: Bilingual
    /** The provider of an explicit model; null for Auto (it uses both). */
    readonly provider: ModelProvider | null
    /** The provider as the picker's chip shows it; null for Auto. */
    readonly providerLabel: string | null
    /** False keeps a model out of the picker (still read on stored graphs). */
    readonly selectable: boolean
}

/** The picker, in its order: Auto first, then the explicit models strongest first. */
export const MODEL_ENTRIES: ReadonlyArray<ModelEntry> = [
    {
        id: AUTO_MODEL,
        label: { vi: "Auto", en: "Auto" },
        hint: { vi: "NIVO chọn model cho từng lần chạy của bước này", en: "NIVO picks the model for each run of this step" },
        provider: null,
        providerLabel: null,
        selectable: true,
    },
    {
        id: SONNET_MODEL,
        label: { vi: "Claude Sonnet 5.5", en: "Claude Sonnet 5.5" },
        hint: {
            vi: "Mặc định khi node không khai gì · mạnh, tốn credit hơn",
            en: "The default when a node declares none · strong, costs more credits",
        },
        provider: "anthropic",
        providerLabel: "Anthropic",
        selectable: true,
    },
    {
        id: DEEPSEEK_MODEL,
        label: { vi: "DeepSeek flash", en: "DeepSeek flash" },
        hint: { vi: "Nhanh, rẻ · cho bước nhẹ", en: "Fast, cheap · for light steps" },
        provider: "openrouter",
        providerLabel: "OpenRouter",
        selectable: true,
    },
]

/** The model of a node that declares none and has no row in the table of node models. */
export const DEFAULT_MODEL: ModelId = SONNET_MODEL

/** What Auto gives a step of each weight on its first try. */
export const AUTO_MODEL_OF_WEIGHT: Readonly<Record<StepWeight, ModelId>> = { light: DEEPSEEK_MODEL, heavy: SONNET_MODEL }

/** The model Auto steps up to when a try failed (inside the same three tries). */
export const STRONGER_MODEL: ModelId = SONNET_MODEL

/** True for what a node may store as its model. */
export const isModelChoice = (value: unknown): value is ModelChoice =>
    value === AUTO_MODEL || MODEL_IDS.some((id) => id === value)

/** True for an explicit model id. */
export const isModelId = (value: unknown): value is ModelId => MODEL_IDS.some((id) => id === value)

/** The picker entry of a choice, or null for anything else. */
export const modelEntryOf = (id: string): ModelEntry | null => MODEL_ENTRIES.find((entry) => entry.id === id) ?? null
