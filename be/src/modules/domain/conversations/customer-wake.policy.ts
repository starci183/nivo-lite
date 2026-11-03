import type { AgentWakeContext } from "@modules/domain/agent-work"

/** What a customer message's wake names: the conversation, the message and its channel event, and whether to ask the channel for a name. */
export interface CustomerWakeIntake {
    readonly conversationId: string
    readonly messageId: string
    readonly channelEventId: string
    readonly lookupName: boolean
}

/** The context of a customer message's wake: ids and flags only, never the customer's words, which stay in the conversation. */
export const customerWakeContextOf = (intake: CustomerWakeIntake): AgentWakeContext => ({
    conversationId: intake.conversationId,
    messageId: intake.messageId,
    channelEventId: intake.channelEventId,
    lookupName: intake.lookupName,
})
