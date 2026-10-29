/** What a result card points at: the kind of record and its id. */
export interface CardRef {
    /** `execution` or `work_item`; any other kind has no live state. */
    readonly kind: string
    /** The id of the record, as the card wrote it. */
    readonly id: string
}

/** The state a card line shows. */
export type CardState = "pending" | "approved" | "declined" | "done" | "failed" | "queued" | "info"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const textOf = (value: unknown, key: string): string | null => {
    if (typeof value !== "object" || value === null || !(key in value)) return null
    const field: unknown = Reflect.get(value, key)
    return typeof field === "string" ? field : null
}

/** The record a card (JSON text) points at; null when the card names none. */
export const cardRefOf = (cardJson: string | null): CardRef | null => {
    if (cardJson === null) return null
    const card: unknown = JSON.parse(cardJson)
    const ref: unknown = typeof card === "object" && card !== null ? Reflect.get(card, "ref") : undefined
    const kind = textOf(ref, "kind")
    const id = textOf(ref, "id")
    return kind === null || id === null ? null : { kind, id }
}

/** Whether a card id can be looked up as a record id; anything else points at nothing. */
export const isRecordId = (id: string): boolean => UUID_PATTERN.test(id)

/** The card state of an execution status. */
export const executionStateOf = (status: string): CardState => {
    if (status === "pending_approval") return "pending"
    return status === "approved" ? "approved" : "declined"
}

/** The card state of a work item status. */
export const workItemStateOf = (status: string): CardState => {
    if (status === "waiting_decision") return "pending"
    if (status === "done") return "done"
    if (status === "rejected") return "declined"
    return status === "failed" ? "failed" : "queued"
}
