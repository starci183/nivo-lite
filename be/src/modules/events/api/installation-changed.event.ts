import { randomUUID } from "node:crypto"
import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"
import { isKey, isTextOrNull, openEnvelope } from "./money-event.policy"

/**
 * The payload of the `installation_changed` event: an installation (or the workspace's shared business knowledge) changed in a way the
 * OpenClaw copy of its agent must follow. `dedupeKey` is a fresh id per change: two changes of one installation are two facts, and a
 * redelivery of one change carries the same id.
 */
export interface InstallationChangedInput {
    /** The workspace. */
    readonly workspaceId: string
    /** The installation that changed; null when the change touches the whole workspace (its business knowledge). */
    readonly installationId: string | null
    /** True to rebuild the copy even when the installation does not run on OpenClaw (an install asks for it). */
    readonly force: boolean
}

/** The payload of the event as published; the dedupe key is derived from the input. */
export interface InstallationChangedPayload extends EventPayload, InstallationChangedInput {}

/** Version 1 of `installation_changed`, published by the modules capability in the transaction of the change. */
export class InstallationChangedEvent extends BaseEvent {
    static readonly eventName = "installation_changed"
    static readonly version = 1

    readonly eventName = InstallationChangedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: InstallationChangedPayload,
    ) {
        super()
    }

    /** Each change is its own fact: it gets a fresh id, which is also its dedupe key. */
    static create(payload: InstallationChangedInput, changeId: string = randomUUID()): InstallationChangedEvent {
        return new InstallationChangedEvent(changeId, { ...payload, dedupeKey: changeId })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<InstallationChangedEvent> {
        const opened = openEnvelope(envelope)
        if (opened === null) return null
        const { body } = opened
        const installationId = body.installationId === undefined ? null : body.installationId
        if (
            !isKey(body.dedupeKey) ||
            typeof body.workspaceId !== "string" ||
            !isTextOrNull(installationId) ||
            typeof body.force !== "boolean"
        ) {
            return null
        }
        return new InstallationChangedEvent(opened.eventId, {
            dedupeKey: body.dedupeKey,
            workspaceId: body.workspaceId,
            installationId,
            force: body.force,
        })
    }
}
