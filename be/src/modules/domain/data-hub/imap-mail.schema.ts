import { z } from "zod"
import type { ImapMailRow, MailReceivedData } from "./imap-mail.trigger"

/** The longest id, folder name or `Message-ID` the mailbox trigger accepts (the RFC 5322 line limit is 998; folder names stay far below). */
const MAIL_TEXT_MAX = 1000

/** The longest ISO time text the mailbox trigger accepts. */
const MAIL_TIME_MAX = 64

/** The shape of a stored `imap.mail` row the trigger's translate reads. */
export const IMAP_MAIL_ROW_SCHEMA: z.ZodType<ImapMailRow> = z.object({
    externalId: z.string().max(MAIL_TEXT_MAX),
    folder: z.string().max(MAIL_TEXT_MAX),
    uid: z.number(),
    date: z.string().max(MAIL_TIME_MAX).nullable().optional(),
    messageId: z.string().max(MAIL_TEXT_MAX).nullable().optional(),
})

/** The shape of the canonical event's `data`: the mail's id, its folder, its time and its `Message-ID`. */
export const MAIL_RECEIVED_DATA_SCHEMA: z.ZodType<MailReceivedData> = z.object({
    mailId: z.string().min(1).max(MAIL_TEXT_MAX),
    folder: z.string().max(MAIL_TEXT_MAX),
    at: z.string().max(MAIL_TIME_MAX).optional(),
    messageId: z.string().max(MAIL_TEXT_MAX).optional(),
})
