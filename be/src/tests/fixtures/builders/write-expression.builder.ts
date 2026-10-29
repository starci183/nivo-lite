/** The SQL text of the expression a write hands the database for `key` (a `() => "now()"` style value); undefined when the value is none. */
export const writeExpressionOf = (written: unknown, key: string): string | undefined => {
    if (typeof written !== "object" || written === null) return undefined
    const value: unknown = Object.entries(written).find(([name]) => name === key)?.[1]
    if (typeof value !== "function") return undefined
    const text: unknown = Reflect.apply(value, undefined, [])
    return typeof text === "string" ? text : undefined
}
