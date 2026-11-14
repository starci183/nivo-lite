import { z } from "zod"
import { MAX_LINE } from "../../../shared/bounds"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"

/** A date the customer cares about, as the consult heard it: whose and what, and the day. */
export interface SaidOccasion {
    /** Whose and what, in the customer's words ("Lan's birthday"). */
    readonly label: string
    /** The day: `MM-DD` for a yearly date, `YYYY-MM-DD` for a one-off. */
    readonly date: string
}

/** The most occasions one turn hands on. */
export const OCCASIONS_MAX = 10

/** The format of an occasion's day: `MM-DD`, or `YYYY-MM-DD` for a one-off (a format check, never a reading of meaning). */
const OCCASION_DATE = /^(\d{4}-)?\d{2}-\d{2}$/u

/** One occasion the customer mentioned. */
export const saidOccasionSchema: NodeSchema<SaidOccasion> = z.object({
    label: z.string().min(1).max(MAX_LINE).describe("Whose and what, in the customer's words"),
    date: z.string().max(10).regex(OCCASION_DATE).describe('"MM-DD" for a yearly date, "YYYY-MM-DD" for a one-off'),
})
