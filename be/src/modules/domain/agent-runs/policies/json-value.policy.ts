import type { JsonValue } from "@nivo-lite/agent-sdk/schema"

/** A value read as JSON: what JSON keeps of it, and whether all of it could be kept. */
export interface Jsonish {
    /** The JSON value; null stands for any part that JSON cannot carry. */
    readonly json: JsonValue
    /** False when some part of the value is not JSON. */
    readonly valid: boolean
}

const listOf = (items: ReadonlyArray<unknown>): Jsonish => {
    const read = items.map((item) => jsonValueOf(item))
    return { json: read.map((item) => item.json), valid: read.every((item) => item.valid) }
}

const objectOf = (members: ReadonlyArray<readonly [string, unknown]>): Jsonish => {
    const read = members
        .filter(([, member]) => member !== undefined)
        .map(([key, member]) => [key, jsonValueOf(member)] as const)
    return {
        json: Object.fromEntries(read.map(([key, member]) => [key, member.json])),
        valid: read.every(([, member]) => member.valid),
    }
}

/** Reads a value as JSON: scalars, arrays and plain objects, an `undefined` member left out. */
export const jsonValueOf = (value: unknown): Jsonish => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return { json: value, valid: true }
    if (typeof value === "number")
        return Number.isFinite(value) ? { json: value, valid: true } : { json: null, valid: false }
    if (typeof value !== "object") return { json: null, valid: false }
    return Array.isArray(value) ? listOf(value) : objectOf(Object.entries(value))
}
