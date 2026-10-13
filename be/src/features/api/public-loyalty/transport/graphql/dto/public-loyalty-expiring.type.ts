import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** The points scheduled to expire soon. */
export class PublicLoyaltyExpiringType {
    /** The number of expiring points. */
    @Field(() => Int)
    points!: number

    /** The earliest expiry as ISO 8601, when any. */
    @Field(() => String, { nullable: true })
    firstAt!: string | null
}
