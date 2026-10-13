import { InventoryError } from "../errors/inventory.error"
import type { InventoryErrorCode } from "../errors/inventory.error"

/** The row a write function answers: the id of the row it wrote, or null when the row to change is missing. */
export interface IdRow {
    /** The id of the written row, or null when the row to change is missing. */
    readonly id: string | null
}

/** The id a write answered; a refusal with the given code when the database answered no id. */
export const savedId = async (rows: Promise<Array<IdRow>>, notFound: InventoryErrorCode): Promise<string> => {
    const [row] = await rows
    if (row?.id === null || row?.id === undefined) throw new InventoryError({ code: notFound })
    return row.id
}
