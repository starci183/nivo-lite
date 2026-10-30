import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "booking_waitlist" })
/** A customer waiting for a slot of a service to open. */
export class BookingWaitlistEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The customer lead. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The chat the customer asked in. */
    @Column({ name: "conversation_id", type: "uuid", nullable: true })
    conversationId!: string | null

    /** The customer name. */
    @Column({ name: "customer_name", type: "text", default: () => "''::text" })
    customerName!: string

    /** The customer phone. */
    @Column({ name: "customer_phone", type: "text", nullable: true })
    customerPhone!: string | null

    /** The service. */
    @Column({ name: "service_id", type: "uuid" })
    serviceId!: string

    /** The resource asked for. */
    @Column({ name: "resource_id", type: "uuid", nullable: true })
    resourceId!: string | null

    /** The start of the window. */
    @Column({ name: "window_start", type: "timestamptz" })
    windowStart!: Date

    /** The end of the window. */
    @Column({ name: "window_end", type: "timestamptz" })
    windowEnd!: Date

    /** How many people come. */
    @Column({ name: "party_size", type: "integer", default: () => "1" })
    partySize!: number

    /** Where the entry stands. */
    @Column({ name: "status", type: "text", default: () => "'waiting'::text" })
    status!: string

    /** When the customer was told. */
    @Column({ name: "notified_at", type: "timestamptz", nullable: true })
    notifiedAt!: Date | null

    /** What the customer added. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string
}
