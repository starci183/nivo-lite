import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The CreatedAgentChatConversation GraphQL result. */
export class CreatedAgentChatConversationType {
    /** The id value. */
    @Field(() => ID)
    id!: string
}
