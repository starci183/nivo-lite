import type { InstallationRecord } from "@modules/domain/module-installations"
import { workingHoursOf, workingHoursTextOf } from "./working-hours.policy"

const NAME_MAX = 80
const NAME_SEARCH_LIMIT = 1000
const HANDLE_LIMIT = 1000

/** The limits of the display name of an agent. */
export const AGENT_NAME_LIMITS = { min: 2, max: 40 } as const

/** The longest holding message, characters. */
const HOLDING_MAX = 400

/** Case-insensitive, trimmed key of an instance name: the database keeps (workspace, type, lower(name)) unique. */
export const instanceNameKey = (name: string): string => name.trim().toLowerCase()

/** A clean instance name, or null when it is empty or longer than 80 characters after trimming. */
export const cleanInstanceName = (name: string): string | null => {
    const clean = name.replaceAll(/\s+/g, " ").trim()
    return clean.length >= 1 && clean.length <= NAME_MAX ? clean : null
}

/**
 * The suggested name of a new instance: the type name for the first one, then "type 2", "type 3"... (the next number after the instances
 * that exist, skipping any name already taken, case-insensitive).
 */
export const nextInstanceName = (typeName: string, taken: ReadonlyArray<string>): string => {
    const used = new Set(taken.map((name) => instanceNameKey(name)))
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

/** The value of a setting as the owner typed it; null removes the setting. */
export type SettingValue = string | number | null

/** One setting of an installation a change writes: the name and the value (null removes it). */
export interface SettingChange {
    /** The setting. */
    readonly name: "holdingMessage" | "workingHours"
    /** The value; null removes the setting. */
    readonly value: SettingValue
}

/** The working hours as the setting keeps them (the web's JSON text, normalized); null or an empty text removes them. */
const workingHoursSettingOf = (value: SettingValue): SettingChange | null => {
    if (value === null || value === "") return { name: "workingHours", value: null }
    const hours = workingHoursOf(value)
    return hours === null ? null : { name: "workingHours", value: workingHoursTextOf(hours) }
}

/** The setting a name and a raw value stand for, or null when the value is outside its limits. */
export const settingOf = (name: string, value: SettingValue): SettingChange | null => {
    if (name === "workingHours") return workingHoursSettingOf(value)
    if (name !== "holdingMessage" || typeof value !== "string") return null
    const text = value.trim().slice(0, HOLDING_MAX)
    return { name, value: text === "" ? null : text }
}

/** The settings with one change laid over them; a null value removes the setting. */
export const withSetting = (
    settings: InstallationRecord["settings"],
    change: SettingChange,
): InstallationRecord["settings"] =>
    Object.fromEntries(Object.entries({ ...settings, [change.name]: change.value }).filter(([, kept]) => kept !== null))
