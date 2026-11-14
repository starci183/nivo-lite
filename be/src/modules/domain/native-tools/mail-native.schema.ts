import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"

/** What `nivo.tool.mail.message.list` is asked for. */
export type MailListArgs = {
    /** One attached mailbox (its connection id); absent, every mailbox the agent may read, in turn. */
    readonly mailbox?: string | undefined
    /** Read after this point (a `next` an earlier answer gave for `mailbox`) and keep the saved point; absent, read what is new. */
    readonly after?: string | undefined
    /** The most mails in the answer. */
    readonly limit: number
}

/** What `nivo.tool.mail.message.get` is asked for. */
export type MailGetArgs = {
    /** The mail, by the id `nivo.tool.mail.message.list` answered. */
    readonly id: string
    /** The most characters of its text in the answer. */
    readonly maxChars: number
}

/** The bounded arguments of `nivo.tool.mail.message.list`: a point to read after belongs to one mailbox, so it needs that mailbox. */
export const MAIL_LIST_SCHEMA: z.ZodType<MailListArgs> = z
    .object({
        mailbox: z.uuid().optional(),
        after: z.string().min(3).max(120).optional(),
        limit: z.number().int().min(1).max(25).default(10),
    })
    .strict()
    .refine((args) => args.after === undefined || args.mailbox !== undefined, { path: ["after"] })

/** The bounded arguments of `nivo.tool.mail.message.get`. */
export const MAIL_GET_SCHEMA: z.ZodType<MailGetArgs> = z
    .object({
        id: z.uuid(),
        maxChars: z.number().int().min(500).max(12_000).default(4000),
    })
    .strict()

/** The schema `nivo.tool.mail.message.list` announces, generated from its argument validator. */
export const MAIL_LIST_INPUT_SCHEMA: ToolJson = z.toJSONSchema(MAIL_LIST_SCHEMA, { io: "input" })

/** The schema `nivo.tool.mail.message.get` announces, generated from its argument validator. */
export const MAIL_GET_INPUT_SCHEMA: ToolJson = z.toJSONSchema(MAIL_GET_SCHEMA, { io: "input" })
