import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** The add loyalty preset rewards fields exposed through GraphQL. */
export class AddLoyaltyPresetRewardsType {
    /** The added. */
    @Field(() => Int)
    added!: number
}
