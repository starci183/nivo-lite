import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { placeholderRecipient } from "../../../rules/chatbot"
import type { ChatDoor, ConversationStore, DeliverReplyInput, MessageStore } from "../ports"
import { CONVERSATIONS, DOOR, MESSAGES } from "../ports"

/** The failure code a line gets when its conversation names a customer no channel can reach. */
export const RECIPIENT_NOT_LINKED = "recipient_not_linked"

/** The input of the job, parsed before it runs. */
export const DELIVER_REPLY_INPUT: z.ZodObject<{ messageId: z.ZodString }> = z.object({
    messageId: z.string().min(1).max(MAX_ID),
})

/** The port definitions of the job, by local name. */
export interface DeliverReplyPortMap {
    /** The lines. */
    readonly messages: PortDefinition<MessageStore>
    /** The conversations. */
    readonly conversations: PortDefinition<ConversationStore>
    /** The door out of the system. */
    readonly door: PortDefinition<ChatDoor>
}

/** The ports of the job, by the name `deliverReply` reaches them by. */
export const DELIVER_REPLY_PORTS: DeliverReplyPortMap = { messages: MESSAGES, conversations: CONVERSATIONS, door: DOOR }

/** The ports `deliverReply` runs on. */
export interface DeliverReplyPorts {
    /** The lines. */
    readonly messages: MessageStore
    /** The conversations. */
    readonly conversations: ConversationStore
    /** The door out of the system. */
    readonly door: ChatDoor
}

/**
 * How a delivery ended: `sent` and `failed` are recorded on the line, `skipped` found nothing to do (the line or its conversation is
 * gone, or the line was already sent), `retry` left the line as it was because the channel may succeed later (the runner retries).
 */
export type DeliverOutcome = "sent" | "failed" | "skipped" | "retry"

/**
 * Pushes one stored line of a person to the customer channel through `door.call("chat.send")`, outside any transaction, and records
 * the outcome on the line. The line id is the effect key, so a retry of the same delivery sends nothing twice.
 */
export const deliverReply = async (ports: DeliverReplyPorts, input: DeliverReplyInput): Promise<DeliverOutcome> => {
    const line = await ports.messages.get(input.messageId)
    if (line === null || line.deliveryStatus === "sent") return "skipped"
    const conversation = await ports.conversations.get(line.conversationId)
    if (conversation === null) return "skipped"
    const result = placeholderRecipient(conversation)
        ? { ok: false as const, failure: RECIPIENT_NOT_LINKED, transient: false }
        : await ports.door.call("chat.send", { conversationId: conversation.id, text: line.text, key: line.id })
    if (!result.ok && result.transient) return "retry"
    const recorded = await ports.messages.update(
        line.id,
        line.version,
        result.ok
            ? { deliveryStatus: "sent", deliveryError: null }
            : { deliveryStatus: "failed", deliveryError: result.failure },
    )
    if (!recorded.ok) return "retry"
    return result.ok ? "sent" : "failed"
}
