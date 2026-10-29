import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"

/** How a request for approval ended. */
export type ApprovalResolvedOutcome = "approved" | "rejected" | "expired"

/**
 * The payload of the `approval_resolved` event: an approval request reached its end (a member's verdict, or the deadline). The outcome
 * is terminal and never changes, so a reactor may act on it whatever the order of deliveries. `dedupeKey` is the request id: a request
 * ends once.
 */
export interface ApprovalResolvedPayload extends EventPayload {
    /** The request that ended; equals `dedupeKey`. */
    readonly requestId: string
    /** The workspace of the request. */
    readonly workspaceId: string
    /** Approved, rejected, or expired. */
    readonly outcome: ApprovalResolvedOutcome
    /** The member whose verdict ended it; null when it expired. */
    readonly decidedBy: string | null
    /** The action key the request was about. */
    readonly action: string
    /** The chain step the request was opened for. */
    readonly chainStepId: string
}

const OUTCOMES: ReadonlyArray<string> = ["approved", "rejected", "expired"]

/** Version 1 of `approval_resolved`, published by the approval capability in the transaction that ends a request. */
export class ApprovalResolvedEvent extends BaseEvent {
    static readonly eventName = "approval_resolved"
    static readonly version = 1

    readonly eventName = ApprovalResolvedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: ApprovalResolvedPayload,
    ) {
        super()
    }

    /** The request id is the identity of the fact: a request ends once. */
    static create(payload: Omit<ApprovalResolvedPayload, "dedupeKey">): ApprovalResolvedEvent {
        return new ApprovalResolvedEvent(payload.requestId, { ...payload, dedupeKey: payload.requestId })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<ApprovalResolvedEvent> {
        if (typeof envelope !== "object" || envelope === null || !("eventId" in envelope) || !("payload" in envelope)) {
            return null
        }
        const { eventId, payload } = envelope
        if (typeof eventId !== "string" || eventId.trim() === "" || typeof payload !== "object" || payload === null) {
            return null
        }
        const body = payload as Partial<Record<keyof ApprovalResolvedPayload, unknown>>
        const decidedBy = body.decidedBy === undefined ? null : body.decidedBy
        if (
            typeof body.requestId !== "string" ||
            body.requestId.trim() === "" ||
            typeof body.workspaceId !== "string" ||
            typeof body.outcome !== "string" ||
            !OUTCOMES.includes(body.outcome) ||
            (decidedBy !== null && typeof decidedBy !== "string") ||
            typeof body.action !== "string" ||
            typeof body.chainStepId !== "string"
        ) {
            return null
        }
        return new ApprovalResolvedEvent(eventId, {
            dedupeKey: body.requestId,
            requestId: body.requestId,
            workspaceId: body.workspaceId,
            outcome: body.outcome as ApprovalResolvedPayload["outcome"],
            decidedBy,
            action: body.action,
            chainStepId: body.chainStepId,
        })
    }
}
