import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "inventory_recipe_lines" })
/** One ingredient of a recipe. */
export class InventoryRecipeLineEntity extends UuidAbstractEntity {
    /** The workspace that owns the line. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The recipe the ingredient belongs to. */
    @Column({ name: "recipe_id", type: "uuid" })
    recipeId!: string

    /** The ingredient item. */
    @Column({ name: "item_id", type: "uuid" })
    itemId!: string

    /** The quantity per product, decimal text. */
    @Column({ name: "qty", type: "numeric" })
    qty!: string
}
