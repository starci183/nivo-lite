import { z } from "zod"

/** The variables of a read about one period: which one, `this` or `last`; the read says its own default. */
export const periodVariables: z.ZodObject<{ period: z.ZodOptional<z.ZodEnum<{ this: "this"; last: "last" }>> }> =
    z.object({
        period: z.enum(["this", "last"]).optional(),
    })
