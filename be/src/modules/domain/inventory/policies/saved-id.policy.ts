import { InventoryError } from "../errors/inventory.error"
import type { InventoryErrorCode } from "../errors/inventory.error"

/** The row a write function answers: the id of the row it wrote, or null when the row to change is missing. */
export interface IdRow {
    /** The id of the written row, or null when the row to change is missing. */
    readonly id: string | null
}

/** The rows of a scalar database function: one column named after the function. */
export type FunctionRows = ReadonlyArray<Readonly<Record<string, string | null | undefined>>>

/** Renames the column a scalar function answers (named after the function) to `id`. */
export const idColumn = async (rows: Promise<FunctionRows>, column: string): Promise<ReadonlyArray<IdRow>> =>
    (await rows).map((row) => ({ id: row[column] ?? null }))

/** The id a write answered; a refusal with the given code when the database answered no id. */
export const savedId = async (rows: Promise<ReadonlyArray<IdRow>>, notFound: InventoryErrorCode): Promise<string> => {
    const [row] = await rows
    if (row?.id === null || row?.id === undefined) throw new InventoryError({ code: notFound })
    return row.id
}
