import { isRecord } from "@modules/platform/primitives"

/** The id of one row a `returning id` statement answered. */
export interface ReturnedId {
    /** The row id. */
    readonly id: string
}

/** The id rows a `returning id` statement answered; a result that is not a list, or a row without a text id, yields none. */
export const returnedIdRows = (raw: unknown): Array<ReturnedId> => {
    const rows: ReadonlyArray<unknown> = Array.isArray(raw) ? raw : []
    return rows.flatMap((row) => (isRecord(row) && typeof row.id === "string" ? [{ id: row.id }] : []))
}
