import { z } from "zod"

/** The zod schema of a key, id, label or code: a short string, never longer than 200 characters. */
export const keyText: z.ZodString = z.string().max(200)

/** The zod schema of a sentence or a short paragraph of owner words, never longer than 4000 characters. */
export const prose: z.ZodString = z.string().max(4000)

/** The zod schema of a long body of owner words (instructions, a changelog), never longer than 20000 characters. */
export const body: z.ZodString = z.string().max(20000)
