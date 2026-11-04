/** The identifiers an insert answers with, one record for each row. */
export type InsertedIdentifiers = ReadonlyArray<Record<string, unknown>>

/** The id of the first row an insert answered with, or an empty text when it answered none: no row has an empty id, so a lookup by it finds nothing. */
export const insertedId = (identifiers: InsertedIdentifiers): string => {
    const id = identifiers[0]?.["id"]
    return typeof id === "string" ? id : ""
}
