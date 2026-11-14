import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { BODY_MAX } from "./books-shapes"

/*
 * The customer mail of the Accounting steps. It replaces the `send_email` work item: the agent WRITES the mail
 * (or decides none, ADDENDUM 10) and the node makes its one write, `TOOL.mailMessageSend` on provider `smtp`, in the node's own mode (`auto`; the
 * mail tool raises the draft a person reads, edits and sends). The arguments are the tool's own (`{ to, subject, body, ref }`, the
 * record the mail is about carried onto the send); its answer is the recorded send (`{ emailMessageId, status: "sent" }`).
 */

/** The mail the agent writes, addressed to the address the CRM answered. */
export interface CustomerMail {
    /** The customer's e-mail, exactly as the CRM answered it. */
    readonly to: string
    /** The subject, in the customer's language. */
    readonly subject: string
    /** The plain body, in the customer's language. */
    readonly body: string
}

/** The schema of the mail the agent writes; null when no mail goes. */
export const customerMailSchema: z.ZodType<CustomerMail | null> = z
    .object({
        to: z.string().min(3).max(320).describe("The customer's e-mail exactly as the CRM answered it."),
        subject: z.string().min(1).max(200).describe("The subject, in the customer's language."),
        body: z.string().min(1).max(BODY_MAX).describe("The plain body, in the customer's language."),
    })
    .nullable()

/**
 * What became of the mail: the reference the send answered, or the refusal it gave (the person declined, the address bounced).
 */
export interface MailResult {
    /** The reference the provider gave the message sent or drafted; null when nothing was sent. */
    readonly messageRef: string | null
    /** Why the provider refused the call; null when it did not refuse. */
    readonly refusal: string | null
}

/** The business record a mail is about (`ref` of the send): its kind and its code, as the record names it. */
export interface MailAbout {
    /** `project` (a receivable notice), `invoice` (an issued invoice). */
    readonly kind: "project" | "invoice"
    /** Its code. */
    readonly code: string
}

/** The args of the send (also what an example asserts). */
export const mailArgsOf = (mail: CustomerMail, about: MailAbout): JsonObject => ({
    to: mail.to,
    subject: mail.subject,
    body: mail.body,
    ref: { kind: about.kind, code: about.code },
})

/**
 * Sends the mail (on `auto` the call sends it; on a shop's own `ask` the engine asked first) and reads its answer or its refusal, in code: the
 * send's `emailMessageId` is the reference; a refusal (a shop's own `ask` declined included) is answered as a fact.
 */
export const sendCustomerMail = async (ctx: NodeContext, mail: CustomerMail, about: MailAbout): Promise<MailResult> => {
    const sent = await ctx.tools.call(TOOL.mailMessageSend, mailArgsOf(mail, about))
    if (!sent.ok) return { messageRef: null, refusal: sent.declined === true ? "declined" : sent.refusal }
    const emailMessageId = sent.value["emailMessageId"]
    return { messageRef: typeof emailMessageId === "string" ? emailMessageId : null, refusal: null }
}
