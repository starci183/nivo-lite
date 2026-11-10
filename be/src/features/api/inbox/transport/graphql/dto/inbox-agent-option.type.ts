import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One agent the list can be filtered by or a customer handed to. */
export class InboxAgentOptionType {
    /** The agent id. */
    @Field(() => ID)
    id!: string

    /** The agent name. */
    @Field()
    name!: string
}
