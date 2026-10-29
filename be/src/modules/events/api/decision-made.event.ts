import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"
import { envelopeParts, fieldOf, keyOf, textOf } from "./event-fields.policy"

/**
 * The payload of the `decision_made` event: a person decided a work item (approved, edited or rejected it). A reactor settles the
 * automation run that waited for the item from the current run state. `dedupeKey` is `decision.made:<workItemId>:<outcome>`: one
 * outcome of one item is announced once.
 */
export interface DecisionMadePayload extends EventPayload {
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
    readonly leadId: string | null
    /** The summary of the performed work. */
    readonly summary: string
}

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
    static create(payload: Omit<DecisionMadePayload, "dedupeKey">): DecisionMadeEvent {
        const dedupeKey = `decision.made:${payload.workItemId}:${payload.outcome}`
        return new DecisionMadeEvent(dedupeKey, { ...payload, dedupeKey })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<DecisionMadeEvent> {
        const parts = envelopeParts(envelope)
        if (parts === null) return null
        const { eventId, payload } = parts
        const workspaceId = textOf(fieldOf(payload, "workspaceId"))
        const workItemId = keyOf(fieldOf(payload, "workItemId"))
        const action = textOf(fieldOf(payload, "action"))
        const department = textOf(fieldOf(payload, "department"))
        const outcome = keyOf(fieldOf(payload, "outcome"))
        const decidedBy = textOf(fieldOf(payload, "decidedBy"))
        const summary = textOf(fieldOf(payload, "summary"))
        const leadId = fieldOf(payload, "leadId")
        if (workspaceId === null || workItemId === null || action === null || department === null) return null
        if (outcome === null || decidedBy === null || summary === null) return null
        if (leadId !== null && typeof leadId !== "string") return null
        return new DecisionMadeEvent(eventId, {
            dedupeKey: `decision.made:${workItemId}:${outcome}`,
            workspaceId,
            workItemId,
            action,
            department,
            outcome,
            decidedBy,
            leadId,
            summary,
        })
    }
}
