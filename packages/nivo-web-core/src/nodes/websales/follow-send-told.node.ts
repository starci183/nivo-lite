import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { type SentFollowUp, sentFollowUpSchema } from "./sales-shapes"
import { type FollowSendOutput } from "./follow-send.node"
import { PURCHASE } from "./websales.fixtures"
import { websalesText } from "../../modules/websales/copy"

/** The two variants' answers for one purchase: one did the work, the other is skipped. */
export type FollowSendToldInput = {
    /** What the chat variant (`websales.follow-send`) answered. */
    readonly chat: FollowSendOutput
    /** What the mail variant (`websales.follow-send-mail`) answered. */
    readonly mail: FollowSendOutput
}

/** What was sent for the purchase: the one step's output the round's later steps read. */
export type FollowSendToldOutput = SentFollowUp

const outputOf: z.ZodType<FollowSendOutput> = z.intersection(sentFollowUpSchema, z.object({ skipped: z.boolean() }))

const input: z.ZodType<FollowSendToldInput> = z.object({ chat: outputOf, mail: outputOf })

const output: z.ZodType<FollowSendToldOutput> = sentFollowUpSchema

/** Drops `skipped` from a variant's answer. */
const withoutSkipped = ({ skipped: _skipped, ...rest }: FollowSendOutput): SentFollowUp => rest

const NOT_SENT = {
    ...PURCHASE,
    sent: false,
    recordChannel: null,
    channel: null,
    messageRef: null,
    refusal: null,
    declined: false,
} as const

/**
 * `websales.follow-send-told`: merges the pair `websales.follow-send` (chat) and `websales.follow-send-mail` (mail) into one answer, so
 * the round's later steps read ONE step's output. It returns the answer of the variant that is not skipped (both skipped: the chat's).
 * No AI, no tool, nothing written.
 */
export const websalesFollowSendToldNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "websales.follow-send-told",
    title: websalesText("node.follow-send-told.title"),
    description: { vi: "Gộp kết quả nhắc qua cuộc trò chuyện và qua thư thành một kết quả cho mỗi báo giá.", en: "Merges the reminder sent in the conversation and the one sent by mail into one result per quote." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: async (given) => withoutSkipped(given.chat.skipped && !given.mail.skipped ? given.mail : given.chat),
    examples: [
        {
            name: "the reminder went in the conversation: the chat answer is taken",
            params: {},
            input: {
                chat: { ...NOT_SENT, sent: true, recordChannel: "zalo", channel: "zalo", messageRef: "msg-11", skipped: false },
                mail: { ...NOT_SENT, skipped: true },
            },
            tools: [],
            output: { ...NOT_SENT, sent: true, recordChannel: "zalo", channel: "zalo", messageRef: "msg-11" },
        },
        {
            name: "the reminder went by mail: the mail answer is taken",
            params: {},
            input: {
                chat: { ...NOT_SENT, skipped: true },
                mail: { ...NOT_SENT, sent: true, recordChannel: "email", channel: "email", messageRef: "work-11", skipped: false },
            },
            tools: [],
            output: { ...NOT_SENT, sent: true, recordChannel: "email", channel: "email", messageRef: "work-11" },
        },
    ],
})
