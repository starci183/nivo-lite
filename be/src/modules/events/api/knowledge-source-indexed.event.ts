import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"

/**
 * The payload of the `knowledge_source_indexed` event: the passages of a source are stored and it moved on to the fact-reading stage.
 * `dedupeKey` is the source and the instant of this indexing (epoch ms): a source indexed again is read again, a redelivery of one
 * indexing is read once.
 */
export interface KnowledgeSourceIndexedPayload extends EventPayload {
    /** The source whose passages are stored. */
    readonly sourceId: string
    /** The workspace that owns it. */
    readonly workspaceId: string
    /** The instant of this indexing, epoch ms: it keys the one reading of this indexing. */
    readonly indexedAt: number
}

/** Version 1 of `knowledge_source_indexed`, published by the knowledge sources in the transaction that stores the end of an indexing. */
export class KnowledgeSourceIndexedEvent extends BaseEvent {
    static readonly eventName = "knowledge_source_indexed"
    static readonly version = 1

    readonly eventName = KnowledgeSourceIndexedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: KnowledgeSourceIndexedPayload,
    ) {
        super()
    }

    /** The source and the instant of the indexing are the identity of the fact. */
    static create(payload: Omit<KnowledgeSourceIndexedPayload, "dedupeKey">): KnowledgeSourceIndexedEvent {
        const key = `${payload.sourceId}:${payload.indexedAt}`
        return new KnowledgeSourceIndexedEvent(key, { ...payload, dedupeKey: key })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<KnowledgeSourceIndexedEvent> {
        if (typeof envelope !== "object" || envelope === null || !("eventId" in envelope) || !("payload" in envelope)) {
            return null
        }
        const { eventId, payload } = envelope
        if (typeof eventId !== "string" || eventId.trim() === "" || typeof payload !== "object" || payload === null) {
            return null
        }
        const body = payload as Partial<Record<keyof KnowledgeSourceIndexedPayload, unknown>>
        if (
            typeof body.sourceId !== "string" ||
            body.sourceId.trim() === "" ||
            typeof body.workspaceId !== "string" ||
            typeof body.indexedAt !== "number" ||
            !Number.isFinite(body.indexedAt)
        ) {
            return null
        }
        return new KnowledgeSourceIndexedEvent(eventId, {
            dedupeKey: `${body.sourceId}:${body.indexedAt}`,
            sourceId: body.sourceId,
            workspaceId: body.workspaceId,
            indexedAt: body.indexedAt,
        })
    }
}
