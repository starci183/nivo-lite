import type { SubjectType } from "@modules/domain/work-items"

/** A member of a raise payload: JSON, bounded in text and in the count of its members. */
export type PayloadValue =
    string | number | boolean | null | ReadonlyArray<PayloadValue> | { readonly [member: string]: PayloadValue }

/** The members of a raise payload, by name. */
export type PayloadMembers = Readonly<Record<string, PayloadValue>>

/** What the `work-item.raise` effect asks for. */
export interface RaisePayload {
    /** The action of the item to open. */
    readonly action: string
    /** The line the owner reads. */
    readonly title: string
    /** The facts the node holds about the work. */
    readonly payload: PayloadMembers
    /** The amount at stake in VND, when there is one. */
    readonly amountVnd?: number | undefined
}

/** What the undo of a recorded effect names: the record to undo. */
export interface UndoPayload {
    /** The id of the record the effect made. */
    readonly id: string
}

/** What a raised work item is about. */
export interface RaisedSubject {
    /** The kind of the subject. */
    readonly type: SubjectType
    /** The subject, or null when the turn has none. */
    readonly id: string | null
}
