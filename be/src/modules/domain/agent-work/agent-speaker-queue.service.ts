import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { storedTagSchema } from "./agent-speaker-queue.schema"
import type { OptionalQueuedTag, QueuedTag, StoredTag } from "./agent-speaker-queue.contracts"
import { AgentSpeakerQueueEntity } from "./persistence/entities"

/** The row form of a hand-off: its plain data as JSON text. */
const storedOf = ({ context, ...tag }: QueuedTag): StoredTag =>
    context === undefined ? tag : { ...tag, contextJson: JSON.stringify(context) }

/** The hand-off a row holds, or null when its plain data does not read back as an object. */
const queuedOf = ({ contextJson, ...tag }: StoredTag): OptionalQueuedTag => {
    if (contextJson === undefined) return tag
    const read = parseJsonText(contextJson)
    return read.ok && isRecord(read.value) && !Array.isArray(read.value) ? { ...tag, context: read.value } : null
}

@Injectable()
/**
 * The hand-offs that wait for the right to speak in their conversation: a hand-off made while another agent holds the conversation is
 * kept here, in order, and taken back out when the holder hands the conversation on. A hand-off waits once (its event key); a row that
 * does not read back as one is dropped, never acted on.
 */
export class AgentSpeakerQueueService {
    /** Keeps the hand-off until the holder of its conversation hands it on; the same hand-off kept twice waits once. */
    async keep(tag: QueuedTag, tx: EntityManager): Promise<void> {
        await tx
            .createQueryBuilder(AgentSpeakerQueueEntity, "queued")
            .insert()
            .values({
                workspaceId: tag.workspaceId,
                conversationId: tag.conversationId,
                toAgentId: tag.toAgentId,
                eventKey: tag.eventKey,
                request: storedOf(tag),
            })
            .orIgnore()
            .execute()
    }

    /** Takes the oldest hand-off waiting in the conversation out of the queue, under a row lock; null when none waits. */
    async takeNext(workspaceId: string, conversationId: string, tx: EntityManager): Promise<OptionalQueuedTag> {
        const row = await tx.findOne(AgentSpeakerQueueEntity, {
            where: { workspaceId, conversationId },
            order: { createdAt: "ASC", id: "ASC" },
            lock: { mode: "pessimistic_write" },
        })
        if (row === null) return null
        await tx.delete(AgentSpeakerQueueEntity, { id: row.id })
        const parsed = storedTagSchema.safeParse(row.request)
        const tag = parsed.success ? queuedOf(parsed.data) : null
        return tag ?? this.takeNext(workspaceId, conversationId, tx)
    }
}
