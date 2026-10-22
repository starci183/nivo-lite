import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Who answers for an agent right now and who comes after them. */
export class AgentOwnersType {
    /** The member that answers now. */
    @Field(() => ID)
    ownerMemberId!: string

    /** The member after them, or null. */
    @Field(() => ID, { nullable: true })
    fallbackMemberId?: string | null
}
