import { z } from "zod"

/** The longest name a prop gives to a spec param. */
export const PARAM_NAME_MAX = 32

/** The name of a spec param a prop refers to: a word of letters, digits and underscores that starts with a letter. */
export const paramName: z.ZodString = z
    .string()
    .regex(/^[A-Za-z]\w*$/)
    .max(PARAM_NAME_MAX)
