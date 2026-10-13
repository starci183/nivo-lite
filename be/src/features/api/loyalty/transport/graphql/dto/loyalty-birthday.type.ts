import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** The loyalty birthday fields exposed through GraphQL. */
export class LoyaltyBirthdayType {
    /** The enabled. */
    @Field(() => Boolean)
    enabled!: boolean

    /** The points. */
    @Field(() => Int)
    points!: number

    /** The reward key. */
    @Field(() => String)
    rewardKey!: string

    /** The note. */
    @Field(() => String)
    note!: string
}
