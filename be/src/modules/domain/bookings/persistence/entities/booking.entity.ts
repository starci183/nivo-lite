import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { BookingStatus } from "../../bookings.contracts"

@Entity({ schema: "public", name: "bookings" })
/** One appointment of a customer for a service on a resource. */
export class BookingEntity {
    /** The booking id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The customer lead, or null. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The chat the booking was made in, or null. */
    @Column({ name: "conversation_id", type: "uuid", nullable: true })
    conversationId!: string | null

    /** The customer name. */
    @Column({ name: "customer_name", type: "text", default: () => "''::text" })
    customerName!: string

    /** The customer phone, or null. */
    @Column({ name: "customer_phone", type: "text", nullable: true })
    customerPhone!: string | null

    /** The customer email, or null. */
    @Column({ name: "customer_email", type: "text", nullable: true })
    customerEmail!: string | null

    /** The service. */
    @Column({ name: "service_id", type: "uuid" })
    serviceId!: string

    /** The resource. */
    @Column({ name: "resource_id", type: "uuid" })
    resourceId!: string

    /** The start of the visit. */
    @Column({ name: "start_at", type: "timestamptz" })
    startAt!: Date

    /** The end of the visit. */
    @Column({ name: "end_at", type: "timestamptz" })
    endAt!: Date

    /** The end of the visit with its buffer, which is when the resource frees up. */
    @Column({ name: "block_end_at", type: "timestamptz" })
    blockEndAt!: Date

    /** How many people come. */
    @Column({ name: "party_size", type: "integer", default: () => "1" })
    partySize!: number

    /** Where the booking stands. */
    @Column({ name: "status", type: "text", default: () => "'requested'::text" })
    status!: BookingStatus

    /** Whether the booking holds capacity of its resource. */
    @Column({ name: "holds_slot", type: "boolean", default: () => "true" })
    holdsSlot!: boolean

    /** The channel the booking came from. */
    @Column({ name: "source_channel", type: "text", default: () => "'manual'::text" })
    sourceChannel!: string

    /** The price in VND, or null. */
    @Column({ name: "price_vnd", type: "bigint", nullable: true })
    priceVnd!: string | null

    /** The deposit in VND. */
    @Column({ name: "deposit_vnd", type: "bigint", default: () => "0" })
    depositVnd!: string

    /** Where the deposit stands: none, due, paid or waived. */
    @Column({ name: "deposit_status", type: "text", default: () => "'none'::text" })
    depositStatus!: string

    /** The fee of a late cancellation or a no-show in VND. */
    @Column({ name: "cancel_fee_vnd", type: "bigint", default: () => "0" })
    cancelFeeVnd!: string

    /** The owner's note. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string

    /** The note that explains a forced placement. */
    @Column({ name: "conflict_note", type: "text", default: () => "''::text" })
    conflictNote!: string

    /** When the customer arrived, or null. */
    @Column({ name: "checked_in_at", type: "timestamptz", nullable: true })
    checkedInAt!: Date | null

    /** When the booking finished, or null. */
    @Column({ name: "done_at", type: "timestamptz", nullable: true })
    doneAt!: Date | null

    /** The start it was moved from, or null when it never moved. */
    @Column({ name: "rescheduled_from", type: "timestamptz", nullable: true })
    rescheduledFrom!: Date | null

    /** How many times it was moved. */
    @Column({ name: "reschedule_count", type: "integer", default: () => "0" })
    rescheduleCount!: number

    /** When it was cancelled, or null. */
    @Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
    cancelledAt!: Date | null

    /** Why it was cancelled, or null. */
    @Column({ name: "cancel_reason", type: "text", nullable: true })
    cancelReason!: string | null

    /** The work item that tracks it, or null. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** The order it belongs to, or null. */
    @Column({ name: "order_id", type: "uuid", nullable: true })
    orderId!: string | null

    /** The key that makes a repeated request answer the same booking, or null. */
    @Column({ name: "idempotency_key", type: "text", nullable: true })
    idempotencyKey!: string | null

    /** When the booking was made. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** When the booking last changed. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date

    /** The booking agent instance, filled by a trigger when the insert leaves it empty. */
    @Column({ name: "installation_id", type: "uuid", nullable: true })
    installationId!: string | null

    /** The one-time marks of effects already applied, keyed by mark. */
    @Column({ name: "effects", type: "jsonb", default: () => "'{}'::jsonb" })
    effects!: Record<string, boolean>
}
