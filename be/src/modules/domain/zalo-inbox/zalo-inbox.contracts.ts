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
}

/** One follow event of the OA. */
export interface ZaloFollowEventRow {
    /** The inbox row id. */
    readonly id: string
    /** When it was received. */
    readonly received_at: string
}

/** What the inbox knows of a connection. */
export interface ZaloInboxFactsRow {
    /** When the latest event arrived. */
    readonly last_at: string | null
    /** A customer text arrived. */
    readonly has_text: boolean
    /** A follow event arrived. */
    readonly has_follow: boolean
}
