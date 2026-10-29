import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { ValueTransformer } from "typeorm"

/** Reads the bigint amount (text from the driver) as a number; the engine counts whole VND. */
const amountTransformer: ValueTransformer = {
    to: (value: number | null | undefined) => value,
    from: (value: string | null): number | null => (value === null ? null : Number(value)),
}

@Entity({ schema: "public", name: "inbound_events" })
/** One input the engine received from a channel. */
export class InboundEventEntity {
    /** The event id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The channel key. */
    @Column({ name: "channel", type: "text" })
    channel!: string

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
    @Column({ name: "amount_vnd", type: "bigint", nullable: true, transformer: amountTransformer })
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

    /** When this event was first received. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** The channel's own event id. */
    @Column({ name: "event_id", type: "text", nullable: true })
    eventId!: string | null
}
