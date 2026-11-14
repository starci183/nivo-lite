import { defineJob, doorPort, retryJob } from "@nivo-lite/agent-sdk/mutation"
import type { DoorApi, JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import type { EntityApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../../shared/bounds"
import { threadRowOf } from "../chatbot-records"
import type { ThreadRow } from "../chatbot.types"
import { CONVERSATIONS, REPLIES } from "../ports"
import { TOOL } from "../../../shared/vocabulary/tool-ids"

/** How many times the queue delivers the job before it is parked. */
const DELIVER_ATTEMPTS = 6

/** The longest ISO 8601 text the engine writes for a time. */
const MAX_TIME = 40

/** The name of the job: the outbox enqueues it by this name. */
const JOB_NAME = "chatbot.deliver-reply"

/** The input of the job, parsed before it runs: the reply work item (a job payload carries ids only). */
export const DELIVER_REPLY_INPUT: z.ZodObject<{ replyId: z.ZodString }> = z.object({
    replyId: z.string().min(1).max(MAX_ID),
})

/** The ports `deliverReply` runs on. */
export interface DeliverReplyPorts {
    /** The replies a member typed (`blocks-core.chatbot.reply`). */
    readonly replies: EntityApi
    /** The conversations (`blocks-core.chatbot.chat`). */
    readonly conversations: EntityApi
    /** The door out of the system. */
    readonly door: DoorApi
}

/** The port definitions of the job, by the name `deliverReply` reaches them by. */
export type DeliverReplyPortMap = {
    /** The replies a member typed (`blocks-core.chatbot.reply`). */
    readonly replies: PortDefinition<EntityApi>
    /** The conversations (`blocks-core.chatbot.chat`). */
    readonly conversations: PortDefinition<EntityApi>
    /** The door out of the system. */
    readonly door: PortDefinition<DoorApi>
}

/**
 * How a delivery ended: `sent` the engine told it, `failed` it was refused or its outcome is unknown (the engine's line keeps the state
 * and the reason; the thread shows it from there), `skipped` the reply was handed already or it or its conversation is gone, `retry` the
 * channel may succeed later.
 */
export type DeliverOutcome = "sent" | "failed" | "skipped" | "retry"

/** The declared fields of a `blocks-core.chatbot.reply` record the job reads. */
const replyData = z.object({
    conversationId: z.string().max(MAX_ID),
    text: z.string().max(MAX_BODY),
    memberId: z.string().max(MAX_ID),
    key: z.string().max(MAX_ID),
    handedAt: z
        .string()
        .max(MAX_TIME)
        .nullable()
        .optional()
        .transform((value) => value ?? null),
})

/** A reply work item as the job reads it. */
type Reply = z.output<typeof replyData> & { readonly id: string; readonly version: string }

/** The reply a record holds; null when its fields are not a reply's. */
const replyOf = (record: RecordRow): Reply | null => {
    const parsed = replyData.safeParse(record.data)
    return parsed.success ? { id: record.id, version: record.version, ...parsed.data } : null
}

/** A value as a plain record, or null. */
const recordOf = (value: unknown): Readonly<Record<string, unknown>> | null =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null

/** What the send tool answered, read by the shape of its answer (never by words): a receipt whose state is `delivered` was told. */
const outcomeOfAnswer = (output: unknown): DeliverOutcome => {
    const answer = recordOf(output)
    const facts = recordOf(answer?.["facts"])
    return answer?.["kind"] === "message" && facts?.["state"] === "delivered" ? "sent" : "failed"
}

/**
 * Says the reply with the ONE send tool `nivo.tool.customer.message.send`: on the route of its chat (the engine reads the person,
 * channel and account from the route, and refuses a person no channel can reach), else to the contact on the chat's channel. The send
 * key the reply action made is the business key, so a retry never tells it twice, and `byMember` records the member who typed it on the
 * engine's customer line (the ONE write of the reply, ruling R26). A chat that holds no route and no contact is a failure without a call.
 */
const pushOf = async (door: DoorApi, conversation: ThreadRow, reply: Reply): Promise<DeliverOutcome> => {
    const { routeId, contactId } = conversation
    if (routeId === null && contactId === null) return "failed"
    const send =
        routeId === null ? { contactId: contactId ?? "", channel: conversation.channel, text: reply.text } : { text: reply.text }
    const result = await door.call(TOOL.customerMessageSend, send, {
        onceBy: reply.key,
        byMember: reply.memberId,
        ...(routeId === null ? {} : { routeId }),
    })
    if (result.ok) return outcomeOfAnswer(result.output)
    return result.reason === "transient" ? "retry" : "failed"
}

/**
 * Pushes one typed reply of a person to the customer channel through `door.call(TOOL.customerMessageSend)`, outside any transaction.
 * Once it is handed (told, refused or of unknown outcome: the engine's line holds what became of it) the work item keeps no words: `text`
 * is emptied and `handedAt` stamped. A retry leaves it as it was.
 */
export const deliverReply = async (
    ports: DeliverReplyPorts,
    input: z.output<typeof DELIVER_REPLY_INPUT>,
    now: Date,
): Promise<DeliverOutcome> => {
    const stored = await ports.replies.get(input.replyId)
    const reply = stored === null ? null : replyOf(stored)
    if (reply === null || reply.handedAt !== null) return "skipped"
    const found = await ports.conversations.get(reply.conversationId)
    const conversation = found === null ? null : threadRowOf(found)
    if (conversation === null) return "skipped"
    const outcome = await pushOf(ports.door, conversation, reply)
    if (outcome === "retry") return "retry"
    const handed = await ports.replies.update(reply.id, reply.version, { text: "", handedAt: now.toISOString() })
    return handed.ok ? outcome : "retry"
}

/** The declared job: delivers one typed reply; a transient outcome has the queue deliver it again with its backoff (`retryJob`), and park it with one alert once the attempts are spent. */
export const DELIVER_REPLY: JobDefinition<typeof DELIVER_REPLY_INPUT, DeliverReplyPortMap> = defineJob({
    name: JOB_NAME,
    input: DELIVER_REPLY_INPUT,
    ports: { replies: REPLIES, conversations: CONVERSATIONS, door: doorPort },
    attempts: DELIVER_ATTEMPTS,
    run: async (ports, input) => {
        if ((await deliverReply(ports, input, new Date())) === "retry") retryJob(JOB_NAME)
    },
})
