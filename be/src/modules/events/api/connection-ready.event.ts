import { BaseEvent, type EventPayload, type ParsedEvent } from "@modules/platform/event-bus"
import { isKey, openEnvelope } from "./money-event.policy"

/**
 * The payload of the `connection_ready` event: a connection became ready to be read back from its provider (its API token was stored).
 * `dedupeKey` names that fact, so a redelivery, or the same token stored again, is one fact.
 */
export interface ConnectionReadyInput {
    /** The workspace the connection belongs to. */
    readonly workspaceId: string
    /** The connection that became ready. */
    readonly connectionId: string
    /** The provider key of the connection. */
    readonly provider: string
    /** The identity of the fact. */
    readonly dedupeKey: string
}

/** The payload of the event as published. */
export interface ConnectionReadyPayload extends EventPayload, ConnectionReadyInput {}

/** Version 1 of `connection_ready`, published in the transaction that made the connection ready. */
export class ConnectionReadyEvent extends BaseEvent {
    static readonly eventName = "connection_ready"
    static readonly version = 1

    readonly eventName: "connection_ready" = ConnectionReadyEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: ConnectionReadyPayload,
    ) {
        super()
    }

    /** The dedupe key is the identity of the fact and also the event id. */
    static create(payload: ConnectionReadyInput): ConnectionReadyEvent {
        return new ConnectionReadyEvent(payload.dedupeKey, payload)
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<ConnectionReadyEvent> {
        const opened = openEnvelope(envelope)
        if (opened === null) return null
        const { body } = opened
        if (!isKey(body.dedupeKey) || !isKey(body.workspaceId) || !isKey(body.connectionId) || !isKey(body.provider)) {
            return null
        }
        return new ConnectionReadyEvent(opened.eventId, {
            dedupeKey: body.dedupeKey,
            workspaceId: body.workspaceId,
            connectionId: body.connectionId,
            provider: body.provider,
        })
    }
}
