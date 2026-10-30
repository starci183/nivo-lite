import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { OrderStatus } from "../../orders.contracts"

/** Reads a bigint column as a number, as the order contract always did. */
const amountTransformer = {
    to: (value: number | null): number | null => value,
    from: (value: string | null): number | null => (value === null ? null : Number(value)),
}

@Entity({ schema: "public", name: "orders" })
/** One sales order of a workspace: one row of `public.orders`. */
export class OrderEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The customer, when known. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The input that started it. */
    @Column({ name: "inbound_event_id", type: "uuid", nullable: true })
    inboundEventId!: string | null

    /** The order number, unique per workspace. */
    @Column({ name: "order_no", type: "text" })
    orderNo!: string

    /** What was ordered. */
    @Column({ name: "items", type: "text", default: () => "''" })
    items!: string

    /** The money, VND, or null. */
    @Column({ name: "amount_vnd", type: "bigint", nullable: true, transformer: amountTransformer })
    amountVnd!: number | null

    /** Where the order stands. */
    @Column({ name: "status", type: "text", default: () => "'draft'" })
    status!: OrderStatus

    /** Who confirmed it. */
    @Column({ name: "confirmed_by", type: "text", nullable: true })
    confirmedBy!: string | null

    /** When the order was confirmed. */
    @Column({ name: "confirmed_at", type: "timestamptz", nullable: true })
    confirmedAt!: Date | null

    /** When the carrier received the order. */
    @Column({ name: "shipped_at", type: "timestamptz", nullable: true })
    shippedAt!: Date | null

    /** The carrier handling the shipment. */
    @Column({ name: "carrier", type: "text", nullable: true })
    carrier!: string | null

    /** The carrier's tracking reference. */
    @Column({ name: "tracking_code", type: "text", nullable: true })
    trackingCode!: string | null
}
