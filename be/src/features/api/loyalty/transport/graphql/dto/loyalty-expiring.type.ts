import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** The loyalty expiring fields exposed through GraphQL. */
export class LoyaltyExpiringType {
    /** The points. */
    @Field(() => Float)
    points!: number

    /** The first at. */
    @Field(() => String, { nullable: true })
    firstAt!: string | null
}
