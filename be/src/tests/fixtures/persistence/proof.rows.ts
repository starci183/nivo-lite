/** The outbox identity and committed handoff timestamp observed by queue proofs. */
export interface OutboxRow {
    id: string
    sent_at: Date | null
}
/** Persisted fencing state after a claim or guarded write. */
export interface JobSnapshot {
    id: string
    status: string
    fencing_token: string
    current_step: string | null
    error: string | null
}
/** The inbox receipt and its completion state. */
export interface ReceiptRow {
    id: string
    payload: object
    processed_at: Date | null
}
/** Work published for one normalized provider event. */
export interface WebhookJobRow {
    id: string
    payload: object
    dedupe_key: string
    sent_at: Date | null
}
/** The broker-bound envelope an outbox row carries, reconstructed for observation. */
export interface WebhookMessageRow {
    message: object
}
/** The deployed command and interval of one cron job. */
export interface CronRow {
    schedule: string
    command: string
}
/** A committed tick observed through the outbox the relay publishes from. */
export interface TickRow {
    id: string
    queue: string
    name: string
    payload: object
}
/** The broker-bound envelope reconstructed from an outbox row for observation. */
export interface ObservedMessage {
    name?: string
    payload?: object
    dedupe?: string
    outbox_id?: string
}
/** An outbox row seen as the job the relay hands to the broker (id, attempt and envelope). */
export interface ObservedMessageRow {
    id: string
    attempt: number
    message: ObservedMessage
}
