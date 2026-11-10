/** Whether money came into the account or left it. */
export type MovementDirection = "credit" | "debit"

/** One money movement the bank feed saw, as the record keeps it. */
export interface PaymentMovement {
    /** Money in or out. */
    readonly direction: MovementDirection
    /** The amount in VND, whole and positive. */
    readonly amountVnd: number
    /** The transfer content; null when there is none. */
    readonly reference: string | null
    /** Who paid; null when the feed does not say. */
    readonly payer: string | null
    /** The provider-prefixed transaction id: the key that makes a repeat one record. */
    readonly externalRef: string
    /** The bank account number the movement belongs to; null when the feed does not say. */
    readonly account: string | null
    /** The connected account (bank feed connection) it arrived on; null when not known. */
    readonly connectionId: string | null
    /** When the bank booked it, ISO text; null takes the moment of recording. */
    readonly occurredAt: string | null
}

/** What recording a movement answers: the record, and whether this call made it. */
export interface RecordedMovement {
    /** The id of the `payment.transaction` record. */
    readonly id: string
    /** False when the movement had already been recorded. */
    readonly created: boolean
}

/** What a read of the movements asks. */
export interface MovementQuery {
    /** Money in or out. */
    readonly direction: MovementDirection
    /** Only movements in this status; null for every status. */
    readonly status: string | null
    /** Only movements at or after this moment, ISO text; null for no start. */
    readonly since: string | null
    /** The most movements to answer. */
    readonly limit: number
}

/** One movement as a tool reads it. */
export interface MovementRow {
    /** The id of the record. */
    readonly id: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** The transfer content, or null. */
    readonly reference: string | null
    /** Who paid, or null. */
    readonly payer: string | null
    /** Whether it is tied to what it paid. */
    readonly status: string
    /** When the bank booked it, ISO text. */
    readonly occurredAt: string
}

/** A recorded movement, or null when the engine refused the record. */
export type OptionalRecordedMovement = RecordedMovement | null
