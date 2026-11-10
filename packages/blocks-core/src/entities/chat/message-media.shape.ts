import { z } from "zod"
import type { ZodType } from "zod"

import { MAX_BODY, MAX_ID, MAX_LINE } from "../../bounds"
import type { LineFile, LineOrder } from "../../rules/chatbot/message-line"

/** The most pictures and files one line carries (an album, a payment QR). */
export const MAX_LINE_FILES = 10

/** The most ordered items an order card of a line shows. */
export const MAX_ORDER_ITEMS = 50

/** The pictures and files of a line, held in an object (a jsonb field is an object, never a bare list). */
export type MessageFilesShape = {
    /** The pictures and files, in the order the customer saw them. */
    readonly items: ReadonlyArray<LineFile>
}

/** The order a line is about, as a plain object type (a jsonb shape is a record). */
export type MessageOrderShape = { readonly [K in keyof LineOrder]: LineOrder[K] }

const lineFile: ZodType<LineFile> = z.object({
    id: z.string().max(MAX_ID),
    url: z.string().max(MAX_BODY),
    name: z.string().max(MAX_LINE),
    contentType: z.string().max(MAX_LINE),
})

/** The declared shape of `files` of a `chat.message`: `{ items: [{ id, url, name, contentType }] }`. */
export const messageFilesShape: ZodType<MessageFilesShape> = z.object({
    items: z.array(lineFile).max(MAX_LINE_FILES),
})

/** The declared shape of `orderCard` of a `chat.message`: the order the line is about, as the customer saw it. */
export const messageOrderShape: ZodType<MessageOrderShape> = z.object({
    orderNo: z.string().max(MAX_LINE),
    lines: z
        .array(
            z.object({
                name: z.string().max(MAX_LINE),
                qty: z.number(),
                unitText: z.string().max(MAX_LINE).optional(),
                amountText: z.string().max(MAX_LINE).optional(),
                imageUrl: z.string().max(MAX_BODY).nullable().optional(),
            }),
        )
        .max(MAX_ORDER_ITEMS),
    amountText: z.string().max(MAX_LINE),
    address: z.string().max(MAX_LINE),
    paid: z.boolean(),
})
