import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"
import { isKey, memberOf, openEnvelope } from "./money-event.policy"

/**
 * The payload of the `ai_generation_completed` event: the runner wrote the end of a generation on its row. Each consumer reads the
 * row itself (the status here is only a hint) and ignores a generation whose purpose it does not own. `dedupeKey` is the generation
 * id: a generation ends once.
 */
export interface AiGenerationCompletedInput {
    /** The generation that ended; equals `dedupeKey`. */
    readonly generationId: string
    /** The workspace that owns it. */
    readonly workspaceId: string
    /** What the text was for, as the row stores it. */
    readonly purpose: string
    /** How the run ended: one of `AI_GENERATION_COMPLETED_STATUSES`; a generation reaches one of these once and stays there. */
    readonly status: string
}

/** The payload of the event as published; the dedupe key is derived from the input. */
export interface AiGenerationCompletedPayload extends EventPayload, AiGenerationCompletedInput {}

/** The values `status` may hold on the wire. */
export const AI_GENERATION_COMPLETED_STATUSES = ["done", "error", "cancelled"] as const

/** Version 1 of `ai_generation_completed`, published by the generation runner in the transaction that writes the end of a generation. */
export class AiGenerationCompletedEvent extends BaseEvent {
    static readonly eventName = "ai_generation_completed"
    static readonly version = 1

    readonly eventName = AiGenerationCompletedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: AiGenerationCompletedPayload,
    ) {
        super()
    }

    /** The generation id is the identity of the fact: a generation ends once. */
    static create(payload: AiGenerationCompletedInput): AiGenerationCompletedEvent {
        memberOf(AI_GENERATION_COMPLETED_STATUSES, payload.status, "status")
        return new AiGenerationCompletedEvent(payload.generationId, { ...payload, dedupeKey: payload.generationId })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<AiGenerationCompletedEvent> {
        const opened = openEnvelope(envelope)
        if (opened === null) return null
        const { body } = opened
        if (
            !isKey(body.generationId) ||
            typeof body.workspaceId !== "string" ||
            typeof body.purpose !== "string" ||
            typeof body.status !== "string"
        ) {
            return null
        }
        return new AiGenerationCompletedEvent(opened.eventId, {
            dedupeKey: body.generationId,
            generationId: body.generationId,
            workspaceId: body.workspaceId,
            purpose: body.purpose,
            status: memberOf(AI_GENERATION_COMPLETED_STATUSES, body.status, "status"),
        })
    }
}
