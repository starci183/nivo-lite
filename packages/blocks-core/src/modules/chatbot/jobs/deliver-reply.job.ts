import { defineJob, doorPort, retryJob } from "@nivo-lite/agent-sdk/mutation"
import type { DoorApi, JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { placeholderRecipient } from "../../../rules/chatbot"
import { messageRecordOf, threadRowOf } from "../chatbot-records"
import type { MessageRecord, ThreadRow } from "../chatbot.types"
import { CONVERSATIONS, MESSAGES } from "../ports"

/** The failure code a line gets when its conversation names a customer no channel can reach. */
export const RECIPIENT_NOT_LINKED = "recipient_not_linked"

/** The longest failure text kept on a line. */
const FAILURE_MAX = 200

/** How many times the queue delivers the job before it is parked. */
const DELIVER_ATTEMPTS = 6

/** The name of the job: the outbox enqueues it by this name. */
const JOB_NAME = "chatbot.deliver-reply"

/** The input of the job, parsed before it runs. */
export const DELIVER_REPLY_INPUT: z.ZodObject<{ messageId: z.ZodString }> = z.object({
    messageId: z.string().min(1).max(MAX_ID),
})

/** The ports `deliverReply` runs on. */
export interface DeliverReplyPorts {
    /** The lines (`chat.message`). */
    readonly messages: EntityApi
    /** The conversations (`chat.conversation`). */
    readonly conversations: EntityApi
    /** The door out of the system. */
    readonly door: DoorApi
}

/** The port definitions of the job, by the name `deliverReply` reaches them by. */
export type DeliverReplyPortMap = {
    /** The lines (`chat.message`). */
    readonly messages: PortDefinition<EntityApi>
    /** The conversations (`chat.conversation`). */
    readonly conversations: PortDefinition<EntityApi>
    /** The door out of the system. */
    readonly door: PortDefinition<DoorApi>
}

/**
 * How a delivery ended: `sent` and `failed` are recorded on the line, `skipped` found nothing to do (the line or its conversation is
 * gone, the line is not a posted one, or it was already sent), `retry` left the line as it was because the channel may succeed later.
 */
export type DeliverOutcome = "sent" | "failed" | "skipped" | "retry"

/** What one push to the channel came to. */
type Push = { readonly kind: "sent" } | { readonly kind: "retry" } | { readonly kind: "failed"; readonly code: string }

/** Pushes the text through the door tool `chat.send`; a customer no channel can reach is a failure without a call. */
const pushOf = async (door: DoorApi, conversation: ThreadRow, line: MessageRecord): Promise<Push> => {
    if (placeholderRecipient(conversation)) return { kind: "failed", code: RECIPIENT_NOT_LINKED }
    const result = await door.call("chat.send", { conversationId: conversation.id, text: line.text, key: line.id })
    if (result.ok) return { kind: "sent" }
    return result.reason === "transient"
        ? { kind: "retry" }
        : { kind: "failed", code: result.message.slice(0, FAILURE_MAX) }
}

/**
 * Pushes one stored line of a person to the customer channel through `door.call("chat.send")`, outside any transaction, and records
 * the outcome on the line. The line id is the key of the call, so a retry of the same delivery sends nothing twice.
 */
export const deliverReply = async (
    ports: DeliverReplyPorts,
    input: z.output<typeof DELIVER_REPLY_INPUT>,
): Promise<DeliverOutcome> => {
    const stored = await ports.messages.get(input.messageId)
    const line = stored === null ? null : messageRecordOf(stored)
    if (line?.status !== "posted" || line.deliveryStatus === "sent") return "skipped"
    const found = await ports.conversations.get(line.conversationId)
    const conversation = found === null ? null : threadRowOf(found)
    if (conversation === null) return "skipped"
    const push = await pushOf(ports.door, conversation, line)
    if (push.kind === "retry") return "retry"
    const recorded = await ports.messages.update(
        line.id,
        line.version,
        push.kind === "sent"
            ? { deliveryStatus: "sent", deliveryError: null }
            : { deliveryStatus: "failed", deliveryError: push.code },
    )
    if (!recorded.ok) return "retry"
    return push.kind
}

/** The declared job: delivers one reply line; a transient outcome has the queue deliver it again with its backoff (`retryJob`), and park it with one alert once the attempts are spent. */
export const DELIVER_REPLY: JobDefinition<typeof DELIVER_REPLY_INPUT, DeliverReplyPortMap> = defineJob({
    name: JOB_NAME,
    input: DELIVER_REPLY_INPUT,
    ports: { messages: MESSAGES, conversations: CONVERSATIONS, door: doorPort },
    attempts: DELIVER_ATTEMPTS,
    run: async (ports, input) => {
        if ((await deliverReply(ports, input)) === "retry") retryJob(JOB_NAME)
    },
})
