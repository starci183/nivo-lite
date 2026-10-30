import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { OrderDetail, OrderKind, OrderStatus } from "../../payment-orders.contracts"

/** Reads a bigint column as a number, as the order contract always did. */
const amountTransformer = {
    to: (value: number): number => value,
    from: Number,
}

@Entity({ schema: "public", name: "payment_orders" })
/** One payment order of a workspace: one row of `public.payment_orders`. */
export class PaymentOrderEntity extends UuidAbstractEntity {
    /** The workspace that pays. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The member who created the order. */
    @Column({ name: "created_by", type: "uuid", nullable: true })
    createdBy!: string | null

    /** The plan code stored on the order. */
    @Column({ name: "plan_code", type: "text" })
    planCode!: string

    /** The amount to transfer in VND. */
    @Column({ name: "amount_vnd", type: "bigint", transformer: amountTransformer })
    amountVnd!: number

    /** The transfer content that identifies the order. */
    @Column({ name: "order_code", type: "text" })
    orderCode!: string

    /** The status, a member of the table check. */
    @Column({ name: "status", type: "text", default: () => "'pending'" })
    status!: OrderStatus

    /** When the order stops being payable. */
    @Column({ name: "expires_at", type: "timestamptz", default: () => "(now() + '00:30:00'::interval)" })
    expiresAt!: Date

    /** When the transfer settled it, or null. */
    @Column({ name: "paid_at", type: "timestamptz", nullable: true })
    paidAt!: Date | null

    /** The bank transaction that settled it; written by the settlement function. */
    @Column({ name: "sepay_transaction_id", type: "bigint", nullable: true, insert: false, update: false })
    sepayTransactionId!: string | null

    /** The kind, a member of the table check. */
    @Column({ name: "kind", type: "text", default: () => "'plan'" })
    kind!: OrderKind

    /** The credit pack of a top-up, or null. */
    @Column({ name: "pack_code", type: "text", nullable: true })
    packCode!: string | null

    /** What was sold. */
    @Column({ name: "detail", type: "jsonb", default: () => "'{}'::jsonb" })
    detail!: OrderDetail
}
