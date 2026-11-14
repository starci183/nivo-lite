import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { ID_MAX, purchaseRefShape } from "./sales-shapes"
import { PURCHASE } from "./websales.fixtures"
import { type PaidTellOutput, paidTellOutput } from "./paid-tell.node"
import { websalesText } from "../../modules/websales/copy"

/** How the customer was told: what `websales.paid-tell` returned before it was split by channel (no `skipped`). */
export type PaidToldOutput = Omit<PaidTellOutput, "skipped">

/**
 * What the merge takes: the output of the chat variant and of the mail variant; exactly one of them is not skipped. Both are side
 * steps, so a ref to one may read nothing (null) when that step did not complete.
 */
const input: z.ZodType<{ readonly chat: PaidTellOutput | null; readonly mail: PaidTellOutput | null }> = z.object({
    chat: paidTellOutput.nullable(),
    mail: paidTellOutput.nullable(),
})

const output: z.ZodType<PaidToldOutput> = z.object({
    ...purchaseRefShape,
    customerCode: z.string().min(1).max(ID_MAX),
    told: z.enum(["conversation", "mail"]),
    sent: z.boolean(),
    channel: z.string().max(40).nullable(),
    messageRef: z.string().min(1).max(200).nullable(),
    refusal: z.string().min(1).max(200).nullable(),
})

const NONE = { sent: false, channel: null, messageRef: null, refusal: null } as const
const CHAT = {
    ...PURCHASE,
    customerCode: "KH-0101",
    told: "conversation",
    sent: true,
    channel: "zalo",
    messageRef: "msg-31",
    refusal: null,
} as const
const MAIL = {
    ...PURCHASE,
    customerCode: "KH-0101",
    told: "mail",
    sent: true,
    channel: "email",
    messageRef: "work-31",
    refusal: null,
} as const
const CHAT_SKIPPED = { ...PURCHASE, customerCode: "KH-0101", told: "mail", ...NONE } as const
const MAIL_SKIPPED = { ...PURCHASE, customerCode: "KH-0101", told: "conversation", ...NONE } as const

/**
 * `websales.paid-told` (the customer told): the merge of the two sends of `websales.paid-tell` and `websales.paid-mail`, one of which
 * was skipped (the reach was the other's channel). It returns the output of the one that was not skipped (both skipped: the chat's),
 * so the graph's later steps read ONE step. No tool, no AI.
 */
export const websalesPaidToldNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "websales.paid-told",
    title: websalesText("node.paid-told.title"),
    description: {
        vi: "Gom hai lần báo khách (cuộc trò chuyện, thư) thành một kết quả: lần không bị bỏ qua.",
        en: "Merges the two ways of telling the customer (conversation, mail) into one result: the one that was not skipped.",
    },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    blocking: false,
    run: async (given, context) => {
        const told = given.chat !== null && !given.chat.skipped ? given.chat : given.mail !== null && !given.mail.skipped ? given.mail : given.chat
        if (told === null) return context.fail({ kind: "cannot", why: "neither the chat send nor the mail send produced a result" })
        const { skipped: _skipped, ...result } = told
        return result
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
