import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The AgentChatHolder GraphQL result. */
export class AgentChatHolderType {
    /** The conversationId value. */
    @Field(() => ID)
    conversationId!: string

    /** The handledBy value. */
    @Field(() => String, { nullable: true })
    handledBy!: string | null
}
