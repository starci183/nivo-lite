import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** The sync loyalty members fields exposed through GraphQL. */
export class SyncLoyaltyMembersType {
    /** The created. */
    @Field(() => Int)
    created!: number

    /** The linked. */
    @Field(() => Int)
    linked!: number
}
