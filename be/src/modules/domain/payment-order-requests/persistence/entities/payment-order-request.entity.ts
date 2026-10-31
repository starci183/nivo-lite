import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { PaymentOrderRequestKind } from "../../payment-order-requests.contracts"
import { tierTransformer } from "./tier-column.mapper"

@Entity({ schema: "public", name: "payment_order_requests" })
/** One request to open a payment order, answered by a job: one row of `public.payment_order_requests`. */
export class PaymentOrderRequestEntity extends UuidAbstractEntity {
    /** The workspace that pays. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The person who asked. */
    @Column({ name: "requested_by", type: "uuid" })
    requestedBy!: string

    /** What they asked to pay, a member of the table check. */
    @Column({ name: "kind", type: "text" })
    kind!: PaymentOrderRequestKind

    /** The plan or pack code, or null for a renewal. */
    @Column({ name: "target", type: "text", nullable: true })
    target!: string | null

    /** Where the request is, a member of the table check. */
    @Column({ name: "status", type: "text", default: () => "'pending'" })
    status!: "pending" | "done" | "failed"

    /** The payment order created by the worker. */
    @Column({ name: "order_id", type: "uuid", nullable: true })
    orderId!: string | null

    /** The stable refusal code written by the worker. */
    @Column({ name: "fault", type: "text", nullable: true })
    fault!: string | null

    /** When the worker answered it. */
    @Column({ name: "answered_at", type: "timestamptz", nullable: true })
    answeredAt!: Date | null

    /** The billing cycle asked for, or null. */
    @Column({ name: "cycle", type: "text", nullable: true })
    cycle!: "monthly" | "annual" | null

    /** The usage tier asked for, or null. */
    @Column({ name: "tier_credits", type: "bigint", nullable: true, transformer: tierTransformer })
    tierCredits!: number | null

    /** The seats asked for, or null. */
    @Column({ name: "seats", type: "integer", nullable: true })
    seats!: number | null
}
