import { z } from "zod"
import type { ZaloEventRow, ZaloMessageData } from "./zalo-message.trigger"

/** The data schema of a Zalo customer message. */
export const ZALO_MESSAGE_DATA: z.ZodType<ZaloMessageData> = z.object({
    messageKey: z.string(),
    text: z.string(),
    at: z.string().nullable(),
    attachments: z.array(
        z.object({
            kind: z.enum(["image", "file"]),
            url: z.string(),
            thumbnailUrl: z.string(),
            name: z.string(),
            localPath: z.string(),
        }),
    ),
    resume: z.literal("held").optional(),
})

/** The raw schema: the stored `zalo_oa.event` row value. */
export const ZALO_EVENT_ROW: z.ZodType<ZaloEventRow> = z.object({
    eventId: z.string(),
    event: z.string().optional(),
    source: z.string().optional(),
    raw: z.record(z.string(), z.unknown()),
})
