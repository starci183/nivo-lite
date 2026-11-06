import type { ReadDefinition, ReadVariables } from "../block/block.types"
import { isTimeToken } from "../block/time-token"
import { isRecord } from "../schema/is-record"
import { z } from "../schema/zod-entry"

/** The variable a read writes for the installation of the route. */
export const INSTALLATION_VARIABLE = "$installationId"

/** The value at a dotted path of a value, a step into a list being its index (`rows.0.title`); undefined when a step is missing. The empty or absent path is the value itself. */
export const valueAt = (value: unknown, path: string | undefined): unknown => {
    if (path === undefined || path === "") return value
    let current: unknown = value
    for (const name of path.split(".")) {
        if (Array.isArray(current)) current = /^\d+$/.test(name) ? current[Number(name)] : undefined
        else if (isRecord(current)) current = current[name]
        else return undefined
    }
    return current
}

/** A value as the text a block draws: strings and finite numbers as they are, anything else empty. */
export const textOf = (value: unknown): string => {
    if (typeof value === "string") return value
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    return ""
}

/**
 * The name of the param a variable value `"$<name>"` refers to; null for any other value, `$installationId` and the time tokens
 * (`$today`, `$thisWeek`, `$thisMonth`: the server resolves them from the clock of the run) included.
 */
export const paramNameOf = (value: unknown): string | null =>
    typeof value === "string" && value.startsWith("$") && value !== INSTALLATION_VARIABLE && !isTimeToken(value)
        ? value.slice(1)
        : null

/** The variables of a read after resolution, and the names of those whose param has no value. */
export interface ResolvedVariables {
    /** Every variable; one whose param has no value is null. */
    readonly variables: ReadVariables
    /** The variables that are null because their param has no value: the read must not run while there are any. */
    readonly pending: ReadonlyArray<string>
}

/**
 * The variables of a read with the route installation put in and each `"$<param>"` replaced by the param's value (the URL value,
 * else its default). A param with no value leaves out a variable the read takes as optional (a search, a filter, a sort: the read
 * runs unfiltered), and leaves any other variable null and lists it as pending, so the read waits (an id to open).
 */
export const resolveVariables = (
    variables: ReadVariables | undefined,
    installationId: string,
    paramValue: (name: string) => string | null,
    isOptional: (variable: string) => boolean = () => false,
): ResolvedVariables => {
    const resolved: Record<string, string | number | boolean | null> = {}
    const pending: Array<string> = []
    for (const [name, value] of Object.entries(variables ?? {})) {
        const param = paramNameOf(value)
        if (param === null) {
            resolved[name] = value === INSTALLATION_VARIABLE ? installationId : value
            continue
        }
        const text = paramValue(param)
        if (text === null && isOptional(name)) continue
        if (text === null) pending.push(name)
        resolved[name] = text
    }
    return { variables: resolved, pending }
}

/** The variables of a read with the route installation put in. */
export const variablesOf = (variables: ReadVariables | undefined, installationId: string): ReadVariables =>
    Object.fromEntries(
        Object.entries(variables ?? {}).map(([name, value]) => [
            name,
            value === INSTALLATION_VARIABLE ? installationId : value,
        ]),
    )

/** Whether a read accepts a variable left out: true for an optional variable of its schema, false for a required or unknown one. */
export const optionalVariable = (read: Pick<ReadDefinition, "variables">, name: string): boolean => {
    const schema = read.variables.shape[name]
    return schema !== undefined && z.safeParse(schema, undefined).success
}
