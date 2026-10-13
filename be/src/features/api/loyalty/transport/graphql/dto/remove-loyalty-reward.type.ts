import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The remove loyalty reward fields exposed through GraphQL. */
export class RemoveLoyaltyRewardType {
    /** The deleted. */
    @Field(() => Boolean)
    deleted!: boolean
}
