import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What drafting purchase orders for low items answers. */
export class DraftLowStockType {
    /** Purchase orders drafted. */
    @Field(() => Int)
    drafted!: number

    /** Items found low. */
    @Field(() => Int)
    low!: number
}
