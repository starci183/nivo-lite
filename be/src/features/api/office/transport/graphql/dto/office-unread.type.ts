import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The unread count of one direct conversation. */
export class OfficeConversationUnreadEntryType {
    /** The agent or lead id of the conversation. */
    @Field(() => ID)
    id!: string

    /** Lines the caller has not read, at most 99. */
    @Field(() => Int)
    unread!: number
}

@ObjectType()
/** The newest line of one direct conversation, as its row reads it. */
export class OfficeConversationLastType {
    /** The line's text. */
    @Field()
    body!: string

    /** When the line was written, ISO 8601. */
    @Field()
    at!: string

    /** The workspace account id of the line's author; null for the agent's own lines and unattributed legacy ones. */
    @Field(() => ID, { nullable: true })
    authorId!: string | null

    /** The display name of the line's human author; null for the agent's own and system lines. */
    @Field(() => String, { nullable: true })
    author!: string | null
}

@ObjectType()
/** One agent's direct conversation: the caller's unread count and the newest line, listed even when fully read. */
export class OfficeAgentConversationType {
    /** The agent id of the conversation. */
    @Field(() => ID)
    id!: string

    /** Lines the caller has not read, at most 99. */
    @Field(() => Int)
    unread!: number

    /** The newest line, or null while nobody wrote. */
    @Field(() => OfficeConversationLastType, { nullable: true })
    last!: OfficeConversationLastType | null
}

@ObjectType()
/** The caller's direct conversations: every agent conversation, and the customer conversations above zero unread. */
export class OfficeConversationUnreadType {
    /** The agent conversations, read or not. */
    @Field(() => [OfficeAgentConversationType])
    agents!: Array<OfficeAgentConversationType>

    /** The unread customer conversations. */
    @Field(() => [OfficeConversationUnreadEntryType])
    leads!: Array<OfficeConversationUnreadEntryType>
}
