import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { RENEWAL_ID, ZALO } from "./webrenew.examples"
import { MAIL_CHANNEL } from "./webrenew.calls"
import { ANSWER_SERVICES_MAX, ID_MAX, channelSchema } from "./renew-shapes"
import { type QuoteTellOutput, quoteTellOutputSchema } from "./quote-tell.node"
import { webrenewText } from "../../modules/webrenew/copy"

/** What the quote told: what `webrenew.quote-tell` returned before it was split by channel (no `skipped`). */
export type QuoteToldOutput = Omit<QuoteTellOutput, "skipped">

/** What the merge takes: the output of the chat variant and of the mail variant; at most one of them is skipped. */
const input: z.ZodType<{ readonly chat: QuoteTellOutput; readonly mail: QuoteTellOutput }> = z.object({
    chat: quoteTellOutputSchema,
    mail: quoteTellOutputSchema,
})

const output: z.ZodType<QuoteToldOutput> = z.object({
    declined: z.boolean(),
    renewalIds: z.array(z.uuid()).max(ANSWER_SERVICES_MAX),
    serviceCodes: z.array(z.string().min(1).max(120)).max(ANSWER_SERVICES_MAX),
    channel: channelSchema,
    messageRef: z.string().min(1).max(ID_MAX).nullable(),
})

const NONE = { declined: false, renewalIds: [], serviceCodes: [], channel: null, messageRef: null } as const
const CHAT = {
    declined: false,
    renewalIds: [RENEWAL_ID],
    serviceCodes: ["EXAMPLE-TM"],
    channel: ZALO,
    messageRef: "msg-2",
} as const
const MAIL = {
    declined: false,
    renewalIds: [RENEWAL_ID],
    serviceCodes: ["EXAMPLE-TM"],
    channel: MAIL_CHANNEL,
    messageRef: "draft-2",
} as const

/**
 * `webrenew.quote-told` (the quote told): the merge of the two sends of `webrenew.quote-tell` and `webrenew.quote-tell-mail`, one of
 * which was skipped (the reach was the other's channel). It returns the output of the chat variant unless that was skipped, then the
 * mail's (both skipped: the chat's), so the graph's later steps read ONE step. When every request was declined both variants answer
 * `declined` true and the chat's is taken (the mail's is skipped). No tool, no AI.
 */
export const webrenewQuoteToldNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "webrenew.quote-told",
    title: webrenewText("node.quoteTold.title"),
    description: {
        vi: "Gom hai lần báo giá (cuộc trò chuyện, thư) thành một kết quả: lần không bị bỏ qua.",
        en: "Merges the two ways of telling the quote (conversation, mail) into one result: the one that was not skipped.",
    },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: async (given) => {
        const { skipped: _skipped, ...told } = given.chat.skipped && !given.mail.skipped ? given.mail : given.chat
        return told
    },
    examples: [
        {
            name: "the quote was told in the conversation: the chat's result",
            params: {},
            input: { chat: { ...CHAT, skipped: false }, mail: { ...NONE, skipped: true } },
            output: CHAT,
        },
        {
            name: "the quote was told by mail: the mail's result",
            params: {},
            input: { chat: { ...NONE, skipped: true }, mail: { ...MAIL, skipped: false } },
            output: MAIL,
        },
        {
            name: "every request was declined: both say `declined`, the chat's is taken",
            params: {},
            input: { chat: { ...NONE, declined: true, skipped: false }, mail: { ...NONE, declined: true, skipped: true } },
            output: { ...NONE, declined: true },
        },
    ],
})
