import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "inventory_po_lines" })
/** One ordered item of a purchase order. */
export class InventoryPoLineEntity extends UuidAbstractEntity {
    /** The workspace that owns the line. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The order. */
    @Column({ name: "po_id", type: "uuid" })
    poId!: string

    /** The ordered item. */
    @Column({ name: "item_id", type: "uuid" })
    itemId!: string

    /** The ordered quantity, decimal text. */
    @Column({ name: "qty_ordered", type: "numeric" })
    qtyOrdered!: string

    /** The quantity received so far, decimal text. */
    @Column({ name: "qty_received", type: "numeric", default: () => "0" })
    qtyReceived!: string

    /** The unit cost, decimal text. */
    @Column({ name: "unit_cost_vnd", type: "numeric", default: () => "0" })
    unitCostVnd!: string
}
