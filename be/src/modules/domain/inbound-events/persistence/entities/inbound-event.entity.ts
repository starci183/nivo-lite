import { UuidAbstractEntity } from "@modules/platform/database"
import { bigintNumberTransformer } from "@modules/platform/primitives"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "inbound_events" })
/** One input the engine received from a channel. */
export class InboundEventEntity extends UuidAbstractEntity {
    /** The channel key. */
    @Column({ name: "channel", type: "text" })
    channel!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** `message`, `lead`, `order`, `invoice` or `payment`. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The sender's name. */
    @Column({ name: "sender_name", type: "text", nullable: true })
    senderName!: string | null

    /** The sender's phone or email. */
    @Column({ name: "sender_contact", type: "text", nullable: true })
    senderContact!: string | null

    /** The text. */
    @Column({ name: "body", type: "text", default: () => "''" })
    body!: string

    /** The money in it, VND. */
    @Column({ name: "amount_vnd", type: "bigint", nullable: true, transformer: bigintNumberTransformer })
    amountVnd!: number | null

    /** The external reference. */
    @Column({ name: "external_ref", type: "text", nullable: true })
    externalRef!: string | null

    /** The idempotency key of the delivery, unique per workspace. */
    @Column({ name: "dedupe_key", type: "text" })
    dedupeKey!: string

    /** How many duplicate deliveries have been blocked. */
    @Column({ name: "duplicate_count", type: "integer", default: () => "0" })
    duplicateCount!: number

    /** When the last duplicate was blocked. */
    @Column({ name: "last_duplicate_at", type: "timestamptz", nullable: true })
    lastDuplicateAt!: Date | null

    /** The customer it belongs to. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** `received`, `processed`, `needs_decision` or `failed`. */
    @Column({ name: "status", type: "text", default: () => "'received'" })
    status!: string

    /** The channel's own event id. */
    @Column({ name: "event_id", type: "text", nullable: true })
    eventId!: string | null
}
