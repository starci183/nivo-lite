import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"
import { isKey, isText, isTextOrAbsent, whenPresent, openEnvelope } from "./money-event.policy"

/**
 * The payload of the `decision_made` event: a person decided a work item (approved, edited or rejected it). A reactor settles the
 * automation run that waited for the item from the current run state. `dedupeKey` is `decision.made:<workItemId>:<outcome>`: one
 * outcome of one item is announced once.
 */
export interface DecisionMadeInput {
    /** The workspace of the item. */
    readonly workspaceId: string
    /** The decided work item. */
    readonly workItemId: string
    /** The action key of the item. */
    readonly action: string
    /** The department that owns the item. */
    readonly department: string
    /** The outcome: approved, edited or rejected. */
    readonly outcome: string
    /** Who decided, as the decision log names them. */
    readonly decidedBy: string
    /** The customer of the item, or null. */
    readonly leadId?: string
    /** The summary of the performed work. */
    readonly summary: string
}

/** The payload of the event as published; the dedupe key is derived from the input. */
export interface DecisionMadePayload extends EventPayload, DecisionMadeInput {}

/** Version 1 of `decision_made`, published in the transaction that records a person's decision on a work item. */
export class DecisionMadeEvent extends BaseEvent {
    static readonly eventName = "decision_made"
    static readonly version = 1

    readonly eventName = DecisionMadeEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: DecisionMadePayload,
    ) {
        super()
    }

    /** One outcome of one item is one fact: the item id and the outcome are its identity. */
    static create(payload: DecisionMadeInput): DecisionMadeEvent {
        const dedupeKey = `decision.made:${payload.workItemId}:${payload.outcome}`
        return new DecisionMadeEvent(dedupeKey, { ...payload, dedupeKey })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<DecisionMadeEvent> {
        const opened = openEnvelope(envelope)
        if (opened === null) return null
        const { body } = opened
        if (
            !isKey(body.workItemId) ||
            !isKey(body.outcome) ||
            !isText(body.workspaceId) ||
            !isText(body.action) ||
            !isText(body.department) ||
            !isText(body.decidedBy) ||
            !isText(body.summary) ||
            !isTextOrAbsent(body.leadId)
        ) {
            return null
        }
        return new DecisionMadeEvent(opened.eventId, {
            dedupeKey: `decision.made:${body.workItemId}:${body.outcome}`,
            workspaceId: body.workspaceId,
            workItemId: body.workItemId,
            action: body.action,
            department: body.department,
            outcome: body.outcome,
            decidedBy: body.decidedBy,
            ...whenPresent("leadId", body.leadId),
            summary: body.summary,
        })
    }
}
