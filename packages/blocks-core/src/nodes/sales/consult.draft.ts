import { z } from "zod"
import { MAX_ID } from "../../bounds"
import type { NodeSchema } from "../node-schema.types"

/** One line of the order draft the consult settles: a catalogue item by id and how many. Prices are never the agent's. */
export interface DraftLine {
    /** The catalogue item the customer picked. */
    readonly catalogueItemId: string
    /** How many of it. */
    readonly quantity: number
}

/** The most lines one order draft holds. */
export const DRAFT_LINES_MAX = 50

/** The most of one item a line orders. */
const QUANTITY_MAX = 10_000

/** One line of the order draft. */
export const draftLineSchema: NodeSchema<DraftLine> = z.object({
    catalogueItemId: z.string().min(1).max(MAX_ID).describe("The id of the catalogue item, as `catalogue` lists it"),
    quantity: z.number().int().positive().max(QUANTITY_MAX).describe("How many of the item the customer wants"),
})
