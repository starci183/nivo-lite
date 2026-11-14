import { z } from "zod"
import { isMailAddress } from "@modules/domain/email-messages"
import type { ToolJson } from "@modules/domain/tools"

/** The longest subject a mail keeps (as the workspace mailer cuts it). */
export const MAIL_SUBJECT_MAX = 200

/** The longest kind and code of the record a mail is about. */
const REF_KIND_MAX = 60
const REF_CODE_MAX = 200

/** The longest body a drafted mail carries. */
const MAIL_BODY_MAX = 20_000

const shape = {
    to: z.string().trim().min(3).max(320).refine(isMailAddress).describe("The recipient's mail address, one."),
    subject: z.string().trim().min(1).max(MAIL_SUBJECT_MAX).describe("The subject line."),
    body: z
        .string()
        .min(1)
        .max(MAIL_BODY_MAX)
        .describe("The plain text of the mail, as the customer reads it."),
    leadId: z.string().min(1).max(200).optional().describe("The customer the mail is about, when it is about one."),
    ref: z
        .object({
            kind: z
                .string()
                .trim()
                .min(1)
                .max(REF_KIND_MAX)
                .describe("The kind of business record the mail is about (an invoice, a renewal)."),
            code: z.string().trim().min(1).max(REF_CODE_MAX).describe("Its code or id, as the record names it."),
        })
        .strict()
        .optional()
        .describe("The business record the mail is about, carried onto the send so the ledger shows what it was for."),
}

const mailSendSchema = z.object(shape).strict()

/** The validator of the send on the gateway. */
export const MAIL_SEND_SCHEMA: typeof mailSendSchema = mailSendSchema

/**
 * The arguments of `nivo.tool.mail.message.send`: who (`to`), the subject, the plain body, the customer, and
 * the business record it is about (`ref`).
 */
export type MailSendArguments = z.output<typeof mailSendSchema>

/** The schema the manifest advertises. */
export const MAIL_SEND_INPUT_SCHEMA: ToolJson = z.toJSONSchema(z.object(shape).strict(), { io: "input" })
