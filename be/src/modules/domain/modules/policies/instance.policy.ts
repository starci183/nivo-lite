import type { DefaultRule } from "@modules/domain/authority-rules"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { ModuleDefinition } from "../modules.contracts"
import { workingHoursOf, workingHoursTextOf } from "./working-hours.policy"

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
    readonly name: "openclawTimeoutSec" | "holdingMessage" | "workingHours"
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
    if (name === "openclawTimeoutSec") {
        const seconds = Math.round(Number(value))
        return seconds >= TIMEOUT_RANGE.min && seconds <= TIMEOUT_RANGE.max ? { name, value: seconds } : null
    }
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

/** One tag right: the agent `from` may tag the agent `to`. */
export interface TagGrant {
    /** The agent that tags. */
    readonly from: string
    /** The agent that is tagged. */
    readonly to: string
}

/** A live agent of the workspace and the module it belongs to. */
export interface TagPeer {
    /** The agent. */
    readonly agentId: string
    /** The module key of its installation. */
    readonly moduleKey: string
}

/**
 * The tag rights installing an agent of `module` grants: the new agent may tag the peers its module lists, and the peers whose
 * module lists this one may tag it. A module that lists nobody grants nothing, and an agent never tags itself.
 */
export const tagGrantsOf = (
    module: ModuleDefinition,
    agentId: string,
    peers: ReadonlyArray<TagPeer>,
    tagsOf: (moduleKey: string) => ReadonlyArray<string>,
): ReadonlyArray<TagGrant> => {
    const others = peers.filter((peer) => peer.agentId !== agentId)
    const outgoing = others
        .filter((peer) => (module.tags ?? []).includes(peer.moduleKey))
        .map((peer): TagGrant => ({ from: agentId, to: peer.agentId }))
    const incoming = others
        .filter((peer) => tagsOf(peer.moduleKey).includes(module.key))
        .map((peer): TagGrant => ({ from: peer.agentId, to: agentId }))
    return [...outgoing, ...incoming]
}
