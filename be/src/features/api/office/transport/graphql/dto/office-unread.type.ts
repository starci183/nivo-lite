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
/** The caller's direct conversations: the customer conversations above zero unread. */
export class OfficeConversationUnreadType {
    /** The unread customer conversations. */
    @Field(() => [OfficeConversationUnreadEntryType])
    leads!: Array<OfficeConversationUnreadEntryType>
}
