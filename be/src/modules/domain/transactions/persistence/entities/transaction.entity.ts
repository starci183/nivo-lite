import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { ValueTransformer } from "typeorm"

/** Reads a Postgres `bigint` (which the driver returns as text) as a number; VND amounts fit a double. */
const bigintAsNumber: ValueTransformer = {
    to: (value: number | null | undefined) => value,
    from: (value: string | null) => (value === null ? null : Number(value)),
}

/** The payment channels the schema allows. */
export type TransactionChannel = "bank" | "cash" | "card" | "ewallet"

/** The lifecycle states of a payment. */
export type TransactionState = "unmatched" | "matched" | "needs_review"

/** Whether a move put money into the account or took it out. */
export type TransactionDirection = "credit" | "debit"

@Entity({ schema: "public", name: "transactions" })
/** One payment of a workspace: recorded unmatched, then matched to an invoice or sent to review. */
export class TransactionEntity {
    /** The transaction id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The input the payment arrived as. */
    @Column({ name: "inbound_event_id", type: "uuid", nullable: true })
    inboundEventId!: string | null

    /** The payment channel. */
    @Column({ name: "channel", type: "text", default: () => "'bank'" })
    channel!: TransactionChannel

    /** The money, VND. */
    @Column({ name: "amount_vnd", type: "bigint", transformer: bigintAsNumber })
    amountVnd!: number

    /** The transfer content. */
    @Column({ name: "reference", type: "text", nullable: true })
    reference!: string | null

    /** The payer's name. */
    @Column({ name: "payer", type: "text", nullable: true })
    payer!: string | null

    /** When the payment occurred. */
    @Column({ name: "occurred_at", type: "timestamptz", default: () => "now()" })
    occurredAt!: Date

    /** The invoice it settled. */
    @Column({ name: "invoice_id", type: "uuid", nullable: true })
    invoiceId!: string | null

    /** The lifecycle state. */
    @Column({ name: "status", type: "text", default: () => "'unmatched'" })
    status!: TransactionState

    /** When the record was created. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** Money in or out of the workspace's account. */
    @Column({ name: "direction", type: "text", default: () => "'credit'" })
    direction!: TransactionDirection
}
