import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One other unit of an item. */
export class InventoryItemUnitType {
    /** The unit name. */
    @Field(() => String)
    unit!: string

    /** How many base units one of this unit holds. */
    @Field(() => Float)
    factor!: number
}
