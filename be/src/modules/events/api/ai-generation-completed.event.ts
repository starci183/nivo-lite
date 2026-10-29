import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"

/** How a generation ended; a generation reaches one of these once and stays there. */
export type AiGenerationCompletedStatus = "done" | "error" | "cancelled"

/**
 * The payload of the `ai_generation_completed` event: the runner wrote the end of a generation on its row. Each consumer reads the
 * row itself (the status here is only a hint) and ignores a generation whose purpose it does not own. `dedupeKey` is the generation
 * id: a generation ends once.
 */
export interface AiGenerationCompletedPayload extends EventPayload {
    /** The generation that ended; equals `dedupeKey`. */
    readonly generationId: string
    /** The workspace that owns it. */
    readonly workspaceId: string
    /** What the text was for, as the row stores it. */
    readonly purpose: string
    /** How the run ended. */
    readonly status: AiGenerationCompletedStatus
}

const STATUSES: ReadonlyArray<string> = ["done", "error", "cancelled"]

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
    static create(payload: Omit<AiGenerationCompletedPayload, "dedupeKey">): AiGenerationCompletedEvent {
        return new AiGenerationCompletedEvent(payload.generationId, { ...payload, dedupeKey: payload.generationId })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<AiGenerationCompletedEvent> {
        if (typeof envelope !== "object" || envelope === null || !("eventId" in envelope) || !("payload" in envelope)) {
            return null
        }
        const { eventId, payload } = envelope
        if (typeof eventId !== "string" || eventId.trim() === "" || typeof payload !== "object" || payload === null) {
            return null
        }
        const body = payload as Partial<Record<keyof AiGenerationCompletedPayload, unknown>>
        if (
            typeof body.generationId !== "string" ||
            body.generationId.trim() === "" ||
            typeof body.workspaceId !== "string" ||
            typeof body.purpose !== "string" ||
            typeof body.status !== "string" ||
            !STATUSES.includes(body.status)
        ) {
            return null
        }
        return new AiGenerationCompletedEvent(eventId, {
            dedupeKey: body.generationId,
            generationId: body.generationId,
            workspaceId: body.workspaceId,
            purpose: body.purpose,
            status: body.status as AiGenerationCompletedPayload["status"],
        })
    }
}
