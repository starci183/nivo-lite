import { Field, ID, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of a purchase order. */
export class InventoryPoLineType {
    /** The line id. */
    @Field(() => ID)
    id!: string

    /** The item. */
    @Field(() => ID)
    itemId!: string

    /** The item name. */
    @Field(() => String)
    name!: string

    /** The base unit. */
    @Field(() => String)
    unit!: string

    /** The ordered quantity. */
    @Field(() => Float)
    qtyOrdered!: number

    /** The received quantity. */
    @Field(() => Float)
    qtyReceived!: number

    /** The unit cost. */
    @Field(() => Float)
    unitCost!: number
}
