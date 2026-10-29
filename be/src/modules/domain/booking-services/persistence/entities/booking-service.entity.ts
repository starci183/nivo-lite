import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "booking_services" })
/** A service a workspace offers for booking. */
export class BookingServiceEntity {
    /** The service id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The service name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** What the service is. */
    @Column({ name: "description", type: "text", default: () => "''::text" })
    description!: string

    /** How long it takes, in minutes. */
    @Column({ name: "duration_min", type: "integer" })
    durationMin!: number

    /** The gap after it, in minutes. */
    @Column({ name: "buffer_min", type: "integer", default: () => "0" })
    bufferMin!: number

    /** The price in VND. */
    @Column({ name: "price_vnd", type: "bigint", nullable: true })
    priceVnd!: string | null

    /** The kind of resource it needs. */
    @Column({ name: "resource_kind", type: "text", nullable: true })
    resourceKind!: string | null

    /** Days until a follow-up message. */
    @Column({ name: "followup_days", type: "integer", nullable: true })
    followupDays!: number | null

    /** Whether it takes bookings. */
    @Column({ name: "active", type: "boolean", default: () => "true" })
    active!: boolean

    /** The display order. */
    @Column({ name: "sort_order", type: "integer", default: () => "0" })
    sortOrder!: number

    /** When it was created. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
