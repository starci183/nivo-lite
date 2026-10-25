/** The locked workspace-scoped admission consumed by one fenced worker. */
export interface PublicApiProcessingRow {
    /** The original admission identity. */
    readonly id: string
    /** The admitted request kind. */
    readonly kind: string
    /** The original body, validated again at consumption. */
    readonly payload: unknown
    /** Nonempty need presence, or NULL for historical admissions. */
    readonly need_supplied: boolean | null
    /** The resolved customer, if already known. */
    readonly lead_id: string | null
    /** Durable fulfillment has committed when this is nonnull. */
    readonly processed_at: Date | null
    /** When the request was admitted; a message past its auto-send window waits for approval. */
    readonly created_at: Date
}
