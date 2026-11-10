/** The headers an earlier link put on the operation context; anything that is not a header object carries none. */
export const headersOf = (value: unknown): Record<string, string> => {
    const kept: Record<string, string> = {}
    if (typeof value !== "object" || value === null) return kept
    for (const [name, header] of Object.entries(value)) if (typeof header === "string") kept[name] = header
    return kept
}
