import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { type PayInstructOutput, type PayInstructTold, payInstructOutputSchema, payInstructToldShape } from "./pay-instruct.node"
import { PURCHASE } from "./websales.fixtures"
import { websalesText } from "../../modules/websales/copy"

/** What the merge takes: the output of the chat variant and of the mail variant; exactly one of them is not skipped. */
const input: z.ZodType<{ readonly chat: PayInstructOutput; readonly mail: PayInstructOutput }> = z.object({
    chat: payInstructOutputSchema,
    mail: payInstructOutputSchema,
})

const output: z.ZodType<PayInstructTold> = z.object(payInstructToldShape)

const NONE = { channel: null, messageRef: null, declined: false } as const
const CHAT = {
    ...PURCHASE,
    customerCode: "KH-0042",
    by: "conversation",
    channel: "zalo",
    messageRef: "msg-21",
    declined: false,
} as const
const MAIL = {
    ...PURCHASE,
    customerCode: "KH-0042",
    by: "mail",
    channel: "email",
    messageRef: "work-21",
    declined: false,
} as const
const CHAT_SKIPPED = { ...PURCHASE, customerCode: "KH-0042", by: "mail", ...NONE } as const
const MAIL_SKIPPED = { ...PURCHASE, customerCode: "KH-0042", by: "conversation", ...NONE } as const

/**
 * `websales.pay-instruct-told` (the customer told how to pay): the merge of the two sends of `websales.pay-instruct` and
 * `websales.pay-instruct-mail`, one of which was skipped (the reach was the other's channel). It returns the output of the one that was
 * not skipped (both skipped: the chat's), so the graph's later steps read ONE step. No tool, no AI.
 */
export const websalesPayInstructToldNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "websales.pay-instruct-told",
    title: websalesText("node.pay-instruct-told.title"),
    description: {
        vi: "Gom hai lần báo cách thanh toán (cuộc trò chuyện, thư) thành một kết quả: lần không bị bỏ qua.",
        en: "Merges the two ways of telling how to pay (conversation, mail) into one result: the one that was not skipped.",
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
            name: "the customer was told in the conversation: the chat's result",
            params: {},
            input: { chat: { ...CHAT, skipped: false }, mail: { ...MAIL_SKIPPED, skipped: true } },
            output: CHAT,
        },
        {
            name: "the customer was told by mail: the mail's result",
            params: {},
            input: { chat: { ...CHAT_SKIPPED, skipped: true }, mail: { ...MAIL, skipped: false } },
            output: MAIL,
        },
    ],
})
