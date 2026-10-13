import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The loyalty sample member fields exposed through GraphQL. */
export class LoyaltySampleMemberType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The tier key. */
    @Field(() => String, { nullable: true })
    tierKey!: string | null
}
