import type { Locale } from "@modules/platform/i18n"
import type { ProposalFieldValue } from "./decisions.contracts"

/** What a person decides about a waiting item. */
export type DecisionVerdict = "approved" | "rejected"

/** Why a member queued existing Sales work. */
export type QueuedWorkIntent = "retry" | "handoff"

/** A text that may be absent. */
export type OptionalNote = string | null | undefined

/** What deciding a work item takes. */
export interface WorkDecisionRequest {
    /** The work item. */
    readonly workItemId: string
    /** Approve or reject. */
    readonly decision: DecisionVerdict
    /** What the person changed before approving; nothing when absent. */
    readonly edits?: WireEdits
    /** A note from the decider. */
    readonly note?: OptionalNote
    /** The written reason the outcome is true; required to approve a payment reconciliation. */
    readonly basis?: OptionalNote
    /** The language of the generated text. */
    readonly locale: Locale
}

/** What deciding an approval card takes. */
export interface ExecutionDecisionRequest {
    /** The approval card. */
    readonly executionId: string
    /** Approve or reject. */
    readonly decision: DecisionVerdict
    /** The draft the person edited, when they did. */
    readonly editedDraft?: OptionalNote
    /** The language of the generated text. */
    readonly locale: Locale
}

/** Who is assigned to an item, in the terms the role policy reads. */
export interface DecisionAssignee {
    /** `staff` when a staff member is assigned, else null. */
    readonly assigneeKind: string | null
    /** The assigned staff id. */
    readonly assigneeId: string | null
}

/** What an owner or manager sends to an agent. */
export interface SendOwnerCommandRequest extends CommandPayloadInput {
    /** The receiving module. */
    readonly to: string
    /** The command key of the receiver. */
    readonly command: string
    /** Why, in one line. */
    readonly reason: string
    /** The language of the generated text. */
    readonly locale: Locale
}

/** One named field of a proposal or a command payload as a request carries it: a text, a number or neither. */
export interface FieldValue {
    /** The field name. */
    readonly name: string
    /** The text value. */
    readonly text?: string
    /** The number value. */
    readonly number?: number
}

/** The record the engine reads from named fields. */
export type FieldRecord = Record<string, ProposalFieldValue>

/** What a person changed on a proposal as a request carries it: the fields are a list, not a record. */
export interface WireEdits {
    /** A new draft. */
    readonly draft?: string
    /** A new amount, VND; null clears it. */
    readonly amount_vnd?: number | null
    /** Changed fields. */
    readonly fields?: ReadonlyArray<FieldValue>
    /** The invoice the owner chose among the candidates. */
    readonly candidateId?: string
}

/** What a command payload is made of as a request carries it. */
export interface CommandPayloadInput {
    /** The kind of record the command is about. */
    readonly subjectType?: string
    /** The record the command is about. */
    readonly subjectId?: string
    /** The customer the command is about. */
    readonly leadId?: string
    /** The other payload fields. */
    readonly fields?: ReadonlyArray<FieldValue>
}

/** What a command payload is as the engine reads it. */
export type CommandPayload = Readonly<Record<string, unknown>>

/** A text that may be absent. */
export type OptionalText = string | undefined

/** A list of named fields that may be absent. */
export type OptionalFieldList = ReadonlyArray<FieldValue> | undefined

/** Edits as a request carries them that may be absent. */
export type OptionalWireEdits = WireEdits | undefined
