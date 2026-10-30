import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "inventory_purchase_orders" })
/** One purchase order to a supplier. */
export class InventoryPurchaseOrderEntity extends UuidAbstractEntity {
    /** The workspace that owns the order. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The order number. */
    @Column({ name: "po_no", type: "text" })
    poNo!: string

    /** The supplier. */
    @Column({ name: "supplier_id", type: "uuid", nullable: true })
    supplierId!: string | null

    /** draft, waiting_approval, sent, partially_received, received or cancelled. */
    @Column({ name: "status", type: "text", default: () => "'draft'::text" })
    status!: string

    /** The order total, decimal text. */
    @Column({ name: "total_vnd", type: "numeric", default: () => "0" })
    totalVnd!: string

    /** The expected delivery day as YYYY-MM-DD. */
    @Column({ name: "expected_at", type: "date", nullable: true })
    expectedAt!: string | null

    /** The message to the supplier. */
    @Column({ name: "message", type: "text", default: () => "''::text" })
    message!: string

    /** When it was sent. */
    @Column({ name: "sent_at", type: "timestamptz", nullable: true })
    sentAt!: Date | null

    /** How it was sent: email or copy. */
    @Column({ name: "sent_via", type: "text", nullable: true })
    sentVia!: string | null

    /** The note written at sending. */
    @Column({ name: "send_note", type: "text", nullable: true })
    sendNote!: string | null

    /** The decision that gates the sending. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** The owner's note. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string

    /** auto or manual. */
    @Column({ name: "source", type: "text", default: () => "'manual'::text" })
    source!: string

    /** Who created it. */
    @Column({ name: "created_by", type: "text", default: () => "'NIVO'::text" })
    createdBy!: string

    /** How many reminders were sent. */
    @Column({ name: "reminders", type: "integer", default: () => "0" })
    reminders!: number
}
