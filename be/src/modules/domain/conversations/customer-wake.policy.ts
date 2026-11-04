import type { AgentWakeContext } from "@modules/domain/agent-work"

/** What a customer message's wake names: the conversation, the message and its channel event, and whether to ask the channel for a name. */
export interface CustomerWakeIntake {
    /** The conversation the customer message belongs to. */
    readonly conversationId: string
    /** The stored customer message that woke the agent. */
    readonly messageId: string
    /** The channel event the message arrived as, for tracing it back to the provider. */
    readonly channelEventId: string
    /** Whether the channel should be asked for the customer's name on this turn. */
    readonly lookupName: boolean
}

/** The context of a customer message's wake: ids and flags only, never the customer's words, which stay in the conversation. */
export const customerWakeContextOf = (intake: CustomerWakeIntake): AgentWakeContext => ({
    conversationId: intake.conversationId,
    messageId: intake.messageId,
    channelEventId: intake.channelEventId,
    lookupName: intake.lookupName,
})
