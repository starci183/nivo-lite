import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The AgentChatMessage GraphQL result. */
export class AgentChatMessageType {
    /** The id value. */
    @Field(() => ID)
    id!: string

    /** The role value. */
    @Field()
    role!: string

    /** The body value. */
    @Field()
    body!: string

    /** The createdAt value. */
    @Field()
    createdAt!: string
}
