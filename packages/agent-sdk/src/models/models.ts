import type { Bilingual } from "../module"

/**
 * The models a graph node's AI calls may use (owner, 2026-11-10: "chon model trong tung node; mac dinh sonnet; phat trien auto
 * mode"). NIVO names a model or Auto; which provider, key and failover serve it is the AI router's, never a branch of NIVO.
 */

/** Auto: the engine picks the model of each call by the step's weight, by rule, with no extra AI call. */
export const AUTO_MODEL: "auto" = "auto"

/** Claude Sonnet 5.5, on Anthropic directly: the strong model, and the default of a node that declares none. */
export const SONNET_MODEL: "claude-sonnet-5-5" = "claude-sonnet-5-5"

/** Claude Haiku 5.5, on Anthropic directly (the same key as Sonnet): the fast, cheap model. */
export const HAIKU_MODEL: "claude-haiku-5-5" = "claude-haiku-5-5"

/**
 * RETIRED (owner 2026-11-11: no more OpenRouter): DeepSeek V4.1 flash, through OpenRouter. No longer selectable and no
 * longer served; a stored graph node that still names it runs on the cheap tier (`CHEAP_MODEL`, booked `retired-model`), and a draft
 * that names it is refused at save. Kept only so stored graphs and old usage rows are still read.
 */
export const DEEPSEEK_MODEL: "deepseek/deepseek-v4.1-flash" = "deepseek/deepseek-v4.1-flash"

/** One explicit model a node may name today. */
export type ModelId = typeof SONNET_MODEL | typeof HAIKU_MODEL

/** A retired model: read on stored graphs, never selectable, never served. */
export type RetiredModelId = typeof DEEPSEEK_MODEL

/** The ids of the explicit models, strongest first. */
export const MODEL_IDS: readonly [typeof SONNET_MODEL, typeof HAIKU_MODEL] = [SONNET_MODEL, HAIKU_MODEL]

/** The ids of the retired models. */
export const RETIRED_MODEL_IDS: readonly [typeof DEEPSEEK_MODEL] = [DEEPSEEK_MODEL]

/**
 * THE cheap tier, in ONE place (coordinator's interim choice 2026-11-11, to be confirmed by the owner): Auto's light steps, the
 * fixed background tasks of the app (gateway profile `work`) and a retired model's calls. The gateway pools this id on Anthropic.
 * Change it here (then blocks-core build, be build, restart); it must stay an Anthropic model of `MODEL_IDS`.
 */
export const CHEAP_MODEL: ModelId = HAIKU_MODEL

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
    /** The provider of an explicit model; null for Auto. */
    readonly provider: ModelProvider | null
    /** The provider as the picker's chip shows it; null for Auto. */
    readonly providerLabel: string | null
    /** False keeps a model out of the picker (still read on stored graphs). */
    readonly selectable: boolean
}

/** The entry of a retired model: same shape, its own id, never selectable. */
export interface RetiredModelEntry extends Omit<ModelEntry, "id" | "selectable"> {
    /** The retired id a stored graph may still carry. */
    readonly id: RetiredModelId
    /** Always false. */
    readonly selectable: false
}

/** The picker, in its order: Auto first, then the explicit models strongest first. */
export const MODEL_ENTRIES: ReadonlyArray<ModelEntry> = [
    {
        id: AUTO_MODEL,
        label: { vi: "Auto", en: "Auto" },
        hint: { vi: "NIVO ch\u1ecdn model cho t\u1eebng l\u1ea7n ch\u1ea1y c\u1ee7a b\u01b0\u1edbc n\u00e0y", en: "NIVO picks the model for each run of this step" },
        provider: null,
        providerLabel: null,
        selectable: true,
    },
    {
        id: SONNET_MODEL,
        label: { vi: "Claude Sonnet 5.5", en: "Claude Sonnet 5.5" },
        hint: {
            vi: "M\u1eb7c \u0111\u1ecbnh khi node kh\u00f4ng khai g\u00ec \u00b7 m\u1ea1nh, t\u1ed1n credit h\u01a1n",
            en: "The default when a node declares none \u00b7 strong, costs more credits",
        },
        provider: "anthropic",
        providerLabel: "Anthropic",
        selectable: true,
    },
    {
        id: HAIKU_MODEL,
        label: { vi: "Claude Haiku 5.5", en: "Claude Haiku 5.5" },
        hint: { vi: "Nhanh, r\u1ebb \u00b7 cho b\u01b0\u1edbc nh\u1eb9", en: "Fast, cheap \u00b7 for light steps" },
        provider: "anthropic",
        providerLabel: "Anthropic",
        selectable: true,
    },
]

/** The entries of the retired models: never in the picker; read for the label of a stored graph or an old usage row. */
const RETIRED_ENTRIES: ReadonlyArray<RetiredModelEntry> = [
    {
        id: DEEPSEEK_MODEL,
        label: { vi: "DeepSeek flash (\u0111\u00e3 ng\u1eebng)", en: "DeepSeek flash (retired)" },
        hint: { vi: "\u0110\u00e3 ng\u1eebng \u00b7 ch\u1ea1y b\u1eb1ng model r\u1ebb c\u1ee7a Claude", en: "Retired \u00b7 runs on Claude's cheap model" },
        provider: "openrouter",
        providerLabel: "OpenRouter",
        selectable: false,
    },
]

/** The model of a node that declares none and has no row in the table of node models. */
export const DEFAULT_MODEL: ModelId = SONNET_MODEL

/** What Auto gives a step of each weight on its first try. */
export const AUTO_MODEL_OF_WEIGHT: Readonly<Record<StepWeight, ModelId>> = { light: CHEAP_MODEL, heavy: SONNET_MODEL }

/** The model Auto steps up to when a try failed (inside the same three tries). */
export const STRONGER_MODEL: ModelId = SONNET_MODEL

/** True when `value` is one of `ids`; the ids are read as plain values so any `unknown` can be asked about. */
const isListed = (ids: ReadonlyArray<unknown>, value: unknown): boolean => ids.includes(value)

/** True for what a node may store as its model. */
export const isModelChoice = (value: unknown): value is ModelChoice =>
    value === AUTO_MODEL || isListed(MODEL_IDS, value)

/** True for an explicit model id. */
export const isModelId = (value: unknown): value is ModelId => isListed(MODEL_IDS, value)

/** True for a retired model id (a stored graph may still carry it). */
export const isRetiredModel = (value: unknown): value is RetiredModelId => isListed(RETIRED_MODEL_IDS, value)

/** The picker entry of a choice or of a retired model, or null for anything else. */
export const modelEntryOf = (id: string): ModelEntry | RetiredModelEntry | null =>
    MODEL_ENTRIES.find((entry) => entry.id === id) ?? RETIRED_ENTRIES.find((entry) => entry.id === id) ?? null
