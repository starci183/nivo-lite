import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The update loyalty member fields exposed through GraphQL. */
export class UpdateLoyaltyMemberType {
    /** The updated. */
    @Field(() => Boolean)
    updated!: boolean
}
