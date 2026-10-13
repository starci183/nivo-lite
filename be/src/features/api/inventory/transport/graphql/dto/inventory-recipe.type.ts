import { Field, ID, ObjectType } from "@nestjs/graphql"
import { InventoryRecipeLineType } from "./inventory-recipe-line.type"

@ObjectType()
/** One recipe of the workbench. */
export class InventoryRecipeType {
    /** The recipe id. */
    @Field(() => ID)
    id!: string

    /** The product name. */
    @Field(() => String)
    name!: string

    /** Other names. */
    @Field(() => [[String]])
    aliases!: ReadonlyArray<string>

    /** The ingredients per product. */
    @Field(() => [[InventoryRecipeLineType]])
    lines!: ReadonlyArray<InventoryRecipeLineType>
}
