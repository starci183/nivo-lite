import type { ModuleKey } from "@/modules/catalog"
import type { Installation } from "./installations.types"

const NAME_MAX = 80
const NAME_SEARCH_LIMIT = 1000

/** Case-insensitive, trimmed key of an instance name (the database enforces unique (workspace, type, lower(name))). */
export const instanceNameKey = (name: string): string => name.trim().toLowerCase()

/**
 * The suggested name of a new instance of a type: the type name for the first one, then "<type> 2", "<type> 3"... (the next number
 * after the instances that exist, skipping any name already taken, case-insensitive).
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

/** A clean instance name, or null when it is too short or too long (1-80 characters after trimming, as in the database). */
export const cleanInstanceName = (name: string): string | null => {
    const clean = name.replace(/\s+/g, " ").trim()
    return clean.length >= 1 && clean.length <= NAME_MAX ? clean : null
}

/** The instances of one type, oldest first (the first is what type-level callers mean by "the" installation). */
export const instancesOf = <T extends Pick<Installation, "moduleKey" | "createdAt">>(
    installations: ReadonlyArray<T>,
    moduleKey: ModuleKey,
): Array<T> =>
    installations.filter((i) => i.moduleKey === moduleKey).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

/** Whether an instance shows its own name: when the type has several, or it was renamed. */
export const showsInstanceName = (i: Pick<Installation, "isMulti" | "name">, typeName: string): boolean =>
    i.isMulti || instanceNameKey(i.name) !== instanceNameKey(typeName)

/** The parts of an agent that decide how it is named. */
export type AgentNameParts = { readonly name: string; readonly instance_name?: string | null }

/**
 * How an agent is named in lists, Office and mentions: "<agent name> - <instance>" when it drives a named instance of a
 * multi-instance type (and the two differ), else its own name.
 */
export const agentDisplayName = (a: AgentNameParts): string =>
    a.instance_name && instanceNameKey(a.instance_name) !== instanceNameKey(a.name)
        ? `${a.name} – ${a.instance_name}`
        : a.name
