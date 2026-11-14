/** The value at a dotted path of a record; undefined when any step is missing. */
export const valueAt = (record: unknown, path: string | undefined): unknown => {
    if (path === undefined || path === "") return record
    return path.split(".").reduce<unknown>((current, step) => {
        if (typeof current !== "object" || current === null) return undefined
        return Reflect.get(current, step)
    }, record)
}

/** A value as the text a block draws: strings and numbers as they are, anything else as nothing. */
export const textOf = (value: unknown): string => {
    if (typeof value === "string") return value
    return typeof value === "number" ? String(value) : ""
}
