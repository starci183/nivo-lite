import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { TelegramInboxPayload } from "../../telegram-inbox.contracts"

@Entity({ schema: "public", name: "telegram_inbox" })
/** One Telegram webhook delivery receipt: `(provider, delivery_id)` is unique, so a redelivery inserts nothing. */
export class TelegramInboxEntity extends UuidAbstractEntity {
    /** The provider name of the delivery. */
    @Column({ name: "provider", type: "text" })
    provider!: string

    /** The provider's id of the delivery. */
    @Column({ name: "delivery_id", type: "text" })
    deliveryId!: string

    /** When the delivery was received. */
    @Column({ name: "received_at", type: "timestamptz", default: () => "now()" })
    receivedAt!: Date

    /** The connection and raw delivery bytes the deferred consumer reads. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: TelegramInboxPayload

    /** When the deferred consumer finished the receipt; null while it is pending. */
    @Column({ name: "processed_at", type: "timestamptz", nullable: true })
    processedAt!: Date | null
}
