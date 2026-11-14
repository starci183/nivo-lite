import { BaseEvent, type EventPayload, type ParsedEvent } from "@modules/platform/event-bus"
import { isKey, isTextOrAbsent, whenPresent, openEnvelope } from "./event-payload.policy"

/**
 * The payload of the `installation_changed` event: an installation (or the workspace's shared business knowledge) changed in a way its
 * consumers (the agent wakes) follow. `dedupeKey` is a fresh id per change: two changes of one installation are two facts, and a
 * redelivery of one change carries the same id.
 */
export interface InstallationChangedInput {
    /** The workspace. */
    readonly workspaceId: string
    /** The installation that changed; null when the change touches the whole workspace (its business knowledge). */
    readonly installationId?: string
    /** True on an install; kept in version 1 of the event (no consumer reads it since the agent copy sync went). */
    readonly force: boolean
}

/** The payload of the event as published; the dedupe key is derived from the input. */
export interface InstallationChangedPayload extends EventPayload, InstallationChangedInput {}

/** Version 1 of `installation_changed`, published by the modules capability in the transaction of the change. */
export class InstallationChangedEvent extends BaseEvent {
    static readonly eventName = "installation_changed"
    static readonly version = 1

    readonly eventName: "installation_changed" = InstallationChangedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: InstallationChangedPayload,
    ) {
        super()
    }

    /** Each change is its own fact: the caller mints its id from the `Ids` port, and it is also the dedupe key. */
    static create(payload: InstallationChangedInput, changeId: string): InstallationChangedEvent {
        return new InstallationChangedEvent(changeId, { ...payload, dedupeKey: changeId })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<InstallationChangedEvent> {
        const opened = openEnvelope(envelope)
        if (opened === null) return null
        const { body } = opened
        if (
            !isKey(body.dedupeKey) ||
            typeof body.workspaceId !== "string" ||
            !isTextOrAbsent(body.installationId) ||
            typeof body.force !== "boolean"
        ) {
            return null
        }
        return new InstallationChangedEvent(opened.eventId, {
            dedupeKey: body.dedupeKey,
            workspaceId: body.workspaceId,
            ...whenPresent("installationId", body.installationId),
            force: body.force,
        })
    }
}
