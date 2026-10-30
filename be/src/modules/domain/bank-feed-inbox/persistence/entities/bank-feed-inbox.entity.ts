import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { BankFeedProvider, FeedReceiptPayload } from "../../bank-feed-inbox.contracts"

@Entity({ schema: "public", name: "bank_feed_inbox" })
/** A durable receipt of one provider delivery. */
export class BankFeedInboxEntity extends UuidAbstractEntity {
    /** The provider that delivered. */
    @Column({ name: "provider", type: "text" })
    provider!: BankFeedProvider

    /** The provider delivery id. */
    @Column({ name: "delivery_id", type: "text" })
    deliveryId!: string

    /** When the delivery arrived. */
    @Column({ name: "received_at", type: "timestamptz", default: () => "now()" })
    receivedAt!: Date

    /** The immutable receipt data. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: FeedReceiptPayload

    /** When the booking completed. */
    @Column({ name: "processed_at", type: "timestamptz", nullable: true })
    processedAt!: Date | null
}
