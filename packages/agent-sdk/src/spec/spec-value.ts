import type { ReadVariables } from "../block/block.types"
import { isRecord } from "../schema/is-record"

/** The variable a read writes for the installation of the route. */
export const INSTALLATION_VARIABLE = "$installationId"

/** The value at a dotted path of a value; undefined when a step is missing. The empty or absent path is the value itself. */
export const valueAt = (value: unknown, path: string | undefined): unknown => {
    if (path === undefined || path === "") return value
    let current: unknown = value
    for (const name of path.split(".")) {
        if (!isRecord(current)) return undefined
        current = current[name]
    }
    return current
}

/** A value as the text a block draws: strings and finite numbers as they are, anything else empty. */
export const textOf = (value: unknown): string => {
    if (typeof value === "string") return value
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    return ""
}

/** The variables of a read with the route installation put in. */
export const variablesOf = (variables: ReadVariables | undefined, installationId: string): ReadVariables =>
    Object.fromEntries(
        Object.entries(variables ?? {}).map(([name, value]) => [
            name,
            value === INSTALLATION_VARIABLE ? installationId : value,
        ]),
    )
