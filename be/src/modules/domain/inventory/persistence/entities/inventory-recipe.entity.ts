import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "inventory_recipes" })
/** One product recipe whose sale takes ingredients out of stock. */
export class InventoryRecipeEntity extends UuidAbstractEntity {
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
}
