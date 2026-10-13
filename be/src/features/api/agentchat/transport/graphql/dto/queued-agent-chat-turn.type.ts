import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The QueuedAgentChatTurn GraphQL result. */
export class QueuedAgentChatTurnType {
    /** The id value. */
    @Field(() => ID)
    id!: string

    /** The conversationId value. */
    @Field(() => ID)
    conversationId!: string

    /** The status value. */
    @Field()
    status!: string
}
