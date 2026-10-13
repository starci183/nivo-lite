import { Field, ID, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One stock movement of the history. */
export class InventoryMovementType {
    /** The movement id. */
    @Field(() => ID)
    id!: string

    /** The item name. */
    @Field(() => String)
    itemName!: string

    /** The base unit. */
    @Field(() => String)
    unit!: string

    /** The kind. */
    @Field(() => String)
    kind!: string

    /** The signed change. */
    @Field(() => Float)
    qty!: number

    /** The level after. */
    @Field(() => Float)
    qtyAfter!: number

    /** Why it moved. */
    @Field(() => String)
    reason!: string

    /** The reference label. */
    @Field(() => String)
    refLabel!: string

    /** Who moved it. */
    @Field(() => String)
    byName!: string

    /** The evidence link. */
    @Field(() => String)
    evidence!: string

    /** When it moved. */
    @Field(() => String)
    createdAt!: string
}
