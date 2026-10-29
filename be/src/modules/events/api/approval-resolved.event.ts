import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"
import { isKey, isMember, isTextOrNull, openEnvelope } from "./money-event.policy"

/** How a request for approval ended. */
export type ApprovalResolvedOutcome = "approved" | "rejected" | "expired"

/**
 * The payload of the `approval_resolved` event: an approval request reached its end (a member's verdict, or the deadline). The outcome
 * is terminal and never changes, so a reactor may act on it whatever the order of deliveries. `dedupeKey` is the request id: a request
 * ends once.
 */
export interface ApprovalResolvedInput {
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

/** The payload of the event as published; the dedupe key is derived from the input. */
export interface ApprovalResolvedPayload extends EventPayload, ApprovalResolvedInput {}

const OUTCOMES: ReadonlyArray<ApprovalResolvedOutcome> = ["approved", "rejected", "expired"]

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
    static create(payload: ApprovalResolvedInput): ApprovalResolvedEvent {
        return new ApprovalResolvedEvent(payload.requestId, { ...payload, dedupeKey: payload.requestId })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<ApprovalResolvedEvent> {
        const opened = openEnvelope(envelope)
        if (opened === null) return null
        const { body } = opened
        const decidedBy = body.decidedBy === undefined ? null : body.decidedBy
        if (
            !isKey(body.requestId) ||
            typeof body.workspaceId !== "string" ||
            !isMember(OUTCOMES, body.outcome) ||
            !isTextOrNull(decidedBy) ||
            typeof body.action !== "string" ||
            typeof body.chainStepId !== "string"
        ) {
            return null
        }
        return new ApprovalResolvedEvent(opened.eventId, {
            dedupeKey: body.requestId,
            requestId: body.requestId,
            workspaceId: body.workspaceId,
            outcome: body.outcome,
            decidedBy,
            action: body.action,
            chainStepId: body.chainStepId,
        })
    }
}
