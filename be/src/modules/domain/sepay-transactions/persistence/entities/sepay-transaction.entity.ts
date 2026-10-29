import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { ValueTransformer } from "typeorm"

/** Reads a Postgres `bigint` (which the driver returns as text) as a number; SePay ids and VND amounts fit a double. */
const bigintAsNumber: ValueTransformer = {
    to: (value: number | null | undefined) => value,
    from: (value: string | null) => (value === null ? null : Number(value)),
}

@Entity({ schema: "public", name: "sepay_transactions" })
/** One bank transfer SePay reported: the receipt claimed at intake and the settlement result written by the consumer. */
export class SepayTransactionEntity {
    /** The receipt id, completed after settlement. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** SePay's own transaction id, the idempotency key. */
    @Column({ name: "sepay_id", type: "bigint", transformer: bigintAsNumber })
    sepayId!: number

    /** The delivery body the consumer settles from. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: Readonly<Record<string, unknown>>

    /** The transferred amount; null until the consumer records it. */
    @Column({ name: "transfer_amount", type: "bigint", nullable: true, transformer: bigintAsNumber })
    transferAmount!: number | null

    /** The transfer content (or SePay code). */
    @Column({ name: "content", type: "text", nullable: true })
    content!: string | null

    /** The settlement status: received, then the outcome of the consumer. */
    @Column({ name: "status", type: "text", default: "received" })
    status!: string

    /** The payment order the transfer matched, when it matched one. */
    @Column({ name: "matched_order_id", type: "uuid", nullable: true })
    matchedOrderId!: string | null

    /** When the delivery was received. */
    @Column({ name: "received_at", type: "timestamptz", default: () => "now()" })
    receivedAt!: Date

    /** When the consumer finished the receipt; null while it is pending. */
    @Column({ name: "processed_at", type: "timestamptz", nullable: true })
    processedAt!: Date | null
}
