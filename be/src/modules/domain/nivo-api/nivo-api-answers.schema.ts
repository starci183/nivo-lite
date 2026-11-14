import { z } from "zod"
import { LIST_ROWS_MAX } from "@modules/platform/database"
import { parseJsonText } from "@modules/platform/primitives"

/**
 * The most characters of a door's JSON answer: no store bounds the text a workbench door answers, so a generous ceiling that only keeps
 * an answer finite (sixty-four million, beyond any row the doors admit).
 */
const DOOR_JSON_MAX = 67_108_864

/** An opaque page cursor (the bound the ops declare for it). */
const CURSOR_MAX = 512

/** A door's answer: JSON text in its `data` member, read as the data it holds. */
export const doorDataSchema: z.ZodType<unknown> = z.looseObject({ data: z.string().max(DOOR_JSON_MAX) }).transform((answer, context) => {
    const read = parseJsonText(answer.data)
    if (read.ok) return read.value
    context.issues.push({ code: "custom", message: "The door answered JSON text that does not parse.", input: answer.data })
    return z.NEVER
})

/** A page of a /chat thread's messages, as its members read: the messages and the cursor of the next page. */
export const chatPageSchema: z.ZodType<unknown> = z
    .looseObject({
        nodes: z.array(z.looseObject({})).max(LIST_ROWS_MAX),
        hasNextPage: z.boolean(),
        endCursor: z.string().max(CURSOR_MAX).nullable(),
    })
    .transform((page) => ({ messages: page.nodes, next: page.hasNextPage ? page.endCursor : null }))
