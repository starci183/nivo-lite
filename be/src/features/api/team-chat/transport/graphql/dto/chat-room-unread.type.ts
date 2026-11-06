import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What one room has unread for the viewer. */
export class ChatRoomUnreadType {
    /** The room. */
    @Field(() => ID)
    roomId!: string

    /** Messages after the read position the viewer did not write. */
    @Field(() => Int)
    unreadCount!: number

    /** The unread ones that mention the viewer. */
    @Field(() => Int)
    mentionCount!: number
}
