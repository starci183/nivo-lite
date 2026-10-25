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
/** The caller's unread counts of the direct conversations; only conversations above zero are listed. */
export class OfficeConversationUnreadType {
    /** The unread agent conversations. */
    @Field(() => [OfficeConversationUnreadEntryType])
    agents!: Array<OfficeConversationUnreadEntryType>

    /** The unread customer conversations. */
    @Field(() => [OfficeConversationUnreadEntryType])
    leads!: Array<OfficeConversationUnreadEntryType>
}
