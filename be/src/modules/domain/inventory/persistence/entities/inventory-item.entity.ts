import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

/** One alternative unit of an item with its factor to the base unit. */
export interface InventoryItemUnit {
    /** The unit name. */
    readonly unit?: string
    /** How many base units one of this unit holds. */
    readonly factor?: number
}

@Entity({ schema: "public", name: "inventory_items" })
/** One stock item of a workspace's catalogue. */
export class InventoryItemEntity {
    /** The item. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that owns the item. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The stock-keeping code. */
    @Column({ name: "sku", type: "text" })
    sku!: string

    /** The item name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The base unit. */
    @Column({ name: "unit", type: "text", default: () => "'c\u00e1i'::text" })
    unit!: string

    /** The other units with their factor to the base unit. */
    @Column({ name: "units", type: "jsonb", default: () => "'[]'::jsonb" })
    units!: Array<InventoryItemUnit>

    /** The category. */
    @Column({ name: "category", type: "text", default: () => "''::text" })
    category!: string

    /** The cost per base unit, decimal text from the driver. */
    @Column({ name: "cost_vnd", type: "numeric", default: () => "0" })
    costVnd!: string

    /** The selling price, decimal text, or null. */
    @Column({ name: "sell_price_vnd", type: "numeric", nullable: true })
    sellPriceVnd!: string | null

    /** The quantity under which the item is low, decimal text. */
    @Column({ name: "reorder_point", type: "numeric", default: () => "0" })
    reorderPoint!: string

    /** The quantity an order brings, decimal text. */
    @Column({ name: "reorder_qty", type: "numeric", default: () => "0" })
    reorderQty!: string

    /** The usual supplier. */
    @Column({ name: "supplier_id", type: "uuid", nullable: true })
    supplierId!: string | null

    /** Other names of the item. */
    @Column({ name: "aliases", type: "text", array: true, default: () => "'{}'::text[]" })
    aliases!: Array<string>

    /** Whether the item is in use. */
    @Column({ name: "active", type: "boolean", default: () => "true" })
    active!: boolean

    /** The creation time. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** The last change. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
