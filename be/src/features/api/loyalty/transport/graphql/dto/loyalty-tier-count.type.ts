import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** The loyalty tier count fields exposed through GraphQL. */
export class LoyaltyTierCountType {
    /** The key. */
    @Field(() => String)
    key!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The count. */
    @Field(() => Int)
    count!: number
}
