export { TELEGRAM_DELIVERY_QUEUE } from "@modules/queues/telegram-delivery"
export type { TelegramDeliveryRecorded } from "@modules/queues/telegram-delivery"

/** The transport may have no retained raw bytes. */
export type TelegramRawDelivery = Buffer | undefined

/** The original delivery body retained until the receipt is processed. */
export interface TelegramInboxPayload {
    /** The connection that accepted the provider message. */
    readonly connection: string
    /** The original delivery decoded as UTF-8. */
    readonly rawBody: string
}

/** A locked receipt awaiting its conversation effects. */
export interface PendingTelegramInboxReceipt {
    /** The row completed after processing succeeds. */
    readonly id: string
    /** The original connection and raw delivery bytes. */
    readonly payload: TelegramInboxPayload
}
