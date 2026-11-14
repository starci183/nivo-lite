import { LanggraphError, LanggraphErrorCode } from "./errors/langgraph.error"

/** True for an object made by a literal or by `Object.create(null)`: the only objects a checkpoint stores and reads back the same. */
const isLiteral = (value: object): boolean => {
    const proto: unknown = Object.getPrototypeOf(value)
    return proto === Object.prototype || proto === null
}

/** The first place under `value` that JSON would not carry as it is, or null when all of it is plain. */
const flawOf = (value: unknown, at: string, seen: ReadonlySet<object>): string | null => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return null
    if (typeof value === "number") return Number.isFinite(value) ? null : at
    if (typeof value !== "object" || seen.has(value)) return at
    const below = new Set(seen).add(value)
    if (Array.isArray(value)) return firstFlaw(value.map((item, index) => [`${at}[${index}]`, item]), below)
    if (!isLiteral(value)) return at
    const members = Object.entries(value).filter(([, item]) => item !== undefined)
    return firstFlaw(members.map(([key, item]) => [`${at}.${key}`, item]), below)
}

/** The first flaw among the children of a value, each given with the place that names it; null when all are plain. */
const firstFlaw = (children: ReadonlyArray<readonly [string, unknown]>, below: ReadonlySet<object>): string | null => {
    for (const [place, child] of children) {
        const flaw = flawOf(child, place, below)
        if (flaw !== null) return flaw
    }
    return null
}

/**
 * Refuses a value a checkpoint cannot store and read back the same: a class instance (a Date, a Map, an Error), a function, a
 * bigint, a symbol, a number that is not finite, an `undefined` inside a list, or a cycle. An `undefined` field is allowed, as JSON
 * drops it. `at` names the value in the error (`state.trouble`, `stop.question`), never its content.
 */
export const requirePlain = (value: unknown, at: string): void => {
    const flaw = flawOf(value, at, new Set())
    if (flaw !== null) throw new LanggraphError({ code: LanggraphErrorCode.NotPlain, params: { at: flaw } })
}
