import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { ValueTransformer } from "typeorm"

/** Where an invoice stands. */
export type InvoiceStatus = "draft" | "issued" | "paid" | "void"

/** Reads the bigint amount (text from the driver) as a number; invoices bill whole VND. */
const amountTransformer: ValueTransformer = {
    to: (value: number | null | undefined) => value,
    from: (value: string | null): number | null => (value === null ? null : Number(value)),
}

@Entity({ schema: "public", name: "invoices" })
/** One invoice of a workspace: for an order, or for one period of a contract. */
export class InvoiceEntity {
    /** The invoice. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that issued it. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The order it bills (an id of the orders capability), when it bills one. */
    @Column({ name: "order_id", type: "uuid", nullable: true })
    orderId!: string | null

    /** The customer it bills (an id of the leads capability). */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The number, unique within the workspace. */
    @Column({ name: "invoice_no", type: "text" })
    invoiceNo!: string

    /** The amount, whole VND. */
    @Column({ name: "amount_vnd", type: "bigint", transformer: amountTransformer })
    amountVnd!: number

    /** When payment is due. */
    @Column({ name: "due_at", type: "timestamptz", nullable: true })
    dueAt!: Date | null

    /** Where the invoice stands. */
    @Column({ name: "status", type: "text", default: () => "'draft'::text" })
    status!: InvoiceStatus

    /** The display name of the issuer. */
    @Column({ name: "issued_by", type: "text", nullable: true })
    issuedBy!: string | null

    /** When it was issued. */
    @Column({ name: "issued_at", type: "timestamptz", nullable: true })
    issuedAt!: Date | null

    /** When it was paid. */
    @Column({ name: "paid_at", type: "timestamptz", nullable: true })
    paidAt!: Date | null

    /** The creation time. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** The contract it renews (an id of the contracts capability), when it is a renewal. */
    @Column({ name: "contract_id", type: "uuid", nullable: true })
    contractId!: string | null

    /** The end date of the contract period it renews, `YYYY-MM-DD`. */
    @Column({ name: "period_ends_on", type: "date", nullable: true })
    periodEndsOn!: string | null
}
