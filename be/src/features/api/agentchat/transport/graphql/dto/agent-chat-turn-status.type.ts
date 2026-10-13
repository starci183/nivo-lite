import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The AgentChatTurnStatus GraphQL result. */
export class AgentChatTurnStatusType {
    /** The id value. */
    @Field(() => ID)
    id!: string

    /** The jobId value. */
    @Field(() => ID)
    jobId!: string

    /** The conversationId value. */
    @Field(() => ID)
    conversationId!: string

    /** The status value. */
    @Field()
    status!: string

    /** The resultMessageId value. */
    @Field(() => ID, { nullable: true })
    resultMessageId!: string | null

    /** The errorCode value. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null
}
