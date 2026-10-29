import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "inventory_recipes" })
/** One product recipe whose sale takes ingredients out of stock. */
export class InventoryRecipeEntity {
    /** The recipe. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that owns the recipe. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The product name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** Other names of the product. */
    @Column({ name: "aliases", type: "text", array: true, default: () => "'{}'::text[]" })
    aliases!: Array<string>

    /** Whether the recipe is in use. */
    @Column({ name: "active", type: "boolean", default: () => "true" })
    active!: boolean

    /** The creation time. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
