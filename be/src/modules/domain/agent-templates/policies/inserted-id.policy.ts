/** The id of the first row an insert answered with, or an empty text when it answered none: no row has an empty id, so a lookup by it finds nothing. */
export const insertedId = (identifiers: ReadonlyArray<Record<string, unknown>>): string => {
    const id = identifiers[0]?.["id"]
    return typeof id === "string" ? id : ""
}
