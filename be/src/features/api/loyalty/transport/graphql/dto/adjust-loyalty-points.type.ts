import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The adjust loyalty points fields exposed through GraphQL. */
export class AdjustLoyaltyPointsType {
    /** The posted. */
    @Field(() => Boolean)
    posted!: boolean
}
