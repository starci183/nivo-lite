import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { answered, refused } from "../web-answers"
import { TEXT_MAX, intakeTicketId } from "./desk-shapes"
import type { MailReply } from "./plan.node"
import { webdeskText } from "../../modules/webdesk/copy"

/**
 * The sender the reply goes to, the reply the plan wrote (null when the plan wrote none: a mail with no sender's address), and the
 * ticket it is about.
 */
export interface MailReplyDraftInput {
    /** The recipient's address. */
    readonly to: string
    /** The reply to draft; null when none was composed. */
    readonly reply?: MailReply | null | undefined
    /** Null only on an item the graph ended `declined` before this step (`intakeTicketId`): then nothing is drafted. */
    readonly ticketId: string | null
}

/** Whether the reply was handed to a person to send, and the refusal when it was not. */
export interface MailReplyDraftOutput {
    /** True when the draft was saved. */
    readonly drafted: boolean
    /** Why the provider refused the call; null when it did not refuse. */
    readonly refusal: string | null
}

type NoParams = Record<string, never>

/** The kind of record the mail is about, as the draft shows it to the person who sends it. */
const REF_KIND = "ticket"

const params: z.ZodType<NoParams> = z.strictObject({})
const input: z.ZodType<MailReplyDraftInput> = z.object({
    to: z.string().max(400),
    reply: z.object({ subject: z.string().min(1).max(400), text: z.string().min(1).max(TEXT_MAX) }).nullish(),
    ticketId: intakeTicketId,
})
const output: z.ZodType<MailReplyDraftOutput> = z.object({
    drafted: z.boolean(),
    refusal: z.string().max(200).nullable(),
})

const DRAFT =
    "Chao anh/chi, ben em da ghi nhan yeu cau voi ma phieu TK-0002. Ky thuat dang kiem tra va se bao lai anh/chi ngay khi co ket qua."

const REPLY: MailReply = { subject: "Re: Web loi 500", text: DRAFT }

const SEND_ARGS = {
    to: "khach@example.com",
    subject: "Re: Web loi 500",
    body: DRAFT,
    ref: { kind: REF_KIND, code: "TK-0002" },
}

/**
 * `webdesk.mail-reply-draft` (Draft the mail reply): a side step split from `webdesk.mail-plan`. One call of the mail send with the reply
 * the plan wrote and the ticket it is about (`ref`); the send never mails by itself: it answers at once with the draft a person reads,
 * sends (the mail tool's own behaviour; it replaces the `send_email` work item), and its mode is `auto`. No AI call.
 * A side step (`blocking: false`): without an SMTP account it is skipped and named on the agent page; a refusal is said in its output
 * and the ticket's note still follows; a person's `declined` of the draft is such a refusal (DECLINED rule 3: no notice, no outcome).
 * With no reply written, or no ticket, there is nothing to draft (exact checks).
 */
export const webdeskMailReplyDraftNode: TemplateNode<
    z.ZodType<MailReplyDraftInput>,
    z.ZodType<MailReplyDraftOutput>,
    z.ZodType<NoParams>
> = defineTemplateNode({
    id: "webdesk.mail-reply-draft",
    title: webdeskText("node.mail-reply-draft.title"),
    description: { vi: "So\u1ea1n th\u01b0 tr\u1ea3 l\u1eddi ng\u01b0\u1eddi g\u1eedi \u0111\u1ec3 ng\u01b0\u1eddi ph\u1ee5 tr\u00e1ch duy\u1ec7t tr\u01b0\u1edbc khi g\u1eedi.", en: "Drafts the reply to the sender for the person in charge to approve before it is sent." },
    tools: [TOOL.mailMessageSend],
    mode: "auto",
    accounts: [PROVIDER.smtp],
    params,
    input,
    output,
    blocking: false,
    sensitive: { to: "pii", reply: "pii" },
    run: async (given, context) => {
        if (given.reply === null || given.reply === undefined) return { drafted: false, refusal: null }
        if (given.ticketId === null) return { drafted: false, refusal: null }
        const drafted = await context.tools.call(TOOL.mailMessageSend, {
            to: given.to,
            subject: given.reply.subject,
            body: given.reply.text,
            ref: { kind: REF_KIND, code: given.ticketId },
        })
        return drafted.ok ? { drafted: true, refusal: null } : { drafted: false, refusal: drafted.declined === true ? "declined" : drafted.refusal }
    },
    examples: [
        {
            name: "hands the drafted reply about the ticket to a person, who sends it",
            params: {},
            input: { to: "khach@example.com", reply: REPLY, ticketId: "TK-0002" },
            tools: [
                {
                    id: TOOL.mailMessageSend,
                    args: SEND_ARGS,
                    answer: answered({ emailMessageId: "wi-1", status: "sent" }),
                },
            ],
            output: { drafted: true, refusal: null },
        },
        {
            name: "a declined draft is said in the output; the ticket goes on",
            params: {},
            input: { to: "khach@example.com", reply: REPLY, ticketId: "TK-0002" },
            tools: [{ id: TOOL.mailMessageSend, args: SEND_ARGS, answer: refused("declined") }],
            output: { drafted: false, refusal: "declined" },
        },
        {
            name: "no reply written (no sender's address): nothing is drafted",
            params: {},
            input: { to: "", reply: null, ticketId: "TK-0002" },
            output: { drafted: false, refusal: null },
        },
    ],
})
