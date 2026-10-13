import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The redeem loyalty reward fields exposed through GraphQL. */
export class RedeemLoyaltyRewardType {
    /** The code. */
    @Field(() => String)
    code!: string

    /** The posted. */
    @Field(() => Boolean)
    posted!: boolean
}
