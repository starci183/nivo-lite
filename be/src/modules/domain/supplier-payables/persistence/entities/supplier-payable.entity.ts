import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity, Unique } from "typeorm"

@Entity({ schema: "public", name: "supplier_payables" })
@Unique("supplier_payables_invoice_key", ["workspaceId", "sellerTaxCode", "invoiceNo"])
/** A supplier invoice the accounting desk keeps: open until an outgoing payment settles it. */
export class SupplierPayableEntity extends UuidAbstractEntity {
    /** The workspace that owns the invoice. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The seller name. */
    @Column({ name: "supplier", type: "text" })
    supplier!: string

    /** The seller tax code. */
    @Column({ name: "seller_tax_code", type: "text" })
    sellerTaxCode!: string

    /** The invoice number. */
    @Column({ name: "invoice_no", type: "text" })
    invoiceNo!: string

    /** The total in VND. */
    @Column({ name: "amount_vnd", type: "bigint" })
    amountVnd!: string

    /** The issue date. */
    @Column({ name: "issued_on", type: "date" })
    issuedOn!: string

    /** The due date. */
    @Column({ name: "due_on", type: "date" })
    dueOn!: string

    /** Whether the invoice is still to pay. */
    @Column({ name: "status", type: "text", default: "open" })
    status!: "open" | "paid"

    /** The outgoing payment that settled it. */
    @Column({ name: "debit_ref", type: "text", nullable: true })
    debitRef!: string | null

    /** When it was marked paid. */
    @Column({ name: "paid_at", type: "timestamptz", nullable: true })
    paidAt!: Date | null

    /** The work item that decided the payment. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** When the desk first saw the invoice. */
    @Column({ name: "first_seen_at", type: "timestamptz", insert: false, update: false })
    firstSeenAt!: Date

    /** Who decided the payment. */
    @Column({ name: "decided_by", type: "text", nullable: true })
    decidedBy!: string | null
}
