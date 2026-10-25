import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The queue name: the contract between this producer and the processor of the run-chat-turn job (the durable queue name). */
export const CHAT_TURN_QUEUE = "chat_turn"

/** The payload of one run-chat-turn job: ids and flags only, never the text of a message. */
export interface ChatTurnPayload {
    /** `turn` answers a customer message; `deliver` only pushes a message that is already stored (the greeting of a new visit). */
    readonly kind: "turn" | "deliver"
    /** The workspace: its concurrency limit is keyed on it. */
    readonly workspaceId: string
    /** The conversation. */
    readonly conversationId: string
    /** The customer message to answer, or the stored message to deliver. */
    readonly messageId: string
    /** The channel's own id of the message: the idempotency key of everything the turn starts. */
    readonly channelEventId: string
    /** True when the customer was just met, so the job should ask the channel for their name. */
    readonly lookupName: boolean
}

/** True when a job payload is the payload of a run-chat-turn job. */
export const isChatTurnPayload = (value: unknown): value is ChatTurnPayload =>
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value.kind === "turn" || value.kind === "deliver") &&
    "workspaceId" in value &&
    typeof value.workspaceId === "string" &&
    "conversationId" in value &&
    typeof value.conversationId === "string" &&
    "messageId" in value &&
    typeof value.messageId === "string" &&
    "channelEventId" in value &&
    typeof value.channelEventId === "string" &&
    "lookupName" in value &&
    typeof value.lookupName === "boolean"

@Injectable()
/** The typed producer of the chat-turn queue: the one way a run-chat-turn job starts. */
export class ChatTurnQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the turn in the caller's transaction: the job exists exactly when the message it answers is stored, once per message. */
    enqueueChatTurn(payload: ChatTurnPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, CHAT_TURN_QUEUE, payload, {
            job: `chat-turn.${payload.kind}`,
            dedupeKey: `chat-turn.${payload.kind}:${payload.messageId}`,
        })
    }
}
