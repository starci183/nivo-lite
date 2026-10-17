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
/** A stored pgmq message body. */
export interface WebhookMessageRow {
    message: object
}
/** The deployed command and interval of one cron job. */
export interface CronRow {
    schedule: string
    command: string
}
/** A pgmq message identity for proving enqueue and acknowledgement. */
export interface MessageIdRow {
    id: string
}
