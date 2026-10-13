import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** The loyalty expiry fields exposed through GraphQL. */
export class LoyaltyExpiryType {
    /** The months. */
    @Field(() => Int)
    months!: number

    /** The warn days. */
    @Field(() => Int)
    warnDays!: number
}
