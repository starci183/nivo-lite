import type { DefaultRule } from "@modules/domain/authority-rules"
import type { ModuleDefinition } from "../modules.contracts"

const NAME_MAX = 80
const NAME_SEARCH_LIMIT = 1000
const HANDLE_LIMIT = 1000

/** The limits of the display name of an agent. */
export const AGENT_NAME_LIMITS = { min: 2, max: 40 } as const

/** The shortest and the longest reply timeout a setting may hold, seconds. */
const TIMEOUT_RANGE = { min: 5, max: 120 } as const

/** The longest holding message, characters. */
const HOLDING_MAX = 400

/** Case-insensitive, trimmed key of an instance name: the database keeps (workspace, type, lower(name)) unique. */
export const instanceNameKey = (name: string): string => name.trim().toLowerCase()

/** A clean instance name, or null when it is empty or longer than 80 characters after trimming. */
export const cleanInstanceName = (name: string): string | null => {
    const clean = name.replace(/\s+/g, " ").trim()
    return clean.length >= 1 && clean.length <= NAME_MAX ? clean : null
}

/**
 * The suggested name of a new instance: the type name for the first one, then "type 2", "type 3"... (the next number after the instances
 * that exist, skipping any name already taken, case-insensitive).
 */
export const nextInstanceName = (typeName: string, taken: ReadonlyArray<string>): string => {
    const used = new Set(taken.map(instanceNameKey))
    if (taken.length === 0 && !used.has(instanceNameKey(typeName))) return typeName
    for (let n = Math.max(2, taken.length + 1); n < NAME_SEARCH_LIMIT; n += 1) {
        const candidate = `${typeName} ${n}`
        if (!used.has(instanceNameKey(candidate))) return candidate
    }
    return `${typeName} ${taken.length + NAME_SEARCH_LIMIT}`
}

/** The first free handle of an agent: the base, then base-2, base-3... */
export const freeHandle = (base: string, used: ReadonlySet<string>): string =>
    [base, ...Array.from({ length: HANDLE_LIMIT }, (_, n) => `${base}-${n + 2}`)].find(
        (candidate) => !used.has(candidate),
    ) ?? `${base}-${used.size + HANDLE_LIMIT}`

/** The agent display name as the owner typed it, clipped to its limit. */
export const agentNameOf = (name: string): string => name.trim().slice(0, AGENT_NAME_LIMITS.max)

/** The default rules installing a module grants to a workspace: one per action of the module. */
export const defaultRulesOf = (module: ModuleDefinition): ReadonlyArray<DefaultRule> =>
    module.authorityActions.map((action) => ({
        action: action.action,
        mode: action.mode,
        limit_vnd: action.limitVnd,
        required_fields: action.requiredFields,
    }))

/** The value of a setting as the owner typed it; null removes the setting. */
export type SettingValue = string | number | null

/** One setting of an installation a change writes: the name and the value (null removes it). */
export interface SettingChange {
    /** The setting. */
    readonly name: "openclawTimeoutSec" | "holdingMessage"
    /** The value; null removes the setting. */
    readonly value: SettingValue
}

/** The setting a name and a raw value stand for, or null when the value is outside its limits. */
export const settingOf = (name: string, value: SettingValue): SettingChange | null => {
    if (name === "openclawTimeoutSec") {
        const seconds = Math.round(Number(value))
        return seconds >= TIMEOUT_RANGE.min && seconds <= TIMEOUT_RANGE.max ? { name, value: seconds } : null
    }
    if (name !== "holdingMessage" || typeof value !== "string") return null
    const text = value.trim().slice(0, HOLDING_MAX)
    return { name, value: text === "" ? null : text }
}

/** The settings with one change laid over them; a null value removes the setting. */
export const withSetting = (
    settings: Readonly<Record<string, unknown>>,
    change: SettingChange,
): Readonly<Record<string, unknown>> =>
    Object.fromEntries(Object.entries({ ...settings, [change.name]: change.value }).filter(([, kept]) => kept !== null))
