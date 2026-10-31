import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "inventory_receipts" })
/** One goods receipt booked against a purchase order. */
export class InventoryReceiptEntity extends UuidAbstractEntity {
    /** The workspace that owns the receipt. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The purchase order received against. */
    @Column({ name: "po_id", type: "uuid" })
    poId!: string

    /** The supplier's invoice number. */
    @Column({ name: "invoice_no", type: "text", nullable: true })
    invoiceNo!: string | null

    /** The received value, decimal text. */
    @Column({ name: "total_vnd", type: "numeric", precision: 16, scale: 0, default: () => "0" })
    totalVnd!: string

    /** The receiving note. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string

    /** Who received it. */
    @Column({ name: "received_by", type: "text", default: () => "''::text" })
    receivedBy!: string
}
