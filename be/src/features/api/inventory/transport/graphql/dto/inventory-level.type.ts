import { Field, ID, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The stock level of an item at one location. */
export class InventoryLevelType {
    /** The location. */
    @Field(() => ID)
    locationId!: string

    /** The quantity on hand. */
    @Field(() => Float)
    qty!: number
}
