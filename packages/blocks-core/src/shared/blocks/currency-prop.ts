import { z } from "zod"

/** The currency code a prop names: three capital letters, as ISO 4217 writes it. */
export const currencyCode: z.ZodString = z
    .string()
    .length(3)
    .regex(/^[A-Z]+$/)
