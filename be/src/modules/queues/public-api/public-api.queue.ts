import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The queue name: the contract between this producer and the processor of the public API intake job (a pgmq queue name). */
export const PUBLIC_API_QUEUE = "public_api"

/** A customer handed over by the public API: the inbound event that was written, and the extras the event has no column for. */
export interface LeadIntakePayload {
    /** Discriminates the three jobs of the queue. */
    readonly kind: "lead"
    /** The workspace of the key. */
    readonly workspaceId: string
    /** The key that sent the request. */
    readonly keyId: string
    /** The key name; evidence names the source `api:<name>`. */
    readonly keyName: string
    /** The inbound event the request wrote. */
    readonly inboundEventId: string
    /** The company, or an empty string. */
    readonly company: string
    /** The stage the caller asked for, or null. */
    readonly stage: string | null
    /** A note for the customer's history, or an empty string. */
    readonly note: string
}

/** A message the public API asks the chatbot to send to a customer conversation. */
export interface MessageIntakePayload {
    /** Discriminates the three jobs of the queue. */
    readonly kind: "message"
    /** The workspace of the key. */
    readonly workspaceId: string
    /** The key that sent the request. */
    readonly keyId: string
    /** The key name; evidence names the source `api:<name>`. */
    readonly keyName: string
    /** The customer conversation to message. */
    readonly conversationId: string
    /** The lead of the conversation, or null. */
    readonly leadId: string | null
    /** The text to send. */
    readonly text: string
    /** True when the caller forces a waiting decision whatever the owner's rule says. */
    readonly requireApproval: boolean
    /** The work item dedupe key: a repeated request with the same idempotency key is one message. */
    readonly dedupeKey: string
}

/** A knowledge source the public API wrote with status queued and that still has to be indexed. */
export interface KnowledgeIntakePayload {
    /** Discriminates the three jobs of the queue. */
    readonly kind: "knowledge"
    /** The workspace of the key. */
    readonly workspaceId: string
    /** The source to index. */
    readonly sourceId: string
}

/** Every payload of the queue. */
export type PublicApiPayload = LeadIntakePayload | MessageIntakePayload | KnowledgeIntakePayload

@Injectable()
/** The typed producer of the public-api queue: the one way a request accepted by the public API starts its follow-up work. */
export class PublicApiQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the hand-off of a customer in the caller's transaction: the job exists exactly when the inbound event commits. */
    enqueueLead(payload: Omit<LeadIntakePayload, "kind">, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, PUBLIC_API_QUEUE, { kind: "lead", ...payload })
    }

    /** Enqueues the sending of a message in the caller's transaction. */
    enqueueMessage(payload: Omit<MessageIntakePayload, "kind">, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, PUBLIC_API_QUEUE, { kind: "message", ...payload })
    }

    /** Enqueues the indexing of a knowledge source in the caller's transaction: the job exists exactly when the source row does. */
    enqueueKnowledge(payload: Omit<KnowledgeIntakePayload, "kind">, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, PUBLIC_API_QUEUE, { kind: "knowledge", ...payload })
    }
}
