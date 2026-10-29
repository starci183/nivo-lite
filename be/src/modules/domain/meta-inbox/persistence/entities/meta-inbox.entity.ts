import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "meta_inbox" })
/** One signed Meta delivery, claimed once and processed after commit. */
export class MetaInboxEntity {
    /** The receipt. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The provider; always `meta`. */
    @Column({ name: "provider", type: "text" })
    provider!: "meta"

    /** The hash of the raw delivery. */
    @Column({ name: "delivery_id", type: "text" })
    deliveryId!: string

    /** When the receipt was written. */
    @Column({ name: "received_at", type: "timestamptz", default: () => "now()" })
    receivedAt!: Date

    /** The decoded delivery body. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: object

    /** When the consumer finished it, null while pending. */
    @Column({ name: "processed_at", type: "timestamptz", nullable: true })
    processedAt!: Date | null
}
