import { z } from "zod"
import { MAX_LINE } from "../../../shared/bounds"
import { PRICE_SOURCE_SHAPE, type PriceSource } from "../entities/order.entity"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"

/**
 * One line of the order draft the consult settles: what the customer picked, how many, and the price of one as the shop's truth states it
 * (the customer was told that price). The total is never the agent's: the order step sums the lines exactly.
 */
export interface DraftLine {
    /** What the customer picked, named as the shop's truth names it. */
    readonly name: string
    /** How many of it. */
    readonly quantity: number
    /** The price of one, VND: the fact's number when the line names one of `prices` (copied by the step), else as the truth the agent read states it. */
    readonly unitVnd: number
    /** The price's source: `{ kind: "fact", id }` of the fact in `prices` the line is priced from; absent or null for a price read in a passage. */
    readonly priceSource?: PriceSource | null | undefined
}

/** The most lines one order draft holds. */
export const DRAFT_LINES_MAX = 50

/** The most of one item a line orders. */
const QUANTITY_MAX = 10_000

/** The highest price of one a line takes, VND. */
const UNIT_MAX = 1_000_000_000

/** One line of the order draft. */
export const draftLineSchema: NodeSchema<DraftLine> = z.object({
    name: z.string().min(1).max(MAX_LINE).describe("What the customer picked, named as the shop's truth names it"),
    quantity: z.number().int().positive().max(QUANTITY_MAX).describe("How many of it the customer wants"),
    unitVnd: z
        .number()
        .int()
        .min(0)
        .max(UNIT_MAX)
        .describe(
            "The price of one in VND: the `num` of the fact in `prices` when the line is priced from one, else exactly as a truth or passage you read states it",
        ),
    priceSource: PRICE_SOURCE_SHAPE.nullable()
        .optional()
        .describe(
            "`{ kind: \"fact\", id }` with the id of the fact in `prices` this line is priced from; null or left out when no fact in `prices` states the price",
        ),
})
