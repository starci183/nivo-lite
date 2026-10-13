import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** The loyalty promo fields exposed through GraphQL. */
export class LoyaltyPromoType {
    /** The max per month. */
    @Field(() => Int)
    maxPerMonth!: number

    /** The hour from. */
    @Field(() => String)
    hourFrom!: string

    /** The hour to. */
    @Field(() => String)
    hourTo!: string

    /** The batch. */
    @Field(() => Int)
    batch!: number
}
