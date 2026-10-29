import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "inventory_stock_levels" })
/** The quantity of one item at one location. */
export class InventoryStockLevelEntity {
    /** The workspace that owns the level. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The item. */
    @PrimaryColumn({ name: "item_id", type: "uuid" })
    itemId!: string

    /** The location. */
    @PrimaryColumn({ name: "location_id", type: "uuid" })
    locationId!: string

    /** The quantity on hand, decimal text. */
    @Column({ name: "qty", type: "numeric", default: () => "0" })
    qty!: string

    /** The last change. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
