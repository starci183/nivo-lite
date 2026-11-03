export { ZALO_DELIVERY_QUEUE } from "@modules/queues/zalo-delivery"
export type { ZaloDeliveryRecorded } from "@modules/queues/zalo-delivery"

/** The transport may have no retained raw bytes. */
export type ZaloRawDelivery = Buffer | undefined

/** A pending durable receipt read under its consumer lock. */
export interface PendingZaloReceipt {
    /** The row completed after processing succeeds. */
    readonly id: string
    /** The original connection and raw delivery bytes. */
    readonly payload: ZaloReceiptPayload
}

/** The immutable payload stored at receipt intake. */
export interface ZaloReceiptPayload {
    /** The connection that accepted the provider message. */
    readonly connection: string
    /** The original delivery decoded as UTF-8. */
    readonly rawBody: string
    /** `poll` when the reconcile job read the message back from Zalo because the webhook never delivered it; `manual_import` for a row the owner imported (its attachments may name local files); absent for a webhook delivery. */
    readonly source?: "poll" | "manual_import"
}

/**
 * Where a Zalo inbox row stands. `received` is stored and owed an answer; `handled` went to the agent turn of its conversation or to the person
 * who owns it (an event nothing is owed on is handled too); `failed` is a processing attempt that threw, retried by the queue; `expired` is a
 * polled message past the reply window or the stale age, kept for the owner and never answered by an agent.
 */
export type ZaloInboxState = "received" | "handled" | "failed" | "expired"

/** The Zalo user message a reconcile run read back, in the terms the inbox stores. */
export interface PolledZaloMessage {
    /** Zalo's id of the message: the same id the webhook carries as `msg_id`. */
    readonly messageId: string
    /** The Zalo id of the customer who wrote. */
    readonly userId: string
    /** What the customer wrote. */
    readonly text: string
    /** When the customer wrote it, in epoch milliseconds. */
    readonly sentAt: number
}

/** What the reconcile run needs to store a polled message: whose connection it is, the customer's name for the owner, and whether it is stale. */
export interface PolledZaloIntake {
    /** The workspace of the connection. */
    readonly workspaceId: string
    /** The name the owner sees the message under. */
    readonly sender: string
    /** True when the message is past the reply window or the stale age: it is kept for the owner and no agent answers it. */
    readonly stale: boolean
}

/** One follow event of the OA. */
export interface ZaloFollowEventRow {
    /** The inbox row id. */
    readonly id: string
    /** When it was received. */
    readonly received_at: string
}

/** What the inbox knows of a connection; null when the inbox has no row of it. */
export type OptionalZaloInboxFacts = ZaloInboxFactsRow | null

/** What the inbox knows of a connection. */
export interface ZaloInboxFactsRow {
    /** When the latest event arrived. */
    readonly last_at: string | null
    /** A customer text arrived. */
    readonly has_text: boolean
    /** A follow event arrived. */
    readonly has_follow: boolean
}
