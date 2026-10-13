/** One row a command card shows to the owner. */
export class ShownRowResponse {
    /** The payload key. */
    key!: string
    /** The label in the reader's language. */
    label!: string
    /** The value as text. */
    value!: string
}

/** One command card of the Office composer. */
export class CandidateResponse {
    /** The card id. */
    id!: string
    /** The owner message it answers. */
    message_id!: string
    /** The receiving module. */
    module!: string
    /** The command key of the receiver. */
    command!: string
    /** The payload the command carries. */
    payload!: Readonly<Record<string, unknown>>
    /** One sentence for the owner. */
    summary!: string
    /** The rows the card shows. */
    shown!: ReadonlyArray<ShownRowResponse>
    /** `pending`, `sent` or `cancelled`. */
    status!: string
    /** The work item the command became. */
    work_item_id!: string | null
    /** Why the command bus refused it, when it did. */
    refusal_detail!: string | null
    /** When it was proposed. */
    created_at!: string
}
