import { z } from "zod"
import type { ChannelSend, ProposeReply } from "./chat-node-ports.policy"

const ID_MAX = 100
const TEXT_MAX = 4000
const ATTACHMENTS_MAX = 10
const URL_MAX = 2000
const NAME_MAX = 255

/** What a `channel.send` effect carries, as the effect's own schema admits it. */
export const channelSendSchema: z.ZodType<ChannelSend> = z.object({
    conversationId: z.string().min(1).max(ID_MAX),
    text: z.string().min(1).max(TEXT_MAX),
    attachments: z
        .array(z.object({ url: z.string().min(1).max(URL_MAX), name: z.string().min(1).max(NAME_MAX) }))
        .max(ATTACHMENTS_MAX)
        .optional(),
})

/** What a `chat-message.propose` effect carries: the conversation, the words of the draft and what the customer asked. */
export const proposeReplySchema: z.ZodType<ProposeReply> = z.object({
    conversationId: z.string().min(1).max(ID_MAX),
    text: z.string().min(1).max(TEXT_MAX),
    asked: z.string().max(NAME_MAX),
})
