import { Field, ID, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One ingredient of a recipe. */
export class InventoryRecipeLineType {
    /** The ingredient item. */
    @Field(() => ID)
    itemId!: string

    /** The item name. */
    @Field(() => String)
    name!: string

    /** The base unit. */
    @Field(() => String)
    unit!: string

    /** The quantity per product. */
    @Field(() => Float)
    qty!: number
}
